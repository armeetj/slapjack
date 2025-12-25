'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CardPile } from './CardPile';
import { PlayerHand } from './PlayerHand';
import { PlayerSlot } from './PlayerSlot';
import { SlapEffect, SlapAttemptIndicator } from './SlapEffect';
import {
  Player,
  GameState,
  SlapAttemptedPayload,
  SlapResultPayload,
} from '@/types/game';
import { clsx } from 'clsx';

interface GameBoardProps {
  players: Player[];
  currentPlayerId: string;
  myPlayerId: string;
  gameState: GameState;
  onPlayCard: () => void;
  onSlap: () => void;
  onLeave: () => void;
  onEndGame?: () => void;
  isHost: boolean;
  lastSlapAttempt: SlapAttemptedPayload | null;
  lastSlapResult: SlapResultPayload | null;
  turnWarning: number | null;
}

export function GameBoard({
  players,
  currentPlayerId,
  myPlayerId,
  gameState,
  onPlayCard,
  onSlap,
  onLeave,
  onEndGame,
  isHost,
  lastSlapAttempt,
  lastSlapResult,
  turnWarning,
}: GameBoardProps) {
  const [screenShake, setScreenShake] = useState(false);
  const [redFlash, setRedFlash] = useState(false);

  // Find current player (me)
  const me = players.find((p) => p.id === myPlayerId);
  const otherPlayers = players.filter((p) => p.id !== myPlayerId);
  const isMyTurn = currentPlayerId === myPlayerId;

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // Space or S = Slap
      if (e.code === 'Space' || e.code === 'KeyS') {
        e.preventDefault();
        onSlap();
      }

      // Enter, P, or D = Play card (if it's your turn)
      if ((e.code === 'Enter' || e.code === 'KeyP' || e.code === 'KeyD') && isMyTurn) {
        e.preventDefault();
        onPlayCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSlap, onPlayCard, isMyTurn]);

  // Visual effects on slap result
  useEffect(() => {
    if (lastSlapResult) {
      if (lastSlapResult.success) {
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 300);
      } else {
        setRedFlash(true);
        setTimeout(() => setRedFlash(false), 300);
      }
    }
  }, [lastSlapResult]);

  // Get player who attempted slap
  const slapAttemptPlayer = lastSlapAttempt
    ? players.find((p) => p.id === lastSlapAttempt.playerId)
    : null;

  const getPlayerName = useCallback(
    (playerId: string) => {
      return players.find((p) => p.id === playerId)?.name || 'Unknown';
    },
    [players]
  );

  // Position other players around the board
  const getPlayerPosition = (index: number, total: number) => {
    // Distribute players across top of the board
    const positions = [
      'top-4 left-1/4 -translate-x-1/2',
      'top-4 left-1/2 -translate-x-1/2',
      'top-4 left-3/4 -translate-x-1/2',
      'top-1/3 left-4',
      'top-1/3 right-4',
      'top-1/2 left-4 -translate-y-1/2',
      'top-1/2 right-4 -translate-y-1/2',
    ];
    return positions[index % positions.length];
  };

  return (
    <div
      className={clsx(
        'relative w-full h-screen overflow-hidden',
        screenShake && 'screen-shake',
        redFlash && 'red-flash'
      )}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-felt-dark to-felt" />

      {/* Game controls */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={onLeave}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Leave
        </button>
        {isHost && onEndGame && (
          <button
            onClick={onEndGame}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
          >
            End Game
          </button>
        )}
      </div>

      {/* Turn warning */}
      {turnWarning !== null && turnWarning <= 3 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
        >
          <div className="text-6xl font-black text-yellow-400 countdown-number">
            {turnWarning}
          </div>
        </motion.div>
      )}

      {/* Other players */}
      {otherPlayers.map((player, index) => (
        <div
          key={player.id}
          className={`absolute ${getPlayerPosition(index, otherPlayers.length)}`}
        >
          <PlayerSlot
            player={player}
            isCurrentTurn={currentPlayerId === player.id}
            isCurrentPlayer={false}
            showSlap={lastSlapAttempt?.playerId === player.id}
          />
        </div>
      ))}

      {/* Center area - Card pile */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <CardPile
          pile={gameState.pile || []}
          onSlap={onSlap}
          canSlap={gameState.canSlap}
        />

        {/* Pile count */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-sm">
          {(gameState.pile?.length || 0) > 0
            ? `${gameState.pile.length} cards in pile`
            : 'Empty pile'}
        </div>
      </div>

      {/* Current player (me) at bottom */}
      {me && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <PlayerHand
            cardCount={me.cardCount}
            onPlay={onPlayCard}
            isMyTurn={isMyTurn}
          />
        </div>
      )}

      {/* Slap button (mobile) */}
      <button
        onPointerDown={onSlap}
        className="absolute bottom-8 right-8 w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 shadow-lg flex items-center justify-center text-white font-bold text-lg transition-all md:hidden"
      >
        SLAP!
      </button>

      {/* Controls hint (desktop) */}
      <div className="absolute bottom-4 left-4 text-white/40 text-sm hidden md:block">
        <span className="text-white/60">SPACE/S</span> Slap • <span className="text-white/60">ENTER/P/D</span> Play card
      </div>

      {/* Slap attempt indicator */}
      <SlapAttemptIndicator
        playerName={slapAttemptPlayer?.name || ''}
        show={!!lastSlapAttempt && !lastSlapResult}
      />

      {/* Slap result effect */}
      <SlapEffect
        result={lastSlapResult}
        playerName={
          lastSlapResult ? getPlayerName(lastSlapResult.playerId) : undefined
        }
      />
    </div>
  );
}
