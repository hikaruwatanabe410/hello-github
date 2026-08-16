# Hello GitHub
Learning Git

This is my first repository. I'm learning Git.
Built on a Mac mini M4.

## Experimental section
I am learning branches
If this ends up being a bad idea, I can throw it away.

## Hobbies
- Coding
- Reading

## Skills I'm learning
-Coding
-Soccer
-Photography

## Goals
- Master Git and GitHub
- Write my first Python project
- Contribute to open source

## Project: Nova Focus 🛡️⚡

A dark, futuristic, gamified focus app to help you stay off social media
(WhatsApp, LINE, Instagram, TikTok, etc.) while you work.

- **`app/`** — the main app. A sci-fi "mission control" dashboard: pick a
  focus duration, arm your distraction blocklist, and run the mission. You
  earn XP and level up (Initiate → Operative → Specialist → Vanguard →
  Sentinel → Overmind), build daily streaks, and unlock badges. If you switch
  tabs/apps mid-mission it's logged as a "breach" and drains an Integrity
  meter — no build step, just open `app/index.html` in a browser.
- **`extension/`** — an optional companion Chrome/Edge extension that does
  *real* blocking: while a shield session is active it redirects navigation
  to WhatsApp Web, LINE, Instagram, TikTok, X/Twitter, Facebook, YouTube,
  Discord, and Reddit to a themed "access blocked" page. Load it unpacked via
  `chrome://extensions` → Developer Mode → Load unpacked → select
  `extension/`.

**Heads up on scope:** a website or browser extension can't reach into your
phone and block the native WhatsApp/LINE apps — that needs OS-level
permissions no browser grants. The web app gamifies commitment + detects
when you've wandered off; the extension genuinely blocks the *web* versions
of these platforms. See `CLAUDE.md` for the full architecture notes.