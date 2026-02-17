import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { parse } from 'url';
import { config } from './config';
import { verifyToken } from './auth/utils';
import { SystemState } from './collectors/types';

interface AuthenticatedSocket extends WebSocket {
  isAlive: boolean;
  userId: number;
}

let wss: WebSocketServer;

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const { pathname, query } = parse(request.url || '', true);

    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = query.token as string;
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
