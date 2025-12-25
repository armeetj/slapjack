package websocket

import (
	"log"
	"sync"

	"slapjack/internal/redis"
	"slapjack/internal/room"
)

// Hub maintains the set of active clients and broadcasts messages to the rooms
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Clients by session ID for reconnection
	sessions map[string]*Client

	// Room manager
	rooms *room.Manager

	// Redis store
	store *redis.Store

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for concurrent access
	mu sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub(store *redis.Store) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		sessions:   make(map[string]*Client),
		rooms:      room.NewManager(store),
		store:      store,
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main event loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if client.SessionID != "" {
				h.sessions[client.SessionID] = client
			}
			h.mu.Unlock()
			log.Printf("Client connected: %s", client.SessionID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if client.SessionID != "" {
					delete(h.sessions, client.SessionID)
				}
				close(client.send)
			}
			h.mu.Unlock()

			// Handle room leave if client was in a room
			if client.RoomCode != "" {
				h.handlePlayerDisconnect(client)
			}
			log.Printf("Client disconnected: %s", client.SessionID)
		}
	}
}

// Register adds a client to the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// GetClientBySession returns a client by their session ID
func (h *Hub) GetClientBySession(sessionID string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.sessions[sessionID]
}

// GetRoomManager returns the room manager
func (h *Hub) GetRoomManager() *room.Manager {
	return h.rooms
}

// BroadcastToRoom sends a message to all clients in a room
func (h *Hub) BroadcastToRoom(roomCode string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.RoomCode == roomCode {
			select {
			case client.send <- message:
			default:
				// Client's send buffer is full, they'll be cleaned up
			}
		}
	}
}

// BroadcastToRoomExcept sends a message to all clients in a room except one
func (h *Hub) BroadcastToRoomExcept(roomCode string, excludeSessionID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	count := 0
	for client := range h.clients {
		log.Printf("[Broadcast] Client %s in room %s (looking for %s)", client.SessionID, client.RoomCode, roomCode)
		if client.RoomCode == roomCode && client.SessionID != excludeSessionID {
			select {
			case client.send <- message:
				count++
				log.Printf("[Broadcast] Sent to client %s", client.SessionID)
			default:
				log.Printf("[Broadcast] Client %s buffer full", client.SessionID)
			}
		}
	}
	log.Printf("[Broadcast] Sent to %d clients in room %s (excluding %s)", count, roomCode, excludeSessionID)
}

// SendToClient sends a message to a specific client
func (h *Hub) SendToClient(sessionID string, message []byte) {
	h.mu.RLock()
	client := h.sessions[sessionID]
	h.mu.RUnlock()

	if client != nil {
		select {
		case client.send <- message:
		default:
		}
	}
}

// handlePlayerDisconnect handles a player disconnecting from a room
func (h *Hub) handlePlayerDisconnect(client *Client) {
	r := h.rooms.GetRoom(client.RoomCode)
	if r == nil {
		return
	}

	roomCode := client.RoomCode
	playerID := client.PlayerID
	isHost := r.HostID == playerID

	// If host disconnects, disband the entire room
	if isHost {
		log.Printf("Host disconnected, disbanding room %s", roomCode)
		h.rooms.DeleteRoom(roomCode)
		// Notify all other players room is closed
		h.BroadcastToRoomExcept(roomCode, client.SessionID, []byte(`{"type":"ROOM_CLOSED","payload":{"reason":"Host left"}}`))
		return
	}

	// Remove player from room
	r.RemovePlayer(playerID)

	// If room is now empty, delete it
	if r.IsEmpty() {
		log.Printf("Room %s is empty, deleting", roomCode)
		h.rooms.DeleteRoom(roomCode)
		return
	}

	// Notify other players
	h.rooms.NotifyPlayerLeft(roomCode, playerID, h.BroadcastToRoom)
}

// GetClientsInRoom returns all connected clients in a room
func (h *Hub) GetClientsInRoom(roomCode string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var clients []*Client
	for client := range h.clients {
		if client.RoomCode == roomCode {
			clients = append(clients, client)
		}
	}
	return clients
}

// DebugClient represents client info for debugging
type DebugClient struct {
	SessionID  string `json:"sessionId"`
	PlayerID   string `json:"playerId"`
	PlayerName string `json:"playerName"`
	RoomCode   string `json:"roomCode"`
}

// DebugInfo contains all debug information
type DebugInfo struct {
	TotalClients int              `json:"totalClients"`
	TotalRooms   int              `json:"totalRooms"`
	Clients      []DebugClient    `json:"clients"`
	Rooms        []room.DebugRoom `json:"rooms"`
}

// GetDebugInfo returns debug information about the hub state
func (h *Hub) GetDebugInfo() DebugInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients := make([]DebugClient, 0, len(h.clients))
	for client := range h.clients {
		clients = append(clients, DebugClient{
			SessionID:  client.SessionID,
			PlayerID:   client.PlayerID,
			PlayerName: client.PlayerName,
			RoomCode:   client.RoomCode,
		})
	}

	rooms := h.rooms.GetAllRoomsDebug()

	return DebugInfo{
		TotalClients: len(h.clients),
		TotalRooms:   len(rooms),
		Clients:      clients,
		Rooms:        rooms,
	}
}
