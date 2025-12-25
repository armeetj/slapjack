'use client';

import { useCallback, useReducer } from 'react';
import {
  Card,
  GameState,
  Player,
  RoomSettings,
  RoomState,
  GameStats,
  WSMessage,
  ServerMessageTypes,
  CardPlayedPayload,
  TurnChangedPayload,
  SlapAttemptedPayload,
  SlapResultPayload,
  GameStartingPayload,
  GameStartedPayload,
  CardsDealtPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  NameChangedPayload,
  GameOverPayload,
  PlayerEliminatedPayload,
  RoomJoinedPayload,
  RoomCreatedPayload,
  TurnWarningPayload,
} from '@/types/game';

// State
interface State {
  room: RoomState | null;
  game: GameState | null;
  playerId: string | null;
  countdown: number | null;
  lastSlapAttempt: SlapAttemptedPayload | null;
  lastSlapResult: SlapResultPayload | null;
  gameOver: GameOverPayload | null;
  turnWarning: number | null;
  eliminatedPlayers: string[];
}

const initialState: State = {
  room: null,
  game: null,
  playerId: null,
  countdown: null,
  lastSlapAttempt: null,
  lastSlapResult: null,
  gameOver: null,
  turnWarning: null,
  eliminatedPlayers: [],
};

// Actions
type Action =
  | { type: 'SET_ROOM'; payload: RoomState }
  | { type: 'SET_PLAYER_ID'; payload: string }
  | { type: 'PLAYER_JOINED'; payload: Player }
  | { type: 'PLAYER_LEFT'; payload: string }
  | { type: 'NAME_CHANGED'; payload: NameChangedPayload }
  | { type: 'SETTINGS_CHANGED'; payload: RoomSettings }
  | { type: 'GAME_STARTING'; payload: number }
  | { type: 'GAME_STARTED'; payload: GameState }
  | { type: 'CARDS_DEALT'; payload: Record<string, number> }
  | { type: 'CARD_PLAYED'; payload: CardPlayedPayload }
  | { type: 'TURN_CHANGED'; payload: string }
  | { type: 'TURN_WARNING'; payload: number }
  | { type: 'SLAP_ATTEMPTED'; payload: SlapAttemptedPayload }
  | { type: 'SLAP_RESULT'; payload: SlapResultPayload }
  | { type: 'PLAYER_ELIMINATED'; payload: string }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'GAME_ENDED'; payload: null }
  | { type: 'CLEAR_SLAP'; payload: null }
  | { type: 'RESET'; payload: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ROOM':
      return { ...state, room: action.payload };

    case 'SET_PLAYER_ID':
      return { ...state, playerId: action.payload };

    case 'PLAYER_JOINED':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: [...state.room.players, action.payload],
        },
      };

    case 'PLAYER_LEFT':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.filter((p) => p.id !== action.payload),
        },
      };

    case 'NAME_CHANGED':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === action.payload.playerId
              ? { ...p, name: action.payload.newName }
              : p
          ),
        },
      };

    case 'SETTINGS_CHANGED':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          settings: action.payload,
        },
      };

    case 'GAME_STARTING':
      if (!state.room) return state;
      return {
        ...state,
        countdown: action.payload,
        room: { ...state.room, status: 'starting' },
      };

    case 'GAME_STARTED':
      if (!state.room) return state;
      return {
        ...state,
        game: action.payload,
        countdown: null,
        room: { ...state.room, status: 'playing' },
        eliminatedPlayers: [],
        gameOver: null,
      };

    case 'CARDS_DEALT':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.map((p) => ({
            ...p,
            cardCount: action.payload[p.id] || 0,
          })),
        },
      };

    case 'CARD_PLAYED':
      if (!state.game || !state.room) return state;
      return {
        ...state,
        game: {
          ...state.game,
          pile: [...(state.game.pile || []), action.payload.card].slice(-3),
          playerCardCounts: {
            ...state.game.playerCardCounts,
            [action.payload.playerId]:
              (state.game.playerCardCounts[action.payload.playerId] || 0) - 1,
          },
        },
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === action.payload.playerId
              ? { ...p, cardCount: p.cardCount - 1 }
              : p
          ),
        },
        turnWarning: null,
      };

    case 'TURN_CHANGED':
      if (!state.game) return state;
      return {
        ...state,
        game: {
          ...state.game,
          currentPlayerId: action.payload,
        },
        turnWarning: null,
      };

    case 'TURN_WARNING':
      return { ...state, turnWarning: action.payload };

    case 'SLAP_ATTEMPTED':
      return { ...state, lastSlapAttempt: action.payload };

    case 'SLAP_RESULT':
      if (!state.game || !state.room) return state;
      const newGame = { ...state.game, pile: state.game.pile || [] };
      const newRoom = { ...state.room };

      if (action.payload.success && action.payload.cardsWon) {
        // Player won the pile
        newGame.pile = [];
        newGame.playerCardCounts = {
          ...newGame.playerCardCounts,
          [action.payload.playerId]:
            (newGame.playerCardCounts[action.payload.playerId] || 0) +
            action.payload.cardsWon,
        };
        newRoom.players = newRoom.players.map((p) =>
          p.id === action.payload.playerId
            ? { ...p, cardCount: p.cardCount + (action.payload.cardsWon || 0) }
            : p
        );
      } else if (action.payload.burnPenalty) {
        // Player lost cards
        newGame.playerCardCounts = {
          ...newGame.playerCardCounts,
          [action.payload.playerId]:
            (newGame.playerCardCounts[action.payload.playerId] || 0) -
            action.payload.burnPenalty,
        };
        newRoom.players = newRoom.players.map((p) =>
          p.id === action.payload.playerId
            ? { ...p, cardCount: Math.max(0, p.cardCount - (action.payload.burnPenalty || 0)) }
            : p
        );
      }

      return {
        ...state,
        game: newGame,
        room: newRoom,
        lastSlapResult: action.payload,
        lastSlapAttempt: null,
      };

    case 'PLAYER_ELIMINATED':
      return {
        ...state,
        eliminatedPlayers: [...state.eliminatedPlayers, action.payload],
      };

    case 'GAME_OVER':
      if (!state.room) return state;
      return {
        ...state,
        gameOver: action.payload,
        room: { ...state.room, status: 'finished' },
      };

    case 'GAME_ENDED':
      if (!state.room) return state;
      return {
        ...state,
        game: null,
        gameOver: null,
        countdown: null,
        room: { ...state.room, status: 'waiting' },
        eliminatedPlayers: [],
      };

    case 'CLEAR_SLAP':
      return { ...state, lastSlapAttempt: null, lastSlapResult: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case ServerMessageTypes.ROOM_CREATED: {
        const payload = message.payload as RoomCreatedPayload;
        dispatch({ type: 'SET_ROOM', payload: payload.room });
        break;
      }

      case ServerMessageTypes.ROOM_JOINED:
      case ServerMessageTypes.RECONNECTED:
      case ServerMessageTypes.ROOM_UPDATED: {
        const payload = message.payload as RoomJoinedPayload;
        dispatch({ type: 'SET_ROOM', payload: payload.room });
        break;
      }

      case ServerMessageTypes.PLAYER_JOINED: {
        const payload = message.payload as PlayerJoinedPayload;
        dispatch({ type: 'PLAYER_JOINED', payload: payload.player });
        break;
      }

      case ServerMessageTypes.PLAYER_LEFT: {
        const payload = message.payload as PlayerLeftPayload;
        dispatch({ type: 'PLAYER_LEFT', payload: payload.playerId });
        break;
      }

      case ServerMessageTypes.NAME_CHANGED: {
        const payload = message.payload as NameChangedPayload;
        dispatch({ type: 'NAME_CHANGED', payload });
        break;
      }

      case ServerMessageTypes.SETTINGS_CHANGED: {
        const payload = message.payload as RoomSettings;
        dispatch({ type: 'SETTINGS_CHANGED', payload });
        break;
      }

      case ServerMessageTypes.GAME_STARTING: {
        const payload = message.payload as GameStartingPayload;
        dispatch({ type: 'GAME_STARTING', payload: payload.countdown });
        break;
      }

      case ServerMessageTypes.GAME_STARTED: {
        const payload = message.payload as GameStartedPayload;
        dispatch({ type: 'GAME_STARTED', payload: payload.gameState });
        break;
      }

      case ServerMessageTypes.CARDS_DEALT: {
        const payload = message.payload as CardsDealtPayload;
        dispatch({ type: 'CARDS_DEALT', payload: payload.playerCards });
        break;
      }

      case ServerMessageTypes.CARD_PLAYED: {
        const payload = message.payload as CardPlayedPayload;
        dispatch({ type: 'CARD_PLAYED', payload });
        break;
      }

      case ServerMessageTypes.TURN_CHANGED: {
        const payload = message.payload as TurnChangedPayload;
        dispatch({ type: 'TURN_CHANGED', payload: payload.currentPlayerId });
        break;
      }

      case ServerMessageTypes.TURN_WARNING: {
        const payload = message.payload as TurnWarningPayload;
        dispatch({ type: 'TURN_WARNING', payload: payload.secondsRemaining });
        break;
      }

      case ServerMessageTypes.SLAP_ATTEMPTED: {
        const payload = message.payload as SlapAttemptedPayload;
        dispatch({ type: 'SLAP_ATTEMPTED', payload });
        break;
      }

      case ServerMessageTypes.SLAP_RESULT: {
        const payload = message.payload as SlapResultPayload;
        dispatch({ type: 'SLAP_RESULT', payload });
        // Clear after animation
        setTimeout(() => {
          dispatch({ type: 'CLEAR_SLAP', payload: null });
        }, 1500);
        break;
      }

      case ServerMessageTypes.PLAYER_ELIMINATED: {
        const payload = message.payload as PlayerEliminatedPayload;
        dispatch({ type: 'PLAYER_ELIMINATED', payload: payload.playerId });
        break;
      }

      case ServerMessageTypes.GAME_OVER: {
        const payload = message.payload as GameOverPayload;
        dispatch({ type: 'GAME_OVER', payload });
        break;
      }

      case ServerMessageTypes.PLAYER_KICKED: {
        const payload = message.payload as { playerId: string };
        dispatch({ type: 'PLAYER_LEFT', payload: payload.playerId });
        break;
      }

      case ServerMessageTypes.GAME_ENDED: {
        // Reset game state back to waiting
        dispatch({ type: 'GAME_ENDED', payload: null });
        break;
      }
    }
  }, []);

  const setPlayerId = useCallback((id: string) => {
    dispatch({ type: 'SET_PLAYER_ID', payload: id });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', payload: null });
  }, []);

  return {
    ...state,
    handleMessage,
    setPlayerId,
    reset,
    isMyTurn: state.game?.currentPlayerId === state.playerId,
    myCardCount: state.playerId
      ? state.game?.playerCardCounts[state.playerId] || 0
      : 0,
    isHost: state.room?.hostId === state.playerId,
  };
}
