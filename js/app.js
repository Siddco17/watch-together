import { FRIENDS, VIBES, FALLBACK_TITLES, memberInitial, nightNameFor } from './data.js';
import { createPartyClient, normalizeCode } from './party.js';
import { createSwipeUI } from './swipe.js';
import { createPlayerUI } from './player.js';

const client = createPartyClient();
let titles = FALLBACK_TITLES;
let titlesById = new Map(titles.map((t) => [t.id, t]));

const screens = {
  profiles: document.getElementById('profiles'),
  invite: document.getElementById('invite'),
  match: document.getElementById('match'),
  watch: document.getElementById('watch'),
  wrap: document.getElementById('wrap'),
};

function go(name) {
  Object.entries(screens).forEach(([id, el]) => {
    const on = id === name;
    el?.classList.toggle('is-on', on);
    if (el) el.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  history.replaceState(null, '', '#' + name);
}

let wrapStats = { lastReactT: null, rewindCount: 0 };
let toastTimer = null;

function toast(msg) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => {
      el.hidden = true;
    }, 200);
  }, 2400);
}

function setNavProfile(name, color, kind = 'user') {
  document.querySelectorAll('[data-nav-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-nav-avatar]').forEach((el) => {
    el.classList.remove('kids-avatar', 'nav-party');
    el.style.background = '';
    if (kind === 'kids') {
      el.classList.add('kids-avatar');
      el.textContent = 'kids';
    } else if (kind === 'party') {
      el.style.background = color || '#e91e8c';
      el.textContent = memberInitial(name);
    } else {
      el.style.background = color || '#e50914';
      el.textContent = memberInitial(name);
    }
  });
}

function enterPhase(party) {
  const phase = party?.phase || 'match';
  renderJoinCode(party);
  if (phase === 'watch') {
    go('watch');
    playerUI.prepare(party);
  } else if (phase === 'wrap') {
    go('wrap');
    renderWrap(party);
  } else {
    go('match');
    renderPartyFriends();
    swipeUI.render(party);
  }
}

async function loadTitles() {
  try {
    const res = await fetch('api/titles');
    if (res.ok) {
      const remote = await res.json();
      const localById = new Map(FALLBACK_TITLES.map((t) => [t.id, t]));
      // Only keep titles that have a playable clip
      titles = remote
        .map((t) => {
          const local = localById.get(t.id);
          if (!local?.video && !t.video) return null;
          return {
            ...(local || t),
            ...t,
            title: local?.title || t.title,
            runtime: local?.runtime || t.runtime,
            poster: String(t.poster || local?.poster || '').replace(/^\//, ''),
            video: String(t.video || local?.video || '').replace(/^\//, ''),
            art: local?.art || t.art,
          };
        })
        .filter(Boolean);
      if (!titles.length) titles = [...FALLBACK_TITLES];
      titlesById = new Map(titles.map((t) => [t.id, t]));
    }
  } catch (_) {}
}

function renderFriends() {
  const list = document.querySelector('[data-friends]');
  if (!list) return;
  list.innerHTML = FRIENDS.map((f) => {
    const selected = client.invited.has(f.id);
    const status = f.status || (f.online ? 'active' : 'offline');
    const dot =
      status === 'active' ? 'on' : status === 'watching' ? 'watch' : 'off';
    const title =
      status === 'active' ? 'Online' : status === 'watching' ? 'Watching' : 'Offline';
    const avatar = `<span class="avatar" style="background:${f.color}">
          ${memberInitial(f.name)}
          <i class="status-dot ${dot}" title="${title}"></i>
        </span>
        <span class="friend-name">${f.name}</span>`;
    if (status === 'active') {
      return `<div class="friend-row">
        ${avatar}
        <button type="button" class="btn-add added" disabled data-friend="${f.id}">Added</button>
      </div>`;
    }
    if (status === 'watching') {
      return `<div class="friend-row">
        ${avatar}
        <button type="button" class="btn-add busy" disabled>Busy</button>
      </div>`;
    }
    return `<div class="friend-row">
      ${avatar}
      <button type="button" class="btn-add ${selected ? 'invited' : 'invite'}" data-friend="${f.id}">
        ${selected ? 'Invited' : 'Invite'}
      </button>
    </div>`;
  }).join('');
}

function renderPartyFriends() {
  const el = document.querySelector('[data-party-friends]');
  if (!el) return;
  const friends = client.getPartyFriends();
  if (!friends.length) {
    el.innerHTML = '';
    return;
  }
    el.innerHTML = `
    <span class="party-friends-label">Tonight</span>
    ${friends
      .map(
        (f) => `<span class="party-friend-chip">
        <span class="avatar sm" style="background:${f.color}">${memberInitial(f.name)}</span>
        ${f.name}
        <span class="tag ${f.role === 'added' ? 'on' : 'pending'}">${f.role === 'added' ? 'in party' : 'invited'}</span>
      </span>`
      )
      .join('')}
  `;
}

function renderChips() {
  const chips = document.querySelector('[data-chips]');
  if (!chips) return;
  chips.innerHTML = VIBES.map(
    (v) =>
      `<button type="button" class="chip ${v === client.vibe ? 'on' : ''}" data-vibe="${v}">${v}</button>`
  ).join('');
}

function renderJoinCode(party) {
  document.querySelectorAll('[data-party-code]').forEach((el) => {
    if (party?.code) el.textContent = party.code;
  });
}

function partyScore(ratings) {
  const vals = Object.values(ratings || {});
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

function renderWrap(party) {
  const t = titlesById.get(party?.playback?.titleId);
  const titleEl = document.querySelector('[data-wrap-title]');
  const metaEl = document.querySelector('[data-wrap-meta]');
  const still = document.querySelector('[data-wrap-still]');
  const votesEl = document.querySelector('[data-wrap-votes]');
  const scoreEl = document.querySelector('[data-party-score]');
  const nextEl = document.querySelector('[data-next-watch]');
  const starsEl = document.querySelector('[data-stars]');

  if (titleEl && t) titleEl.textContent = t.title.toUpperCase();
  if (metaEl && t) metaEl.textContent = `${t.runtime} · ${t.genre}`;
  if (still && t) {
    still.className = `recap-still ${t.art}`;
  }

  const my = party?.ratings?.[client.member.id] || 0;
  if (starsEl) {
    starsEl.innerHTML = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<button type="button" class="star ${n <= my ? 'on' : ''}" data-star="${n}" aria-label="${n} stars"><span class="material-symbols-outlined ${n <= my ? 'filled' : ''}">star</span></button>`
      )
      .join('');
  }

  if (votesEl && party) {
    votesEl.innerHTML = party.members
      .filter((m) => m.status !== 'invited')
      .map((m) => {
        const r = party.ratings?.[m.id];
        return `<div class="vote">
          <span class="avatar sm" style="background:${m.color}" title="${memberInitial(m.name)}">${memberInitial(m.name)}</span>
          <div>${r ?? '—'}</div>
          <span class="vote-name">${m.name}</span>
        </div>`;
      })
      .join('');
  }

  const score = partyScore(party?.ratings);
  if (scoreEl) {
    scoreEl.innerHTML =
      score != null
        ? `Party score is <b>${score}</b>!`
        : 'Cast your stars — one party score, no arguments.';
  }

  const others = (party?.matched || [])
    .filter((m) => m.titleId !== party?.playback?.titleId)
    .slice(0, 3);
  if (nextEl) {
    nextEl.innerHTML = others
      .map((m) => {
        const title = titlesById.get(m.titleId);
        if (!title) return '';
        return `<button type="button" class="poster ${title.art}" data-next="${title.id}">
          <span>${title.title}</span>
        </button>`;
      })
      .join('') ||
      `<p class="rail-empty">No leftovers — pick another Party mood next Friday.</p>`;
  }

  const loudEl = document.querySelector('[data-wrap-loud]');
  const rewatchEl = document.querySelector('[data-wrap-rewatch]');
  if (loudEl) {
    loudEl.textContent =
      wrapStats.lastReactT != null
        ? formatSessionTime(wrapStats.lastReactT)
        : 'A shared moment';
  }
  if (rewatchEl) {
    rewatchEl.textContent =
      wrapStats.rewindCount > 0
        ? `${wrapStats.rewindCount} rewind${wrapStats.rewindCount === 1 ? '' : 's'}`
        : 'Shared moments';
  }
}

function formatSessionTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const swipeUI = createSwipeUI({
  root: screens.match,
  client,
  titlesById,
  async onStartWatch(titleId) {
    const prev = client.party?.playback;
    const same = prev?.titleId === titleId;
    const optimistic = {
      ...(client.party || {}),
      phase: 'watch',
      playback: {
        ...(prev || {}),
        titleId,
        t: same ? prev.t || 0 : 0,
        paused: false,
      },
    };
    go('watch');
    playerUI.prepare(optimistic);
    await client.setPhase('watch', { titleId });
    if (client.party) playerUI.applySync(client.party.playback);
  },
});

const playerUI = createPlayerUI({
  root: screens.watch,
  client,
  titlesById,
  async onEnd(stats) {
    wrapStats = stats || wrapStats;
    await client.setPhase('wrap');
    go('wrap');
    renderWrap(client.party);
  },
  async onBack() {
    await client.setPhase('match');
    go('match');
    renderPartyFriends();
    swipeUI.render(client.party);
  },
});

// Keep titlesById reference fresh for swipe/player after load
function refreshTitleMaps() {
  titlesById.clear();
  titles.forEach((t) => titlesById.set(t.id, t));
}

client.on((event, payload) => {
  if (event === 'party:state' || event === 'swipe:update' || event === 'match:added') {
    const party = payload?.state || payload || client.party;
    if (!party) return;
    renderJoinCode(party);
    if (event === 'swipe:update' && payload?.memberId && payload.memberId !== client.member.id) {
      swipeUI.noteFriendSwipe(payload);
    }
    if (event === 'match:added' && payload?.titleId) {
      swipeUI.celebrate?.(payload.titleId);
    }
    if (screens.match.classList.contains('is-on') || party.phase === 'match') {
      swipeUI.render(party);
      renderPartyFriends();
    }
    if (party.phase === 'watch' && !screens.watch.classList.contains('is-on')) {
      go('watch');
      playerUI.prepare(party);
    }
    if (party.phase === 'wrap') {
      if (!screens.wrap.classList.contains('is-on')) go('wrap');
      renderWrap(party);
    }
    if (party.phase === 'match' && screens.watch.classList.contains('is-on')) {
      go('match');
      swipeUI.render(party);
    }
  }
  if (event === 'player:sync') {
    playerUI.applySync(payload);
    playerUI.renderMeta(client.party);
  }
  if (event === 'react:burst') {
    // avoid double for local sender (already burst locally) — still show for others
    if (payload.memberId !== client.member.id) playerUI.burst(payload.emoji);
  }
  if (event === 'chat:message') {
    // Prefer server id; local optimistic id already recorded when we sent
    playerUI.appendChat(payload);
  }
  if (event === 'rate:update') renderWrap(payload.state || client.party);
  if (event === 'mic:update' && client.party) {
    const m = client.party.members.find((x) => x.id === payload.memberId);
    if (m) m.micOn = payload.on;
    if (screens.watch.classList.contains('is-on')) playerUI.renderMeta(client.party);
  }
  if (event === 'invites') {
    renderFriends();
    renderPartyFriends();
  }
});

document.querySelector('[data-profiles]')?.addEventListener('click', (e) => {
  const card = e.target.closest('[data-profile]');
  if (!card) return;
  const id = card.dataset.profile;
  if (id === 'watchparty') {
    client.setProfileName('You', '#e91e8c');
    setNavProfile('You', '#e91e8c', 'party');
    client.seedOnlineFriends();
    go('invite');
    renderFriends();
    renderChips();
    return;
  }
  if (id === 'sarah') {
    client.setProfileName('Sarah', '#3b82f6');
    setNavProfile('Sarah', '#3b82f6');
  }
  if (id === 'caleb') {
    client.setProfileName('Caleb', '#f5c518');
    setNavProfile('Caleb', '#f5c518');
  }
  if (id === 'children') {
    client.setProfileName('Children', '#7b2ff7');
    setNavProfile('Children', '#7b2ff7', 'kids');
  }
  // Non-party profiles: soft toast then still allow explore via manage
  const tip = document.querySelector('[data-profile-tip]');
  if (tip) {
    tip.textContent = 'Pick Watch Party to start a night together.';
    tip.hidden = false;
  }
});

document.querySelector('[data-chips]')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-vibe]');
  if (!chip) return;
  client.vibe = chip.dataset.vibe;
  renderChips();
});

document.querySelector('[data-friends]')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-friend]');
  if (!btn) return;
  client.toggleInvite(btn.dataset.friend);
});

document.querySelector('[data-start-party]')?.addEventListener('click', async () => {
  const btn = document.querySelector('[data-start-party]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Starting…';
  }
  const res = await client.createParty({ nightName: nightNameFor(client.vibe) });
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Start Party';
  }
  if (res?.ok) {
    swipeUI.reset?.();
    go('match');
    renderPartyFriends();
    swipeUI.render(client.party);
  } else {
    toast(res?.error || 'Could not start party');
  }
});

async function joinFromInput() {
  const input = document.querySelector('[data-join-code]');
  const err = document.querySelector('[data-join-error]');
  const code = normalizeCode(input?.value);
  if (err) {
    err.hidden = true;
    err.textContent = '';
  }
  if (!code) {
    if (err) {
      err.textContent = 'Enter a party code to join.';
      err.hidden = false;
    }
    return;
  }
  const res = await client.joinParty(code);
  if (!res?.ok) {
    const msg = res?.error || 'Could not join';
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    } else toast(msg);
    return;
  }
  enterPhase(res.state);
}

document.querySelector('[data-join]')?.addEventListener('click', joinFromInput);
document.querySelector('[data-join-code]')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    joinFromInput();
  }
});
document.querySelector('[data-join-code]')?.addEventListener('input', (e) => {
  const el = e.target;
  const start = el.selectionStart;
  el.value = el.value.toUpperCase();
  try {
    el.setSelectionRange(start, start);
  } catch (_) {}
});

document.querySelectorAll('[data-copy-code]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const code = client.party?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
    } catch (_) {
      toast('Code: ' + code);
    }
  });
});

document.querySelector('[data-stars]')?.addEventListener('click', (e) => {
  const star = e.target.closest('[data-star]');
  if (!star) return;
  client.rate(Number(star.dataset.star));
});

document.querySelector('[data-next-watch]')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-next]');
  if (!btn) return;
  const titleId = btn.dataset.next;
  go('watch');
  playerUI.prepare({
    ...(client.party || {}),
    playback: { ...(client.party?.playback || {}), titleId, t: 0, paused: false },
  });
  await client.setPhase('watch', { titleId });
});

document.querySelector('[data-watch-matched]')?.addEventListener('click', async () => {
  await client.setPhase('match');
  go('match');
  renderPartyFriends();
  swipeUI.render(client.party);
});

document.querySelector('[data-save-night]')?.addEventListener('click', (e) => {
  const btn = e.target;
  btn.textContent = 'Night saved ✓';
  btn.disabled = true;
});

// Nav Watch Party icon → invite if already past profiles
document.querySelectorAll('[data-nav-party]').forEach((el) => {
  el.addEventListener('click', () => {
    if (client.party) {
      enterPhase(client.party);
    } else {
      setNavProfile('You', '#e91e8c', 'party');
      client.seedOnlineFriends();
      go('invite');
      renderFriends();
      renderChips();
    }
  });
});

document.querySelectorAll('[data-home]').forEach((el) => {
  el.addEventListener('click', () => go('profiles'));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go('profiles');
    }
  });
});

document.querySelector('.btn-manage')?.addEventListener('click', () => go('profiles'));

function navKindFor(member) {
  if (!member) return 'user';
  if (member.name === 'Children') return 'kids';
  if (member.name === 'You') return 'party';
  return 'user';
}

(async function init() {
  await loadTitles();
  refreshTitleMaps();
  const saved = client.savedCode?.();
  if (saved) {
    const res = client.party
      ? { ok: true, state: client.party }
      : await client.joinParty(saved);
    if (res?.ok && res.state) {
      setNavProfile(client.member.name, client.member.color, navKindFor(client.member));
      enterPhase(res.state);
      return;
    }
  }
  const hash = (location.hash || '#profiles').slice(1);
  if (hash === 'invite') {
    client.seedOnlineFriends();
    go('invite');
    renderFriends();
    renderChips();
  } else if (['match', 'watch', 'wrap'].includes(hash) && !client.party) {
    go('profiles');
  } else if (screens[hash]) {
    go(hash);
    if (hash === 'match') renderPartyFriends();
  } else go('profiles');
})();
