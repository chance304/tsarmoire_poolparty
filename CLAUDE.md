# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page slot reservation microsite for the **TSA Café** 3-day event (May 8, 9 & 10) by T's Armoire. Deployed via GitHub Pages to `launch.tsarmoiremanufacturing.com.np` (CNAME).

No build step, no dependencies, no test suite.

## File structure

```
index.html              — markup only (no inline styles or scripts)
assets/
  style.css             — all styles, design tokens, responsive breakpoints
  app.js                — SPA transitions, slot picker logic, form validation, Apps Script GET/POST
  bg_info.jpeg          — confirmed background photo (TSA founder in studio, portrait)
apps-script/
  Code.gs               — Google Apps Script backend (slot availability doGet, reservations doPost)
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
| 2   | #p2 | What to Expect | forward arrow hidden — "Reserve your spot →" button only |
| 3   | #p3 | Slot Reservation | forward arrow hidden — date/slot picker then submit; scrollable |
| 4   | #p4 | Request Received | both nav arrows hidden |

Keyboard (ArrowRight/Enter) and swipe navigation are disabled on pages 2 and 3.

### Slot picker flow (#p3)

Four-step progressive reveal on a single scrollable page:
1. **Date buttons** — May 8 / May 9 / May 10 (always visible)
2. **Time slot buttons** — 7 hourly slots, revealed after date selected; slots get `.full` class and are `disabled` based on party type: total ≥ `SLOT_CAPACITY`, or solo ≥ `SOLO_CAP` (when "Just me" is selected), or plus_one ≥ `PLUS_ONE_CAP` (when "With a +1" is selected)
3. **Party type** — "Just me" (solo) / "With a +1" (plus_one) — required, revealed with the form; changing party type immediately re-evaluates slot availability
4. **Details form** — name (min 2 chars, required), email (required), WhatsApp number (min 7 digits, required), Instagram, TikTok (optional); revealed after slot selected

Slot availability is fetched via `doGet(?action=slots)` every time the user enters #p3. Greying is **party-type-aware** — a slot can be available for +1 but greyed for solo if the single solo cap is taken.

## Backend

Reservations use a Google Apps Script Web App (`SCRIPT_URL` in `assets/app.js`).  
The script source lives in `apps-script/Code.gs`.  
See `DEPLOYMENT.md` for setup and re-deploy instructions.

`SCRIPT_URL` must be updated after deploying the `Code.gs` to the T's Armoire org account.

**`doGet(?action=slots)` — slot availability:**  
Returns confirmed booking counts per date, time slot, and party type, plus the capacity caps. The frontend greys slots based on party type and the returned caps.  
Response shape:
```json
{
  "ok": true,
  "slots": {
    "May 8": {
      "10:30 AM – 11:30 AM": { "solo": 1, "plus_one": 3, "total": 4 }
    }
  },
  "caps": { "solo": 1, "plus_one": 4, "total": 5 }
}
```

**`doPost` — reservation:**  
Fields sent in POST body:

```
id, name, email, phone, instagram, tiktok, party_type, date, time_slot, registered_at
```

All submissions are accepted (no hard rejection). The backend assigns `Status: Confirmed` or `Status: Waitlist` based on current confirmed counts. A `reason` field accompanies Waitlist responses (`solo_full`, `plus_one_full`, `slot_full`). A confirmation or waitlist email is sent automatically via `MailApp`.

**Sheet name:** `Reservations`  
**Sheet columns:** ID · Name · Email · Phone · Instagram · TikTok · Date · Time Slot · Party Type · Status · Submitted At

**Capacity constants (in `Code.gs`):**
- `SLOT_CAPACITY = 5` — max confirmed bookings per date+slot (total)
- `SOLO_CAP = 1` — max confirmed solo bookings per date+slot
- `PLUS_ONE_CAP = 4` — max confirmed +1 bookings per date+slot

Status logic (`_determineStatus`): if total confirmed ≥ `SLOT_CAPACITY` → `Waitlist (slot_full)`; if solo and solo confirmed ≥ `SOLO_CAP` → `Waitlist (solo_full)`; if plus_one and plus_one confirmed ≥ `PLUS_ONE_CAP` → `Waitlist (plus_one_full)`; otherwise → `Confirmed`. The frontend shows a reason-specific nudge on Waitlist, letting guests pick another slot or explicitly join the waitlist.

## Design tokens

- Background: `#f6f4f0` (off-white warm — matches tsarmoire.com)
- Background image: `assets/bg_info.jpeg` — portrait photo, positioned `80% center` on desktop, `65% center` on mobile; layered warm gradient overlay for legibility
- Primary text: `#151514` (near-black warm)
- Accent (decorative): `#Daccb4` (warm tan — rules, progress bar)
- Accent (tags/focus): `#7a6948` / `#baac8a` (dark earth tones)
- Font: **Jost** (200/300/400/500 + italic 300) via Google Fonts

## Known TODOs

- `SCRIPT_URL` in `assets/app.js` needs updating after deploying `Code.gs` to the org account — see `DEPLOYMENT.md`
- Replace `GA_MEASUREMENT_ID` in `index.html` with the real Google Analytics property ID
- Replace `og:image` placeholder in `index.html` with the confirmed event photo
- Update `CNAME` if this deployment uses a different domain
