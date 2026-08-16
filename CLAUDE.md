# CLAUDE.md

Guidance for Claude Code (or any future agent) working in this repository.

## What this repo is

**Nova Focus** — a gamified, dark/futuristic focus app that turns "don't check
social media" into a mission-based game, plus a companion browser extension
that does real, network-level blocking of distracting *web* apps.

Two independent components, no shared backend, no build step:

```
app/                  Main web app (vanilla HTML/CSS/JS, localStorage)
  index.html
  styles.css
  app.js
extension/             Companion Chrome/Edge (MV3) extension
  manifest.json
  background.js         service worker: owns declarativeNetRequest rules + alarm-based timer
  popup.html/.js/.css    start/stop a shield session, pick blocklist targets
  blocked.html/.js/.css  page shown when a blocked site is redirected here
```

## Why two components

A website cannot block native mobile/desktop apps (WhatsApp, LINE, etc.) —
browsers have no OS-level permission for that. So the design is honest about
what's actually enforceable:

- **`app/`** is the game: XP, levels, ranks, streaks, badges, a mission timer,
  and a blocklist the user *commits* to. During an active mission it uses the
  Page Visibility API to detect tab/app switches ("breaches") and drains an
  Integrity meter — this is detection + gamified accountability, not a hard
  block.
- **`extension/`** is the enforcement layer for anything with a web
  surface: WhatsApp Web, LINE, Instagram, TikTok, X/Twitter, Facebook,
  YouTube, Discord, Reddit. It uses `declarativeNetRequest` dynamic rules to
  redirect matching navigations to a themed `blocked.html` while a shield
  session is active. This is real blocking, but only for the browser — it
  cannot touch native phone apps.

Don't blur this distinction when extending the project (e.g. don't imply the
web app itself blocks native apps).

## Running it

- **App**: no build step. Open `app/index.html` directly, or serve the
  `app/` folder with any static server (`npx serve app`) for a cleaner
  `file://`-free experience (needed for some browsers' localStorage/CORS
  quirks). State persists to `localStorage` under key `novafocus.state.v1`.
- **Extension**: `chrome://extensions` → enable Developer Mode → "Load
  unpacked" → select the `extension/` folder. Pin the "Nova Focus Shield"
  icon, open the popup to arm a session.

There is no npm/build tooling by design — keep it dependency-free unless a
feature genuinely requires a package.

## Conventions

- Vanilla JS only, ES2020+, no framework, no bundler. Keep `app.js` as a
  single file organized top-to-bottom: state/storage → mission runtime →
  DOM refs → per-view render functions → event wiring → init. If it grows
  past ~800 lines, that's the signal to split into modules — not before.
- Styling: CSS custom properties in `:root` (`app/styles.css`) define the
  palette (`--cyan`, `--violet`, `--red`, `--green`, `--amber`) and fonts
  (Orbitron for display/headers, Rajdhani for body, Share Tech Mono for
  numeric/HUD text). Reuse these tokens rather than hardcoding colors.
- All persistent state lives in `localStorage` (app) or `chrome.storage.local`
  (extension) — no server, no accounts, no telemetry. Keep it that way unless
  the user explicitly asks for sync/accounts.
- The extension's blocklist (`BLOCK_TARGETS` in `background.js`) and the
  app's default blocklist (`DEFAULT_BLOCKLIST` in `app.js`) are intentionally
  separate arrays — they aren't synced automatically. If you add a new
  default distracting site, add it in both places and keep the on/off
  defaults consistent.
- No secrets, no external APIs, no analytics. Google Fonts is the only
  external network dependency (`app/index.html` `<link>` tags); if that's
  ever a problem, self-host the fonts instead of removing the load-bearing
  dark/futuristic feel.

## Extending the game layer

Central places to touch when adding features:

- `ACHIEVEMENTS` array in `app.js` — badge id, name, desc, icon, and a
  `test(state)` predicate. Add new stat fields to `state.stats` in
  `defaultState()` first if the predicate needs new data.
- `RANKS` / `rankForLevel()` / `xpNeeded()` — leveling curve and rank titles.
- `finishMission()` — where XP, streaks, and log entries are computed on
  mission completion/failure. Keep failure paths (`abort`, `integrity`
  depletion) logged distinctly from success.

## Things to be careful about

- `beforeUnloadHandler` and `requestFullscreen()` in Lockdown Mode are meant
  to be mildly friction-y, never data-destructive or truly inescapable —
  don't add anything that traps the user without an obvious exit (the Abort
  button must always work).
- The extension's `declarativeNetRequest` rule IDs in `background.js` are
  fixed integers per target — if you add a target, give it a new unused id
  rather than reusing one.
- Don't add analytics, remote logging, or anything that phones home. The
  whole point of this project is a private, local, no-account focus tool.
