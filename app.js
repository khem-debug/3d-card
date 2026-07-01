(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const stage    = $('stage');
  const cardWrap = $('cardWrap');
  const card     = $('card');
  const faces     = document.querySelectorAll('.face');

  /* ---------------- 3D orientation ---------------- */
  // ry/rx = current base rotation (drag/gyro), independent from the flip.
  let ry = 0, rx = 0;            // degrees
  let targetRy = 0, targetRx = 0;
  let flipped = false;

  const MAX_TILT = 22;           // clamp for pointer tilt

  function render() {
    // smooth follow
    ry += (targetRy - ry) * 0.16;
    rx += (targetRx - rx) * 0.16;
    cardWrap.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  /* ---------------- light / holo tracking ---------------- */
  // px,py in 0..1 across the card. Drives glare + foil shift on every face.
  function setLight(px, py) {
    const gx = (px * 100).toFixed(1) + '%';
    const gy = (py * 100).toFixed(1) + '%';
    const hx = (px * 100).toFixed(1) + '%';
    const hy = (py * 100).toFixed(1) + '%';
    faces.forEach((f) => {
      f.style.setProperty('--gx', gx);
      f.style.setProperty('--gy', gy);
      f.style.setProperty('--hx', hx);
      f.style.setProperty('--hy', hy);
    });
  }
  setLight(0.5, 0.4);

  /* ---------------- pointer drag ---------------- */
  let dragging = false, lastX = 0, lastY = 0, moved = 0;

  function pointerFromEvent(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  function onDown(e) {
    dragging = true; moved = 0;
    const p = pointerFromEvent(e);
    lastX = p.x; lastY = p.y;
  }

  function onMove(e) {
    const p = pointerFromEvent(e);
    // light always tracks pointer over the stage
    const r = stage.getBoundingClientRect();
    setLight((p.x - r.left) / r.width, (p.y - r.top) / r.height);

    if (!dragging) return;
    const dx = p.x - lastX, dy = p.y - lastY;
    lastX = p.x; lastY = p.y;
    moved += Math.abs(dx) + Math.abs(dy);
    targetRy += dx * 0.4;
    targetRx = clamp(targetRx - dy * 0.4, -60, 60);
    if (e.cancelable) e.preventDefault();
  }

  function onUp() { dragging = false; }

  stage.addEventListener('mousedown', onDown);
  stage.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  stage.addEventListener('touchstart', onDown, { passive: true });
  stage.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  // hover light on desktop when not dragging
  stage.addEventListener('mouseleave', () => setLight(0.5, 0.4));

  /* ---------------- gyroscope ---------------- */
  let gyroOn = false;
  const gyroBtn = $('gyroBtn');

  function handleOrientation(e) {
    if (!gyroOn) return;
    const g = clamp((e.gamma || 0), -45, 45);   // left/right
    const b = clamp((e.beta || 0) - 45, -45, 45); // front/back (offset for holding phone up)
    targetRy = g * 0.9;
    targetRx = clamp(-b * 0.7, -MAX_TILT, MAX_TILT);
    setLight(0.5 + g / 90, 0.5 - b / 90);
  }

  async function toggleGyro() {
    if (gyroOn) {
      gyroOn = false;
      gyroBtn.classList.remove('on');
      window.removeEventListener('deviceorientation', handleOrientation);
      return;
    }
    // iOS 13+ permission
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') { toast('ไม่ได้รับสิทธิ์เซ็นเซอร์'); return; }
      } catch (_) { toast('อุปกรณ์ไม่รองรับไจโร'); return; }
    }
    gyroOn = true;
    gyroBtn.classList.add('on');
    window.addEventListener('deviceorientation', handleOrientation);
    toast('เอียงมือถือเพื่อหมุนการ์ด');
  }
  gyroBtn.addEventListener('click', toggleGyro);

  /* ---------------- flip ---------------- */
  $('flipBtn').addEventListener('click', () => {
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
  });
  // tap card to flip (only if it wasn't a drag)
  stage.addEventListener('click', () => {
    if (moved < 8) {
      flipped = !flipped;
      card.classList.toggle('flipped', flipped);
    }
  });

  /* ---------------- photo upload ---------------- */
  const photoLayer = $('photoLayer');
  const emptyHint  = $('emptyHint');
  $('fileInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    photoLayer.style.backgroundImage = `url("${url}")`;
    emptyHint.style.display = 'none';
    if (!flipped) { /* keep front showing */ }
    toast('ได้การ์ดใหม่แล้ว ✨');
  });

  /* ---------------- info sheet ---------------- */
  const sheet = $('sheet'), scrim = $('sheetScrim');
  function openSheet() { sheet.classList.add('show'); scrim.classList.add('show'); }
  function closeSheet() { sheet.classList.remove('show'); scrim.classList.remove('show'); }
  $('infoBtn').addEventListener('click', openSheet);
  scrim.addEventListener('click', closeSheet);

  const inPower = $('inPower'), powerOut = $('powerOut');
  inPower.addEventListener('input', () => powerOut.textContent = inPower.value);

  $('saveBtn').addEventListener('click', () => {
    const title   = ($('inTitle').value || 'UNTITLED').toUpperCase();
    const sub      = $('inSub').value || '—';
    const rarity   = $('inRarity').value;
    const element  = $('inElement').value;
    const power    = Number(inPower.value).toLocaleString();
    const lore     = $('inLore').value || 'ยังไม่มีคำอธิบาย';

    $('cardTitleFront').textContent = title;
    $('cardSubFront').textContent   = sub;
    $('cardTitleBack').textContent  = title;
    $('statRarity').textContent     = rarity;
    $('statPower').textContent      = power;
    $('statElement').textContent    = element;
    $('cardLore').textContent       = lore;
    $('rarityBadge').textContent    = rarity;

    closeSheet();
    toast('บันทึกข้อมูลการ์ดแล้ว');
  });

  /* ---------------- tiny toast ---------------- */
  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed', left: '50%', bottom: '104px', transform: 'translateX(-50%)',
        zIndex: 20, padding: '10px 18px', borderRadius: '999px',
        background: 'rgba(10,14,30,.9)', border: '1px solid rgba(94,240,255,.4)',
        color: '#e9f6ff', fontSize: '13px', letterSpacing: '.5px',
        boxShadow: '0 0 24px rgba(94,240,255,.3)', pointerEvents: 'none',
        opacity: '0', transition: 'opacity .25s, transform .25s',
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.style.opacity = '0'; }, 1800);
  }

  /* ---------------- intro idle sway ---------------- */
  let introN = 0;
  const introTimer = setInterval(() => {
    if (dragging || gyroOn) { clearInterval(introTimer); return; }
    introN += 0.05;
    targetRy = Math.sin(introN) * 14;
    targetRx = Math.cos(introN * 0.7) * 6;
    setLight(0.5 + Math.sin(introN) * 0.3, 0.4);
    if (introN > Math.PI * 4) { clearInterval(introTimer); targetRy = 0; targetRx = 0; }
  }, 40);
  // stop idle sway on first interaction
  ['mousedown', 'touchstart'].forEach((ev) =>
    stage.addEventListener(ev, () => clearInterval(introTimer), { once: true }));
})();
