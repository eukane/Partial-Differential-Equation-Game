/* 미분 배틀 효과음 — 파일 없이 Web Audio 로 그때그때 합성한다 (배경음악과 같은 오디오 컨텍스트)
 *   sys  : 시스템 소리 (버튼, 정답·오답, 타이머, 내 차례 …)
 *   game : 게임 소리 (공격 스타일별 타격음, 캐릭터별 피격 목소리, 이동, 랜덤박스 효과별 …)
 * 사용법: Sfx.play('correct'), Sfx.attack('sniper', 0), Sfx.hurt(2), Sfx.move(1), Sfx.setLevel('game', 0.8)
 */
(function () {
  'use strict';

  const BASE = { sys: 0.55, game: 0.8 };
  const level = { sys: 1, game: 1 };
  let ctx = null, comp = null, noiseBuf = null;
  const bus = {};
  const last = {};

  function init() {
    if (ctx) return ctx.state !== 'closed';
    ctx = window.Music && Music.context ? Music.context() : null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
    comp.connect(ctx.destination);
    for (const k of ['sys', 'game']) {
      bus[k] = ctx.createGain();
      bus[k].gain.value = BASE[k] * level[k];
      bus[k].connect(comp);
    }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // ---------------------------------------------------------------- 재료
  /** 음 하나: f → f2 로 미끄러지며 dur 초 동안 사라진다 */
  function tone(k, o) {
    const t = ctx.currentTime + (o.at || 0), dur = o.dur || 0.15;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
    if (o.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib; lg.gain.value = o.f * 0.06;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    const v = o.vol || 0.3, a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(bus[k]);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  /** 잡음: 필터로 깎아서 '쉭', '쾅', '치직' 을 만든다 */
  function noise(k, o) {
    const t = ctx.currentTime + (o.at || 0), dur = o.dur || 0.15;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    f.Q.value = o.q || 1;
    const v = o.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus[k]);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const boom = (k, at = 0, vol = 0.6, dur = 0.5) => {
    tone(k, { f: 90, f2: 32, dur, vol, at });
    noise(k, { filter: 'lowpass', f: 1200, f2: 150, dur: dur * 0.9, vol: vol * 0.8, at });
  };
  const impact = (at = 0, vol = 0.35) => {
    noise('game', { filter: 'lowpass', f: 1400, f2: 300, dur: 0.12, vol, at });
    tone('game', { f: 160, f2: 60, dur: 0.12, vol: vol * 0.9, at });
  };

  // 캐릭터(말) 번호 → 목소리 높낮이 (🦊 🐧 🐸 🐙 🐤)
  const PITCH = [1, 0.85, 0.7, 1.1, 1.3];
  const pf = id => PITCH[id] || 1;

  // ---------------------------------------------------------------- 소리 목록
  const SYS = {
    click: () => tone('sys', { f: 1300, f2: 900, dur: 0.045, type: 'square', vol: 0.06 }),
    correct: () => [880, 1175, 1568].forEach((f, i) => tone('sys', { f, dur: 0.22, type: 'triangle', vol: 0.22, at: i * 0.07 })),
    wrong: () => { tone('sys', { f: 240, f2: 140, dur: 0.38, type: 'sawtooth', vol: 0.14 }); tone('sys', { f: 226, f2: 132, dur: 0.38, type: 'sawtooth', vol: 0.12 }); },
    timeout: () => [0, 0.2].forEach(at => tone('sys', { f: 160, dur: 0.16, type: 'square', vol: 0.13, at })),
    tick: () => tone('sys', { f: 1900, dur: 0.03, type: 'square', vol: 0.07 }),
    turn: () => { tone('sys', { f: 660, dur: 0.35, type: 'triangle', vol: 0.2 }); tone('sys', { f: 990, dur: 0.5, type: 'triangle', vol: 0.18, at: 0.1 }); tone('sys', { f: 1980, dur: 0.4, vol: 0.05, at: 0.1 }); },
    fast: () => { for (let i = 0; i < 6; i++) tone('sys', { f: 2000 + Math.random() * 1600, dur: 0.08, vol: 0.08, at: i * 0.035 }); },
    pick: () => { noise('sys', { f: 400, f2: 3200, dur: 0.25, vol: 0.12 }); tone('sys', { f: 1320, dur: 0.3, type: 'triangle', vol: 0.18, at: 0.18 }); },
    toast: () => tone('sys', { f: 1560, dur: 0.12, vol: 0.06 }),
  };

  /** 공격 스타일별 타격음 (id: 공격한 말 — 음높이가 조금씩 다르다) */
  const ATTACK = {
    sniper: p => { noise('game', { filter: 'highpass', f: 2500, dur: 0.08, vol: 0.5 }); tone('game', { f: 1000 * p, f2: 110, dur: 0.18, vol: 0.3 }); },
    shotgun: p => { [0, 0.03, 0.06].forEach(at => noise('game', { filter: 'lowpass', f: 1600, f2: 250, dur: 0.28, vol: 0.45, at })); tone('game', { f: 110 * p, f2: 40, dur: 0.3, vol: 0.5 }); },
    ricochet: p => { tone('game', { f: 2400 * p, f2: 1500, dur: 0.18, type: 'triangle', vol: 0.25 }); [0.2, 0.36, 0.5].forEach((at, i) => tone('game', { f: (3000 - i * 400) * p, f2: 1800, dur: 0.1, type: 'triangle', vol: 0.15, at })); },
    bishop: p => { for (let i = 0; i < 4; i++) tone('game', { f: 1500 * p, f2: 380, dur: 0.1, type: 'square', vol: 0.11, at: i * 0.035 }); },
    rook: p => { for (let i = 0; i < 4; i++) tone('game', { f: 1200 * p, f2: 300, dur: 0.1, type: 'square', vol: 0.11, at: i * 0.035 }); },
    queen: p => { for (let i = 0; i < 8; i++) tone('game', { f: (1100 + i * 90) * p, f2: 350, dur: 0.09, type: 'square', vol: 0.08, at: i * 0.028 }); },
    knight: p => { noise('game', { f: 300, f2: 1800, dur: 0.26, vol: 0.3 }); tone('game', { f: 300 * p, f2: 900 * p, dur: 0.22, type: 'triangle', vol: 0.18 }); },
    king: p => { boom('game', 0, 0.7, 0.4); tone('game', { f: 220 * p, f2: 110, dur: 0.2, type: 'square', vol: 0.12 }); },
    mortar: p => { tone('game', { f: 2200 * p, f2: 500, dur: 0.6, vol: 0.14 }); boom('game', 0.58, 0.75, 0.6); },
    scatter: p => { for (let i = 0; i < 6; i++) tone('game', { f: (900 + Math.random() * 800) * p, f2: 200, dur: 0.07, type: 'square', vol: 0.1, at: i * 0.05 }); },
    laser: p => { tone('game', { f: 3200 * p, f2: 180, dur: 0.45, type: 'sawtooth', vol: 0.16 }); tone('game', { f: 1600 * p, dur: 0.4, vol: 0.1, vib: 40 }); },
    spear: p => { noise('game', { f: 2400, f2: 500, dur: 0.16, vol: 0.4, q: 2 }); tone('game', { f: 320 * p, f2: 140, dur: 0.12, type: 'triangle', vol: 0.25, at: 0.1 }); },
    vampire: p => { tone('game', { f: 180 * p, f2: 110, dur: 0.45, type: 'sawtooth', vol: 0.14 }); tone('game', { f: 500 * p, f2: 950 * p, dur: 0.3, vol: 0.14, at: 0.25, vib: 12 }); },
    chain: p => { for (let i = 0; i < 12; i++) noise('game', { filter: 'highpass', f: 3000 + Math.random() * 3000, dur: 0.03, vol: 0.3, at: Math.random() * 0.4 }); tone('game', { f: 700 * p, f2: 2200, dur: 0.4, type: 'sawtooth', vol: 0.08 }); },
    whirl: () => { noise('game', { f: 300, f2: 2600, dur: 0.35, vol: 0.35, q: 3 }); noise('game', { f: 2600, f2: 300, dur: 0.35, vol: 0.3, q: 3, at: 0.3 }); },
  };

  /** 캐릭터별 피격 목소리 */
  const HURT = [
    () => { tone('game', { f: 950, f2: 520, dur: 0.12, type: 'square', vol: 0.12 }); tone('game', { f: 760, f2: 420, dur: 0.1, type: 'square', vol: 0.1, at: 0.1 }); },  // 🦊 깽!
    () => tone('game', { f: 520, f2: 330, dur: 0.24, type: 'sawtooth', vol: 0.13, vib: 32 }),                                                                   // 🐧 꽥
    () => [0, 0.1].forEach(at => tone('game', { f: 190, f2: 150, dur: 0.08, type: 'square', vol: 0.18, at })),                                                // 🐸 개굴
    () => { tone('game', { f: 300, f2: 720, dur: 0.18, vol: 0.25 }); tone('game', { f: 900, f2: 1500, dur: 0.07, vol: 0.12, at: 0.13 }); },                   // 🐙 뽀록
    () => [0, 0.11].forEach(at => tone('game', { f: 2300, f2: 1600, dur: 0.09, vol: 0.15, at })),                                                            // 🐤 삐약
  ];

  const GAME = {
    block: () => { [1200, 1850, 2650].forEach(f => tone('game', { f, dur: 0.45, type: 'triangle', vol: 0.12 })); noise('game', { filter: 'highpass', f: 4000, dur: 0.06, vol: 0.2 }); },
    heal: () => [660, 880, 1100, 1320].forEach((f, i) => tone('game', { f, dur: 0.25, vol: 0.12, at: i * 0.06 })),
    death: () => { tone('game', { f: 440, f2: 55, dur: 0.9, type: 'sawtooth', vol: 0.16 }); boom('game', 0.6, 0.5, 0.5); },
    jump: () => { noise('game', { f: 400, f2: 2600, dur: 0.24, vol: 0.25 }); tone('game', { f: 280, f2: 950, dur: 0.22, type: 'triangle', vol: 0.15 }); },
    land: () => { tone('game', { f: 130, f2: 45, dur: 0.25, vol: 0.55 }); noise('game', { filter: 'lowpass', f: 700, dur: 0.2, vol: 0.4 }); },
    coin: () => { for (let i = 0; i < 7; i++) tone('game', { f: 2600 + (i % 2) * 500, dur: 0.05, type: 'triangle', vol: 0.1, at: i * 0.09 }); },
    heads: () => [784, 988, 1175, 1568].forEach((f, i) => tone('game', { f, dur: 0.28, type: 'triangle', vol: 0.18, at: i * 0.08 })),
    tails: () => tone('game', { f: 320, f2: 200, dur: 0.3, type: 'triangle', vol: 0.18 }),
    boxtick: () => tone('game', { f: 1100 + Math.random() * 500, dur: 0.035, type: 'square', vol: 0.05 }),
    boxopen: () => { [1047, 1319, 1568, 2093].forEach(f => tone('game', { f, dur: 0.5, type: 'triangle', vol: 0.09 })); for (let i = 0; i < 5; i++) tone('game', { f: 2500 + Math.random() * 1500, dur: 0.06, vol: 0.06, at: 0.1 + i * 0.04 }); },
    box_power: () => { tone('game', { f: 140, f2: 1100, dur: 0.6, type: 'sawtooth', vol: 0.13 }); tone('game', { f: 70, f2: 550, dur: 0.6, vol: 0.2 }); },
    box_bolt: () => { noise('game', { filter: 'highpass', f: 2500, dur: 0.12, vol: 0.5 }); noise('game', { filter: 'lowpass', f: 600, f2: 90, dur: 1.1, vol: 0.55, at: 0.05 }); },
    box_meteor: () => { tone('game', { f: 1600, f2: 250, dur: 0.45, vol: 0.12 }); boom('game', 0.4, 0.55, 0.45); },
    box_tele: () => { tone('game', { f: 220, f2: 2200, dur: 0.28, vol: 0.18, vib: 20 }); tone('game', { f: 2200, f2: 220, dur: 0.28, vol: 0.16, at: 0.28, vib: 20 }); },
    box_swap: () => { noise('game', { f: 300, f2: 2400, dur: 0.22, vol: 0.28, q: 3 }); noise('game', { f: 2400, f2: 300, dur: 0.22, vol: 0.28, q: 3, at: 0.2 }); },
    box_again: () => [1320, 1760].forEach((f, i) => tone('game', { f, dur: 0.25, type: 'triangle', vol: 0.18, at: i * 0.12 })),
    box_bomb: () => { tone('game', { f: 900, dur: 0.05, type: 'square', vol: 0.08 }); boom('game', 0.1, 0.85, 0.8); },
  };

  const ready = () => {
    if (!init() || ctx.state === 'closed') return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  };
  /** 같은 소리가 한꺼번에 쏟아지지 않게 (예: 한 번에 여러 명이 맞을 때) */
  const throttled = (key, ms) => { const now = performance.now(); if (last[key] && now - last[key] < ms) return true; last[key] = now; return false; };

  const Sfx = {
    play(name) {
      const fn = SYS[name] || GAME[name];
      const k = SYS[name] ? 'sys' : 'game';
      if (!fn || level[k] <= 0 || !ready() || throttled(name, 30)) return;
      fn();
    },
    /** 공격 스타일별 타격음 */
    attack(style, id) {
      if (level.game <= 0 || !ready()) return;
      (ATTACK[style] || ATTACK.sniper)(pf(id));
    },
    /** 캐릭터별 피격 소리 (맞는 '퍽' + 그 동물의 목소리) */
    hurt(id) {
      if (level.game <= 0 || !ready() || throttled('hurt' + id, 60)) return;
      impact();
      (HURT[id] || HURT[0])();
    },
    /** 이동: 발소리 세 번 (말마다 발소리 높이가 다르다) */
    move(id) {
      if (level.game <= 0 || !ready()) return;
      const p = pf(id);
      [0, 0.15, 0.3].forEach(at => { tone('game', { f: 190 * p, f2: 120 * p, dur: 0.07, vol: 0.2, at }); noise('game', { filter: 'lowpass', f: 700, dur: 0.05, vol: 0.12, at }); });
    },
    /** 'sys' | 'game' 음량 0~1 */
    setLevel(k, v) {
      if (!(k in level)) return;
      level[k] = Math.max(0, Math.min(1, Number(v) || 0));
      if (bus[k]) bus[k].gain.setTargetAtTime(BASE[k] * level[k], ctx.currentTime, 0.03);
    },
    /** 설정 화면 미리듣기용 */
    sample(k) {
      if (k === 'sys') Sfx.play('correct');
      else { Sfx.attack('shotgun', 0); setTimeout(() => Sfx.hurt(2), 250); }
    },
  };

  window.Sfx = Sfx;
})();
