'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WSMessage } from '@/types/game';

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sessionId: string | null;
  send: (type: string, payload?: unknown) => void;
  disconnect: () => void;
  reconnect: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 2000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // Store callbacks in refs to avoid re-creating connect function
  const callbacksRef = useRef({ onMessage, onConnect, onDisconnect, onError });
  callbacksRef.current = { onMessage, onConnect, onDisconnect, onError };

  const connect = useCallback(() => {
    console.log('[WS] connect() called');

    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connecting or connected, skipping');
      return;
    }

    // Don't connect if unmounted
    if (isUnmountedRef.current) {
      console.log('[WS] Component unmounted, skipping connection');
      return;
    }

    isConnectingRef.current = true;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect loop
      wsRef.current.close();
      wsRef.current = null;
    }

    // Get stored session ID for reconnection (use sessionStorage so each tab is a new player)
    const storedSessionId = typeof window !== 'undefined'
      ? sessionStorage.getItem('slapjack_session_id')
      : null;

    const url = storedSessionId
      ? `${WS_URL}?sessionId=${storedSessionId}`
      : WS_URL;

    console.log('[WS] Connecting to:', url);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connection opened');
        if (isUnmountedRef.current) {
          console.log('[WS] Component unmounted during connection, closing');
          ws.close();
          return;
        }
        isConnectingRef.current = false;
        setIsConnected(true);
        reconnectCountRef.current = 0;
        callbacksRef.current.onConnect?.();
      };

      ws.onclose = (event) => {
        console.log('[WS] Connection closed, code:', event.code, 'reason:', event.reason);
        isConnectingRef.current = false;
        setIsConnected(false);

        // Don't do anything if unmounted
        if (isUnmountedRef.current) {
          console.log('[WS] Component unmounted, not reconnecting');
          return;
        }

        callbacksRef.current.onDisconnect?.();

        // Only reconnect on abnormal closure and if we haven't exceeded attempts
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          const delay = reconnectInterval * Math.pow(2, reconnectCountRef.current - 1);
          console.log(`[WS] Will reconnect in ${delay}ms (attempt ${reconnectCountRef.current})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        isConnectingRef.current = false;
        callbacksRef.current.onError?.(error);
      };

      ws.onmessage = (event) => {
        // Server may batch multiple messages separated by newlines
        const messages = event.data.split('\n').filter((s: string) => s.trim());

        for (const msgStr of messages) {
          try {
            const message: WSMessage = JSON.parse(msgStr);

            // Handle CONNECTED message to store session ID
            if (message.type === 'CONNECTED') {
              const payload = message.payload as { sessionId: string };
              setSessionId(payload.sessionId);
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('slapjack_session_id', payload.sessionId);
              }
            }

            callbacksRef.current.onMessage?.(message);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err, msgStr);
          }
        }
      };
    } catch (err) {
      isConnectingRef.current = false;
      console.error('Failed to create WebSocket:', err);
    }
  }, [reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectCountRef.current = reconnectAttempts; // Prevent auto-reconnect
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect on manual disconnect
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [reconnectAttempts]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectCountRef.current = 0;
    setTimeout(connect, 100); // Small delay to ensure clean state
  }, [disconnect, connect]);

  const send = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type,
        payload: payload || {},
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', type);
    }
  }, []);

  useEffect(() => {
    console.log('[WS] Mounting, attempting to connect...');
    isUnmountedRef.current = false;
    isConnectingRef.current = false; // Reset in case of remount
    reconnectCountRef.current = 0;
    connect();

    return () => {
      console.log('[WS] Unmounting, cleaning up...');
      isUnmountedRef.current = true;
      isConnectingRef.current = false; // Reset so next mount can connect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  return {
    isConnected,
    sessionId,
    send,
    disconnect,
    reconnect,
  };
}
