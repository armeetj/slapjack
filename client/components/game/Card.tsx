'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Card as CardType, getCardImagePath, getCardBackPath } from '@/types/game';

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  rotation?: number;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  animateFrom?: { x: number; y: number; rotation: number };
  delay?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function Card({
  card,
  faceDown = false,
  rotation = 0,
  className = '',
  onClick,
  animate = true,
  animateFrom,
  delay = 0,
  size = 'md',
}: CardProps) {
  const sizeClasses = {
    sm: 'w-16 h-[89px]',
    md: 'w-24 h-[134px]',
    lg: 'w-32 h-[179px]',
  };

  const imagePath = faceDown || !card ? getCardBackPath() : getCardImagePath(card);

  const cardContent = (
    <div
      className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden shadow-card ${className}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        transformStyle: 'preserve-3d',
      }}
      onClick={onClick}
    >
      <Image
        src={imagePath}
        alt={card && !faceDown ? `${card.rank} of ${card.suit}` : 'Card back'}
        fill
        className="object-contain"
        priority
      />
    </div>
  );

  if (!animate) {
    return cardContent;
  }

  return (
    <motion.div
      initial={
        animateFrom
          ? {
              x: animateFrom.x,
              y: animateFrom.y,
              rotate: animateFrom.rotation,
              opacity: 0,
            }
          : { opacity: 0, scale: 0.8 }
      }
      animate={{
        x: 0,
        y: 0,
        rotate: rotation,
        opacity: 1,
        scale: 1,
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
        delay,
      }}
    >
      {cardContent}
    </motion.div>
  );
}
