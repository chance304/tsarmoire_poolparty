# TSA CAFÉ — Slot Reservation Microsite

Slot reservation microsite for the **TSA Café** 3-day event (May 8, 9 & 10) by T's Armoire.  
Live at: `launch.tsarmoiremanufacturing.com.np`

---

## What it is

A 5-page single-page app with a curtain-wipe transition system. Visitors move through an opening page, the event story, a "What to Expect" content page, a date + time slot picker with a details form, and a request-received confirmation page. Reservations are saved to a Google Sheet and the team confirms each booking manually via WhatsApp.

## File structure

```
index.html          — markup only, no inline styles or scripts
assets/
  style.css         — all styles and responsive breakpoints
  app.js            — transitions, slot picker logic, form validation, Apps Script POST/GET
  bg_info.jpeg      — confirmed background photo (TSA founder in studio)
apps-script/
  Code.gs           — backend: slot availability (doGet), reservations (doPost)
CNAME               — GitHub Pages custom domain
DEPLOYMENT.md       — step-by-step deploy guide (Apps Script + GitHub Pages)
```

## Local development

Open `index.html` directly in a browser — no build step or server required.

For a local server (avoids CORS edge cases):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploying changes

1. Edit files, verify locally
2. `git add` + `git commit` + `git push origin main`
3. GitHub Pages auto-deploys from `main` — live in ~30 seconds

See `DEPLOYMENT.md` for the full Apps Script setup.

## Design tokens

| Token | Value |
|---|---|
| Background | `#f6f4f0` (off-white warm) |
| Primary text | `#151514` (near-black warm) |
| Accent decorative | `#Daccb4` (warm tan — rules, progress bar) |
| Accent tag/focus | `#7a6948` / `#baac8a` (darker earth tones) |
| Font | Jost 200/300/400/500 + italic 300 (Google Fonts) |

## Pages

| # | ID | Content |
|---|---|---|
| 1 | `#p0` | Opening — TSA Café Reservation |
| 2 | `#p1` | The Experience — event story |
| 3 | `#p2` | What to Expect — experience highlights + Reserve your spot button |
| 4 | `#p3` | Slot Reservation — date picker → time slot picker → party type + details form |
| 5 | `#p4` | Request Received — "We'll be in touch." |

## Form fields collected

| Field | Required | Notes |
|---|---|---|
| Date | Yes | May 8, May 9, or May 10 — button picker |
| Time Slot | Yes | One of 7 hourly slots — greyed per party-type cap |
| Party Type | Yes | "Just me" (solo) or "With a +1" (plus_one) |
| Full Name | Yes | Min 2 characters |
| Email Address | Yes | Used for duplicate check |
| WhatsApp Number | Yes | Min 7 digits; team uses for follow-up |
| Instagram Handle | No | |
| TikTok Handle | No | |

## Slot capacity

Per time slot, per day:

| Cap | Value | Constant |
|---|---|---|
| Total confirmed | **5** | `SLOT_CAPACITY` in `Code.gs` |
| Solo bookings | **1** | `SOLO_CAP` in `Code.gs` |
| +1 bookings | **4** | `PLUS_ONE_CAP` in `Code.gs` |

The frontend fetches live confirmed counts when the guest reaches the reservation page. Slots are greyed out based on the selected party type — if "Just me" is selected and the solo spot is taken, that slot greys out even if +1 spots remain. The backend auto-assigns `Status: Confirmed` or `Status: Waitlist`. If waitlisted, the guest sees a nudge offering to pick another slot or join the waitlist. A confirmation email is sent automatically for both statuses.

## Known TODOs

- `SCRIPT_URL` in `assets/app.js` needs to be updated after deploying the new `Code.gs` — see `DEPLOYMENT.md`
- Replace `GA_MEASUREMENT_ID` in `index.html` with the real Google Analytics property ID
- Replace `og:image` placeholder path in `index.html` with the confirmed event photo
