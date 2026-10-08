/* js/sfx.js — Web Audio 合成音效（不需任何音效檔） */
(() => {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master, bus, verbSend, ambBus, noiseBuf;
  let muted = false, volume = 0.8, range = 4, flipPan = false;
  let groanVoices = 0, ambNodes = null, wantAmbient = false, hbTimer = null, lowHP = 1;
  const listener = { x: 0, y: 0, a: 0 };
  const buttons = [];
  try { muted = localStorage.getItem('zs_muted') === '1'; } catch (e) {}

  /* ---------- 初始化 ---------- */
  function init() {
    if (ac || !AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ac.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(comp); comp.connect(ac.destination);

    bus = ac.createGain(); bus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);

    // 殘響（模擬空曠廢墟）
    const conv = ac.createConvolver();
    conv.buffer = makeImpulse(2.2, 3);
    verbSend = ac.createGain(); verbSend.gain.value = 0.25;
    verbSend.connect(conv); conv.connect(master);

    noiseBuf = makeNoise(2);
  }
  function makeNoise(sec) {
    const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeImpulse(sec, decay) {
    const len = Math.floor(ac.sampleRate * sec);
    const b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  // 瀏覽器規定：要使用者互動後才可以播放聲音
  function unlock() {
    init();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    if (wantAmbient && !ambNodes) startAmbient();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });
  const ready = () => ac && ac.state === 'running' && !muted;

  /* ---------- 3D 定位：左右聲道 + 距離衰減 ---------- */
  function spatial(x, y) {
    const dx = x - listener.x, dy = y - listener.y;
    const d = Math.hypot(dx, dy);
    const rel = Math.atan2(dy, dx) - listener.a;
    let pan = Math.sin(rel) * Math.min(1, d / 1.5) * 0.85;
    if (flipPan) pan = -pan;
    let vol = 1 / (1 + (d / range) * (d / range));
    if (Math.cos(rel) < 0) vol *= 0.8; // 身後的聲音稍小
    return { pan, vol };
  }
  function out(opt = {}) {
    const g = ac.createGain();
    let vol = opt.vol ?? 1, pan = opt.pan ?? 0;
    if (opt.x !== undefined) { const s = spatial(opt.x, opt.y); vol *= s.vol; pan = s.pan; }
    g.gain.value = vol;
    let node = g;
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); node = p;
    }
    node.connect(bus);
    const send = ac.createGain();
    send.gain.value = opt.verb ?? 0.3;
    node.connect(send); send.connect(verbSend);
    return g;
  }

  /* ---------- 基本音源 ---------- */
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function noise(dest, t, dur, o = {}) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    f.Q.value = o.Q ?? 1;
    const g = ac.createGain();
    env(g, t, o.a ?? 0.002, o.vol ?? 1, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * Math.max(0, 1.9 - dur));
    s.stop(t + dur + 0.05);
  }
  function tone(dest, t, dur, o = {}) {
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f || 440, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    osc.detune.value = o.detune ?? (Math.random() * 40 - 20);
    const g = ac.createGain();
    env(g, t, o.a ?? 0.005, o.vol ?? 1, dur);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }

  /* ---------- 槍聲 ---------- */
  const GUNS = {
    pistol(d, t) {
      noise(d, t, 0.14, { f: 2200, f2: 600, Q: 0.8, vol: 0.9 });
      tone(d, t, 0.12, { f: 180, f2: 45, vol: 0.9 });
      noise(d, t, 0.02, { type: 'highpass', f: 5000, vol: 0.5 });
    },
    shotgun(d, t) {
      noise(d, t, 0.38, { type: 'lowpass', f: 2500, f2: 300, Q: 0.7, vol: 1.2 });
      tone(d, t, 0.25, { f: 110, f2: 32, vol: 1.2 });
      noise(d, t, 0.05, { type: 'highpass', f: 3500, vol: 0.7 });
      noise(d, t + 0.42, 0.06, { f: 1800, Q: 3, vol: 0.35 }); // 上膛 咔
      noise(d, t + 0.56, 0.07, { f: 1300, Q: 3, vol: 0.4 });  // 上膛 嚓
    },
    rifle(d, t) {
      noise(d, t, 0.09, { f: 3000, f2: 900, Q: 0.9, vol: 0.85 });
      tone(d, t, 0.08, { f: 220, f2: 60, vol: 0.7 });
      noise(d, t, 0.015, { type: 'highpass', f: 6000, vol: 0.4 });
    }
  };
  const ALIAS = { '手槍': 'pistol', '散彈槍': 'shotgun', '霰彈槍': 'shotgun', '步槍': 'rifle',
                  '機槍': 'rifle', '衝鋒槍': 'rifle', smg: 'rifle', mg: 'rifle' };

  /* ---------- 喪屍聲 ---------- */
  function groan(pos, o = {}) {
    const t = ac.currentTime;
    const dur = o.dur ?? (0.7 + Math.random() * 0.8);
    const base = o.base ?? (70 + Math.random() * 50);
    const d = out({ ...pos, vol: o.vol ?? 0.55, verb: 0.5 });
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.2, t);
    osc.frequency.linearRampToValueAtTime(base * (o.drop ?? (0.7 + Math.random() * 0.2)), t + dur);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 4;
    const lg = ac.createGain(); lg.gain.value = base * 0.06;
    lfo.connect(lg); lg.connect(osc.frequency);
    // 兩個共振峰 → 像喉嚨發出的聲音
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 450 + Math.random() * 150; f1.Q.value = 4;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1000 + Math.random() * 300; f2.Q.value = 6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.6, t + 0.12);
    g.gain.setValueAtTime(1.6, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f1); osc.connect(f2); f1.connect(g); f2.connect(g); g.connect(d);
    noise(d, t, Math.min(dur, 1.5), { f: 700, Q: 2, vol: 0.25, a: 0.1 }); // 喘氣
    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    return osc;
  }

  /* ---------- 環境音：風聲 + 低沉嗡鳴 ---------- */
  function startAmbient() {
    wantAmbient = true;
    if (!ac || ambNodes) return;
    const t = ac.currentTime;
    const wind = ac.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.7;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.08;
    const lg = ac.createGain(); lg.gain.value = 250;
    lfo.connect(lg); lg.connect(wf.frequency);
    const wg = ac.createGain(); wg.gain.value = 0.18;
    wind.connect(wf); wf.connect(wg);
    const d1 = ac.createOscillator(); d1.frequency.value = 55;
    const d2 = ac.createOscillator(); d2.frequency.value = 55.4;
    const dg = ac.createGain(); dg.gain.value = 0.05;
    d1.connect(dg); d2.connect(dg);
    const fade = ac.createGain();
    fade.gain.setValueAtTime(0.0001, t);
    fade.gain.exponentialRampToValueAtTime(1, t + 2);
    wg.connect(fade); dg.connect(fade); fade.connect(ambBus);
    [wind, lfo, d1, d2].forEach(n => n.start(t));
    ambNodes = { srcs: [wind, lfo, d1, d2], fade };
  }
  function stopAmbient() {
    wantAmbient = false;
    if (!ambNodes) return;
    const t = ac.currentTime;
    ambNodes.fade.gain.setTargetAtTime(0.0001, t, 0.4);
    ambNodes.srcs.forEach(n => n.stop(t + 2));
    ambNodes = null;
  }

  /* ---------- 低血量心跳 ---------- */
  function beat() {
    hbTimer = null;
    if (lowHP <= 0 || lowHP >= 0.3) return;
    if (ready()) {
      const t = ac.currentTime, d = out({ vol: 0.9, verb: 0.05 });
      tone(d, t, 0.12, { f: 60, f2: 40, vol: 1 });
      tone(d, t + 0.18, 0.12, { f: 55, f2: 38, vol: 0.7 });
    }
    hbTimer = setTimeout(beat, 500 + lowHP * 1600); // 血越少跳越快
  }

  function paintButtons() {
    const on = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
    const off = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
    buttons.forEach(b => {
      b.innerHTML = muted ? off : on;
      b.setAttribute('aria-pressed', String(!muted));
      b.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效');
    });
  }

  /* ---------- 公開 API ---------- */
  const SFX = {
    shoot(kind = 'pistol') {
      if (!ready()) return;
      const k = ALIAS[kind] || kind;
      (GUNS[k] || GUNS.pistol)(out({ vol: 0.9, verb: 0.35 }), ac.currentTime);
    },
    empty() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.6, verb: 0.1 });
      tone(d, t, 0.03, { type: 'square', f: 1500, vol: 0.3 });
      noise(d, t, 0.02, { type: 'highpass', f: 4000, vol: 0.4 });
    },
    reload() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.7, verb: 0.15 });
      noise(d, t, 0.05, { f: 2000, Q: 4, vol: 0.5 });
      noise(d, t + 0.1, 0.15, { f: 800, f2: 2500, Q: 2, vol: 0.3 });
      tone(d, t + 0.28, 0.04, { type: 'square', f: 900, vol: 0.2 });
      noise(d, t + 0.28, 0.04, { f: 3000, Q: 3, vol: 0.5 });
    },
    swap() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.6, verb: 0.1 });
      noise(d, t, 0.06, { f: 1500, Q: 2, vol: 0.5 });
      tone(d, t, 0.05, { type: 'triangle', f: 300, vol: 0.3 });
    },
    hit(pos = {}) {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ ...pos, vol: 0.8, verb: 0.2 });
      noise(d, t, 0.12, { type: 'lowpass', f: 600, f2: 200, vol: 0.9 });
      tone(d, t, 0.1, { f: 90, f2: 50, vol: 0.6 });
    },
    zombieGroan(pos = {}) {
      if (!ready() || groanVoices >= 4) return; // 最多同時 4 隻在叫
      groanVoices++;
      const o = groan(pos);
      o.onended = () => { groanVoices--; };
    },
    zombieAttack(pos = {}) {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ ...pos, vol: 0.8, verb: 0.2 });
      noise(d, t, 0.15, { f: 800, f2: 3000, Q: 1.5, vol: 0.6 });
      groan(pos, { dur: 0.35, base: 130, vol: 0.5 });
    },
    zombieDie(pos = {}) {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ ...pos, vol: 0.9, verb: 0.35 });
      groan(pos, { dur: 1.1, base: 90, drop: 0.45, vol: 0.6 });
      noise(d, t, 0.3, { type: 'lowpass', f: 900, f2: 150, vol: 1 });
    },
    hurt() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.8, verb: 0.1 });
      tone(d, t, 0.18, { type: 'triangle', f: 260, f2: 150, vol: 0.5 });
      noise(d, t, 0.15, { type: 'lowpass', f: 400, vol: 0.8 });
    },
    step() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.35, verb: 0.05 });
      noise(d, t, 0.07, { type: 'lowpass', f: 250 + Math.random() * 150, vol: 0.6 });
      tone(d, t, 0.05, { f: 70, f2: 50, vol: 0.3 });
    },
    pickup() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.5, verb: 0.3 });
      [660, 880, 1320].forEach((f, i) => tone(d, t + i * 0.07, 0.14, { type: 'triangle', f, vol: 0.5, detune: 0 }));
    },
    waveStart() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.6, verb: 0.6 });
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(1400, t + 0.6);
      lp.frequency.exponentialRampToValueAtTime(300, t + 1.8);
      lp.connect(d);
      [110, 110.7, 164.8].forEach(f => tone(lp, t, 1.8, { type: 'sawtooth', f, vol: 0.35, a: 0.15, detune: 0 }));
      tone(d, t, 1.2, { f: 55, f2: 30, vol: 1 });
    },
    gameOver() {
      if (!ready()) return;
      const t = ac.currentTime, d = out({ vol: 0.6, verb: 0.6 });
      [392, 349.2, 311.1, 233.1].forEach((f, i) => tone(d, t + i * 0.35, 0.5, { type: 'triangle', f, vol: 0.6, detune: 0 }));
      tone(d, t, 2.4, { type: 'sawtooth', f: 55, f2: 40, vol: 0.15, a: 0.3 });
    },
    thunder(delay = 0) {
      if (!ready()) return;
      const t = ac.currentTime + delay, d = out({ vol: 0.9, verb: 0.6 });
      noise(d, t, 0.25, { type: 'highpass', f: 1500, vol: 0.5 });
      noise(d, t, 1.8, { type: 'lowpass', f: 1200, f2: 80, vol: 1.3, a: 0.01 });
      noise(d, t + 0.1, 1.8, { type: 'lowpass', f: 150, vol: 1, a: 0.3 });
    },
    setLowHP(ratio) {
      lowHP = ratio;
      if (ratio > 0 && ratio < 0.3 && !hbTimer) beat();
    },
    startAmbient, stopAmbient,
    listener(x, y, angle) { listener.x = x; listener.y = y; listener.a = angle; },
    setRange(r) { range = r; },          // 聽得見的距離單位（格數或像素）
    flipPan(v = true) { flipPan = v; },  // 左右聲道反轉時用
    setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem('zs_muted', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ac.currentTime, 0.05);
      paintButtons();
    },
    toggle() { SFX.setMuted(!muted); return !muted; },
    get muted() { return muted; },
    bindButton(el) {
      if (!el) return;
      buttons.push(el);
      el.addEventListener('click', e => { e.stopPropagation(); unlock(); SFX.toggle(); el.blur(); });
      paintButtons();
    }
  };
  window.SFX = SFX;
})();
