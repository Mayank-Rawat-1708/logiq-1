import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import type { ProcessingProgress } from '../types';

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws';

export const useWebSocket = (sessionId: string, enabled = true) => {
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!enabled || !sessionId || !accessToken) return;

    const url = `${WS_BASE}/sessions/${sessionId}/stream?token=${accessToken}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat' || data.type === 'connected') return;
        setProgress(data as ProcessingProgress);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId, enabled, accessToken]);

  return { progress, connected };
};
