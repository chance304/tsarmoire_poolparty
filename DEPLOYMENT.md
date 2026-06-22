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
2. Create a new spreadsheet, name it: `T's Armoire Summer Club Registrations`
3. Leave it empty — the script creates the header row automatically on first submission

The sheet will have the following columns once the first submission arrives:

| ID | Name | Email | Instagram | TikTok | Phone | Registered At | Social Consent |

### Step 2 — Create the Apps Script project

1. In the spreadsheet, click **Extensions → Apps Script**
2. Delete all placeholder code
3. Copy the contents of `apps-script/Code.gs` from this repo and paste it in
4. Click **Save** (name the project anything, e.g. `T's Armoire Summer Club Backend`)

### Step 3 — Deploy as a Web App

1. Click **Deploy → New deployment**
2. Click the gear icon next to "Select type" and choose **Web App**
3. Set:
   - **Description**: `T's Armoire Summer Club v1` (or anything)
   - **Execute as**: `Me` (the T's Armoire account)
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Authorize the permissions when prompted (allow access to Sheets and Gmail)
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
git commit -m "Switch Apps Script to org account deployment"
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

### If adding the Social Consent column to an existing sheet

If the sheet already has rows from before the Social Consent column was added to `Code.gs`:

1. Open the Google Sheet
2. Click the header of column H and insert a column if needed
3. Type `Social Consent` in cell H1

New submissions will populate column H. Old rows will have empty cells there.

### If migrating from a previous deployment (e.g. personal → org account)

If rows were already collected under a previous deployment, check that all column headers are present in row 1:

```
A: ID  B: Name  C: Email  D: Instagram  E: TikTok  F: Phone  G: Registered At  H: Social Consent
```

Missing columns will cause new submissions to write data to the wrong columns.

---

## 3. GitHub Pages (frontend)

No manual action needed. GitHub Pages serves from the `main` branch root.

- **Custom domain**: set via `CNAME` file (`launch.tsarmoiremanufacturing.com.np`)
- **DNS**: CNAME record pointing to `<github-username>.github.io` must be set at your DNS provider

Every `git push origin main` deploys automatically. Changes are live within ~30 seconds.

---

## 4. Post-deploy — remaining team tasks

Before the site goes live:

- [ ] Replace `og:image` in `index.html` with the confirmed event photo (currently placeholder path `assets/og-image.jpg`)
- [ ] Replace `GA_MEASUREMENT_ID` in `index.html` with the real Google Analytics property ID
- [ ] Write and link privacy policy page (required — site collects email and phone)
- [ ] Migrate Apps Script deployment from personal account to T's Armoire org account and update `SCRIPT_URL` in `assets/app.js`

---

## Verification checklist

After deploying a new Apps Script URL:

- [ ] Open the live site and navigate through all 5 pages (counter should read 01/05 → 05/05)
- [ ] On page 3 (Social Consent), confirm Yes and No buttons advance to the form; back arrow returns to page 2
- [ ] Submit the form (page 4) with all fields filled — confirm it waits for server response before advancing to thank-you
- [ ] Confirm a new row appears in the Google Sheet with all 8 columns populated, including Social Consent as `yes` or `no`
- [ ] Confirm the test email inbox receives the confirmation email
- [ ] Submit the same email again — server should return `duplicate` error; form should show "Already registered" inline
- [ ] Kill your network mid-submit — form should show "Something went wrong — please try again" and re-enable the button
- [ ] Submit leaving TikTok and phone blank — sheet should show empty cells, no error
- [ ] Test on mobile — form scrolls, button is reachable, no swipe navigation on consent or form pages
- [ ] Check the `Errors` tab in the Google Sheet exists and logs any backend failures
- [ ] Confirm no submissions exceed the rate limit (15 per minute window)
