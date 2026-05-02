/* ── State ───────────────────────────────────────────────── */
let cur              = 0;
const N              = 5;
let busy             = false;
let selectedDate     = null;
let selectedSlot     = null;
let selectedPartyType = null;
let slotData         = {};
let caps             = { solo: 1, plus_one: 4, total: 5 }; /* updated from server on fetchSlots() */

const STORE_KEY  = 'tsa_cafe_reservations_v2';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdlHZXb0tZi0JZAD9vwQiDax3xZxk4WMnRI7bdKQe1d4bkdubX8rq6YWQJ2fGJHtpDdw/exec';

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
  /* Hide forward on what-to-expect (2), slot form (3), and thank-you (4) */
  btnFwd.style.display  = (cur >= N - 3) ? 'none' : 'flex';
  btnBack.style.display = (cur === N - 1) ? 'none' : 'flex';
}

/* ── Transition ─────────────────────────────────────────── */
function go(dir) {
  if (busy) return;
  const next = cur + dir;
  if (next < 0 || next >= N) return;

  busy = true;

  curtain.style.transition = 'transform 0.42s cubic-bezier(0.76, 0, 0.24, 1)';
  curtain.style.transformOrigin = 'bottom';
  curtain.style.transform = 'scaleY(1)';

  setTimeout(() => {
    pages[cur].classList.remove('active', 'entering');
    pages[next].classList.remove('entering');
    void pages[next].offsetWidth;
    pages[next].classList.add('active');
    cur = next;
    syncChrome();
    const focusTarget = pages[cur].querySelector('input, button:not(:disabled)');
    if (focusTarget) focusTarget.focus({ preventScroll: true });

    if (cur === 3) fetchSlots();

    setTimeout(() => {
      curtain.style.transition = 'transform 0.48s cubic-bezier(0.76, 0, 0.24, 1)';
      curtain.style.transformOrigin = 'top';
      curtain.style.transform = 'scaleY(0)';

      setTimeout(() => {
        pages[cur].classList.add('entering');
        if (window.gtag) gtag('event', 'page_view', { page_path: '/page-' + (cur + 1) });
        busy = false;
      }, 80);
    }, 60);
  }, 440);
}

/* ── Slot Availability ───────────────────────────────────── */
function fetchSlots() {
  fetch(SCRIPT_URL + '?action=slots')
    .then(res => res.json())
    .then(data => {
      if (data.slots) {
        slotData = data.slots;
        if (data.caps) caps = data.caps;
        if (selectedDate) updateSlotAvailability();
      }
    })
    .catch(() => {}); /* fail open — all slots remain selectable */
}

function updateSlotAvailability() {
  const slotCounts = (slotData[selectedDate] || {});
  let selectedIsWaitlist = false;
  document.querySelectorAll('#slot-times .slot-btn').forEach(btn => {
    const slot = btn.dataset.slot;
    const info = slotCounts[slot] || { solo: 0, plus_one: 0, total: 0 };
    let isFull = info.total >= caps.total;
    if (!isFull && selectedPartyType === 'solo')     isFull = info.solo     >= caps.solo;
    if (!isFull && selectedPartyType === 'plus_one') isFull = info.plus_one >= caps.plus_one;
    btn.classList.toggle('waitlist', isFull);
    if (btn.classList.contains('selected') && isFull) selectedIsWaitlist = true;
  });
  if (selectedSlot) {
    const notice = document.getElementById('slot-waitlist-notice');
    notice.textContent = selectedIsWaitlist
      ? 'You are joining the waitlist for this slot. We will be in touch if a spot becomes available.'
      : selectedPartyType === 'solo'
        ? 'You are reserving a table for one.'
        : 'You are reserving a table for two. Should your party exceed two guests, please contact us directly.';
    notice.classList.add('visible');
  }
}

function selectDate(btn) {
  document.querySelectorAll('#slot-dates .slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedDate = btn.dataset.date;

  document.querySelectorAll('#slot-times .slot-btn').forEach(b => b.classList.remove('selected'));
  selectedSlot = null;
  document.getElementById('slot-form-wrap').classList.remove('visible');
  document.getElementById('slot-waitlist-notice').classList.remove('visible');
  document.getElementById('slot-error').style.display = 'none';

  document.getElementById('slot-party-wrap').classList.add('visible');

  if (selectedPartyType) {
    document.getElementById('slot-times-wrap').classList.add('visible');
    updateSlotAvailability();
  } else {
    document.getElementById('slot-times-wrap').classList.remove('visible');
  }
}

function selectSlot(btn) {
  document.querySelectorAll('#slot-times .slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSlot = btn.dataset.slot;
  document.getElementById('slot-error').style.display = 'none';

  const notice = document.getElementById('slot-waitlist-notice');
  const isWaitlist = btn.classList.contains('waitlist');
  notice.textContent = isWaitlist
    ? 'You are joining the waitlist for this slot. We will be in touch if a spot becomes available.'
    : selectedPartyType === 'solo'
      ? 'You are reserving a table for one.'
      : 'You are reserving a table for two. Should your party exceed two guests, please contact us directly.';
  notice.classList.add('visible');

  document.getElementById('slot-form-wrap').classList.add('visible');
  setTimeout(() => {
    document.getElementById('slot-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);
}

function selectParty(btn) {
  document.querySelectorAll('#slot-party .slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPartyType = btn.dataset.party;
  document.getElementById('party-error').style.display = 'none';
  if (selectedDate) {
    document.getElementById('slot-times-wrap').classList.add('visible');
    updateSlotAvailability();
    setTimeout(() => {
      document.getElementById('slot-times-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  }
}

/* ── Registration ────────────────────────────────────────── */
function setFieldError(fieldEl, errEl, msg) {
  fieldEl.classList.add('invalid');
  errEl.textContent = msg;
}

function clearFieldError(fieldEl) {
  fieldEl.classList.remove('invalid');
}

document.getElementById('f-name').addEventListener('input', () =>
  clearFieldError(document.getElementById('field-name')));
document.getElementById('f-email').addEventListener('input', () =>
  clearFieldError(document.getElementById('field-email')));
document.getElementById('f-phone').addEventListener('input', () =>
  clearFieldError(document.getElementById('field-phone')));

function handleSubmit(e) {
  e.preventDefault();

  const nameVal   = document.getElementById('f-name').value.trim();
  const emailVal  = document.getElementById('f-email').value.trim();
  const phoneVal  = document.getElementById('f-phone').value.trim();
  const igVal     = document.getElementById('f-ig').value.trim();
  const tiktokVal = document.getElementById('f-tiktok').value.trim();

  const fieldName  = document.getElementById('field-name');
  const fieldEmail = document.getElementById('field-email');
  const fieldPhone = document.getElementById('field-phone');
  const errName    = document.getElementById('err-name');
  const errEmail   = document.getElementById('err-email');
  const errPhone   = document.getElementById('err-phone');
  const partyErr   = document.getElementById('party-error');
  const slotErr    = document.getElementById('slot-error');

  clearFieldError(fieldName);
  clearFieldError(fieldEmail);
  clearFieldError(fieldPhone);
  partyErr.style.display = 'none';
  slotErr.style.display  = 'none';

  let valid = true;

  if (!selectedDate || !selectedSlot) {
    slotErr.textContent = 'Please select a date and time';
    slotErr.style.display = 'block';
    valid = false;
  }

  if (!selectedPartyType) {
    partyErr.textContent = 'Please select your experience';
    partyErr.style.display = 'block';
    valid = false;
  }

  if (!nameVal || nameVal.length < 2) {
    setFieldError(fieldName, errName, 'Please enter your full name');
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

  const phoneRx = /^[+\d][\d\s\-().]{5,}$/;
  if (!phoneVal) {
    setFieldError(fieldPhone, errPhone, 'Please enter your WhatsApp number');
    valid = false;
  } else if (!phoneRx.test(phoneVal)) {
    setFieldError(fieldPhone, errPhone, 'Please enter a valid phone number');
    valid = false;
  }

  if (!valid) {
    const firstError = document.querySelector('#slot-error[style*="block"], #party-error[style*="block"], .field.invalid');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  /* Loading state */
  const btn = document.getElementById('rsvp-btn');
  btn.textContent = 'Requesting →';
  btn.disabled = true;

  const entry = {
    id:           'tsa-' + Date.now(),
    name:         nameVal,
    email:        emailVal,
    phone:        phoneVal,
    instagram:    igVal     || null,
    tiktok:       tiktokVal || null,
    party_type:   selectedPartyType,
    date:         selectedDate,
    time_slot:    selectedSlot,
    registered_at: new Date().toISOString()
  };

  fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(entry),
    mode: 'cors'
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      if (data.status === 'Waitlist') {
        document.getElementById('p4-tag').textContent    = 'You\'re on the List';
        document.getElementById('p4-headline').innerHTML = 'You\'re on<br><em>the list.</em>';
        document.getElementById('p4-body').textContent   = 'This slot is full, but you\'re on the waitlist. We\'ll reach out if a spot opens up.';
        go(1);
      } else {
        document.getElementById('p4-tag').textContent    = 'Request Received';
        document.getElementById('p4-headline').innerHTML = 'We\'ll be<br><em>in touch.</em>';
        document.getElementById('p4-body').textContent   = 'Your request has been received. We\'ll reach out to confirm shortly.';
        if (window.gtag) gtag('event', 'reservation_complete', { event_category: 'engagement' });
        go(1);
      }
    } else if (data.error === 'duplicate') {
      setFieldError(fieldEmail, errEmail, 'Already reserved with this email');
      btn.textContent = 'Request Reservation →';
      btn.disabled = false;
    } else {
      throw new Error(data.error || 'server_error');
    }
  })
  .catch(() => {
    slotErr.textContent = 'Something went wrong — please try again';
    slotErr.style.display = 'block';
    btn.textContent = 'Request Reservation →';
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
  if (cur === 2 || cur === 3) return;
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    go(dx < 0 ? 1 : -1);
  }
}, { passive: true });

/* ── Init ────────────────────────────────────────────────── */
syncChrome();
