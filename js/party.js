import { FRIENDS } from './data.js';

const MEMBER_KEY = 'wt_member';

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

export function createPartyClient() {
  const member = ensureMember();
  const socket = io();

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

  socket.on('connect', () => {
    state.connected = true;
    notify('connect');
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
      // Online friends stay Added — only offline can toggle Invite / Invited
      if (friend?.online) return;
      if (state.invited.has(friendId)) state.invited.delete(friendId);
      else state.invited.add(friendId);
      notify('invites');
    },
    seedOnlineFriends() {
      FRIENDS.filter((f) => f.online).forEach((f) => state.invited.add(f.id));
      notify('invites');
    },
    getPartyFriends() {
      return FRIENDS.filter((f) => state.invited.has(f.id)).map((f) => ({
        ...f,
        role: f.online ? 'added' : 'invited',
      }));
    },
    createParty({ nightName } = {}) {
      return new Promise((resolve) => {
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
            if (res?.state) state.party = res.state;
            resolve(res);
          }
        );
      });
    },
    joinParty(code) {
      return new Promise((resolve) => {
        socket.emit(
          'party:join',
          {
            code: String(code || '').trim().toUpperCase(),
            id: state.member.id,
            name: state.member.name,
            color: state.member.color,
          },
          (res) => {
            if (res?.state) state.party = res.state;
            resolve(res);
          }
        );
      });
    },
    setPhase(phase, extra = {}) {
      return new Promise((resolve) => {
        socket.emit(
          'party:phase',
          { phase, ...extra, code: state.party?.code },
          (res) => {
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
