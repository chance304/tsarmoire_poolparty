/* ── State ───────────────────────────────────────────────── */
let cur          = 0;
const N          = 5;
let busy         = false;
let socialConsent = null;

const pages    = document.querySelectorAll('.page');
const curtain  = document.getElementById('curtain');
const btnBack  = document.getElementById('btn-back');
const btnFwd   = document.getElementById('btn-fwd');
const counter  = document.getElementById('counter');
const progFill = document.getElementById('prog-fill');

/* ── Utilities ───────────────────────────────────────────── */
const pad = n => String(n + 1).padStart(2, '0');

function syncChrome() {
  counter.textContent = `${pad(cur)} / ${pad(N - 1)}`;
  progFill.style.width = `${((cur + 1) / N) * 100}%`;
  btnBack.disabled = cur === 0;
  /* Hide forward on consent (2), form (3), and thank-you (4) — each uses its own action */
  btnFwd.style.display  = (cur >= N - 3) ? 'none' : 'flex';
  btnBack.style.display = (cur === N - 1) ? 'none' : 'flex';
}

/* ── Transition ─────────────────────────────────────────── */
/*
  Curtain: a vertical wipe.
  1. scaleY(0→1) from bottom → black covers screen
  2. Swap page content
  3. scaleY(1→0) from top → black reveals new page
*/
function go(dir) {
  if (busy) return;
  const next = cur + dir;
  if (next < 0 || next >= N) return;

  busy = true;

  /* Phase 1 — curtain closes (wipes UP) */
  curtain.style.transition = 'transform 0.42s cubic-bezier(0.76, 0, 0.24, 1)';
  curtain.style.transformOrigin = 'bottom';
  curtain.style.transform = 'scaleY(1)';

  setTimeout(() => {
    /* Phase 2 — swap pages */
    pages[cur].classList.remove('active', 'entering');
    pages[next].classList.remove('entering');
    void pages[next].offsetWidth; /* force reflow before re-adding class */
    pages[next].classList.add('active');
    cur = next;
    syncChrome();
    const focusTarget = pages[cur].querySelector('input, button:not(:disabled)');
    if (focusTarget) focusTarget.focus({ preventScroll: true });

    /* Tiny pause so curtain holds, then open */
    setTimeout(() => {
      /* Phase 3 — curtain opens (wipes UP from top) */
      curtain.style.transition = 'transform 0.48s cubic-bezier(0.76, 0, 0.24, 1)';
      curtain.style.transformOrigin = 'top';
      curtain.style.transform = 'scaleY(0)';

      /* Phase 4 — stagger content in */
      setTimeout(() => {
        pages[cur].classList.add('entering');
        if (window.gtag) gtag('event', 'page_view', { page_path: '/page-' + (cur + 1) });
        busy = false;
      }, 80);

    }, 60);

  }, 440);
}

/* ── Consent ─────────────────────────────────────────────── */
function handleConsent(choice) {
  socialConsent = choice;
  /* If the enter-transition is still running, wait for it to finish */
  if (busy) {
    const wait = setInterval(() => { if (!busy) { clearInterval(wait); go(1); } }, 50);
  } else {
    go(1);
  }
}

/* ── Registration ────────────────────────────────────────── */
const STORE_KEY  = 'tsa_summer_club_registrations';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyzt5HXNo0QtpVyM5KQYyCIdyq8Fls5FE3udj9a9bH4EJcCcywSk96CgkTPSAydZuNq/exec';

function setFieldError(fieldEl, errEl, msg) {
  fieldEl.classList.add('invalid');
  errEl.textContent = msg;
}

function clearFieldError(fieldEl) {
  fieldEl.classList.remove('invalid');
}

/* Clear error as soon as the user edits the field */
document.getElementById('f-name').addEventListener('input', () =>
  clearFieldError(document.getElementById('field-name')));
document.getElementById('f-email').addEventListener('input', () =>
  clearFieldError(document.getElementById('field-email')));

function handleSubmit(e) {
  e.preventDefault();

  const nameVal   = document.getElementById('f-name').value.trim();
  const emailVal  = document.getElementById('f-email').value.trim();
  const igVal     = document.getElementById('f-ig').value.trim();
  const tiktokVal = document.getElementById('f-tiktok').value.trim();
  const phoneVal  = document.getElementById('f-phone').value.trim();

  const fieldName  = document.getElementById('field-name');
  const fieldEmail = document.getElementById('field-email');
  const errName    = document.getElementById('err-name');
  const errEmail   = document.getElementById('err-email');

  clearFieldError(fieldName);
  clearFieldError(fieldEmail);

  let valid = true;

  if (!nameVal) {
    setFieldError(fieldName, errName, 'Please enter your name');
    valid = false;
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal) {
    setFieldError(fieldEmail, errEmail, 'Please enter your email');
    valid = false;
  } else if (!emailRx.test(emailVal)) {
    setFieldError(fieldEmail, errEmail, 'Please enter a valid email');
    valid = false;
  }

  if (!valid) return;

  /* Duplicate check */
  const existing = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  if (existing.some(r => r.email.toLowerCase() === emailVal.toLowerCase())) {
    setFieldError(fieldEmail, errEmail, 'Already registered with this email');
    return;
  }

  /* Loading state */
  const btn = document.getElementById('rsvp-btn');
  btn.textContent = 'Sending →';
  btn.disabled = true;

  /* Build entry */
  const entry = {
    id:             'tsa-' + Date.now(),
    name:           nameVal,
    email:          emailVal,
    instagram:      igVal     || null,
    tiktok:         tiktokVal || null,
    phone:          phoneVal  || null,
    social_consent: socialConsent,
    registered_at:  new Date().toISOString()
  };

  /* POST to Google Apps Script — wait for confirmed response */
  fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(entry),
    mode: 'cors'
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      /* Persist only after server confirms */
      existing.push(entry);
      localStorage.setItem(STORE_KEY, JSON.stringify(existing));
      if (window.gtag) gtag('event', 'registration_complete', { event_category: 'engagement' });
      go(1);
    } else if (data.error === 'duplicate') {
      setFieldError(fieldEmail, errEmail, 'Already registered with this email');
      existing.push(entry); /* block re-submit from same browser */
      localStorage.setItem(STORE_KEY, JSON.stringify(existing));
      btn.textContent = 'Register Interest →';
      btn.disabled = false;
    } else {
      throw new Error(data.error || 'server_error');
    }
  })
  .catch(() => {
    setFieldError(fieldEmail, errEmail, 'Something went wrong — please try again');
    btn.textContent = 'Register Interest →';
    btn.disabled = false;
  });
}

/* ── Keyboard ────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { if (cur !== 2 && cur !== 3) go(1); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   go(-1);
  if (e.key === 'Enter'      && cur !== 2 && cur !== 3) go(1);
});

/* ── Touch / swipe ───────────────────────────────────────── */
let tx = 0, ty = 0;
document.addEventListener('touchstart', e => {
  tx = e.touches[0].clientX;
  ty = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (cur === 2 || cur === 3) return; /* consent + form pages: no swipe nav */
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  /* only fire if gesture is clearly horizontal, not a scroll attempt */
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    go(dx < 0 ? 1 : -1);
  }
}, { passive: true });

/* ── Init ────────────────────────────────────────────────── */
syncChrome();
