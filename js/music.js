/* 미분 배틀 배경음악
 * 음원 파일 없이 Web Audio 로 실시간 합성하는 오리지널 오케스트라풍 곡.
 *   battle : 평소 전투 (D단조 132bpm) — 현악 오스티나토 → 금관 선율·합창·타악기가 터지는 격정 파트
 *   pinch  : 체력이 낮을 때 (152bpm) — 트레몰로 현악, 팀파니 연타, 나폴리 화음(E♭)으로 긴박하게
 * 사용법: Music.play('battle' | 'pinch' | null), Music.victory(), Music.toggle()
 */
(function () {
  'use strict';

  const VOL = 0.55;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const QUAL = { m: [0, 3, 7], M: [0, 4, 7], 7: [0, 4, 7, 10] };
  const ROOT = { C: 36, D: 38, Eb: 39, E: 40, F: 41, G: 43, A: 45, Bb: 46 };
  const chord = s => {
    const m = s.match(/^([A-G]b?)(m|7)?$/);
    return { root: ROOT[m[1]], q: QUAL[m[2] || 'M'] };
  };
  // 3+3+2 로 끊어 치는 강세 (질주감)
  const ACC = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];

  let ctx = null, out, bus, wet, noiseBuf;
  let muted = false, want = null, name = null, song = null;
  let timer = 0, next = 0, step = 0, bar = 0, loop = 0, stopT = 0;
  try { muted = localStorage.getItem('pdeb-mute') === '1'; } catch (e) { /* 저장소 없음 */ }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    out = ctx.createGain(); out.gain.value = VOL;
    out.connect(comp); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(out);
    // 잔향: 지수적으로 줄어드는 잡음으로 만든 홀 울림
    const len = Math.floor(ctx.sampleRate * 2.6), imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ctx.createConvolver(); conv.buffer = imp;
    wet = ctx.createGain(); wet.gain.value = 0.32;
    wet.connect(conv); conv.connect(bus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else if (timer) ctx.resume();
    });
    return true;
  }

  // ---------------------------------------------------------------- 악기
  function env(t, hold, peak, a, r, send) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, hold) + r);
    g.connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(wet); }
    return g;
  }
  function osc(type, f, t, end, dest, detune) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end + 0.05);
    return o;
  }
  function filt(type, freq, q, dest) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    f.connect(dest);
    return f;
  }
  function noise(t, dur, dest) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }

  const I = {
    /** 현악 스타카토 (오스티나토·트레몰로) */
    str(t, m, d, v) {
      const end = t + d * 0.7 + 0.14;
      const f = filt('lowpass', 2800, 0.8, env(t, d * 0.7, v, 0.006, 0.14, 0.22));
      osc('sawtooth', mtof(m), t, end, f, -7);
      osc('sawtooth', mtof(m), t, end, f, 7);
    },
    /** 길게 까는 현악·합창 화음 (비브라토) */
    pad(t, notes, d, v, choir) {
      const g = env(t, d, v, choir ? 0.25 : 0.4, 0.9, 0.55);
      const f = choir ? filt('bandpass', 1000, 1.1, g) : filt('lowpass', 1500, 0.6, g);
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.2; depth.gain.value = 9;
      lfo.connect(depth); lfo.start(t); lfo.stop(t + d + 1);
      notes.forEach(m => [-10, 0, 10].forEach(dt => {
        depth.connect(osc(choir ? 'triangle' : 'sawtooth', mtof(m), t, t + d + 1, f, dt).detune);
        if (choir) depth.connect(osc('sawtooth', mtof(m), t, t + d + 1, f, dt * 0.5).detune);
      }));
    },
    /** 금관 (필터가 열리며 '빠밤' 하고 터지는 소리) */
    brass(t, m, d, v) {
      const g = env(t, d, v, 0.035, 0.2, 0.3);
      const f = filt('lowpass', 500, 1.4, g);
      f.frequency.setValueAtTime(450, t);
      f.frequency.exponentialRampToValueAtTime(3400, t + 0.07);
      f.frequency.exponentialRampToValueAtTime(1700, t + 0.3);
      const end = t + d + 0.25;
      osc('sawtooth', mtof(m), t, end, f, -5);
      osc('sawtooth', mtof(m), t, end, f, 5);
      osc('square', mtof(m - 12), t, end, f, 0);
    },
    bass(t, m, d, v) {
      const f = filt('lowpass', 650, 1, env(t, d * 0.8, v, 0.005, 0.09, 0));
      osc('sawtooth', mtof(m), t, t + d + 0.1, f);
      osc('sine', mtof(m), t, t + d + 0.1, f);
    },
    timp(t, m, v) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      g.connect(bus);
      const s = ctx.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(wet);
      const f = mtof(m), o = osc('sine', f * 1.7, t, t + 1.1, g);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      noise(t, 0.05, filt('lowpass', 900, 0.7, env(t, 0.01, v * 0.5, 0.002, 0.05, 0)));
    },
    kick(t, v) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      g.connect(bus);
      const o = osc('sine', 150, t, t + 0.32, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    },
    snare(t, v) {
      noise(t, 0.2, filt('bandpass', 1900, 0.8, env(t, 0.01, v, 0.002, 0.16, 0.25)));
      osc('triangle', 190, t, t + 0.1, env(t, 0.01, v * 0.6, 0.002, 0.07, 0));
    },
    hat(t, v) { noise(t, 0.06, filt('highpass', 7500, 0.7, env(t, 0.005, v, 0.001, 0.035, 0))); },
    crash(t, v) { noise(t, 1.9, filt('highpass', 4200, 0.6, env(t, 0.02, v, 0.002, 1.7, 0.45))); },
  };

  // ---------------------------------------------------------------- 곡
  const tonesOf = c => c.q.map(i => c.root + 24 + i);

  const BATTLE = {
    bpm: 132,
    prog: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'],
    // [시작 16분음표, 음, 길이(16분음표)]
    mel: [
      [[0, 69, 6], [6, 74, 2], [8, 72, 4], [12, 74, 4]],
      [[0, 77, 6], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
      [[0, 72, 6], [6, 74, 2], [8, 76, 4], [12, 79, 4]],
      [[0, 76, 12], [12, 73, 4]],
      [[0, 74, 6], [6, 77, 2], [8, 81, 6], [14, 79, 2]],
      [[0, 77, 4], [4, 74, 4], [8, 82, 8]],
      [[0, 79, 6], [6, 77, 2], [8, 76, 4], [12, 74, 4]],
      [[0, 73, 4], [4, 76, 4], [8, 81, 8]],
    ],
    // 0: 도입 · 1: 고조 · 2: 격정 (도입 → 고조 → 격정 → 격정 → 고조 → …)
    section: loop => (loop === 0 ? 0 : [1, 2, 2][(loop - 1) % 3]),
    tick(s, b, loop, t, d) {
      const sec = this.section(loop), c = chord(this.prog[b]), tn = tonesOf(c);
      const pat = [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1];
      const up = sec === 2 && s >= 8 ? 12 : 0;
      I.str(t, tn[pat[s]] + (ACC[s] ? 12 : 0) + up, d, ACC[s] ? 0.07 : 0.045);
      if (s === 0) I.pad(t, tn.map(m => m - 12), d * 16, sec === 2 ? 0.02 : 0.028, false);
      if (sec >= 1) {
        if (sec === 2 ? ACC[s] : s % 2 === 0) I.bass(t, c.root + (s % 4 === 2 || s === 11 ? 12 : 0), d * 1.8, 0.12);
      }
      if (sec === 0) {
        if (s === 0) I.kick(t, 0.3);
        if (s === 0 && b % 2 === 0) I.timp(t, c.root, 0.28);
        if (b === 7 && s >= 12) I.timp(t, c.root, 0.12 + (s - 12) * 0.05);
      } else if (sec === 1) {
        if (s % 4 === 0) I.kick(t, 0.3);
        if (s % 4 === 2) I.hat(t, 0.05);
        if (s === 12) I.timp(t, c.root, 0.22);
        if (b === 7 && s >= 8 && this.section(loop + 1) === 2) I.snare(t, 0.04 + (s - 8) * 0.018);
      } else {
        if (ACC[s]) I.kick(t, 0.33);
        if (s === 4 || s === 12) I.snare(t, 0.15);
        if (s % 2 === 1) I.hat(t, 0.045);
        if (ACC[s] && s < 8) I.timp(t, c.root, 0.2);
        if (s === 0 && (b === 0 || b === 4)) I.crash(t, 0.1);
        if (s === 0) I.pad(t, [tn[0] + 12, tn[1] + 12, tn[2]], d * 16, 0.022, true);
        for (const [st, m, len] of this.mel[b]) {
          if (st !== s) continue;
          I.brass(t, m, d * len * 0.92, 0.065);
          I.brass(t, m - 12, d * len * 0.92, 0.04);
        }
      }
    },
  };

  const PINCH = {
    bpm: 152,
    prog: ['Dm', 'Bb', 'Eb', 'A', 'Gm', 'Dm', 'Eb', 'A7'],
    mel: [
      [[0, 74, 3], [3, 77, 3], [6, 81, 10]],
      [[0, 82, 3], [3, 81, 3], [6, 77, 6], [12, 74, 4]],
      [[0, 79, 3], [3, 82, 3], [6, 87, 10]],
      [[0, 85, 6], [6, 81, 6], [12, 76, 4]],
      [[0, 79, 3], [3, 82, 3], [6, 86, 10]],
      [[0, 86, 3], [3, 84, 3], [6, 81, 6], [12, 77, 4]],
      [[0, 79, 4], [4, 82, 4], [8, 87, 8]],
      [[0, 85, 4], [4, 88, 4], [8, 81, 8]],
    ],
    tick(s, b, loop, t, d) {
      const c = chord(this.prog[b]), tn = tonesOf(c), full = loop >= 1;
      // 트레몰로 현악: 근음 옥타브와 5음을 번갈아
      I.str(t, s % 2 ? tn[2] : tn[0] + 12, d, s % 4 === 0 ? 0.06 : 0.04);
      if (s % 2 === 0) I.bass(t, c.root + (s % 8 === 6 ? 12 : 0), d * 1.6, 0.13);
      if (s % 4 === 0) { I.kick(t, 0.34); I.timp(t, c.root, 0.22); }
      if ((b === 3 || b === 7) && s >= 12) I.timp(t, c.root, 0.14 + (s - 12) * 0.04);
      if (s === 4 || s === 12) I.snare(t, 0.15);
      if (s === 14) I.snare(t, 0.06);
      if (s % 2 === 1) I.hat(t, 0.05);
      if (s === 0 && (b === 0 || b === 4)) I.crash(t, 0.11);
      if (s === 0) I.pad(t, [tn[0] + 12, tn[1] + 12, tn[2] + 12], d * 16, 0.024, true);
      if (!full) {
        if ([0, 3, 6, 10].includes(s)) tn.forEach(m => I.brass(t, m - 12, d * 1.6, 0.03));
      } else {
        for (const [st, m, len] of this.mel[b]) {
          if (st !== s) continue;
          I.brass(t, m, d * len * 0.92, 0.06);
          I.brass(t, m - 12, d * len * 0.92, 0.04);
        }
        if (s === 0 || s === 10) tn.forEach(m => I.brass(t, m - 12, d * 1.4, 0.022));
      }
    },
  };

  const SONGS = { battle: BATTLE, pinch: PINCH };

  // ---------------------------------------------------------------- 재생
  function schedule() {
    const now = ctx.currentTime;
    if (next < now) next = now + 0.05; // 탭이 잠들었다 깨면 밀린 음은 건너뛴다
    while (next < now + 0.15) {
      if (step === 0) {
        // 마디 첫 박에서만 곡을 바꾼다 (자연스럽게 이어지도록)
        if (want !== name) {
          if (!want) { halt(); return; }
          const fromOther = !!name;
          name = want; song = SONGS[want]; bar = 0; loop = 0;
          if (fromOther) { I.crash(next, 0.12); I.timp(next, 38, 0.3); }
        }
      }
      const d = 60 / song.bpm / 4;
      song.tick(step, bar, loop, next, d);
      next += d;
      if (++step === 16) { step = 0; if (++bar === song.prog.length) { bar = 0; loop++; } }
    }
  }

  function start() {
    if (muted || !want || !init()) return;
    ctx.resume();
    clearTimeout(stopT);
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(1, ctx.currentTime);
    if (timer) return;
    name = null; step = 0; next = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 30);
    schedule();
  }

  function halt() {
    clearInterval(timer); timer = 0; name = null; song = null;
  }

  function fadeOut(sec) {
    if (!ctx) return;
    halt();
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0.0001, t + sec);
  }

  const Music = {
    get muted() { return muted; },
    get current() { return name; },
    /** 'battle' | 'pinch' | null(멈춤). 같은 곡이면 아무 일도 없다. */
    play(n) {
      n = SONGS[n] ? n : null;
      if (n === want && (timer || !n || muted)) return;
      want = n;
      if (!n) { fadeOut(1.2); return; }
      if (timer) return; // 다음 마디에서 바뀐다
      start();
    },
    /** 승리 팡파르 */
    victory() {
      want = null;
      if (muted || !init()) return;
      fadeOut(0.4);
      ctx.resume();
      const t0 = ctx.currentTime + 0.45, q = 60 / 116;
      bus.gain.cancelScheduledValues(t0 - 0.02);
      bus.gain.setValueAtTime(1, t0 - 0.02);
      const hits = [[0, 'Bb', 0.75], [0.75, 'C', 0.75], [1.5, 'D', 3]];
      hits.forEach(([at, c, len]) => {
        const t = t0 + at * q, ch = chord(c), tn = ch.q.map(i => ch.root + 24 + i);
        tn.forEach(m => I.brass(t, m, len * q, 0.05));
        I.brass(t, tn[0] + 12 + (c === 'D' ? 4 : 0), len * q, 0.06);
        I.timp(t, ch.root, 0.3);
        I.bass(t, ch.root, len * q, 0.12);
      });
      const tEnd = t0 + 1.5 * q;
      I.crash(tEnd, 0.14);
      I.pad(tEnd, [62, 66, 69, 74], 3 * q, 0.03, true);
      for (let i = 0; i < 6; i++) I.timp(t0 + (1.5 + i * 0.125) * q, 38, 0.1 + i * 0.03);
    },
    /** 음소거 전환. 반환값: 지금 음소거 상태 */
    toggle() {
      muted = !muted;
      try { localStorage.setItem('pdeb-mute', muted ? '1' : '0'); } catch (e) { /* 저장소 없음 */ }
      if (muted) fadeOut(0.3);
      else start();
      return muted;
    },
    /** 첫 터치·클릭 때 오디오를 깨운다 (브라우저 자동재생 제한) */
    unlock() {
      if (!want || muted) return;
      if (!timer) start();
      else if (ctx && ctx.state !== 'running') ctx.resume();
    },
  };

  window.Music = Music;
})();
