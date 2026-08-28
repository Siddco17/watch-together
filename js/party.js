import { FRIENDS } from './data.js';
import { createLocalSocket } from './local-party.js';

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

export function normalizeCode(raw) {
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

async function serverIsUp() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch('api/health', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch (_) {
    return false;
  }
}

export function createPartyClient() {
  const member = ensureMember();
  let socket = null;

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

  function bindSocket(s) {
    socket = s;
    s.on('connect', () => {
      state.connected = true;
      notify('connect');
      rejoinIfNeeded();
    });
    s.on('disconnect', () => {
      state.connected = false;
      notify('disconnect');
    });
    s.on('party:state', (party) => {
      state.party = party;
      notify('party:state', party);
    });
    s.on('swipe:update', (payload) => {
      if (payload.state) state.party = payload.state;
      notify('swipe:update', payload);
    });
    s.on('match:added', (payload) => {
      if (payload.state) state.party = payload.state;
      notify('match:added', payload);
    });
    s.on('player:sync', (playback) => {
      if (state.party) state.party.playback = playback;
      notify('player:sync', playback);
    });
    s.on('react:burst', (payload) => notify('react:burst', payload));
    s.on('chat:message', (payload) => notify('chat:message', payload));
    s.on('mic:update', (payload) => notify('mic:update', payload));
    s.on('rate:update', (payload) => {
      if (payload.state) state.party = payload.state;
      notify('rate:update', payload);
    });
    if (s.connected) {
      state.connected = true;
      notify('connect');
    }
  }

  async function ensureSocket() {
    if (socket) return socket;
    if ((await serverIsUp()) && typeof io === 'function') {
      bindSocket(io());
    } else {
      bindSocket(createLocalSocket());
    }
    return socket;
  }

  function waitConnected(ms = 4000) {
    return ensureSocket().then(() => {
      if (state.connected || socket?.connected) {
        state.connected = true;
        return true;
      }
      return new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), ms);
        socket.once('connect', () => {
          clearTimeout(t);
          resolve(true);
        });
      });
    });
  }

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
