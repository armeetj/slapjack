package game

import (
	"math/rand"
	"time"

	"slapjack/pkg/protocol"
)

// Card represents a playing card
type Card struct {
	Suit string
	Rank string
}

// ToProtocol converts Card to protocol.Card
func (c Card) ToProtocol() protocol.Card {
	return protocol.Card{
		Suit: c.Suit,
		Rank: c.Rank,
	}
}

// RankValue returns the numeric value of a card rank for comparison
func (c Card) RankValue() int {
	switch c.Rank {
	case "A":
		return 14
	case "K":
		return 13
	case "Q":
		return 12
	case "J":
		return 11
	case "10":
		return 10
	case "9":
		return 9
	case "8":
		return 8
	case "7":
		return 7
	case "6":
		return 6
	case "5":
		return 5
	case "4":
		return 4
	case "3":
		return 3
	case "2":
		return 2
	default:
		return 0
	}
}

// IsJack returns true if the card is a Jack
func (c Card) IsJack() bool {
	return c.Rank == "J"
}

var suits = []string{"hearts", "diamonds", "clubs", "spades"}
var ranks = []string{"A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"}

// Deck represents a deck of cards
type Deck struct {
	cards []Card
}

// NewDeck creates a new standard 52-card deck
func NewDeck() *Deck {
	deck := &Deck{
		cards: make([]Card, 0, 52),
	}

	for _, suit := range suits {
		for _, rank := range ranks {
			deck.cards = append(deck.cards, Card{Suit: suit, Rank: rank})
		}
	}

	return deck
}

// Shuffle randomly shuffles the deck
func (d *Deck) Shuffle() {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(d.cards), func(i, j int) {
		d.cards[i], d.cards[j] = d.cards[j], d.cards[i]
	})
}

// Deal distributes cards evenly to n players
// Returns a map of player index to their cards
func (d *Deck) Deal(numPlayers int) [][]Card {
	hands := make([][]Card, numPlayers)
	for i := range hands {
		hands[i] = make([]Card, 0, 52/numPlayers+1)
	}

	for i, card := range d.cards {
		playerIdx := i % numPlayers
		hands[playerIdx] = append(hands[playerIdx], card)
	}

	return hands
}

// Cards returns all cards in the deck
func (d *Deck) Cards() []Card {
	return d.cards
}

// Len returns the number of cards in the deck
func (d *Deck) Len() int {
	return len(d.cards)
}
