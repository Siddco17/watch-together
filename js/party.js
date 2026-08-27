const MEMBER_KEY = 'wt_member';
const PARTY_KEY = 'wt_party';

function persistCode(code) {
  try {
    if (code) sessionStorage.setItem(PARTY_KEY, code);
    else sessionStorage.removeItem(PARTY_KEY);
  } catch (_) {}
}

function savedCode() {
  try {
    return sessionStorage.getItem(PARTY_KEY);
  } catch (_) {
    return null;
  }
}

function normalizeCode(raw) {
  let s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (/^[A-Z0-9]{4}$/.test(s)) s = 'N-' + s;
  else if (/^N[A-Z0-9]{4}$/.test(s)) s = 'N-' + s.slice(1);
  return s;
}

function loadMember() {
  try {
    const raw = localStorage.getItem(MEMBER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveMember(m) {
  localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
}

function ensureMember() {
  let m = loadMember();
  if (!m?.id) {
    m = {
      id: 'u-' + Math.random().toString(36).slice(2, 10),
      name: 'You',
      color: '#e91e8c',
    };
    saveMember(m);
  }
  return m;
}

function createLocalTransport() {
  const handlers = {};
  let joinedCode = null;
  let memberId = null;

  function on(event, fn) {
    (handlers[event] = handlers[event] || []).push(fn);
  }

  function emitClient(event, payload) {
    (handlers[event] || []).forEach((fn) => fn(payload));
  }

  function once(event, fn) {
    const wrap = (payload) => {
      handlers[event] = (handlers[event] || []).filter((f) => f !== wrap);
      fn(payload);
    };
    on(event, wrap);
  }

  function emit(event, payload, ack) {
    const p = payload || {};
    if (event === 'party:create') {
      memberId = p.id;
      const room = LocalRoom.createRoom({
        hostId: p.id,
        name: p.name || 'You',
        color: p.color || '#e50914',
        vibe: p.vibe || 'Comfort',
        nightName: p.nightName || 'Friday Spy Night',
        friends: p.friends || [],
      });
      if (p.invited?.length) LocalRoom.setInvited(room, p.invited);
      joinedCode = room.code;
      LocalRoom.scheduleBotSwipes(room, emitClient);
      const state = LocalRoom.publicState(room);
      emitClient('party:state', state);
      if (typeof ack === 'function') ack({ ok: true, state });
      return;
    }
    if (event === 'party:join') {
      memberId = p.id;
      const result = LocalRoom.joinRoom(p.code, {
        id: p.id,
        name: p.name,
        color: p.color,
      });
      if (result.error) {
        if (typeof ack === 'function') ack({ ok: false, error: result.error });
        return;
      }
      joinedCode = result.room.code;
      const state = LocalRoom.publicState(result.room);
      emitClient('party:state', state);
      if (typeof ack === 'function') ack({ ok: true, state });
      return;
    }
    const room = LocalRoom.getRoom(joinedCode || p.code);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Party not found' });
      return;
    }
    if (event === 'party:phase') {
      LocalRoom.setPhase(room, p.phase, p);
      const state = LocalRoom.publicState(room);
      emitClient('party:state', state);
      if (p.phase === 'watch') emitClient('player:sync', LocalRoom.getPlaybackNow(room));
      if (typeof ack === 'function') ack({ ok: true, state });
      return;
    }
    if (event === 'swipe:action') {
      if (room.phase !== 'match') return;
      const mid = p.memberId || memberId;
      const result = LocalRoom.recordSwipe(room, mid, p.titleId, p.action);
      const mem = room.members.find((m) => m.id === mid);
      const state = LocalRoom.publicState(room);
      emitClient('swipe:update', {
        memberId: mid,
        memberName: mem?.name,
        titleId: p.titleId,
        action: p.action,
        state,
      });
      if (result.isNewMatch) {
        emitClient('match:added', { titleId: p.titleId, count: result.count, state });
      }
      return;
    }
    if (event === 'swipe:undo') {
      if (room.phase !== 'match') return;
      const mid = p.memberId || memberId;
      const result = LocalRoom.undoSwipe(room, mid, p.titleId);
      if (!result.ok) return;
      const mem = room.members.find((m) => m.id === mid);
      emitClient('swipe:update', {
        memberId: mid,
        memberName: mem?.name,
        titleId: result.titleId,
        action: 'undo',
        state: LocalRoom.publicState(room),
      });
      return;
    }
    if (event === 'player:command') {
      LocalRoom.applyPlayback(room, p);
      emitClient('player:sync', LocalRoom.getPlaybackNow(room));
      return;
    }
    if (event === 'react:send') {
      emitClient('react:burst', {
        emoji: p.emoji || '🔥',
        memberId: p.memberId || memberId,
        name: p.name,
        at: Date.now(),
      });
      return;
    }
    if (event === 'chat:send') {
      const text = String(p.text || '').trim().slice(0, 280);
      if (!text) return;
      const msg = {
        id: p.localId || `local-${Date.now()}`,
        text,
        memberId: p.memberId || memberId,
        name: p.name || 'Guest',
        at: Date.now(),
      };
      if (!room.chat) room.chat = [];
      room.chat.push(msg);
      emitClient('chat:message', msg);
      return;
    }
    if (event === 'mic:state') {
      const mid = p.memberId || memberId;
      const m = room.members.find((x) => x.id === mid);
      if (m) m.micOn = !!p.on;
      emitClient('mic:update', { memberId: mid, on: !!p.on, name: m?.name });
      return;
    }
    if (event === 'rate:cast') {
      const mid = p.memberId || memberId;
      LocalRoom.setRating(room, mid, p.stars);
      emitClient('rate:update', {
        ratings: room.ratings,
        state: LocalRoom.publicState(room),
      });
    }
  }

  queueMicrotask(() => emitClient('connect'));

  return {
    connected: true,
    on,
    once,
    emit,
  };
}

function createTransport() {
  if (location.protocol === 'file:' || typeof io !== 'function') {
    return createLocalTransport();
  }
  return io();
}

function createPartyClient() {
  const member = ensureMember();
  const socket = createTransport();

  const state = {
    member,
    party: null,
    vibe: 'Comfort',
    invited: new Set(),
    connected: false,
    listeners: new Set(),
  };

  function notify(event, payload) {
    state.listeners.forEach((fn) => fn(event, payload));
  }

  function rejoinIfNeeded() {
    const code = state.party?.code || savedCode();
    if (!code) return;
    socket.emit(
      'party:join',
      {
        code: normalizeCode(code),
        id: state.member.id,
        name: state.member.name,
        color: state.member.color,
      },
      (res) => {
        if (res?.state) {
          state.party = res.state;
          persistCode(res.state.code);
          notify('party:state', res.state);
        } else if (res && res.ok === false) {
          persistCode(null);
        }
      }
    );
  }

  function waitConnected(ms = 4000) {
    if (state.connected || socket.connected) {
      state.connected = true;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), ms);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve(true);
      });
    });
  }

  socket.on('connect', () => {
    state.connected = true;
    notify('connect');
    rejoinIfNeeded();
  });

  socket.on('disconnect', () => {
    state.connected = false;
    notify('disconnect');
  });

  socket.on('party:state', (party) => {
    state.party = party;
    notify('party:state', party);
  });

  socket.on('swipe:update', (payload) => {
    if (payload.state) state.party = payload.state;
    notify('swipe:update', payload);
  });

  socket.on('match:added', (payload) => {
    if (payload.state) state.party = payload.state;
    notify('match:added', payload);
  });

  socket.on('player:sync', (playback) => {
    if (state.party) state.party.playback = playback;
    notify('player:sync', playback);
  });

  socket.on('react:burst', (payload) => notify('react:burst', payload));

  socket.on('chat:message', (payload) => notify('chat:message', payload));

  socket.on('mic:update', (payload) => notify('mic:update', payload));

  socket.on('rate:update', (payload) => {
    if (payload.state) state.party = payload.state;
    notify('rate:update', payload);
  });

  return {
    get member() {
      return state.member;
    },
    get party() {
      return state.party;
    },
    get vibe() {
      return state.vibe;
    },
    set vibe(v) {
      state.vibe = v;
    },
    get invited() {
      return state.invited;
    },
    get friends() {
      return FRIENDS;
    },
    get connected() {
      return state.connected;
    },
    savedCode,
    waitConnected,
    on(fn) {
      state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    },
    setProfileName(name, color) {
      state.member.name = name;
      if (color) state.member.color = color;
      saveMember(state.member);
    },
    toggleInvite(friendId) {
      const friend = FRIENDS.find((f) => f.id === friendId);
      if (friend?.status === 'active' || friend?.status === 'watching') return;
      if (state.invited.has(friendId)) state.invited.delete(friendId);
      else state.invited.add(friendId);
      notify('invites');
    },
    seedOnlineFriends() {
      FRIENDS.filter((f) => f.status === 'active').forEach((f) => state.invited.add(f.id));
      notify('invites');
    },
    getPartyFriends() {
      return FRIENDS.filter((f) => state.invited.has(f.id)).map((f) => ({
        ...f,
        online: f.status === 'active',
        role: f.status === 'active' ? 'added' : 'invited',
      }));
    },
    async createParty({ nightName } = {}) {
      const ready = await waitConnected();
      if (!ready) return { ok: false, error: 'Could not connect. Try again.' };
      return new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ ok: false, error: 'Could not start party. Try again.' });
        }, 6000);
        socket.emit(
          'party:create',
          {
            id: state.member.id,
            name: state.member.name,
            color: state.member.color,
            vibe: state.vibe,
            nightName: nightName || 'Friday Spy Night',
            invited: Array.from(state.invited),
            friends: this.getPartyFriends(),
          },
          (res) => {
            if (done) return;
            done = true;
            clearTimeout(t);
            if (res?.state) {
              state.party = res.state;
              persistCode(res.state.code);
            }
            resolve(res);
          }
        );
      });
    },
    async joinParty(code) {
      const ready = await waitConnected();
      if (!ready) return { ok: false, error: 'Could not connect. Try again.' };
      const normalized = normalizeCode(code);
      if (!normalized) return { ok: false, error: 'Enter a party code' };
      return new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ ok: false, error: 'Could not join. Try again.' });
        }, 6000);
        socket.emit(
          'party:join',
          {
            code: normalized,
            id: state.member.id,
            name: state.member.name,
            color: state.member.color,
          },
          (res) => {
            if (done) return;
            done = true;
            clearTimeout(t);
            if (res?.state) {
              state.party = res.state;
              persistCode(res.state.code);
            }
            resolve(res);
          }
        );
      });
    },
    setPhase(phase, extra = {}) {
      return new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ ok: false, error: 'Timed out' });
        }, 6000);
        socket.emit(
          'party:phase',
          { phase, ...extra, code: state.party?.code },
          (res) => {
            if (done) return;
            done = true;
            clearTimeout(t);
            if (res?.state) state.party = res.state;
            resolve(res);
          }
        );
      });
    },
    swipe(titleId, action) {
      socket.emit('swipe:action', {
        code: state.party?.code,
        memberId: state.member.id,
        titleId,
        action,
      });
    },
    undo(titleId) {
      socket.emit('swipe:undo', {
        code: state.party?.code,
        memberId: state.member.id,
        titleId,
      });
    },
    playerCommand(cmd) {
      socket.emit('player:command', { ...cmd, code: state.party?.code });
    },
    sendReact(icon) {
      socket.emit('react:send', {
        code: state.party?.code,
        emoji: icon,
        memberId: state.member.id,
        name: state.member.name,
      });
    },
    sendChat(text, localId) {
      socket.emit('chat:send', {
        code: state.party?.code,
        text,
        memberId: state.member.id,
        name: state.member.name,
        localId,
      });
    },
    setMic(on) {
      socket.emit('mic:state', {
        code: state.party?.code,
        memberId: state.member.id,
        on: !!on,
      });
    },
    rate(stars) {
      socket.emit('rate:cast', {
        code: state.party?.code,
        memberId: state.member.id,
        stars,
      });
    },
    myVote(titleId) {
      return state.party?.votes?.[titleId]?.[state.member.id] || null;
    },
  };
}
