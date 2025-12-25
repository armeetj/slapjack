package protocol

import "time"

// Message types for client -> server
const (
	CreateRoom     = "CREATE_ROOM"
	JoinRoom       = "JOIN_ROOM"
	LeaveRoom      = "LEAVE_ROOM"
	UpdateSettings = "UPDATE_SETTINGS"
	ChangeName     = "CHANGE_NAME"
	StartGame      = "START_GAME"
	PlayCard       = "PLAY_CARD"
	Slap           = "SLAP"
	React          = "REACT"
	KickPlayer     = "KICK_PLAYER"
	EndGame        = "END_GAME"
)

// Message types for server -> client
const (
	RoomCreated       = "ROOM_CREATED"
	RoomJoined        = "ROOM_JOINED"
	RoomUpdated       = "ROOM_UPDATED"
	PlayerJoined      = "PLAYER_JOINED"
	PlayerLeft        = "PLAYER_LEFT"
	PlayerKicked      = "PLAYER_KICKED"
	NameChanged       = "NAME_CHANGED"
	SettingsChanged   = "SETTINGS_CHANGED"
	GameStarting      = "GAME_STARTING"
	GameStarted       = "GAME_STARTED"
	CardsDealt        = "CARDS_DEALT"
	CardPlayed        = "CARD_PLAYED"
	TurnChanged       = "TURN_CHANGED"
	SlapAttempted     = "SLAP_ATTEMPTED"
	SlapResult        = "SLAP_RESULT"
	PlayerEliminated  = "PLAYER_ELIMINATED"
	GameOver          = "GAME_OVER"
	GameEnded         = "GAME_ENDED"
	Error             = "ERROR"
	Connected         = "CONNECTED"
	Reconnected       = "RECONNECTED"
	PlayerReconnected = "PLAYER_RECONNECTED"
	TurnWarning       = "TURN_WARNING"
)

// WSMessage is the base message structure for all WebSocket communication
type WSMessage struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
}

// NewMessage creates a new WebSocket message with current timestamp
func NewMessage(msgType string, payload interface{}) WSMessage {
	return WSMessage{
		Type:      msgType,
		Payload:   payload,
		Timestamp: time.Now().UnixMilli(),
	}
}

// Client -> Server Payloads

type CreateRoomPayload struct {
	PlayerName string `json:"playerName"`
}

type JoinRoomPayload struct {
	RoomCode   string `json:"roomCode"`
	PlayerName string `json:"playerName"`
}

type UpdateSettingsPayload struct {
	MaxPlayers      int  `json:"maxPlayers"`
	SlapCooldownMs  int  `json:"slapCooldownMs"`
	TurnTimeoutMs   int  `json:"turnTimeoutMs"`
	EnableSandwich  bool `json:"enableSandwich"`
	EnableDoubles   bool `json:"enableDoubles"`
	BurnPenalty     int  `json:"burnPenalty"`
	EnableSlapIn    bool `json:"enableSlapIn"`
	MaxSlapIns      int  `json:"maxSlapIns"`
}

type SlapPayload struct {
	Timestamp int64 `json:"timestamp"`
}

type ReactPayload struct {
	Emoji string `json:"emoji"`
}

type ChangeNamePayload struct {
	NewName string `json:"newName"`
}

type KickPlayerPayload struct {
	PlayerID string `json:"playerId"`
}

type GameEndedPayload struct {
	Reason string `json:"reason"`
}

type PlayerKickedPayload struct {
	PlayerID   string `json:"playerId"`
	PlayerName string `json:"playerName"`
}

// Server -> Client Payloads

type ConnectedPayload struct {
	SessionID string `json:"sessionId"`
}

type RoomCreatedPayload struct {
	RoomCode string    `json:"roomCode"`
	Room     RoomState `json:"room"`
}

type RoomJoinedPayload struct {
	Room RoomState `json:"room"`
}

type PlayerJoinedPayload struct {
	Player Player `json:"player"`
}

type PlayerLeftPayload struct {
	PlayerID string `json:"playerId"`
}

type NameChangedPayload struct {
	PlayerID string `json:"playerId"`
	NewName  string `json:"newName"`
}

type GameStartingPayload struct {
	Countdown int `json:"countdown"`
}

type GameStartedPayload struct {
	GameState GameStatePayload `json:"gameState"`
}

type CardsDealtPayload struct {
	PlayerCards map[string]int `json:"playerCards"`
}

type CardPlayedPayload struct {
	PlayerID  string `json:"playerId"`
	Card      Card   `json:"card"`
	PileCount int    `json:"pileCount"`
}

type TurnChangedPayload struct {
	CurrentPlayerID string `json:"currentPlayerId"`
}

type TurnWarningPayload struct {
	SecondsRemaining int `json:"secondsRemaining"`
}

type SlapAttemptedPayload struct {
	PlayerID   string `json:"playerId"`
	PlayerName string `json:"playerName"`
}

type SlapResultPayload struct {
	PlayerID    string `json:"playerId"`
	Success     bool   `json:"success"`
	Reason      string `json:"reason"` // "jack", "doubles", "sandwich", "invalid"
	CardsWon    int    `json:"cardsWon,omitempty"`
	BurnPenalty int    `json:"burnPenalty,omitempty"`
}

type PlayerEliminatedPayload struct {
	PlayerID string `json:"playerId"`
}

type GameOverPayload struct {
	WinnerID   string    `json:"winnerId"`
	WinnerName string    `json:"winnerName"`
	Stats      GameStats `json:"stats"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Shared Types

type Player struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	CardCount   int    `json:"cardCount"`
	IsHost      bool   `json:"isHost"`
	IsConnected bool   `json:"isConnected"`
	Position    int    `json:"position"`
}

type Card struct {
	Suit string `json:"suit"` // hearts, diamonds, clubs, spades
	Rank string `json:"rank"` // A, 2-10, J, Q, K
}

type RoomSettings struct {
	MaxPlayers      int  `json:"maxPlayers"`
	SlapCooldownMs  int  `json:"slapCooldownMs"`
	TurnTimeoutMs   int  `json:"turnTimeoutMs"`
	EnableSandwich  bool `json:"enableSandwich"`
	EnableDoubles   bool `json:"enableDoubles"`
	BurnPenalty     int  `json:"burnPenalty"`
	EnableSlapIn    bool `json:"enableSlapIn"`
	MaxSlapIns      int  `json:"maxSlapIns"`
}

type RoomState struct {
	Code     string       `json:"code"`
	Players  []Player     `json:"players"`
	Settings RoomSettings `json:"settings"`
	Status   string       `json:"status"` // waiting, starting, playing, finished
	HostID   string       `json:"hostId"`
}

type GameStatePayload struct {
	Pile             []Card         `json:"pile"`
	CurrentPlayerID  string         `json:"currentPlayerId"`
	PlayerCardCounts map[string]int `json:"playerCardCounts"`
	CanSlap          bool           `json:"canSlap"`
}

type GameStats struct {
	TotalSlaps     int            `json:"totalSlaps"`
	SuccessfulSlap map[string]int `json:"successfulSlaps"`
	CardsBurned    map[string]int `json:"cardsBurned"`
	Duration       int64          `json:"duration"` // milliseconds
}

// DefaultSettings returns the default room settings
func DefaultSettings() RoomSettings {
	return RoomSettings{
		MaxPlayers:     4,
		SlapCooldownMs: 200,
		TurnTimeoutMs:  10000,
		EnableSandwich: true,
		EnableDoubles:  true,
		BurnPenalty:    1,
		EnableSlapIn:   true,
		MaxSlapIns:     3,
	}
}
