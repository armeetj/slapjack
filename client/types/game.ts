// WebSocket message structure
export interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

// Card types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Player
export interface Player {
  id: string;
  name: string;
  cardCount: number;
  isHost: boolean;
  isConnected: boolean;
  position: number;
}

// Room settings
export interface RoomSettings {
  maxPlayers: number;
  slapCooldownMs: number;
  turnTimeoutMs: number;
  enableSandwich: boolean;
  enableDoubles: boolean;
  burnPenalty: number;
  enableSlapIn: boolean;
  maxSlapIns: number;
}

// Room state
export interface RoomState {
  code: string;
  players: Player[];
  settings: RoomSettings;
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  hostId: string;
}

// Game state
export interface GameState {
  pile: Card[];
  currentPlayerId: string;
  playerCardCounts: Record<string, number>;
  canSlap: boolean;
}

// Game statistics
export interface GameStats {
  totalSlaps: number;
  successfulSlaps: Record<string, number>;
  cardsBurned: Record<string, number>;
  duration: number;
}

// Game action
export interface GameAction {
  type: 'card_played' | 'slap_success' | 'slap_fail';
  playerId: string;
  card?: Card;
  timestamp: number;
}

// Message Types - Client to Server
export const MessageTypes = {
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  LEAVE_ROOM: 'LEAVE_ROOM',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  CHANGE_NAME: 'CHANGE_NAME',
  START_GAME: 'START_GAME',
  PLAY_CARD: 'PLAY_CARD',
  SLAP: 'SLAP',
  REACT: 'REACT',
  KICK_PLAYER: 'KICK_PLAYER',
  END_GAME: 'END_GAME',
} as const;

// Message Types - Server to Client
export const ServerMessageTypes = {
  CONNECTED: 'CONNECTED',
  RECONNECTED: 'RECONNECTED',
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_JOINED: 'ROOM_JOINED',
  ROOM_UPDATED: 'ROOM_UPDATED',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  PLAYER_KICKED: 'PLAYER_KICKED',
  PLAYER_RECONNECTED: 'PLAYER_RECONNECTED',
  NAME_CHANGED: 'NAME_CHANGED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  GAME_STARTING: 'GAME_STARTING',
  GAME_STARTED: 'GAME_STARTED',
  CARDS_DEALT: 'CARDS_DEALT',
  CARD_PLAYED: 'CARD_PLAYED',
  TURN_CHANGED: 'TURN_CHANGED',
  TURN_WARNING: 'TURN_WARNING',
  SLAP_ATTEMPTED: 'SLAP_ATTEMPTED',
  SLAP_RESULT: 'SLAP_RESULT',
  PLAYER_ELIMINATED: 'PLAYER_ELIMINATED',
  GAME_OVER: 'GAME_OVER',
  GAME_ENDED: 'GAME_ENDED',
  ERROR: 'ERROR',
} as const;

// Payload types
export interface ConnectedPayload {
  sessionId: string;
}

export interface RoomCreatedPayload {
  roomCode: string;
  room: RoomState;
}

export interface RoomJoinedPayload {
  room: RoomState;
}

export interface NameChangedPayload {
  playerId: string;
  newName: string;
}

export interface PlayerJoinedPayload {
  player: Player;
}

export interface PlayerLeftPayload {
  playerId: string;
}

export interface GameStartingPayload {
  countdown: number;
}

export interface GameStartedPayload {
  gameState: GameState;
}

export interface CardsDealtPayload {
  playerCards: Record<string, number>;
}

export interface CardPlayedPayload {
  playerId: string;
  card: Card;
  pileCount: number;
}

export interface TurnChangedPayload {
  currentPlayerId: string;
}

export interface TurnWarningPayload {
  secondsRemaining: number;
}

export interface SlapAttemptedPayload {
  playerId: string;
  playerName: string;
}

export interface SlapResultPayload {
  playerId: string;
  success: boolean;
  reason: 'jack' | 'doubles' | 'sandwich' | 'invalid' | 'cooldown';
  cardsWon?: number;
  burnPenalty?: number;
}

export interface PlayerEliminatedPayload {
  playerId: string;
}

export interface GameOverPayload {
  winnerId: string;
  winnerName: string;
  stats: GameStats;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface PlayerKickedPayload {
  playerId: string;
  playerName: string;
}

export interface GameEndedPayload {
  reason: string;
}

// Helper function to get card image path
export function getCardImagePath(card: Card): string {
  const rankName = card.rank === 'A' ? 'ace' :
                   card.rank === 'K' ? 'king' :
                   card.rank === 'Q' ? 'queen' :
                   card.rank === 'J' ? 'jack' :
                   card.rank.toLowerCase();
  return `/cards/${rankName}_of_${card.suit}.png`;
}

export function getCardBackPath(): string {
  return '/cards/card_back.png';
}

// Check if a card is red
export function isRedCard(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}
