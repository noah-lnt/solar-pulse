import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';
import type { SystemState } from '@/lib/types';

type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UseWebSocketReturn {
  status: WsStatus;
  lastState: SystemState | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastState, setLastState] = useState<SystemState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRetries = 3;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    const token = getToken();
    if (!token) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLastState(data);
          setStatus('connected');
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [stopPolling]);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      setStatus('disconnected');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      retriesRef.current = 0;
      stopPolling();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state_update') {
          setLastState(msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      retriesRef.current++;

      if (retriesRef.current > maxRetries) {
        setStatus('disconnected');
        startPolling();
        return;
      }

      setStatus('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current - 1), 30000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [startPolling, stopPolling]);

  useEffect(() => {
    connect();

    return () => {
      stopPolling();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, stopPolling]);

  return { status, lastState };
}
