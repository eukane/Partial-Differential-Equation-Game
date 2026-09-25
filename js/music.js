/* 미분 배틀 배경음악
 * 스타일: swing(일렉트로스윙, 기본) · orch(오케스트라 록). 파일 이름은 swing-battle.mp3 / battle.mp3 처럼.
 * audio/*.mp3 는 tools/music/compose.py 로 작곡한 오리지널 곡을 실제 악기 샘플(FluidR3_GM 사운드폰트)로 렌더링한 것.
 *   battle  : 평소 전투 (164bpm) — 신스 도입 → 호른 선율 + 기타 뮤트 → 트럼펫·신스 리드·기타 질주·합창이 터지는 격정 파트
 *   pinch   : 체력이 낮을 때 (184bpm) — 트레몰로 현악, 신스 베이스 펄스, 팀파니·기타 스탭, 트럼펫 고음 선율
 *   victory : 승리 팡파르
 * Web Audio 로 이어 붙여 반복(loopStart~loopEnd)하고, 곡을 바꿀 때는 겹쳐서 넘어간다.
 * 사용법: Music.play('battle' | 'pinch' | null), Music.victory(), Music.toggle()
 */
(function () {
  'use strict';

  const VOL = 0.5;
  const FADE = 1.0;
  const BASE = 'audio/';
  const VER = '?v=20260925-16';
  // tools/music/out/loops.json 과 같은 값 (초)
  const LOOPS = {
    'battle': { loopStart: 29.26829268292683, loopEnd: 52.68292682926829 },
    'pinch': { loopStart: 20.869565217391305, loopEnd: 41.73913043478261 },
    'victory': null,
    'swing-battle': { loopStart: 13.714285714285714, loopEnd: 61.714285714285715 },
    'swing-pinch': { loopStart: 1.4634146341463414, loopEnd: 24.878048780487806 },
    'swing-victory': null,
    'swing2-battle': { loopStart: 13.714285714285714, loopEnd: 68.57142857142857 },
  };

  let ctx = null, out = null;
  let muted = false, want = null, name = null, playing = null; // playing: { src, gain, name }
  const bufs = {}, loading = {};
  const played = {}; // 한 번 들은 곡은 도입을 건너뛰고 반복 구간부터
  let style = 'swing';
  try {
    muted = localStorage.getItem('pdeb-mute') === '1';
    const saved = localStorage.getItem('pdeb-bgm');
    if (saved === 'orch' || saved === 'swing2') style = saved;
  } catch (e) { /* 저장소 없음 */ }
  const STYLES = ['swing', 'swing2', 'orch'];
  /** 'battle' → 'swing-battle' (일렉트로스윙) · 'swing2-battle' (고음 하이라이트 버전, 임시 — 위기 테마·승리는 swing 것) · 'battle' (오케스트라 록) */
  const file = n => (style === 'swing' ? 'swing-' + n
    : style === 'swing2' ? (n === 'battle' ? 'swing2-battle' : 'swing-' + n)
    : n);

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = VOL;
    out.connect(ctx.destination);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else if (playing) ctx.resume();
    });
    return true;
  }

  function load(n) {
    if (bufs[n]) return Promise.resolve(bufs[n]);
    if (!loading[n]) {
      loading[n] = fetch(BASE + n + '.mp3' + VER)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(a => new Promise((ok, bad) => ctx.decodeAudioData(a, ok, bad)))
        .then(b => (bufs[n] = b))
        .catch(e => { delete loading[n]; throw e; });
    }
    return loading[n];
  }

  function stopCurrent(sec) {
    if (!playing) return;
    const p = playing, t = ctx.currentTime;
    playing = null;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0.0001, t + sec);
    try { p.src.stop(t + sec + 0.05); } catch (e) { /* 이미 멈춤 */ }
  }

  function startTrack(n, buf) {
    const t = ctx.currentTime + 0.03, L = LOOPS[n];
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf;
    if (L) { src.loop = true; src.loopStart = L.loopStart; src.loopEnd = Math.min(L.loopEnd, buf.duration); }
    src.connect(gain); gain.connect(out);
    const fadeIn = playing ? FADE : 0.05;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + fadeIn);
    stopCurrent(FADE);
    src.start(t, L && played[n] ? L.loopStart : 0);
    played[n] = true;
    playing = { src, gain, name: n };
    name = n;
    if (!L) src.onended = () => { if (playing && playing.src === src) { playing = null; name = null; } };
  }

  /** 지금 원하는 곡(want)을 틀도록 맞춘다 */
  function sync() {
    if (muted || !init()) return;
    if (!want) { stopCurrent(1.2); name = null; return; }
    const n = file(want);
    if (n === name && playing) return;
    ctx.resume();
    load(n).then(buf => { if (want && file(want) === n && !muted && name !== n) startTrack(n, buf); })
      .catch(() => { /* 파일을 못 불러오면(예: file:// 로 연 경우) 조용히 넘어간다 */ });
  }

  const Music = {
    get muted() { return muted; },
    get current() { return name; },
    get style() { return style; },
    /** 배경음악 스타일 바꾸기 ('swing' | 'orch'). 지금 곡이 있으면 같은 곡의 다른 버전으로 넘어간다 */
    setStyle(st) {
      if (!STYLES.includes(st) || st === style) return;
      style = st;
      try { localStorage.setItem('pdeb-bgm', st); } catch (e) { /* 저장소 없음 */ }
      if (want) sync();
    },
    /** 'battle' | 'pinch' | null(멈춤). 같은 곡이면 아무 일도 없다. */
    play(n) {
      n = n === 'battle' || n === 'pinch' ? n : null;
      if (n === want) return;
      want = n;
      if (!n) { for (const k in played) played[k] = false; }
      sync();
    },
    /** 승리 팡파르 (반복 없음) */
    victory() {
      want = null;
      for (const k in played) played[k] = false;
      if (muted || !init()) return;
      ctx.resume();
      load(file('victory')).then(buf => { if (!want && !muted) startTrack(file('victory'), buf); }).catch(() => {});
    },
    /** 음소거 전환. 반환값: 지금 음소거 상태 */
    toggle() {
      muted = !muted;
      try { localStorage.setItem('pdeb-mute', muted ? '1' : '0'); } catch (e) { /* 저장소 없음 */ }
      if (muted) { if (ctx) stopCurrent(0.3); name = null; } else sync();
      return muted;
    },
    /** 첫 터치·클릭 때 오디오를 깨운다 (브라우저 자동재생 제한) */
    unlock() {
      if (muted || !init()) return;
      Music.preload();
      if (!want) return;
      if (ctx.state !== 'running') ctx.resume();
      if (!playing || name !== want) sync();
    },
    /** 곡 파일을 미리 받아 둔다 (게임 시작 전에) */
    preload() {
      if (!init()) return;
      ['battle', 'pinch'].forEach(n => load(file(n)).catch(() => {}));
    },
  };

  window.Music = Music;
})();
