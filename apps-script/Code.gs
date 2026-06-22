const SHEET_NAME = 'Registrations';
const ERROR_SHEET = 'Errors';
const RATE_LIMIT_KEY = 'rate_limit';
const RATE_WINDOW_MS = 60 * 1000; /* 1 minute */
const RATE_MAX = 15;              /* max submissions per window globally */

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
    /* Don't fail the registration — sheet write already succeeded */
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
    return false; /* fail open — don't block on check error */
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
    return true; /* fail open — don't block on rate limit error */
  }
}

function _appendRow(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Name', 'Email', 'Instagram', 'TikTok', 'Phone', 'Registered At', 'Social Consent']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    d.id,
    String(d.name).trim(),
    String(d.email).trim().toLowerCase(),
    d.instagram      || '',
    d.tiktok         || '',
    d.phone          || '',
    d.registered_at,
    d.social_consent || ''
  ]);
}

function _sendConfirmation(d) {
  const firstName = String(d.name).trim().split(/\s+/)[0];

  const htmlBody = `
    <div style="background:#f6f4f0;padding:48px 24px;">
      <div style="font-family:Georgia,'Times New Roman',serif;color:#151514;max-width:480px;margin:0 auto;">
        <p style="letter-spacing:.5em;font-size:10px;text-transform:uppercase;color:#7a6948;margin:0 0 24px;">
          T's Armoire
        </p>
        <div style="width:32px;height:1px;background:#Daccb4;margin:0 0 28px;"></div>
        <h1 style="font-size:2rem;margin:0 0 16px;font-weight:400;line-height:1.1;">
          Thank you, ${firstName}.
        </h1>
        <p style="line-height:1.7;color:#444;margin:0 0 16px;">
          We've received your interest in <strong>T's Armoire Summer Club</strong> at the Moxy Hotel Pool
          on <strong>June 26</strong> at <strong>1PM</strong>. Our guest list is curated and intimate — if selected, we'll reach
          out to you directly. Keep an eye on your inbox.
        </p>
        <p style="letter-spacing:.2em;font-size:10px;text-transform:uppercase;color:rgba(21,20,20,0.55);margin:32px 0 0;">
          T's Armoire Summer Club — June 26 · 1PM · Moxy Hotel Pool
        </p>
        <p style="line-height:1.7;color:#888;font-size:.875rem;margin:24px 0 0;">
          — The T's Armoire Team
        </p>
      </div>
    </div>
  `;

  /* Plain-text alternative — improves deliverability and covers clients
     that don't render HTML */
  const plainBody =
    `Thank you, ${firstName}.\n\n` +
    `We've received your interest in T's Armoire Summer Club at the Moxy Hotel Pool on June 26 at 1PM. ` +
    `Our guest list is curated and intimate — if selected, we'll reach out to you directly. ` +
    `Keep an eye on your inbox.\n\n` +
    `— The T's Armoire Team`;

  MailApp.sendEmail({
    to: d.email,
    subject: "T's Armoire Summer Club — You're on the list",
    htmlBody: htmlBody,
    body: plainBody
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
