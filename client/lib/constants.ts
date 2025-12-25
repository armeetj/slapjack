// WebSocket URL
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

// Card dimensions
export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 190;
export const CARD_RATIO = CARD_WIDTH / CARD_HEIGHT;

// Animation durations (ms)
export const CARD_DEAL_DELAY = 80;
export const CARD_FLIP_DURATION = 400;
export const SLAP_RESULT_DURATION = 1500;
export const COUNTDOWN_INTERVAL = 1000;

// Game settings limits
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MIN_TURN_TIMEOUT = 5000;
export const MAX_TURN_TIMEOUT = 60000;
export const MIN_SLAP_COOLDOWN = 0;
export const MAX_SLAP_COOLDOWN = 1000;
export const MIN_BURN_PENALTY = 0;
export const MAX_BURN_PENALTY = 5;

// Default settings
export const DEFAULT_SETTINGS = {
  maxPlayers: 4,
  slapCooldownMs: 200,
  turnTimeoutMs: 10000,
  enableSandwich: true,
  enableDoubles: true,
  burnPenalty: 1,
};

// Room code format
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
