# TSA Café — Booking Flow & Operations Guide

This document covers the full flow: what the guest experiences, what happens in the system, and what the team does at each stage.

---

## Part 1 — Guest Journey

### What the guest sees

```
Page 1 · Opening
  "TSA Café Reservation"
  "TSA CAFE — A moment. A community. An experience."
  May 8, 9 & 10
  → forward arrow

Page 2 · The Experience
  "Not just a space — it's a moment."
  Event story, hosted by Deeya
  → forward arrow

Page 3 · What to Expect
  Drinks, fresh bakes, intimate space, exclusive perks
  → "Reserve your spot →" button (only way forward)

Page 4 · Slot Reservation
  Step 1: Pick a date      → May 8 / May 9 / May 10
  Step 2: Pick a time      → 7 hourly slots appear
                              (greyed out if fully booked)
  Step 3: Fill the form    → Party type, Name, Email,
                              WhatsApp, Instagram, TikTok
  → "Request Reservation →"

Page 5 · Request Received
  "We'll be in touch."
  "Our team will confirm your reservation shortly via WhatsApp."
```

### Time slots available (all 3 days)

| Slot | Time |
|------|------|
| 1 | 10:30 AM – 11:30 AM |
| 2 | 11:45 AM – 12:45 PM |
| 3 | 1:00 PM – 2:00 PM |
| 4 | 2:15 PM – 3:15 PM |
| 5 | 3:30 PM – 4:30 PM |
| 6 | 4:45 PM – 5:45 PM |
| 7 | 6:00 PM – 7:00 PM |

### What the guest submits

| Field | Required |
|-------|----------|
| Date | Yes |
| Time Slot | Yes |
| Party Type (Just me / With a +1) | Yes |
| Full Name | Yes |
| Email Address | Yes |
| WhatsApp Number | Yes |
| Instagram Handle | No |
| TikTok Handle | No |

### What the guest cannot do

- Submit the same email twice (blocked with an error message)
- Select a time slot that is already at full confirmed capacity (greyed out)
- Skip to the form without selecting a date and time slot first

---

## Part 2 — What Happens in the System

When the guest hits "Request Reservation →":

1. The frontend validates all required fields locally
2. A POST is sent to the Google Apps Script backend
3. The backend checks for a duplicate email
4. The backend counts existing **Confirmed** bookings for that date + slot:
   - If total confirmed ≥ 10 → **Waitlist**
   - If party type is "solo" and solo confirmed ≥ 3 → **Waitlist**
   - Otherwise → **Confirmed**
5. A new row is written to the Google Sheet with Status assigned
6. The guest sees page 5 ("We'll be in touch.") regardless of status

**The guest never sees whether they are Confirmed or Waitlisted — the team handles that via WhatsApp.**

---

## Part 3 — The Google Sheet

Sheet name: `TSA CAFÉ Reservations`

| Column | What it contains |
|--------|-----------------|
| A — ID | Unique ID (e.g. `tsa-1714983200000`) |
| B — Name | Full name |
| C — Email | Email address (lowercase) |
| D — Phone | WhatsApp number |
| E — Instagram | Handle or blank |
| F — TikTok | Handle or blank |
| G — Date | May 8 / May 9 / May 10 |
| H — Time Slot | e.g. `10:30 AM – 11:30 AM` |
| I — Party Type | `solo` or `plus_one` |
| J — Status | `Confirmed` or `Waitlist` |
| K — Submitted At | ISO timestamp |

### Filtering tips

- **To see all confirmed guests for a slot:** filter column G (date), H (time slot), J = `Confirmed`
- **To see the waitlist for a slot:** filter G, H, J = `Waitlist`
- **To count how full a slot is:** filter G + H + J = `Confirmed`, check row count
- **To see who came solo:** filter I = `solo`

---

## Part 4 — Team Operational Flow

### Step 1 — After the site goes live

Monitor the sheet as reservations come in. No action needed until you're ready to start confirming.

Recommended: check the sheet at least once a day while reservations are open.

---

### Step 2 — Send WhatsApp messages

Message guests based on their Status column. Use the phone number in column D.

**For Confirmed guests:**
> Hi [Name], your TSA Café reservation is confirmed! We'll see you on [Date] at [Time Slot]. Can't wait to have you ☕

**For Waitlisted guests:**
> Hi [Name], thanks for requesting a spot at TSA Café! You're currently on our waitlist for [Date] at [Time Slot]. We'll reach out if a spot opens up 🤍

Send these as soon as possible after the submission — guests are expecting to hear back.

---

### Step 3 — Managing the waitlist

If a confirmed guest cancels or doesn't respond:

1. Find the next `Waitlist` entry for the same date and time slot (earliest Submitted At)
2. Manually change their Status in the sheet from `Waitlist` → `Confirmed`
3. Send them the confirmed message via WhatsApp

There is no automated promotion — the team moves people manually.

---

### Step 4 — Day-before reminders

The evening before each event day, message all **Confirmed** guests for that day:

> Hi [Name], just a reminder — TSA Café is tomorrow! Your slot is [Time Slot] on [Date]. See you then ✨

Filter column G by the upcoming date and column J = `Confirmed` to get the right list.

---

### Step 5 — Day-of

- Keep the sheet open for reference
- Each slot holds up to 10 confirmed guests (up to 3 solo, rest with +1)
- If a walk-in or last-minute change needs to be added, manually insert a row with Status `Confirmed`
- If a guest is a no-show, you can note it in a spare column (e.g. add a `Notes` column) — the system doesn't track attendance

---

## Part 5 — Capacity at a Glance

Per date, per time slot:

```
Total confirmed cap:   10
Solo cap:               3
Plus-one cap:           7  (implicit — total minus solo cap)
```

If either cap is hit, new submissions for that type go to Waitlist automatically.  
If both caps are hit (total = 10), the slot appears greyed out on the site and no new selections are possible — but anyone who submits in a race condition still lands on Waitlist in the sheet.

To change capacity: edit `SLOT_CAPACITY` and `SOLO_CAP` in `apps-script/Code.gs` and re-deploy as a new version (see `DEPLOYMENT.md`).

---

## Quick Reference — Status Decision

```
Guest submits request
        │
        ▼
Total confirmed for this date + slot ≥ 10?
        │ YES → Status: Waitlist
        │ NO
        ▼
Party type = solo AND solo confirmed ≥ 3?
        │ YES → Status: Waitlist
        │ NO
        ▼
        Status: Confirmed
```
