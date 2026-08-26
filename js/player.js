import { SAMPLE_VIDEO, SAMPLE_CHAT, formatTime, memberInitial, videoForTitle } from './data.js';

export function createPlayerUI({ root, client, titlesById, onEnd, onBack }) {
  const video = root.querySelector('video');
  const syncEl = root.querySelector('[data-sync]');
  const quietBtn = root.querySelector('[data-quiet]');
  const reactBar = root.querySelector('[data-react-bar]');
  const reactLayer = root.querySelector('[data-react-layer]');
  const playBtn = root.querySelector('[data-play]');
  const playIcon = root.querySelector('[data-play-icon]');
  const backBtn = root.querySelector('[data-back10]');
  const fwdBtn = root.querySelector('[data-fwd10]');
  const volumeBtn = root.querySelector('[data-volume]');
  const volumeIcon = root.querySelector('[data-volume-icon]');
  const volumeWrap = root.querySelector('[data-volume-wrap]');
  const volumeRange = root.querySelector('[data-volume-range]');
  const micBtn = root.querySelector('[data-mic]');
  const micIcon = root.querySelector('[data-mic-icon]');
  const chatToggle = root.querySelector('[data-chat-toggle]');
  const chatPanel = root.querySelector('[data-chat-panel]');
  const chatClose = root.querySelector('[data-chat-close]');
  const chatMessages = root.querySelector('[data-chat-messages]');
  const chatForm = root.querySelector('[data-chat-form]');
  const chatInput = root.querySelector('[data-chat-input]');
  const ccBtn = root.querySelector('[data-cc]');
  const ccIcon = root.querySelector('[data-cc-icon]');
  const speedBtn = root.querySelector('[data-speed]');
  const fullscreenBtn = root.querySelector('[data-fullscreen]');
  const progress = root.querySelector('[data-progress]');
  const scrub = root.querySelector('[data-scrub]');
  const fill = root.querySelector('[data-fill]');
  const timeEl = root.querySelector('[data-time]');
  const titleEl = root.querySelector('[data-title]');
  const endBtn = root.querySelector('[data-end]');
  const backBtnNav = root.querySelector('[data-back]');
  const avatarsEl = root.querySelector('[data-avatars]');
  const subsEl = root.querySelector('[data-subs]');
  const playerEl = root.querySelector('.player') || root;
  const chromeEl = root.querySelector('[data-chrome]') || root.querySelector('.chrome');

  let applyingRemote = false;
  let quiet = true;
  let lastCmd = 0;
  let volumeLevel = 1;
  let micOn = false;
  let micStream = null;
  let chatOpen = false;
  let ccOn = false;
  let seededChat = false;
  const chatLog = [];
  const seenChatIds = new Set();
  let cues = [];
  const speeds = [1, 1.25, 1.5, 2];
  let speedIdx = 0;
  let chromeHideTimer = null;
  const CHROME_IDLE_MS = 2600;

  if (video) {
    video.src = SAMPLE_VIDEO;
    video.playsInline = true;
    video.volume = volumeLevel;
  }

  function wakeChrome(sticky = false) {
    playerEl.classList.add('is-awake');
    clearTimeout(chromeHideTimer);
    if (sticky || chatOpen) return;
    chromeHideTimer = setTimeout(() => {
      if (chatOpen) return;
      playerEl.classList.remove('is-awake');
    }, CHROME_IDLE_MS);
  }

  function sleepChrome() {
    if (chatOpen) return;
    clearTimeout(chromeHideTimer);
    playerEl.classList.remove('is-awake');
  }

  function loadTitleVideo(title, seekTo = 0, paused = true) {
    if (!video || !title) return;
    const src = videoForTitle(title);
    const abs = new URL(src, location.origin).href;
    const changed = !video.currentSrc || video.currentSrc !== abs;
    if (changed) {
      video.src = src;
      video.load();
    }
    const applySeek = () => {
      applyingRemote = true;
      try {
        video.currentTime = seekTo || 0;
        if (paused) video.pause();
        else video.play().catch(() => {});
      } finally {
        applyingRemote = false;
        updateChrome();
        updateSubs();
      }
    };
    if (changed) {
      video.addEventListener('loadedmetadata', applySeek, { once: true });
    } else {
      applySeek();
    }
  }

  function parseVtt(text) {
    const out = [];
    const blocks = text.replace(/\r/g, '').split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.trim().split('\n').filter(Boolean);
      if (!lines.length || lines[0] === 'WEBVTT') continue;
      const timeLine = lines.find((l) => l.includes('-->'));
      if (!timeLine) continue;
      const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim());
      const textLines = lines.slice(lines.indexOf(timeLine) + 1);
      out.push({
        start: vttTime(startRaw),
        end: vttTime(endRaw.split(/\s/)[0]),
        text: textLines.join('\n'),
      });
    }
    return out;
  }

  function vttTime(s) {
    const parts = String(s).trim().split(':');
    if (parts.length === 3) {
      return (
        Number(parts[0]) * 3600 +
        Number(parts[1]) * 60 +
        Number(parts[2].replace(',', '.'))
      );
    }
    if (parts.length === 2) {
      return Number(parts[0]) * 60 + Number(parts[1].replace(',', '.'));
    }
    return 0;
  }

  async function loadCues() {
    try {
      const res = await fetch('/media/sample-en.vtt');
      if (!res.ok) return;
      cues = parseVtt(await res.text());
    } catch (_) {
      cues = [];
    }
  }
  loadCues();

  function updateSubs() {
    if (!subsEl) return;
    if (!ccOn || !video) {
      subsEl.textContent = '';
      return;
    }
    const t = video.currentTime || 0;
    const cue = cues.find((c) => t >= c.start && t <= c.end);
    subsEl.textContent = cue ? cue.text : '';
  }

  function titleOf(party) {
    const id = party?.playback?.titleId;
    return id ? titlesById.get(id) : null;
  }

  function renderMeta(party) {
    const t = titleOf(party);
    if (titleEl && t) titleEl.textContent = t.title;
    if (avatarsEl && party) {
      const members = party.members.filter((m) => !m.left && m.status !== 'invited');
      avatarsEl.innerHTML = members
        .map(
          (m) =>
            `<span class="avatar sm party-avatar" style="background:${m.color}" data-name="${escapeHtml(m.name)}" title="${escapeHtml(m.name)}" aria-label="${escapeHtml(m.name)}">${memberInitial(m.name)}<span class="avatar-tip">${escapeHtml(m.name)}</span></span>`
        )
        .join('');
      const label = root.querySelector('[data-couch-label]');
      if (label) {
        const n = members.length;
        label.textContent =
          n <= 1 ? 'The couch • Just you' : n <= 3 ? 'The couch • All here' : `The couch • ${n} here`;
      }
    }
  }

  function updateChrome() {
    if (!video) return;
    const dur = video.duration || 0;
    const cur = video.currentTime || 0;
    const pct = dur ? (cur / dur) * 100 : 0;
    if (fill) fill.style.width = pct + '%';
    if (scrub) scrub.style.left = pct + '%';
    if (timeEl) timeEl.textContent = formatTime(dur || 0);
    if (syncEl) syncEl.textContent = `You're all at ${formatTime(cur)}`;
    if (playIcon) playIcon.textContent = video.paused ? 'play_arrow' : 'pause';
  }

  function sendCommand(partial) {
    const now = Date.now();
    if (now - lastCmd < 40) return;
    lastCmd = now;
    client.playerCommand({
      t: video?.currentTime ?? 0,
      paused: video?.paused ?? true,
      titleId: client.party?.playback?.titleId,
      ...partial,
    });
  }

  function applySync(playback) {
    if (!video || !playback) return;
    const t = playback.titleId ? titlesById.get(playback.titleId) : null;
    if (t) {
      const src = videoForTitle(t);
      const abs = new URL(src, location.origin).href;
      if (!video.currentSrc || video.currentSrc !== abs) {
        loadTitleVideo(t, playback.t || 0, playback.paused !== false);
        return;
      }
    }
    applyingRemote = true;
    const target = playback.t || 0;
    if (Math.abs(video.currentTime - target) > 0.45) {
      video.currentTime = target;
    }
    if (playback.paused && !video.paused) video.pause();
    if (!playback.paused && video.paused) {
      video.play().catch(() => {});
    }
    applyingRemote = false;
    updateChrome();
    updateSubs();
  }

  function burst(emoji) {
    if (quiet || !reactLayer || !emoji) return;
    const el = document.createElement('div');
    el.className = 'react-float';
    el.textContent = emoji;
    el.style.left = 55 + Math.random() * 30 + '%';
    el.style.top = 35 + Math.random() * 25 + '%';
    reactLayer.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function setChatOpen(open) {
    chatOpen = open;
    if (chatPanel) chatPanel.hidden = !open;
    chatToggle?.classList.toggle('active', open);
    chatToggle?.setAttribute('aria-pressed', String(open));
    if (open) {
      seedSampleChat();
      renderChatLog();
      setTimeout(() => chatInput?.focus(), 30);
      wakeChrome(true);
    } else {
      wakeChrome();
    }
  }

  function seedSampleChat() {
    if (seededChat) return;
    SAMPLE_CHAT.forEach((msg) =>
      appendChat({
        ...msg,
        id: `sample-${msg.memberId}`,
        at: Date.now(),
      })
    );
    seededChat = true;
  }

  function renderChatLog() {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    chatLog.forEach((msg) => paintChatRow(msg));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function paintChatRow(msg) {
    if (!chatMessages || !msg?.text) return;
    const row = document.createElement('div');
    row.className = 'chat-row';
    if (msg.memberId === client.member.id) row.classList.add('mine');
    row.innerHTML = `<b>${escapeHtml(msg.name || 'Guest')}</b><span>${escapeHtml(msg.text)}</span>`;
    chatMessages.appendChild(row);
  }

  function appendChat(msg) {
    if (!msg?.text) return;
    const id =
      msg.id ||
      `${msg.memberId || 'x'}-${msg.at || Date.now()}-${String(msg.text).slice(0, 24)}`;
    if (seenChatIds.has(id)) return;
    seenChatIds.add(id);
    const entry = { ...msg, id };
    chatLog.push(entry);
    if (chatOpen) {
      paintChatRow(entry);
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function sendChatMessage(text) {
    const clean = String(text || '').trim().slice(0, 280);
    if (!clean) return;
    const localId = `local-${client.member.id}-${Date.now()}`;
    appendChat({
      id: localId,
      text: clean,
      memberId: client.member.id,
      name: client.member.name || 'You',
      at: Date.now(),
    });
    client.sendChat(clean, localId);
    if (chatInput) chatInput.value = '';
    if (!chatOpen) setChatOpen(true);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function syncVolumeUi() {
    if (!video) return;
    const level = video.muted ? 0 : video.volume;
    if (volumeRange) volumeRange.value = String(Math.round(level * 100));
    if (!volumeIcon) return;
    if (level === 0 || video.muted) volumeIcon.textContent = 'volume_off';
    else if (level < 0.4) volumeIcon.textContent = 'volume_down';
    else volumeIcon.textContent = 'volume_up';
  }

  function setVolume(level) {
    if (!video) return;
    volumeLevel = Math.min(1, Math.max(0, level));
    video.volume = volumeLevel;
    video.muted = volumeLevel === 0;
    syncVolumeUi();
  }

  function setCc(on) {
    ccOn = on;
    if (ccIcon) ccIcon.textContent = on ? 'closed_caption' : 'closed_caption_off';
    ccBtn?.classList.toggle('active', on);
    ccBtn?.setAttribute('aria-pressed', String(on));
    updateSubs();
  }

  async function setMic(on) {
    if (on) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micOn = true;
      } catch (_) {
        micOn = false;
        micStream = null;
        alert('Microphone permission denied or unavailable.');
      }
    } else {
      micStream?.getTracks().forEach((t) => t.stop());
      micStream = null;
      micOn = false;
    }
    if (micIcon) micIcon.textContent = micOn ? 'mic' : 'mic_off';
    micBtn?.classList.toggle('active', micOn);
    micBtn?.setAttribute('aria-pressed', String(micOn));
    client.setMic?.(micOn);
  }

  video?.addEventListener('timeupdate', () => {
    updateChrome();
    updateSubs();
  });
  video?.addEventListener('play', () => {
    if (!applyingRemote) sendCommand({ paused: false });
    updateChrome();
  });
  video?.addEventListener('pause', () => {
    if (!applyingRemote) sendCommand({ paused: true });
    updateChrome();
  });

  playBtn?.addEventListener('click', () => {
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  });
  backBtn?.addEventListener('click', () => {
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 10);
    sendCommand({ t: video.currentTime, paused: video.paused });
  });
  fwdBtn?.addEventListener('click', () => {
    if (!video) return;
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    sendCommand({ t: video.currentTime, paused: video.paused });
  });

  volumeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!video) return;
    if (video.muted || video.volume === 0) {
      video.muted = false;
      setVolume(volumeLevel > 0 ? volumeLevel : 1);
    } else {
      volumeLevel = video.volume || volumeLevel;
      setVolume(0);
    }
  });

  volumeRange?.addEventListener('input', (e) => {
    e.stopPropagation();
    const v = Number(volumeRange.value) / 100;
    setVolume(v);
  });

  volumeRange?.addEventListener('pointerdown', (e) => e.stopPropagation());
  volumeWrap?.addEventListener('mouseenter', () => volumeWrap.classList.add('is-open'));
  volumeWrap?.addEventListener('mouseleave', () => volumeWrap.classList.remove('is-open'));

  document.addEventListener('click', (e) => {
    if (!volumeWrap?.contains(e.target)) volumeWrap?.classList.remove('is-open');
  });

  micBtn?.addEventListener('click', () => {
    setMic(!micOn);
  });

  chatToggle?.addEventListener('click', () => setChatOpen(!chatOpen));
  chatClose?.addEventListener('click', () => setChatOpen(false));

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendChatMessage(chatInput?.value);
  });

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(chatInput.value);
    }
  });

  ccBtn?.addEventListener('click', () => setCc(!ccOn));

  speedBtn?.addEventListener('click', () => {
    if (!video) return;
    speedIdx = (speedIdx + 1) % speeds.length;
    video.playbackRate = speeds[speedIdx];
    speedBtn.title = `Speed ${speeds[speedIdx]}x`;
  });

  fullscreenBtn?.addEventListener('click', () => {
    const el = root.querySelector('.player') || root;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  progress?.addEventListener('click', (e) => {
    if (!video?.duration) return;
    const rect = progress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
    sendCommand({ t: video.currentTime, paused: video.paused });
  });

  quietBtn?.addEventListener('click', () => {
    quiet = !quiet;
    quietBtn.classList.toggle('on', quiet);
    quietBtn.textContent = quiet ? 'Quiet · spoiler-safe' : 'Quiet Off · chat open';
    reactBar?.classList.toggle('is-quiet', quiet);
    // Quiet Off reveals party chat (spoiler-safe default is On)
    setChatOpen(!quiet);
  });

  reactBar?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-react]');
    if (!btn) return;
    const icon = btn.dataset.react;
    client.sendReact(icon);
    burst(icon);
  });

  endBtn?.addEventListener('click', () => {
    video?.pause();
    setMic(false);
    setChatOpen(false);
    onEnd?.();
  });

  backBtnNav?.addEventListener('click', () => {
    video?.pause();
    setChatOpen(false);
    onBack?.();
  });

  setInterval(updateChrome, 500);

  playerEl.addEventListener('mousemove', () => wakeChrome());
  playerEl.addEventListener('pointerdown', () => wakeChrome());
  playerEl.addEventListener('touchstart', () => wakeChrome(), { passive: true });
  playerEl.addEventListener('mouseleave', () => sleepChrome());
  chromeEl?.addEventListener('mousemove', () => wakeChrome());
  chromeEl?.addEventListener('focusin', () => wakeChrome(true));

  return {
    renderMeta,
    applySync,
    burst,
    appendChat,
    prepare(party) {
      renderMeta(party);
      const t = titleOf(party);
      loadTitleVideo(t, party?.playback?.t || 0, party?.playback?.paused !== false);
      updateChrome();
      seededChat = false;
      chatLog.length = 0;
      seenChatIds.clear();
      if (chatMessages) chatMessages.innerHTML = '';
      if (quietBtn) {
        quiet = true;
        quietBtn.classList.add('on');
        quietBtn.textContent = 'Quiet · spoiler-safe';
        reactBar?.classList.add('is-quiet');
      }
      setChatOpen(false);
      setCc(false);
      setMic(false);
      setVolume(1);
      wakeChrome();
    },
  };
}
