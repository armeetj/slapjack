'use client';

import { forwardRef, useCallback } from 'react';
import { clsx } from 'clsx';

interface ButtonProps {
  onAction: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onHover?: () => void;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      onAction,
      disabled = false,
      variant = 'primary',
      size = 'md',
      children,
      className,
      onHover,
    },
    ref
  ) => {
    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();
        if (!disabled) {
          onAction();
        }
      },
      [disabled, onAction]
    );

    const handleMouseEnter = useCallback(() => {
      if (!disabled && onHover) {
        onHover();
      }
    }, [disabled, onHover]);

    const baseStyles =
      'game-button inline-flex items-center justify-center font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-felt-dark select-none';

    const variantStyles = {
      primary:
        'bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-900 hover:from-yellow-300 hover:to-yellow-500 focus:ring-yellow-500 shadow-lg',
      secondary:
        'bg-gradient-to-b from-gray-500 to-gray-700 text-white hover:from-gray-400 hover:to-gray-600 focus:ring-gray-500 shadow-lg',
      danger:
        'bg-gradient-to-b from-red-500 to-red-700 text-white hover:from-red-400 hover:to-red-600 focus:ring-red-500 shadow-lg',
      ghost:
        'bg-white/10 text-white hover:bg-white/20 focus:ring-white/50',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-base',
      lg: 'px-8 py-4 text-lg',
    };

    const disabledStyles = 'opacity-50 cursor-not-allowed';

    return (
      <button
        ref={ref}
        onPointerDown={handlePointerDown}
        onMouseEnter={handleMouseEnter}
        disabled={disabled}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          disabled && disabledStyles,
          className
        )}
        style={{ touchAction: 'manipulation' }}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
