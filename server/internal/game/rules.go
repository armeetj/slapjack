package game

// SlapReason represents the reason for a valid slap
type SlapReason string

const (
	SlapReasonJack     SlapReason = "jack"
	SlapReasonDoubles  SlapReason = "doubles"
	SlapReasonSandwich SlapReason = "sandwich"
	SlapReasonInvalid  SlapReason = "invalid"
)

// Rules handles slap validation
type Rules struct {
	EnableDoubles  bool
	EnableSandwich bool
}

// NewRules creates a new Rules instance
func NewRules(enableDoubles, enableSandwich bool) *Rules {
	return &Rules{
		EnableDoubles:  enableDoubles,
		EnableSandwich: enableSandwich,
	}
}

// CheckSlap checks if the current pile state allows a valid slap
// Returns the reason if valid, or SlapReasonInvalid if not
func (r *Rules) CheckSlap(pile []Card) SlapReason {
	if len(pile) == 0 {
		return SlapReasonInvalid
	}

	// Check for Jack (top card is Jack)
	if pile[len(pile)-1].IsJack() {
		return SlapReasonJack
	}

	// Check for Doubles (top two cards have same rank)
	if r.EnableDoubles && len(pile) >= 2 {
		if pile[len(pile)-1].Rank == pile[len(pile)-2].Rank {
			return SlapReasonDoubles
		}
	}

	// Check for Sandwich (cards at positions 0 and 2 from top have same rank)
	if r.EnableSandwich && len(pile) >= 3 {
		if pile[len(pile)-1].Rank == pile[len(pile)-3].Rank {
			return SlapReasonSandwich
		}
	}

	return SlapReasonInvalid
}

// IsValidSlap returns true if the current pile state allows a valid slap
func (r *Rules) IsValidSlap(pile []Card) bool {
	return r.CheckSlap(pile) != SlapReasonInvalid
}

// CanSlap returns true if there's any valid slap condition
// This is used to determine if the "can slap" indicator should be shown
func (r *Rules) CanSlap(pile []Card) bool {
	return r.IsValidSlap(pile)
}
