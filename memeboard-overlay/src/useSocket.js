import { useEffect, useRef } from 'react';

export const useSocket = (onMessage) => {
  const wsRef = useRef(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let closed = false;
    let timer;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onmessage = (e) => handlerRef.current?.(JSON.parse(e.data));
      ws.onclose = () => {
        if (!closed) timer = setTimeout(connect, 1000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, []);

  return wsRef;
}