package game

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"slapjack/pkg/protocol"
)

// SlapAttempt represents a slap attempt with timing info
type SlapAttempt struct {
	PlayerID        string
	ServerTimestamp int64
	ClientTimestamp int64
}

// Game represents the game state
type Game struct {
	PlayerHands    map[string][]Card
	Pile           []Card
	TurnOrder      []string
	CurrentTurnIdx int
	Rules          *Rules
	BurnPenalty    int
	SlapCooldownMs int
	TurnTimeoutMs  int

	// Slap-in settings
	EnableSlapIn bool
	MaxSlapIns   int
	SlapInCounts map[string]int // Track how many times each player has slapped back in

	// Slap handling
	LastSlapTime   map[string]time.Time
	PendingSlaps   []SlapAttempt
	SlapWindowOpen bool
	SlapMu         sync.Mutex

	// Turn timer
	TurnTimerCancel chan struct{}

	// Stats
	Stats          *GameStats
	StartTime      time.Time

	mu sync.RWMutex
}

// GameStats tracks game statistics
type GameStats struct {
	TotalSlaps      int
	SuccessfulSlaps map[string]int
	CardsBurned     map[string]int
}

// NewGame creates a new game with the given players
func NewGame(playerIDs []string, enableDoubles, enableSandwich bool, burnPenalty, slapCooldownMs, turnTimeoutMs int, enableSlapIn bool, maxSlapIns int) *Game {
	deck := NewDeck()
	deck.Shuffle()
	hands := deck.Deal(len(playerIDs))

	playerHands := make(map[string][]Card)
	slapInCounts := make(map[string]int)
	for i, id := range playerIDs {
		playerHands[id] = hands[i]
		slapInCounts[id] = 0
	}

	return &Game{
		PlayerHands:     playerHands,
		Pile:            make([]Card, 0, 52),
		TurnOrder:       playerIDs,
		CurrentTurnIdx:  0,
		Rules:           NewRules(enableDoubles, enableSandwich),
		BurnPenalty:     burnPenalty,
		SlapCooldownMs:  slapCooldownMs,
		TurnTimeoutMs:   turnTimeoutMs,
		EnableSlapIn:    enableSlapIn,
		MaxSlapIns:      maxSlapIns,
		SlapInCounts:    slapInCounts,
		LastSlapTime:    make(map[string]time.Time),
		PendingSlaps:    make([]SlapAttempt, 0),
		TurnTimerCancel: make(chan struct{}),
		Stats: &GameStats{
			SuccessfulSlaps: make(map[string]int),
			CardsBurned:     make(map[string]int),
		},
		StartTime: time.Now(),
	}
}

// PlayCard plays the top card from a player's hand
func (g *Game) PlayCard(playerID string) (*Card, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Check if it's this player's turn
	if g.TurnOrder[g.CurrentTurnIdx] != playerID {
		return nil, errors.New("not your turn")
	}

	// Check if player has cards
	hand := g.PlayerHands[playerID]
	if len(hand) == 0 {
		return nil, errors.New("no cards to play")
	}

	// Cancel any existing turn timer
	select {
	case g.TurnTimerCancel <- struct{}{}:
	default:
	}

	// Play top card
	card := hand[0]
	g.PlayerHands[playerID] = hand[1:]
	g.Pile = append(g.Pile, card)

	// Reset slap window
	g.SlapWindowOpen = true
	g.PendingSlaps = make([]SlapAttempt, 0)

	// Advance turn
	g.advanceTurn()

	return &card, nil
}

// advanceTurn moves to the next player with cards
func (g *Game) advanceTurn() {
	startIdx := g.CurrentTurnIdx
	for {
		g.CurrentTurnIdx = (g.CurrentTurnIdx + 1) % len(g.TurnOrder)
		playerID := g.TurnOrder[g.CurrentTurnIdx]
		if len(g.PlayerHands[playerID]) > 0 {
			return
		}
		// Check if we've looped all the way around
		if g.CurrentTurnIdx == startIdx {
			return
		}
	}
}

// GetCurrentPlayer returns the ID of the current player
func (g *Game) GetCurrentPlayer() string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.TurnOrder[g.CurrentTurnIdx]
}

// ProcessSlap handles a slap attempt
func (g *Game) ProcessSlap(playerID string, serverTimestamp, clientTimestamp int64) protocol.SlapResultPayload {
	g.SlapMu.Lock()
	defer g.SlapMu.Unlock()

	g.Stats.TotalSlaps++

	// Check cooldown
	if lastSlap, ok := g.LastSlapTime[playerID]; ok {
		if time.Since(lastSlap) < time.Duration(g.SlapCooldownMs)*time.Millisecond {
			return protocol.SlapResultPayload{
				PlayerID:    playerID,
				Success:     false,
				Reason:      "cooldown",
				BurnPenalty: 0,
			}
		}
	}
	g.LastSlapTime[playerID] = time.Now()

	// Check if slap is valid
	g.mu.Lock()
	defer g.mu.Unlock()

	playerHasCards := len(g.PlayerHands[playerID]) > 0
	reason := g.Rules.CheckSlap(g.Pile)

	// If player has 0 cards, check if they can slap back in
	if !playerHasCards {
		canSlapIn := g.EnableSlapIn && g.SlapInCounts[playerID] < g.MaxSlapIns
		if !canSlapIn {
			// Can't slap - out of slap-ins or feature disabled
			return protocol.SlapResultPayload{
				PlayerID:    playerID,
				Success:     false,
				Reason:      "eliminated",
				BurnPenalty: 0,
			}
		}
		// Player with 0 cards can only slap on valid slaps (no penalty for invalid)
		if reason == SlapReasonInvalid {
			return protocol.SlapResultPayload{
				PlayerID:    playerID,
				Success:     false,
				Reason:      string(reason),
				BurnPenalty: 0, // No burn penalty for players with 0 cards
			}
		}
	}

	if reason == SlapReasonInvalid {
		// Invalid slap - burn penalty
		burnCount := g.applyBurnPenalty(playerID)
		g.Stats.CardsBurned[playerID] += burnCount
		return protocol.SlapResultPayload{
			PlayerID:    playerID,
			Success:     false,
			Reason:      string(reason),
			BurnPenalty: burnCount,
		}
	}

	// Valid slap - player wins the pile
	cardsWon := len(g.Pile)

	// Track slap-in if player had 0 cards
	if !playerHasCards {
		g.SlapInCounts[playerID]++
	}

	g.PlayerHands[playerID] = append(g.PlayerHands[playerID], g.Pile...)
	g.Pile = make([]Card, 0, 52)
	g.SlapWindowOpen = false
	g.Stats.SuccessfulSlaps[playerID]++

	// Set this player as next to play
	for i, id := range g.TurnOrder {
		if id == playerID {
			g.CurrentTurnIdx = i
			break
		}
	}

	return protocol.SlapResultPayload{
		PlayerID: playerID,
		Success:  true,
		Reason:   string(reason),
		CardsWon: cardsWon,
	}
}

// applyBurnPenalty removes cards from a player and gives them to others
func (g *Game) applyBurnPenalty(playerID string) int {
	hand := g.PlayerHands[playerID]
	if len(hand) == 0 {
		return 0
	}

	burnCount := g.BurnPenalty
	if burnCount > len(hand) {
		burnCount = len(hand)
	}

	// Take cards from player
	burnedCards := hand[:burnCount]
	g.PlayerHands[playerID] = hand[burnCount:]

	// Add to bottom of pile
	g.Pile = append(burnedCards, g.Pile...)

	return burnCount
}

// GetPlayerCardCount returns the number of cards a player has
func (g *Game) GetPlayerCardCount(playerID string) int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return len(g.PlayerHands[playerID])
}

// GetCardCounts returns a map of player ID to card count
func (g *Game) GetCardCounts() map[string]int {
	g.mu.RLock()
	defer g.mu.RUnlock()

	counts := make(map[string]int)
	for id, hand := range g.PlayerHands {
		counts[id] = len(hand)
	}
	return counts
}

// CheckEliminations checks for and returns eliminated players
func (g *Game) CheckEliminations() []string {
	g.mu.Lock()
	defer g.mu.Unlock()

	var eliminated []string
	for _, playerID := range g.TurnOrder {
		if len(g.PlayerHands[playerID]) == 0 {
			// Only eliminate if they can't slap back in (pile is empty or no valid slap)
			if !g.Rules.IsValidSlap(g.Pile) {
				eliminated = append(eliminated, playerID)
			}
		}
	}
	return eliminated
}

// CheckWinner returns the winner's ID if the game is over
func (g *Game) CheckWinner() string {
	g.mu.RLock()
	defer g.mu.RUnlock()

	// Count players with cards
	var playersWithCards []string
	for _, playerID := range g.TurnOrder {
		if len(g.PlayerHands[playerID]) > 0 {
			playersWithCards = append(playersWithCards, playerID)
		}
	}

	// If only one player has cards and pile is empty or no valid slap, they win
	if len(playersWithCards) == 1 {
		if len(g.Pile) == 0 || !g.Rules.IsValidSlap(g.Pile) {
			return playersWithCards[0]
		}
	}

	return ""
}

// GetState returns the current game state
func (g *Game) GetState() protocol.GameStatePayload {
	g.mu.RLock()
	defer g.mu.RUnlock()

	// Get top 3 cards for pile (visible for sandwich checking)
	visiblePile := make([]protocol.Card, 0) // Initialize as empty slice, not nil
	pileLen := len(g.Pile)
	start := pileLen - 3
	if start < 0 {
		start = 0
	}
	for i := start; i < pileLen; i++ {
		visiblePile = append(visiblePile, g.Pile[i].ToProtocol())
	}

	return protocol.GameStatePayload{
		Pile:             visiblePile,
		CurrentPlayerID:  g.TurnOrder[g.CurrentTurnIdx],
		PlayerCardCounts: g.GetCardCounts(),
		CanSlap:          g.Rules.CanSlap(g.Pile),
	}
}

// GetStats returns game statistics
func (g *Game) GetStats() protocol.GameStats {
	g.mu.RLock()
	defer g.mu.RUnlock()

	return protocol.GameStats{
		TotalSlaps:     g.Stats.TotalSlaps,
		SuccessfulSlap: g.Stats.SuccessfulSlaps,
		CardsBurned:    g.Stats.CardsBurned,
		Duration:       time.Since(g.StartTime).Milliseconds(),
	}
}

// StartTurnTimer starts a timer for the current turn
func (g *Game) StartTurnTimer(roomCode string, broadcast func(string, []byte), roomManager interface{}) {
	timeout := time.Duration(g.TurnTimeoutMs) * time.Millisecond
	warningTime := 3 * time.Second

	// Warning timer
	go func() {
		select {
		case <-time.After(timeout - warningTime):
			// Send warning
			msgData, _ := json.Marshal(protocol.NewMessage(protocol.TurnWarning, protocol.TurnWarningPayload{
				SecondsRemaining: 3,
			}))
			broadcast(roomCode, msgData)
		case <-g.TurnTimerCancel:
			return
		}
	}()

	// Timeout timer
	select {
	case <-time.After(timeout):
		// Auto-play card for current player
		g.mu.Lock()
		currentPlayer := g.TurnOrder[g.CurrentTurnIdx]
		hand := g.PlayerHands[currentPlayer]
		if len(hand) > 0 {
			card := hand[0]
			g.PlayerHands[currentPlayer] = hand[1:]
			g.Pile = append(g.Pile, card)
			g.SlapWindowOpen = true
			g.advanceTurn()
			g.mu.Unlock()

			// Broadcast the auto-played card
			msgData, _ := json.Marshal(protocol.NewMessage(protocol.CardPlayed, protocol.CardPlayedPayload{
				PlayerID:  currentPlayer,
				Card:      card.ToProtocol(),
				PileCount: len(g.Pile),
			}))
			broadcast(roomCode, msgData)

			// Broadcast turn change
			turnMsg, _ := json.Marshal(protocol.NewMessage(protocol.TurnChanged, protocol.TurnChangedPayload{
				CurrentPlayerID: g.GetCurrentPlayer(),
			}))
			broadcast(roomCode, turnMsg)

			// Start new turn timer
			go g.StartTurnTimer(roomCode, broadcast, roomManager)
		} else {
			g.mu.Unlock()
		}
	case <-g.TurnTimerCancel:
		return
	}
}
