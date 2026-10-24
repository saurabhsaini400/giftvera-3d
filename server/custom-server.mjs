import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const AVATAR_COLORS = [
  '#38bdf8', // Sky Blue
  '#f43f5e', // Rose Coral
  '#10b981', // Emerald Mint
  '#a855f7', // Purple Violet
  '#f59e0b', // Warm Amber
  '#ec4899', // Radiant Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

// Map of roomId -> Map of playerId -> { ws, playerState }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function broadcastToRoom(roomId, message, senderWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = typeof message === 'string' ? message : JSON.stringify(message);

  for (const [_, client] of room.entries()) {
    if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Attach WebSocketServer to the same HTTP server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let currentRoomId = null;
    let currentPlayerId = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'join') {
          const { roomId, name = 'Visitor' } = msg;
          currentRoomId = roomId;
          currentPlayerId = 'peer_' + Math.random().toString(36).substring(2, 9);

          const room = getOrCreateRoom(roomId);
          const colorIndex = room.size % AVATAR_COLORS.length;
          const assignedColor = AVATAR_COLORS[colorIndex];

          const initialPlayerState = {
            id: currentPlayerId,
            name: name.substring(0, 16),
            color: assignedColor,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            action: 'idle',
            lastUpdated: Date.now(),
          };

          room.set(currentPlayerId, {
            ws,
            playerState: initialPlayerState,
          });

          // Send welcome & existing peers
          const existingPeers = [];
          for (const [pId, client] of room.entries()) {
            if (pId !== currentPlayerId) {
              existingPeers.push(client.playerState);
            }
          }

          ws.send(
            JSON.stringify({
              type: 'welcome',
              playerId: currentPlayerId,
              color: assignedColor,
              peers: existingPeers,
              totalOnline: room.size,
            })
          );

          // Broadcast join to other peers
          broadcastToRoom(
            currentRoomId,
            {
              type: 'peer_joined',
              player: initialPlayerState,
              totalOnline: room.size,
            },
            ws
          );

          console.log(`[WS] Player ${currentPlayerId} joined room "${roomId}". Room count: ${room.size}`);
        }

        if (msg.type === 'move' && currentRoomId && currentPlayerId) {
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const client = room.get(currentPlayerId);
          if (client) {
            client.playerState.position = msg.position;
            client.playerState.rotation = msg.rotation;
            client.playerState.action = msg.action || 'idle';
            client.playerState.lastUpdated = Date.now();

            broadcastToRoom(
              currentRoomId,
              {
                type: 'peer_moved',
                playerId: currentPlayerId,
                position: msg.position,
                rotation: msg.rotation,
                action: msg.action || 'idle',
              },
              ws
            );
          }
        }

        if (msg.type === 'emote' && currentRoomId && currentPlayerId) {
          broadcastToRoom(
            currentRoomId,
            {
              type: 'peer_emote',
              playerId: currentPlayerId,
              emote: msg.emote,
              position: msg.position,
              timestamp: Date.now(),
            },
            null
          );
        }
      } catch (err) {
        console.error('[WS] Message error:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId && currentPlayerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.delete(currentPlayerId);
          const remainingCount = room.size;

          broadcastToRoom(currentRoomId, {
            type: 'peer_left',
            playerId: currentPlayerId,
            totalOnline: remainingCount,
          });

          console.log(`[WS] Player ${currentPlayerId} left room "${currentRoomId}". Remaining: ${remainingCount}`);

          if (room.size === 0) {
            rooms.delete(currentRoomId);
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS] Socket error on player ${currentPlayerId}:`, err);
    });
  });

  server.listen(port, () => {
    console.log(`🚀 Production Unified Server running on http://${hostname}:${port} (Next.js + WebSocket)`);
  });
});
