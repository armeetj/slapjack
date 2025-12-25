'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface CreateRoomProps {
  onCreate: (playerName: string) => void;
  isLoading?: boolean;
}

export function CreateRoom({ onCreate, isLoading = false }: CreateRoomProps) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onCreate(name.trim());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="playerName"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Your Name
        </label>
        <input
          id="playerName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          placeholder="Enter your name"
          maxLength={20}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          disabled={isLoading}
        />
      </div>

      <Button
        onAction={handleSubmit}
        disabled={!name.trim() || isLoading}
        variant="primary"
        size="lg"
        className="w-full"
      >
        {isLoading ? 'Creating...' : 'Create Room'}
      </Button>
    </div>
  );
}
