# Deployment Guide

## Overview

The site has two parts to deploy:
1. **Frontend** — static files on GitHub Pages (automatic on push to `main`)
2. **Backend** — Google Apps Script Web App (manual deploy, once per account)

---

## 1. Apps Script setup (backend)

This must be done from the **T's Armoire Google account**, not a personal account.

### Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and sign in as T's Armoire
2. Create a new spreadsheet, name it: `TSA CAFÉ Reservations`
3. Leave it empty — the script creates the header row automatically on first submission

The sheet will have the following columns once the first submission arrives:

| ID | Name | Email | Phone | Instagram | TikTok | Date | Time Slot | Party Type | Status | Submitted At |

### Step 2 — Create the Apps Script project

1. In the spreadsheet, click **Extensions → Apps Script**
2. Delete all placeholder code
3. Copy the contents of `apps-script/Code.gs` from this repo and paste it in
4. Click **Save** (name the project anything, e.g. `TSA CAFÉ Reservations Backend`)

### Step 3 — Deploy as a Web App

1. Click **Deploy → New deployment**
2. Click the gear icon next to "Select type" and choose **Web App**
3. Set:
   - **Description**: `TSA CAFÉ Reservations v1` (or anything)
   - **Execute as**: `Me` (the T's Armoire account)
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Authorize the permissions when prompted (allow access to Sheets)
6. Copy the **Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
   ```

### Step 4 — Update the frontend

Open `assets/app.js` and replace the `SCRIPT_URL` value with the new URL:

```js
const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_NEW_URL_HERE/exec';
```

Commit and push:

```bash
git add assets/app.js
git commit -m "Update SCRIPT_URL to org account deployment"
git push origin main
```

---

## 2. Re-deploying the Apps Script after code changes

If you edit `apps-script/Code.gs`, you must create a **new version** for changes to take effect. Editing the script does not update existing deployments.

1. Open the Apps Script project
2. Click **Deploy → Manage deployments**
3. Click the edit (pencil) icon on the active deployment
4. Under "Version", select **New version**
5. Click **Deploy**

> This updates the existing deployment URL — no need to change `SCRIPT_URL` in `app.js`.

### If migrating from a previous deployment (e.g. personal → org account)

If rows were already collected under a previous deployment, ensure all column headers are present in row 1 of the sheet in this exact order:

```
A: ID  B: Name  C: Email  D: Phone  E: Instagram  F: TikTok  G: Date  H: Time Slot  I: Party Type  J: Status  K: Submitted At
```

Missing or reordered columns will cause new submissions to write data to the wrong cells.

### Adjusting capacity

Three constants in `Code.gs` control bookings per date+slot:

```js
const SLOT_CAPACITY  = 5;  // max confirmed bookings per slot (total)
const SOLO_CAP       = 1;  // max confirmed solo bookings per slot
const PLUS_ONE_CAP   = 4;  // max confirmed +1 bookings per slot
```

Change any value and re-deploy as a new version (see above). No frontend change needed — the frontend reads `caps` from the `doGet` response.

---

## 3. GitHub Pages (frontend)

No manual action needed. GitHub Pages serves from the `main` branch root.

- **Custom domain**: set via `CNAME` file — update this file if the domain changes
- **DNS**: CNAME record pointing to `<github-username>.github.io` must be set at your DNS provider

Every `git push origin main` deploys automatically. Changes are live within ~30 seconds.

---

## 4. Post-deploy — remaining team tasks

Before the site goes live:

- [ ] Update `SCRIPT_URL` in `assets/app.js` with the new Apps Script Web App URL
- [ ] Replace `og:image` in `index.html` with the confirmed event photo (currently placeholder `assets/og-image.jpg`)
- [ ] Replace `GA_MEASUREMENT_ID` in `index.html` with the real Google Analytics property ID
- [ ] Update `CNAME` if the domain for this deployment differs from `launch.tsarmoiremanufacturing.com.np`

---

## 5. WhatsApp message templates (manual — team sends these)

After each booking day, filter the sheet by Status and message guests accordingly.

**Confirmed booking:**
> Hi [Name], your TSA Café reservation is confirmed! We'll see you on [Date] at [Time Slot]. Can't wait to have you ☕

**Waitlist:**
> Hi [Name], thanks for requesting a spot at TSA Café! You're currently on our waitlist for [Date] at [Time Slot]. We'll reach out if a spot opens up 🤍

**Day-before reminder (confirmed guests):**
> Hi [Name], just a reminder — TSA Café is tomorrow! Your slot is [Time Slot] on [Date]. See you then ✨

---

## 6. Verification checklist

After deploying a new Apps Script URL:

- [ ] Open the live site — opening page shows TSA CAFÉ, dates May 8, 9 & 10, counter reads 01 / 05
- [ ] Navigate forward through pages 1–3 (opening → experience → what to expect) using the forward arrow
- [ ] On page 3 (What to Expect), click "Reserve your spot →" — confirms it advances to the slot picker
- [ ] On page 4 (slot picker), click a date — time slots should appear
- [ ] Select a time slot — the party type + details form should appear below
- [ ] Select a date — time slots appear; slots at total cap (≥ 5 confirmed) appear greyed out
- [ ] Select "Just me" and a date where the solo spot is taken — that slot greys out even if +1 spots remain
- [ ] Submit the form without selecting party type — form shows "Please select your experience"
- [ ] Submit the form with a name under 2 characters — form shows "Please enter your full name"
- [ ] Submit the form with an invalid phone format (e.g. `abc`) — form shows "Please enter a valid phone number"
- [ ] Submit the form without a phone number — form shows "Please enter your WhatsApp number"
- [ ] Submit the form with all required fields filled (party type, name, email, phone) — button shows "Requesting →" then advances to request-received page
- [ ] Confirm page 5 shows "Request Received" / "We'll be in touch."
- [ ] Confirm a new row appears in the Google Sheet with all 11 columns populated (ID, Name, Email, Phone, Instagram, TikTok, Date, Time Slot, Party Type, Status, Submitted At)
- [ ] Confirm `Status` column shows `Confirmed` for a fresh booking
- [ ] Confirm a confirmation email is sent to the guest on submit (check inbox)
- [ ] Submit as solo when solo count for that slot = 1 — server returns `Waitlist` with reason `solo_full`; guest sees waitlist nudge with "Pick another time" and "Join waitlist" options
- [ ] Submit as +1 when plus_one count for that slot = 4 — server returns `Waitlist` with reason `plus_one_full`; nudge appears
- [ ] Submit when total confirmed = 5 — sheet should show `Status: Waitlist`; waitlist email sent
- [ ] Click "Join waitlist →" on nudge — page 5 shows waitlist copy; waitlist email arrives
- [ ] Submit the same email again (already Confirmed) — server returns `duplicate` error; form shows "Already reserved with this email"
- [ ] Kill network mid-submit — form shows "Something went wrong — please try again" and re-enables the button
- [ ] Submit leaving Instagram and TikTok blank — sheet shows empty cells, no error
- [ ] Test on mobile — date/slot/party buttons are tappable, form scrolls, no swipe navigation on slot picker page
- [ ] Check the `Errors` tab in the Google Sheet exists and logs any backend failures
- [ ] Call `doGet?action=slots` directly — response includes `caps: { solo: 1, plus_one: 4, total: 5 }` and slot counts grouped by party type
