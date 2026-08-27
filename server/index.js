const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const {
  TITLES,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  setInvited,
  recordSwipe,
  undoSwipe,
  setPhase,
  applyPlayback,
  getPlaybackNow,
  setRating,
  publicState,
  scheduleBotSwipes,
} = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOT = path.join(__dirname, '..');
app.use(express.json());
app.use(express.static(ROOT));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, titles: TITLES.length });
});

app.get('/api/titles', (_req, res) => {
  res.json(TITLES);
});

function emitState(room) {
  io.to(room.code).emit('party:state', publicState(room));
}

io.on('connection', (socket) => {
  let joinedCode = null;
  let memberId = null;

  socket.on('party:create', (payload = {}, ack) => {
    const id = payload.id || socket.id;
    memberId = id;
    const room = createRoom({
      hostId: id,
      name: payload.name || 'You',
      color: payload.color || '#e50914',
      vibe: payload.vibe || 'Comfort',
      nightName: payload.nightName || 'Friday Spy Night',
      friends: payload.friends || [],
    });
    if (payload.invited?.length) setInvited(room, payload.invited);
    if (joinedCode && joinedCode !== room.code) {
      socket.leave(joinedCode);
      leaveRoom(joinedCode, memberId);
    }
    joinedCode = room.code;
    socket.join(room.code);
    scheduleBotSwipes(room, io, emitState);
    const state = publicState(room);
    socket.emit('party:state', state);
    if (typeof ack === 'function') ack({ ok: true, state });
  });

  socket.on('party:join', (payload = {}, ack) => {
    const id = payload.id || socket.id;
    memberId = id;
    const result = joinRoom(payload.code, {
      id,
      name: payload.name,
      color: payload.color,
    });
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    const room = result.room;
    if (joinedCode && joinedCode !== room.code) {
      socket.leave(joinedCode);
      leaveRoom(joinedCode, memberId);
    }
    joinedCode = room.code;
    socket.join(room.code);
    emitState(room);
    if (typeof ack === 'function') ack({ ok: true, state: publicState(room) });
  });

  socket.on('party:invite', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) return;
    if (payload.friendIds?.length) setInvited(room, payload.friendIds);
    emitState(room);
  });

  socket.on('party:phase', (payload = {}, ack) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Party not found' });
      return;
    }
    setPhase(room, payload.phase, payload);
    const state = publicState(room);
    emitState(room);
    if (payload.phase === 'watch') {
      io.to(room.code).emit('player:sync', getPlaybackNow(room));
    }
    if (typeof ack === 'function') ack({ ok: true, state });
  });

  socket.on('swipe:action', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room || room.phase !== 'match') return;
    const mid = payload.memberId || memberId || socket.id;
    const { titleId, action } = payload;
    if (!titleId || !['match', 'pass', 'later'].includes(action)) return;
    const result = recordSwipe(room, mid, titleId, action);
    const mem = room.members.find((m) => m.id === mid);
    const state = publicState(room);
    io.to(room.code).emit('swipe:update', {
      memberId: mid,
      memberName: mem?.name,
      titleId,
      action,
      state,
    });
    if (result.isNewMatch) {
      io.to(room.code).emit('match:added', {
        titleId,
        count: result.count,
        state,
      });
    }
  });

  socket.on('swipe:undo', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room || room.phase !== 'match') return;
    const mid = payload.memberId || memberId || socket.id;
    const result = undoSwipe(room, mid, payload.titleId);
    if (!result.ok) return;
    const mem = room.members.find((m) => m.id === mid);
    io.to(room.code).emit('swipe:update', {
      memberId: mid,
      memberName: mem?.name,
      titleId: result.titleId,
      action: 'undo',
      state: publicState(room),
    });
  });

  socket.on('player:command', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) return;
    applyPlayback(room, payload);
    io.to(room.code).emit('player:sync', getPlaybackNow(room));
  });

  socket.on('react:send', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) return;
    io.to(room.code).emit('react:burst', {
      emoji: payload.emoji || '🔥',
      memberId: payload.memberId || memberId,
      name: payload.name,
      at: Date.now(),
    });
  });

  socket.on('chat:send', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) return;
    const text = String(payload.text || '').trim().slice(0, 280);
    if (!text) return;
    const msg = {
      id: payload.localId || `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      memberId: payload.memberId || memberId,
      name: payload.name || 'Guest',
      at: Date.now(),
    };
    if (!room.chat) room.chat = [];
    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.shift();
    io.to(room.code).emit('chat:message', msg);
  });

  socket.on('mic:state', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) return;
    const mid = payload.memberId || memberId;
    const m = room.members.find((x) => x.id === mid);
    if (m) m.micOn = !!payload.on;
    io.to(room.code).emit('mic:update', {
      memberId: mid,
      on: !!payload.on,
      name: m?.name,
    });
  });

  socket.on('rate:cast', (payload = {}) => {
    const room = getRoom(joinedCode || payload.code);
    if (!room) return;
    const mid = payload.memberId || memberId || socket.id;
    setRating(room, mid, payload.stars);
    io.to(room.code).emit('rate:update', {
      ratings: room.ratings,
      state: publicState(room),
    });
  });

  socket.on('disconnect', () => {
    if (joinedCode && memberId) leaveRoom(joinedCode, memberId);
    const room = getRoom(joinedCode);
    if (room) emitState(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Watch Together running at http://localhost:${PORT}`);
});
