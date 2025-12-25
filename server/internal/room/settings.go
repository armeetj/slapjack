package room

import "slapjack/pkg/protocol"

// Settings holds room configuration
type Settings struct {
	MaxPlayers     int  `json:"maxPlayers"`
	SlapCooldownMs int  `json:"slapCooldownMs"`
	TurnTimeoutMs  int  `json:"turnTimeoutMs"`
	EnableSandwich bool `json:"enableSandwich"`
	EnableDoubles  bool `json:"enableDoubles"`
	BurnPenalty    int  `json:"burnPenalty"`
	EnableSlapIn   bool `json:"enableSlapIn"`
	MaxSlapIns     int  `json:"maxSlapIns"`
}

// DefaultSettings returns the default room settings
func DefaultSettings() Settings {
	return Settings{
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

// ToProtocol converts Settings to protocol.RoomSettings
func (s Settings) ToProtocol() protocol.RoomSettings {
	return protocol.RoomSettings{
		MaxPlayers:     s.MaxPlayers,
		SlapCooldownMs: s.SlapCooldownMs,
		TurnTimeoutMs:  s.TurnTimeoutMs,
		EnableSandwich: s.EnableSandwich,
		EnableDoubles:  s.EnableDoubles,
		BurnPenalty:    s.BurnPenalty,
		EnableSlapIn:   s.EnableSlapIn,
		MaxSlapIns:     s.MaxSlapIns,
	}
}

// FromProtocol updates settings from protocol payload
func (s *Settings) FromProtocol(p protocol.UpdateSettingsPayload) {
	if p.MaxPlayers >= 2 && p.MaxPlayers <= 8 {
		s.MaxPlayers = p.MaxPlayers
	}
	if p.SlapCooldownMs >= 0 && p.SlapCooldownMs <= 1000 {
		s.SlapCooldownMs = p.SlapCooldownMs
	}
	if p.TurnTimeoutMs >= 5000 && p.TurnTimeoutMs <= 60000 {
		s.TurnTimeoutMs = p.TurnTimeoutMs
	}
	s.EnableSandwich = p.EnableSandwich
	s.EnableDoubles = p.EnableDoubles
	if p.BurnPenalty >= 0 && p.BurnPenalty <= 5 {
		s.BurnPenalty = p.BurnPenalty
	}
	s.EnableSlapIn = p.EnableSlapIn
	if p.MaxSlapIns >= 1 && p.MaxSlapIns <= 10 {
		s.MaxSlapIns = p.MaxSlapIns
	}
}

// Validate ensures settings are within acceptable ranges
func (s *Settings) Validate() {
	if s.MaxPlayers < 2 {
		s.MaxPlayers = 2
	}
	if s.MaxPlayers > 8 {
		s.MaxPlayers = 8
	}
	if s.SlapCooldownMs < 0 {
		s.SlapCooldownMs = 0
	}
	if s.SlapCooldownMs > 1000 {
		s.SlapCooldownMs = 1000
	}
	if s.TurnTimeoutMs < 5000 {
		s.TurnTimeoutMs = 5000
	}
	if s.TurnTimeoutMs > 60000 {
		s.TurnTimeoutMs = 60000
	}
	if s.BurnPenalty < 0 {
		s.BurnPenalty = 0
	}
	if s.BurnPenalty > 5 {
		s.BurnPenalty = 5
	}
	if s.MaxSlapIns < 1 {
		s.MaxSlapIns = 1
	}
	if s.MaxSlapIns > 10 {
		s.MaxSlapIns = 10
	}
}
