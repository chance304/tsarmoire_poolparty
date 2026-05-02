const SHEET_NAME     = 'Reservations';
const ERROR_SHEET    = 'Errors';
const RATE_LIMIT_KEY = 'rate_limit';
const RATE_WINDOW_MS = 60 * 1000; /* 1 minute */
const RATE_MAX       = 15;        /* max submissions per window globally */
const SLOT_CAPACITY  = 5;         /* max confirmed bookings per date+slot (total): 1 solo + 4 +1 tables */
const SOLO_CAP       = 1;         /* max confirmed solo bookings per date+slot */
const PLUS_ONE_CAP   = 4;         /* max confirmed +1 bookings per date+slot */

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

  /* Determine confirmed vs waitlist — locked to prevent race conditions */
  let status, reason;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    ({ status, reason } = _determineStatus(data));
    _appendRow(data, status);
  } catch (err) {
    _logError('sheet_write', err);
    return _respond({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }

  /* Send confirmation email — failure is non-blocking */
  try {
    _sendConfirmation(data, status);
  } catch (err) {
    _logError('email', err);
  }

  return _respond({ ok: true, status, reason });
}

/* ── Helpers ───────────────────────────────────────────── */

function _respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function _validate(d) {
  if (!d.name || String(d.name).trim().length < 2) return 'name_required';
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!d.email || !emailRx.test(String(d.email).trim())) return 'invalid_email';
  const phoneRx = /^[+\d][\d\s\-().]{5,}$/;
  if (!d.phone || !phoneRx.test(String(d.phone).trim())) return 'invalid_phone';
  if (d.party_type !== 'solo' && d.party_type !== 'plus_one') return 'party_type_required';
  if (!d.date || String(d.date).trim().length === 0) return 'date_required';
  if (!d.time_slot || String(d.time_slot).trim().length === 0) return 'slot_required';
  return null;
}

function _isDuplicate(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return false;
    /* Read Email (col 3) + Status (col 10) — only block if already Confirmed */
    const rows = sheet.getRange(2, 3, sheet.getLastRow() - 1, 8).getValues();
    const target = String(email).toLowerCase().trim();
    return rows.some(row =>
      String(row[0]).toLowerCase().trim() === target &&
      String(row[7]).trim() === 'Confirmed'
    );
  } catch (err) {
    _logError('duplicate_check', err);
    return false; /* fail open */
  }
}

function _determineStatus(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return { status: 'Confirmed', reason: null };

    /* Columns: 7=Date, 8=Time Slot, 9=Party Type, 10=Status */
    const rows = sheet.getRange(2, 7, sheet.getLastRow() - 1, 4).getValues();

    const confirmedRows = rows.filter(row =>
      String(row[0]).trim() === String(data.date).trim() &&
      String(row[1]).trim() === String(data.time_slot).trim() &&
      String(row[3]).trim() === 'Confirmed'
    );

    const totalConfirmed   = confirmedRows.length;
    const soloConfirmed    = confirmedRows.filter(row => String(row[2]).trim() === 'solo').length;
    const plusOneConfirmed = confirmedRows.filter(row => String(row[2]).trim() === 'plus_one').length;

    if (totalConfirmed >= SLOT_CAPACITY)                                    return { status: 'Waitlist', reason: 'slot_full' };
    if (data.party_type === 'solo'     && soloConfirmed    >= SOLO_CAP)     return { status: 'Waitlist', reason: 'solo_full' };
    if (data.party_type === 'plus_one' && plusOneConfirmed >= PLUS_ONE_CAP) return { status: 'Waitlist', reason: 'plus_one_full' };
    return { status: 'Confirmed', reason: null };
  } catch (err) {
    _logError('determine_status', err);
    return { status: 'Confirmed', reason: null }; /* fail open */
  }
}

function _getSlotAvailability() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const slots = {};

    if (sheet && sheet.getLastRow() >= 2) {
      /* Columns: 7=Date, 8=Time Slot, 9=Party Type, 10=Status */
      const rows = sheet.getRange(2, 7, sheet.getLastRow() - 1, 4).getValues();
      rows.forEach(row => {
        const date      = String(row[0]).trim();
        const slot      = String(row[1]).trim();
        const partyType = String(row[2]).trim();
        const status    = String(row[3]).trim();
        if (!date || !slot || status !== 'Confirmed') return;
        if (!slots[date]) slots[date] = {};
        if (!slots[date][slot]) slots[date][slot] = { solo: 0, plus_one: 0, total: 0 };
        if (partyType === 'solo') slots[date][slot].solo++;
        else if (partyType === 'plus_one') slots[date][slot].plus_one++;
        slots[date][slot].total++;
      });
    }

    return _respond({ ok: true, slots, caps: { solo: SOLO_CAP, plus_one: PLUS_ONE_CAP, total: SLOT_CAPACITY } });
  } catch (err) {
    _logError('slots_fetch', err);
    return _respond({ ok: true, slots: {}, caps: { solo: SOLO_CAP, plus_one: PLUS_ONE_CAP, total: SLOT_CAPACITY } });
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

function _appendRow(d, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Name', 'Email', 'Phone', 'Instagram', 'TikTok', 'Date', 'Time Slot', 'Party Type', 'Status', 'Submitted At']);
    sheet.setFrozenRows(1);
  }
  const rowData = [
    d.id,
    String(d.name).trim(),
    String(d.email).trim().toLowerCase(),
    d.phone      || '',
    d.instagram  || '',
    d.tiktok     || '',
    d.date       || '',
    d.time_slot  || '',
    d.party_type || '',
    status,
    d.registered_at
  ];
  const nextRow = sheet.getLastRow() + 1;
  /* Force Date (col 7) and Time Slot (col 8) as plain text — prevents Google
     Sheets from auto-converting "May 8" to a Date serial, which breaks the
     string comparison in _determineStatus and _getSlotAvailability. */
  sheet.getRange(nextRow, 7, 1, 2).setNumberFormat('@');
  sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
}

function _sendConfirmation(d, status) {
  const firstName   = String(d.name).trim().split(/\s+/)[0];
  const partyLabel  = d.party_type === 'solo' ? 'a table for just you' : 'a table for two';
  const isConfirmed = status === 'Confirmed';

  const subject  = isConfirmed ? "TSA Café — You're in" : "TSA Café — You're on the list";
  const htmlBody = isConfirmed ? _confirmedBody(firstName, d, partyLabel) : _waitlistBody(firstName, d);
  const body     = isConfirmed
    ? "You're in, " + firstName + ". " + d.date + " · " + d.time_slot + ". See you soon. — T's Armoire"
    : "You're on the list, " + firstName + ". We've noted your interest for " + d.date + " · " + d.time_slot + ". — T's Armoire";

  MailApp.sendEmail(d.email, subject, body, { htmlBody: htmlBody, name: "T's Armoire" });
}

function _confirmedBody(firstName, d, partyLabel) {
  return `
    <div style="font-family:'Georgia',serif;color:#151514;max-width:480px;margin:0 auto;padding:40px 0">
      <p style="font-size:10px;letter-spacing:.45em;text-transform:uppercase;color:#96815c;margin:0 0 32px">T's Armoire</p>
      <h1 style="font-size:2rem;font-weight:400;margin:0 0 8px">You're in, ${firstName}.</h1>
      <p style="font-size:1rem;color:#444;margin:0 0 28px;line-height:1.6">We've reserved ${partyLabel} at TSA Café.</p>
      <p style="font-size:1.1rem;font-weight:400;margin:0 0 32px">
        <strong>${d.date}</strong> &nbsp;&middot;&nbsp; ${d.time_slot}
      </p>
      <p style="color:#444;line-height:1.7;margin:0 0 12px">Get ready for good coffee, great fits, and an experience you'll want to stay in.</p>
      <p style="color:#444;line-height:1.7;margin:0 0 40px">We'll see you soon.</p>
      <p style="font-size:.85rem;color:#888;margin:0">— T's Armoire</p>
    </div>
  `;
}

function _waitlistBody(firstName, d) {
  return `
    <div style="font-family:'Georgia',serif;color:#151514;max-width:480px;margin:0 auto;padding:40px 0">
      <p style="font-size:10px;letter-spacing:.45em;text-transform:uppercase;color:#96815c;margin:0 0 32px">T's Armoire</p>
      <h1 style="font-size:2rem;font-weight:400;margin:0 0 8px">You're on the list, ${firstName}.</h1>
      <p style="font-size:1rem;color:#444;margin:0 0 28px;line-height:1.6">We've noted your interest for:</p>
      <p style="font-size:1.1rem;font-weight:400;margin:0 0 32px">
        <strong>${d.date}</strong> &nbsp;&middot;&nbsp; ${d.time_slot}
      </p>
      <p style="color:#444;line-height:1.7;margin:0 0 40px">If a confirmed spot opens up, we'll reach out to you directly.</p>
      <p style="font-size:.85rem;color:#888;margin:0">— T's Armoire</p>
    </div>
  `;
}

function testEmail() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'TSA Café — email test', 'MailApp is authorized and working.');
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
