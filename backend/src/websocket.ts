import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { parse } from 'url';
import { config } from './config';
import { verifyToken } from './auth/utils';
import { readSession } from './auth/session';
import { SystemState } from './collectors/types';

interface AuthenticatedSocket extends WebSocket {
  isAlive: boolean;
  userId: number;
}

let wss: WebSocketServer;

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const { pathname } = parse(request.url || '');

    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // Cross-site WebSocket hijacking: the session cookie must not open a socket for another site
    const origin = request.headers.origin;
    if (origin && originHost(origin) !== request.headers.host) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const token = readSession(request.headers.cookie);
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const user = verifyToken(token);
      wss.handleUpgrade(request, socket, head, (ws) => {
        const authedWs = ws as AuthenticatedSocket;
        authedWs.isAlive = true;
        authedWs.userId = user.userId;
        wss.emit('connection', authedWs, request);
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: AuthenticatedSocket) => {
    console.log(`[WS] Client connected (user ${ws.userId})`);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected (user ${ws.userId})`);
    });
  });

  // Heartbeat
  setInterval(() => {
    wss.clients.forEach((ws) => {
      const authedWs = ws as AuthenticatedSocket;
      if (!authedWs.isAlive) {
        authedWs.terminate();
        return;
      }
      authedWs.isAlive = false;
      authedWs.ping();
    });
  }, config.wsHeartbeatMs);
}

export function broadcast(state: SystemState): void {
  if (!wss) return;

  const message = JSON.stringify({ type: 'state_update', data: state });

  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
