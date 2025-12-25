'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { SlapResultPayload } from '@/types/game';

interface SlapEffectProps {
  result: SlapResultPayload | null;
  playerName?: string;
}

export function SlapEffect({ result, playerName }: SlapEffectProps) {
  if (!result) return null;

  const isSuccess = result.success;
  const text = isSuccess
    ? `+${result.cardsWon} cards!`
    : `BURN -${result.burnPenalty || 0}`;

  const reasonText = {
    jack: 'JACK!',
    doubles: 'DOUBLES!',
    sandwich: 'SANDWICH!',
    invalid: 'MISS!',
    cooldown: 'TOO FAST!',
  }[result.reason];

  return (
    <AnimatePresence>
      <motion.div
        key={result.playerId + result.reason}
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: -50 }}
        transition={{ type: 'spring', damping: 15 }}
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      >
        <div className="flex flex-col items-center gap-2">
          {/* Reason */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.3 }}
            className={`text-4xl font-black ${
              isSuccess ? 'text-green-400' : 'text-red-400'
            }`}
            style={{
              textShadow: isSuccess
                ? '0 0 20px rgba(74, 222, 128, 0.5)'
                : '0 0 20px rgba(248, 113, 113, 0.5)',
            }}
          >
            {reasonText}
          </motion.div>

          {/* Player name */}
          {playerName && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white text-lg font-semibold"
            >
              {playerName}
            </motion.div>
          )}

          {/* Result */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`floating-text text-2xl font-bold ${
              isSuccess ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {text}
          </motion.div>

          {/* Impact effect */}
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`absolute w-20 h-20 rounded-full ${
              isSuccess ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface SlapAttemptIndicatorProps {
  playerName: string;
  show: boolean;
}

export function SlapAttemptIndicator({
  playerName,
  show,
}: SlapAttemptIndicatorProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-semibold z-40"
        >
          {playerName} slapped!
        </motion.div>
      )}
    </AnimatePresence>
  );
}
