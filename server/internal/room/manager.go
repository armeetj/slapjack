package room

import (
	"encoding/json"
	"errors"
	"log"
	"math/rand"
	"sync"
	"time"

	"slapjack/internal/redis"
	"slapjack/pkg/protocol"
)

const (
	roomCodeChars   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Avoiding confusing chars like 0/O, 1/I
	roomCodeLength  = 4
	roomTTL         = 2 * time.Hour
	sessionTTL      = 30 * time.Minute
	cleanupInterval = 5 * time.Minute
)

// SessionData for in-memory fallback
type SessionData struct {
	PlayerID  string
	RoomCode  string
}

// Manager handles room lifecycle and coordination
type Manager struct {
	rooms    map[string]*Room
	sessions map[string]*SessionData // In-memory session fallback
	store    *redis.Store
	mu       sync.RWMutex
}

// NewManager creates a new room manager
func NewManager(store *redis.Store) *Manager {
	m := &Manager{
		rooms:    make(map[string]*Room),
		sessions: make(map[string]*SessionData),
		store:    store,
	}

	// Start cleanup routine
	go m.cleanupRoutine()

	return m
}

// generateRoomCode generates a unique room code
func (m *Manager) generateRoomCode() string {
	for attempts := 0; attempts < 100; attempts++ {
		code := make([]byte, roomCodeLength)
		for i := range code {
			code[i] = roomCodeChars[rand.Intn(len(roomCodeChars))]
		}
		codeStr := string(code)

		m.mu.RLock()
		_, exists := m.rooms[codeStr]
		m.mu.RUnlock()

		if !exists {
			return codeStr
		}
	}
	return ""
}

// CreateRoom creates a new room and returns it with the host's player ID
func (m *Manager) CreateRoom(hostName string) (*Room, string, error) {
	code := m.generateRoomCode()
	if code == "" {
		return nil, "", errors.New("failed to generate room code")
	}

	room, playerID := NewRoom(code, hostName)

	m.mu.Lock()
	m.rooms[code] = room
	m.mu.Unlock()

	// Store in Redis
	if m.store != nil {
		m.store.AddActiveRoom(code)
		m.store.SetRoom(code, room, roomTTL)
	}

	return room, playerID, nil
}

// JoinRoom adds a player to an existing room
func (m *Manager) JoinRoom(code, playerName string) (*Room, string, *Player, error) {
	m.mu.RLock()
	room, exists := m.rooms[code]
	m.mu.RUnlock()

	if !exists {
		return nil, "", nil, errors.New("room not found")
	}

	if room.Status != "waiting" {
		return nil, "", nil, errors.New("game already in progress")
	}

	if room.IsFull() {
		return nil, "", nil, errors.New("room is full")
	}

	player, err := room.AddPlayer(playerName)
	if err != nil {
		return nil, "", nil, err
	}

	// Update Redis
	if m.store != nil {
		m.store.SetRoom(code, room, roomTTL)
	}

	return room, player.ID, player, nil
}

// LeaveRoom removes a player from a room
func (m *Manager) LeaveRoom(code, playerID string) {
	m.mu.RLock()
	room, exists := m.rooms[code]
	m.mu.RUnlock()

	if !exists {
		return
	}

	room.RemovePlayer(playerID)

	// If room is empty, delete immediately
	if room.IsEmpty() {
		m.mu.Lock()
		delete(m.rooms, code)
		m.mu.Unlock()
		if m.store != nil {
			m.store.DeleteRoom(code)
		}
		log.Printf("Room %s deleted (all players left)", code)
		return
	}

	// Update Redis
	if m.store != nil {
		m.store.SetRoom(code, room, roomTTL)
	}
}

// GetRoom returns a room by code
func (m *Manager) GetRoom(code string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.rooms[code]
}

// DeleteRoom removes a room immediately
func (m *Manager) DeleteRoom(code string) {
	m.mu.Lock()
	delete(m.rooms, code)
	m.mu.Unlock()

	if m.store != nil {
		m.store.DeleteRoom(code)
	}
}

// RoomSummary represents a room for the lobby list
type RoomSummary struct {
	Code        string `json:"code"`
	PlayerCount int    `json:"playerCount"`
	MaxPlayers  int    `json:"maxPlayers"`
	Status      string `json:"status"`
	HostName    string `json:"hostName"`
}

// GetActiveRooms returns a list of joinable rooms
func (m *Manager) GetActiveRooms() []RoomSummary {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rooms := make([]RoomSummary, 0)
	for _, room := range m.rooms {
		// Only show waiting rooms that aren't full
		if room.Status == "waiting" && !room.IsFull() {
			hostName := ""
			for _, p := range room.Players {
				if p.ID == room.HostID {
					hostName = p.Name
					break
				}
			}
			rooms = append(rooms, RoomSummary{
				Code:        room.Code,
				PlayerCount: len(room.GetConnectedPlayers()),
				MaxPlayers:  room.Settings.MaxPlayers,
				Status:      room.Status,
				HostName:    hostName,
			})
		}
	}
	return rooms
}

// DebugPlayer for debug info
type DebugPlayer struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	CardCount   int    `json:"cardCount"`
	IsHost      bool   `json:"isHost"`
	IsConnected bool   `json:"isConnected"`
}

// DebugRoom for debug info
type DebugRoom struct {
	Code    string        `json:"code"`
	Status  string        `json:"status"`
	HostID  string        `json:"hostId"`
	Players []DebugPlayer `json:"players"`
	HasGame bool          `json:"hasGame"`
}

// GetAllRoomsDebug returns all rooms with debug info
func (m *Manager) GetAllRoomsDebug() []DebugRoom {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rooms := make([]DebugRoom, 0, len(m.rooms))
	for _, room := range m.rooms {
		players := make([]DebugPlayer, 0, len(room.Players))
		for _, p := range room.Players {
			cardCount := 0
			if room.Game != nil {
				cardCount = len(room.Game.PlayerHands[p.ID])
			}
			players = append(players, DebugPlayer{
				ID:          p.ID,
				Name:        p.Name,
				CardCount:   cardCount,
				IsHost:      p.ID == room.HostID,
				IsConnected: p.IsConnected,
			})
		}
		rooms = append(rooms, DebugRoom{
			Code:    room.Code,
			Status:  room.Status,
			HostID:  room.HostID,
			Players: players,
			HasGame: room.Game != nil,
		})
	}
	return rooms
}

// SaveSession saves a player's session for reconnection
func (m *Manager) SaveSession(sessionID, playerID, roomCode string) {
	// Always save to in-memory map
	m.mu.Lock()
	m.sessions[sessionID] = &SessionData{
		PlayerID: playerID,
		RoomCode: roomCode,
	}
	m.mu.Unlock()
	log.Printf("[Session] Saved session %s -> room %s, player %s", sessionID, roomCode, playerID)

	// Also save to Redis if available
	if m.store != nil {
		m.store.SetSession(sessionID, redis.SessionData{
			PlayerID:  playerID,
			RoomCode:  roomCode,
			ExpiresAt: time.Now().Add(sessionTTL),
		}, sessionTTL)
	}
}

// GetSession retrieves a player's session
func (m *Manager) GetSession(sessionID string) *redis.SessionData {
	// Check in-memory map first
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if exists {
		log.Printf("[Session] Found in-memory session %s -> room %s", sessionID, session.RoomCode)
		return &redis.SessionData{
			PlayerID: session.PlayerID,
			RoomCode: session.RoomCode,
		}
	}

	// Fall back to Redis
	if m.store != nil {
		redisSession, _ := m.store.GetSession(sessionID)
		return redisSession
	}

	return nil
}

// NotifyPlayerDisconnected notifies other players that someone disconnected
func (m *Manager) NotifyPlayerDisconnected(roomCode, playerID string, broadcast func(string, []byte)) {
	room := m.GetRoom(roomCode)
	if room == nil {
		return
	}

	// Update room state
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.RoomUpdated, protocol.RoomJoinedPayload{
		Room: room.ToProtocol(),
	}))
	broadcast(roomCode, msgData)
}

// NotifyPlayerLeft notifies other players that someone left
func (m *Manager) NotifyPlayerLeft(roomCode, playerID string, broadcast func(string, []byte)) {
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.PlayerLeft, protocol.PlayerLeftPayload{
		PlayerID: playerID,
	}))
	broadcast(roomCode, msgData)
}

// CleanupPlayerRooms removes player from any existing rooms (for when they create a new one)
func (m *Manager) CleanupPlayerRooms(playerID string, broadcast func(string, []byte)) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for code, room := range m.rooms {
		// Check if player is in this room
		for _, p := range room.Players {
			if p.ID == playerID {
				// If they're the host, delete the whole room
				if room.HostID == playerID {
					delete(m.rooms, code)
					if m.store != nil {
						m.store.DeleteRoom(code)
					}
					log.Printf("Deleted room %s (host created new room)", code)
					// Notify other players
					go func(roomCode string) {
						broadcast(roomCode, []byte(`{"type":"ROOM_CLOSED","payload":{"reason":"Host left"}}`))
					}(code)
				} else {
					// Just remove them from the room
					room.RemovePlayer(playerID)
					go func(roomCode, pid string) {
						m.NotifyPlayerLeft(roomCode, pid, broadcast)
					}(code, playerID)
				}
				break
			}
		}
	}
}

// StartGameCountdown starts the game countdown and then starts the game
func (m *Manager) StartGameCountdown(roomCode string, broadcast func(string, []byte)) {
	room := m.GetRoom(roomCode)
	if room == nil {
		return
	}

	room.Status = "starting"

	// 3-2-1 countdown
	for i := 3; i > 0; i-- {
		msgData, _ := json.Marshal(protocol.NewMessage(protocol.GameStarting, protocol.GameStartingPayload{
			Countdown: i,
		}))
		broadcast(roomCode, msgData)
		time.Sleep(1 * time.Second)
	}

	// Start the game
	room.StartGame()

	// Send game started
	gameState := room.Game.GetState()
	startedMsg, _ := json.Marshal(protocol.NewMessage(protocol.GameStarted, protocol.GameStartedPayload{
		GameState: gameState,
	}))
	broadcast(roomCode, startedMsg)

	// Send cards dealt (card counts per player)
	dealtMsg, _ := json.Marshal(protocol.NewMessage(protocol.CardsDealt, protocol.CardsDealtPayload{
		PlayerCards: room.Game.GetCardCounts(),
	}))
	broadcast(roomCode, dealtMsg)

	// Send first turn
	turnMsg, _ := json.Marshal(protocol.NewMessage(protocol.TurnChanged, protocol.TurnChangedPayload{
		CurrentPlayerID: room.Game.GetCurrentPlayer(),
	}))
	broadcast(roomCode, turnMsg)

	// Start turn timer
	go room.Game.StartTurnTimer(roomCode, broadcast, m)

	log.Printf("Game started in room %s", roomCode)
}

// scheduleRoomCleanup schedules a room for cleanup after a delay
func (m *Manager) scheduleRoomCleanup(code string, delay time.Duration) {
	time.Sleep(delay)

	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[code]
	if !exists {
		return
	}

	// Check if still empty
	if room.IsEmpty() {
		delete(m.rooms, code)
		if m.store != nil {
			m.store.DeleteRoom(code)
		}
		log.Printf("Room %s cleaned up", code)
	}
}

// cleanupRoutine periodically cleans up empty/stale rooms
func (m *Manager) cleanupRoutine() {
	ticker := time.NewTicker(cleanupInterval)
	for range ticker.C {
		m.mu.Lock()
		for code, room := range m.rooms {
			if room.IsEmpty() || room.Status == "finished" {
				delete(m.rooms, code)
				if m.store != nil {
					m.store.DeleteRoom(code)
				}
				log.Printf("Room %s cleaned up (routine)", code)
			}
		}
		m.mu.Unlock()
	}
}
