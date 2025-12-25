package websocket

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"slapjack/pkg/protocol"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 8192
)

// Client represents a single WebSocket connection
type Client struct {
	hub *Hub

	// The WebSocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// Session ID for reconnection
	SessionID string

	// Player ID in the game
	PlayerID string

	// Room code the client is in
	RoomCode string

	// Player name
	PlayerName string
}

// NewClient creates a new Client instance
func NewClient(hub *Hub, conn *websocket.Conn, sessionID string) *Client {
	return &Client{
		hub:       hub,
		conn:      conn,
		send:      make(chan []byte, 256),
		SessionID: sessionID,
	}
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse the message
		var msg protocol.WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			c.sendError("PARSE_ERROR", "Invalid message format")
			continue
		}

		// Handle the message
		c.handleMessage(msg)
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Start begins the client's read and write pumps
func (c *Client) Start() {
	go c.writePump()
	go c.readPump()
}

// SendMessage sends a protocol message to the client
func (c *Client) SendMessage(msg protocol.WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}
	select {
	case c.send <- data:
	default:
		// Buffer full, message dropped
	}
}

// sendError sends an error message to the client
func (c *Client) sendError(code, message string) {
	c.SendMessage(protocol.NewMessage(protocol.Error, protocol.ErrorPayload{
		Code:    code,
		Message: message,
	}))
}
