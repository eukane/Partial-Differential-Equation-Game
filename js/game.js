/*
 * ∑ 수학 배틀 — 자유 조준 · 칸 이동 · 증강(공격 스타일) · 4과목 문제
 * (이전 규칙은 classic/ 에 그대로 남아 있다)
 *
 * 턴 흐름: 차례 넘기기 화면 → 카메라가 해당 플레이어 시점으로 이동
 *        → 행동 선택 → 난이도 선택 → 수학 문제 → 정답이면 행동 실행 → 다음 플레이어
 * 시점 전환은 문제 없이 자유롭게 할 수 있다.
 *
 * 온라인 사설방: 방장(host)이 게임 상태의 기준이다. 모든 행동은 act 객체
 * { key, level, ok, dist, dir, seed … } 로 표현되고, 방장이 room presence 에
 * "행동 직전 상태(base) + act" 를 올리면 모든 화면이 같은 seed 의 난수로
 * 같은 결과·같은 애니메이션을 재생한다(lockstep).
 */
(() => {
  'use strict';

  // ------------------------------------------------------------------
  //  상수
  // ------------------------------------------------------------------
  // 판 크기. 2~4인은 8×8 체스판, 5인은 11×11 격자 안의 정오각형 판 (setBoard 가 바꾼다)
  let N = 8;
  const BOARD = { kind: '', poly: [], valid: null };
  // 0=북(화면 위) 부터 시계 방향 45° 간격
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const DIR_NAMES = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const TILT = 52;          // 플레이어 시점 카메라 기울기
  const TOP_TILT = 14;      // 전체 보기 기울기
  const HP_CHOICES = [100, 150, 200, 300];   // 시작 전에 고르는 체력
  const DEFAULT_HP = 150;
  const POWER_MULT = 1.5;   // 강화탄 배율 (다음 공격의 첫 타격에만)
  const BUMP_DMG = 10;

  const MAX_PLAYERS = 5;
  const PRESETS = [
    { name: '레드', color: '#ff5a5f', emoji: '🦊' },
    { name: '블루', color: '#4d8dff', emoji: '🐧' },
    { name: '그린', color: '#35d07f', emoji: '🐸' },
    { name: '퍼플', color: '#b57bff', emoji: '🐙' },
    { name: '옐로', color: '#ffc53d', emoji: '🐤' },
  ];
  // 인원수별 시작 칸: 서로 같은 줄·대각선·나이트 칸에 겹치지 않는 바람개비 배치
  const LAYOUTS = {
    2: [[1, 7], [6, 0]],
    3: [[1, 7], [7, 5], [3, 0]],
    4: [[1, 7], [7, 6], [6, 0], [0, 1]],
    5: [[5, 2], [9, 4], [7, 9], [3, 8], [1, 5]],   // 오각형 판의 다섯 꼭짓점 근처
  };


  // 정답 점수 = 난이도 점수 + 속도 점수(남은 시간 비율 × 100)
  const LEVELS = {
    easy:   { label: '기본', desc: '교과서 기본', time: 45, pts: 100 },
    hard:   { label: '심화', desc: '모의고사 수준', time: 75, pts: 200 },
    killer: { label: '킬러', desc: '수능 상위권 · 2~3단계', time: 120, pts: 300 },
  };
  const LEVEL_KEYS = ['easy', 'hard', 'killer'];
  const KILLER_BONUS = 12;  // 킬러 문제를 맞히면 심화보다 공격 피해 +12
  /** 공격 피해: 킬러는 심화 피해 + 보너스 */
  const styleDmg = (s, level) => (level === 'killer' ? s.dmg.hard + KILLER_BONUS : s.dmg[level] || s.dmg.easy);
  const FAST_RATIO = 1 / 3;   // 제한 시간의 1/3 안에 맞히면 ⚡ 빠른 정답 (행동 강화)
  const FAST_DMG = 10;
  const CAT_KEYS = ['common', 'calc', 'prob', 'geo'];
  const CAT_ICONS = { common: '📘', calc: '∫', prob: '🎲', geo: '📐' };
  const catInfo = k => (window.MathProblems && window.MathProblems.CATS[k]) || { name: k, sub: '' };
  /** 1라운드는 준비 라운드: 공격 불가 (선공 이점 완화) */
  const prepRound = () => S.mode !== 'brawl' && S.round === 1;
  const brawl = () => S.mode === 'brawl';
  /** 턴 순서: 항상 1번 → 2번 → … 차례대로 */
  function orderFor() {
    return [...Array(S.players.length).keys()];
  }
  const BRAWL_LOCK_MS = 10000;  // 난전에서 오답 후 쉬는 시간
  const COIN_COUNT = 3;

  const BOX = [
    { id: 'heal',   icon: '💚', name: '회복',     desc: 'HP +40',                          w: 4 },
    { id: 'power',  icon: '💥', name: '강화탄',   desc: '다음 공격의 첫 타격 피해 1.5배',   w: 4 },
    { id: 'bolt',   icon: '⚡', name: '번개',     desc: '무작위 적 1명에게 30 피해',         w: 3 },
    { id: 'meteor', icon: '☄️', name: '유성우',   desc: '모든 적에게 18 피해',              w: 2 },
    { id: 'tele',   icon: '🌀', name: '순간이동', desc: '무작위 빈 칸으로 이동 + HP +15',    w: 2 },
    { id: 'swap',   icon: '🔁', name: '위치 교환', desc: '무작위 적과 자리 바꾸고 그 적에게 15 피해', w: 2 },
    { id: 'again',  icon: '⏩', name: '추가 행동', desc: '한 번 더 행동 + HP +10 (난전: HP +25)', w: 2 },
    { id: 'bomb',   icon: '💣', name: '꽝! 폭탄', desc: '자신이 15 피해',           w: 2, bad: true },
  ];

  // 🧪 실험 모드: 장애물(돌·상자) + 자기장 축소
  const OBST_COUNT = { square: { rock: 4, crate: 4 }, pentagon: { rock: 6, crate: 6 } };
  const CRATE_HP = 2;            // 상자는 두 번 맞으면 부서지고, 부순 사람은 🛡️ 방패
  const ZONE_TURN = { start: 5, every: 3 };    // 턴제: 5라운드에 첫 축소, 그 뒤 3라운드마다 한 겹
  const ZONE_BRAWL = { start: 24, every: 16 }; // 난전: 전체 행동 수 기준
  const ZONE_DMG = [0, 10, 15, 20, 25];        // 자기장 단계별 피해 (턴제: 라운드마다, 난전: 행동할 때마다)

  // ------------------------------------------------------------------
  //  상태
  // ------------------------------------------------------------------
  const S = {
    exp: false,       // 🧪 실험 모드
    obst: new Map(),  // 'x,y' → { kind: 'rock' | 'crate', hp, i }
    depth: null,      // 'x,y' → 판 가장자리에서 몇 겹 안쪽인지 (0 = 가장자리)
    players: [],
    turn: 0,
    round: 1,
    phase: 'setup',   // setup | handover | choose | rotate | busy | over
    view: 'player',   // player | top
    timer: true,
    ang: 0,           // 누적 카메라 회전각 (최단 경로 회전을 위해 누적)
    extra: false,       // 랜덤박스 '추가 행동' 획득
    extraActive: false, // 추가 행동 진행 중 (표시용)
    rotStart: 0,
    keyHandler: null,
    cell: 60,
    applying: false,  // act 재생 중
    online: null,     // 온라인 방 상태 (없으면 한 기기 모드)
    gseed: 1,         // 게임 seed (증강 후보를 정한다)
    coins: [],        // 동전 칸 좌표
    maxHp: DEFAULT_HP, // 시작 체력 (= 최대 체력)
    mode: 'turn',     // turn: 턴제 · brawl: 난전 (온라인 전용)
    myBusy: false,    // 난전: 내 행동이 진행 중
    lockUntil: 0,     // 난전: 오답 후 쉬는 시간
    pos: 0,           // 이번 라운드 순서에서 몇 번째인지
    lastCat: {},      // 플레이어별 마지막으로 고른 과목
    pick: null,       // 판에서 칸 고르는 중
    augmentOpen: false,
  };

  const $ = s => document.querySelector(s);
  const el = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 게임 결과에 영향을 주는 난수는 rng() 로만 뽑는다 (온라인에서 seed 로 재현)
  let rng = Math.random;
  const rand = n => Math.floor(rng() * n);
  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const newSeed = () => Math.floor(Math.random() * 2 ** 31);
  const inB = (x, y) => x >= 0 && x < N && y >= 0 && y < N && (!BOARD.valid || BOARD.valid.has(x + ',' + y));
  const coord = (x, y) => 'ABCDEFGHIJK'[x] + (N - y);
  const cur = () => S.players[S.turn];
  const alive = () => S.players.filter(p => p.alive);
  const enemies = p => S.players.filter(q => q.alive && q !== p);
  const at = (x, y, except) => S.players.find(p => p.alive && p !== except && p.x === x && p.y === y) || null;
  const dirIdx = (dx, dy) => DIRS.findIndex(d => d[0] === dx && d[1] === dy);
  /** 장애물 (없으면 null) */
  const obAt = (x, y) => (S.exp && S.obst.get(x + ',' + y)) || null;
  /** 말이 설 수 있는 빈 칸 */
  const open = (x, y) => inB(x, y) && !at(x, y) && !obAt(x, y);
  /** 내가 조작하는 말인가 (턴제: 내 차례, 난전: 내가 살아 있음) */
  const myTurn = () => (!S.online ? !(S.players[S.turn] && S.players[S.turn].bot)
    : S.mode === 'brawl' ? !!(S.players[S.online.mySeat] && S.players[S.online.mySeat].alive)
    : S.online.mySeat === S.turn);
  /** 지금 행동 버튼을 누를 수 있는가 */
  const canAct = () => (S.mode === 'brawl'
    ? S.phase !== 'over' && myTurn() && !S.myBusy && Date.now() >= S.lockUntil
    : S.phase === 'choose' && myTurn());
  const tag = p => `<span class="who" style="--pc:${p.color}">${p.emoji} ${esc(p.name)}</span>`;

  // ------------------------------------------------------------------
  //  수식 렌더링 ($...$ → KaTeX)
  // ------------------------------------------------------------------
  function tex(s) {
    return String(s).split('$').map((seg, i) => (i % 2 ? renderTeX(seg) : esc(seg))).join('');
  }
  function renderTeX(t) {
    if (window.katex) {
      try { return window.katex.renderToString(t, { throwOnError: false }); } catch (e) { /* fallthrough */ }
    }
    return `<code>${esc(t)}</code>`;
  }

  // ------------------------------------------------------------------
  //  초기화
  // ------------------------------------------------------------------
  function init() {
    Object.assign(el, {
      stage: $('#stage'), board: $('#board'), cells: $('#cells'), fx: $('#fx'), pieces: $('#pieces'),
      compass: $('#compass .needle'), toast: $('#toast'), spectate: $('#spectate'), playerList: $('#playerList'),
      turnPanel: $('#turnPanel'), log: $('#log'), roundInfo: $('#roundInfo'),
      setup: $('#setup'), handover: $('#handover'), lobby: $('#lobby'), modal: $('#modal'), modalCard: $('#modalCard'),
    });

    // 시작 화면
    $('#setupPlayers').innerHTML = `
      <div class="count-row" role="group" aria-label="인원">
        <span>인원</span>${[2, 3, 4, 5].map(n => `<button class="count-btn" data-n="${n}">${n}명</button>`).join('')}
      </div>` + PRESETS.map((p, i) => `
      <div class="setup-row" style="--pc:${p.color}" data-row="${i}">
        <span>${p.emoji}</span>
        <input id="pname${i}" maxlength="10" value="${p.name}" aria-label="플레이어 ${i + 1} 이름">
        <button class="bot-btn" data-bot="${i}" aria-label="플레이어 ${i + 1} 사람/AI 바꾸기"></button>
      </div>`).join('');
    // 자리마다 👤 사람 / 🤖 AI (기억해 둔다, 1번 자리는 기본 사람)
    S.localBots = new Set((store.get('pdeb-bots') || []).filter(i => i >= 0 && i < MAX_PLAYERS));
    const renderBots = () => document.querySelectorAll('[data-bot]').forEach(b => {
      const on = S.localBots.has(+b.dataset.bot);
      b.textContent = on ? '🤖 AI' : '👤 사람';
      b.classList.toggle('on', on);
    });
    document.querySelectorAll('[data-bot]').forEach(b => {
      b.onclick = () => {
        const i = +b.dataset.bot;
        if (S.localBots.has(i)) S.localBots.delete(i); else S.localBots.add(i);
        store.set('pdeb-bots', [...S.localBots]);
        renderBots();
      };
    });
    renderBots();
    const setCount = n => {
      S.localCount = n;
      document.querySelectorAll('.count-btn').forEach(b => b.classList.toggle('sel', +b.dataset.n === n));
      document.querySelectorAll('[data-row]').forEach(r => { r.hidden = +r.dataset.row >= n; });
      if (S.phase === 'setup') {
        S.players = PRESETS.slice(0, n).map((p, i) => makePlayer(i, p.name, n));
        el.pieces.innerHTML = '';
        renderPieces();
      }
    };
    document.querySelectorAll('.count-btn').forEach(b => { b.onclick = () => setCount(+b.dataset.n); });
    const hpPicker = (box, value, onPick) => {
      box.innerHTML = `<span>시작 체력</span>${HP_CHOICES.map(h => `<button class="hp-btn ${h === value ? 'sel' : ''}" data-hp="${h}">${h}</button>`).join('')}`;
      box.querySelectorAll('[data-hp]').forEach(b => { b.onclick = () => onPick(+b.dataset.hp); });
    };
    const setHp = h => {
      S.maxHp = h;
      store.set('pdeb-hp', h);
      hpPicker($('#hpRow'), h, setHp);
      if (S.phase === 'setup') { S.players.forEach(q => { q.hp = h; }); renderPieces(); }
    };
    S.renderHpPicker = hpPicker;
    setHp(HP_CHOICES.includes(store.get('pdeb-hp')) ? store.get('pdeb-hp') : DEFAULT_HP);
    $('#btnStart').onclick = startGame;
    $('#btnRules').onclick = showRules;
    $('#btnRules2').onclick = showRules;
    $('#btnView').onclick = toggleView;
    $('#btnLeave').onclick = () => Net.leave();
    // 휴대폰 메뉴: 상단 버튼들과 기록을 한곳에
    const drawer = $('#drawer');
    const setMenu = open => {
      drawer.classList.toggle('hidden', !open);
      $('#btnMenu').setAttribute('aria-expanded', String(open));
      if (open) {
        $('#drawerLog').innerHTML = el.log.innerHTML || '<li class="muted">아직 기록이 없어요.</li>';
        $('#mView').textContent = $('#btnView').textContent;
        $('#mLeave').hidden = $('#btnLeave').hidden;
      }
    };
    $('#btnMenu').onclick = () => setMenu(drawer.classList.contains('hidden'));
    $('#btnMenuClose').onclick = () => setMenu(false);
    drawer.addEventListener('click', e => { if (e.target === drawer) setMenu(false); });
    $('#mRules').onclick = () => { setMenu(false); showRules(); };
    $('#mView').onclick = () => { setMenu(false); toggleView(); };
    $('#mLeave').onclick = () => { setMenu(false); Net.leave(); };
    $('#btnSound').onclick = openSoundPanel;
    $('#mSound').onclick = () => { setMenu(false); openSoundPanel(); };
    applySound();
    // 모든 버튼에 짧은 '딸깍'
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button') && !e.target.closest('.choice')) sfx('click'); }, true);
    const nextBgm = () => {
      const keys = Object.keys(BGM_STYLES), cur = window.Music ? Music.style : 'swing';
      setBgm(keys[(keys.indexOf(cur) + 1) % keys.length]);
    };
    $('#btnBgm').onclick = nextBgm;
    $('#mBgm').onclick = nextBgm;
    renderSound();
    // 브라우저는 사용자가 한 번 누르기 전까지 소리를 막는다
    document.addEventListener('pointerdown', () => { if (window.Music) Music.unlock(); }, true);
    // 패널 높이가 바뀌면(행동 버튼·상태 줄) 보드 영역도 다시 맞춘다
    if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(el.stage);
    el.board.addEventListener('click', e => {
      const c = e.target.closest('.cell');
      if (c) { if (!c.classList.contains('void')) onCellClick(+c.dataset.x, +c.dataset.y); return; }
      // 3D 로 세운 말이 판 평면을 가르거나 오각형 가장자리를 누르면 브라우저가 칸 대신 판을 돌려줄 때가 있다.
      // 이때는 판 기준 좌표(offsetX/Y, 변환 전 좌표계)로 칸을 계산한다. (.cells 와 .board 는 크기·원점이 같다)
      if (e.target === el.cells || e.target === el.board) {
        const size = el.cells.clientWidth / N;
        const x = Math.floor(e.offsetX / size), y = Math.floor(e.offsetY / size);
        if (inB(x, y)) onCellClick(x, y);
      }
    });
    Net.init();

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    layout();
    // 시작 화면 뒤 보드 미리보기
    setCount(3);
    updateCamera();
  }

  // ------------------------------------------------------------------
  //  판: 네모 또는 오각형
  // ------------------------------------------------------------------
  function pentagonPoly(W) {
    const R = W * 5.75 / 11, cx = W / 2, cy = W / 2 + W * 0.5 / 11;
    return [...Array(5).keys()].map(k => {
      const a = (-90 + 72 * k) * Math.PI / 180;
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
  }
  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[j];
      if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c;
    }
    return c;
  }
  /** 인원수에 맞는 판을 만든다 (5인 이상이면 오각형) */
  function setBoard(count) {
    const kind = count >= 5 ? 'pentagon' : 'square';
    if (BOARD.kind === kind) return;
    BOARD.kind = kind;
    N = kind === 'pentagon' ? 11 : 8;
    BOARD.poly = kind === 'pentagon' ? pentagonPoly(N) : [[0, 0], [N, 0], [N, N], [0, N]];
    BOARD.valid = null;
    if (kind === 'pentagon') {
      BOARD.valid = new Set();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inPoly(x + 0.5, y + 0.5, BOARD.poly)) BOARD.valid.add(x + ',' + y);
    }
    el.cells.innerHTML = '';
    el.cells.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    el.cells.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = document.createElement('div');
        c.className = 'cell' + ((x + y) % 2 ? ' dark' : '') + (inB(x, y) ? '' : ' void');
        c.dataset.x = x; c.dataset.y = y;
        if (kind === 'square') {
          if (y === N - 1) c.insertAdjacentHTML('beforeend', `<span class="coord file">${'ABCDEFGHIJK'[x]}</span>`);
          if (x === 0) c.insertAdjacentHTML('beforeend', `<span class="coord rank">${N - y}</span>`);
        }
        el.cells.appendChild(c);
      }
    }
    el.board.classList.toggle('pentagon', kind === 'pentagon');
    el.board.style.setProperty('--n', N);
    el.fx.setAttribute('viewBox', `0 0 ${N} ${N}`);
    el.fx.innerHTML = '';
    if (kind === 'pentagon') {
      el.cells.style.clipPath = `polygon(${BOARD.poly.map(([x, y]) => `${(x / N * 100).toFixed(3)}% ${(y / N * 100).toFixed(3)}%`).join(', ')})`;
      svg('polygon', { class: 'board-frame', points: BOARD.poly.map(q => q.join(',')).join(' ') });
    } else {
      el.cells.style.clipPath = '';
    }
    el.pieces.innerHTML = '';
    layout();
  }

  /** i 번째 플레이어 (전체 n명). 처음에는 판 가운데를 바라본다 */
  function makePlayer(i, name, n, bot = false) {
    const p = PRESETS[i];
    const [x, y] = (LAYOUTS[n] || LAYOUTS[3])[i];
    setBoard(n);
    const ang = Math.round(normAng(Math.atan2(3.5 - x, -(3.5 - y)) * 180 / Math.PI) / 5) * 5;
    return { id: i, name, color: p.color, emoji: p.emoji, x, y, ang, style: null,
      hp: S.maxHp, alive: true, shield: false, power: false, correct: 0, tries: 0, score: 0, bot: !!bot, aimBase: ang, poison: 0 };
  }

  function startGame() {
    S.online = null;
    const n = S.localCount || 3;
    S.players = PRESETS.slice(0, n).map((p, i) => makePlayer(i, ($(`#pname${i}`).value || p.name).trim() || p.name, n, S.localBots && S.localBots.has(i)));
    S.timer = $('#optTimer').checked;
    S.turn = 0; S.round = 1; S.pos = 0; S.extra = false; S.extraActive = false;
    S.gseed = newSeed();
    S.mode = 'turn';
    S.exp = !!($('#optExp') && $('#optExp').checked);
    initObstacles();
    initCoins();
    el.log.innerHTML = '';
    el.setup.classList.add('hidden');
    log('🎮 게임 시작! 첫 차례에 증강(공격 스타일)을 고르세요.');
    expIntro();
    renderAll();
    showHandover();
  }

  /** 🧪 실험 모드 안내 */
  function expIntro() {
    if (!S.exp) return;
    const Z = brawl() ? ZONE_BRAWL : ZONE_TURN;
    log(`🧪 실험 모드: 🪨 돌은 탄을 막고(튕기는 탄은 튕김), 📦 상자는 ${CRATE_HP}번 맞으면 부서져요(부순 사람 🛡️). ⚡ 자기장은 ${brawl() ? `행동 ${Z.start}번째부터` : `${Z.start}라운드부터`} 바깥부터 좁혀 와요.`);
    setTimeout(() => toast('🧪 실험 모드: 돌·상자 + 자기장', 2400), 600);
  }

  function layout() {
    const r = el.stage.getBoundingClientRect();
    // 판이 어느 방향으로 돌아도 화면 안에 들어오게: 네모는 대각선(√2배), 오각형은 외접원 지름(약 1.05배)
    // 세로로 긴 휴대폰 화면은 위아래가 남으므로 판을 더 크게 (대각선 방향일 때 가장자리 한두 칸은 살짝 잘릴 수 있음)
    const portrait = r.height > r.width * 1.25;
    const spread = BOARD.kind === 'pentagon' ? (portrait ? 1.02 : 1.22) : (portrait ? 1.12 : 1.41);
    S.cell = Math.max(22, Math.min(88, Math.floor(Math.min(r.width / (N * spread), r.height / (N * 0.925)))));
    el.board.style.setProperty('--cell', S.cell + 'px');
    updateCamera();
  }

  // ------------------------------------------------------------------
  //  카메라
  // ------------------------------------------------------------------
  function updateCamera() {
    const p = cur();
    const pov = S.view === 'player' && p && p.alive && ['choose', 'rotate', 'busy'].includes(S.phase);
    let target = 0, tilt = TOP_TILT, fx = N / 2, fy = N / 2, lift = 0, dz = -S.cell * 2.2;
    if (pov) {
      target = -p.ang;
      tilt = TILT;
      // 플레이어 쪽으로 초점을 조금 당겨서 "그 플레이어 시점" 느낌을 준다
      fx = N / 2 + (p.x + 0.5 - N / 2) * 0.55;
      fy = N / 2 + (p.y + 0.5 - N / 2) * 0.55;
      lift = S.cell * 0.9;
      dz = 0;
    }
    const d = ((((target - S.ang) % 360) + 540) % 360) - 180;
    S.ang += d;
    const b = el.board.style;
    b.setProperty('--ang', S.ang + 'deg');
    b.setProperty('--tilt', tilt + 'deg');
    b.setProperty('--tx', (N / 2 - fx) * S.cell + 'px');
    b.setProperty('--ty', (N / 2 - fy) * S.cell + 'px');
    for (const p of S.players) { const n = el.pieces.querySelector(`[data-id="${p.id}"]`); if (n && p.style) faceFlip(n, p); }
    b.setProperty('--lift', lift + 'px');
    b.setProperty('--dz', dz + 'px');
    el.compass.style.transform = `rotate(${S.ang}deg)`;
    $('#btnView').textContent = S.view === 'player' ? '🧭 전체 보기' : '👁️ 플레이어 시점';
  }

  function toggleView() {
    S.view = S.view === 'player' ? 'top' : 'player';
    updateCamera();
  }

  // ------------------------------------------------------------------
  //  렌더링
  // ------------------------------------------------------------------
  function renderAll() {
    renderPlayers();
    renderPieces();
    renderObstacles();
    renderTurn();
    renderGuide();
    updateCamera();
    el.roundInfo.innerHTML = S.phase === 'setup' ? ''
      : brawl() ? `🔥 난전 · 생존 ${alive().length}명`
      : `라운드 ${S.round}${prepRound() ? ' (준비 · 공격 불가)' : ''}<span class="order"> · 순서 ${orderFor().filter(i => S.players[i] && S.players[i].alive).map(i => S.players[i].emoji).join('→')}</span>`;
    renderSpectate();
  }

  /** 배경음악: 지금 차례인 사람(난전은 나)의 체력이 낮으면 긴박한 곡으로 */
  const PINCH_HP = 0.3;
  function updateMusic() {
    if (!window.Music || S.phase === 'over') return;
    if (S.phase === 'setup' || !S.players.length) { Music.play(null); return; }
    // '내' 체력 기준 (차례가 바뀌어도 곡이 왔다 갔다 하지 않게)
    //  온라인: 내 자리 · 한 기기: 사람 플레이어들 중 누구든 위험하면 (AI 는 제외, 전원 AI 면 전원 기준)
    const low = q => q && q.alive && q.hp <= S.maxHp * PINCH_HP;
    let danger;
    if (S.online) danger = low(S.players[S.online.mySeat]);
    else {
      const humans = S.players.filter(q => !q.bot);
      danger = (humans.length ? humans : S.players).some(low);
    }
    Music.play(danger ? 'pinch' : 'battle');
  }

  // ---------------- 소리 설정: 음악 · 시스템 · 게임 (각각 음량 + 음소거, 전체 음소거) ----------------
  const SOUND_KINDS = [
    { k: 'music', icon: '🎵', name: '음악', desc: '배경음악' },
    { k: 'sys', icon: '🔔', name: '시스템', desc: '버튼·정답·오답·타이머·내 차례' },
    { k: 'game', icon: '💥', name: '게임', desc: '타격·피격·이동·랜덤박스' },
  ];
  // 설정은 처음 쓸 때 읽는다 (store 가 이 아래에서 정의되므로)
  let SOUND = null;
  const loadSound = () => SOUND || (SOUND = (() => {
    const d = { master: false, music: { v: 70, m: false }, sys: { v: 80, m: false }, game: { v: 90, m: false } };
    const saved = store.get('pdeb-sound');
    if (saved && typeof saved === 'object') {
      d.master = !!saved.master;
      for (const { k } of SOUND_KINDS) {
        const x = saved[k];
        if (x) d[k] = { v: Math.max(0, Math.min(100, Math.round(Number(x.v)) || 0)), m: !!x.m };
      }
    } else if (store.get('pdeb-mute') === '1' || store.get('pdeb-mute') === 1) d.music.m = true; // 예전 음악 끄기 설정
    return d;
  })());
  const soundLevel = k => { loadSound(); return SOUND.master || SOUND[k].m ? 0 : SOUND[k].v / 100; };
  function applySound() {
    loadSound();
    store.set('pdeb-sound', SOUND);
    if (window.Music) Music.setLevel(soundLevel('music'));
    if (window.Sfx) { Sfx.setLevel('sys', soundLevel('sys')); Sfx.setLevel('game', soundLevel('game')); }
    renderSound();
  }
  const sfx = name => { if (window.Sfx) Sfx.play(name); };

  function openSoundPanel() {
    loadSound();
    let box = $('#soundPanel');
    if (box) { box.remove(); return; }
    box = document.createElement('div');
    box.id = 'soundPanel';
    box.className = 'sound-panel';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '소리 설정');
    document.body.appendChild(box);
    const draw = () => {
      box.innerHTML = `
        <div class="sp-head"><b>🔊 소리 설정</b><button class="ghost sp-close" aria-label="닫기">✕</button></div>
        <button class="sp-master ${SOUND.master ? 'on' : ''}">${SOUND.master ? '🔇 전체 음소거 중 · 눌러서 켜기' : '🔊 전체 음소거'}</button>
        ${SOUND_KINDS.map(({ k, icon, name, desc }) => `
          <div class="sp-row ${SOUND[k].m || SOUND.master ? 'off' : ''}">
            <button class="sp-mute" data-mute="${k}" aria-label="${name} 음소거" title="${name} 음소거">${SOUND[k].m ? '🔇' : icon}</button>
            <div class="sp-body">
              <div class="sp-label"><b>${name}</b><small>${desc}</small><span class="sp-val">${SOUND[k].m ? '꺼짐' : SOUND[k].v}</span></div>
              <input type="range" min="0" max="100" step="5" value="${SOUND[k].v}" data-vol="${k}" aria-label="${name} 음량">
            </div>
          </div>`).join('')}
        <p class="muted small">M 키: 전체 음소거</p>`;
      box.querySelector('.sp-close').onclick = () => box.remove();
      box.querySelector('.sp-master').onclick = () => { SOUND.master = !SOUND.master; applySound(); draw(); };
      box.querySelectorAll('[data-mute]').forEach(b => {
        b.onclick = () => { const x = SOUND[b.dataset.mute]; x.m = !x.m; applySound(); draw(); };
      });
      box.querySelectorAll('[data-vol]').forEach(r => {
        const k = r.dataset.vol;
        r.oninput = () => {
          SOUND[k].v = +r.value; SOUND[k].m = false;
          applySound();
          const row = r.closest('.sp-row');
          row.querySelector('.sp-val').textContent = r.value;
          row.querySelector('.sp-mute').textContent = SOUND_KINDS.find(x => x.k === k).icon;
        };
        // 손을 떼면 미리 들려준다
        r.onchange = () => { if (k !== 'music' && window.Sfx) Sfx.sample(k); };
      });
    };
    draw();
    // 바깥을 누르면 닫힌다
    setTimeout(() => {
      const away = e => {
        if (!document.body.contains(box)) { document.removeEventListener('pointerdown', away, true); return; }
        if (!box.contains(e.target) && !e.target.closest('#btnSound, #mSound')) { box.remove(); document.removeEventListener('pointerdown', away, true); }
      };
      document.addEventListener('pointerdown', away, true);
    }, 0);
  }

  function renderSound() {
    const all = SOUND_KINDS.every(({ k }) => soundLevel(k) === 0);
    const on = !all;
    $('#btnSound').textContent = on ? '🔊' : '🔇';
    $('#btnSound').title = '소리 설정 (음악 · 시스템 · 게임)';
    $('#mSound').textContent = on ? '🔊 소리 설정' : '🔇 소리 설정 (전부 꺼짐)';
    const st = window.Music ? Music.style : 'swing';
    $('#btnBgm').textContent = BGM_STYLES[st].short;
    $('#mBgm').textContent = `${BGM_STYLES[st].icon} 배경음악: ${BGM_STYLES[st].name}`;
    $('#bgmRow').innerHTML = `<span>배경음악</span>${Object.entries(BGM_STYLES).map(([k, v]) =>
      `<button class="hp-btn ${k === st ? 'sel' : ''}" data-bgm="${k}">${v.icon} ${v.name}</button>`).join('')}`;
    $('#bgmRow').querySelectorAll('[data-bgm]').forEach(b => { b.onclick = () => setBgm(b.dataset.bgm); });
  }

  const BGM_STYLES = {
    swing: { icon: '🎷', name: '일렉트로스윙', short: '🎷 스윙' },
    orch: { icon: '🎺', name: '오케스트라 록', short: '🎺 오케' },
  };
  function setBgm(st) {
    if (!window.Music) return;
    Music.setStyle(st);
    renderSound();
  }

  function renderPlayers() {
    updateMusic();
    el.playerList.innerHTML = S.players.map(p => `
      <div class="pcard ${p === cur() && S.phase !== 'over' ? 'active' : ''} ${p.alive ? '' : 'dead'}" style="--pc:${p.color}">
        <span class="pemoji">${face(p)}</span>
        <div class="pinfo">
          <div class="pname">${esc(p.name)}${S.online && S.online.mySeat === p.id ? ' <span class="chip me">나</span>' : ''} ${p.shield ? '🛡️' : ''}${p.power ? '💥' : ''}${p.poison > 0 ? '☠️' : ''}${p.bot ? ' <span class="chip bot">AI</span>' : ''}${S.online && !Net.seatOnline(p.id) ? ' <span class="chip off">연결 끊김</span>' : ''}</div>
          <div class="hp"><div class="hp-fill" style="width:${p.hp / S.maxHp * 100}%"></div></div>
          ${brawl() && S.online && p.alive && p.id !== S.online.mySeat && Net.seatStatus(p.id) ? `<div class="pdoing">${esc(Net.seatStatus(p.id))}</div>` : ''}
        </div>
        <div class="pnums"><span class="hpnum">${p.alive ? p.hp : '탈락'}</span><span class="score">${p.score}점</span></div>
      </div>`).join('');
  }

  function renderPieces() {
    for (const p of S.players) {
      let node = el.pieces.querySelector(`[data-id="${p.id}"]`);
      if (!node) {
        node = document.createElement('div');
        node.className = 'piece';
        node.dataset.id = p.id;
        node.innerHTML = `<div class="facing"></div>
          <div class="stand"><div class="badges"></div><div class="mini-hp"><i></i></div><div class="avatar">${p.emoji}</div></div>`;
        el.pieces.appendChild(node);
      }
      node.style.setProperty('--x', p.x);
      node.style.setProperty('--y', p.y);
      node.style.setProperty('--face', p.ang + 'deg');
      node.style.setProperty('--pc', p.color);
      // 직업(증강)을 고르면 동물 대신 그 직업 캐릭터로
      const ch = p.style && window.Chars && Chars.has(p.style) ? p.style : '';
      const av = node.querySelector('.avatar');
      if (av.dataset.ch !== ch) {
        av.dataset.ch = ch;
        av.classList.toggle('char', !!ch);
        node.classList.toggle('chared', !!ch);
        av.innerHTML = ch ? `<div class="flip">${Chars.svg(ch)}</div>` : p.emoji;
      }
      if (ch) {
        faceFlip(node, p);
        if (!p.alive && !node.classList.contains('dead')) charPlay(p, 'ko');
      }
      node.classList.toggle('current', p === cur() && ['choose', 'rotate', 'busy'].includes(S.phase));
      node.classList.toggle('dead', !p.alive);
      node.classList.toggle('poisoned', p.poison > 0);
      node.querySelector('.mini-hp i').style.width = (p.hp / S.maxHp * 100) + '%';
      node.querySelector('.badges').textContent = (p.shield ? '🛡️' : '') + (p.power ? '💥' : '') + (p.poison > 0 ? '☠️' : '');
    }
  }

  /** 목록·차례 칸의 얼굴: 직업을 골랐으면 그 캐릭터(멈춘 그림), 아니면 동물 */
  const face = p => (p.style && window.Chars && Chars.has(p.style)
    ? `<span class="mini-ch" style="--pc:${p.color}">${Chars.svg(p.style).replace('st-idle', 'st-still')}</span>` : p.emoji);
  /** 캐릭터가 조준 방향(화면 기준 왼쪽/오른쪽)을 바라보게 */
  function faceFlip(node, p) {
    const s = Math.sin((p.ang + (S.ang || 0)) * Math.PI / 180);
    if (Math.abs(s) > 0.15) node.style.setProperty('--flip', s < 0 ? -1 : 1);
  }
  /** 판 위 직업 캐릭터 동작: 'attack' | 'hit' | 'ko' | 'win' */
  function charPlay(p, st) {
    const svgEl = el.pieces && el.pieces.querySelector(`[data-id="${p.id}"] .avatar svg`);
    if (svgEl && window.Chars) Chars.play(svgEl, st);
  }

  function renderTurn() {
    const p = cur();
    if (!p || S.phase === 'setup' || S.phase === 'over' || S.phase === 'handover') {
      el.turnPanel.innerHTML = S.phase === 'handover' ? '<p class="muted">차례를 넘기는 중…</p>' : '';
      return;
    }
    const head = `
      <div class="turn-head" style="--pc:${p.color}">
        <span class="big">${face(p)}</span>
        <div><b>${esc(p.name)}</b> 차례 ${S.extraActive ? '<span class="chip extra">⏩ 추가 행동</span>' : ''}<br>
        <small>${coord(p.x, p.y)} · 조준 ${Math.round(p.ang)}° ${p.style ? `· ${STYLES[p.style].icon} ${STYLES[p.style].name}` : ''}</small></div>
      </div>`;

    if (!myTurn()) {
      const doing = Net.seatStatus(S.turn);
      el.turnPanel.innerHTML = head + `
        <div class="waiting">
          <span class="dots"><i></i><i></i><i></i></span>
          <span>${S.phase === 'busy' && S.applying ? '행동 진행 중…' : p.bot ? `🤖 ${esc(S.botStatus || '생각 중…')}` : doing ? esc(doing) : `${esc(p.name)} 님이 고르는 중…`}</span>
        </div>
        <p class="hint">${p.bot ? 'AI 가 알아서 문제를 풀고 행동해요.' : '내 차례가 되면 여기에 행동 버튼이 나타나요.'}</p>`;
      return;
    }

    const dis = canAct() ? '' : 'disabled';
    const btn = (k, cls = '') => {
      const a = actionInfo(k, p);
      return `<button class="act ${cls}" data-a="${k}" ${dis}><span class="ai">${a.icon}</span><span><b>${a.name}</b><br><small>${a.sub}</small></span></button>`;
    };
    el.turnPanel.innerHTML = head + `
      <div class="aim-box">
        <div class="aim-row"><b>🧭 조준 ${Math.round(p.ang)}°</b>${aimLimited(p) ? `<span class="chip limit-chip">🎯 이번 턴 ±${SNIPER_TURN}°</span>` : ''}<span class="chip free-chip">무료</span></div>
        <div class="rot-btns four">
          <button data-r="-15" ${dis}>⟲ 15°</button><button data-r="-5" ${dis}>⟲ 5°</button>
          <button data-r="5" ${dis}>5° ⟳</button><button data-r="15" ${dis}>15° ⟳</button>
        </div>
        <small class="muted">판 위의 칸을 누르면 그 칸을 바로 조준해요. (← → 키: 5°, Shift: 15°)</small>
      </div>
      <div class="actions">
        ${p.style ? (prepRound() || S.extraActive
          ? `<button class="act wide" disabled><span class="ai">${STYLES[p.style].icon}</span><span><b>공격 · ${STYLES[p.style].name}</b><br><small>${prepRound() ? '준비 라운드: 2라운드부터 공격할 수 있어요' : '추가 행동으로는 공격할 수 없어요'}</small></span></button>`
          : btn('attack', 'wide')) : `<button class="act wide free" data-a="augment" ${dis}><span class="ai">✨</span><span><b>증강 고르기</b><br><small>공격 스타일을 먼저 고르세요</small></span></button>`}
        ${btn('move')}${btn('box')}
      </div>
      ${brawl() ? `<p class="brawl-state">${S.myBusy ? '⏳ 내 행동을 처리하는 중…' : Date.now() < S.lockUntil ? `😵 오답! ${Math.ceil((S.lockUntil - Date.now()) / 1000)}초 뒤 다시 도전` : '🔥 난전: 문제를 맞히는 대로 바로 행동!'}</p>` : ''}
      <p class="hint">공격·이동·랜덤박스는 <b>문제를 맞혀야</b> 실행됩니다. ${brawl() ? `오답이면 ${BRAWL_LOCK_MS / 1000}초 동안 쉬어요.` : '오답이면 그대로 턴 종료!'}<br>
      판 위 점선·네모는 지금 공격하면 닿는 곳, 빨간 원은 맞는 적이에요.</p>`;
    el.turnPanel.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => onAction(b.dataset.a); });
    el.turnPanel.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => setAim(p.ang + Number(b.dataset.r)); });
  }

  // ---------------- 관전 카드: 상대 차례에 상대가 보는 화면을 그대로 ----------------
  function renderSpectate() {
    const box = el.spectate;
    if (!box) return;
    const p = cur();
    const L = S.online && !brawl() && p && !myTurn() && ['choose', 'busy'].includes(S.phase) && !S.applying ? Net.seatLive(S.turn) : null;
    if (!L || !['level', 'quiz', 'result', 'cell'].includes(L.st)) {
      box.hidden = true;
      clearInterval(S.specTimer);
      S.specKey = null;
      return;
    }
    const key = JSON.stringify([S.turn, L.st, L.key, L.q, L.pk]);
    if (S.specKey === key) return;
    // 새 문제가 뜬 순간부터 남은 시간을 센다 (기기 시계 차이와 무관)
    if (L.st === 'quiz' && (!S.specQ || S.specQ !== L.q)) { S.specQ = L.q; S.specStart = Date.now(); }
    S.specKey = key;
    clearInterval(S.specTimer);
    const a = actionInfo(['attack', 'move', 'box'].includes(L.key) ? L.key : 'box', p);
    const lv = LEVELS[L.level] ? L.level : 'easy';
    const cat = CAT_KEYS.includes(L.cat) ? L.cat : null;
    const head = `<div class="spec-head" style="--pc:${p.color}"><span class="spec-eye">👀</span><b>${p.emoji} ${esc(p.name)}</b><span class="muted">${a.icon} ${esc(a.name)}</span></div>`;
    let body = '';
    if (L.st === 'level') body = '<p class="spec-wait">과목과 난이도를 고르는 중…</p>';
    else if (L.st === 'cell') body = `<p class="spec-wait">${L.key === 'move' ? '👣 이동할 칸을 고르는 중…' : '💣 폭격할 칸을 고르는 중…'}</p>`;
    else {
      const ch = Array.isArray(L.ch) ? L.ch.slice(0, 4) : [];
      const res = L.st === 'result';
      const pk = Number(L.pk), ans = Number(L.ans);
      body = `
        <div class="spec-tags">${cat ? `<span class="chip cat-chip">${CAT_ICONS[cat]} ${esc(catInfo(cat).name)}</span>` : ''}<span class="chip ${lv}">${LEVELS[lv].label}</span><span class="topic">${esc(cleanText(L.topic, 24))}</span></div>
        ${!res && L.lim ? '<div class="timer"><div class="timer-fill"></div><span class="timer-num"></span></div>' : ''}
        <div class="question">${tex(L.q || '')}</div>
        <div class="choices spec-choices">${ch.map((c, i) => `<div class="choice ${res && i === ans ? 'correct' : ''} ${res && i === pk && i !== ans ? 'wrong' : ''}"><span class="key">${i + 1}</span><span class="ctext">${tex(c)}</span></div>`).join('')}</div>
        ${res ? `<div class="verdict ${L.ok ? 'ok' : 'bad'}">${L.ok ? `정답! ${Number(L.sec) || ''}초` : pk === -1 ? '⏰ 시간 초과' : '오답'}</div>` : ''}`;
    }
    box.innerHTML = head + body;
    box.hidden = false;
    const fill = box.querySelector('.timer-fill');
    if (fill) {
      const limit = Number(L.lim) * 1000;
      const numEl = box.querySelector('.timer-num');
      const tick = () => {
        const left = Math.max(0, limit - (Date.now() - S.specStart));
        fill.style.transform = `scaleX(${left / limit})`;
        numEl.textContent = Math.ceil(left / 1000) + 's';
        fill.classList.toggle('warn', left <= 10000);
      };
      tick();
      S.specTimer = setInterval(tick, 200);
    }
  }

  // ---------------- SVG 효과 ----------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent = el.fx) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }
  const clearFx = sel => el.fx.querySelectorAll(sel).forEach(n => n.remove());

  function burst(x, y, color = '#fff') {
    const c = svg('circle', { class: 'burst', cx: x, cy: y, r: 0.1, stroke: color });
    setTimeout(() => c.remove(), 700);
  }

  // ---------------- 직업별 탄환·타격 모양 ----------------
  // head: 날아가는 탄 · trail: 남는 궤적 · tint: 탄 색(없으면 플레이어 색) · hit: 맞았을 때 이펙트(소리도 같은 이름) · speed: 칸/초
  const LOOKS = {
    sniper:    { head: 'tracer', trail: 'thin', tint: '#fff6c0', speed: 24, hit: 'spark' },
    shotgun:   { head: 'pellet', trail: 'none', tint: '#ffd27a', speed: 16, hit: 'spark' },
    ricochet:  { head: 'pebble', trail: 'dash', speed: 11, hit: 'thud' },
    bishop:    { head: 'cross', trail: 'glow', tint: '#fff4b0', speed: 13, hit: 'holy' },
    rook:      { head: 'plus', trail: 'glow', tint: '#fff4b0', speed: 13, hit: 'holy' },
    queen:     { head: 'star', trail: 'glow', tint: '#ffe38a', speed: 13, hit: 'holy' },
    scatter:   { head: 'tracer', trail: 'none', tint: '#ffe14d', speed: 20, hit: 'spark' },
    laser:     { head: 'none', trail: 'beam', speed: 45, hit: 'burn' },
    spear:     { head: 'spear', trail: 'none', speed: 14, hit: 'slash' },
    vampire:   { head: 'fang', trail: 'blood', tint: '#ff3b5c', speed: 13, hit: 'bite' },
    chain:     { head: 'none', trail: 'bolt', tint: '#fff27a', speed: 40, hit: 'zap' },
    boomerang: { head: 'boomerang', trail: 'none', speed: 10, hit: 'thud' },
    grapple:   { head: 'hook', trail: 'rope', speed: 14, hit: 'thud' },
    homing:    { head: 'orb', trail: 'glow', tint: '#9ef0ff', speed: 9, hit: 'magic' },
    knight:    { head: 'dot', trail: 'dash', speed: 14, hit: 'quake' },
    king:      { head: 'crown', trail: 'glow', tint: '#ffcb3d', speed: 12, hit: 'quake' },
    assassin:  { head: 'none', trail: 'none', speed: 30, hit: 'stab' },
    poison:    { head: 'flask', trail: 'drip', tint: '#7dff6a', speed: 10, hit: 'poison' },
    archer:    { head: 'arrow', trail: 'thin', tint: '#f3e3b5', speed: 20, hit: 'pierce' },
    bomber:    { head: 'bomb', trail: 'dash', tint: '#ffb35c', speed: 8, hit: 'boom' },
  };
  // 칸을 치는 공격의 타격 모양
  const CELL_HIT = { mortar: 'boom', king: 'quake', whirl: 'wind', shockwave: 'wave', knight: 'quake', bomber: 'boom' };
  const lookOf = style => LOOKS[style] || { head: 'dot', trail: 'line', speed: 12, hit: CELL_HIT[style] || 'thud' };

  const starPath = (R, r, n = 5) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, k = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (Math.cos(a) * k).toFixed(3) + ' ' + (Math.sin(a) * k).toFixed(3);
    }
    return d + 'Z';
  };

  /** 날아가는 탄 모양 (원점이 탄 머리, +x 가 날아가는 방향) */
  function makeHead(kind, color) {
    if (kind === 'none') return null;
    const g = svg('g', { class: 'head' });
    const add = (tag, a) => svg(tag, a, g);
    const stroke = (d, col, w) => add('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    switch (kind) {
      case 'tracer': stroke('M-.75 0 L0 0', color, 0.07); add('circle', { r: 0.07, fill: '#fff' }); break;
      case 'pellet': add('circle', { r: 0.09, fill: color, stroke: '#fff', 'stroke-width': 0.02 }); break;
      case 'pebble': add('circle', { r: 0.13, fill: '#9aa0ad', stroke: '#151827', 'stroke-width': 0.04 }); break;
      case 'shell': add('ellipse', { rx: 0.17, ry: 0.12, fill: '#3a3e4f', stroke: '#ffb35c', 'stroke-width': 0.03 }); break;
      case 'cross': stroke('M-.18 -.18 L.18 .18 M.18 -.18 L-.18 .18', color, 0.09); add('circle', { r: 0.06, fill: '#fff' }); break;
      case 'plus': stroke('M-.22 0 L.22 0 M0 -.22 L0 .22', color, 0.09); add('circle', { r: 0.06, fill: '#fff' }); break;
      case 'star': add('path', { d: starPath(0.24, 0.1), fill: color, stroke: '#fff', 'stroke-width': 0.025 }); break;
      case 'spear':
        stroke('M-.95 0 L-.1 0', '#151827', 0.1); stroke('M-.95 0 L-.1 0', '#b07a3e', 0.05);
        add('path', { d: 'M-.16 -.11 L.16 0 L-.16 .11 L-.1 0 Z', fill: '#e6ebf5', stroke: '#151827', 'stroke-width': 0.025 });
        break;
      case 'fang': add('circle', { r: 0.16, fill: color, opacity: 0.9 }); add('path', { d: 'M-.09 -.05 L-.045 .1 L0 -.05 Z M0 -.05 L.045 .1 L.09 -.05 Z', fill: '#fff' }); break;
      case 'boomerang': stroke('M-.17 -.19 L.1 0 L-.17 .19', '#151827', 0.14); stroke('M-.17 -.19 L.1 0 L-.17 .19', '#d9964a', 0.08); break;
      case 'hook':
        stroke('M-.18 0 L.12 0 M.02 -.15 Q.26 0 .02 .15', '#151827', 0.1);
        stroke('M-.18 0 L.12 0 M.02 -.15 Q.26 0 .02 .15', '#c7ceda', 0.045);
        break;
      case 'flask':
        add('path', { d: 'M-.05 -.2 L.05 -.2 L.05 -.08 Q.17 -.02 .15 .1 Q.12 .2 0 .2 Q-.12 .2 -.15 .1 Q-.17 -.02 -.05 -.08 Z', fill: '#e8f7ff', stroke: '#151827', 'stroke-width': 0.03 });
        add('path', { d: 'M-.13 .04 Q0 .0 .13 .04 Q.12 .17 0 .17 Q-.12 .17 -.13 .04 Z', fill: color });
        break;
      case 'arrow':
        stroke('M-.8 0 L.05 0', '#151827', 0.07); stroke('M-.8 0 L.05 0', '#c9a26a', 0.035);
        add('path', { d: 'M.2 0 L0 -.08 L.03 0 L0 .08 Z', fill: '#dfe4ee', stroke: '#151827', 'stroke-width': 0.02 });
        add('path', { d: 'M-.8 0 L-.92 -.08 M-.8 0 L-.92 .08 M-.7 0 L-.82 -.08 M-.7 0 L-.82 .08', stroke: color, 'stroke-width': 0.035, 'stroke-linecap': 'round' });
        break;
      case 'crown':
        add('path', { d: 'M-.2 .12 L-.22 -.12 L-.1 0 L0 -.18 L.1 0 L.22 -.12 L.2 .12 Z', fill: color, stroke: '#151827', 'stroke-width': 0.03, transform: 'rotate(90)' });
        break;
      case 'bomb':
        add('circle', { r: 0.16, fill: '#2a2d3a', stroke: '#151827', 'stroke-width': 0.03 });
        add('circle', { cx: -0.05, cy: -0.05, r: 0.04, fill: '#fff', opacity: 0.5 });
        stroke('M.08 -.12 Q.16 -.2 .2 -.26', '#c9a26a', 0.03);
        add('circle', { cx: 0.2, cy: -0.26, r: 0.05, fill: '#ffe14d' });
        break;
      case 'orb': add('circle', { r: 0.22, fill: color, opacity: 0.35 }); add('circle', { r: 0.11, fill: '#e8fdff', stroke: color, 'stroke-width': 0.04 }); break;
      default: add('circle', { class: 'bullet', r: 0.15, fill: color });
    }
    return g;
  }
  // 빙글빙글 도는 탄 (칸당 회전 각도)
  const SPIN = { boomerang: 600, star: 220, cross: 180, plus: 180, pebble: 0, flask: 420, bomb: 300 };

  /** 번개: 경로를 잘게 나눠 옆으로 흔든다 (매 프레임 새로 → 지직거림) */
  function jagged(pts) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 0.35));
      const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
      for (let k = 1; k <= n; k++) {
        const f = k / n, j = k === n ? 0 : (Math.random() - 0.5) * 0.3;
        out.push([x0 + (x1 - x0) * f + nx * j, y0 + (y1 - y0) * f + ny * j]);
      }
    }
    return out;
  }

  /** 맞은 자리 이펙트. rot: 공격이 들어온 방향(라디안) */
  function impactFx(x, y, kind, color = '#fff', rot = 0, parent = el.fx) {
    const g = svg('g', { class: 'imp imp-' + kind, transform: `translate(${x} ${y}) rotate(${(rot * 180 / Math.PI).toFixed(1)})` }, parent);
    const inner = svg('g', { class: 'imp-in' }, g);
    const add = (tag, a) => svg(tag, a, inner);
    const stroke = (d, col, w, extra = {}) => add('path', Object.assign({ d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, extra));
    const rays = (n, r1, r2, col, w, a0 = 0) => {
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = a0 + i * 2 * Math.PI / n;
        d += `M${(Math.cos(a) * r1).toFixed(3)} ${(Math.sin(a) * r1).toFixed(3)} L${(Math.cos(a) * r2).toFixed(3)} ${(Math.sin(a) * r2).toFixed(3)} `;
      }
      stroke(d, col, w);
    };
    switch (kind) {
      case 'spark': rays(8, 0.12, 0.44, '#ffe14d', 0.06, Math.random()); add('circle', { r: 0.13, fill: '#fff' }); break;
      case 'thud': add('circle', { r: 0.3, fill: 'none', stroke: '#f1eadb', 'stroke-width': 0.06 }); rays(6, 0.2, 0.38, '#fff', 0.05, 0.3); break;
      case 'holy': add('circle', { r: 0.34, fill: 'none', stroke: '#fff4b0', 'stroke-width': 0.06 }); stroke('M0 -.32 L0 .32 M-.32 0 L.32 0', '#fff', 0.07); break;
      case 'burn': add('circle', { r: 0.34, fill: color, opacity: 0.55 }); add('circle', { r: 0.16, fill: '#fff' }); rays(6, 0.3, 0.46, '#ffb35c', 0.05); break;
      case 'slash': stroke('M-.4 .3 Q0 0 .4 -.34', '#fff', 0.08); stroke('M-.3 .4 Q.06 .12 .32 -.2', color, 0.045); break;
      case 'bite': stroke('M-.26 -.3 L-.12 .3 M0 -.34 L0 .3 M.26 -.3 L.12 .3', '#ff3b5c', 0.08); add('circle', { r: 0.1, fill: '#ff8fa3', opacity: 0.8 }); break;
      case 'zap': stroke('M-.36 -.2 L-.1 -.05 L-.22 .1 L.1 .2 L0 .38 M.36 -.32 L.12 -.12 L.28 0', '#fff27a', 0.06); add('circle', { r: 0.14, fill: '#fffbd0' }); break;
      case 'magic': add('path', { d: starPath(0.38, 0.13, 4), fill: color, opacity: 0.9 }); add('circle', { r: 0.08, fill: '#fff' }); break;
      case 'boom': add('circle', { r: 0.52, fill: '#ff9f43', opacity: 0.75 }); add('circle', { r: 0.28, fill: '#ffe07a' }); rays(10, 0.48, 0.72, '#ffb35c', 0.07, Math.random()); break;
      case 'quake': add('circle', { r: 0.46, fill: 'none', stroke: '#ffe07a', 'stroke-width': 0.08 }); rays(8, 0.18, 0.36, '#fff4b0', 0.05); break;
      case 'wind': stroke('M-.36 0 A.36 .36 0 1 1 0 .36 M-.2 0 A.2 .2 0 1 1 0 .2', '#bff3ff', 0.06); break;
      case 'wave': stroke('M-.12 -.42 Q.24 0 -.12 .42 M.12 -.32 Q.42 0 .12 .32', '#dff6ff', 0.07); break;
      case 'stab': stroke('M-.42 0 L.34 0', '#fff', 0.07); rays(4, 0.12, 0.3, '#ff5d6c', 0.05, 0.4); add('circle', { r: 0.08, fill: '#fff' }); break;
      case 'poison':
        add('circle', { r: 0.3, fill: '#7dff6a', opacity: 0.35 });
        for (const [cx, cy, r] of [[-0.14, -0.1, 0.1], [0.12, -0.18, 0.07], [0.05, 0.12, 0.08], [-0.2, 0.16, 0.05]]) add('circle', { cx, cy, r, fill: 'none', stroke: '#b8ff9e', 'stroke-width': 0.035 });
        break;
      case 'pierce': stroke('M-.5 0 L.1 0', '#c9a26a', 0.05); rays(6, 0.14, 0.34, '#fff4b0', 0.05); break;
      case 'lock': add('rect', { x: -0.38, y: -0.38, width: 0.76, height: 0.76, rx: 0.08, fill: 'rgba(255,203,61,.18)', stroke: color, 'stroke-width': 0.06 }); stroke('M-.14 -.14 L.14 .14 M.14 -.14 L-.14 .14', color, 0.05); break;
      case 'smoke': for (const [cx, cy, r] of [[0, 0, 0.3], [-0.22, 0.08, 0.2], [0.22, 0.1, 0.2], [0, -0.22, 0.18]]) add('circle', { cx, cy, r, fill: color, opacity: 0.75 }); break;
      default: add('circle', { r: 0.3, fill: 'none', stroke: color, 'stroke-width': 0.08 });
    }
    setTimeout(() => g.remove(), 750);
  }

  /** 맞은 말 앞에 튀어나오는 타격 이펙트 (판 바닥 이펙트는 서 있는 캐릭터에 가려지므로) */
  function impactOn(q, kind, color, rot = 0) {
    const stand = el.pieces.querySelector(`[data-id="${q.id}"] .stand`);
    if (!stand) return;
    const box = document.createElementNS(SVGNS, 'svg');
    box.setAttribute('viewBox', '-1 -1 2 2');
    box.setAttribute('class', 'fx imp-pop');
    stand.appendChild(box);
    impactFx(0, 0, kind, color, rot + (S.ang || 0) * Math.PI / 180, box);
    setTimeout(() => box.remove(), 800);
  }

  /** 판 흔들기 (1: 약하게, 2: 세게) */
  function shakeBoard(power = 1) {
    if (!el.board || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    el.board.classList.remove('shake-1', 'shake-2');
    void el.board.offsetWidth;
    el.board.classList.add('shake-' + power);
    clearTimeout(shakeBoard.t);
    shakeBoard.t = setTimeout(() => el.board.classList.remove('shake-1', 'shake-2'), 500);
  }

  /** 폴리라인 경로를 따라 탄환을 날린다. events: [{ d: 이동거리, fn }] 은 탄환이 d 지점을 지날 때 실행. look: 직업별 탄 모양 */
  function animatePath(pts, color, speed = 11, events = [], look = null) {
    look = look || { head: 'dot', trail: 'line' };
    if (look.speed) speed = look.speed;
    const tint = look.tint || color;
    return new Promise(resolve => {
      const line = svg('polyline', { class: 'shot t-' + (look.trail || 'line'), stroke: look.trail === 'rope' ? '#c9a26a' : tint, points: '' });
      const core = look.trail === 'beam' ? svg('polyline', { class: 'shot t-core', stroke: '#fff', points: '' }) : null;
      const ball = makeHead(look.head, tint);
      const spin = SPIN[look.head] || 0;
      const lens = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        lens.push(l); total += l;
      }
      const dur = Math.max(350, (total / speed) * 1000);
      const t0 = performance.now();
      let passed = 0;
      const frame = now => {
        const d = Math.min(1, (now - t0) / dur) * total;
        const out = [pts[0]];
        let acc = 0, head = pts[0], seg = 0;
        for (let i = 0; i < lens.length; i++) {
          if (acc + lens[i] >= d) {
            const f = lens[i] ? (d - acc) / lens[i] : 1;
            head = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
            out.push(head);
            seg = i;
            break;
          }
          acc += lens[i];
          out.push(pts[i + 1]);
          head = pts[i + 1];
          seg = i + 1;
        }
        // 반사 지점 통과 시 스파크
        while (passed < seg && passed < pts.length - 2) { passed++; burst(pts[passed][0], pts[passed][1], '#fff'); }
        const shown = look.trail === 'bolt' ? jagged(out) : out;
        const ptsAttr = shown.map(q => q.join(',')).join(' ');
        line.setAttribute('points', ptsAttr);
        if (core) core.setAttribute('points', ptsAttr);
        if (ball) {
          const s = Math.min(seg, pts.length - 2), a = Math.atan2(pts[s + 1][1] - pts[s][1], pts[s + 1][0] - pts[s][0]) * 180 / Math.PI;
          ball.setAttribute('transform', `translate(${head[0]} ${head[1]}) rotate(${(spin ? d * spin : a).toFixed(1)}) scale(1.4)`);
        }
        for (const e of events) if (!e.done && e.d <= d) { e.done = true; e.fn(); }
        if (d < total) requestAnimationFrame(frame);
        else {
          // 끝점에서 부동소수 오차로 남은 적중이 있으면 마저 처리
          for (const e of events) if (!e.done) { e.done = true; e.fn(); }
          if (ball) ball.remove();
          setTimeout(() => {
            line.classList.add('fade'); if (core) core.classList.add('fade');
            setTimeout(() => { line.remove(); if (core) core.remove(); }, 650);
          }, look.trail === 'beam' || look.trail === 'bolt' ? 120 : 250);
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  function floatText(p, text, cls) {
    const stand = el.pieces.querySelector(`[data-id="${p.id}"] .stand`);
    if (!stand) return;
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = text;
    stand.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  function hitFx(p) {
    const node = el.pieces.querySelector(`[data-id="${p.id}"]`);
    if (!node) return;
    node.classList.remove('hit');
    void node.offsetWidth;
    node.classList.add('hit');
    charPlay(p, 'hit');
  }

  let toastTimer = null;
  function toast(msg, ms = 1800) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function log(html) {
    const li = document.createElement('li');
    li.innerHTML = html;
    el.log.prepend(li);
    while (el.log.children.length > 60) el.log.lastChild.remove();
  }

  // ---------------- 모달 ----------------
  function openModal(html, cls = '', dock = false) {
    el.modalCard.className = 'card ' + cls;
    el.modalCard.innerHTML = html;
    el.modal.classList.toggle('dock', dock);
    el.modal.classList.remove('hidden');
    return el.modalCard;
  }
  function closeModal() {
    S.augmentOpen = false;
    el.modal.classList.add('hidden');
    el.modalCard.innerHTML = '';
    S.keyHandler = null;
  }

  // ------------------------------------------------------------------
  //  턴 진행
  // ------------------------------------------------------------------
  function showHandover() {
    const p = cur();
    if (p && p.bot) {
      el.handover.classList.add('hidden');
      S.phase = 'choose';
      renderAll();
      toast(`🤖 ${p.emoji} ${p.name} 차례`);
      scheduleBot();
      return;
    }
    S.phase = 'handover';
    renderAll();
    el.handover.innerHTML = `
      <div class="card small handover-card" style="--pc:${p.color}">
        <div class="ho-emoji">${p.emoji}</div>
        <h2>${esc(p.name)} 차례</h2>
        <p>라운드 ${S.round}${prepRound() ? ' <b>(준비 라운드 · 공격 불가)</b>' : ''} · 기기를 <b>${esc(p.name)}</b>에게 넘겨주세요.<br>HP ${p.hp} ${p.shield ? '· 🛡️ 방패' : ''} ${p.power ? '· 💥 강화탄' : ''}</p>
        <button class="primary big" id="btnGo">시작 ▶</button>
      </div>`;
    el.handover.classList.remove('hidden');
    const go = $('#btnGo');
    sfx('turn');
    go.focus();
    go.onclick = () => {
      el.handover.classList.add('hidden');
      S.phase = 'choose';
      renderAll();   // 카메라가 이 플레이어 시점으로 이동
      toast(`${p.emoji} ${p.name} 시점`);
      maybeAugment();
    };
  }

  async function endTurn() {
    if (checkWin()) return;
    S.extra = false;
    S.extraActive = false;
    const n = S.players.length;
    const aliveCount = alive().length;
    let pos = S.pos, round = S.round, id = S.turn;
    for (let guard = 0; guard < 4 * n; guard++) {
      pos++;
      if (pos >= n) { pos = 0; round++; S.round = round; zoneRound(); }
      id = orderFor()[pos];
      // 죽은 사람은 건너뛰고, 라운드가 바뀌며 같은 사람이 연달아 두 번 하지 않게 한다
      if (S.players[id].alive && (id !== S.turn || aliveCount < 2)) break;
    }
    S.pos = pos; S.round = round; S.turn = id;
    poisonTick(S.players[id]);
    if (checkWin()) return;   // 자기장·독 피해로 끝났을 수 있다
    if (!S.players[id].alive) return endTurn();   // 독으로 쓰러졌으면 다음 사람
    S.players[id].aimBase = S.players[id].ang;   // 저격 조준 제한의 기준 (이번 턴 시작 방향)
    S.awayNoted = false;
    await sleep(350);
    if (S.online) startOnlineTurn();
    else showHandover();
  }

  function startOnlineTurn() {
    S.phase = 'choose';
    if (brawl()) {
      const me = S.online && S.players[S.online.mySeat];
      S.turn = me ? S.online.mySeat : Math.max(0, S.players.findIndex(q => q.alive));
      renderAll();
      toast('🔥 난전 시작! 문제를 맞히는 대로 바로 행동하세요');
      maybeAugment();
      startBrawlBots();
      return;
    }
    renderAll();
    const p = cur();
    toast(myTurn() ? '🔔 내 차례!' : `${p.bot ? '🤖 ' : ''}${p.emoji} ${p.name} 차례`);
    if (myTurn()) sfx('turn');
    maybeAugment();
    scheduleBot();
  }

  function checkWin() {
    const left = alive();
    if (left.length > 1) return false;
    S.phase = 'over';
    renderAll();
    if (window.Music) Music.victory();
    const w = left[0];
    if (w) charPlay(w, 'win');
    const top = Math.max(...S.players.map(p => p.score));
    const stats = S.players.map(p => `<tr><td>${p.emoji} ${esc(p.name)}</td><td>${p.alive ? p.hp : '탈락'}</td><td>${p.correct}/${p.tries}</td><td>${p.score}${p.score === top && top > 0 ? ' 🏅' : ''}</td></tr>`).join('');
    const c = openModal(`
      <div class="victory" style="--pc:${w ? w.color : '#fff'}">
        <div class="crown">${w ? '👑' : '🤝'}</div>
        <h2>${w ? `${w.emoji} ${esc(w.name)} 승리!` : '무승부'}</h2>
        <p class="muted">${S.round} 라운드 만에 결판이 났습니다.</p>
        <div class="rules"><table><tr><th>플레이어</th><th>HP</th><th>정답/시도</th><th>점수</th></tr>${stats}</table></div>
        <p></p>
        ${!S.online ? '<button class="primary big" id="btnAgain">다시 하기 ↻</button>'
          : S.online.host ? '<button class="primary big" id="btnAgain">같은 방에서 한 판 더 ↻</button>'
          : '<p class="muted">방장이 한 판 더를 누르면 바로 이어집니다.</p>'}
        ${S.online ? '<button class="ghost wide" id="btnOut">방 나가기</button>' : ''}
      </div>`, 'small');
    const again = c.querySelector('#btnAgain');
    if (again) {
      again.onclick = () => {
        if (S.online) { Net.submit({ key: 'restart' }); return; }
        closeModal(); el.setup.classList.remove('hidden'); S.phase = 'setup'; renderAll();
      };
    }
    const out = c.querySelector('#btnOut');
    if (out) out.onclick = () => { closeModal(); Net.leave(); };
    log(w ? `🏆 ${tag(w)} 최종 승리!` : '🤝 무승부!');
    return true;
  }

  // ------------------------------------------------------------------
  //  증강 (공격 스타일) — 각 플레이어가 첫 차례에 무작위 3개 중 하나를 고른다
  // ------------------------------------------------------------------
  const SNIPER_TURN = 30;     // 저격: 한 턴에 돌릴 수 있는 조준 각도 (턴 시작 방향 ±)
  const SNIPER_BOUNCES = 2;   // 저격 탄: 관통하며 벽에 두 번 튕긴다 (같은 적을 여러 번 맞힐 수 있음)
  const RICO_BOUNCES = 4, RICO_BONUS = 0.5;   // 도탄: 관통 없이 최대 4번 튕기고, 튕길 때마다 피해 +50%
  const BOOMERANG_LEN = 3.5;  // 부메랑: 날아가는 거리
  const GRAPPLE_LEN = 5.5;    // 갈고리: 닿는 거리
  const WAVE_R = 3.2, WAVE_HALF = 45;   // 충격파: 반지름, 부채꼴 반각
  const HOMING_R = 5;         // 유도탄: 노리는 거리
  const KING_R = 4, CHECK_BONUS = 0.15;   // 킹(체크메이트): 노리는 거리, 적 주변 막힌 칸 하나당 피해 +15%
  const ASSASSIN_R = 4;       // 암살: 노리는 거리
  const POISON_LEN = 4.5, POISON_TICKS = 3, POISON_DMG = 8;   // 독: 사거리, 독 횟수, 독 피해
  const ARROW_LEN = 7, ARROW_BONUS = 0.12;   // 궁수: 사거리, 한 칸 멀어질 때마다 피해 +12%
  const BOMB_LEN = 5;         // 폭탄: 굴러가는 거리
  const STYLES = {
    sniper:   { icon: '🎯', name: '저격', desc: `관통하며 벽에 ${SNIPER_BOUNCES}번 튕기는 탄. 튕긴 탄이 같은 적을 또 맞힐 수 있음 (자신은 안 맞음). 대신 한 턴에 조준을 ±${SNIPER_TURN}°까지만 돌릴 수 있음`, aim: true, dmg: { easy: 16, hard: 22 } },
    shotgun:  { icon: '💥', name: '산탄', desc: '조준 방향 ±20° 세 갈래, 사거리 3칸. 겹쳐 맞으면 누적', aim: true, dmg: { easy: 17, hard: 22 } },
    ricochet: { icon: '🌀', name: '도탄', desc: `튕김탄. 관통하지 않고 처음 맞는 적에게 멈추지만, 벽에 튕길 때마다 피해 +${RICO_BONUS * 100}% (최대 ${RICO_BOUNCES}번). 튕긴 탄에 자신도 맞을 수 있음`, aim: true, dmg: { easy: 14, hard: 19 } },
    bishop:   { icon: '✖️', name: '비숍', desc: '대각선 4방향 동시 발사. 방향마다 첫 번째 적', dmg: { easy: 28, hard: 38 } },
    rook:     { icon: '➕', name: '룩', desc: '가로·세로 4방향 동시 발사. 방향마다 첫 번째 적', dmg: { easy: 28, hard: 38 } },
    knight:   { icon: '🐴', name: '나이트', desc: 'L자 칸(체스 나이트 이동)을 골라 뛰어들어, 착지한 곳 주변 8칸의 적을 모두 타격', target: true, dmg: { easy: 28, hard: 37 } },
    king:     { icon: '👑', name: '킹', desc: `체크메이트: ${KING_R}칸 안의 가장 가까운 적을 노림. 그 적 주변 8칸 중 막힌 칸(판 끝·다른 말·돌·상자·자기장)이 많을수록 강함 (한 칸마다 +${Math.round(CHECK_BONUS * 100)}%, 구석이면 ×1.75)`, dmg: { easy: 20, hard: 27 } },
    mortar:   { icon: '💣', name: '박격포', desc: '5칸 안의 칸을 골라 3×3 폭발 (가장자리 60%). 범위 안이면 자신도 맞음', target: true, dmg: { easy: 25, hard: 35 } },
    scatter:  { icon: '🎲', name: '난사', desc: '무작위 적 근처(±1칸) 무작위 좌표로 세 발, 각각 벽에 3번 튕기며 관통 (겹치면 누적). 운에 맡기는 한 방', dmg: { easy: 14, hard: 19 } },
    queen:    { icon: '👸', name: '퀸', desc: '가로·세로·대각선 8방향 동시 발사. 방향마다 첫 번째 적', dmg: { easy: 19, hard: 26 } },
    laser:    { icon: '🔦', name: '레이저', desc: '조준 방향 일직선을 끝까지 관통 (반사 없음)', aim: true, dmg: { easy: 22, hard: 30 } },
    spear:    { icon: '🔱', name: '창', desc: '조준 방향 2칸 거리까지 관통하는 강한 찌르기', aim: true, dmg: { easy: 35, hard: 46 } },
    vampire:  { icon: '🧛', name: '흡혈', desc: '조준 방향 직선, 처음 맞는 적. 준 피해의 1/3 만큼 회복', aim: true, dmg: { easy: 19, hard: 26 } },
    chain:    { icon: '🌩️', name: '체인 번개', desc: '4칸 안의 가장 가까운 적부터 3칸 안의 다음 적으로 튕기며 최대 3명', dmg: { easy: 20, hard: 28 } },
    whirl:    { icon: '🌪️', name: '회오리', desc: '주변 2칸(5×5) 안의 모든 적을 휩쓸기', dmg: { easy: 25, hard: 33 } },
    boomerang: { icon: '🪃', name: '부메랑', desc: `조준 방향으로 ${BOOMERANG_LEN - 0.5}칸 날아갔다 돌아오며, 가는 길·오는 길에 한 번씩 관통 타격 (자신은 안 맞음)`, aim: true, dmg: { easy: 17, hard: 23 } },
    grapple:  { icon: '🪝', name: '갈고리', desc: `조준 방향 ${GRAPPLE_LEN - 0.5}칸 안의 첫 적에게 피해를 주고 내 바로 앞 칸으로 끌어옴`, aim: true, dmg: { easy: 24, hard: 32 } },
    shockwave: { icon: '🌊', name: '충격파', desc: `조준 방향 ${WAVE_HALF * 2}° 부채꼴, ${Math.floor(WAVE_R)}칸 안의 모든 적에게 피해 + 1칸 밀쳐냄`, aim: true, dmg: { easy: 22, hard: 30 } },
    homing:   { icon: '💫', name: '유도탄', desc: `${HOMING_R}칸 안의 가장 가까운 적 두 명에게 한 발씩 (한 명뿐이면 두 발 모두). 벽을 무시하고 따라감`, dmg: { easy: 16, hard: 22 } },
    // 새 직업은 뒤에 붙인다 (저장된 번호가 바뀌지 않게)
    assassin: { icon: '🗡️', name: '암살', desc: `${ASSASSIN_R}칸 안의 가장 가까운 적 등 뒤로 순간이동해 급소 찌르기`, dmg: { easy: 27, hard: 36 } },
    poison:   { icon: '☠️', name: '독', desc: `조준 방향 ${POISON_LEN - 0.5}칸 안의 첫 적에게 독병: 바로 피해 + 그 적의 차례가 ${POISON_TICKS}번 시작될 때마다 ${POISON_DMG} 피해 (방패 무시 · 난전은 그 적이 행동할 때마다)`, aim: true, dmg: { easy: 12, hard: 16 } },
    archer:   { icon: '🏹', name: '궁수', desc: `조준 방향 ${ARROW_LEN}칸, 돌·상자를 넘어 처음 맞는 적. 멀리 있을수록 강함 (한 칸마다 +${Math.round(ARROW_BONUS * 100)}%)`, aim: true, dmg: { easy: 14, hard: 19 } },
    bomber:   { icon: '🧨', name: '폭탄', desc: `조준 방향으로 폭탄을 굴려 (벽·돌에 한 번 튕김, 최대 ${BOMB_LEN}칸) 적·상자에 닿거나 멈춘 곳에서 3×3 폭발 (가장자리 60%). 가까우면 자신도 맞음`, aim: true, dmg: { easy: 26, hard: 35 } },
  };
  const STYLE_KEYS = Object.keys(STYLES);
  const OFFER_N = 3;
  const MOVE_RANGE = { easy: 2, hard: 3, killer: 4 };
  const MORTAR_RANGE = 5;
  /** 저격은 턴 시작 때 바라보던 방향에서 ±SNIPER_TURN 까지만 조준할 수 있다 */
  const aimLimited = p => p && p.style === 'sniper' && p.aimBase != null;
  const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
  function clampAim(p, a) {
    a = normAng(a);
    if (!aimLimited(p)) return a;
    const d = Math.max(-SNIPER_TURN, Math.min(SNIPER_TURN, angDiff(a, p.aimBase)));
    return Math.round(normAng(p.aimBase + d) * 10) / 10;
  }
  const SCATTER_SHOTS = 3;   // 난사: 무작위 적 근처(±1칸) 무작위 좌표로 세 발
  function scatterTargets(p, r = rand) {
    const foes = enemies(p), out = [];
    for (let guard = 0; out.length < SCATTER_SHOTS && guard < 200; guard++) {
      const q = foes.length ? foes[r(foes.length)] : null;
      const t = q ? [q.x + r(3) - 1, q.y + r(3) - 1] : [r(N), r(N)];
      if (inB(t[0], t[1]) && !(t[0] === p.x && t[1] === p.y)) out.push(t);
    }
    return out;
  }

  /** 증강 후보: 게임 seed + 플레이어 번호로 정해져 새로고침해도 바뀌지 않는다 */
  function offersFor(p) {
    const r = mulberry32((S.gseed ^ Math.imul(p.id + 1, 2654435761)) | 0);
    const keys = STYLE_KEYS.slice();
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys.slice(0, OFFER_N);
  }

  function actionInfo(key, p) {
    if (key === 'attack') {
      const s = STYLES[p && p.style] || STYLES.sniper;
      return { icon: s.icon, name: `공격 · ${s.name}`, sub: s.desc, easy: `피해 ${s.dmg.easy}`, hard: `피해 ${s.dmg.hard}`, killer: `피해 ${styleDmg(s, 'killer')}`, fast: '피해 +10' };
    }
    if (key === 'move') {
      return { icon: '👣', name: '이동', sub: '원하는 칸으로 (킹처럼 가로·세로·대각선)', easy: `${MOVE_RANGE.easy}칸 이내`, hard: `${MOVE_RANGE.hard}칸 이내`, killer: `${MOVE_RANGE.killer}칸 이내`, fast: '이동 범위 +1칸' };
    }
    return { icon: '🎁', name: '랜덤박스', sub: '무작위 효과 획득', easy: '모든 효과 (꽝 포함)', hard: '꽝 없음', killer: '꽝 없음 + 효과 2개', fast: '꽝 없음' };
  }

  function maybeAugment() {
    const p = cur();
    if (!p || !p.alive || p.style || !myTurn() || S.phase !== 'choose' || S.augmentOpen || (brawl() && S.myBusy)) return;
    S.augmentOpen = true;
    Net.status('✨ 증강 고르는 중…');
    const offers = offersFor(p);
    const c = openModal(`
      <h2>✨ ${esc(p.name)}의 증강</h2>
      <p class="muted">이번 게임 동안 쓸 공격 스타일을 하나 고르세요. 무작위 ${OFFER_N}개 중 하나예요.</p>
      <div class="augments">
        ${offers.map((k, i) => {
          const s = STYLES[k];
          return `<button class="augment" data-s="${k}">
            <span class="aug-key">${i + 1}</span>
            <span class="aug-icon">${s.icon}</span>
            <b>${s.name}</b>
            <span class="aug-desc">${s.desc}</span>
            <em>피해 ${s.dmg.easy} · 심화 ${s.dmg.hard} · 킬러 ${styleDmg(s, 'killer')}</em>
          </button>`;
        }).join('')}
      </div>`, 'augment-card');
    c.querySelectorAll('[data-s]').forEach(b => {
      b.onclick = () => { sfx('pick'); closeModal(); Net.status(null); if (brawl()) S.myBusy = true; submit({ key: 'pick', style: b.dataset.s }); };
    });
    S.keyHandler = e => {
      const i = '123'.indexOf(e.key);
      const btns = c.querySelectorAll('[data-s]');
      if (i >= 0 && btns[i]) btns[i].click();
    };
  }

  // ------------------------------------------------------------------
  //  🤖 AI 플레이어 — 한 기기 모드는 이 화면이, 온라인은 방장 화면이 대신 두고
  //  사람과 똑같은 act 로 보낸다 (그래서 모든 화면에서 같은 결과가 재생된다)
  // ------------------------------------------------------------------
  const BOT_NAMES = ['AI 알파', 'AI 베타', 'AI 감마', 'AI 델타', 'AI 오메가'];
  const BOT_ACC = { easy: 0.85, hard: 0.65, killer: 0.45 };      // 난이도별 정답률
  const BOT_LEVEL = [['easy', 0.45], ['hard', 0.35], ['killer', 0.2]];
  const botAuthority = () => !S.online || S.online.host;
  const chance = r => Math.random() < r;
  const pickW = list => { let r = Math.random() * list.reduce((t, x) => t + x[1], 0); for (const x of list) { r -= x[1]; if (r < 0) return x[0]; } return list[0][0]; };

  /** 이 자리에서 지금 공격하면 얼마나 좋은가: {score, ang, tgt}. 맞는 적 1명 = 1, 자기가 맞으면 -1.5 */
  function botBestAttack(p) {
    const style = p.style;
    if (!style) return { score: 0 };
    const s = STYLES[style];
    const count = plan => {
      let v = 0;
      const seen = new Map();
      for (const r of plan.rays) for (const h of r.hits) seen.set(h.q, (seen.get(h.q) || 0) + (style === 'ricochet' ? 1 + RICO_BONUS * h.bounces : 1));
      for (const [x, y, w] of plan.cells) { const q = at(x, y, plan.blink ? p : undefined); if (q) seen.set(q, (seen.get(q) || 0) + w); }
      for (const [q, n] of seen) v += q === p ? -1.5 * n : Math.min(n, 2) * (q.hp <= 40 ? 1.3 : 1);
      return v;
    };
    if (style === 'knight') {
      let best = { score: 0 };
      for (const [x, y] of knightCells(p)) {
        const v = enemies(p).filter(q => Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) === 1).length;
        if (v > best.score) best = { score: v, tgt: [x, y] };
      }
      return best;
    }
    if (style === 'mortar') {
      let best = { score: 0 };
      for (const t of mortarCells(p)) {
        const v = count(planAttack(p, style, t));
        if (v > best.score) best = { score: v, tgt: t };
      }
      return best;
    }
    if (style === 'scatter') {
      // 운에 맡기는 한 방: 무작위 목표 몇 개로 기대 명중 수를 어림한다
      let sum = 0, n = 0;
      for (let i = 0; i < 8; i++) { sum += count(planAttack(p, style, scatterTargets(p, k => Math.floor(Math.random() * k)))); n++; }
      return { score: n ? sum / n : 0, ang: p.ang, gamble: true };
    }
    if (!s.aim) return { score: count(planAttack(p, style, null)), ang: p.ang };
    const a0 = p.ang;
    let best = { score: 0, ang: a0 };
    const range = aimLimited(p) ? [...Array(2 * SNIPER_TURN / 5 + 1).keys()].map(k => normAng(p.aimBase - SNIPER_TURN + 5 * k)) : [...Array(72).keys()].map(k => k * 5);
    for (const a of range) {
      p.ang = a;
      const v = count(planAttack(p, style, null));
      if (v > best.score) best = { score: v, ang: a };
    }
    p.ang = a0;
    return best;
  }

  /** AI 가 다음에 할 행동 (act) 을 정한다 */
  function botDecide(p) {
    if (!p.style) {
      const offers = offersFor(p);
      return { key: 'pick', style: offers[Math.floor(Math.random() * offers.length)] };
    }
    const level = pickW(BOT_LEVEL);
    const L = LEVELS[level];
    const ok = chance(BOT_ACC[level]);
    const sec = Math.round(L.time * (0.15 + Math.random() * 0.55) * 10) / 10;
    const fast = ok && sec <= L.time * FAST_RATIO;
    const cat = CAT_KEYS[Math.floor(Math.random() * CAT_KEYS.length)];
    const act = { cat, level, ok, topic: window.MathProblems.generate(cat, level).topic, to: 0, fast: fast ? 1 : 0,
      pts: ok ? L.pts + Math.round(100 * Math.max(0, 1 - sec / L.time)) : 0, sec, ang: p.ang };
    const canAttack = brawl() || !(prepRound() || S.extraActive);
    const atk = canAttack ? botBestAttack(p) : { score: 0 };
    const low = p.hp <= S.maxHp * 0.35;
    // 🧪 자기장 안(또는 곧 자기장)이면 대개 먼저 빠져나온다
    const zl = S.exp ? Math.max(zoneLevel(), zoneSoon()) : 0;
    const flee = zl > 0 && inZone(p.x, p.y, zl) && chance(0.8);
    if (!flee && (atk.score >= 1 || (atk.gamble && atk.score >= 0.35)) && !(low && atk.score < 1.5 && chance(0.3))) {
      act.key = 'attack';
      if (atk.ang != null) act.ang = atk.ang;
      if (atk.tgt) act.tgt = atk.tgt;
      return act;
    }
    if (low && chance(0.45)) { act.key = 'box'; return act; }
    // 이동: 옮겨 간 자리에서 공격하기 좋은 칸 (체력이 낮으면 적과 멀리, 아니면 가까이)
    const range = MOVE_RANGE[level] + (fast ? 1 : 0);
    const x0 = p.x, y0 = p.y;
    const dist = () => Math.min(...enemies(p).map(q => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y))), 99);
    let best = null;
    for (const [x, y] of moveCells(p, range)) {
      p.x = x; p.y = y;
      const v = botBestAttack(p).score * 2 + (low ? dist() * 0.15 : -dist() * 0.15)
        + ((S.coins || []).some(c => c[0] === x && c[1] === y) ? 0.3 : 0) + Math.random() * 0.2
        - (zl && inZone(x, y, zl) ? 4 : 0);
      if (!best || v > best.v) best = { v, dest: [x, y] };
    }
    p.x = x0; p.y = y0;
    if (!best || (!flee && chance(0.15))) { act.key = 'box'; return act; }
    act.key = 'move';
    act.dest = best.dest;
    return act;
  }

  /** 턴제: 지금 차례가 AI 면 조금 뒤에 한 수 둔다 (추가 행동이면 또) */
  function scheduleBot() {
    clearTimeout(S.botTimer);
    if (!botAuthority() || brawl()) return;
    const p = cur();
    if (!p || !p.bot || !p.alive || S.phase !== 'choose') return;
    const token = S.botToken = (S.botToken || 0) + 1;
    S.botTimer = setTimeout(() => botTurn(token), 900);
  }

  /** force: 사람 자리지만 자리를 비워서 AI 가 대신 두는 경우 */
  async function botTurn(token, force = false) {
    const p = cur();
    if (token !== S.botToken || !p || !(p.bot || force) || !p.alive || S.phase !== 'choose' || !botAuthority() || brawl()) return;
    if (S.applying) { S.botTimer = setTimeout(() => botTurn(token, force), 300); return; }
    S.botBusy = true;
    try { await botTurnInner(p, token); } finally { S.botBusy = false; }
  }
  async function botTurnInner(p, token) {
    const act = botDecide(p);
    if (act.key !== 'pick') {
      const info = actionInfo(act.key, p);
      S.botStatus = `${info.icon} ${info.name} · ${LEVELS[act.level].label} 문제 푸는 중…`;
      renderTurn();
      // 조준을 먼저 돌려서 무엇을 노리는지 보여 준다
      if (act.key === 'attack' && act.ang != null) { p.ang = act.ang; renderAll(); }
      await sleep(900 + Math.random() * 1400);
      if (token !== S.botToken || cur() !== p || S.phase !== 'choose') return;
      S.botStatus = '';
    }
    submit(act);
  }

  /** 난전: 방장 화면이 AI 들을 각자 시계대로 움직인다 */
  function startBrawlBots() {
    clearInterval(S.brawlBotTimer);
    if (!S.online || !S.online.host || !brawl()) return;
    S.botClock = {};
    S.brawlBotTimer = setInterval(() => {
      if (!S.online || !S.online.host || !brawl() || S.phase === 'over' || S.online.phase !== 'game') { clearInterval(S.brawlBotTimer); return; }
      const now = Date.now();
      S.players.forEach((p, seat) => {
        if (!p.bot || !p.alive) return;
        const c = S.botClock[seat] || (S.botClock[seat] = { at: now + 1500 + Math.random() * 2500 });
        if (now < c.at || c.waiting) return;
        const act = botDecide(p);
        // 푼 시간만큼 기다렸다가 내고, 오답이면 사람처럼 쉬는 시간
        c.at = now + (act.key === 'pick' ? 800 : Math.min(act.sec * 1000 * 0.5, 9000) + 1500 + (act.ok ? 0 : BRAWL_LOCK_MS));
        Net.botSubmit(act, seat);
      });
    }, 500);
  }

  // ---------------- 자유 조준 (무료) ----------------
  const vec = a => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)];
  const normAng = a => ((a % 360) + 360) % 360;
  const angTo = (p, x, y) => normAng(Math.atan2(x - p.x, -(y - p.y)) * 180 / Math.PI);

  function setAim(a) {
    if (!myTurn() || S.phase !== 'choose') return;
    cur().ang = Math.round(clampAim(cur(), a) * 10) / 10;
    S.localAim = cur().ang;
    Net.liveAim(cur().ang);
    renderAll();
  }

  function onCellClick(x, y) {
    if (S.pick) {
      if (S.pick.cells.has(x + ',' + y)) S.pick.done([x, y]);
      return;
    }
    const p = cur();
    if (!p || !myTurn() || S.phase !== 'choose' || (x === p.x && y === p.y)) return;
    setAim(angTo(p, x, y));
  }

  /** 판 위에서 칸을 하나 고르게 한다 (이동할 칸, 박격포 목표) */
  function pickCell(cells, title, text, color) {
    return new Promise(resolve => {
      const set = new Set(cells.map(c => c[0] + ',' + c[1]));
      el.cells.style.setProperty('--pick', color);
      el.cells.querySelectorAll('.cell').forEach(n => n.classList.toggle('pickable', set.has(n.dataset.x + ',' + n.dataset.y)));
      openModal(`<h2>${title}</h2><p class="muted">${text}</p>`, 'small', true);
      S.pick = {
        cells: set,
        done: c => {
          S.pick = null;
          el.cells.querySelectorAll('.pickable').forEach(n => n.classList.remove('pickable'));
          closeModal();
          resolve(c);
        },
      };
    });
  }

  function moveCells(p, range) {
    const out = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const x = p.x + dx, y = p.y + dy;
        if ((dx || dy) && open(x, y)) out.push([x, y]);
      }
    }
    return out;
  }
  const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  /** 나이트가 뛰어들 수 있는 칸: L자 칸 중 판 안의 빈 칸 */
  function knightCells(p) {
    return KNIGHT_JUMPS.map(([dx, dy]) => [p.x + dx, p.y + dy]).filter(([x, y]) => open(x, y));
  }
  function mortarCells(p) {
    const out = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (inB(x, y) && Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= MORTAR_RANGE) out.push([x, y]);
      }
    }
    return out;
  }

  // ---------------- 행동 선택 ----------------
  async function onAction(key) {
    if (!canAct()) return;
    const p = cur();
    if (key === 'augment') { maybeAugment(); return; }
    if (key === 'attack' && (prepRound() || S.extraActive)) return;

    if (brawl()) S.myBusy = true;
    const lv = await pickLevel(key);
    if (!lv) { S.myBusy = false; renderTurn(); return; }
    const { cat, level } = lv;
    if (!brawl()) S.phase = 'busy';
    renderAll();

    const info = actionInfo(key, p);
    Net.status(`${info.icon} ${info.name} · ${LEVELS[level].label} 문제 푸는 중…`);
    S.pendingKey = key;
    const q = await runQuiz(cat, level);
    const act = { key, cat, level, ok: q.ok, topic: q.topic, to: q.timeout ? 1 : 0, fast: q.fast ? 1 : 0, pts: q.pts, sec: q.sec, ang: p.ang };
    if (q.ok && key === 'move') {
      Net.status('👣 이동할 칸 고르는 중…');
      Net.live({ st: 'cell', key });
      act.dest = await pickCell(moveCells(p, MOVE_RANGE[level] + (q.fast ? 1 : 0)), '👣 이동', '표시된 칸 중 이동할 칸을 판에서 누르세요.', p.color);
    }
    if (q.ok && key === 'attack' && p.style === 'mortar') {
      Net.status('💣 폭격할 칸 고르는 중…');
      Net.live({ st: 'cell', key });
      act.tgt = await pickCell(mortarCells(p), '💣 박격포', '폭격할 칸을 판에서 누르세요. 3×3 범위 안에 자신이 있으면 같이 맞아요.', '#ff5d6c');
    }
    if (q.ok && key === 'attack' && p.style === 'knight' && knightCells(p).length) {
      Net.status('🐴 뛰어들 칸 고르는 중…');
      Net.live({ st: 'cell', key });
      act.tgt = await pickCell(knightCells(p), '🐴 나이트', '뛰어들 L자 칸을 판에서 누르세요. 착지한 곳 주변 8칸의 적을 모두 때려요.', p.color);
    }
    Net.status(null);
    Net.live(null);
    if (brawl() && !q.ok) {
      // 오답: 쉬는 시간 동안 1초마다 남은 시간을 다시 그린다
      S.lockUntil = Date.now() + BRAWL_LOCK_MS;
      clearInterval(S.lockTimer);
      S.lockTimer = setInterval(() => {
        renderTurn();
        if (Date.now() >= S.lockUntil) clearInterval(S.lockTimer);
      }, 1000);
    }
    submit(act);
  }

  /** 행동 확정: 한 기기 모드는 바로 실행, 온라인은 방장을 거쳐 모두에게 */
  function submit(act) {
    if (S.online) { Net.submit(act); return; }
    act.seed = newSeed();
    applyAct(act);
  }

  /** act 하나를 재생한다. 같은 상태 + 같은 act(seed) 면 모든 화면에서 결과가 같다. */
  async function applyAct(act) {
    S.applying = true;
    rng = mulberry32(act.seed | 0);
    try {
      if (act.key === 'restart') { S.zoneSeq0 = act.seq | 0; restartOnline(act.seed); return; }
      if (brawl()) { await applyBrawl(act); return; }
      const p = cur();
      if (act.key === 'pick') {
        const s = STYLES[act.style];
        if (s && !p.style) {
          p.style = act.style;
          log(`${tag(p)} ✨ 증강 선택: ${s.icon} ${s.name}`);
          if (S.online && !myTurn()) toast(`✨ ${p.emoji} ${p.name}: ${s.icon} ${s.name}`);
        }
        S.phase = 'choose';
        renderAll();
        return;
      }
      if (act.ang != null) p.ang = clampAim(p, act.ang);
      S.phase = 'busy';
      p.tries++;
      if (act.ok) { p.correct++; p.score += act.pts || 0; }
      log(`${tag(p)} ${esc(catInfo(act.cat).name)} ${LEVELS[act.level].label} 문제(${esc(act.topic || '')}) ${act.ok ? `✅ 정답 ${act.sec}초 · +${act.pts}점${act.fast ? ' ⚡빠른 정답' : ''}` : act.to ? '⏰ 시간 초과' : '❌ 오답'}`);
      if (act.ok && act.fast && S.online && !myTurn()) toast(`⚡ ${p.emoji} ${p.name} 빠른 정답!`);
      renderAll();
      if (!act.ok) {
        if (S.online && !myTurn()) toast(`❌ ${p.emoji} ${p.name} 오답`);
        await endTurn();
        return;
      }
      await perform(p, act);
      renderAll();
      if (checkWin()) return;
      if (!p.alive) { await endTurn(); return; }
      if (S.extra) {
        S.extra = false;
        S.extraActive = true;
        S.phase = 'choose';
        renderAll();
        toast('⏩ 추가 행동!');
        return;
      }
      await endTurn();
    } finally {
      rng = Math.random;
      S.applying = false;
      Net.afterApply();
      scheduleBot();
    }
  }

  /** 난전: 누구의 행동이든 도착한 순서대로 바로 실행 (차례 없음) */
  async function applyBrawl(act) {
    const p = S.players[act.actor];
    S.zoneSeq = act.seq | 0;   // 난전 자기장은 행동 번호로 (모든 화면이 같은 값)
    const mine = S.online && act.actor === S.online.mySeat;
    try {
      if (!p || !p.alive) return;
      if (act.key === 'pick') {
        const s = STYLES[act.style];
        if (s && !p.style) {
          p.style = act.style;
          log(`${tag(p)} ✨ 증강 선택: ${s.icon} ${s.name}`);
        }
        return;
      }
      if (act.ang != null) act.ang = clampAim(p, act.ang);
      if (act.ang != null && !mine) p.ang = act.ang;
      p.tries++;
      if (act.ok) { p.correct++; p.score += act.pts || 0; }
      log(`${tag(p)} ${esc(catInfo(act.cat).name)} ${LEVELS[act.level].label} 문제(${esc(act.topic || '')}) ${act.ok ? `✅ 정답 ${act.sec}초 · +${act.pts}점${act.fast ? ' ⚡빠른 정답' : ''}` : act.to ? '⏰ 시간 초과' : '❌ 오답'}`);
      if (!act.ok) return;
      if (mine) { const a0 = p.ang; p.ang = act.ang; await perform(p, act); if (p.ang === act.ang) p.ang = a0; }
      else await perform(p, act);
      if (act.ang != null) p.aimBase = act.ang;
      checkWin();
    } finally {
      if (act.key !== 'pick' && S.phase !== 'over' && p) {
        if (S.exp) zoneBrawlAfter(p);
        poisonTick(p);
        checkWin();
      }
      if (mine) S.myBusy = false;
      if (S.phase !== 'over') S.phase = 'choose';
      renderAll();
      maybeAugment();
    }
  }

  function pickLevel(key) {
    const p = cur();
    const a = actionInfo(key, p);
    let cat = S.lastCat[p.id] || 'calc';
    Net.live({ st: 'level', key });
    return new Promise(resolve => {
      const c = openModal(`
        <h2>${a.icon} ${a.name}</h2>
        <p class="muted">${a.sub}</p>
        <p class="step-label">① 과목 <span class="muted">(Q W E R)</span></p>
        <div class="cats">
          ${CAT_KEYS.map(k => `<button class="cat" data-c="${k}"><span class="cat-icon">${CAT_ICONS[k]}</span><b>${catInfo(k).name}</b><small>${catInfo(k).sub}</small></button>`).join('')}
        </div>
        <p class="step-label">② 난이도 <span class="muted">(1 2 3)</span></p>
        <div class="levels">
          ${LEVEL_KEYS.map(l => `
            <button class="level ${l}" data-l="${l}">
              <b>${LEVELS[l].label}</b><span>${LEVELS[l].desc}</span><em>${a[l]}</em>
              <small>정답 ${LEVELS[l].pts}점 + 속도 보너스 최대 100점</small>
              <small>⚡ ${Math.round(LEVELS[l].time * FAST_RATIO)}초 안에 맞히면 ${a.fast}</small>
              ${S.timer ? `<small>⏱ 제한 ${LEVELS[l].time}초</small>` : ''}
            </button>`).join('')}
        </div>
        <button class="ghost wide" data-l="">취소</button>`, 'small level-card');
      const mark = () => c.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('sel', b.dataset.c === cat));
      mark();
      c.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { cat = b.dataset.c; mark(); }; });
      c.querySelectorAll('[data-l]').forEach(b => {
        b.onclick = () => {
          closeModal();
          if (!b.dataset.l) { Net.live(null); resolve(null); return; }
          S.lastCat[p.id] = cat;
          resolve({ cat, level: b.dataset.l });
        };
      });
      S.keyHandler = e => {
        const ci = 'qwer'.indexOf(e.key.toLowerCase());
        if (ci >= 0) { cat = CAT_KEYS[ci]; mark(); }
        if (e.key === '1') c.querySelector('[data-l="easy"]').click();
        if (e.key === '2') c.querySelector('[data-l="hard"]').click();
        if (e.key === '3') c.querySelector('[data-l="killer"]').click();
        if (e.key === 'Escape') c.querySelector('[data-l=""]').click();
      };
    });
  }

  function runQuiz(cat, level) {
    const P = window.MathProblems.generate(cat, level);
    const L = LEVELS[level];
    const p = cur();
    return new Promise(resolve => {
      const c = openModal(`
        <div class="quiz-head">
          <span class="chip cat-chip">${CAT_ICONS[cat]} ${esc(catInfo(cat).name)}</span>
          <span class="chip ${level}">${L.label}</span>
          <span class="topic">${esc(P.topic)}</span>
          <span class="who" style="--pc:${p.color}">${p.emoji} ${esc(p.name)}</span>
        </div>
        ${S.timer ? '<div class="timer"><div class="timer-fill"></div><span class="timer-num"></span></div>' : ''}
        <div class="question">${tex(P.q)}</div>
        <div class="choices">
          ${P.choices.map((ch, i) => `<button class="choice" data-i="${i}"><span class="key">${i + 1}</span><span class="ctext">${tex(ch)}</span></button>`).join('')}
        </div>
        <div class="feedback hidden"></div>`, 'quiz');

      const buttons = [...c.querySelectorAll('.choice')];
      let done = false, timerId = null;
      const t0 = Date.now(), limit = L.time * 1000;
      // 관전용: 다른 사람 화면에 이 문제를 그대로 보여 준다
      const liveQ = { key: S.pendingKey, cat, level, topic: P.topic, q: P.q, ch: P.choices, lim: S.timer ? L.time : 0 };
      Net.live({ st: 'quiz', ...liveQ });

      const finish = i => {
        if (done) return;
        done = true;
        clearInterval(timerId);
        const ok = i === P.answer;
        const elapsed = Math.min(limit, Date.now() - t0);
        const sec = Math.round(elapsed / 100) / 10;
        const speed = ok ? Math.round(100 * Math.max(0, 1 - elapsed / limit)) : 0;
        const pts = ok ? L.pts + speed : 0;
        const fast = ok && elapsed <= limit * FAST_RATIO;
        sfx(ok ? 'correct' : i === -1 ? 'timeout' : 'wrong');
        if (fast) setTimeout(() => sfx('fast'), 250);
        Net.live({ st: 'result', ...liveQ, pk: i, ans: P.answer, ok, sec, ex: P.explain });
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (j === P.answer) b.classList.add('correct');
          else if (j === i) b.classList.add('wrong');
        });
        const fb = c.querySelector('.feedback');
        fb.innerHTML = `
          <div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '정답! 🎉' : i === -1 ? '⏰ 시간 초과!' : '오답 😢'}</div>
          ${ok ? `<div class="bonus">⏱ ${sec}초 · <b>+${pts}점</b> <span class="muted">(${L.label} ${L.pts} + 속도 ${speed})</span>
            ${fast ? `<div class="fast">⚡ 빠른 정답! 이번 행동 강화: ${actionInfo(S.pendingKey, p).fast}</div>` : ''}</div>` : ''}
          <div class="explain">💡 ${tex(P.explain)}</div>
          <button class="primary big" id="qNext">${ok ? '행동 실행 ▶' : '턴 종료 ▶'}</button>`;
        fb.classList.remove('hidden');
        const next = fb.querySelector('#qNext');
        next.focus();
        S.keyHandler = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next.click(); } };
        next.onclick = () => { closeModal(); resolve({ ok, topic: P.topic, timeout: i === -1, fast, pts, sec }); };
      };

      buttons.forEach((b, i) => { b.onclick = () => finish(i); });
      S.keyHandler = e => {
        const i = '1234'.indexOf(e.key);
        if (i >= 0) finish(i);
      };

      if (S.timer) {
        const fill = c.querySelector('.timer-fill');
        const numEl = c.querySelector('.timer-num');
        const tick = () => {
          const left = Math.max(0, limit - (Date.now() - t0));
          fill.style.transform = `scaleX(${left / limit})`;
          numEl.textContent = Math.ceil(left / 1000) + 's';
          if (left <= 10000) fill.classList.add('warn');
          // 마지막 5초는 1초마다 '틱'
          const secLeft = Math.ceil(left / 1000);
          if (secLeft <= 5 && secLeft > 0 && secLeft !== c._lastTick) { c._lastTick = secLeft; sfx('tick'); }
          if (left <= 0) finish(-1);
        };
        tick();
        timerId = setInterval(tick, 100);
      }
    });
  }

  async function perform(p, act) {
    renderGuide();
    const fast = !!act.fast;
    if (act.key === 'attack' && (prepRound() || S.extraActive)) log(`${tag(p)} 지금은 공격할 수 없어요`);
    else if (act.key === 'attack') await doAttack(p, act.level, fast, act.tgt);
    else if (act.key === 'move') await doMove(p, act.dest, MOVE_RANGE[act.level] + (fast ? 1 : 0));
    else if (act.key === 'box') await doBox(p, act.level, fast);
    await sleep(400);
  }

  // ------------------------------------------------------------------
  //  피해 처리
  // ------------------------------------------------------------------
  function heal(p, amt) {
    const before = p.hp;
    p.hp = Math.min(S.maxHp, p.hp + amt);
    if (p.hp > before) { floatText(p, `+${p.hp - before}`, 'heal'); sfx('heal'); }
    renderPlayers(); renderPieces();
    return p.hp - before;
  }

  /** 피해를 주고 실제로 깎인 양을 돌려준다 */
  function damage(t, amt, src, why) {
    if (!t.alive) return 0;
    if (t.shield) {
      t.shield = false;
      floatText(t, '🛡️ 방어!', 'info');
      sfx('block');
      log(`${tag(t)} 🛡️ 방패로 ${why}을(를) 막았다!`);
      renderPlayers(); renderPieces();
      return 0;
    }
    const before = t.hp;
    t.hp = Math.max(0, t.hp - amt);
    if (src && src !== t) src.dealt = (src.dealt || 0) + (before - t.hp);
    floatText(t, `-${amt}`, 'dmg');
    hitFx(t);
    if (window.Sfx) Sfx.hurt(t.id, S.hitKind, t.style);
    const self = src === t;
    log(`${self ? '🤕' : '💢'} ${tag(t)} ${why}으로 ${amt} 피해${self ? ' (자폭!)' : ''} → HP ${t.hp}`);
    if (t.hp <= 0) {
      t.alive = false;
      log(`💀 ${tag(t)} 탈락!`);
      sfx('death');
      toast(`💀 ${t.emoji} ${t.name} 탈락!`, 2200);
    }
    renderPlayers(); renderPieces();
    return before - t.hp;
  }

  // ------------------------------------------------------------------
  //  공격: 광선(연속 각도) + 칸 타격
  // ------------------------------------------------------------------
  const HIT_R = 0.42;
  /** (ox, oy) 에서 각도 a 로 쏜 탄의 경로와 적중. 벽 반사, 관통, 사거리 지원 */
  function traceRay(p, ox, oy, a, { maxLen = Infinity, bounces = 0, pierce = false, multi = false, noSelf = false, ghost = false } = {}) {
    const EPS = 1e-9;
    let pos = [ox, oy];
    let v = vec(a);
    const pts = [pos];
    const hits = [], crates = [];
    let travelled = 0, left = maxLen;
    for (let seg = 0; seg <= bounces; seg++) {
      // 가장 가까운 벽 (판의 다각형 변)
      let t = left, walls = [];
      const poly = BOARD.poly;
      for (let w = 0; w < poly.length; w++) {
        const e0 = poly[w], e1 = poly[(w + 1) % poly.length];
        const ex = e1[0] - e0[0], ey = e1[1] - e0[1];
        const den = v[0] * ey - v[1] * ex;
        if (Math.abs(den) < EPS) continue;
        const wx = e0[0] - pos[0], wy = e0[1] - pos[1];
        const tt = (wx * ey - wy * ex) / den;      // 탄이 가는 거리
        const u = (wx * v[1] - wy * v[0]) / den;   // 변 위의 위치 (0~1)
        if (tt <= 1e-7 || u < -1e-9 || u > 1 + 1e-9) continue;
        if (tt < t - 1e-7) { t = tt; walls = [w]; } else if (Math.abs(tt - t) <= 1e-7) walls.push(w);
      }
      // 🧪 장애물: 돌은 벽처럼 막고(튕기는 탄은 튕김), 상자는 탄을 멈추고 부서진다 (관통탄은 부수며 지나감)
      let rock = null, crate = null;
      const passed = [];
      if (S.exp && S.obst.size && !ghost) {
        for (const [key, o] of S.obst) {
          const r = boxHit(pos, v, o.x, o.y);
          if (!r || r.t >= t - 1e-7) continue;
          if (o.kind === 'rock') { if (!rock || r.t < rock.t) rock = { ...r, key }; }
          else if (pierce) passed.push({ key, t: r.t });
          else if (!crate || r.t < crate.t) crate = { ...r, key };
        }
      }
      const block = [rock, crate].filter(Boolean).sort((m, n) => m.t - n.t)[0];
      if (block) { t = block.t; walls = []; }
      for (const c of passed) if (c.t < t && !crates.some(k => k.key === c.key)) crates.push({ key: c.key, d: travelled + c.t, at: [pos[0] + v[0] * c.t, pos[1] + v[1] * c.t] });
      const found = [];
      for (const q of S.players) {
        // multi: 벽에 튕긴 뒤 같은 적을 또 맞힐 수 있다 (한 구간에서는 한 번) · noSelf: 쏜 사람은 안 맞는다
        if (!q.alive || ((seg === 0 || noSelf) && q === p) || (!multi && hits.some(h => h.q === q))) continue;
        const cx = q.x + 0.5 - pos[0], cy = q.y + 0.5 - pos[1];
        const s = cx * v[0] + cy * v[1];
        if (s < 0.05 || s > t) continue;
        if (Math.hypot(cx - v[0] * s, cy - v[1] * s) < HIT_R) found.push({ q, s });
      }
      found.sort((m, n) => m.s - n.s);
      for (const f of found) {
        const hitAt = [pos[0] + v[0] * f.s, pos[1] + v[1] * f.s];
        hits.push({ q: f.q, d: travelled + f.s, bounces: seg, at: hitAt });
        if (!pierce) { pts.push(hitAt); return { pts, hits, crates }; }
      }
      pos = [pos[0] + v[0] * t, pos[1] + v[1] * t];
      pts.push(pos);
      travelled += t;
      left -= t;
      // 상자에 막힘: 상자가 맞고 탄은 멈춘다
      if (block && block === crate) { crates.push({ key: crate.key, d: travelled, at: pos }); break; }
      if (left <= 1e-9 || seg === bounces) break;
      if (block) {   // 돌에 튕김
        const [nx, ny] = block.n, d = v[0] * nx + v[1] * ny;
        v = [v[0] - 2 * d * nx, v[1] - 2 * d * ny];
        continue;
      }
      // 벽의 법선에 대해 반사 (모서리면 두 벽 모두)
      for (const w of walls) {
        const e0 = poly[w], e1 = poly[(w + 1) % poly.length];
        const len = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
        const nx = -(e1[1] - e0[1]) / len, ny = (e1[0] - e0[0]) / len;
        const d = v[0] * nx + v[1] * ny;
        v = [v[0] - 2 * d * nx, v[1] - 2 * d * ny];
      }
    }
    return { pts, hits, crates };
  }
  /** 칸 (x, y) 의 장애물 상자(조금 안쪽)와 광선의 교차: 들어가는 거리 t 와 부딪힌 면의 법선 n */
  const OB_PAD = 0.1;
  function boxHit(pos, v, x, y) {
    let tmin = -Infinity, tmax = Infinity, n = [0, 0];
    const lo = [x + OB_PAD, y + OB_PAD], hi = [x + 1 - OB_PAD, y + 1 - OB_PAD];
    for (let k = 0; k < 2; k++) {
      if (Math.abs(v[k]) < 1e-12) { if (pos[k] < lo[k] || pos[k] > hi[k]) return null; continue; }
      let t1 = (lo[k] - pos[k]) / v[k], t2 = (hi[k] - pos[k]) / v[k];
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) { tmin = t1; n = k === 0 ? [v[0] > 0 ? -1 : 1, 0] : [0, v[1] > 0 ? -1 : 1]; }
      tmax = Math.min(tmax, t2);
    }
    if (tmax < tmin || tmin <= 1e-7) return null;
    return { t: tmin, n };
  }

  /** 공격 계획. 조준 안내선과 실제 공격이 같은 계산을 쓴다. */
  function planAttack(p, style, target) {
    const ox = p.x + 0.5, oy = p.y + 0.5;
    const rays = [], cells = [];
    let blink = null;   // 킹 돌진·암살 순간이동: 공격 전에 옮겨 갈 칸
    const ray = (a, o) => rays.push(traceRay(p, ox, oy, a, o));
    const ring = (cx, cy, w = 1) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inB(cx + dx, cy + dy)) cells.push([cx + dx, cy + dy, dx || dy ? w : 1]);
      }
    };
    switch (style) {
      case 'sniper': ray(p.ang, { bounces: SNIPER_BOUNCES, pierce: true, multi: true, noSelf: true }); break;
      case 'shotgun': [-20, 0, 20].forEach(d => ray(p.ang + d, { maxLen: 3.5 })); break;
      case 'ricochet': ray(p.ang, { bounces: RICO_BOUNCES }); break;   // 관통 없음, 튕긴 뒤엔 자신도 맞을 수 있음
      case 'boomerang': {
        const out = traceRay(p, ox, oy, p.ang, { maxLen: BOOMERANG_LEN, pierce: true });
        const end = out.pts[out.pts.length - 1], len = Math.hypot(end[0] - ox, end[1] - oy);
        const back = traceRay(p, end[0], end[1], p.ang + 180, { maxLen: len, pierce: true, noSelf: true });
        back.delay = Math.max(350, (len / 12) * 1000);   // 다 날아간 뒤에 돌아온다
        rays.push(out, back);
        break;
      }
      case 'grapple': ray(p.ang, { maxLen: GRAPPLE_LEN }); break;
      case 'shockwave':
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (!inB(x, y) || (x === p.x && y === p.y)) continue;
          if (Math.hypot(x - p.x, y - p.y) <= WAVE_R && Math.abs(angDiff(angTo(p, x, y), p.ang)) <= WAVE_HALF) cells.push([x, y, 1]);
        }
        break;
      case 'homing': {
        const foes = enemies(p).map(q => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) })).filter(o => o.d <= HOMING_R)
          .sort((a, b) => a.d - b.d || a.q.id - b.q.id);
        const picks = foes.length ? [foes[0], foes[1] || foes[0]] : [];
        picks.forEach((o, i) => {
          const at = [o.q.x + 0.5, o.q.y + 0.5];
          rays.push({ pts: [[ox, oy], at], hits: [{ q: o.q, d: o.d, bounces: 0, at }], delay: i * 180 });
        });
        break;
      }
      case 'bishop': [45, 135, 225, 315].forEach(a => ray(a)); break;
      case 'rook': [0, 90, 180, 270].forEach(a => ray(a)); break;
      case 'knight': {
        // 착지한 칸(없으면 제자리) 주변 8칸
        const [cx, cy] = target || [p.x, p.y];
        ring(cx, cy);
        for (let i = cells.length - 1; i >= 0; i--) if (cells[i][0] === cx && cells[i][1] === cy) cells.splice(i, 1);
        break;
      }
      case 'king': {
        // 체크메이트: 가장 가까운 적의 주변 8칸 중 막힌 칸 수만큼 강해진다
        const foe = enemies(p).map(q => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) })).filter(o => o.d <= KING_R + 0.5)
          .sort((m, n) => m.d - n.d || m.q.id - n.q.id)[0];
        if (!foe) break;
        const t = foe.q, locked = checkCells(t), at2 = [t.x + 0.5, t.y + 0.5];
        rays.push({ pts: [[ox, oy], at2], hits: [{ q: t, d: foe.d, bounces: 0, at: at2, blocked: locked.length }], locked });
        break;
      }
      case 'assassin': {
        const foe = enemies(p).map(q => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) })).filter(o => o.d <= ASSASSIN_R + 0.5)
          .sort((m, n) => m.d - n.d || m.q.id - n.q.id)[0];
        if (!foe) break;
        const t = foe.q, ideal = [t.x + Math.sign(t.x - p.x), t.y + Math.sign(t.y - p.y)];
        // 등 뒤(나와 반대쪽) 칸이 막혔으면 그 적 주변에서 가장 가까운 빈 칸
        const land = DIRS.map(([dx, dy]) => [t.x + dx, t.y + dy]).filter(([x, y]) => open(x, y) || (x === p.x && y === p.y))
          .sort((m, n) => Math.hypot(m[0] - ideal[0], m[1] - ideal[1]) - Math.hypot(n[0] - ideal[0], n[1] - ideal[1]) || m[1] - n[1] || m[0] - n[0])[0];
        if (!land) break;
        if (land[0] !== p.x || land[1] !== p.y) blink = land;
        const at2 = [t.x + 0.5, t.y + 0.5];
        rays.push({ pts: [[land[0] + 0.5, land[1] + 0.5], at2], hits: [{ q: t, d: 0.6, bounces: 0, at: at2 }] });
        break;
      }
      case 'poison': ray(p.ang, { maxLen: POISON_LEN }); break;
      case 'archer': ray(p.ang, { maxLen: ARROW_LEN, ghost: true }); break;
      case 'bomber': {
        // 굴러가다 적·상자에 닿거나, 한 번 튕긴 뒤 멈춘 곳에서 폭발 (굴러가는 탄 자체는 피해 없음)
        const r = traceRay(p, ox, oy, p.ang, { maxLen: BOMB_LEN, bounces: 1, noSelf: true });
        const end = r.pts[r.pts.length - 1], prev = r.pts[r.pts.length - 2] || [ox, oy];
        const L = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
        const bx = Math.min(N - 1, Math.floor(end[0] - (end[0] - prev[0]) / L * 0.05));
        const by = Math.min(N - 1, Math.floor(end[1] - (end[1] - prev[1]) / L * 0.05));
        rays.push({ pts: r.pts, hits: [], crates: [], bomb: [bx, by] });
        if (inB(bx, by)) ring(bx, by, 0.6);
        break;
      }
      case 'mortar': if (target) ring(target[0], target[1], 0.6); break;
      case 'queen': [0, 45, 90, 135, 180, 225, 270, 315].forEach(a => ray(a)); break;
      case 'laser': ray(p.ang, { pierce: true }); break;
      case 'spear': ray(p.ang, { maxLen: 2.5, pierce: true }); break;
      case 'vampire': ray(p.ang); break;
      case 'whirl':
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if ((dx || dy) && inB(p.x + dx, p.y + dy)) cells.push([p.x + dx, p.y + dy, 1]);
        }
        break;
      case 'chain': {
        // 가까운 적부터 차례로 튕긴다 (같은 거리는 번호 순 → 모든 화면에서 같은 결과)
        const hits = [], pts = [[ox, oy]];
        let from = p, reach = 4, travelled = 0;
        for (let k = 0; k < 3; k++) {
          const next = S.players
            .filter(q => q.alive && q !== p && !hits.some(h => h.q === q))
            .map(q => ({ q, d: Math.hypot(q.x - from.x, q.y - from.y) }))
            .filter(o => o.d <= reach + 1e-9)
            .sort((m, n) => m.d - n.d || m.q.id - n.q.id)[0];
          if (!next) break;
          travelled += next.d;
          const at2 = [next.q.x + 0.5, next.q.y + 0.5];
          pts.push(at2);
          hits.push({ q: next.q, d: travelled, bounces: 0, at: at2 });
          from = next.q; reach = 3;
        }
        if (hits.length) rays.push({ pts, hits });
        break;
      }
      case 'scatter': // 목표 하나 [x, y] 또는 여러 개 [[x, y], …]
        if (target) (Array.isArray(target[0]) ? target : [target]).forEach(t => ray(angTo(p, t[0], t[1]), { bounces: 3, pierce: true }));
        break;
    }
    return { rays, cells, blink };
  }
  /** 체크메이트: q 주변 8칸 중 막힌 칸 (판 끝·다른 말·돌·상자·자기장) */
  function checkCells(q) {
    const lvl = zoneLevel();
    return DIRS.map(([dx, dy]) => [q.x + dx, q.y + dy])
      .filter(([x, y]) => !inB(x, y) || at(x, y, q) || obAt(x, y) || inZone(x, y, lvl));
  }

  function renderGuide() {
    clearFx('.guide, .guide-end, .guide-cell, .guide-hit, .guide-times');
    if (el.pieces) el.pieces.querySelectorAll('.guide-label').forEach(n => n.remove());
    const p = cur();
    const on = p && p.alive && S.phase === 'choose';
    el.cells.classList.toggle('aimable', !!on && myTurn());
    if (!on || !p.style) return;
    if (p.style === 'knight') {
      // 뛰어들 수 있는 L자 칸과, 그중 어디로든 뛰어들면 때릴 수 있는 적
      const marked = new Set();
      for (const [x, y] of knightCells(p)) {
        svg('rect', { class: 'guide-cell', x: x + 0.1, y: y + 0.1, width: 0.8, height: 0.8, stroke: p.color });
        for (const q of enemies(p)) if (Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) === 1) marked.add(q);
      }
      for (const q of marked) svg('circle', { class: 'guide-hit', cx: q.x + 0.5, cy: q.y + 0.5, r: 0.46 });
      return;
    }
    const plan = planAttack(p, p.style, null);
    const marked = new Set();
    // 킹 돌진·암살 순간이동: 옮겨 갈 칸
    if (plan.blink) {
      const [bx, by] = plan.blink;
      svg('line', { class: 'guide', x1: p.x + 0.5, y1: p.y + 0.5, x2: bx + 0.5, y2: by + 0.5, stroke: p.color });
      svg('rect', { class: 'guide-cell blink', x: bx + 0.12, y: by + 0.12, width: 0.76, height: 0.76, stroke: p.color });
    }
    for (const r of plan.rays) {
      for (const [x, y] of r.locked || []) if (inB(x, y)) svg('rect', { class: 'guide-cell lock', x: x + 0.15, y: y + 0.15, width: 0.7, height: 0.7, stroke: '#ffcb3d' });
      svg('polyline', { class: 'guide', points: r.pts.map(q => q.join(',')).join(' '), stroke: p.color });
      const e = r.pts[r.pts.length - 1];
      svg('circle', { class: 'guide-end', cx: e[0], cy: e[1], r: 0.09, fill: p.color });
      r.hits.forEach(h => marked.add(h.q));
      for (const c of r.crates || []) { const o = S.obst.get(c.key); if (o) svg('rect', { class: 'guide-cell crate-hit', x: o.x + 0.06, y: o.y + 0.06, width: 0.88, height: 0.88, stroke: p.color }); }
    }
    for (const [x, y] of plan.cells) {
      svg('rect', { class: 'guide-cell', x: x + 0.1, y: y + 0.1, width: 0.8, height: 0.8, stroke: p.color });
      const q = p.style === 'bomber' ? at(x, y) : at(x, y, p);
      if (q) marked.add(q);
    }
    // 이대로 쏘면 맞는 적 표시 (여러 번 맞으면 ×n)
    const times = new Map(), bonus = new Map();
    for (const r of plan.rays) for (const h of r.hits) {
      times.set(h.q, (times.get(h.q) || 0) + 1);
      if (p.style === 'ricochet' && h.bounces) bonus.set(h.q, Math.round(RICO_BONUS * 100 * h.bounces));
      if (p.style === 'king' && h.blocked) bonus.set(h.q, Math.round(CHECK_BONUS * 100 * h.blocked));
    }
    for (const q of marked) {
      svg('circle', { class: 'guide-hit', cx: q.x + 0.5, cy: q.y + 0.5, r: 0.46 });
      const label = bonus.has(q) ? `+${bonus.get(q)}%` : (times.get(q) || 0) > 1 ? `×${times.get(q)}` : '';
      if (label) {
        // 판 위 SVG 글자는 작아서 흐리게 그려지므로, 말 위에 HTML 글씨로 띄운다
        const stand = el.pieces.querySelector(`[data-id="${q.id}"] .stand`);
        if (stand) { const t = document.createElement('div'); t.className = 'guide-label'; t.textContent = label; stand.appendChild(t); }
      }
    }
    // 저격: 이번 턴에 돌릴 수 있는 조준 범위
    if (aimLimited(p) && myTurn()) {
      for (const d of [-SNIPER_TURN, SNIPER_TURN]) {
        const [vx, vy] = vec(p.aimBase + d);
        svg('line', { class: 'guide faint limit', x1: p.x + 0.5, y1: p.y + 0.5, x2: p.x + 0.5 + vx * 2.2, y2: p.y + 0.5 + vy * 2.2, stroke: p.color });
      }
    }
    // 위치형 스타일도 바라보는 방향(카메라)은 보이게
    if (!plan.rays.length && !plan.cells.length || !STYLES[p.style].aim) {
      const [vx, vy] = vec(p.ang);
      svg('line', { class: 'guide faint', x1: p.x + 0.5, y1: p.y + 0.5, x2: p.x + 0.5 + vx * 1.2, y2: p.y + 0.5 + vy * 1.2, stroke: p.color });
    }
  }

  /** 킹 돌진 · 암살 순간이동 */
  async function dashTo(p, [x, y], style) {
    if (style === 'assassin') {
      impactFx(p.x + 0.5, p.y + 0.5, 'smoke', '#9aa0ad');
      sfx('blink');
      await sleep(180);
      p.x = x; p.y = y;
      renderPieces();
      impactFx(x + 0.5, y + 0.5, 'smoke', '#9aa0ad');
      await sleep(220);
    } else {
      sfx('jump');
      await animatePath([[p.x + 0.5, p.y + 0.5], [x + 0.5, y + 0.5]], p.color, 16, [], { head: 'none', trail: 'dash', speed: 14 });
      p.x = x; p.y = y;
      renderPieces();
      sfx('land');
    }
    updateCamera();
    log(`${tag(p)} ${style === 'assassin' ? '🗡️ 순간이동' : '👑 돌진'} → ${coord(x, y)}`);
  }
  /** 방패로 못 막는 피해 (자기장·독) */
  function trueDamage(q, amt, why, kind) {
    if (!q.alive) return;
    const was = S.hitKind, shield = q.shield;
    S.hitKind = kind;
    q.shield = false;
    damage(q, amt, null, why);
    if (q.alive) q.shield = shield;
    S.hitKind = was;
  }
  /** ☠️ 독: 중독된 말의 차례가 시작될 때(난전: 행동할 때) 한 번씩 */
  function poisonTick(q) {
    if (!q || !q.alive || !(q.poison > 0)) return;
    q.poison--;
    trueDamage(q, POISON_DMG, '☠️독', 'poison');
  }

  /** 🧪 상자 맞음: 두 번 맞으면 부서지고, 부순 사람은 🛡️ 방패 */
  function hitCrate(key, p, kind = 'thud') {
    const o = S.obst.get(key);
    if (!o || o.kind !== 'crate' || o.hp <= 0) return;
    o.hp--;
    impactFx(o.x + 0.5, o.y + 0.5, kind === 'boom' ? 'boom' : 'thud', '#e8c48a');
    if (window.Sfx) Sfx.play('crate');
    if (o.hp <= 0) {
      S.obst.delete(key);
      burst(o.x + 0.5, o.y + 0.5, '#e8c48a');
      if (p && p.alive) {
        p.shield = true;
        floatText(p, '🛡️', 'heal');
        log(`${tag(p)} 📦 ${coord(o.x, o.y)} 상자를 부쉈다 → 🛡️ 방패!`);
      }
    }
    renderObstacles();
  }

  /** 말을 (x, y) 로 옮긴다 (판 안의 빈 칸일 때만) */
  function shove(q, x, y, why) {
    if ((x === q.x && y === q.y) || !open(x, y)) return false;
    burst(q.x + 0.5, q.y + 0.5, '#9be7ff');
    q.x = x; q.y = y;
    renderPieces();
    burst(x + 0.5, y + 0.5, '#9be7ff');
    log(`${tag(q)} ${coord(x, y)} 로 ${why}`);
    return true;
  }

  async function doAttack(p, level, fast, target) {
    const s = STYLES[p.style] || STYLES.sniper;
    const dmg = styleDmg(s, level) + (fast ? FAST_DMG : 0);
    // 강화탄: 이번 공격의 첫 타격에만 배율
    let boost = 1;
    if (p.power) {
      boost = POWER_MULT;
      p.power = false;
      log(`${tag(p)} 💥 강화탄 발동! 첫 타격 피해 ${POWER_MULT}배`);
    }
    const hitDmg = (mult = 1) => { const v = Math.round(dmg * mult * boost); if (boost > 1) shakeBoard(2); boost = 1; return v; };
    let tgt = target;
    let tgts = tgt ? [tgt] : [];
    if (p.style === 'scatter') {
      tgts = scatterTargets(p);
      tgt = tgts[0];
    }
    let cross = null;
    if (tgt) {
      cross = svg('g', {});
      for (const t of tgts) {
        svg('circle', { class: 'crosshair', cx: t[0] + 0.5, cy: t[1] + 0.5, r: 0.35 }, cross);
        svg('line', { class: 'crosshair', x1: t[0] + 0.1, y1: t[1] + 0.5, x2: t[0] + 0.9, y2: t[1] + 0.5 }, cross);
        svg('line', { class: 'crosshair', x1: t[0] + 0.5, y1: t[1] + 0.1, x2: t[0] + 0.5, y2: t[1] + 0.9 }, cross);
      }
      toast(p.style === 'scatter' ? `${s.icon} ${s.name} ×${SCATTER_SHOTS}!` : `${s.icon} ${s.name} → ${coord(tgt[0], tgt[1])}`);
      await sleep(p.style === 'scatter' ? 900 : 400);
    } else {
      toast(`${s.icon} ${s.name}!`);
    }
    if (window.Sfx && p.style !== 'knight') Sfx.attack(p.style, p.id);
    faceFlip(el.pieces.querySelector(`[data-id="${p.id}"]`) || document.createElement('i'), p);
    charPlay(p, 'attack');
    if (p.style === 'knight') {
      // 공격 시점에 다시 확인 (난전에서는 그사이 누가 그 칸에 들어왔을 수 있다) → 안 되면 제자리에서 내려찍기
      const ok = tgt && KNIGHT_JUMPS.some(([dx, dy]) => p.x + dx === tgt[0] && p.y + dy === tgt[1]) && open(tgt[0], tgt[1]);
      if (ok) {
        sfx('jump');
        await animatePath([[p.x + 0.5, p.y + 0.5], [(p.x + tgt[0]) / 2 + 0.5, (p.y + tgt[1]) / 2 + 0.5], [tgt[0] + 0.5, tgt[1] + 0.5]], p.color, 14, [], LOOKS.knight);
        sfx('land');
        burst(p.x + 0.5, p.y + 0.5, p.color);
        [p.x, p.y] = tgt;
        renderPieces();
        updateCamera();
        log(`${tag(p)} 🐴 ${coord(p.x, p.y)} 로 뛰어들었다`);
        await sleep(300);
      }
      tgt = null;
      if (cross) { cross.remove(); cross = null; }
    }
    // 킹 돌진 · 암살 순간이동: 먼저 옮겨 간 뒤 공격 (암살은 옮기기 전에 정한 목표 그대로)
    let pre = null;
    if (p.style === 'assassin') {
      pre = planAttack(p, p.style, null);
      if (pre.blink) await dashTo(p, pre.blink, p.style);
    }
    const plan = p.style === 'assassin' ? pre
      : planAttack(p, p.style, p.style === 'knight' ? [p.x, p.y] : p.style === 'scatter' ? tgts : tgt);
    // 체크메이트: 적을 가두고 있는 칸을 잠깐 보여 준다
    for (const r of plan.rays) for (const [x, y] of r.locked || []) if (inB(x, y)) impactFx(x + 0.5, y + 0.5, 'lock', '#ffcb3d');
    const checkHit = p.style === 'king' && plan.rays[0] && plan.rays[0].hits[0];
    if (checkHit) {
      const n = checkHit.blocked;
      toast(`♚ 체크${n >= 5 ? '메이트' : ''}! 막힌 칸 ${n} → 피해 ×${(1 + CHECK_BONUS * n).toFixed(2)}`, 1600);
      log(`${tag(p)} ♚ 체크! ${tag(checkHit.q)} 주변 막힌 칸 ${n}개 → 피해 ×${(1 + CHECK_BONUS * n).toFixed(2)}`);
      if (n >= 5) shakeBoard(2);
      await sleep(350);
    }
    let hitCount = 0;
    p.atk = (p.atk || 0) + 1;
    const look = lookOf(p.style);
    S.hitKind = look.hit;
    await Promise.all(plan.rays.map(r => sleep(r.delay || 0).then(() => animatePath(r.pts, p.color, 12, [...r.hits.map(h => ({
      d: h.d,
      fn: () => {
        hitCount++;
        impactOn(h.q, look.hit, look.tint || p.color, Math.atan2(h.q.y - p.y, h.q.x - p.x));
        const mult = p.style === 'ricochet' ? 1 + RICO_BONUS * h.bounces : p.style === 'archer' ? 1 + ARROW_BONUS * Math.floor(h.d) : p.style === 'king' ? 1 + CHECK_BONUS * (h.blocked || 0) : 1;
        const dealt = damage(h.q, hitDmg(mult), p, `${s.name}${h.bounces ? `(반사 ${h.bounces}회${p.style === 'ricochet' ? ` +${Math.round(RICO_BONUS * 100 * h.bounces)}%` : ''})` : ''}`);
        if (p.style === 'vampire' && dealt > 0) heal(p, Math.ceil(dealt / 3));
        if (p.style === 'poison' && dealt > 0 && h.q.alive) {
          h.q.poison = POISON_TICKS;
          floatText(h.q, '☠️', 'dmg');
          log(`${tag(h.q)} ☠️ 중독! (${POISON_TICKS}번 × ${POISON_DMG} 피해)`);
        }
      },
    })), ...(r.crates || []).map(c => ({ d: c.d, fn: () => hitCrate(c.key, p, look.hit) }))], look))));
    if (plan.cells.length) {
      if (p.style === 'mortar') {
        // 포탄은 포물선으로 (옆으로 휘어 보이게)
        const [x0, y0, x1, y1] = [p.x + 0.5, p.y + 0.5, tgt[0] + 0.5, tgt[1] + 0.5], L = Math.hypot(x1 - x0, y1 - y0) || 1;
        const arc = [];
        for (let i = 0; i <= 14; i++) { const f = i / 14, h = Math.sin(Math.PI * f) * L * 0.35; arc.push([x0 + (x1 - x0) * f + (y1 - y0) / L * h, y0 + (y1 - y0) * f - (x1 - x0) / L * h]); }
        await animatePath(arc, '#ff9f43', 10, [], { head: 'shell', trail: 'dash', tint: '#ff9f43', speed: 9 });
      }
      const kind = CELL_HIT[p.style] || look.hit;
      S.hitKind = kind;
      for (const [x, y] of plan.cells) impactFx(x + 0.5, y + 0.5, kind, p.style === 'mortar' ? '#ff9f43' : p.color, Math.atan2(y - p.y, x - p.x));
      if (p.style === 'mortar' || p.style === 'bomber') shakeBoard(2);
      else if (p.style === 'knight' || p.style === 'shockwave') shakeBoard(1);
      if (p.style === 'knight') { toast(`${s.icon} 착지!`, 900); if (window.Sfx) Sfx.attack('king', p.id); }
      await sleep(250);
      for (const [x, y, w] of plan.cells) {
        const q = at(x, y);
        if (obAt(x, y)) hitCrate(x + ',' + y, p, kind);
        if (q) { hitCount++; if (q !== p) impactOn(q, kind, p.color, Math.atan2(y - p.y, x - p.x)); damage(q, hitDmg(w), p, s.name); }
      }
    }
    S.hitKind = null;
    // 갈고리: 맞은 적을 내 앞 칸으로 · 충격파: 맞은 적을 1칸 밀쳐냄
    if (p.style === 'grapple') {
      const h = plan.rays[0] && plan.rays[0].hits[0];
      if (h && h.q.alive) shove(h.q, p.x + Math.sign(h.q.x - p.x), p.y + Math.sign(h.q.y - p.y), '끌려왔다');
    }
    if (p.style === 'shockwave') {
      const hit = plan.cells.map(([x, y]) => at(x, y)).filter(q => q && q !== p && q.alive);
      // 먼 적부터 밀어야 앞의 적이 뒤의 적에게 막히지 않는다
      hit.sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y) || a.id - b.id);
      for (const q of hit) shove(q, q.x + Math.sign(q.x - p.x), q.y + Math.sign(q.y - p.y), '밀려났다');
    }
    if (cross) cross.remove();
    if (hitCount) p.landed = (p.landed || 0) + 1;
    if (!hitCount) log(`${tag(p)} ${s.icon} ${s.name}… 빗나감`);
  }

  // ------------------------------------------------------------------
  //  이동: 범위 안의 빈 칸으로 (킹처럼 8방향, 거리 = 가로·세로 중 큰 값)
  // ------------------------------------------------------------------
  /** 게임 시작 때 동전 칸을 정한다 (게임 seed 로 정해져 모든 화면이 같다) */
  function initCoins() {
    const r = mulberry32((S.gseed ^ 0x5eed) | 0);
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (open(x, y) && S.players.every(q => Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) >= 2)) free.push([x, y]);
    }
    S.coins = [];
    while (S.coins.length < COIN_COUNT && free.length) S.coins.push(free.splice(Math.floor(r() * free.length), 1)[0]);
    renderCoins();
  }
  // ------------------------------------------------------------------
  //  🧪 실험 모드: 장애물 + 자기장
  // ------------------------------------------------------------------
  /** 게임 seed 로 돌·상자를 놓는다 (모든 화면이 같다). 시작 칸 둘레 1칸과 서로 붙은 자리는 피한다 */
  function initObstacles() {
    S.obst = new Map();
    computeDepth();
    if (!S.exp) { renderObstacles(); return; }
    const r = mulberry32((S.gseed ^ 0x0b57ac1e) | 0);
    const want = OBST_COUNT[BOARD.kind === 'pentagon' ? 'pentagon' : 'square'];
    const starts = LAYOUTS[S.players.length] || LAYOUTS[3];
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (inB(x, y) && starts.every(([sx, sy]) => Math.max(Math.abs(sx - x), Math.abs(sy - y)) >= 2)) free.push([x, y]);
    }
    let i = 0;
    for (const kind of ['rock', 'crate']) {
      for (let k = 0; k < want[kind] && free.length; k++) {
        // 이미 놓인 장애물과 붙지 않는 자리를 우선 (막힌 벽이 생기지 않게)
        const spaced = free.filter(([x, y]) => ![...S.obst.values()].some(o => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 1));
        const pool = spaced.length ? spaced : free;
        const [x, y] = pool[Math.floor(r() * pool.length)];
        free.splice(free.findIndex(c => c[0] === x && c[1] === y), 1);
        S.obst.set(x + ',' + y, { kind, x, y, hp: kind === 'crate' ? CRATE_HP : Infinity, i: i++ });
      }
    }
    renderObstacles();
  }
  /** 각 칸이 판 가장자리에서 몇 겹 안쪽인지 (자기장이 바깥부터 좁혀 온다) */
  function computeDepth() {
    S.depth = new Map();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inB(x, y)) continue;
      let d = 99;
      for (let yy = -1; yy <= N; yy++) for (let xx = -1; xx <= N; xx++) {
        if (!inB(xx, yy)) d = Math.min(d, Math.max(Math.abs(xx - x), Math.abs(yy - y)) - 1);
      }
      S.depth.set(x + ',' + y, d);
    }
  }
  const maxZone = () => Math.max(0, Math.max(...(S.depth ? S.depth.values() : [0])) - 1);
  /** 자기장 단계 (0 = 없음). 턴제는 라운드, 난전은 전체 행동 수로 정한다 */
  function zoneLevel(offset = 0) {
    if (!S.exp) return 0;
    const Z = brawl() ? ZONE_BRAWL : ZONE_TURN;
    const n = (brawl() ? (S.zoneSeq || 0) - (S.zoneSeq0 || 0) : S.round) + offset;
    return n < Z.start ? 0 : Math.min(maxZone(), 1 + Math.floor((n - Z.start) / Z.every));
  }
  const inZone = (x, y, lvl = zoneLevel()) => lvl > 0 && (S.depth.get(x + ',' + y) ?? 0) < lvl;
  /** 곧 자기장이 될 칸 (턴제: 다음 라운드, 난전: 몇 행동 뒤) */
  const zoneSoon = () => zoneLevel(brawl() ? 4 : 1);
  function zoneHit(q, lvl) {
    if (!q.alive) return;
    burst(q.x + 0.5, q.y + 0.5, '#ff4d6d');
    trueDamage(q, ZONE_DMG[Math.min(lvl, ZONE_DMG.length - 1)], '⚡자기장', 'burn');   // 자기장은 방패로 못 막는다
  }
  /** 턴제: 새 라운드가 시작될 때 자기장 안의 모든 말이 피해 */
  function zoneRound() {
    const lvl = zoneLevel();
    if (!lvl) return;
    if (lvl > zoneLevel(-1)) {
      toast(`⚡ 자기장이 좁아졌어요! 빨간 칸에선 라운드마다 ${ZONE_DMG[lvl]} 피해`, 2600);
      log(`⚡ 자기장 ${lvl}단계 — 빨간 칸에 있으면 라운드마다 ${ZONE_DMG[lvl]} 피해`);
      shakeBoard(1);
    }
    for (const q of alive()) if (inZone(q.x, q.y, lvl)) zoneHit(q, lvl);
    renderZone();
  }
  /** 난전: 행동이 끝날 때 — 단계가 올라가면 자기장 안의 모두, 아니면 행동한 사람만 */
  function zoneBrawlAfter(p) {
    const lvl = zoneLevel();
    if (!lvl) { renderZone(); return; }
    if (lvl > zoneLevel(-1)) {
      toast(`⚡ 자기장이 좁아졌어요! 빨간 칸에서 행동하면 ${ZONE_DMG[lvl]} 피해`, 2600);
      log(`⚡ 자기장 ${lvl}단계`);
      for (const q of alive()) if (inZone(q.x, q.y, lvl)) zoneHit(q, lvl);
    } else if (p && p.alive && inZone(p.x, p.y, lvl)) zoneHit(p, lvl);
    renderZone();
  }
  function renderZone() {
    if (!el.cells) return;
    const lvl = zoneLevel(), soon = zoneSoon();
    el.cells.querySelectorAll('.cell').forEach(c => {
      const x = +c.dataset.x, y = +c.dataset.y;
      const z = inB(x, y) && inZone(x, y, lvl);
      c.classList.toggle('zone', z);
      c.classList.toggle('zone-warn', !z && inB(x, y) && soon > lvl && inZone(x, y, soon));
    });
  }
  const ROCK_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="92" rx="36" ry="7" fill="rgba(0,0,0,.35)"/>
    <path d="M14 88 Q6 62 22 46 Q28 22 52 20 Q78 18 86 42 Q97 62 88 88 Z" fill="#8b93a7" stroke="#151827" stroke-width="5" stroke-linejoin="round"/>
    <path d="M30 44 Q36 30 52 29" fill="none" stroke="#c5cbd8" stroke-width="5" stroke-linecap="round"/>
    <path d="M58 56 L66 68 L60 80 M40 64 L34 76" fill="none" stroke="#5d6477" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  const crateSvg = hp => `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="92" rx="36" ry="7" fill="rgba(0,0,0,.35)"/>
    <rect x="14" y="30" width="72" height="60" rx="5" fill="#c98b3c" stroke="#151827" stroke-width="5"/>
    <path d="M14 50 L86 50 M14 70 L86 70" stroke="#8a5a2b" stroke-width="3.5"/>
    <path d="M18 34 L82 86 M82 34 L18 86" stroke="#9b6834" stroke-width="5" stroke-linecap="round"/>
    <rect x="14" y="30" width="72" height="60" rx="5" fill="none" stroke="#151827" stroke-width="5"/>
    ${hp < CRATE_HP ? '<path d="M44 30 L50 46 L42 58 L52 72 M70 90 L64 76 L72 66" fill="none" stroke="#151827" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;
  /** 돌·상자를 판 위에 세워서 그린다 (말처럼 카메라를 바라봄) */
  function renderObstacles() {
    if (!el.pieces) return;
    const keep = new Set();
    for (const [key, o] of S.exp ? S.obst : []) {
      keep.add(key);
      let node = el.pieces.querySelector(`[data-ob="${key}"]`);
      const look = o.kind + (o.kind === 'crate' ? o.hp : '');
      if (!node) {
        node = document.createElement('div');
        node.className = 'piece obst';
        node.dataset.ob = key;
        node.style.setProperty('--x', o.x);
        node.style.setProperty('--y', o.y);
        node.innerHTML = '<div class="stand"><div class="avatar ob"></div></div>';
        el.pieces.appendChild(node);
      }
      if (node.dataset.look !== look) {
        node.dataset.look = look;
        node.querySelector('.ob').innerHTML = o.kind === 'rock' ? ROCK_SVG : crateSvg(o.hp);
        node.title = o.kind === 'rock' ? '돌: 탄을 막음 (튕기는 탄은 튕김)' : `상자: 탄을 막음 · ${o.hp}번 더 맞으면 부서짐 → 부순 사람 🛡️`;
      }
    }
    el.pieces.querySelectorAll('.obst').forEach(n => { if (!keep.has(n.dataset.ob)) n.remove(); });
    renderZone();
  }

  function renderCoins() {
    el.cells.querySelectorAll('.coin').forEach(n => n.classList.remove('coin'));
    for (const [x, y] of S.coins || []) {
      const n = el.cells.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
      if (n) n.classList.add('coin');
    }
  }
  /** 동전 칸을 밟으면 동전 던지기: 앞면이면 모두의 위치를 무작위로 섞는다 */
  async function flipCoin(p, idx) {
    const heads = rng() < 0.5;
    toast(`🪙 ${p.emoji} 동전 던지기…`, 1200);
    sfx('coin');
    await sleep(900);
    if (heads) {
      const live = alive();
      const spots = live.map(q => [q.x, q.y]);
      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [spots[i], spots[j]] = [spots[j], spots[i]];
      }
      live.forEach((q, i) => { burst(q.x + 0.5, q.y + 0.5, '#ffd84d'); [q.x, q.y] = spots[i]; });
      renderPieces();
      toast('🪙 앞면! 모두의 위치가 뒤섞였어요', 2200);
      sfx('heads');
      log(`${tag(p)} 🪙 동전 앞면 → 모두의 위치를 섞었다!`);
      await sleep(400);
    } else {
      toast('🪙 뒷면… 아무 일도 없었어요', 1600);
      sfx('tails');
      log(`${tag(p)} 🪙 동전 뒷면`);
    }
    // 쓴 동전 칸은 다른 빈 칸으로 옮겨 간다
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (open(x, y) && !S.coins.some(c => c[0] === x && c[1] === y)) free.push([x, y]);
    }
    if (free.length) S.coins[idx] = free[Math.floor(rng() * free.length)];
    renderCoins();
  }

  async function doMove(p, dest, range) {
    if (!dest || at(dest[0], dest[1]) || obAt(dest[0], dest[1]) || Math.max(Math.abs(dest[0] - p.x), Math.abs(dest[1] - p.y)) > range) {
      log(`${tag(p)} 👣 이동할 수 없는 칸이라 제자리`);
      return;
    }
    burst(p.x + 0.5, p.y + 0.5, p.color);
    if (window.Sfx) Sfx.move(p.id);
    p.x = dest[0];
    p.y = dest[1];
    renderPieces();
    updateCamera();
    await sleep(450);
    burst(p.x + 0.5, p.y + 0.5, p.color);
    log(`${tag(p)} 👣 ${coord(p.x, p.y)} 로 이동`);
    const ci = (S.coins || []).findIndex(c => c[0] === p.x && c[1] === p.y);
    if (ci >= 0) await flipCoin(p, ci);
    renderAll();
  }

  // ------------------------------------------------------------------
  //  랜덤박스
  // ------------------------------------------------------------------
  function weighted(pool) {
    const total = pool.reduce((s, b) => s + b.w, 0);
    let r = rng() * total;
    for (const b of pool) { r -= b.w; if (r < 0) return b; }
    return pool[pool.length - 1];
  }

  async function doBox(p, level, fast) {
    const pool = BOX.filter(b => !((level !== 'easy' || fast) && b.bad) && !(prepRound() && ['bolt', 'meteor'].includes(b.id)));
    const res = weighted(pool);
    if (brawl()) {
      toast(`${p.emoji} 🎁 ${res.icon} ${res.name}`, 2000);
      sfx('boxopen');
      log(`${tag(p)} 🎁 랜덤박스: ${res.icon} ${res.name}`);
      await applyBox(p, res);
      await killerBonusBox(p, level, pool, res);
      return;
    }
    const c = openModal(`
      <h2>🎁 랜덤박스</h2>
      <div class="roulette"><div class="slot">❔</div><div class="slot-name"></div></div>
      <div class="box-desc hidden"></div>
      <button class="primary full hidden">확인</button>`, 'small');
    const slot = c.querySelector('.slot');
    for (let i = 0; i < 16; i++) {
      slot.textContent = pool[Math.floor(Math.random() * pool.length)].icon; // 연출용 (결과와 무관)
      sfx('boxtick');
      await sleep(55 + i * 10);
    }
    slot.textContent = res.icon;
    slot.classList.add('done');
    sfx('boxopen');
    c.querySelector('.slot-name').textContent = res.name;
    const desc = c.querySelector('.box-desc');
    desc.textContent = res.desc;
    desc.classList.remove('hidden');
    const ok = c.querySelector('.primary');
    ok.classList.remove('hidden');
    ok.focus();
    await new Promise(r => {
      ok.onclick = r;
      S.keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); r(); } };
      if (S.online || p.bot) setTimeout(r, 1800); // 온라인·AI: 화면이 멈추지 않도록 자동 진행
    });
    closeModal();
    log(`${tag(p)} 🎁 랜덤박스: ${res.icon} ${res.name}`);
    await applyBox(p, res);
    await killerBonusBox(p, level, pool, res);
  }

  /** 킬러로 연 랜덤박스는 효과를 하나 더 (추가 행동 제외) */
  async function killerBonusBox(p, level, pool, first) {
    if (level !== 'killer' || !p.alive) return;
    const extra = weighted(pool.filter(b => b.id !== 'again' && b.id !== first.id));
    toast(`🔥 킬러 보너스: ${extra.icon} ${extra.name}`, 1800);
    log(`${tag(p)} 🔥 킬러 보너스: ${extra.icon} ${extra.name}`);
    await sleep(300);
    await applyBox(p, extra);
  }

  async function applyBox(p, b) {
    const foes = enemies(p);
    if (b.id !== 'heal' && b.id !== 'meteor') sfx('box_' + b.id);
    switch (b.id) {
      case 'heal': {
        const before = p.hp;
        heal(p, 40);
        break;
      }
      case 'power':
        p.power = true;
        floatText(p, `💥 x${POWER_MULT}`, 'info');
        break;
      case 'bolt': {
        const t = foes[rand(foes.length)];
        if (t) {
          await animatePath([[t.x + 0.5, -1.5], [t.x + 0.5, t.y + 0.5]], '#ffe14d', 22);
          burst(t.x + 0.5, t.y + 0.5, '#ffe14d');
          damage(t, 30, p, '번개');
        }
        break;
      }
      case 'meteor':
        for (const t of foes) {
          sfx('box_meteor');
          await animatePath([[t.x - 1.5, t.y - 2.5], [t.x + 0.5, t.y + 0.5]], '#ff9f43', 18);
          burst(t.x + 0.5, t.y + 0.5, '#ff9f43');
          damage(t, 18, p, '유성우');
        }
        break;
      case 'tele': {
        const empty = [];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (open(x, y)) empty.push([x, y]);
        const [x, y] = empty[rand(empty.length)];
        burst(p.x + 0.5, p.y + 0.5, '#b18cff');
        p.x = x; p.y = y;
        renderPieces();
        await sleep(250);
        burst(x + 0.5, y + 0.5, '#b18cff');
        log(`${tag(p)} 🌀 ${coord(x, y)} 로 순간이동`);
        heal(p, 15);
        break;
      }
      case 'swap': {
        const t = foes[rand(foes.length)];
        if (t) {
          [p.x, p.y, t.x, t.y] = [t.x, t.y, p.x, p.y];
          burst(p.x + 0.5, p.y + 0.5, '#b18cff');
          burst(t.x + 0.5, t.y + 0.5, '#b18cff');
          log(`${tag(p)} 🔁 ${tag(t)} 와(과) 위치 교환`);
          renderPieces();
          await sleep(250);
          damage(t, 15, p, '위치 교환');
        }
        break;
      }
      case 'again':
        if (brawl()) heal(p, 25);
        else { S.extra = true; heal(p, 10); }
        break;
      case 'bomb':
        burst(p.x + 0.5, p.y + 0.5, '#ff5d6c');
        damage(p, 15, p, '폭탄');
        break;
    }
    renderAll();
  }

  // ------------------------------------------------------------------
  //  온라인 사설방
  // ------------------------------------------------------------------
  // 공개된 게임 페이지 주소. 초대 링크 = 이 주소 + '#방코드'
  const INVITE_BASE = 'https://claude.ai/artifact/2E2sjbN9FEvtqU8FMwpNie';
  const APP = 'pdeb3';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const HOST_SAVE = 'pdeb3-host';
  const ACT_KEYS = ['attack', 'move', 'box', 'pick', 'restart'];
  const ACT_WINDOW = 5;   // 방장이 함께 보내는 최근 행동 수

  const cleanText = (v, max) => String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .trim().slice(0, max);
  const int = (v, lo, hi, d = lo) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  /** 게임 상태 직렬화 (presence 4KiB 안에 들어가도록 숫자 배열로) */
  function snapshot() {
    return {
      t: S.turn, r: S.round, o: S.pos, x: S.extraActive ? 1 : 0, g: S.gseed, c: S.coins, m: S.maxHp,
      zs: S.zoneSeq || 0, z0: S.zoneSeq0 || 0,
      ob: S.exp ? [...S.obst.values()].filter(o => o.kind === 'crate').map(o => [o.i, o.hp]) : undefined,
      p: S.players.map(p => [p.x, p.y, Math.round(p.ang * 10), p.hp, p.alive ? 1 : 0, p.shield ? 1 : 0, p.power ? 1 : 0, p.correct, p.tries, p.score, STYLE_KEYS.indexOf(p.style), Math.round((p.aimBase == null ? p.ang : p.aimBase) * 10), p.poison | 0]),
    };
  }
  function loadSnapshot(b) {
    if (!b || !Array.isArray(b.p)) return;
    S.turn = int(b.t, 0, S.players.length - 1);
    S.round = int(b.r, 1, 9999, 1);
    S.maxHp = int(b.m, 50, 999, S.maxHp);
    S.pos = int(b.o, 0, S.players.length - 1);
    S.extra = false;
    S.extraActive = !!b.x;
    S.gseed = int(b.g, 0, 2 ** 31, 1);
    S.coins = (Array.isArray(b.c) ? b.c : []).slice(0, COIN_COUNT)
      .map(c => [int(c && c[0], 0, N - 1), int(c && c[1], 0, N - 1)]).filter(c => inB(c[0], c[1]));
    renderCoins();
    S.zoneSeq = int(b.zs, 0, 1e9, 0);
    S.zoneSeq0 = int(b.z0, 0, 1e9, 0);
    if (S.exp) {
      initObstacles();
      if (Array.isArray(b.ob)) {
        const hp = new Map(b.ob.filter(Array.isArray).map(a => [int(a[0], 0, 99), int(a[1], 0, CRATE_HP)]));
        for (const [k, o] of [...S.obst]) {
          if (o.kind !== 'crate') continue;
          const h = hp.get(o.i);
          if (!h) S.obst.delete(k); else o.hp = h;
        }
      }
      renderObstacles();
    }
    b.p.forEach((a, i) => {
      const p = S.players[i];
      if (!p || !Array.isArray(a)) return;
      p.x = int(a[0], 0, N - 1); p.y = int(a[1], 0, N - 1); p.ang = int(a[2], 0, 3599) / 10;
      p.hp = int(a[3], 0, S.maxHp); p.alive = !!a[4] && p.hp > 0; p.shield = !!a[5]; p.power = !!a[6];
      p.correct = int(a[7], 0, 9999); p.tries = int(a[8], 0, 9999); p.score = int(a[9], 0, 1e7);
      p.style = STYLE_KEYS[int(a[10], -1, STYLE_KEYS.length - 1, -1)] || null;
      p.aimBase = a[11] == null ? p.ang : int(a[11], 0, 3599) / 10;
      p.poison = int(a[12], 0, 9, 0);
    });
  }
  /** 다른 사람이 보낸 act 는 믿지 않고 형식을 맞춘다 */
  function cleanAct(a) {
    if (!a || !ACT_KEYS.includes(a.key)) return null;
    const act = { key: a.key, seq: int(a.seq, 0, 1e9), seed: int(a.seed, 0, 2 ** 31), actor: int(a.actor, 0, MAX_PLAYERS - 1), n: int(a.n, 0, 2e9) };
    const cell = c => (Array.isArray(c) ? [int(c[0], 0, N - 1), int(c[1], 0, N - 1)] : null);
    if (a.key === 'pick') act.style = STYLE_KEYS.includes(a.style) ? a.style : null;
    if (['attack', 'move', 'box'].includes(a.key)) {
      act.level = LEVEL_KEYS.includes(a.level) ? a.level : 'easy';
      act.cat = CAT_KEYS.includes(a.cat) ? a.cat : 'calc';
      act.ok = !!a.ok;
      act.to = a.to ? 1 : 0;
      act.topic = cleanText(a.topic, 24);
      act.fast = act.ok && a.fast ? 1 : 0;
      act.pts = act.ok ? int(a.pts, 0, LEVELS[act.level].pts + 100) : 0;
      act.sec = int(Number(a.sec) * 10, 0, 9999) / 10;
      act.ang = Math.round(normAng(Number(a.ang) || 0) * 10) / 10;
      if (a.key === 'move') act.dest = cell(a.dest);
      if (a.key === 'attack') act.tgt = cell(a.tgt);
    }
    return act;
  }

  function restartOnline(seed) {
    S.gseed = seed | 0;
    S.myBusy = false; S.lockUntil = 0;
    const names = S.players.map(p => p.name);
    S.players = names.map((nm, i) => makePlayer(i, nm, names.length));
    initObstacles();
    initCoins();
    S.turn = 0; S.round = 1; S.pos = 0; S.extra = false; S.extraActive = false;
    closeModal();
    el.pieces.innerHTML = '';
    el.log.innerHTML = '';
    log('🎮 새 판 시작!');
    startOnlineTurn();
  }

  /**
   * 로그인 없이 쓰는 온라인 연결: 공개 MQTT 중계 서버(WebSocket)로 claude.ai room 과
   * 같은 모양(presence / peers / onPeers)을 흉내 낸다. 각자의 presence 를
   * pdeb1/<방코드>/p/<uid> 에 retained 로 올리고, 연결이 끊기면 last-will 로 지운다.
   */
  const BROKERS = [
    { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
    { url: 'wss://broker.hivemq.com:8884/mqtt' },
  ];
  function connectRelay(code, uid) {
    const base = `pdeb3/${code}/p/`;
    const myTopic = base + uid;
    return new Promise((resolve, reject) => {
      let i = 0;
      const tryNext = () => {
        if (i >= BROKERS.length) { reject(new Error('relay')); return; }
        const b = BROKERS[i++];
        const c = window.mqtt.connect(b.url, {
          username: b.username, password: b.password,
          clientId: 'pdeb_' + uid + '_' + Math.random().toString(36).slice(2, 7),
          clean: true, connectTimeout: 6000, reconnectPeriod: 2000, keepalive: 20,
          will: { topic: myTopic, payload: '', qos: 1, retain: true },
        });
        let ok = false;
        const timer = setTimeout(() => { if (!ok) { c.end(true); tryNext(); } }, 7000);
        c.on('error', () => {});
        c.once('connect', () => {
          ok = true;
          clearTimeout(timer);
          resolve(makeRelayRoom(c, base, myTopic, uid));
        });
      };
      tryNext();
    });
  }
  function makeRelayRoom(c, base, myTopic, uid) {
    let me = {};
    const others = new Map();
    const handlers = [];
    let cache = [];
    let queued = false;
    const rebuild = () => {
      cache = Object.freeze([
        { peer: uid, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: me, updatedAt: Date.now() },
        ...[...others].map(([id, v]) => ({ peer: id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: v.presence, updatedAt: v.at })),
      ]);
    };
    const emit = () => {
      rebuild();
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; handlers.forEach(h => h({ peers: cache, joined: [], left: [], updated: [] })); }, 0);
    };
    const push = () => c.publish(myTopic, JSON.stringify(me), { qos: 1, retain: true });
    const sub = () => c.subscribe(base + '+', { qos: 1 });
    sub();
    c.on('connect', () => { sub(); if (Object.keys(me).length) push(); }); // 재연결
    c.on('message', (topic, buf) => {
      const id = topic.slice(base.length);
      if (id === uid || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return;
      const txt = buf.toString();
      if (!txt) others.delete(id);
      else {
        try {
          const v = JSON.parse(txt);
          if (v && typeof v === 'object' && !Array.isArray(v)) others.set(id, { presence: Object.freeze(v), at: Date.now() });
        } catch (e) { return; }
      }
      emit();
    });
    rebuild();
    return {
      presence(patch) {
        const next = { ...me };
        for (const k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
        me = Object.freeze(next);
        push();
        emit();
        return Promise.resolve();
      },
      peers: () => cache,
      onPeers(fn) { handlers.push(fn); setTimeout(() => fn({ peers: cache, joined: [], left: [], updated: [] }), 0); return () => {}; },
      close() { c.publish(myTopic, '', { qos: 1, retain: true }, () => c.end()); },
    };
  }

  const Net = {
    room: null,
    uid: null,       // 이 브라우저의 고유 키 (자리 찾기용)
    byId: null,      // 플랫폼이 보증하는 사용자 id (있으면 우선)
    nick: '',
    hostMissingSince: 0,
    seen: {},          // 사람별 마지막 심장박동: { key: { hb, at } } (받은 시각 기준이라 기기 시계가 달라도 된다)
    hostDownSince: 0,  // 방장이 응답 없기 시작한 때 (참가자)
    awaySince: {},     // 자리 비운 사람의 차례가 시작된 때 (방장)
    hostEpoch: 0,      // 방장이 바뀐 횟수 (클수록 새 방장)

    async init() {
      const note = $('#onlineNote');
      let saved = store.get('pdeb-uid');
      if (!saved) { saved = 'k' + Math.random().toString(36).slice(2, 12); store.set('pdeb-uid', saved); }
      this.uid = saved;
      $('#nick').value = store.get('pdeb-nick') || '';
      const hash = (location.hash || '').replace('#', '').toUpperCase();
      if (/^[A-Z0-9]{4}$/.test(hash)) $('#joinCode').value = hash;

      let room = null, user = null;
      if (window.claude && typeof window.claude.use === 'function') {
        [room, user] = await Promise.all([window.claude.use('room'), window.claude.use('user')]);
      }
      if (room) {
        // claude.ai 안에서 열린 경우: 플랫폼 room 사용
        this.mode = 'claude';
        this.room = room;
        this.byId = user ? await user.id() : null;
        room.onPeers(() => this.onPeers(), () => { this.room = null; if (S.online) toast('온라인 연결이 끊겼어요', 3000); });
      } else if (window.mqtt && location.protocol.startsWith('http')) {
        // 일반 웹 주소로 열린 경우: 공개 중계 서버 사용 (로그인 불필요)
        this.mode = 'relay';
      } else {
        note.textContent = '온라인 방은 웹 주소(링크)로 열었을 때만 쓸 수 있어요. 한 기기 모드는 그대로 됩니다.';
        return;
      }
      $('#onlineForm').hidden = false;
      note.textContent = '방을 만들고 초대 링크를 보내거나, 받은 방 코드로 참가하세요. 친구는 로그인 없이 링크만 열면 돼요.';
      $('#btnCreate').onclick = () => this.create();
      $('#btnJoin').onclick = () => this.join();
      $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') this.join(); });
      const h = store.get(HOST_SAVE);
      if (h && h.code && Date.now() - (h.at || 0) < 3 * 3600e3) {
        const b = $('#btnRestore');
        b.hidden = false;
        b.textContent = `↩ 진행 중이던 방 ${h.code} 다시 열기`;
        b.onclick = () => this.restore(h);
      }
      if (hash) $('#nick').focus();
      // 1.5초마다: 심장박동 보내기, 방장 이어받기, 자리 비운 사람 차례 대신 두기
      setInterval(() => this.tick(), 1500);
      document.addEventListener('visibilitychange', () => {
        if (!this.room || !S.online) return;
        this.room.presence({ away: document.hidden ? 1 : 0, hb: Date.now() }).catch(() => {});
        if (!document.hidden) this.tick();
      });
    },

    // ---------- 자리 비움 · 방장 이어받기 ----------
    tick() {
      const o = S.online;
      if (!o || !this.room) return;
      const now = Date.now();
      this.beat = (this.beat || 0) + 1;
      if (this.beat % 2 === 0) this.room.presence({ hb: now, away: document.hidden ? 1 : 0 }).catch(() => {});
      this.trackPeers();
      if (o.phase !== 'game') return;
      if (o.host) this.coverAway(now);
      else this.watchHost(now);
    },
    trackPeers() {
      const now = Date.now();
      for (const p of this.peersInRoom()) {
        const k = this.keyOf(p), hb = p.presence.hb;
        if (!this.seen[k] || this.seen[k].hb !== hb) this.seen[k] = { hb, at: now };
      }
    },
    /** 이 사람이 지금 화면을 보고 있나 (최근 10초 안에 심장박동, 화면 숨김 아님) */
    peerActive(p) {
      if (!p || p.presence.away) return false;
      const s = this.seen[this.keyOf(p)];
      return !!s && Date.now() - s.at < 10000;
    },
    seatActive(i) {
      const o = S.online, seat = o && o.seats[i];
      if (!seat) return false;
      if (seat.b) return true;
      if (i === o.mySeat) return !document.hidden;
      return this.peerActive(this.peerOfSeat(i));
    },
    seatIndexOf(p) { return S.online ? S.online.seats.findIndex(x => x.k === this.keyOf(p)) : -1; },
    /** 참가자: 방장이 6초 넘게 응답이 없으면, 자리 순서로 첫 번째 활동 중인 사람이 방장을 이어받는다 */
    watchHost(now) {
      const o = S.online;
      const hp = this.hostPeer();
      if (hp && this.peerActive(hp)) { this.hostDownSince = 0; return; }
      if (!this.hostDownSince) { this.hostDownSince = now; return; }
      if (now - this.hostDownSince < 6000 || S.applying || o.pending || o.mySeat < 0) return;
      const hostSeat = hp ? this.seatIndexOf(hp) : -1;
      const next = o.seats.findIndex((x, i) => i !== hostSeat && !x.b && this.seatActive(i));
      if (next === o.mySeat) this.takeOver();
    },
    takeOver() {
      const o = S.online;
      o.host = true;
      o.epoch = (this.hostEpoch || 0) + 1;
      this.hostEpoch = o.epoch;
      o.hist = []; o.acts = []; o.act = null; o.base = snapshot();
      this.queue = []; this.handled = {}; this.awaySince = {};
      this.hostDownSince = 0;
      this.publish();
      log('👑 방장이 자리를 비워서 이 기기가 방장을 이어받았어요.');
      toast('👑 방장이 자리를 비워서 이 기기가 방장을 이어받았어요', 3500);
      // 방장에게 보내 두었던 내 행동이 있으면 이어서 처리
      const r = this.myReq;
      this.myReq = null;
      if (r && !brawl() && r.seq === o.seq + 1) this.accept(r);
      else if (r && brawl() && S.myBusy) { this.queue.push({ ...r, actor: o.mySeat }); this.pump(); }
      // 옛 방장에게 보내 놓고 기다리던 다른 사람들의 요청도 바로 확인
      this.lastSig = '';
      this.hostScan();
      if (brawl()) startBrawlBots(); else scheduleBot();
      renderAll();
    },
    /** 더 새로운 방장이 있으면 나는 참가자로 돌아간다 (자리 비웠다 돌아온 옛 방장) */
    maybeDemote() {
      const o = S.online;
      const other = this.hostPeer();
      if (!other) return false;
      const ep = other.presence.ep | 0, mine = o.epoch | 0;
      if (ep < mine || (ep === mine && this.seatIndexOf(other) > o.mySeat)) return false;
      o.host = false;
      o.seq = -1;          // 새 방장의 상태를 통째로 받아 온다
      o.pending = null;
      this.hostEpoch = ep;
      this.queue = []; this.handled = {};
      clearInterval(S.brawlBotTimer);
      store.del(HOST_SAVE);
      this.room.presence({ role: 'guest', join: 1, seats: null, base: null, acts: null, act: null, ph: null, seq: null, ep: null, req: null }).catch(() => {});
      log('👑 다른 사람이 방장을 이어받아서, 이 기기는 참가자로 돌아왔어요.');
      toast('다른 사람이 방장을 이어받았어요. 이어서 같이 해요!', 3000);
      this.guestSync();
      return true;
    },
    /** 방장: 턴제에서 자리 비운 사람의 차례가 15초 넘게 멈춰 있으면 AI 가 대신 둔다 */
    coverAway(now) {
      if (brawl() || S.phase !== 'choose' || S.applying) return;
      const p = cur();
      if (!p || !p.alive || p.bot || p.id === S.online.mySeat || this.seatActive(p.id)) { if (p) this.awaySince[p.id] = 0; return; }
      if (!this.awaySince[p.id]) { this.awaySince[p.id] = now; return; }
      if (now - this.awaySince[p.id] < 15000 || S.botBusy) return;
      if (!S.awayNoted) { S.awayNoted = true; log(`🤖 ${tag(p)} 자리 비움 → AI 가 대신 둡니다`); toast(`🤖 ${p.emoji} ${p.name} 자리 비움 · AI 가 대신 둬요`, 2500); }
      botTurn(S.botToken = (S.botToken || 0) + 1, true);
    },

    myKey() { return this.byId || this.uid; },
    inviteLink(code) {
      const here = location.href.split('#')[0];
      return (this.mode === 'claude' ? INVITE_BASE : here) + '#' + code;
    },
    /** relay 모드는 방마다 따로 연결한다 */
    async connect(code) {
      if (this.mode !== 'relay') return true;
      if (this.room && this.roomCode === code) return true;
      if (this.room) { this.room.close(); this.room = null; }
      toast('온라인 서버에 연결 중…', 6000);
      try {
        this.room = await connectRelay(code, this.uid);
        this.roomCode = code;
        this.room.onPeers(() => this.onPeers());
        el.toast.classList.remove('show');
        return true;
      } catch (e) {
        toast('온라인 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요.', 4000);
        return false;
      }
    },
    keyOf(peer) { return peer.by || cleanText(peer.presence && peer.presence.uid, 40) || peer.peer; },
    peersInRoom() {
      if (!this.room || !S.online) return [];
      return this.room.peers().filter(p => p.presence && p.presence.app === APP && p.presence.room === S.online.code && !p.sameTab);
    },
    hostPeer() {
      const hs = this.peersInRoom().filter(p => p.presence.role === 'host');
      if (hs.length <= 1) return hs[0] || null;
      return hs.sort((a, b) => (b.presence.ep | 0) - (a.presence.ep | 0) || (b.presence.seq | 0) - (a.presence.seq | 0) || this.seatIndexOf(a) - this.seatIndexOf(b))[0];
    },
    peerOfSeat(i) {
      const seat = S.online && S.online.seats[i];
      if (!seat) return null;
      return this.peersInRoom().find(p => this.keyOf(p) === seat.k) || null;
    },
    seatOnline(i) {
      if (!S.online) return true;
      if (i === S.online.mySeat) return true;
      if (S.online.seats[i] && S.online.seats[i].b) return true;
      return !!this.peerOfSeat(i);
    },
    seatStatus(i) {
      const p = this.peerOfSeat(i);
      return p ? cleanText(p.presence.doing, 60) : '';
    },
    status(text) {
      if (this.room && S.online) this.room.presence({ doing: text || null }).catch(() => {});
    },
    /** 관전용 실시간 상태 (고르는 중인 과목·문제·선택한 답 등) */
    live(obj) {
      if (!this.room || !S.online) return;
      const clip = v => (typeof v === 'string' ? v.slice(0, 1000) : Array.isArray(v) ? v.map(clip) : v);
      let out = null;
      if (obj) { out = {}; for (const k in obj) out[k] = clip(obj[k]); }
      this.room.presence({ live: out }).catch(() => {});
    },
    liveAim(a) {
      if (this.room && S.online) this.room.presence({ aim: a }).catch(() => {});
    },
    seatLive(i) {
      const p = this.peerOfSeat(i);
      return p ? p.presence.live || null : null;
    },
    seatAim(i) {
      const p = this.peerOfSeat(i);
      const a = p && Number(p.presence.aim);
      return Number.isFinite(a) ? normAng(a) : null;
    },
    /** 상대 차례에 조준이 바뀌면 내 화면에도 바로 반영 */
    followAim() {
      if (!S.online || brawl() || myTurn() || S.applying || S.phase !== 'choose') return;
      const a = this.seatAim(S.turn);
      const p = cur();
      if (a == null || !p || Math.abs(p.ang - a) < 0.05) return;
      p.ang = Math.round(a * 10) / 10;
      renderPieces(); renderGuide(); updateCamera(); renderTurn();
    },
    readNick() {
      const n = cleanText($('#nick').value, 10);
      if (!n) { $('#nick').focus(); toast('닉네임을 먼저 적어 주세요'); return null; }
      store.set('pdeb-nick', n);
      this.nick = n;
      return n;
    },

    // ---------- 방장 ----------
    async create() {
      if (!this.readNick()) return;
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!(await this.connect(code))) return;
      S.online = { code, host: true, seats: [{ k: this.myKey(), n: this.nick }], mySeat: 0, phase: 'lobby', seq: 0, base: null, act: null, timer: $('#optTimer').checked, mode: 'turn', hp: S.maxHp, exp: !!($('#optExp') && $('#optExp').checked) };
      this.publish();
      showLobby();
    },
    async restore(h) {
      if (!(await this.connect(h.code))) return;
      this.nick = cleanText(h.nick, 10) || '방장';
      const seats = (h.seats || []).map(x => ({ k: cleanText(x.k, 60), n: cleanText(x.n, 10) }));
      if (!seats.length) return;
      seats[0].k = this.myKey();
      S.online = { code: h.code, host: true, seats, mySeat: 0, phase: h.phase === 'game' ? 'game' : 'lobby', seq: int(h.seq, 0, 1e9), base: null, act: null, timer: !!h.timer, mode: h.mode === 'brawl' ? 'brawl' : 'turn', hp: int(h.hp, 50, 999, DEFAULT_HP), exp: !!h.exp };
      this.queue = []; this.handled = {};
      if (S.online.phase === 'game') {
        this.enterGame();
        loadSnapshot(h.cur);
        S.online.base = snapshot(); S.online.acts = []; S.online.hist = [];
        this.publish();
        startOnlineTurn();
        log('↩ 방을 다시 열었어요.');
      } else {
        this.publish();
        showLobby();
      }
    },
    publish() {
      const o = S.online;
      this.room.presence({
        app: APP, room: o.code, role: 'host', uid: this.uid, nick: this.nick,
        seats: o.seats, ph: o.phase, seq: o.seq, base: o.base, acts: o.acts || [], act: null, tm: o.timer ? 1 : 0, md: o.mode, mh: o.hp, ex: o.exp ? 1 : 0, req: null, ep: o.epoch | 0,
      }).catch(() => toast('방 정보를 보내지 못했어요', 2500));
      store.set(HOST_SAVE, { code: o.code, nick: this.nick, seats: o.seats, phase: o.phase, seq: o.seq, timer: o.timer, mode: o.mode, hp: o.hp, exp: o.exp ? 1 : 0, cur: o.phase === 'game' ? snapshot() : null, at: Date.now() });
    },
    startGame() {
      const o = S.online;
      if (!o || !o.host || o.seats.length < 2) return;
      o.phase = 'game';
      this.queue = []; this.handled = {};
      this.enterGame();
      S.gseed = newSeed();
      initObstacles();
      initCoins();
      o.seq = 0; o.act = null; o.base = snapshot(); o.acts = []; o.hist = [];
      this.publish();
      log('🎮 게임 시작! 문제를 맞혀 행동하세요.');
      expIntro();
      startOnlineTurn();
    },
    accept(a) {
      const o = S.online;
      const act = cleanAct({ ...a, seq: o.seq + 1, seed: newSeed() });
      if (brawl() && act && act.key !== 'restart' && !(S.players[act.actor] && S.players[act.actor].alive)) return;
      if (!act) return;
      // 최근 행동 몇 개를 함께 보내, 늦게 받은 화면도 빠짐없이 차례로 재생하게 한다.
      // base 는 목록 첫 행동 직전의 상태.
      o.hist = o.hist || [];
      o.hist.push({ act, before: snapshot() });
      if (o.hist.length > ACT_WINDOW) o.hist.shift();
      o.base = o.hist[0].before;
      o.acts = o.hist.map(h => h.act);
      o.act = act;
      o.seq = act.seq;
      this.publish();
      applyAct(act);
    },
    hostScan() {
      const o = S.online;
      if (o && o.host && o.phase === 'game' && brawl()) { this.brawlScan(); return; }
      if (!o || !o.host || o.phase !== 'game' || S.applying || !['choose', 'rotate', 'over'].includes(S.phase)) return;
      for (const p of this.peersInRoom()) {
        const r = p.presence.req;
        if (!r || int(r.seq, 0, 1e9) !== o.seq + 1) continue;
        const seat = o.seats.findIndex(x => x.k === this.keyOf(p));
        if (seat !== S.turn || r.key === 'restart') continue;
        this.accept(r);
        return;
      }
    },

    /** 난전: 누구의 요청이든 받은 순서대로 줄 세워 하나씩 처리한다 */
    brawlScan() {
      const o = S.online;
      this.queue = this.queue || [];
      this.handled = this.handled || {};
      for (const p of this.peersInRoom()) {
        const r = p.presence.req;
        const seat = o.seats.findIndex(x => x.k === this.keyOf(p));
        if (!r || seat < 0 || r.key === 'restart' || !r.n) continue;
        const done = this.handled[seat] || (this.handled[seat] = new Set());
        if (done.has(r.n)) continue;
        done.add(r.n);
        this.queue.push({ ...r, actor: seat });
      }
      this.pump();
    },
    pump() {
      if (S.applying || !this.queue || !this.queue.length) return;
      this.accept(this.queue.shift());
    },

    // ---------- 참가자 ----------
    async join() {
      const code = cleanText($('#joinCode').value, 4).toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) { $('#joinCode').focus(); toast('방 코드 4자리를 입력하세요'); return; }
      if (!this.readNick()) return;
      if (!(await this.connect(code))) return;
      S.online = { code, host: false, seats: [], mySeat: -1, phase: 'joining', seq: -1, pending: null, timer: true, mode: 'turn' };
      this.room.presence({ app: APP, room: code, role: 'guest', uid: this.uid, nick: this.nick, join: 1, req: null, doing: null })
        .catch(() => toast('방에 신호를 보내지 못했어요', 2500));
      showLobby();
      setTimeout(() => {
        if (S.online && S.online.code === code && S.online.phase === 'joining') renderLobby('방 ' + code + '을(를) 찾지 못했어요. 코드가 맞는지, 방장이 게임 페이지를 열어 두었는지 확인하세요.');
      }, 6000);
    },
    guestSync() {
      const o = S.online;
      const hp = this.hostPeer();
      if (!hp) {
        if (o.phase === 'game' && !this.hostMissingSince) {
          this.hostMissingSince = Date.now();
          setTimeout(() => { if (S.online && !this.hostPeer()) toast('방장 연결이 끊겼어요. 방장이 돌아오면 이어집니다.', 4000); }, 2500);
        }
        return;
      }
      this.hostMissingSince = 0;
      const h = hp.presence;
      this.hostEpoch = h.ep | 0;
      o.seats = (Array.isArray(h.seats) ? h.seats : []).slice(0, MAX_PLAYERS).map(x => ({ k: cleanText(x && x.k, 60), n: cleanText(x && x.n, 10) || '플레이어', b: x && x.b ? 1 : 0 }));
      o.mySeat = o.seats.findIndex(x => x.k === this.myKey());
      o.timer = !!h.tm;
      o.mode = h.md === 'brawl' ? 'brawl' : 'turn';
      o.hp = int(h.mh, 50, 999, DEFAULT_HP);
      o.exp = !!h.ex;
      if (h.ph === 'lobby') {
        if (o.phase === 'game') { toast('방장이 방을 새로 열었어요'); }
        o.phase = 'lobby';
        renderLobby();
        return;
      }
      if (h.ph !== 'game') return;
      if (o.phase !== 'game') {
        o.phase = 'game';
        this.enterGame();
        o.seq = -1;
      }
      const seq = int(h.seq, 0, 1e9);
      if (seq > o.seq) {
        o.pending = { seq, base: h.base, acts: Array.isArray(h.acts) ? h.acts.slice(0, ACT_WINDOW) : (h.act ? [h.act] : []) };
        this.processPending();
      } else renderAll();
    },
    processPending() {
      const o = S.online;
      if (!o || o.host || !o.pending || S.applying) return;
      const h = o.pending;
      if (o.seq >= h.seq) { o.pending = null; return; }
      const acts = h.acts.map(cleanAct).filter(Boolean).sort((m, n) => m.seq - n.seq);
      let next = acts.find(a => a.seq === o.seq + 1);
      if (!next) {
        // 따라잡을 수 없을 만큼 벌어졌으면 목록 첫 행동 직전 상태부터 다시 재생
        loadSnapshot(h.base);
        o.seq = acts.length ? acts[0].seq - 1 : h.seq;
        this.brawlView();
        if (!acts.length) { o.pending = null; startOnlineTurn(); return; }
        next = acts[0];
      }
      o.seq = next.seq;
      applyAct(next);   // 끝나면 afterApply → 다음 행동
    },
    /** 난전에서는 화면의 주인공이 항상 나 (내 조준은 내 화면 값 유지) */
    brawlView() {
      const o = S.online;
      if (!brawl() || !o) return;
      const me = S.players[o.mySeat];
      S.turn = me ? o.mySeat : Math.max(0, S.players.findIndex(q => q.alive));
      if (me && S.localAim != null) me.ang = S.localAim;
    },
    submit(a) {
      const o = S.online;
      if (brawl()) { this.brawlSubmit(a); return; }
      if (o.host) { this.accept(a); return; }
      const req = { ...a, seq: o.seq + 1, n: Date.now() % 1e9 };
      this.myReq = req;
      S.phase = 'busy';
      renderAll();
      this.room.presence({ req }).catch(() => {});
      // 방장이 못 받았으면 두 번까지 다시 보낸다
      let tries = 0;
      const retry = () => {
        if (!S.online || S.online.seq >= req.seq) return;
        if (++tries > 2) { S.phase = 'choose'; renderAll(); toast('방장에게 전달되지 않았어요. 다시 해 주세요.', 3000); return; }
        req.n = Date.now() % 1e9;
        this.room.presence({ req: { ...req } }).catch(() => {});
        setTimeout(retry, 5000);
      };
      setTimeout(retry, 5000);
    },

    /** 방장: AI 자리의 행동을 그 자리 이름으로 줄에 세운다 */
    botSubmit(a, seat) {
      this.queue = this.queue || [];
      this.queue.push({ ...a, actor: seat, n: 1 + Math.floor(Math.random() * 1e9) });
      this.pump();
    },
    brawlSubmit(a) {
      const o = S.online;
      const n = 1 + Math.floor(Math.random() * 1e9);
      S.myBusy = true;
      renderTurn();
      if (o.host) {
        this.queue = this.queue || [];
        this.queue.push({ ...a, actor: o.mySeat, n });
        this.pump();
        return;
      }
      const req = { ...a, actor: o.mySeat, n };
      this.myReq = req;
      this.room.presence({ req }).catch(() => {});
      // 방장이 못 받았으면 같은 요청을 다시 보낸다 (방장은 같은 번호를 한 번만 처리)
      let tries = 0;
      const retry = () => {
        if (!S.online || !S.myBusy) return;
        if (++tries > 3) { S.myBusy = false; renderTurn(); toast('방장에게 전달되지 않았어요. 다시 해 주세요.', 3000); return; }
        this.room.presence({ req: { ...req, r: tries } }).catch(() => {});
        setTimeout(retry, 5000);
      };
      setTimeout(retry, 6000);
    },

    // ---------- 공통 ----------
    enterGame() {
      const o = S.online;
      S.timer = o.timer;
      S.maxHp = o.hp || DEFAULT_HP;
      S.players = o.seats.map((x, i) => makePlayer(i, x.n, o.seats.length, !!x.b));
      S.mode = o.mode === 'brawl' ? 'brawl' : 'turn';
      S.exp = !!o.exp;
      S.obst = new Map();
      S.zoneSeq = 0; S.zoneSeq0 = 0;
      S.myBusy = false; S.lockUntil = 0; S.localAim = null;
      S.turn = 0; S.round = 1; S.pos = 0; S.extra = false; S.extraActive = false;
      el.pieces.innerHTML = '';
      el.log.innerHTML = '';
      el.setup.classList.add('hidden');
      el.lobby.classList.add('hidden');
      $('#btnLeave').hidden = false;
      if (o.mySeat < 0) log('👀 관전 중이에요. (자리가 다 찼어요)');
    },
    onPeers() {
      const o = S.online;
      if (!o) return;
      // 심장박동(hb)만 바뀐 알림이면 화면을 다시 그리지 않는다 (버튼이 계속 새로 그려져 눌리지 않는 문제 방지)
      this.trackPeers();
      const sig = JSON.stringify(this.peersInRoom().map(p => { const { hb, ...rest } = p.presence; return [this.keyOf(p), rest]; }));
      if (sig === this.lastSig) return;
      this.lastSig = sig;
      if (o.host) {
        if (o.phase === 'lobby') {
          let changed = false;
          const here = this.peersInRoom();
          for (const p of here) {
            if (p.presence.role !== 'guest' || !p.presence.join) continue;
            const k = this.keyOf(p);
            const seat = o.seats.find(x => x.k === k);
            const n = cleanText(p.presence.nick, 10) || '플레이어';
            if (seat) { if (seat.n !== n) { seat.n = n; changed = true; } }
            else if (o.seats.length < MAX_PLAYERS) { o.seats.push({ k, n }); changed = true; }
            else {
              // 자리가 다 찼어도 AI 자리가 있으면 사람에게 내준다
              const bi = o.seats.map(x => !!x.b).lastIndexOf(true);
              if (bi > 0) { o.seats[bi] = { k, n }; changed = true; }
            }
          }
          // 로비에서 나간 사람은 자리에서 뺀다
          const keys = new Set(here.map(p => this.keyOf(p)));
          const kept = o.seats.filter((x, i) => i === 0 || x.b || keys.has(x.k));
          if (kept.length !== o.seats.length) { o.seats = kept; changed = true; }
          if (changed) this.publish();
          renderLobby();
        } else {
          this.trackPeers();
          if (this.maybeDemote()) return;
          this.hostScan();
          if (!S.applying) { renderPlayers(); renderTurn(); this.followAim(); }
        }
      } else {
        this.guestSync();
        if (o.phase === 'game' && !S.applying) { renderPlayers(); renderTurn(); this.followAim(); }
      }
      renderSpectate();
    },
    afterApply() {
      const o = S.online;
      if (!o) return;
      if (o.host) { this.publishSaveOnly(); this.hostScan(); if (brawl()) this.pump(); }
      else this.processPending();
    },
    publishSaveOnly() {
      const o = S.online;
      store.set(HOST_SAVE, { code: o.code, nick: this.nick, seats: o.seats, phase: o.phase, seq: o.seq, timer: o.timer, mode: o.mode, hp: o.hp, exp: o.exp ? 1 : 0, cur: snapshot(), at: Date.now() });
    },
    leave() {
      if (this.room) {
        this.room.presence({ app: null, room: null, role: null, seats: null, base: null, act: null, req: null, doing: null, join: null, ph: null, seq: null }).catch(() => {});
      }
      if (S.online && S.online.host) store.del(HOST_SAVE);
      if (this.mode === 'relay' && this.room) { this.room.close(); this.room = null; this.roomCode = null; }
      S.online = null;
      closeModal();
      el.lobby.classList.add('hidden');
      $('#btnLeave').hidden = true;
      $('#btnRestore').hidden = true;
      S.phase = 'setup';
      S.players = PRESETS.slice(0, 3).map((p, i) => makePlayer(i, p.name, 3));
      el.pieces.innerHTML = '';
      renderAll();
      el.setup.classList.remove('hidden');
    },
  };

  // ---------- 대기실 화면 ----------
  function showLobby() {
    el.setup.classList.add('hidden');
    el.lobby.classList.remove('hidden');
    renderLobby();
  }
  function renderLobby(message) {
    const o = S.online;
    if (!o || o.phase === 'game') return;
    const link = Net.inviteLink(o.code);
    const seats = [...Array(MAX_PLAYERS).keys()].map(i => {
      const x = o.seats[i];
      const pr = PRESETS[i];
      const me = x && (o.host ? i === 0 : x.k === Net.myKey());
      return `<li class="seat ${x ? 'filled' : ''}" style="--pc:${pr.color}">
        <span class="seat-emoji">${x ? pr.emoji : '·'}</span>
        <span class="seat-name">${x ? esc(x.n) : '빈 자리'}</span>
        ${x && i === 0 ? '<span class="chip host">방장</span>' : ''}${me ? '<span class="chip me">나</span>' : ''}${x && x.b ? '<span class="chip bot">AI</span>' : ''}
        ${o.host && x && x.b ? `<button class="seat-x" data-unbot="${i}" aria-label="AI 빼기">✕</button>` : ''}
        ${o.host && !x && i === o.seats.length ? '<button class="seat-add" id="btnAddBot">🤖 AI 넣기</button>' : ''}
      </li>`;
    }).join('');
    const waitingHost = !o.host && o.phase === 'joining';
    const full = !o.host && o.phase === 'lobby' && o.mySeat < 0;
    el.lobby.innerHTML = `
      <div class="card small lobby-card">
        <p class="eyebrow">온라인 사설방</p>
        <div class="room-code" aria-label="방 코드">${o.code.split('').map(c => `<span>${c}</span>`).join('')}</div>
        ${o.host ? `
          <label class="field-label" for="inviteLink">초대 링크 (친구에게 보내면 코드가 자동으로 입력돼요)</label>
          <div class="copy-row"><input id="inviteLink" readonly value="${esc(link)}"><button id="btnCopy">복사</button></div>` : ''}
        ${o.host ? `
          <div class="mode-pick" role="group" aria-label="게임 모드">
            <button data-mode="turn" class="${o.mode !== 'brawl' ? 'sel' : ''}"><b>🎲 턴제</b><small>한 명씩 차례대로</small></button>
            <button data-mode="brawl" class="${o.mode === 'brawl' ? 'sel' : ''}"><b>🔥 난전</b><small>턴 없이 동시에, 맞히는 대로 행동</small></button>
          </div>
          <div class="hp-row" id="lobbyHp"></div>
          <label class="check exp-check"><input type="checkbox" id="lobbyExp" ${o.exp ? 'checked' : ''}> 🧪 실험 모드 <small>돌·상자 장애물 + 자기장 축소</small></label>` : `<p class="lobby-mode">모드: <b>${o.mode === 'brawl' ? '🔥 난전 (턴 없이 동시에)' : '🎲 턴제 (차례대로)'}</b> · 시작 체력 <b>${o.hp}</b>${o.exp ? ' · <b>🧪 실험 모드</b> (장애물 + 자기장)' : ''}</p>`}
        <ul class="seats">${seats}</ul>
        <p class="lobby-msg">${message ? esc(message)
          : waitingHost ? '방을 찾는 중…'
          : full ? '자리가 다 찼어요. 게임이 시작되면 관전할 수 있어요.'
          : o.host ? (o.seats.length < 2 ? '친구가 들어오길 기다리는 중… 빈 자리에 🤖 AI 를 넣을 수도 있어요. (2~5명, 5명이면 오각형 판)' : `${o.seats.length}명 모였어요. 시작할 수 있어요. (빈 자리에 🤖 AI 를 넣을 수 있어요)`)
          : '방장이 시작하길 기다리는 중…'}</p>
        ${o.host ? `<button class="primary big" id="btnBegin" ${o.seats.length < 2 ? 'disabled' : ''}>게임 시작 ▶</button>` : ''}
        <button class="ghost wide" id="btnLobbyLeave">나가기</button>
      </div>`;
    const copy = $('#btnCopy');
    if (copy) {
      copy.onclick = () => {
        const inp = $('#inviteLink');
        const done = () => { copy.textContent = '복사됨'; setTimeout(() => { copy.textContent = '복사'; }, 1500); };
        const fallback = () => { inp.focus(); inp.select(); toast('링크를 길게 눌러 복사하세요'); };
        try { navigator.clipboard.writeText(link).then(done, fallback); } catch (e) { fallback(); }
      };
    }
    const begin = $('#btnBegin');
    if (begin) begin.onclick = () => Net.startGame();
    const addBot = $('#btnAddBot');
    if (addBot) {
      addBot.onclick = () => {
        if (o.seats.length >= MAX_PLAYERS) return;
        const used = new Set(o.seats.map(x => x.n));
        const n = BOT_NAMES.find(b => !used.has(b)) || 'AI';
        o.seats.push({ k: 'bot:' + newSeed(), n, b: 1 });
        Net.publish();
        renderLobby();
      };
    }
    el.lobby.querySelectorAll('[data-unbot]').forEach(b => {
      b.onclick = () => { o.seats.splice(+b.dataset.unbot, 1); Net.publish(); renderLobby(); };
    });
    el.lobby.querySelectorAll('[data-mode]').forEach(b => {
      b.onclick = () => { o.mode = b.dataset.mode; Net.publish(); renderLobby(); };
    });
    const lx = $('#lobbyExp');
    if (lx) lx.onchange = () => { o.exp = lx.checked; store.set('pdeb-exp', o.exp ? 1 : 0); Net.publish(); renderLobby(); };
    const lh = $('#lobbyHp');
    if (lh) S.renderHpPicker(lh, o.hp, h => { o.hp = h; store.set('pdeb-hp', h); Net.publish(); renderLobby(); });
    $('#btnLobbyLeave').onclick = () => Net.leave();
  }

  // ------------------------------------------------------------------
  //  규칙
  // ------------------------------------------------------------------
  function showRules() {
    const wasOpen = !el.modal.classList.contains('hidden');
    if (wasOpen) return;
    const c = openModal(`
      <div class="rules">
        <h2>📖 게임 규칙</h2>
        <p class="muted">8×8 체스판(5명이면 오각형 판) 위에서 2~5명이 싸우는 게임입니다. 마지막까지 살아남으면 승리! (시작 체력은 게임 전에 ${HP_CHOICES.join(' / ')} 중에서 골라요)</p>
        <h3>턴 진행</h3>
        <ul>
          <li>첫 차례에 <b>증강</b>을 고릅니다. 무작위 공격 스타일 ${OFFER_N}개 중 하나를 골라 게임 끝까지 씁니다.</li>
          <li><b>🤖 AI</b>: 한 기기 모드는 자리마다 👤/🤖 를 눌러, 온라인은 방장이 대기실 빈 자리에 <b>🤖 AI 넣기</b>로 채웁니다. AI 도 문제를 풀어(기본 85% · 심화 65% · 킬러 45% 정답) 공격·이동·랜덤박스를 해요.</li>
          <li><b>조준은 무료</b>입니다. 판 위의 칸을 누르면 그 칸을 조준하고, 버튼으로 5°·15°씩 미세 조정할 수 있어요.</li>
          <li>공격·이동·랜덤박스 중 하나를 고르고, <b>과목</b>(공통·미적분·확률과 통계·기하)과 <b>난이도</b>(기본·심화·🔥킬러)를 골라 문제를 풉니다. 맞히면 실행, 틀리면 턴 종료.</li>
          <li><b>턴제</b>: 항상 1번 → 2번 → … 순서대로 돌아가요. 1라운드는 <b>준비 라운드</b>라 공격할 수 없고(이동·랜덤박스·증강만), 추가 행동으로는 공격할 수 없어요.</li>
          <li><b>🔥 난전</b> (온라인): 턴 없이 모두 동시에 문제를 풀고, 맞히는 대로 바로 행동해요. 오답이면 ${BRAWL_LOCK_MS / 1000}초 동안 쉬어요. 방장이 대기실에서 모드를 골라요.</li>
          <li><b>🪙 동전 칸</b>: 판에 동전 칸이 ${COIN_COUNT}개 있어요. 문제를 맞히고 그 칸으로 이동하면 동전을 던져, 앞면이면 살아 있는 모두의 위치가 무작위로 섞여요. 쓴 동전 칸은 다른 곳으로 옮겨 가요.</li>
          <li><b>온라인 관전</b>: 다른 사람 차례에는 그 사람이 고르는 과목·문제·답이 내 화면에도 실시간으로 보여요.</li>
          <li><b>점수</b>: 정답마다 기본 100점 / 심화 200점 / 킬러 300점 + 속도 보너스(최대 100점). <b>⚡ 빠른 정답</b>(제한 시간 1/3 안)이면 공격 피해 +10, 이동 범위 +1칸, 랜덤박스 꽝 없음.</li>
        </ul>
        <h3>행동</h3>
        <table>
          <tr><th>행동</th><th>기본</th><th>심화</th><th>킬러</th></tr>
          <tr><td>⚔️ 공격 — 고른 증강 스타일로 공격</td><td colspan="3">스타일별 (아래 표)</td></tr>
          <tr><td>👣 이동 — 킹처럼 가로·세로·대각선 어느 방향이든, 표시된 빈 칸을 눌러 이동</td><td>${MOVE_RANGE.easy}칸</td><td>${MOVE_RANGE.hard}칸</td><td>${MOVE_RANGE.killer}칸</td></tr>
          <tr><td>🎁 랜덤박스 — ${BOX.map(b => `${b.icon} ${b.name}(${b.desc})`).join(' · ')}</td><td>전체</td><td>꽝 없음</td><td>꽝 없음 + 효과 2개</td></tr>
        </table>
        <h3>증강 (공격 스타일)</h3>
        <table>
          <tr><th>스타일</th><th>기본</th><th>심화</th><th>킬러</th></tr>
          ${STYLE_KEYS.map(k => `<tr><td>${STYLES[k].icon} <b>${STYLES[k].name}</b> — ${STYLES[k].desc}</td><td>${STYLES[k].dmg.easy}</td><td>${STYLES[k].dmg.hard}</td><td>${styleDmg(STYLES[k], 'killer')}</td></tr>`).join('')}
        </table>
        <h3>온라인 사설방</h3>
        <ul>
          <li>방장이 <b>방 만들기</b>를 누르면 4자리 방 코드와 초대 링크가 나옵니다. 친구는 로그인 없이 링크만 열면 되고, 코드가 자동으로 채워져요.</li>
          <li>2~5명이 모이면 방장이 시작합니다 (5명이면 오각형 판). 자리가 찬 뒤 들어온 사람은 관전합니다.</li>
          <li>각자 자기 기기에서 자기 차례에만 문제를 풉니다. 방장이 페이지를 닫으면 게임이 멈추고, 방장이 같은 기기에서 다시 열어 <b>진행 중이던 방 다시 열기</b>를 누르면 이어집니다.</li>
        </ul>
        <h3>문제 범위</h3>
        <ul>
          <li><b>📘 공통 (수학Ⅰ·Ⅱ)</b>: 지수·로그, 삼각함수, 수열(등차·등비·∑·귀납적 정의), 다항함수의 극한·미분·적분</li>
          <li><b>∫ 미적분</b>: 여러 가지 함수의 극한·미분(몫·합성·역함수·음함수·매개변수), 급수, 치환·부분적분, 변곡점</li>
          <li><b>🎲 확률과 통계</b>: 순열·조합·중복조합, 이항정리, 확률·조건부확률·독립시행, 이항분포, 정규분포</li>
          <li><b>📐 기하</b>: 포물선·타원·쌍곡선, 벡터의 크기·내적·사잇각, 공간좌표, 구, 정사영</li>
        </ul>
        <h3>단축키</h3>
        <ul><li>문제: 1~4 · 과목: Q W E R · 난이도: 1/2/3 · 증강: 1~3 · 조준: ← → (Shift: 15°) · 전체 보기: V · 전체 음소거: M (🔊 버튼으로 음악·시스템·게임 음량 따로)</li></ul>
        <p></p>
        <button class="primary full">닫기</button>
      </div>`);
    c.querySelector('.primary').onclick = closeModal;
    S.keyHandler = e => { if (e.key === 'Escape') closeModal(); };
  }

  // ------------------------------------------------------------------
  //  키보드
  // ------------------------------------------------------------------
  function onKey(e) {
    if (e.target.tagName === 'INPUT') return;
    // M: 전체 음소거 (어느 화면에서든)
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) { loadSound(); SOUND.master = !SOUND.master; applySound(); toast(SOUND.master ? '🔇 전체 음소거' : '🔊 소리 켜짐'); return; }
    if (!el.modal.classList.contains('hidden')) {
      if (S.keyHandler) S.keyHandler(e);
      return;
    }
    if (!el.handover.classList.contains('hidden') || !el.lobby.classList.contains('hidden')) return;
    if (e.key === 'v' || e.key === 'V') toggleView();
    if (S.phase === 'choose' && myTurn()) {
      const step = e.shiftKey ? 15 : 5;
      if (e.key === 'ArrowLeft') { e.preventDefault(); setAim(cur().ang - step); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setAim(cur().ang + step); }
    }
  }

  // 밸런스 시뮬레이션용 (주소에 ?sim 이 있을 때만): AI 끼리 스타일을 정해 붙이고 결과를 읽는다
  if (/[?&]sim\b/.test(location.search)) {
    window.__sim = {
      styles: Object.keys(STYLES),
      start(styles, hp = DEFAULT_HP, exp = false) {
        if ($('#optExp')) $('#optExp').checked = !!exp;
        S.localCount = styles.length;
        S.localBots = new Set(styles.map((_, i) => i));
        S.maxHp = hp;
        $('#optTimer').checked = false;
        startGame();
        S.players.forEach((p, i) => { p.style = styles[i]; });
      },
      /** 테스트용: i 번 말을 (x, y) 에 두고 ang 방향으로, 지금 공격하면 누가 몇 번 맞는지 */
      place(i, x, y, ang) { const p = S.players[i]; p.x = x; p.y = y; if (ang != null) { p.ang = ang; p.aimBase = ang; } renderAll(); },
      hits(i) {
        const p = S.players[i], plan = planAttack(p, p.style, null), out = {};
        for (const r of plan.rays) for (const h of r.hits) (out[h.q.name] = out[h.q.name] || []).push(h.bounces);
        for (const [x, y] of plan.cells) { const q = at(x, y); if (q) (out[q.name] = out[q.name] || []).push('cell'); }
        return out;
      },
      /** 테스트용: i 번 말이 지금 실제로 공격 (심화, 빠른 정답 아님) */
      async attack(i, power = false, target = null) { const p = S.players[i]; p.power = power; await doAttack(p, 'hard', false, target); return S.players.map(q => ({ name: q.name, hp: q.hp, x: q.x, y: q.y })); },
      obst: () => [...S.obst.values()].map(o => ({ kind: o.kind, x: o.x, y: o.y, hp: o.hp })),
      zone: () => ({ lvl: zoneLevel(), soon: zoneSoon(), inZone: S.players.map(p => inZone(p.x, p.y)) }),
      setRound(r) { S.round = r; renderAll(); },
      setObst(list) { S.obst = new Map(list.map(([kind, x, y], i) => [x + ',' + y, { kind, x, y, hp: kind === 'crate' ? CRATE_HP : Infinity, i }])); renderObstacles(); },
      state() {
        return { phase: S.phase, round: S.round,
          players: S.players.map(p => ({ style: p.style, hp: p.hp, alive: p.alive, x: p.x, y: p.y, poison: p.poison || 0, shield: !!p.shield, dealt: p.dealt || 0, atk: p.atk || 0, landed: p.landed || 0 })) };
      },
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
