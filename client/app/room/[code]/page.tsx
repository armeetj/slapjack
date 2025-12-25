'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { RoomSettings } from '@/components/lobby/RoomSettings';
import { GameBoard } from '@/components/game/GameBoard';
import { PlayerSlot } from '@/components/game/PlayerSlot';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGameState } from '@/hooks/useGameState';
import { useSound } from '@/hooks/useSound';
import {
  WSMessage,
  ServerMessageTypes,
  MessageTypes,
  ConnectedPayload,
  RoomSettings as RoomSettingsType,
  RoomCreatedPayload,
  RoomJoinedPayload,
  ErrorPayload,
  PlayerKickedPayload,
  GameEndedPayload,
} from '@/types/game';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const urlCode = (params.code as string).toUpperCase();
  const sound = useSound();
  const hasJoinedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [waitingForReconnect, setWaitingForReconnect] = useState(true);
  const [actualRoomCode, setActualRoomCode] = useState<string | null>(null);

  // Use actual room code if we have it (after creation), otherwise use URL
  const roomCode = actualRoomCode || urlCode;

  const {
    room,
    game,
    countdown,
    lastSlapAttempt,
    lastSlapResult,
    gameOver,
    turnWarning,
    handleMessage,
    setPlayerId,
    isMyTurn,
    myCardCount,
    isHost,
  } = useGameState();

  const onMessage = useCallback(
    (message: WSMessage) => {
      console.log('[Room] Received message:', message.type, message.payload);
      handleMessage(message);

      switch (message.type) {
        case ServerMessageTypes.CONNECTED: {
          const payload = message.payload as ConnectedPayload;
          console.log('[Room] Connected with session:', payload.sessionId);
          // Wait a brief moment for RECONNECTED message before proceeding
          setTimeout(() => {
            setWaitingForReconnect(false);
          }, 200);
          break;
        }

        case ServerMessageTypes.ROOM_CREATED: {
          const payload = message.payload as RoomCreatedPayload;
          console.log('[Room] Room created:', payload.roomCode);
          // Store actual room code (URL stays /room/NEW but we track the real code)
          setActualRoomCode(payload.roomCode);
          // Find our player (we're the host)
          const me = payload.room.players.find(p => p.isHost);
          if (me) {
            setMyPlayerId(me.id);
            setPlayerId(me.id);
          }
          // Clear the creating flag
          sessionStorage.removeItem('slapjack_is_creating');
          // Update URL without remounting (using history API directly)
          if (payload.roomCode && payload.roomCode !== urlCode) {
            window.history.replaceState(null, '', `/room/${payload.roomCode}`);
          }
          break;
        }

        case ServerMessageTypes.ROOM_JOINED: {
          const payload = message.payload as RoomJoinedPayload;
          console.log('[Room] Joined room');
          // Find our player (we're the most recent joiner - highest position)
          const me = payload.room.players.reduce((latest, p) =>
            p.position > (latest?.position ?? -1) ? p : latest
          , payload.room.players[0]);
          if (me) {
            setMyPlayerId(me.id);
            setPlayerId(me.id);
          }
          // Clear joining flag
          sessionStorage.removeItem('slapjack_joining_room');
          break;
        }

        case ServerMessageTypes.RECONNECTED: {
          const payload = message.payload as RoomJoinedPayload;
          console.log('[Room] Reconnected to room');
          // Mark as joined so we don't send CREATE/JOIN
          hasJoinedRef.current = true;
          setWaitingForReconnect(false);
          // Find our player - check sessionStorage for created room
          const createdRoom = sessionStorage.getItem('slapjack_created_room');
          if (createdRoom === roomCode) {
            // We created this room, we're the host
            const me = payload.room.players.find(p => p.isHost);
            if (me) {
              setMyPlayerId(me.id);
              setPlayerId(me.id);
            }
            sessionStorage.removeItem('slapjack_created_room');
          }
          break;
        }

        case ServerMessageTypes.ERROR: {
          const payload = message.payload as ErrorPayload;
          console.error('[Room] Error:', payload);
          setError(payload.message);
          // If room not found, go back to home
          if (payload.code === 'ROOM_NOT_FOUND' || payload.code === 'JOIN_FAILED') {
            setTimeout(() => router.push('/'), 2000);
          }
          break;
        }

        case ServerMessageTypes.GAME_STARTING: {
          sound.play('countdown');
          break;
        }

        case ServerMessageTypes.CARD_PLAYED: {
          sound.play('cardPlace');
          break;
        }

        case ServerMessageTypes.SLAP_RESULT: {
          const payload = message.payload as { success: boolean };
          if (payload.success) {
            sound.play('slapHit');
          } else {
            sound.play('slapMiss');
          }
          break;
        }

        case ServerMessageTypes.GAME_OVER: {
          sound.play('win');
          break;
        }

        case ServerMessageTypes.PLAYER_KICKED: {
          const payload = message.payload as PlayerKickedPayload;
          // If I was kicked, go back to home
          if (payload.playerId === myPlayerId) {
            alert('You have been kicked from the room');
            router.push('/');
          }
          break;
        }

        case ServerMessageTypes.GAME_ENDED: {
          const payload = message.payload as GameEndedPayload;
          console.log('[Room] Game ended:', payload.reason);
          break;
        }
      }
    },
    [handleMessage, sound, router, setPlayerId, urlCode, myPlayerId]
  );

  const { isConnected, send, sessionId } = useWebSocket({
    onMessage,
  });

  // Join room when connected (after checking for reconnection)
  useEffect(() => {
    if (!isConnected || hasJoinedRef.current || waitingForReconnect) {
      return;
    }

    const playerName = sessionStorage.getItem('slapjack_player_name');
    // Use URL to determine create vs join: /room/NEW = create, anything else = join
    const isCreating = urlCode === 'NEW';

    console.log('[Room] Ready to join, playerName:', playerName, 'isCreating:', isCreating, 'urlCode:', urlCode);

    if (!playerName) {
      console.log('[Room] No player name, redirecting to home');
      router.push('/');
      return;
    }

    hasJoinedRef.current = true;

    if (isCreating) {
      console.log('[Room] Creating room...');
      sessionStorage.removeItem('slapjack_is_creating'); // Clean up
      send(MessageTypes.CREATE_ROOM, { playerName });
    } else {
      console.log('[Room] Joining room:', urlCode);
      send(MessageTypes.JOIN_ROOM, { roomCode: urlCode, playerName });
    }
  }, [isConnected, urlCode, router, send, waitingForReconnect]);

  // Reset join flag when component unmounts
  useEffect(() => {
    return () => {
      hasJoinedRef.current = false;
    };
  }, []);

  const handleStartGame = useCallback(() => {
    sound.play('click');
    send(MessageTypes.START_GAME, {});
  }, [send, sound]);

  const handlePlayCard = useCallback(() => {
    if (isMyTurn && myCardCount > 0) {
      sound.play('cardSlide');
      send(MessageTypes.PLAY_CARD, {});
    }
  }, [isMyTurn, myCardCount, send, sound]);

  const handleSlap = useCallback(() => {
    send(MessageTypes.SLAP, { timestamp: Date.now() });
  }, [send]);

  const handleUpdateSettings = useCallback(
    (settings: Partial<RoomSettingsType>) => {
      send(MessageTypes.UPDATE_SETTINGS, { ...room?.settings, ...settings });
    },
    [send, room?.settings]
  );

  const handleLeaveRoom = useCallback(() => {
    send(MessageTypes.LEAVE_ROOM, {});
    sessionStorage.removeItem('slapjack_player_name');
    sessionStorage.removeItem('slapjack_is_creating');
    sessionStorage.removeItem('slapjack_joining_room');
    router.push('/');
  }, [send, router]);

  const handleChangeName = useCallback(() => {
    const currentName = room?.players.find(p => p.id === myPlayerId)?.name || '';
    const newName = window.prompt('Enter new name:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      send(MessageTypes.CHANGE_NAME, { newName: newName.trim() });
      sessionStorage.setItem('slapjack_player_name', newName.trim());
    }
  }, [send, room?.players, myPlayerId]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode);
  }, [roomCode]);

  const handleKickPlayer = useCallback((playerId: string) => {
    const player = room?.players.find(p => p.id === playerId);
    if (player && window.confirm(`Kick ${player.name}?`)) {
      send(MessageTypes.KICK_PLAYER, { playerId });
    }
  }, [send, room?.players]);

  const handleEndGame = useCallback(() => {
    if (window.confirm('End the current game?')) {
      send(MessageTypes.END_GAME, {});
    }
  }, [send]);

  // Error state
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-white mb-4">{error}</p>
          <Button onAction={() => router.push('/')} variant="secondary">
            Back to Home
          </Button>
        </div>
      </main>
    );
  }

  // Loading state
  if (!room) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4" />
          <p className="text-white">Joining room {roomCode}...</p>
          {!isConnected && (
            <p className="text-gray-400 text-sm mt-2">Connecting to server...</p>
          )}
        </div>
      </main>
    );
  }

  // Game in progress
  if (room.status === 'playing' && game) {
    return (
      <GameBoard
        players={room.players}
        currentPlayerId={game.currentPlayerId}
        myPlayerId={myPlayerId || ''}
        gameState={game}
        onPlayCard={handlePlayCard}
        onSlap={handleSlap}
        onLeave={handleLeaveRoom}
        onEndGame={handleEndGame}
        isHost={room.hostId === myPlayerId}
        lastSlapAttempt={lastSlapAttempt}
        lastSlapResult={lastSlapResult}
        turnWarning={turnWarning}
      />
    );
  }

  // Game over
  if (gameOver) {
    const amIHost = room.hostId === myPlayerId;
    const sortedPlayers = [...room.players].sort((a, b) => {
      // Sort by successful slaps descending
      const aSlaps = gameOver.stats.successfulSlaps[a.id] || 0;
      const bSlaps = gameOver.stats.successfulSlaps[b.id] || 0;
      return bSlaps - aSlaps;
    });

    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl border border-white/10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="text-6xl mb-4"
          >
            {gameOver.winnerId === myPlayerId ? '🎉' : '😔'}
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
          <p className="text-xl text-yellow-400 mb-6">
            {gameOver.winnerName} wins!
          </p>

          {/* Game summary */}
          <div className="bg-white/5 rounded-lg p-4 mb-4 text-left">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Duration</span>
              <span className="text-white font-medium">
                {Math.floor(gameOver.stats.duration / 60000)}:{String(Math.floor((gameOver.stats.duration % 60000) / 1000)).padStart(2, '0')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Slaps</span>
              <span className="text-white font-medium">{gameOver.stats.totalSlaps}</span>
            </div>
          </div>

          {/* Player stats */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h3 className="text-sm text-gray-400 mb-3 text-left">Player Stats</h3>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => {
                const successfulSlaps = gameOver.stats.successfulSlaps[player.id] || 0;
                const cardsBurned = gameOver.stats.cardsBurned[player.id] || 0;
                const isWinner = player.id === gameOver.winnerId;
                const isMe = player.id === myPlayerId;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      isWinner ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/5'
                    }`}
                  >
                    <div className="w-6 text-center">
                      {isWinner ? (
                        <span className="text-yellow-400">👑</span>
                      ) : (
                        <span className="text-gray-500 text-sm">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`text-sm font-medium ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                        {player.name}
                        {isMe && ' (you)'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div className="text-center">
                        <div className="text-green-400 font-medium">{successfulSlaps}</div>
                        <div className="text-gray-500">slaps</div>
                      </div>
                      <div className="text-center">
                        <div className="text-red-400 font-medium">{cardsBurned}</div>
                        <div className="text-gray-500">burned</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onAction={handleStartGame}
              variant="primary"
              className="flex-1"
              disabled={!amIHost}
            >
              {amIHost ? 'Play Again' : 'Waiting for host...'}
            </Button>
            <Button onAction={handleLeaveRoom} variant="ghost">
              Leave
            </Button>
          </div>
        </motion.div>
      </main>
    );
  }

  // Countdown
  if (countdown !== null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          key={countdown}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
          className="text-9xl font-black text-white countdown-number"
          style={{ textShadow: '0 0 50px rgba(255,255,255,0.5)' }}
        >
          {countdown}
        </motion.div>
      </main>
    );
  }

  // Waiting room
  const amIHost = room.hostId === myPlayerId;

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button onAction={handleLeaveRoom} variant="ghost" size="sm">
            ← Leave
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-400 mb-1">Room Code</p>
            <button
              onClick={handleCopyCode}
              className="text-3xl font-mono font-bold text-white tracking-widest hover:text-yellow-400 transition-colors"
              title="Click to copy"
            >
              {roomCode}
            </button>
          </div>

          <div className="w-20" />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Players */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-b from-gray-800/80 to-gray-900/80 backdrop-blur rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Players ({room.players.length}/{room.settings.maxPlayers})
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {room.players.map((player) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative group"
                  >
                    <PlayerSlot
                      player={player}
                      isCurrentTurn={false}
                      isCurrentPlayer={player.id === myPlayerId}
                    />
                    {/* Kick button for host */}
                    {amIHost && player.id !== myPlayerId && (
                      <button
                        onClick={() => handleKickPlayer(player.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Kick player"
                      >
                        ×
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty slots */}
              {Array.from({
                length: room.settings.maxPlayers - room.players.length,
              }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed border-white/20"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/30">
                    ?
                  </div>
                  <span className="text-sm text-gray-500">Waiting...</span>
                </div>
              ))}
            </div>

            {/* Start button */}
            <div className="mt-6 space-y-3">
              <Button
                onAction={handleStartGame}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!amIHost || room.players.length < 2}
              >
                {!amIHost
                  ? 'Waiting for host to start...'
                  : room.players.length < 2
                  ? 'Need at least 2 players'
                  : 'Start Game'}
              </Button>
              <button
                onClick={handleChangeName}
                className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2"
              >
                Change my name
              </button>
            </div>
          </motion.div>

          {/* Settings */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-b from-gray-800/80 to-gray-900/80 backdrop-blur rounded-xl p-6 border border-white/10"
          >
            <RoomSettings
              settings={room.settings}
              onChange={handleUpdateSettings}
              disabled={!amIHost}
            />
            {!amIHost && (
              <p className="text-gray-500 text-sm mt-4">
                Only the host can change settings
              </p>
            )}
          </motion.div>
        </div>

        {/* How to play */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-white/5 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-3">How to Play</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
            <div>
              <h4 className="text-white font-medium mb-1">1. Play Cards</h4>
              <p>Take turns playing the top card from your deck to the center pile.</p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-1">2. Slap!</h4>
              <p>
                Slap the pile when you see a Jack, doubles (same rank twice), or
                sandwich (same rank with one card between).
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-1">3. Win</h4>
              <p>
                Correct slaps win the pile. Wrong slaps cost you cards. Last
                player with cards wins!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
