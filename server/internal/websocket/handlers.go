package websocket

import (
	"encoding/json"
	"log"
	"strings"

	"slapjack/pkg/protocol"
)

// handleMessage routes incoming messages to appropriate handlers
func (c *Client) handleMessage(msg protocol.WSMessage) {
	switch msg.Type {
	case protocol.CreateRoom:
		c.handleCreateRoom(msg.Payload)
	case protocol.JoinRoom:
		c.handleJoinRoom(msg.Payload)
	case protocol.LeaveRoom:
		c.handleLeaveRoom()
	case protocol.UpdateSettings:
		c.handleUpdateSettings(msg.Payload)
	case protocol.ChangeName:
		c.handleChangeName(msg.Payload)
	case protocol.StartGame:
		c.handleStartGame()
	case protocol.PlayCard:
		c.handlePlayCard()
	case protocol.Slap:
		c.handleSlap(msg.Payload, msg.Timestamp)
	case protocol.React:
		c.handleReact(msg.Payload)
	case protocol.KickPlayer:
		c.handleKickPlayer(msg.Payload)
	case protocol.EndGame:
		c.handleEndGame()
	default:
		c.sendError("UNKNOWN_MESSAGE", "Unknown message type: "+msg.Type)
	}
}

func (c *Client) handleCreateRoom(payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid create room payload")
		return
	}

	var createPayload protocol.CreateRoomPayload
	if err := json.Unmarshal(data, &createPayload); err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid create room payload")
		return
	}

	if createPayload.PlayerName == "" {
		c.sendError("INVALID_NAME", "Player name is required")
		return
	}

	if len(createPayload.PlayerName) > 20 {
		c.sendError("INVALID_NAME", "Player name must be 20 characters or less")
		return
	}

	// Clear any stale session data first
	c.RoomCode = ""
	c.PlayerID = ""
	c.PlayerName = ""

	// Create the room
	room, playerID, err := c.hub.rooms.CreateRoom(createPayload.PlayerName)
	if err != nil {
		log.Printf("Failed to create room: %v", err)
		c.sendError("CREATE_FAILED", "Failed to create room")
		return
	}

	// Update client state
	c.RoomCode = room.Code
	c.PlayerID = playerID
	c.PlayerName = createPayload.PlayerName

	log.Printf("[CREATE] Client %s now in room %s (PlayerID: %s)", c.SessionID, c.RoomCode, c.PlayerID)

	// Save session for reconnection
	c.hub.rooms.SaveSession(c.SessionID, playerID, room.Code)

	// Send response
	c.SendMessage(protocol.NewMessage(protocol.RoomCreated, protocol.RoomCreatedPayload{
		RoomCode: room.Code,
		Room:     room.ToProtocol(),
	}))

	log.Printf("Room created: %s by %s", room.Code, createPayload.PlayerName)
}

func (c *Client) handleJoinRoom(payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid join room payload")
		return
	}

	var joinPayload protocol.JoinRoomPayload
	if err := json.Unmarshal(data, &joinPayload); err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid join room payload")
		return
	}

	if joinPayload.RoomCode == "" {
		c.sendError("INVALID_CODE", "Room code is required")
		return
	}

	// Normalize room code to uppercase
	joinPayload.RoomCode = strings.ToUpper(joinPayload.RoomCode)

	if joinPayload.PlayerName == "" {
		c.sendError("INVALID_NAME", "Player name is required")
		return
	}

	if len(joinPayload.PlayerName) > 20 {
		c.sendError("INVALID_NAME", "Player name must be 20 characters or less")
		return
	}

	// Join the room
	log.Printf("[JOIN] Attempting to join room %s as %s", joinPayload.RoomCode, joinPayload.PlayerName)
	room, playerID, player, err := c.hub.rooms.JoinRoom(joinPayload.RoomCode, joinPayload.PlayerName)
	if err != nil {
		log.Printf("[JOIN] Failed to join room %s: %v", joinPayload.RoomCode, err)
		c.sendError("JOIN_FAILED", err.Error())
		return
	}
	log.Printf("[JOIN] Successfully joined room %s, playerID: %s", joinPayload.RoomCode, playerID)

	// Update client state
	c.RoomCode = room.Code
	c.PlayerID = playerID
	c.PlayerName = joinPayload.PlayerName

	// Save session for reconnection
	c.hub.rooms.SaveSession(c.SessionID, playerID, room.Code)

	// Send room state to joining player
	c.SendMessage(protocol.NewMessage(protocol.RoomJoined, protocol.RoomJoinedPayload{
		Room: room.ToProtocol(),
	}))

	// Notify other players
	log.Printf("[JOIN] About to broadcast PLAYER_JOINED to room %s (excluding %s)", room.Code, c.SessionID)
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.PlayerJoined, protocol.PlayerJoinedPayload{
		Player: player.ToProtocol(),
	}))
	c.hub.BroadcastToRoomExcept(room.Code, c.SessionID, msgData)

	log.Printf("[JOIN] Player %s joined room %s", joinPayload.PlayerName, room.Code)
}

func (c *Client) handleLeaveRoom() {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	roomCode := c.RoomCode
	playerID := c.PlayerID

	// Leave the room
	c.hub.rooms.LeaveRoom(roomCode, playerID)

	// Notify other players
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.PlayerLeft, protocol.PlayerLeftPayload{
		PlayerID: playerID,
	}))
	c.hub.BroadcastToRoomExcept(roomCode, c.SessionID, msgData)

	// Clear client state
	c.RoomCode = ""
	c.PlayerID = ""
	c.PlayerName = ""

	log.Printf("Player left room %s", roomCode)
}

func (c *Client) handleUpdateSettings(payload interface{}) {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	// Only host can update settings
	if room.HostID != c.PlayerID {
		c.sendError("NOT_HOST", "Only the host can change settings")
		return
	}

	// Can't change settings during game
	if room.Status != "waiting" {
		c.sendError("GAME_IN_PROGRESS", "Cannot change settings while game is in progress")
		return
	}

	data, err := json.Marshal(payload)
	if err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid settings payload")
		return
	}

	var settingsPayload protocol.UpdateSettingsPayload
	if err := json.Unmarshal(data, &settingsPayload); err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid settings payload")
		return
	}

	// Update settings
	room.UpdateSettings(settingsPayload)

	// Broadcast to all players in room
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.SettingsChanged, room.Settings))
	c.hub.BroadcastToRoom(c.RoomCode, msgData)

	log.Printf("Settings updated in room %s", c.RoomCode)
}

func (c *Client) handleChangeName(payload interface{}) {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	// Can't change name during game
	if room.Status != "waiting" {
		c.sendError("GAME_IN_PROGRESS", "Cannot change name while game is in progress")
		return
	}

	data, err := json.Marshal(payload)
	if err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid name payload")
		return
	}

	var namePayload protocol.ChangeNamePayload
	if err := json.Unmarshal(data, &namePayload); err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid name payload")
		return
	}

	if namePayload.NewName == "" {
		c.sendError("INVALID_NAME", "Name cannot be empty")
		return
	}

	if len(namePayload.NewName) > 20 {
		c.sendError("INVALID_NAME", "Name must be 20 characters or less")
		return
	}

	// Update player name
	player := room.GetPlayer(c.PlayerID)
	if player != nil {
		player.Name = namePayload.NewName
		c.PlayerName = namePayload.NewName
	}

	// Broadcast name change to all players
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.NameChanged, protocol.NameChangedPayload{
		PlayerID: c.PlayerID,
		NewName:  namePayload.NewName,
	}))
	c.hub.BroadcastToRoom(c.RoomCode, msgData)

	log.Printf("Player %s changed name to %s in room %s", c.PlayerID, namePayload.NewName, c.RoomCode)
}

func (c *Client) handleStartGame() {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	// Only host can start game
	if room.HostID != c.PlayerID {
		c.sendError("NOT_HOST", "Only the host can start the game")
		return
	}

	// Need at least 2 players
	if len(room.GetConnectedPlayers()) < 2 {
		c.sendError("NOT_ENOUGH_PLAYERS", "Need at least 2 players to start")
		return
	}

	// Start the game with countdown
	go c.hub.rooms.StartGameCountdown(c.RoomCode, c.hub.BroadcastToRoom)

	log.Printf("Game starting in room %s", c.RoomCode)
}

func (c *Client) handlePlayCard() {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	if room.Game == nil {
		c.sendError("NO_GAME", "Game has not started")
		return
	}

	// Play the card
	card, err := room.Game.PlayCard(c.PlayerID)
	if err != nil {
		c.sendError("PLAY_FAILED", err.Error())
		return
	}

	// Broadcast card played
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.CardPlayed, protocol.CardPlayedPayload{
		PlayerID:  c.PlayerID,
		Card:      card.ToProtocol(),
		PileCount: len(room.Game.Pile),
	}))
	c.hub.BroadcastToRoom(c.RoomCode, msgData)

	// Check for auto-slappable condition and broadcast turn change
	nextPlayer := room.Game.GetCurrentPlayer()
	turnMsg, _ := json.Marshal(protocol.NewMessage(protocol.TurnChanged, protocol.TurnChangedPayload{
		CurrentPlayerID: nextPlayer,
	}))
	c.hub.BroadcastToRoom(c.RoomCode, turnMsg)

	// Start turn timer
	go room.Game.StartTurnTimer(c.RoomCode, c.hub.BroadcastToRoom, c.hub.rooms)
}

func (c *Client) handleSlap(payload interface{}, serverTimestamp int64) {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	if room.Game == nil {
		c.sendError("NO_GAME", "Game has not started")
		return
	}

	// Parse client timestamp
	var slapPayload protocol.SlapPayload
	if payload != nil {
		data, _ := json.Marshal(payload)
		json.Unmarshal(data, &slapPayload)
	}

	// Broadcast that player attempted slap (for visual feedback)
	player := room.GetPlayer(c.PlayerID)
	attemptMsg, _ := json.Marshal(protocol.NewMessage(protocol.SlapAttempted, protocol.SlapAttemptedPayload{
		PlayerID:   c.PlayerID,
		PlayerName: player.Name,
	}))
	c.hub.BroadcastToRoom(c.RoomCode, attemptMsg)

	// Process the slap
	result := room.Game.ProcessSlap(c.PlayerID, serverTimestamp, slapPayload.Timestamp)

	// Broadcast result
	resultMsg, _ := json.Marshal(protocol.NewMessage(protocol.SlapResult, result))
	c.hub.BroadcastToRoom(c.RoomCode, resultMsg)

	// Check for elimination
	eliminatedPlayers := room.Game.CheckEliminations()
	for _, playerID := range eliminatedPlayers {
		elimMsg, _ := json.Marshal(protocol.NewMessage(protocol.PlayerEliminated, protocol.PlayerEliminatedPayload{
			PlayerID: playerID,
		}))
		c.hub.BroadcastToRoom(c.RoomCode, elimMsg)
	}

	// Check for game over
	if winner := room.Game.CheckWinner(); winner != "" {
		winnerPlayer := room.GetPlayer(winner)
		gameOverMsg, _ := json.Marshal(protocol.NewMessage(protocol.GameOver, protocol.GameOverPayload{
			WinnerID:   winner,
			WinnerName: winnerPlayer.Name,
			Stats:      room.Game.GetStats(),
		}))
		c.hub.BroadcastToRoom(c.RoomCode, gameOverMsg)
		room.Status = "finished"
	} else if result.Success {
		// Winner of slap plays next
		turnMsg, _ := json.Marshal(protocol.NewMessage(protocol.TurnChanged, protocol.TurnChangedPayload{
			CurrentPlayerID: result.PlayerID,
		}))
		c.hub.BroadcastToRoom(c.RoomCode, turnMsg)
	}
}

func (c *Client) handleReact(payload interface{}) {
	if c.RoomCode == "" {
		return
	}

	// Just broadcast the reaction to all players
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	var reactPayload protocol.ReactPayload
	if err := json.Unmarshal(data, &reactPayload); err != nil {
		return
	}

	// Broadcast to room
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.React, map[string]string{
		"playerId": c.PlayerID,
		"emoji":    reactPayload.Emoji,
	}))
	c.hub.BroadcastToRoom(c.RoomCode, msgData)
}

func (c *Client) handleKickPlayer(payload interface{}) {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	// Only host can kick
	if room.HostID != c.PlayerID {
		c.sendError("NOT_HOST", "Only the host can kick players")
		return
	}

	data, err := json.Marshal(payload)
	if err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid kick payload")
		return
	}

	var kickPayload protocol.KickPlayerPayload
	if err := json.Unmarshal(data, &kickPayload); err != nil {
		c.sendError("INVALID_PAYLOAD", "Invalid kick payload")
		return
	}

	// Can't kick yourself
	if kickPayload.PlayerID == c.PlayerID {
		c.sendError("INVALID_KICK", "Cannot kick yourself")
		return
	}

	// Get player name before removing
	player := room.GetPlayer(kickPayload.PlayerID)
	if player == nil {
		c.sendError("PLAYER_NOT_FOUND", "Player not found")
		return
	}
	playerName := player.Name

	// Remove player from room
	room.RemovePlayer(kickPayload.PlayerID)

	// Notify all players about the kick
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.PlayerKicked, protocol.PlayerKickedPayload{
		PlayerID:   kickPayload.PlayerID,
		PlayerName: playerName,
	}))
	c.hub.BroadcastToRoom(c.RoomCode, msgData)

	log.Printf("Player %s kicked from room %s by host", playerName, c.RoomCode)
}

func (c *Client) handleEndGame() {
	if c.RoomCode == "" {
		c.sendError("NOT_IN_ROOM", "You are not in a room")
		return
	}

	room := c.hub.rooms.GetRoom(c.RoomCode)
	if room == nil {
		c.sendError("ROOM_NOT_FOUND", "Room not found")
		return
	}

	// Only host can end game
	if room.HostID != c.PlayerID {
		c.sendError("NOT_HOST", "Only the host can end the game")
		return
	}

	// End the game
	room.Game = nil
	room.Status = "waiting"

	// Notify all players
	msgData, _ := json.Marshal(protocol.NewMessage(protocol.GameEnded, protocol.GameEndedPayload{
		Reason: "Host ended the game",
	}))
	c.hub.BroadcastToRoom(c.RoomCode, msgData)

	// Send updated room state
	roomMsg, _ := json.Marshal(protocol.NewMessage(protocol.RoomUpdated, protocol.RoomJoinedPayload{
		Room: room.ToProtocol(),
	}))
	c.hub.BroadcastToRoom(c.RoomCode, roomMsg)

	log.Printf("Game ended in room %s by host", c.RoomCode)
}
