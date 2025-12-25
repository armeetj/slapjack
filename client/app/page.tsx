'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CreateRoom } from '@/components/lobby/CreateRoom';
import { JoinRoom } from '@/components/lobby/JoinRoom';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGameState } from '@/hooks/useGameState';
import { useSound } from '@/hooks/useSound';
import {
  WSMessage,
  ServerMessageTypes,
  ErrorPayload,
  ConnectedPayload,
} from '@/types/game';

type Tab = 'create' | 'join';

interface RoomSummary {
  code: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  hostName: string;
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveRooms, setLiveRooms] = useState<RoomSummary[]>([]);
  const sound = useSound();
  const { handleMessage, setPlayerId } = useGameState();

  // Fetch live rooms periodically
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms`);
        const rooms = await res.json();
        setLiveRooms(rooms || []);
      } catch (err) {
        console.log('Failed to fetch rooms:', err);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const onMessage = useCallback(
    (message: WSMessage) => {
      handleMessage(message);

      switch (message.type) {
        case ServerMessageTypes.CONNECTED: {
          const payload = message.payload as ConnectedPayload;
          // Session ID is automatically stored by useWebSocket
          console.log('Connected with session:', payload.sessionId);
          break;
        }

        case ServerMessageTypes.ROOM_JOINED: {
          setIsLoading(false);
          // RoomState is in payload.room - extract room code from URL or state
          // The room page will handle displaying the room
          break;
        }

        case ServerMessageTypes.ERROR: {
          const payload = message.payload as ErrorPayload;
          setIsLoading(false);
          setError(payload.message);
          break;
        }
      }
    },
    [handleMessage]
  );

  const { isConnected, send } = useWebSocket({
    onMessage,
    onConnect: () => {
      console.log('WebSocket connected');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
  });

  const handleCreate = useCallback(
    (playerName: string) => {
      if (!isConnected) {
        setError('Not connected to server');
        return;
      }
      setError(null);
      sound.play('click');
      // Store player name for room page (sessionStorage = per tab)
      sessionStorage.setItem('slapjack_player_name', playerName);
      sessionStorage.setItem('slapjack_is_creating', 'true');
      // Navigate to room page - it will send CREATE_ROOM on its own WebSocket
      router.push('/room/NEW');
    },
    [isConnected, sound, router]
  );

  const handleJoin = useCallback(
    (roomCode: string, playerName: string) => {
      if (!isConnected) {
        setError('Not connected to server');
        return;
      }
      setIsLoading(true);
      setError(null);
      sound.play('click');
      // Store player name for room page (sessionStorage = per tab)
      sessionStorage.setItem('slapjack_player_name', playerName);
      sessionStorage.removeItem('slapjack_is_creating');
      sessionStorage.setItem('slapjack_joining_room', roomCode);
      // Navigate to room page - it will handle joining
      router.push(`/room/${roomCode}`);
    },
    [isConnected, sound, router]
  );

  const handleQuickJoin = useCallback(
    (roomCode: string) => {
      let playerName = sessionStorage.getItem('slapjack_player_name');
      if (!playerName) {
        // Prompt for name
        playerName = window.prompt('Enter your name to join:');
        if (!playerName || playerName.trim() === '') {
          return;
        }
        playerName = playerName.trim();
        sessionStorage.setItem('slapjack_player_name', playerName);
      }
      handleJoin(roomCode, playerName);
    },
    [handleJoin]
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--felt-light)_0%,_var(--felt-dark)_100%)] opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
            className="text-5xl font-black text-white mb-2"
            style={{ textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          >
            SLAPJACK
          </motion.h1>
          <p className="text-gray-300">Multiplayer Card Game</p>

          {/* Connection status */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div
              className={`status-dot ${
                isConnected ? 'connected' : 'disconnected'
              }`}
            />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Card container */}
        <div className="bg-gradient-to-b from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => {
                setActiveTab('create');
                sound.play('hover');
              }}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'create'
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Create Room
            </button>
            <button
              onClick={() => {
                setActiveTab('join');
                sound.play('hover');
              }}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'join'
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Join Room
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'create' ? (
              <CreateRoom onCreate={handleCreate} isLoading={isLoading} />
            ) : (
              <JoinRoom
                onJoin={handleJoin}
                isLoading={isLoading}
                error={error}
              />
            )}
          </div>
        </div>

        {/* Live Rooms */}
        {liveRooms.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 bg-gradient-to-b from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live Games ({liveRooms.length})
              </h3>
            </div>
            <div className="divide-y divide-white/5">
              {liveRooms.map((room) => (
                <button
                  key={room.code}
                  onClick={() => handleQuickJoin(room.code)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                >
                  <div>
                    <span className="font-mono text-white font-bold">{room.code}</span>
                    <span className="text-gray-400 ml-2 text-sm">hosted by {room.hostName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      Join
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* How to play */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-gray-400 text-sm"
        >
          <p className="mb-2">
            <strong className="text-white">How to play:</strong>
          </p>
          <p>
            Take turns playing cards. Slap the pile when you see a Jack,
            doubles, or sandwich!
          </p>
        </motion.div>
      </motion.div>
    </main>
  );
}
