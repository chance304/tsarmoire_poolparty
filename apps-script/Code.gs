const SHEET_NAME     = 'Reservations';
const ERROR_SHEET    = 'Errors';
const RATE_LIMIT_KEY = 'rate_limit';
const RATE_WINDOW_MS = 60 * 1000; /* 1 minute */
const RATE_MAX       = 15;        /* max submissions per window globally */
const SLOT_CAPACITY  = 10;        /* max reservations per date+slot */

function doGet(e) {
  if (e.parameter.action === 'slots') {
    return _getSlotAvailability();
  }
  return _respond({ ok: false, error: 'unknown_action' });
}

function doPost(e) {
  let data;

  /* Parse body */
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    _logError('parse', err);
    return _respond({ ok: false, error: 'invalid_request' });
  }

  /* Rate limit */
  if (!_checkRateLimit()) {
    return _respond({ ok: false, error: 'rate_limited' });
  }

  /* Validate */
  const validationError = _validate(data);
  if (validationError) {
    return _respond({ ok: false, error: validationError });
  }

  /* Server-side duplicate check */
  if (_isDuplicate(data.email)) {
    return _respond({ ok: false, error: 'duplicate' });
  }

  /* Server-side slot capacity check */
  if (_isSlotFull(data.date, data.time_slot)) {
    return _respond({ ok: false, error: 'slot_full' });
  }

  /* Write to sheet — must succeed before email */
  try {
    _appendRow(data);
  } catch (err) {
    _logError('sheet_write', err);
    return _respond({ ok: false, error: 'server_error' });
  }

  /* Send confirmation email — failure is non-blocking */
  try {
    _sendConfirmation(data);
  } catch (err) {
    _logError('email', err);
  }

  return _respond({ ok: true });
}

/* ── Helpers ───────────────────────────────────────────── */

function _respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function _validate(d) {
  if (!d.name || String(d.name).trim().length === 0) return 'name_required';
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!d.email || !emailRx.test(String(d.email).trim())) return 'invalid_email';
  if (!d.date || String(d.date).trim().length === 0) return 'date_required';
  if (!d.time_slot || String(d.time_slot).trim().length === 0) return 'slot_required';
  return null;
}

function _isDuplicate(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return false;
    const emails = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
    const target = String(email).toLowerCase().trim();
    return emails.some(row => String(row[0]).toLowerCase().trim() === target);
  } catch (err) {
    _logError('duplicate_check', err);
    return false; /* fail open */
  }
}

function _isSlotFull(date, timeSlot) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return false;
    /* Columns 7 (Date) and 8 (Time Slot) — 1-indexed */
    const rows = sheet.getRange(2, 7, sheet.getLastRow() - 1, 2).getValues();
    const count = rows.filter(row =>
      String(row[0]).trim() === String(date).trim() &&
      String(row[1]).trim() === String(timeSlot).trim()
    ).length;
    return count >= SLOT_CAPACITY;
  } catch (err) {
    _logError('slot_check', err);
    return false; /* fail open */
  }
}

function _getSlotAvailability() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const slots = {};

    if (sheet && sheet.getLastRow() >= 2) {
      const rows = sheet.getRange(2, 7, sheet.getLastRow() - 1, 2).getValues();
      rows.forEach(row => {
        const date = String(row[0]).trim();
        const slot = String(row[1]).trim();
        if (!date || !slot) return;
        if (!slots[date]) slots[date] = {};
        slots[date][slot] = (slots[date][slot] || 0) + 1;
      });
    }

    return _respond({ ok: true, slots, capacity: SLOT_CAPACITY });
  } catch (err) {
    _logError('slots_fetch', err);
    return _respond({ ok: true, slots: {}, capacity: SLOT_CAPACITY }); /* fail open — show all available */
  }
}

function _checkRateLimit() {
  try {
    const props = PropertiesService.getScriptProperties();
    const now = Date.now();
    const raw = props.getProperty(RATE_LIMIT_KEY);
    const state = raw ? JSON.parse(raw) : { count: 0, reset: now + RATE_WINDOW_MS };

    if (now > state.reset) {
      props.setProperty(RATE_LIMIT_KEY, JSON.stringify({ count: 1, reset: now + RATE_WINDOW_MS }));
      return true;
    }
    if (state.count >= RATE_MAX) return false;
    state.count++;
    props.setProperty(RATE_LIMIT_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    return true; /* fail open */
  }
}

function _appendRow(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Name', 'Email', 'Instagram', 'TikTok', 'Phone', 'Date', 'Time Slot', 'Registered At']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    d.id,
    String(d.name).trim(),
    String(d.email).trim().toLowerCase(),
    d.instagram  || '',
    d.tiktok     || '',
    d.phone      || '',
    d.date       || '',
    d.time_slot  || '',
    d.registered_at
  ]);
}

function _sendConfirmation(d) {
  const firstName = String(d.name).trim().split(/\s+/)[0];
  MailApp.sendEmail({
    to: d.email,
    subject: "TSA Café — Your table is reserved",
    htmlBody: `
      <div style="font-family:Georgia,serif;color:#151514;max-width:480px;margin:0 auto">
        <p style="letter-spacing:.12em;font-size:11px;text-transform:uppercase;color:#96815c">
          T's Armoire
        </p>
        <h1 style="font-size:2rem;margin:.25em 0;font-weight:400">You're in, ${firstName}.</h1>
        <p style="line-height:1.7;color:#444;margin:.75em 0">
          Your table at <strong>TSA Café</strong> is reserved.
        </p>
        <p style="line-height:1.7;color:#444;font-size:1.1rem;margin:.5em 0">
          <strong>${d.date}</strong> &middot; ${d.time_slot}
        </p>
        <p style="line-height:1.7;color:#444;margin:.75em 0">
          Get ready for good coffee, great fits, and an experience you'll want to stay in.
        </p>
        <p style="line-height:1.7;color:#444;margin:.75em 0">
          We'll see you soon.
        </p>
        <p style="line-height:1.7;color:#888;font-size:.875rem;margin:1.5em 0 0">
          — The T's Armoire Team
        </p>
      </div>
    `
  });
}

function _logError(context, err) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(ERROR_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(ERROR_SHEET);
      sheet.appendRow(['Timestamp', 'Context', 'Error']);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date().toISOString(), context, String(err)]);
  } catch (e) {
    /* don't throw from the error logger */
  }
}
