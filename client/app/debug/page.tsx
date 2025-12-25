'use client';

import { useEffect, useState } from 'react';

interface DebugClient {
  sessionId: string;
  playerId: string;
  playerName: string;
  roomCode: string;
}

interface DebugPlayer {
  id: string;
  name: string;
  cardCount: number;
  isHost: boolean;
  isConnected: boolean;
}

interface DebugRoom {
  code: string;
  status: string;
  hostId: string;
  players: DebugPlayer[];
  hasGame: boolean;
}

interface DebugInfo {
  totalClients: number;
  totalRooms: number;
  clients: DebugClient[];
  rooms: DebugRoom[];
}

export default function DebugPage() {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchDebug = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/debug`);
        const data = await res.json();
        setDebug(data);
        setLastUpdate(new Date());
        setError(null);
      } catch (err) {
        setError('Failed to fetch debug info');
      }
    };

    fetchDebug();
    const interval = setInterval(fetchDebug, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Debug Info</h1>
          <div className="text-sm text-gray-400">
            {lastUpdate && (
              <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
            )}
            <span className="ml-4 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {debug && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-4xl font-bold text-blue-400">{debug.totalClients}</div>
                <div className="text-gray-400">Connected Clients</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-4xl font-bold text-green-400">{debug.totalRooms}</div>
                <div className="text-gray-400">Active Rooms</div>
              </div>
            </div>

            {/* Rooms */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Rooms</h2>
              {debug.rooms.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-6 text-gray-400">No rooms</div>
              ) : (
                <div className="space-y-4">
                  {debug.rooms.map((room) => (
                    <div key={room.code} className="bg-gray-800 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-2xl font-mono font-bold text-yellow-400">
                            {room.code}
                          </span>
                          <span className={`ml-4 px-2 py-1 rounded text-xs font-medium ${
                            room.status === 'waiting' ? 'bg-blue-500/20 text-blue-400' :
                            room.status === 'playing' ? 'bg-green-500/20 text-green-400' :
                            room.status === 'starting' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {room.status}
                          </span>
                          {room.hasGame && (
                            <span className="ml-2 px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">
                              Game Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-gray-400 mb-2">
                        Host ID: <span className="font-mono text-gray-300">{room.hostId}</span>
                      </div>

                      <h3 className="text-sm font-medium text-gray-400 mb-2">
                        Players ({room.players.length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {room.players.map((player) => (
                          <div
                            key={player.id}
                            className={`p-3 rounded-lg ${
                              player.isConnected ? 'bg-gray-700' : 'bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                player.isConnected ? 'bg-green-500' : 'bg-red-500'
                              }`} />
                              <span className="font-medium truncate">
                                {player.name}
                                {player.isHost && (
                                  <span className="ml-1 text-yellow-400">*</span>
                                )}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 font-mono truncate">
                              {player.id.slice(0, 8)}...
                            </div>
                            {room.hasGame && (
                              <div className="text-xs text-gray-400 mt-1">
                                Cards: {player.cardCount}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clients */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Connected Clients</h2>
              {debug.clients.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-6 text-gray-400">No clients</div>
              ) : (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Session ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Player Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Player ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {debug.clients.map((client) => (
                        <tr key={client.sessionId} className="hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-mono text-sm text-gray-300">
                            {client.sessionId.slice(0, 12)}...
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {client.playerName || <span className="text-gray-500">-</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-300">
                            {client.playerId ? `${client.playerId.slice(0, 8)}...` : <span className="text-gray-500">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {client.roomCode ? (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded font-mono text-sm">
                                {client.roomCode}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
