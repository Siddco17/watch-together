# Watch Together — Finale Pitch Pack

**Thesis (say this once, early):**  
*Tonight is a match, not a debate — friends agree on what to watch in under a minute, without a group chat.*

**Core product answer to the brief’s pro tip:** **Title Match** (parallel swipe → two hearts → Matched Tonight → Start). The player proves it’s native; Match is the innovation judges asked for.

---

## 8-minute pitch outline

| Time | Segment | What to say / show |
|---|---|---|
| 0:00–1:00 | **Problem** | Friends open Netflix and stall: taste clash, 40-minute chats, someone always caves. Deciding is the friction—not finding a player. |
| 1:00–1:30 | **Insight** | Don’t turn watching into a vote thread. Capture preference **in parallel**, like moderating a playlist. |
| 1:30–5:00 | **Live demo — Title Match** | Watch Party → **Party mood** → invite → Start → swipe Pass / Later / Match → rail fills → **Start with…** Spend most of the clock here. |
| 5:00–6:15 | **Watch session** | Synced play, emoji reactions, **Quiet (spoiler-safe presence)** so chat/reactions don’t steal the scene. |
| 6:15–6:45 | **Wrap** | Rate together → one party score → leftovers for next Friday. |
| 6:45–7:45 | **Feasibility + innovation** | Mood-filters the deck; ≥2 matches = on the night; Socket.io rooms on existing profiles/catalog/player; no new DRM stack. |
| 7:45–8:00 | **Close** | Repeat thesis. Invite Q&A. |

---

## Judge demo script (~90s to first play)

**Solo laptop (primary)**

1. Open app → **Watch Party** profile  
2. Pick **Party mood** chip (Comfort)  
3. **Add** 2–3 friends → **Start Party**  
4. Swipe **♥** on 1–2 titles (bots help fill **Matched Tonight**)  
5. Click **Start with…** → play starts  
6. Hit one reaction → toggle **Quiet** → show chat if Quiet Off  
7. **End night** → stars → party score  

**Optional 2-tab (feasibility proof, ~30s)**

1. Host copies party code from match header  
2. Guest: Watch Party → paste code → **Join**  
3. Both see same rail / playback  

**Rehearsal goal:** From profile click to video playing in **under 90 seconds**. Time yourself twice before pitch.

---

## Named innovations (brief “optional” picks)

| Brief option | How we name it in product | Where it shows |
|---|---|---|
| Personalized watch party themes / moods | **Party mood** | Comfort / Thrills / New this week chips → filters the swipe deck |
| Spoiler-safe reactions | **Quiet · spoiler-safe** | Quiet On dims reactions & keeps presence calm; Quiet Off opens party chat |

We are **not** pitching live polls or a new group-recs engine in this finale window.

---

## Q&A cheat sheet (feasibility)

**How does agreement work?**  
Everyone swipes the same vibe-filtered deck in parallel. A title needs **≥2 Match** votes to land on **Matched Tonight**. Host starts from the rail—no chat debate.

**How does Party mood work?**  
Mood is chosen before Start Party. Server builds the deck from titles tagged with that vibe (`Comfort` / `Thrills` / `New this week`).

**Is this buildable on Netflix?**  
Yes as a product surface: uses **profiles**, **catalog**, and **player**. Sync is room-based (Socket.io in this prototype). Clips stand in for licensed streams—no custom DRM.

**Why not just a shared player?**  
Shared playback doesn’t solve *what* to watch. Title Match is the decision layer; the couch player is the payoff.

**What about spoilers / distraction?**  
**Quiet** keeps reactions low-key by default so late joiners and tense scenes stay watchable; chat is opt-in when Quiet is off.

**Tech stack (if asked)?**  
Vanilla HTML/CSS/JS + Express + Socket.io, in-memory party rooms, invite codes, two-browser sync.

---

## Scoring reminders

- **Creativity 25%** → Title Match + Party mood + Quiet  
- **UX 25%** → Short path to Start; parallel preference  
- **Visual 20%** → Netflix-native screens you already have  
- **Feasibility 20%** → Existing surfaces + room sync  
- **Clarity 10%** → Thesis line + demo heavy on Match  

**Do not** open the pitch on volume, CC, or fullscreen.
