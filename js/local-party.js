import { FALLBACK_TITLES } from './data.js';

const TITLES = FALLBACK_TITLES;
const rooms = new Map();

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'N-';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function deckForVibe(vibe) {
  const filtered = TITLES.filter((t) => t.vibes.includes(vibe));
  const list = filtered.length ? filtered : TITLES;
  return list.map((t) => t.id);
}

function activeMembers(room) {
  return room.members.filter((m) => !m.left && m.status !== 'invited');
}

function getPlaybackNow(room) {
  const pb = { ...room.playback };
  if (!pb.paused && pb.updatedAt) {
    pb.t += (Date.now() - pb.updatedAt) / 1000;
  }
  return pb;
}

function publicState(room) {
  const memberCount =
    activeMembers(room).length || room.members.filter((m) => !m.left).length;
  const matched = [];
  for (const [titleId, votes] of Object.entries(room.votes)) {
    const count = Object.values(votes).filter((v) => v === 'match').length;
    if (count >= 2) matched.push({ titleId, count, memberCount });
  }
  matched.sort((a, b) => b.count - a.count);

  return {
    code: room.code,
    hostId: room.hostId,
    vibe: room.vibe,
    nightName: room.nightName,
    phase: room.phase,
    members: room.members
      .filter((m) => !m.left)
      .map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        status: m.status,
        isBot: !!m.isBot,
        micOn: !!m.micOn,
        lastAction: m.lastAction || null,
      })),
    deck: room.deck,
    votes: room.votes,
    matched,
    playback: getPlaybackNow(room),
    ratings: room.ratings,
    invited: room.invited,
    chat: (room.chat || []).slice(-40),
  };
}

function createRoom({ hostId, name, color, vibe, nightName, friends }) {
  let code = genCode();
  while (rooms.has(code)) code = genCode();

  const room = {
    code,
    hostId,
    vibe: vibe || 'Comfort',
    nightName: nightName || 'Friday Spy Night',
    phase: 'match',
    members: [
      {
        id: hostId,
        name: name || 'You',
        color: color || '#e50914',
        status: 'swiping',
        isBot: false,
        canSwipe: true,
        left: false,
      },
    ],
    deck: deckForVibe(vibe || 'Comfort'),
    votes: {},
    playback: { titleId: null, t: 0, paused: true, rate: 1, updatedAt: Date.now() },
    ratings: {},
    invited: [],
    chat: [],
    botTimers: [],
  };

  const list = Array.isArray(friends) ? friends : [];
  for (const f of list) {
    const active = f.online || f.role === 'added';
    room.members.push({
      id: String(f.id).startsWith('friend-') ? f.id : `friend-${f.id}`,
      name: f.name || 'Friend',
      color: f.color || '#2458b5',
      status: active ? 'swiping' : 'invited',
      isBot: true,
      canSwipe: !!active,
      left: false,
    });
  }

  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  if (!code) return null;
  return rooms.get(String(code).toUpperCase()) || null;
}

function phaseStatus(room) {
  if (room.phase === 'wrap') return 'rating';
  if (room.phase === 'watch') return 'watching';
  return 'swiping';
}

function joinRoom(code, { id, name, color }) {
  const room = getRoom(code);
  if (!room) return { error: 'Party not found' };
  const existing = room.members.find((m) => m.id === id);
  if (existing) {
    existing.left = false;
    existing.name = name || existing.name;
    existing.color = color || existing.color;
    if (existing.status !== 'invited') existing.status = phaseStatus(room);
  } else {
    room.members.push({
      id,
      name: name || 'Guest',
      color: color || '#2458b5',
      status: phaseStatus(room),
      isBot: false,
      canSwipe: true,
      left: false,
    });
  }
  return { room };
}

function setInvited(room, friendIds) {
  room.invited = Array.from(new Set([...(room.invited || []), ...friendIds]));
}

function recordSwipe(room, memberId, titleId, action) {
  if (!room.votes[titleId]) room.votes[titleId] = {};
  room.votes[titleId][memberId] = action;

  const member = room.members.find((m) => m.id === memberId);
  if (member) {
    member.lastAction = { titleId, action, at: Date.now() };
    const remaining = room.deck.filter((id) => !room.votes[id]?.[memberId]);
    if (member.status !== 'invited') {
      member.status = remaining.length ? 'swiping' : 'matched';
    }
  }

  const count = Object.values(room.votes[titleId]).filter((v) => v === 'match').length;
  return { count, isNewMatch: count === 2 && action === 'match' };
}

function undoSwipe(room, memberId, titleId) {
  if (!titleId || !room.votes[titleId] || room.votes[titleId][memberId] == null) {
    return { ok: false };
  }
  delete room.votes[titleId][memberId];
  const member = room.members.find((m) => m.id === memberId);
  if (member) {
    if (member.lastAction?.titleId === titleId) member.lastAction = null;
    const remaining = room.deck.filter((id) => !room.votes[id]?.[memberId]);
    if (member.status !== 'invited') {
      member.status = remaining.length ? 'swiping' : 'matched';
    }
  }
  return { ok: true, titleId };
}

function applyPlayback(room, cmd) {
  const now = Date.now();
  const pb = room.playback;
  if (!pb.paused && pb.updatedAt) {
    pb.t += (now - pb.updatedAt) / 1000;
  }
  if (typeof cmd.t === 'number') pb.t = Math.max(0, cmd.t);
  if (typeof cmd.paused === 'boolean') pb.paused = cmd.paused;
  if (cmd.titleId) pb.titleId = cmd.titleId;
  if (typeof cmd.rate === 'number' && cmd.rate > 0) pb.rate = cmd.rate;
  pb.updatedAt = now;
  return pb;
}

function setPhase(room, phase, extra = {}) {
  room.phase = phase;
  if (phase === 'watch' && extra.titleId) {
    const prev = getPlaybackNow(room);
    const sameTitle = prev.titleId === extra.titleId;
    room.playback = {
      titleId: extra.titleId,
      t: sameTitle ? prev.t || 0 : 0,
      paused: false,
      rate: prev.rate || 1,
      updatedAt: Date.now(),
    };
    room.members.forEach((m) => {
      if (!m.left && m.status !== 'invited') m.status = 'watching';
    });
  }
  if (phase === 'wrap') {
    if (room.playback) applyPlayback(room, { paused: true });
    room.members.forEach((m) => {
      if (!m.left && m.status !== 'invited') {
        m.status = 'rating';
        if (m.isBot && m.canSwipe && !room.ratings[m.id]) {
          room.ratings[m.id] = Math.random() < 0.35 ? 5 : 4;
        }
      }
    });
  }
  if (phase === 'match') {
    if (room.playback && !room.playback.paused) applyPlayback(room, { paused: true });
    room.members.forEach((m) => {
      if (!m.left && m.status !== 'invited') m.status = 'swiping';
    });
  }
}

function setRating(room, memberId, stars) {
  room.ratings[memberId] = Math.min(5, Math.max(1, stars));
}

function clearBotTimers(room) {
  (room.botTimers || []).forEach((t) => clearTimeout(t));
  room.botTimers = [];
}

function scheduleBotSwipes(room, emit) {
  clearBotTimers(room);
  const bots = room.members.filter((m) => m.isBot && m.canSwipe && !m.left);
  bots.forEach((bot, bi) => {
    room.deck.forEach((titleId, ti) => {
      const delay = 700 + bi * 500 + ti * 1100 + Math.random() * 700;
      const timer = setTimeout(() => {
        if (!rooms.has(room.code) || room.phase !== 'match') return;
        if (room.votes[titleId]?.[bot.id]) return;
        const title = TITLES.find((t) => t.id === titleId);
        const roll = Math.random();
        let action = 'pass';
        if (title?.vibes.includes(room.vibe) && roll < 0.72) action = 'match';
        else if (roll < 0.88) action = 'later';
        const result = recordSwipe(room, bot.id, titleId, action);
        const state = publicState(room);
        emit('swipe:update', {
          memberId: bot.id,
          memberName: bot.name,
          titleId,
          action,
          state,
        });
        emit('party:state', state);
        if (result.isNewMatch) {
          emit('match:added', { titleId, count: result.count, state });
        }
      }, delay);
      room.botTimers.push(timer);
    });
  });
}

/** Socket.io-shaped transport so the party client can run without a Node server. */
export function createLocalSocket() {
  const handlers = new Map();
  let joinedCode = null;
  let memberId = null;

  function on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return this;
  }

  function once(event, fn) {
    const wrap = (...args) => {
      handlers.get(event)?.delete(wrap);
      fn(...args);
    };
    on(event, wrap);
    return this;
  }

  function emitEvent(event, payload) {
    handlers.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (_) {}
    });
  }

  function ack(cb, payload) {
    if (typeof cb === 'function') queueMicrotask(() => cb(payload));
  }

  function handle(event, payload = {}, cb) {
    if (event === 'party:create') {
      const id = payload.id || 'local-host';
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
      joinedCode = room.code;
      scheduleBotSwipes(room, emitEvent);
      const state = publicState(room);
      emitEvent('party:state', state);
      ack(cb, { ok: true, state });
      return;
    }

    if (event === 'party:join') {
      const id = payload.id || 'local-guest';
      memberId = id;
      const result = joinRoom(payload.code, {
        id,
        name: payload.name,
        color: payload.color,
      });
      if (result.error) {
        ack(cb, { ok: false, error: result.error });
        return;
      }
      joinedCode = result.room.code;
      const state = publicState(result.room);
      emitEvent('party:state', state);
      ack(cb, { ok: true, state });
      return;
    }

    const room = getRoom(joinedCode || payload.code);
    if (!room) {
      if (event === 'party:phase') ack(cb, { ok: false, error: 'Party not found' });
      return;
    }

    if (event === 'party:invite') {
      if (payload.friendIds?.length) setInvited(room, payload.friendIds);
      emitEvent('party:state', publicState(room));
      return;
    }

    if (event === 'party:phase') {
      setPhase(room, payload.phase, payload);
      const state = publicState(room);
      emitEvent('party:state', state);
      if (payload.phase === 'watch') emitEvent('player:sync', getPlaybackNow(room));
      ack(cb, { ok: true, state });
      return;
    }

    if (event === 'swipe:action') {
      if (room.phase !== 'match') return;
      const mid = payload.memberId || memberId;
      const { titleId, action } = payload;
      if (!titleId || !['match', 'pass', 'later'].includes(action)) return;
      const result = recordSwipe(room, mid, titleId, action);
      const mem = room.members.find((m) => m.id === mid);
      const state = publicState(room);
      emitEvent('swipe:update', {
        memberId: mid,
        memberName: mem?.name,
        titleId,
        action,
        state,
      });
      if (result.isNewMatch) {
        emitEvent('match:added', { titleId, count: result.count, state });
      }
      return;
    }

    if (event === 'swipe:undo') {
      if (room.phase !== 'match') return;
      const mid = payload.memberId || memberId;
      const result = undoSwipe(room, mid, payload.titleId);
      if (!result.ok) return;
      const mem = room.members.find((m) => m.id === mid);
      emitEvent('swipe:update', {
        memberId: mid,
        memberName: mem?.name,
        titleId: result.titleId,
        action: 'undo',
        state: publicState(room),
      });
      return;
    }

    if (event === 'player:command') {
      applyPlayback(room, payload);
      emitEvent('player:sync', getPlaybackNow(room));
      return;
    }

    if (event === 'react:send') {
      emitEvent('react:burst', {
        emoji: payload.emoji || '🔥',
        memberId: payload.memberId || memberId,
        name: payload.name,
        at: Date.now(),
      });
      return;
    }

    if (event === 'chat:send') {
      const text = String(payload.text || '').trim().slice(0, 280);
      if (!text) return;
      const msg = {
        id: payload.localId || `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        memberId: payload.memberId || memberId,
        name: payload.name || 'Guest',
        at: Date.now(),
      };
      if (!room.chat) room.chat = [];
      room.chat.push(msg);
      if (room.chat.length > 100) room.chat.shift();
      emitEvent('chat:message', msg);
      return;
    }

    if (event === 'mic:state') {
      const mid = payload.memberId || memberId;
      const m = room.members.find((x) => x.id === mid);
      if (m) m.micOn = !!payload.on;
      emitEvent('mic:update', { memberId: mid, on: !!payload.on, name: m?.name });
      return;
    }

    if (event === 'rate:cast') {
      const mid = payload.memberId || memberId;
      setRating(room, mid, payload.stars);
      emitEvent('rate:update', { ratings: room.ratings, state: publicState(room) });
    }
  }

  queueMicrotask(() => emitEvent('connect'));

  return {
    connected: true,
    on,
    once,
    emit(event, payload, cb) {
      handle(event, payload, cb);
    },
  };
}
