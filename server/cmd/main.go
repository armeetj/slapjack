package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"slapjack/internal/redis"
	ws "slapjack/internal/websocket"
	"slapjack/pkg/protocol"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development
		// In production, restrict to your domain
		return true
	},
}

func main() {
	// Get configuration from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	// Connect to Redis
	store, err := redis.NewStore(redisURL)
	if err != nil {
		log.Printf("Warning: Failed to connect to Redis: %v", err)
		log.Println("Running without Redis - game state will be in-memory only")
		store = nil
	} else {
		defer store.Close()
		log.Println("Connected to Redis")
	}

	// Create hub
	hub := ws.NewHub(store)
	go hub.Run()

	// HTTP handlers
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, w, r)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		rooms := hub.GetRoomManager().GetActiveRooms()
		json.NewEncoder(w).Encode(rooms)
	})

	http.HandleFunc("/api/debug", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		debug := hub.GetDebugInfo()
		json.NewEncoder(w).Encode(debug)
	})

	// Serve static files (for testing)
	http.Handle("/", http.FileServer(http.Dir("./static")))

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func handleWebSocket(hub *ws.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Check for existing session (reconnection)
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	// Create client
	client := ws.NewClient(hub, conn, sessionID)

	// Check for reconnection
	if session := hub.GetRoomManager().GetSession(sessionID); session != nil {
		// Reconnecting player
		room := hub.GetRoomManager().GetRoom(session.RoomCode)
		if room != nil {
			client.RoomCode = session.RoomCode
			client.PlayerID = session.PlayerID
			player := room.GetPlayer(session.PlayerID)
			if player != nil {
				client.PlayerName = player.Name
				room.MarkPlayerConnected(session.PlayerID)
			}
		}
	}

	// Register with hub
	hub.Register(client)

	// Send connected message with session ID
	client.SendMessage(protocol.NewMessage(protocol.Connected, protocol.ConnectedPayload{
		SessionID: sessionID,
	}))

	// If reconnecting, send current room state
	if client.RoomCode != "" {
		room := hub.GetRoomManager().GetRoom(client.RoomCode)
		if room != nil {
			client.SendMessage(protocol.NewMessage(protocol.Reconnected, protocol.RoomJoinedPayload{
				Room: room.ToProtocol(),
			}))

			// Notify others of reconnection
			hub.GetRoomManager().NotifyPlayerDisconnected(client.RoomCode, client.PlayerID, hub.BroadcastToRoom)
		}
	}

	// Start client pumps
	client.Start()
}
