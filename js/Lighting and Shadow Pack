/* js/fx.js — 光影包（Bloom / 手電筒 / 槍口火光 / 閃電 / 顆粒 / 調色） */
(() => {
  'use strict';
  const view = document.getElementById('view');
  if (!view) return;

  const PRESETS = [
    { name: '關閉', bloom: 0,    grain: 0,     dark: 0,    grade: '' },
    { name: '低',   bloom: 0,    grain: 0,     dark: 0.45, grade: 'contrast(1.06) saturate(0.92)' },
    { name: '中',   bloom: 0.35, grain: 0.045, dark: 0.55, grade: 'contrast(1.1) saturate(0.85)' },
    { name: '高',   bloom: 0.55, grain: 0.06,  dark: 0.62, grade: 'contrast(1.15) saturate(0.8) sepia(0.08)' }
  ];
  let q = 2;
  try {
    const s = localStorage.getItem('zs_fx');
    if (s !== null && +s >= 0 && +s < PRESETS.length) q = +s;
  } catch (e) {}

  const S = { flashlight: true, muzzle: 0, hurt: 0, hp: 1, lightning: 0, bolt2: 0,
              shake: 0, active: true, storm: true, nextBolt: 12 + Math.random() * 20, t: 0 };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 疊加用的 canvas ---------- */
  function mk(id, blend) {
    const c = document.createElement('canvas');
    c.id = id;
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100vw', height: '100dvh',
                             pointerEvents: 'none', mixBlendMode: blend });
    return c;
  }
  const glowC = mk('fxGlow', 'screen');   // 發光層（加亮）
  const shadeC = mk('fxShade', 'normal'); // 陰影層（變暗）
  view.after(glowC);
  glowC.after(shadeC);
  const gctx = glowC.getContext('2d');
  const sctx = shadeC.getContext('2d');
  const bloomC = document.createElement('canvas');
  const bctx = bloomC.getContext('2d');
  let bloomOK = 'filter' in CanvasRenderingContext2D.prototype;

  // 預先產生膠片顆粒
  const grains = [];
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    grains.push(sctx.createPattern(c, 'repeat'));
  }

  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, Math.round(innerWidth));
    H = Math.max(1, Math.round(innerHeight));
    glowC.width = shadeC.width = W;
    glowC.height = shadeC.height = H;
    bloomC.width = Math.max(1, W >> 2);
    bloomC.height = Math.max(1, H >> 2);
  }
  addEventListener('resize', resize);
  resize();

  /* ---------- 調色（CSS filter）---------- */
  let lastFilter = '';
  function grade() {
    let f = PRESETS[q].grade;
    if (q > 0) {
      const low = Math.max(0, 0.5 - S.hp) * 1.2;
      if (low > 0) f += ` grayscale(${low.toFixed(2)})`;                     // 血少畫面變灰
      if (S.lightning > 0.05) f += ` brightness(${(1 + S.lightning * 0.8).toFixed(2)})`;
    }
    f = f.trim() || 'none';
    if (f !== lastFilter) { view.style.filter = f; lastFilter = f; }
  }

  /* ---------- 鏡頭震動 ---------- */
  let lastTr = '';
  function shakeIt() {
    const k = reduceMotion ? 0 : S.shake * S.shake * 10;
    const tr = k > 0.05 ? `translate($${((Math.random() * 2 - 1) * k).toFixed(1)}px,$${((Math.random() * 2 - 1) * k).toFixed(1)}px)` : '';
    if (tr !== lastTr) { view.style.transform = tr; glowC.style.transform = tr; lastTr = tr; }
  }

  /* ---------- 閃電 ---------- */
  function bolt() {
    S.lightning = 1;
    S.bolt2 = 0.12 + Math.random() * 0.1;
    const delay = 0.4 + Math.random() * 1.6;
    if (window.SFX) window.SFX.thunder(delay);
  }

  /* ---------- 每一幀 ---------- */
  function draw() {
    const p = PRESETS[q];
    gctx.clearRect(0, 0, W, H);
    sctx.clearRect(0, 0, W, H);
    if (q === 0) return;
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2, m = Math.min(W, H);
    let g;

    // 1. Bloom：把亮的地方擷取出來、模糊，再疊回去
    if (p.bloom > 0 && bloomOK) {
      try {
        bctx.filter = `brightness(0.7) contrast(3) saturate(1.4) blur(${Math.max(2, bloomC.width / 120).toFixed(1)}px)`;
        bctx.clearRect(0, 0, bloomC.width, bloomC.height);
        bctx.drawImage(view, 0, 0, bloomC.width, bloomC.height);
        gctx.globalAlpha = p.bloom;
        gctx.drawImage(bloomC, 0, 0, W, H);
        gctx.globalAlpha = 1;
      } catch (e) { bloomOK = false; }
    }

    // 2. 槍口火光
    if (S.muzzle > 0) {
      const a = Math.min(1, S.muzzle);
      g = gctx.createRadialGradient(cx, H * 0.92, 0, cx, H * 0.92, m * 0.9);
      g.addColorStop(0, `rgba(255,200,110,${0.6 * a})`);
      g.addColorStop(0.4, `rgba(255,140,50,${0.25 * a})`);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      gctx.fillStyle = g;
      gctx.fillRect(0, 0, W, H);
    }

    // 3. 閃電
    if (S.lightning > 0) {
      gctx.fillStyle = `rgba(190,210,255,${0.35 * S.lightning})`;
      gctx.fillRect(0, 0, W, H);
    }

    // 4. 手電筒暖色光心
    if (S.flashlight) {
      g = gctx.createRadialGradient(cx, cy, 0, cx, cy, m * 0.35);
      g.addColorStop(0, 'rgba(255,225,180,0.08)');
      g.addColorStop(1, 'rgba(255,225,180,0)');
      gctx.fillStyle = g;
      gctx.fillRect(0, 0, W, H);
    }

    // 5. 黑暗 + 手電筒光圈
    const light = Math.min(1, S.muzzle * 0.8 + S.lightning * 0.9);
    const dark = p.dark * (1 - light);
    if (dark > 0.01) {
      const flick = 1 + Math.sin(S.t * 31) * 0.015 + (Math.random() < 0.006 ? -0.15 : 0); // 電池不穩的閃爍
      const r0 = S.flashlight ? m * 0.16 * flick : 0;
      g = sctx.createRadialGradient(cx, cy, r0, cx, cy, R);
      if (S.flashlight) {
        g.addColorStop(0, 'rgba(3,5,12,0)');
        g.addColorStop(0.25, `rgba(3,5,12,${(dark * 0.45).toFixed(3)})`);
        g.addColorStop(1, `rgba(2,3,8,${Math.min(0.95, dark * 1.35).toFixed(3)})`);
      } else {
        g.addColorStop(0, `rgba(3,5,12,${(dark * 0.6).toFixed(3)})`);
        g.addColorStop(1, `rgba(2,3,8,${Math.min(0.97, dark * 1.5).toFixed(3)})`);
      }
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, W, H);
      sctx.fillStyle = 'rgba(20,40,80,0.06)'; // 冷色月光
      sctx.fillRect(0, 0, W, H);
    }

    // 6. 受傷 / 低血量紅色脈動
    const pulse = S.hp < 0.35 ? (0.5 + 0.5 * Math.sin(S.t * 6)) * (0.35 - S.hp) / 0.35 : 0;
    const red = Math.max(pulse * 0.45, S.hurt * 0.5);
    if (red > 0.01) {
      g = sctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
      g.addColorStop(0, 'rgba(160,0,10,0)');
      g.addColorStop(1, `rgba(160,0,10,${red.toFixed(3)})`);
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, W, H);
    }

    // 7. 膠片顆粒
    if (p.grain > 0) {
      sctx.save();
      sctx.globalAlpha = p.grain;
      sctx.fillStyle = grains[(Math.random() * grains.length) | 0];
      sctx.translate(-Math.random() * 128, -Math.random() * 128);
      sctx.fillRect(0, 0, W + 128, H + 128);
      sctx.restore();
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.t += dt;
    S.muzzle = Math.max(0, S.muzzle - dt * 14);
    S.hurt = Math.max(0, S.hurt - dt * 2.5);
    S.shake = Math.max(0, S.shake - dt * 3);
    S.lightning = Math.max(0, S.lightning - dt * 3.5);
    if (S.bolt2 > 0) { S.bolt2 -= dt; if (S.bolt2 <= 0) S.lightning = Math.max(S.lightning, 0.8); }
    if (S.active && S.storm && q > 0) {
      S.nextBolt -= dt;
      if (S.nextBolt <= 0) { bolt(); S.nextBolt = 15 + Math.random() * 30; }
    }
    shakeIt();
    grade();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- 💡 畫質按鈕 ---------- */
  function toast(text) {
    const el = document.getElementById('msg');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => el.classList.remove('show'), 1200);
  }
  const row = document.querySelector('.iconRow');
  let btn = null;
  if (row) {
    btn = document.createElement('button');
    btn.className = 'iconBtn';
    btn.id = 'fxBtn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>';
    row.prepend(btn);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      setQuality((q + 1) % PRESETS.length, true);
      btn.blur();
    });
  }
  function setQuality(i, announce) {
    q = Math.max(0, Math.min(PRESETS.length - 1, i | 0));
    try { localStorage.setItem('zs_fx', String(q)); } catch (e) {}
    if (btn) {
      btn.setAttribute('aria-label', `光影效果：${PRESETS[q].name}`);
      btn.style.opacity = q === 0 ? '0.5' : '1';
    }
    if (announce) toast(`💡 光影：${PRESETS[q].name}`);
  }
  setQuality(q, false);

  /* ---------- 給射線投射（raycaster）用的光照計算 ---------- */
  // dist = 牆壁距離，sx = 該直線在畫面的橫向位置 0~1；回傳亮度倍數
  function shade(dist, sx = 0.5) {
    if (q === 0) return 1;
    const amb = 1 - PRESETS[q].dark * 0.6;
    const fog = Math.exp(-dist * 0.12);
    let beam = 0;
    if (S.flashlight) {
      const off = Math.abs(sx - 0.5) * 2;
      beam = Math.max(0, 1 - off * off * 2.5) / (1 + dist * dist * 0.03);
    }
    const flash = (S.muzzle * 0.7 + S.lightning * 0.9) / (1 + dist * 0.15);
    return Math.min(1.3, amb * fog * 0.75 + beam * 0.6 + flash);
  }

  /* ---------- 公開 API ---------- */
  window.FX = {
    flash(power = 1) { S.muzzle = Math.min(1.5, S.muzzle + power); S.shake = Math.max(S.shake, 0.25 * power); },
    hurt(amount = 1) { S.hurt = Math.min(1, S.hurt + 0.6 * amount); S.shake = Math.max(S.shake, 0.6 * amount); },
    setHP(ratio) { S.hp = Math.max(0, Math.min(1, ratio)); },
    setActive(on) { S.active = !!on; },
    toggleFlashlight(on) { S.flashlight = on === undefined ? !S.flashlight : !!on; return S.flashlight; },
    setQuality: i => setQuality(i, true),
    get quality() { return q; },
    lightning: bolt,
    set storm(v) { S.storm = !!v; },
    shade
  };
})();
