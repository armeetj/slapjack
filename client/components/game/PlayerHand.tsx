'use client';

import { motion } from 'framer-motion';
import { Card } from './Card';
import { clsx } from 'clsx';

interface PlayerHandProps {
  cardCount: number;
  onPlay: () => void;
  isMyTurn: boolean;
  disabled?: boolean;
}

export function PlayerHand({
  cardCount,
  onPlay,
  isMyTurn,
  disabled = false,
}: PlayerHandProps) {
  const canPlay = isMyTurn && cardCount > 0 && !disabled;

  return (
    <motion.div
      className={clsx(
        'relative flex flex-col items-center gap-3 p-4 rounded-xl transition-all',
        isMyTurn && 'ring-2 ring-yellow-400 bg-yellow-500/10'
      )}
    >
      {/* Card stack visualization */}
      <div
        className={clsx(
          'relative w-24 h-[134px] cursor-pointer transition-transform',
          canPlay && 'hover:scale-105 hover:-translate-y-2'
        )}
        onClick={canPlay ? onPlay : undefined}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && canPlay) {
            onPlay();
          }
        }}
        tabIndex={canPlay ? 0 : -1}
        role="button"
        aria-label={`Play card (${cardCount} cards remaining)`}
      >
        {/* Stack effect - show multiple card backs */}
        {cardCount > 2 && (
          <div
            className="absolute inset-0"
            style={{ transform: 'translate(4px, 4px)' }}
          >
            <Card card={null} faceDown animate={false} />
          </div>
        )}
        {cardCount > 1 && (
          <div
            className="absolute inset-0"
            style={{ transform: 'translate(2px, 2px)' }}
          >
            <Card card={null} faceDown animate={false} />
          </div>
        )}
        {cardCount > 0 && (
          <div className="absolute inset-0">
            <Card card={null} faceDown animate={false} />
          </div>
        )}

        {/* Empty indicator */}
        {cardCount === 0 && (
          <div className="w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center">
            <span className="text-white/50 text-sm">No cards</span>
          </div>
        )}

        {/* Play indicator */}
        {canPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="bg-black/50 rounded-lg px-3 py-2">
              <span className="text-white font-bold text-sm">PLAY</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Card count */}
      <div className="flex items-center gap-2 text-white">
        <span className="text-2xl font-bold">{cardCount}</span>
        <span className="text-sm text-gray-300">cards</span>
      </div>

      {/* Turn indicator */}
      {isMyTurn && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold"
        >
          Your Turn!
        </motion.div>
      )}
    </motion.div>
  );
}
