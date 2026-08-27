# Watch Together — Hackathon Demo

Netflix-style **Watch Together** prototype: pick Watch Party → **Party mood** → invite friends → **Title Match** swipe → synced playback with **Quiet (spoiler-safe)** → rate the night.

Vanilla HTML/CSS/JS frontend + **Express + Socket.io** backend (in-memory party rooms).

**Finale thesis:** *Tonight is a match, not a debate.* Full pitch, timed demo, and Q&A: see **[PITCH.md](PITCH.md)**.

## On another laptop

```bash
git clone https://github.com/siddco17/watch-together.git
cd watch-together
git lfs install
git lfs pull
npm install
```

Need [Node.js 18+](https://nodejs.org) and [Git LFS](https://git-lfs.com) (the clips are stored with LFS).

**Start for a presentation**

- Mac: double-click **Start Demo.command**
- Windows: double-click **Start Demo.bat**
- Or in a terminal: `npm run present`

That starts the server and opens [http://localhost:3000](http://localhost:3000).

**Clickable opener:** double-click **Watch Together.html**. If the demo is already running it jumps straight in; if not, use Start Demo first, then click **Open presentation**.

Leave the Start Demo window open during the pitch. Close it to stop.

## Run (terminal)

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

Posters live in `media/posters/` (Enola Holmes, Always Be My Maybe, The Adam Project, Red Notice, Raazi, Voicemails).  
Clips in `media/clips/` (Raazi, Voicemails) plus short preview bumpers in `media/previews/` until the Netflix scene clips are added.  
MP4s in `media/clips/` are stored with **Git LFS** — after cloning, run `git lfs pull` if the videos are missing.
