'use client';

import { motion } from 'framer-motion';
import { Player } from '@/types/game';
import { clsx } from 'clsx';

interface PlayerSlotProps {
  player: Player;
  isCurrentTurn: boolean;
  isCurrentPlayer: boolean;
  showSlap?: boolean;
}

export function PlayerSlot({
  player,
  isCurrentTurn,
  isCurrentPlayer,
  showSlap = false,
}: PlayerSlotProps) {
  return (
    <motion.div
      layout
      className={clsx(
        'relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all',
        isCurrentTurn && 'turn-active bg-yellow-500/20',
        !player.isConnected && 'opacity-50',
        isCurrentPlayer && 'ring-2 ring-yellow-400'
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold',
          player.isConnected
            ? 'bg-gradient-to-br from-blue-400 to-blue-600'
            : 'bg-gray-600'
        )}
      >
        {player.name.charAt(0).toUpperCase()}
      </div>

      {/* Name & Card Count */}
      <div className="text-center">
        <div className="text-sm font-semibold text-white truncate max-w-[80px]">
          {player.name}
          {player.isHost && (
            <span className="ml-1 text-yellow-400" title="Host">
              ★
            </span>
          )}
        </div>
        <div className="text-xs text-gray-300 flex items-center justify-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <rect x="4" y="2" width="12" height="16" rx="2" />
          </svg>
          {player.cardCount}
        </div>
      </div>

      {/* Connection status */}
      <div
        className={clsx(
          'status-dot absolute top-1 right-1',
          player.isConnected ? 'connected' : 'disconnected'
        )}
      />

      {/* Slap indicator */}
      {showSlap && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold"
        >
          SLAP!
        </motion.div>
      )}

      {/* Turn indicator */}
      {isCurrentTurn && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-yellow-400 text-xs"
        >
          ▲
        </motion.div>
      )}
    </motion.div>
  );
}
