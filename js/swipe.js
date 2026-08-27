import { memberInitial } from './data.js';

const ACTION_LABEL = {
  match: 'matched',
  pass: 'passed',
  later: 'saved',
  undo: 'undid',
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createSwipeUI({ root, client, titlesById, onStartWatch }) {
  const deckEl = root.querySelector('[data-deck]');
  const actionsEl = root.querySelector('[data-actions]');
  const railEl = root.querySelector('[data-rail]');
  const statusEl = root.querySelector('[data-status]');
  const nightEl = root.querySelector('[data-night]');
  const leftEl = root.querySelector('[data-left]');
  const undoBtn = root.querySelector('[data-undo]');

  let history = [];
  let drag = null;
  let busy = false;
  let shownTitleId = null;
  let lastMatchId = null;
  let statusClearTimer = null;
  let feedEl = root.querySelector('[data-swipe-feed]');
  if (!feedEl) {
    feedEl = document.createElement('div');
    feedEl.className = 'swipe-feed';
    feedEl.setAttribute('data-swipe-feed', '');
    root.querySelector('.match-live')?.appendChild(feedEl) ||
      root.querySelector('.match-head')?.appendChild(feedEl);
  }

  function pushFeedChip(html, extraClass = '') {
    if (!feedEl) return;
    while (feedEl.children.length >= 4) feedEl.firstElementChild.remove();
    const chip = document.createElement('div');
    chip.className = `friend-swipe-chip ${extraClass}`.trim();
    chip.innerHTML = html;
    feedEl.appendChild(chip);
    requestAnimationFrame(() => chip.classList.add('in'));
    setTimeout(() => {
      chip.classList.add('out');
      setTimeout(() => chip.remove(), 320);
    }, 2200);
  }

  function remainingDeck(party) {
    if (!party) return [];
    return party.deck.filter((id) => !client.myVote(id));
  }

  function currentTitle(party) {
    const rem = remainingDeck(party);
    const id = rem[0];
    return id ? titlesById.get(id) : null;
  }

  function statusLabel(m) {
    const recent =
      m.lastAction && Date.now() - m.lastAction.at < 3500 ? m.lastAction : null;
    if (recent) return ACTION_LABEL[recent.action] || recent.action;
    if (m.status === 'matched') return 'matched';
    if (m.status === 'watching') return 'watching';
    if (m.status === 'invited') return 'invited';
    if (m.status === 'rating') return 'rating';
    return 'swiping…';
  }

  function renderStatus(party) {
    if (!statusEl || !party) return;
    statusEl.innerHTML = party.members
      .filter((m) => m.status !== 'invited')
      .map((m) => {
        const you = m.id === client.member.id ? '(you) ' : '';
        const label = statusLabel(m);
        const fresh =
          m.lastAction && Date.now() - m.lastAction.at < 3500
            ? `pill-flash ${m.lastAction.action}`
            : '';
        const dot =
          m.status === 'invited'
            ? 'dot invited'
            : m.status === 'swiping'
              ? 'dot busy'
              : 'dot';
        return `<div class="pill ${fresh}" data-member="${esc(m.id)}">
          <span class="avatar sm" style="background:${esc(m.color)}">${esc(memberInitial(m.name))}</span>
          <span class="pill-text">${you}${esc(m.name)} · ${esc(label)}</span>
          <span class="${dot}"></span>
        </div>`;
      })
      .join('');
    clearTimeout(statusClearTimer);
    const hasFresh = party.members.some(
      (m) => m.lastAction && Date.now() - m.lastAction.at < 3500
    );
    if (hasFresh) {
      statusClearTimer = setTimeout(() => {
        if (client.party) renderStatus(client.party);
      }, 3600);
    }
  }

  function renderRail(party) {
    if (!railEl || !party) return;
    const hits = party.matched
      .map((m) => {
        const t = titlesById.get(m.titleId);
        if (!t) return '';
        const isNew = m.titleId === lastMatchId ? ' is-new' : '';
        return `<button type="button" class="hit${isNew}" data-start="${esc(t.id)}">
          <div class="thumb ${esc(t.art)}"></div>
          <div>
            <p>${esc(t.title)}</p>
            <span>${m.count} of ${m.memberCount} members</span>
          </div>
        </button>`;
      })
      .join('');

    const top = party.matched[0];
    const topTitle = top ? titlesById.get(top.titleId) : null;
    const startLabel = topTitle
      ? `Start with ${topTitle.title}`
      : 'Need 2 matches to start';

    railEl.innerHTML = `
      <h4>Matched Tonight</h4>
      <div class="rail-hits">${hits || '<p class="rail-empty">Swipe hearts together — two matches land here. Agree in under a minute.</p>'}</div>
      <button type="button" class="btn btn-red start-bar" data-start-top ${topTitle ? '' : 'disabled'}>${esc(startLabel)}</button>
    `;

    railEl.querySelectorAll('[data-start]').forEach((el) => {
      el.addEventListener('click', () => onStartWatch(el.dataset.start));
    });
    const topBtn = railEl.querySelector('[data-start-top]');
    if (topBtn && topTitle) {
      topBtn.addEventListener('click', () => onStartWatch(topTitle.id));
    }
  }

  function showIdleHints() {
    const pass = deckEl.querySelector('[data-stamp="pass"]');
    const match = deckEl.querySelector('[data-stamp="match"]');
    const later = deckEl.querySelector('[data-stamp="later"]');
    [pass, match, later].forEach((el) => {
      if (!el) return;
      el.classList.add('hint');
      el.style.opacity = '';
    });
  }

  function setStamps(dx, dy) {
    const pass = deckEl.querySelector('[data-stamp="pass"]');
    const match = deckEl.querySelector('[data-stamp="match"]');
    const later = deckEl.querySelector('[data-stamp="later"]');
    const idle = Math.abs(dx) < 12 && Math.abs(dy) < 12;
    if (idle) {
      showIdleHints();
      return;
    }
    [pass, match, later].forEach((el) => el?.classList.remove('hint'));
    if (pass) pass.style.opacity = dx < -24 ? Math.min(1, Math.abs(dx) / 110) : 0;
    if (match) match.style.opacity = dx > 24 ? Math.min(1, dx / 110) : 0;
    if (later) later.style.opacity = dy < -24 ? Math.min(1, Math.abs(dy) / 90) : 0;
  }

  function renderCard(party) {
    if (!deckEl) return;
    const rem = remainingDeck(party);
    const title = currentTitle(party);
    const next = rem[1] ? titlesById.get(rem[1]) : null;
    const next2 = rem[2] ? titlesById.get(rem[2]) : null;

    if (leftEl) leftEl.textContent = `${rem.length} left`;
    if (nightEl && party) nightEl.textContent = party.nightName;
    actionsEl?.classList.toggle('is-disabled', !title);
    if (undoBtn) undoBtn.disabled = !history.length;

    if (!title) {
      shownTitleId = null;
      deckEl.innerHTML = `<div class="deck-empty"><h3>Deck clear</h3><p>Check Matched Tonight — or wait for friends.</p></div>`;
      return;
    }

    if (busy || drag || (shownTitleId === title.id && deckEl.querySelector('[data-front]'))) {
      return;
    }

    shownTitleId = title.id;
    deckEl.innerHTML = `
      ${next2 ? `<div class="card back"><div class="art ${esc(next2.art)}"></div></div>` : ''}
      ${next ? `<div class="card mid"><div class="art ${esc(next.art)}"></div></div>` : ''}
      <div class="card front" data-front>
        <div class="art ${esc(title.art)}"></div>
        <div class="stamp later hint" data-stamp="later">LATER</div>
        <div class="stamp pass hint" data-stamp="pass">PASS</div>
        <div class="stamp match hint" data-stamp="match">MATCH</div>
        <div class="meta">
          <h3>${esc(title.title)}</h3>
          <div class="row"><span class="maturity">${esc(title.maturity)}</span> ${esc(title.runtime)} · ${esc(title.genre)}</div>
        </div>
      </div>
    `;

    const front = deckEl.querySelector('[data-front]');
    bindDrag(front, title.id);
  }

  function bindDrag(front, titleId) {
    if (!front) return;
    const onDown = (e) => {
      if (busy) return;
      if (e.button != null && e.button !== 0) return;
      front.setPointerCapture?.(e.pointerId);
      drag = { titleId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      front.style.transition = 'none';
    };
    const onMove = (e) => {
      if (!drag) return;
      drag.dx = e.clientX - drag.x0;
      drag.dy = e.clientY - drag.y0;
      const rot = drag.dx / 28;
      front.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${rot}deg)`;
      setStamps(drag.dx, drag.dy);
    };
    const onUp = () => {
      if (!drag) return;
      const { dx, dy, titleId: id } = drag;
      drag = null;
      front.style.transition = 'transform .28s ease, opacity .28s ease';
      if (dx > 120) commit(id, 'match', front, 420);
      else if (dx < -120) commit(id, 'pass', front, -420);
      else if (dy < -100) commit(id, 'later', front, 0, -480);
      else {
        front.style.transform = '';
        showIdleHints();
      }
    };
    front.addEventListener('pointerdown', onDown);
    front.addEventListener('pointermove', onMove);
    front.addEventListener('pointerup', onUp);
    front.addEventListener('pointercancel', onUp);
    front.addEventListener('lostpointercapture', onUp);
  }

  function commit(titleId, action, front, tx = 0, ty = 0) {
    if (busy || !titleId) return;
    busy = true;
    history.push({ titleId, action });
    if (undoBtn) undoBtn.disabled = false;
    if (front) {
      front.style.transform = `translate(${tx}px, ${ty || -40}px) rotate(${tx / 20}deg)`;
      front.style.opacity = '0';
    }
    client.swipe(titleId, action);
    setTimeout(() => {
      busy = false;
      shownTitleId = null;
      render(client.party);
    }, 240);
  }

  function noteFriendSwipe(payload) {
    if (!payload || payload.memberId === client.member.id) return;
    if (payload.action === 'undo') {
      renderStatus(payload.state || client.party);
      renderRail(payload.state || client.party);
      return;
    }
    const name = payload.memberName || 'Friend';
    const title = titlesById.get(payload.titleId);
    const verb = ACTION_LABEL[payload.action] || payload.action;
    pushFeedChip(
      `<strong>${esc(name)}</strong> ${esc(verb)}${title ? ` · ${esc(title.title)}` : ''}`,
      payload.action || ''
    );

    const ghost = document.createElement('div');
    ghost.className = `ghost-stamp ${payload.action || 'match'}`;
    ghost.textContent = (payload.action || 'match').toUpperCase();
    deckEl?.appendChild(ghost);
    requestAnimationFrame(() => ghost.classList.add('fly'));
    setTimeout(() => ghost.remove(), 700);

    const party = payload.state || client.party;
    if (party) {
      renderStatus(party);
      renderRail(party);
    }
  }

  function render(party) {
    if (!party) return;
    renderStatus(party);
    renderRail(party);
    renderCard(party);
  }

  function reset() {
    history = [];
    drag = null;
    busy = false;
    shownTitleId = null;
    lastMatchId = null;
    feedEl.innerHTML = '';
    if (undoBtn) undoBtn.disabled = true;
  }

  actionsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || busy) return;
    const party = client.party;
    const title = currentTitle(party);
    if (!title) return;
    const action = btn.dataset.action;
    const front = deckEl.querySelector('[data-front]');
    if (action === 'match') commit(title.id, 'match', front, 420);
    if (action === 'pass') commit(title.id, 'pass', front, -420);
    if (action === 'later') commit(title.id, 'later', front, 0, -480);
  });

  undoBtn?.addEventListener('click', () => {
    if (!history.length || busy) return;
    const last = history.pop();
    const votes = client.party?.votes?.[last.titleId];
    if (votes) delete votes[client.member.id];
    client.undo(last.titleId);
    shownTitleId = null;
    if (undoBtn) undoBtn.disabled = !history.length;
    render(client.party);
  });

  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-on')) return;
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      actionsEl?.querySelector('[data-action="match"]')?.click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      actionsEl?.querySelector('[data-action="pass"]')?.click();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      actionsEl?.querySelector('[data-action="later"]')?.click();
    } else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undoBtn?.click();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undoBtn?.click();
    }
  });

  return {
    render,
    noteFriendSwipe,
    reset,
    celebrate(titleId) {
      lastMatchId = titleId;
      const title = titlesById.get(titleId);
      if (title) {
        pushFeedChip(`<strong>It's a match</strong> · ${esc(title.title)}`, 'match');
      }
    },
  };
}
