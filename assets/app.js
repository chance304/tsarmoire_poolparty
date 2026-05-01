/* ── State ───────────────────────────────────────────────── */
let cur          = 0;
const N          = 5;
let busy         = false;
let selectedDate = null;
let selectedSlot = null;
let slotData     = {};
let slotCapacity = 10; /* updated from server on fetchSlots() */

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
const STORE_KEY  = 'tsa_cafe_reservations';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyKuSCDIDko0cKfjoDf0yDtHA3cj_ErEvhNsvsbA5Eq4AvV6QBgwYQhmVUNuYeR5Mhb/exec';

function fetchSlots() {
  fetch(SCRIPT_URL + '?action=slots')
    .then(res => res.json())
    .then(data => {
      if (data.slots) {
        slotData = data.slots;
        if (data.capacity) slotCapacity = data.capacity;
        if (selectedDate) updateSlotAvailability();
      }
    })
    .catch(() => {}); /* fail open — all slots remain selectable */
}

function updateSlotAvailability() {
  const counts = (slotData[selectedDate] || {});
  document.querySelectorAll('#slot-times .slot-btn').forEach(btn => {
    const slot = btn.dataset.slot;
    const isFull = (counts[slot] || 0) >= slotCapacity;
    btn.classList.toggle('full', isFull);
    btn.disabled = isFull;
    if (isFull && btn.classList.contains('selected')) {
      btn.classList.remove('selected');
      selectedSlot = null;
      document.getElementById('slot-form-wrap').classList.remove('visible');
    }
  });
}

function selectDate(btn) {
  document.querySelectorAll('.slot-dates .slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedDate = btn.dataset.date;

  document.querySelectorAll('#slot-times .slot-btn').forEach(b => b.classList.remove('selected'));
  selectedSlot = null;
  document.getElementById('slot-form-wrap').classList.remove('visible');
  document.getElementById('slot-error').style.display = 'none';

  document.getElementById('slot-times-wrap').classList.add('visible');
  updateSlotAvailability();
}

function selectSlot(btn) {
  if (btn.disabled) return;
  document.querySelectorAll('#slot-times .slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSlot = btn.dataset.slot;
  document.getElementById('slot-error').style.display = 'none';

  document.getElementById('slot-form-wrap').classList.add('visible');
  setTimeout(() => {
    document.getElementById('slot-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);
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
  const slotErr    = document.getElementById('slot-error');

  clearFieldError(fieldName);
  clearFieldError(fieldEmail);
  slotErr.style.display = 'none';

  let valid = true;

  if (!selectedDate || !selectedSlot) {
    slotErr.textContent = 'Please select a date and time';
    slotErr.style.display = 'block';
    valid = false;
  }

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
    setFieldError(fieldEmail, errEmail, 'Already reserved with this email');
    return;
  }

  /* Loading state */
  const btn = document.getElementById('rsvp-btn');
  btn.textContent = 'Reserving →';
  btn.disabled = true;

  const entry = {
    id:           'tsa-' + Date.now(),
    name:         nameVal,
    email:        emailVal,
    instagram:    igVal     || null,
    tiktok:       tiktokVal || null,
    phone:        phoneVal  || null,
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
      existing.push(entry);
      localStorage.setItem(STORE_KEY, JSON.stringify(existing));
      if (window.gtag) gtag('event', 'reservation_complete', { event_category: 'engagement' });
      go(1);
    } else if (data.error === 'duplicate') {
      setFieldError(fieldEmail, errEmail, 'Already reserved with this email');
      existing.push(entry);
      localStorage.setItem(STORE_KEY, JSON.stringify(existing));
      btn.textContent = 'Reserve →';
      btn.disabled = false;
    } else if (data.error === 'slot_full') {
      slotErr.textContent = 'This slot is now full — please select another time';
      slotErr.style.display = 'block';
      document.querySelectorAll('#slot-times .slot-btn.selected').forEach(b => b.classList.remove('selected'));
      selectedSlot = null;
      document.getElementById('slot-form-wrap').classList.remove('visible');
      btn.textContent = 'Reserve →';
      btn.disabled = false;
      fetchSlots();
    } else {
      throw new Error(data.error || 'server_error');
    }
  })
  .catch(() => {
    setFieldError(fieldEmail, errEmail, 'Something went wrong — please try again');
    btn.textContent = 'Reserve →';
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
