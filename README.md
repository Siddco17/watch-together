# Watch Together — Hackathon Demo

Netflix-style **Watch Together** prototype: pick Watch Party → **Party mood** → invite friends → **Title Match** swipe → synced playback with **Quiet (spoiler-safe)** → rate the night.

Vanilla HTML/CSS/JS frontend + **Express + Socket.io** backend (in-memory party rooms).

**Finale thesis:** *Tonight is a match, not a debate.* Full pitch, timed demo, and Q&A: see **[PITCH.md](PITCH.md)**.

## Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Judge demo (one laptop) — aim for play in &lt;90s

1. **Who's Watching?** → **Watch Party**
2. Pick **Party mood** (Comfort / Thrills / New this week)
3. **Add** 2–3 friends → **Start Party**
4. Swipe: pass / later / match (bots help fill **Matched Tonight**)
5. **Start with…** → reactions · **Quiet · spoiler-safe**
6. **End night** → party score · next-watch leftovers

## Two-browser sync

1. Host: Start Party and copy the code on the match header
2. Guest: Watch Party → paste code → **Join**
3. Shared rail, playback, chat, ratings

## Local media

Clips in `media/clips/` (Emily, Bridgerton, Raazi, Voicemails) and posters in `media/posters/`.  
MP4s are stored with **Git LFS** — after cloning, run `git lfs pull` if the videos are missing.
