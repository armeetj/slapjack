'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface JoinRoomProps {
  onJoin: (roomCode: string, playerName: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function JoinRoom({ onJoin, isLoading = false, error }: JoinRoomProps) {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (roomCode.trim() && name.trim()) {
      onJoin(roomCode.trim().toUpperCase(), name.trim());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="roomCode"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Room Code
        </label>
        <input
          id="roomCode"
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="ABCD"
          maxLength={4}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent uppercase text-center text-2xl tracking-widest font-mono"
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="joinPlayerName"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Your Name
        </label>
        <input
          id="joinPlayerName"
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

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <Button
        onAction={handleSubmit}
        disabled={!roomCode.trim() || !name.trim() || isLoading}
        variant="secondary"
        size="lg"
        className="w-full"
      >
        {isLoading ? 'Joining...' : 'Join Room'}
      </Button>
    </div>
  );
}
