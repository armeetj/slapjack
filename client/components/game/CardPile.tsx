'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { Card as CardType } from '@/types/game';

interface CardPileProps {
  pile: CardType[];
  onSlap?: () => void;
  canSlap?: boolean;
  lastPlayedBy?: string;
}

// Create a unique key for a card based on its properties
function getCardKey(card: CardType): string {
  return `${card.rank}-${card.suit}`;
}

export function CardPile({ pile, onSlap, canSlap = false }: CardPileProps) {
  // Track cards with unique keys for proper animation
  const [displayCards, setDisplayCards] = useState<Array<{ card: CardType; key: string; id: number }>>([]);
  const cardIdRef = useRef(0);
  const lastPileKeyRef = useRef('');

  useEffect(() => {
    // Create a key representing current pile state
    const currentPileKey = pile.map(getCardKey).join('|');

    // Only update if pile actually changed
    if (currentPileKey === lastPileKeyRef.current) {
      return;
    }
    lastPileKeyRef.current = currentPileKey;

    if (pile.length === 0) {
      // Pile cleared (slap won)
      setDisplayCards([]);
      return;
    }

    // Check if a new card was added to the end
    const lastDisplayCard = displayCards[displayCards.length - 1];
    const lastPileCard = pile[pile.length - 1];

    if (lastPileCard && (!lastDisplayCard || getCardKey(lastDisplayCard.card) !== getCardKey(lastPileCard))) {
      // New card on top - rebuild display from pile
      const newDisplay = pile.map((card, idx) => {
        // Try to find existing display card to preserve its key
        const existing = displayCards.find(d => getCardKey(d.card) === getCardKey(card));
        if (existing) {
          return existing;
        }
        // New card - assign new id
        return {
          card,
          key: `card-${cardIdRef.current++}`,
          id: cardIdRef.current,
        };
      });
      setDisplayCards(newDisplay);
    }
  }, [pile, displayCards]);

  // Position for each card in the stack
  const getCardPosition = (index: number, total: number) => {
    const staggerX = index * 30;
    const staggerY = index * 18;
    const rotation = (index - Math.floor(total / 2)) * 6;
    return { x: staggerX, y: staggerY, rotation };
  };

  return (
    <div
      className="relative w-56 h-64 cursor-pointer"
      onClick={onSlap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          onSlap?.();
        }
      }}
    >
      {/* Base shadow for pile */}
      <div className="absolute inset-0 bg-black/20 rounded-lg blur-lg" />

      {/* Pile cards with AnimatePresence for enter/exit */}
      <AnimatePresence mode="popLayout">
        {displayCards.map((item, index) => {
          const pos = getCardPosition(index, displayCards.length);
          const isNewest = index === displayCards.length - 1;

          return (
            <motion.div
              key={item.key}
              layout
              initial={isNewest ? {
                y: -200,
                x: pos.x,
                opacity: 0,
                scale: 0.6,
                rotate: -20,
              } : false}
              animate={{
                x: pos.x,
                y: pos.y,
                opacity: 1,
                scale: 1,
                rotate: pos.rotation,
              }}
              exit={{
                x: -100,
                opacity: 0,
                scale: 0.8,
                transition: { duration: 0.2 },
              }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 400,
                mass: 0.8,
              }}
              className="absolute top-0 left-0"
              style={{ zIndex: index }}
            >
              <Card card={item.card} animate={false} size="lg" />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty pile indicator */}
      {pile.length === 0 && displayCards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-28 h-40 border-2 border-dashed border-white/20 rounded-lg" />
        </div>
      )}

      {/* Slap indicator */}
      {canSlap && pile.length > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-900 px-2 py-1 rounded text-xs font-bold"
        >
          SLAP!
        </motion.div>
      )}
    </div>
  );
}
