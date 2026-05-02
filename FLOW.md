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
                              (greyed out per party-type cap)
  Step 3: Fill the form    → Party type, Name, Email,
                              WhatsApp, Instagram, TikTok
  → "Request Reservation →"

  If slot is full for party type:
    Waitlist nudge appears — "Pick another time →" or "Join waitlist →"
    (Guest stays on page 4 until they choose)

Page 5 · Request Received (Confirmed)
  "We'll be in touch."
  "Your request has been received. We'll reach out to confirm shortly."

Page 5 · You're on the List (Waitlist — after clicking "Join waitlist →")
  "You're on the list."
  "This slot is full, but you're on the waitlist. We'll reach out if a spot opens up."
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

1. The frontend validates all required fields locally (name ≥ 2 chars, valid email, valid phone format)
2. A POST is sent to the Google Apps Script backend (protected by `LockService` to prevent race conditions)
3. The backend checks for a duplicate email — blocks only if the email is already `Confirmed`
4. The backend counts existing **Confirmed** bookings for that date + slot:
   - If total confirmed ≥ 5 → **Waitlist** (`slot_full`)
   - If party type is "solo" and solo confirmed ≥ 1 → **Waitlist** (`solo_full`)
   - If party type is "plus_one" and plus_one confirmed ≥ 4 → **Waitlist** (`plus_one_full`)
   - Otherwise → **Confirmed**
5. A new row is written to the Google Sheet with Status assigned
6. A confirmation email is sent automatically (confirmed or waitlist copy)
7. **If Confirmed**: guest advances to page 5 ("We'll be in touch.")
8. **If Waitlisted**: a nudge appears on page 4 with the specific reason and two options:
   - "Pick another time →" — clears slot selection, guest tries a different slot
   - "Join waitlist →" — guest is already recorded; page 5 shows waitlist copy

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

### Step 2 — Auto-email (sent by the system)

A confirmation email is sent automatically on every submission — confirmed or waitlisted. Guests will already have their status in their inbox.

- **Confirmed email subject**: "TSA Café — You're in"
- **Waitlist email subject**: "TSA Café — You're on the list"

No manual action needed for the initial acknowledgement. Follow up via WhatsApp for anything requiring a personal touch.

**WhatsApp template — day-before reminder (confirmed guests):**
> Hi [Name], your TSA Café reservation is confirmed! We'll see you on [Date] at [Time Slot]. Can't wait to have you ☕

**WhatsApp template — waitlist follow-up (if a spot opens):**
> Hi [Name], great news — a spot opened up at TSA Café for [Date] at [Time Slot]. You're confirmed! See you then 🤍

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
- Each slot holds up to 5 confirmed guests (1 solo + up to 4 +1 tables)
- If a walk-in or last-minute change needs to be added, manually insert a row with Status `Confirmed`
- If a guest is a no-show, you can note it in a spare column (e.g. add a `Notes` column) — the system doesn't track attendance

---

## Part 5 — Capacity at a Glance

Per date, per time slot:

```
Total confirmed cap:   5   (SLOT_CAPACITY)
Solo cap:              1   (SOLO_CAP)
Plus-one cap:          4   (PLUS_ONE_CAP)
```

If any cap is hit for the requested party type, the submission goes to Waitlist automatically. The frontend greys out slots based on the selected party type — a slot can be available for +1 but greyed for solo if the single solo cap is taken.

To change capacity: edit `SLOT_CAPACITY`, `SOLO_CAP`, and `PLUS_ONE_CAP` in `apps-script/Code.gs` and re-deploy as a new version (see `DEPLOYMENT.md`). No frontend change needed — caps are returned by `doGet`.

---

## Quick Reference — Status Decision

```
Guest submits request
        │
        ▼
Total confirmed for this date + slot ≥ 5?
        │ YES → Status: Waitlist (reason: slot_full)
        │ NO
        ▼
Party type = solo AND solo confirmed ≥ 1?
        │ YES → Status: Waitlist (reason: solo_full)
        │ NO
        ▼
Party type = plus_one AND plus_one confirmed ≥ 4?
        │ YES → Status: Waitlist (reason: plus_one_full)
        │ NO
        ▼
        Status: Confirmed
```
