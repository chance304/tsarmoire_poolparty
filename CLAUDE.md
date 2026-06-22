# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page invitation microsite for **T's Armoire Summer Club** (June 26, 1PM) — a poolside takeover at the Moxy Hotel by T's Armoire. Deployed via GitHub Pages to `launch.tsarmoiremanufacturing.com.np` (CNAME). Registration is open/interest-based, not capacity-limited.

No build step, no dependencies, no test suite.

## File structure

```
index.html              — markup only (no inline styles or scripts)
bg_info.jpeg            — confirmed background photo (pool party shot)
assets/
  style.css             — all styles, design tokens, responsive breakpoints
  app.js                — SPA transitions, form validation, Apps Script POST
apps-script/
  Code.gs               — Google Apps Script backend (Sheet write + confirmation email)
CNAME                   — GitHub Pages custom domain
README.md               — project overview and local dev instructions
DEPLOYMENT.md           — step-by-step Apps Script + GitHub Pages deploy guide
```

## Development

Open `index.html` directly in a browser. No server required; all assets are local or loaded from Google Fonts CDN.

To preview on a local server (avoids CORS edge cases):
```bash
python3 -m http.server 8080
```

## Architecture

`index.html` is a **5-page** single-page app with a curtain-wipe transition system:

- **Pages** (`#p0`–`#p4`): absolutely positioned, toggled via `.active` class
- **Transitions**: CSS `scaleY` curtain (`#curtain`) with a 3-phase JS timer sequence in `go(dir)` — defined in `assets/app.js`
- **Stagger animations**: `.entering` class triggers CSS `@keyframes sIn` with `nth-child` delays on `.s` elements — defined in `assets/style.css`
- **Chrome**: wordmark, page counter, progress bar, and nav arrows update via `syncChrome()`

### Page index

| cur | ID  | Page | Nav behaviour |
|-----|-----|------|---------------|
| 0   | #p0 | Opening | forward arrow visible |
| 1   | #p1 | The Experience | forward arrow visible |
| 2   | #p2 | Social Consent | forward arrow hidden — Yes/No buttons only |
| 3   | #p3 | Registration Form | forward arrow hidden — submit only; scrollable |
| 4   | #p4 | Thank You | both nav arrows hidden |

Keyboard (ArrowRight/Enter) and swipe navigation are disabled on pages 2 and 3.

## Backend

Registrations POST to a Google Apps Script Web App (`SCRIPT_URL` in `assets/app.js`).  
The script source lives in `apps-script/Code.gs`.  
See `DEPLOYMENT.md` for setup and re-deploy instructions.

Current deployment is on a **personal account** pending migration to the T's Armoire org account — update `SCRIPT_URL` in `assets/app.js` after the org deployment is complete.

**Fields sent in POST body:**

```
id, name, email, instagram, tiktok, phone, social_consent, registered_at
```

**Sheet columns:** ID · Name · Email · Instagram · TikTok · Phone · Registered At · Social Consent

## Design tokens

- Background: `#f6f4f0` (off-white warm — matches tsarmoire.com)
- Background image: `bg_info.jpeg` (repo root) — pool party photo, positioned `80% center` on desktop, `65% center` on mobile; layered warm gradient overlay for legibility
- Primary text: `#151514` (near-black warm)
- Accent (decorative): `#Daccb4` (warm tan — rules, progress bar)
- Accent (tags/focus): `#7a6948` / `#baac8a` (dark earth tones)
- Font: **Jost** (200/300/400/500 + italic 300) via Google Fonts

## Known TODOs

- `SCRIPT_URL` in `assets/app.js` points to a personal account deployment — redeploy from org account per `DEPLOYMENT.md` and update the URL
- Replace `GA_MEASUREMENT_ID` in `index.html` with the real Google Analytics property ID
- Replace `og:image` placeholder in `index.html` with the confirmed event photo
