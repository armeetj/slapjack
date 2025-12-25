package room

import (
	"sync"

	"slapjack/internal/game"
	"slapjack/pkg/protocol"

	"github.com/google/uuid"
)

// Player represents a player in a room
type Player struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IsHost      bool   `json:"isHost"`
	IsConnected bool   `json:"isConnected"`
	Position    int    `json:"position"`
}

// ToProtocol converts Player to protocol.Player
func (p *Player) ToProtocol() protocol.Player {
	return protocol.Player{
		ID:          p.ID,
		Name:        p.Name,
		CardCount:   0, // Updated by game state
		IsHost:      p.IsHost,
		IsConnected: p.IsConnected,
		Position:    p.Position,
	}
}

// Room represents a game room
type Room struct {
	Code     string            `json:"code"`
	Players  map[string]*Player `json:"players"`
	Settings Settings          `json:"settings"`
	Status   string            `json:"status"` // waiting, starting, playing, finished
	HostID   string            `json:"hostId"`
	Game     *game.Game        `json:"-"`

	mu sync.RWMutex
}

// NewRoom creates a new room with the given code and host
func NewRoom(code, hostName string) (*Room, string) {
	playerID := uuid.New().String()

	host := &Player{
		ID:          playerID,
		Name:        hostName,
		IsHost:      true,
		IsConnected: true,
		Position:    0,
	}

	return &Room{
		Code:     code,
		Players:  map[string]*Player{playerID: host},
		Settings: DefaultSettings(),
		Status:   "waiting",
		HostID:   playerID,
	}, playerID
}

// AddPlayer adds a new player to the room
func (r *Room) AddPlayer(name string) (*Player, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	playerID := uuid.New().String()
	position := len(r.Players)

	player := &Player{
		ID:          playerID,
		Name:        name,
		IsHost:      false,
		IsConnected: true,
		Position:    position,
	}

	r.Players[playerID] = player
	return player, nil
}

// RemovePlayer removes a player from the room
func (r *Room) RemovePlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Players, playerID)

	// If host left, assign new host
	if r.HostID == playerID && len(r.Players) > 0 {
		for id, p := range r.Players {
			if p.IsConnected {
				r.HostID = id
				p.IsHost = true
				break
			}
		}
	}

	// Reindex positions
	pos := 0
	for _, p := range r.Players {
		p.Position = pos
		pos++
	}
}

// GetPlayer returns a player by ID
func (r *Room) GetPlayer(playerID string) *Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Players[playerID]
}

// MarkPlayerDisconnected marks a player as disconnected
func (r *Room) MarkPlayerDisconnected(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if p, ok := r.Players[playerID]; ok {
		p.IsConnected = false
	}
}

// MarkPlayerConnected marks a player as connected
func (r *Room) MarkPlayerConnected(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if p, ok := r.Players[playerID]; ok {
		p.IsConnected = true
	}
}

// GetConnectedPlayers returns a list of connected players
func (r *Room) GetConnectedPlayers() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var players []*Player
	for _, p := range r.Players {
		if p.IsConnected {
			players = append(players, p)
		}
	}
	return players
}

// GetAllPlayers returns all players (connected or not)
func (r *Room) GetAllPlayers() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]*Player, 0, len(r.Players))
	for _, p := range r.Players {
		players = append(players, p)
	}
	return players
}

// IsFull returns true if the room is at capacity
func (r *Room) IsFull() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players) >= r.Settings.MaxPlayers
}

// IsEmpty returns true if the room has no connected players
func (r *Room) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, p := range r.Players {
		if p.IsConnected {
			return false
		}
	}
	return true
}

// UpdateSettings updates room settings from protocol payload
func (r *Room) UpdateSettings(payload protocol.UpdateSettingsPayload) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Settings.FromProtocol(payload)
}

// ToProtocol converts Room to protocol.RoomState
func (r *Room) ToProtocol() protocol.RoomState {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]protocol.Player, 0, len(r.Players))
	for _, p := range r.Players {
		player := p.ToProtocol()
		if r.Game != nil {
			player.CardCount = r.Game.GetPlayerCardCount(p.ID)
		}
		players = append(players, player)
	}

	return protocol.RoomState{
		Code:     r.Code,
		Players:  players,
		Settings: r.Settings.ToProtocol(),
		Status:   r.Status,
		HostID:   r.HostID,
	}
}

// StartGame initializes the game
func (r *Room) StartGame() {
	r.mu.Lock()
	defer r.mu.Unlock()

	playerIDs := make([]string, 0, len(r.Players))
	for _, p := range r.Players {
		if p.IsConnected {
			playerIDs = append(playerIDs, p.ID)
		}
	}

	r.Game = game.NewGame(playerIDs, r.Settings.EnableDoubles, r.Settings.EnableSandwich, r.Settings.BurnPenalty, r.Settings.SlapCooldownMs, r.Settings.TurnTimeoutMs, r.Settings.EnableSlapIn, r.Settings.MaxSlapIns)
	r.Status = "playing"
}
