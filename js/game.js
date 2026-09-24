/*
 * ∂ 미분 배틀 — 자유 조준 · 칸 이동 · 증강(공격 스타일) · 4과목 문제
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
  const N = 8;
  // 0=북(화면 위) 부터 시계 방향 45° 간격
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const DIR_NAMES = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const TILT = 52;          // 플레이어 시점 카메라 기울기
  const TOP_TILT = 14;      // 전체 보기 기울기
  const MAX_HP = 120;
  const POWER_MULT = 1.5;   // 강화탄 배율 (한 방에 끝나지 않도록 2배 → 1.5배)
  const BUMP_DMG = 10;

  const MAX_PLAYERS = 4;
  const PRESETS = [
    { name: '레드', color: '#ff5a5f', emoji: '🦊' },
    { name: '블루', color: '#4d8dff', emoji: '🐧' },
    { name: '그린', color: '#35d07f', emoji: '🐸' },
    { name: '퍼플', color: '#b57bff', emoji: '🐙' },
  ];
  // 인원수별 시작 칸: 서로 같은 줄·대각선·나이트 칸에 겹치지 않는 바람개비 배치
  const LAYOUTS = {
    2: [[1, 7], [6, 0]],
    3: [[1, 7], [7, 5], [3, 0]],
    4: [[1, 7], [7, 6], [6, 0], [0, 1]],
  };


  // 정답 점수 = 난이도 점수 + 속도 점수(남은 시간 비율 × 100)
  const LEVELS = {
    easy: { label: '기본', desc: '교과서 · 모의고사 기본', time: 45, pts: 100 },
    hard: { label: '심화', desc: '수능 상위권 유형', time: 90, pts: 200 },
  };
  const FAST_RATIO = 1 / 3;   // 제한 시간의 1/3 안에 맞히면 ⚡ 빠른 정답 (행동 강화)
  const FAST_DMG = 10;
  const CAT_KEYS = ['common', 'calc', 'prob', 'geo'];
  const CAT_ICONS = { common: '📘', calc: '∫', prob: '🎲', geo: '📐' };
  const catInfo = k => (window.MathProblems && window.MathProblems.CATS[k]) || { name: k, sub: '' };
  /** 1라운드는 준비 라운드: 공격 불가 (선공 이점 완화) */
  const prepRound = () => S.round === 1;
  /** 라운드마다 시작 순서를 한 칸씩 돌린다: A B C → B C A → C A B */
  function orderFor(round) {
    const n = S.players.length;
    const base = [...Array(n).keys()];
    const k = (round - 1) % n;
    return base.slice(k).concat(base.slice(0, k));
  }

  const BOX = [
    { id: 'heal',   icon: '💚', name: '회복',     desc: 'HP +25',                  w: 3 },
    { id: 'shield', icon: '🛡️', name: '방패',     desc: '다음 피해 1회 무효',       w: 3 },
    { id: 'power',  icon: '💥', name: '강화탄',   desc: '다음 공격 피해 1.5배',     w: 3 },
    { id: 'bolt',   icon: '⚡', name: '번개',     desc: '무작위 적 1명에게 20 피해', w: 3 },
    { id: 'meteor', icon: '☄️', name: '유성우',   desc: '모든 적에게 10 피해',      w: 2 },
    { id: 'tele',   icon: '🌀', name: '순간이동', desc: '무작위 빈 칸으로 이동',     w: 2 },
    { id: 'swap',   icon: '🔁', name: '위치 교환', desc: '무작위 적과 자리 바꾸기',  w: 2 },
    { id: 'again',  icon: '⏩', name: '추가 행동', desc: '이번 턴에 한 번 더 행동',  w: 2 },
    { id: 'bomb',   icon: '💣', name: '꽝! 폭탄', desc: '자신이 15 피해',           w: 2, bad: true },
  ];

  // ------------------------------------------------------------------
  //  상태
  // ------------------------------------------------------------------
  const S = {
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
  const inB = (x, y) => x >= 0 && x < N && y >= 0 && y < N;
  const coord = (x, y) => 'ABCDEFGH'[x] + (N - y);
  const cur = () => S.players[S.turn];
  const alive = () => S.players.filter(p => p.alive);
  const enemies = p => S.players.filter(q => q.alive && q !== p);
  const at = (x, y, except) => S.players.find(p => p.alive && p !== except && p.x === x && p.y === y) || null;
  const dirIdx = (dx, dy) => DIRS.findIndex(d => d[0] === dx && d[1] === dy);
  const myTurn = () => !S.online || S.online.mySeat === S.turn;
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

    // 체스판 칸
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = document.createElement('div');
        c.className = 'cell' + ((x + y) % 2 ? ' dark' : '');
        c.dataset.x = x; c.dataset.y = y;
        if (y === N - 1) c.insertAdjacentHTML('beforeend', `<span class="coord file">${'ABCDEFGH'[x]}</span>`);
        if (x === 0) c.insertAdjacentHTML('beforeend', `<span class="coord rank">${N - y}</span>`);
        el.cells.appendChild(c);
      }
    }

    // 시작 화면
    $('#setupPlayers').innerHTML = `
      <div class="count-row" role="group" aria-label="인원">
        <span>인원</span>${[2, 3, 4].map(n => `<button class="count-btn" data-n="${n}">${n}명</button>`).join('')}
      </div>` + PRESETS.map((p, i) => `
      <div class="setup-row" style="--pc:${p.color}" data-row="${i}">
        <span>${p.emoji}</span>
        <input id="pname${i}" maxlength="10" value="${p.name}" aria-label="플레이어 ${i + 1} 이름">
      </div>`).join('');
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
    $('#btnStart').onclick = startGame;
    $('#btnRules').onclick = showRules;
    $('#btnRules2').onclick = showRules;
    $('#btnView').onclick = toggleView;
    $('#btnLeave').onclick = () => Net.leave();
    el.cells.addEventListener('click', e => {
      const c = e.target.closest('.cell');
      if (c) { onCellClick(+c.dataset.x, +c.dataset.y); return; }
      // 3D 로 세운 말이 판 평면을 가르면 브라우저가 칸 대신 판(.cells)을 돌려줄 때가 있다.
      // 이때는 판 기준 좌표(offsetX/Y, 변환 전 좌표계)로 칸을 계산한다.
      if (e.target === el.cells) {
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

  /** i 번째 플레이어 (전체 n명). 처음에는 판 가운데를 바라본다 */
  function makePlayer(i, name, n) {
    const p = PRESETS[i];
    const [x, y] = (LAYOUTS[n] || LAYOUTS[3])[i];
    const ang = Math.round(normAng(Math.atan2(3.5 - x, -(3.5 - y)) * 180 / Math.PI) / 5) * 5;
    return { id: i, name, color: p.color, emoji: p.emoji, x, y, ang, style: null,
      hp: MAX_HP, alive: true, shield: false, power: false, correct: 0, tries: 0, score: 0 };
  }

  function startGame() {
    S.online = null;
    const n = S.localCount || 3;
    S.players = PRESETS.slice(0, n).map((p, i) => makePlayer(i, ($(`#pname${i}`).value || p.name).trim() || p.name, n));
    S.timer = $('#optTimer').checked;
    S.turn = 0; S.round = 1; S.pos = 0; S.extra = false; S.extraActive = false;
    S.gseed = newSeed();
    el.pieces.innerHTML = '';
    el.log.innerHTML = '';
    el.setup.classList.add('hidden');
    log('🎮 게임 시작! 첫 차례에 증강(공격 스타일)을 고르세요.');
    renderAll();
    showHandover();
  }

  function layout() {
    const r = el.stage.getBoundingClientRect();
    S.cell = Math.max(30, Math.min(88, Math.floor(Math.min(r.width / 11.3, r.height / 7.4))));
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
    renderTurn();
    renderGuide();
    updateCamera();
    el.roundInfo.textContent = S.phase === 'setup' ? ''
      : `라운드 ${S.round}${prepRound() ? ' (준비 · 공격 불가)' : ''} · 순서 ${orderFor(S.round).filter(i => S.players[i] && S.players[i].alive).map(i => S.players[i].emoji).join('→')}`;
    renderSpectate();
  }

  function renderPlayers() {
    el.playerList.innerHTML = S.players.map(p => `
      <div class="pcard ${p === cur() && S.phase !== 'over' ? 'active' : ''} ${p.alive ? '' : 'dead'}" style="--pc:${p.color}">
        <span class="pemoji">${p.emoji}</span>
        <div class="pinfo">
          <div class="pname">${esc(p.name)}${S.online && S.online.mySeat === p.id ? ' <span class="chip me">나</span>' : ''} ${p.shield ? '🛡️' : ''}${p.power ? '💥' : ''}${S.online && !Net.seatOnline(p.id) ? ' <span class="chip off">연결 끊김</span>' : ''}</div>
          <div class="hp"><div class="hp-fill" style="width:${p.hp / MAX_HP * 100}%"></div></div>
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
      node.classList.toggle('current', p === cur() && ['choose', 'rotate', 'busy'].includes(S.phase));
      node.classList.toggle('dead', !p.alive);
      node.querySelector('.mini-hp i').style.width = (p.hp / MAX_HP * 100) + '%';
      node.querySelector('.badges').textContent = (p.shield ? '🛡️' : '') + (p.power ? '💥' : '');
    }
  }

  function renderTurn() {
    const p = cur();
    if (!p || S.phase === 'setup' || S.phase === 'over' || S.phase === 'handover') {
      el.turnPanel.innerHTML = S.phase === 'handover' ? '<p class="muted">차례를 넘기는 중…</p>' : '';
      return;
    }
    const head = `
      <div class="turn-head" style="--pc:${p.color}">
        <span class="big">${p.emoji}</span>
        <div><b>${esc(p.name)}</b> 차례 ${S.extraActive ? '<span class="chip extra">⏩ 추가 행동</span>' : ''}<br>
        <small>${coord(p.x, p.y)} · 조준 ${Math.round(p.ang)}° ${p.style ? `· ${STYLES[p.style].icon} ${STYLES[p.style].name}` : ''}</small></div>
      </div>`;

    if (!myTurn()) {
      const doing = Net.seatStatus(S.turn);
      el.turnPanel.innerHTML = head + `
        <div class="waiting">
          <span class="dots"><i></i><i></i><i></i></span>
          <span>${S.phase === 'busy' && S.applying ? '행동 진행 중…' : doing ? esc(doing) : `${esc(p.name)} 님이 고르는 중…`}</span>
        </div>
        <p class="hint">내 차례가 되면 여기에 행동 버튼이 나타나요.</p>`;
      return;
    }

    const dis = S.phase !== 'choose' ? 'disabled' : '';
    const btn = (k, cls = '') => {
      const a = actionInfo(k, p);
      return `<button class="act ${cls}" data-a="${k}" ${dis}><span class="ai">${a.icon}</span><span><b>${a.name}</b><br><small>${a.sub}</small></span></button>`;
    };
    el.turnPanel.innerHTML = head + `
      <div class="aim-box">
        <div class="aim-row"><b>🧭 조준 ${Math.round(p.ang)}°</b><span class="chip free-chip">무료</span></div>
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
      <p class="hint">공격·이동·랜덤박스는 <b>문제를 맞혀야</b> 실행됩니다. 오답이면 그대로 턴 종료!<br>
      판 위 점선·네모는 지금 공격하면 닿는 곳, 빨간 원은 맞는 적이에요.</p>`;
    el.turnPanel.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => onAction(b.dataset.a); });
    el.turnPanel.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => setAim(p.ang + Number(b.dataset.r)); });
  }

  // ---------------- 관전 카드: 상대 차례에 상대가 보는 화면을 그대로 ----------------
  function renderSpectate() {
    const box = el.spectate;
    if (!box) return;
    const p = cur();
    const L = S.online && p && !myTurn() && ['choose', 'busy'].includes(S.phase) && !S.applying ? Net.seatLive(S.turn) : null;
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

  /** 폴리라인 경로를 따라 탄환을 날린다. events: [{ d: 이동거리, fn }] 은 탄환이 d 지점을 지날 때 실행 */
  function animatePath(pts, color, speed = 11, events = []) {
    return new Promise(resolve => {
      const line = svg('polyline', { class: 'shot', stroke: color, points: '' });
      const ball = svg('circle', { class: 'bullet', r: 0.15, fill: color });
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
        line.setAttribute('points', out.map(q => q.join(',')).join(' '));
        ball.setAttribute('cx', head[0]);
        ball.setAttribute('cy', head[1]);
        for (const e of events) if (!e.done && e.d <= d) { e.done = true; e.fn(); }
        if (d < total) requestAnimationFrame(frame);
        else {
          // 끝점에서 부동소수 오차로 남은 적중이 있으면 마저 처리
          for (const e of events) if (!e.done) { e.done = true; e.fn(); }
          ball.remove();
          setTimeout(() => { line.classList.add('fade'); setTimeout(() => line.remove(), 650); }, 250);
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
    S.phase = 'handover';
    const p = cur();
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
      if (pos >= n) { pos = 0; round++; }
      id = orderFor(round)[pos];
      // 죽은 사람은 건너뛰고, 라운드가 바뀌며 같은 사람이 연달아 두 번 하지 않게 한다
      if (S.players[id].alive && (id !== S.turn || aliveCount < 2)) break;
    }
    S.pos = pos; S.round = round; S.turn = id;
    await sleep(350);
    if (S.online) startOnlineTurn();
    else showHandover();
  }

  function startOnlineTurn() {
    S.phase = 'choose';
    renderAll();
    const p = cur();
    toast(myTurn() ? '🔔 내 차례!' : `${p.emoji} ${p.name} 차례`);
    maybeAugment();
  }

  function checkWin() {
    const left = alive();
    if (left.length > 1) return false;
    S.phase = 'over';
    renderAll();
    const w = left[0];
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
  const STYLES = {
    sniper:   { icon: '🎯', name: '저격', desc: '조준 방향으로 직선 발사. 처음 맞는 적에게 피해', aim: true, dmg: { easy: 30, hard: 40 } },
    shotgun:  { icon: '💥', name: '산탄', desc: '조준 방향 ±20° 세 갈래, 사거리 4칸. 겹쳐 맞으면 누적', aim: true, dmg: { easy: 15, hard: 20 } },
    ricochet: { icon: '🌀', name: '도탄', desc: '조준 방향으로 쏘면 벽에 3번 튕기며 관통. 튕긴 탄에 자신도 맞을 수 있음', aim: true, dmg: { easy: 20, hard: 28 } },
    bishop:   { icon: '✖️', name: '비숍', desc: '대각선 4방향 동시 발사. 방향마다 첫 번째 적', dmg: { easy: 20, hard: 28 } },
    rook:     { icon: '➕', name: '룩', desc: '가로·세로 4방향 동시 발사. 방향마다 첫 번째 적', dmg: { easy: 20, hard: 28 } },
    knight:   { icon: '🐴', name: '나이트', desc: '나이트가 갈 수 있는 L자 칸 8곳을 동시에 타격', dmg: { easy: 30, hard: 40 } },
    king:     { icon: '👑', name: '킹', desc: '주변 8칸을 강타', dmg: { easy: 35, hard: 45 } },
    mortar:   { icon: '💣', name: '박격포', desc: '5칸 안의 칸을 골라 3×3 폭발 (가장자리 60%). 범위 안이면 자신도 맞음', target: true, dmg: { easy: 25, hard: 35 } },
    scatter:  { icon: '🎲', name: '난사', desc: '무작위 좌표로 발사, 벽에 3번 튕기며 관통. 운에 맡기는 한 방', dmg: { easy: 30, hard: 40 } },
  };
  const STYLE_KEYS = Object.keys(STYLES);
  const OFFER_N = 3;
  const MOVE_RANGE = { easy: 2, hard: 3 };
  const MORTAR_RANGE = 5;

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
      return { icon: s.icon, name: `공격 · ${s.name}`, sub: s.desc, easy: `피해 ${s.dmg.easy}`, hard: `피해 ${s.dmg.hard}`, fast: '피해 +10' };
    }
    if (key === 'move') {
      return { icon: '👣', name: '이동', sub: '원하는 칸으로 (킹처럼 가로·세로·대각선)', easy: `${MOVE_RANGE.easy}칸 이내`, hard: `${MOVE_RANGE.hard}칸 이내`, fast: '이동 범위 +1칸' };
    }
    return { icon: '🎁', name: '랜덤박스', sub: '무작위 효과 획득', easy: '모든 효과 (꽝 포함)', hard: '꽝 없음', fast: '꽝 없음' };
  }

  function maybeAugment() {
    const p = cur();
    if (!p || !p.alive || p.style || !myTurn() || S.phase !== 'choose' || S.augmentOpen) return;
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
            <em>피해 ${s.dmg.easy} · 심화 ${s.dmg.hard}</em>
          </button>`;
        }).join('')}
      </div>`, 'augment-card');
    c.querySelectorAll('[data-s]').forEach(b => {
      b.onclick = () => { closeModal(); Net.status(null); submit({ key: 'pick', style: b.dataset.s }); };
    });
    S.keyHandler = e => {
      const i = '123'.indexOf(e.key);
      const btns = c.querySelectorAll('[data-s]');
      if (i >= 0 && btns[i]) btns[i].click();
    };
  }

  // ---------------- 자유 조준 (무료) ----------------
  const vec = a => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)];
  const normAng = a => ((a % 360) + 360) % 360;
  const angTo = (p, x, y) => normAng(Math.atan2(x - p.x, -(y - p.y)) * 180 / Math.PI);

  function setAim(a) {
    if (!myTurn() || S.phase !== 'choose') return;
    cur().ang = Math.round(normAng(a) * 10) / 10;
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
        if ((dx || dy) && inB(x, y) && !at(x, y)) out.push([x, y]);
      }
    }
    return out;
  }
  function mortarCells(p) {
    const out = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= MORTAR_RANGE) out.push([x, y]);
      }
    }
    return out;
  }

  // ---------------- 행동 선택 ----------------
  async function onAction(key) {
    if (S.phase !== 'choose' || !myTurn()) return;
    const p = cur();
    if (key === 'augment') { maybeAugment(); return; }
    if (key === 'attack' && (prepRound() || S.extraActive)) return;

    const lv = await pickLevel(key);
    if (!lv) return;
    const { cat, level } = lv;
    S.phase = 'busy';
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
    Net.status(null);
    Net.live(null);
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
      if (act.key === 'restart') { restartOnline(act.seed); return; }
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
      if (act.ang != null) p.ang = act.ang;
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
        <p class="step-label">② 난이도 <span class="muted">(1 2)</span></p>
        <div class="levels">
          ${['easy', 'hard'].map(l => `
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
  function damage(t, amt, src, why) {
    if (!t.alive) return;
    if (t.shield) {
      t.shield = false;
      floatText(t, '🛡️ 방어!', 'info');
      log(`${tag(t)} 🛡️ 방패로 ${why}을(를) 막았다!`);
      renderPlayers(); renderPieces();
      return;
    }
    t.hp = Math.max(0, t.hp - amt);
    floatText(t, `-${amt}`, 'dmg');
    hitFx(t);
    const self = src === t;
    log(`${self ? '🤕' : '💢'} ${tag(t)} ${why}으로 ${amt} 피해${self ? ' (자폭!)' : ''} → HP ${t.hp}`);
    if (t.hp <= 0) {
      t.alive = false;
      log(`💀 ${tag(t)} 탈락!`);
      toast(`💀 ${t.emoji} ${t.name} 탈락!`, 2200);
    }
    renderPlayers(); renderPieces();
  }

  // ------------------------------------------------------------------
  //  공격: 광선(연속 각도) + 칸 타격
  // ------------------------------------------------------------------
  const HIT_R = 0.42;
  /** (ox, oy) 에서 각도 a 로 쏜 탄의 경로와 적중. 벽 반사, 관통, 사거리 지원 */
  function traceRay(p, ox, oy, a, { maxLen = Infinity, bounces = 0, pierce = false } = {}) {
    const EPS = 1e-9;
    let pos = [ox, oy];
    let v = vec(a);
    const pts = [pos];
    const hits = [];
    let travelled = 0, left = maxLen;
    for (let seg = 0; seg <= bounces; seg++) {
      const tX = v[0] > EPS ? (N - pos[0]) / v[0] : v[0] < -EPS ? -pos[0] / v[0] : Infinity;
      const tY = v[1] > EPS ? (N - pos[1]) / v[1] : v[1] < -EPS ? -pos[1] / v[1] : Infinity;
      const t = Math.min(tX, tY, left);
      const found = [];
      for (const q of S.players) {
        if (!q.alive || (seg === 0 && q === p) || hits.some(h => h.q === q)) continue;
        const cx = q.x + 0.5 - pos[0], cy = q.y + 0.5 - pos[1];
        const s = cx * v[0] + cy * v[1];
        if (s < 0.05 || s > t) continue;
        if (Math.hypot(cx - v[0] * s, cy - v[1] * s) < HIT_R) found.push({ q, s });
      }
      found.sort((m, n) => m.s - n.s);
      for (const f of found) {
        const hitAt = [pos[0] + v[0] * f.s, pos[1] + v[1] * f.s];
        hits.push({ q: f.q, d: travelled + f.s, bounces: seg, at: hitAt });
        if (!pierce) { pts.push(hitAt); return { pts, hits }; }
      }
      pos = [pos[0] + v[0] * t, pos[1] + v[1] * t];
      pts.push(pos);
      travelled += t;
      left -= t;
      if (left <= 1e-9 || seg === bounces) break;
      if (tX <= tY + 1e-7) v = [-v[0], v[1]];
      if (tY <= tX + 1e-7) v = [v[0], -v[1]];
    }
    return { pts, hits };
  }

  /** 공격 계획. 조준 안내선과 실제 공격이 같은 계산을 쓴다. */
  function planAttack(p, style, target) {
    const ox = p.x + 0.5, oy = p.y + 0.5;
    const rays = [], cells = [];
    const ray = (a, o) => rays.push(traceRay(p, ox, oy, a, o));
    const ring = (cx, cy, w = 1) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inB(cx + dx, cy + dy)) cells.push([cx + dx, cy + dy, dx || dy ? w : 1]);
      }
    };
    switch (style) {
      case 'sniper': ray(p.ang); break;
      case 'shotgun': [-20, 0, 20].forEach(d => ray(p.ang + d, { maxLen: 4.5 })); break;
      case 'ricochet': ray(p.ang, { bounces: 3, pierce: true }); break;
      case 'bishop': [45, 135, 225, 315].forEach(a => ray(a)); break;
      case 'rook': [0, 90, 180, 270].forEach(a => ray(a)); break;
      case 'knight':
        [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].forEach(([dx, dy]) => {
          if (inB(p.x + dx, p.y + dy)) cells.push([p.x + dx, p.y + dy, 1]);
        });
        break;
      case 'king':
        ring(p.x, p.y);
        for (let i = cells.length - 1; i >= 0; i--) if (cells[i][0] === p.x && cells[i][1] === p.y) cells.splice(i, 1);
        break;
      case 'mortar': if (target) ring(target[0], target[1], 0.6); break;
      case 'scatter': if (target) ray(angTo(p, target[0], target[1]), { bounces: 3, pierce: true }); break;
    }
    return { rays, cells };
  }

  function renderGuide() {
    clearFx('.guide, .guide-end, .guide-cell, .guide-hit');
    const p = cur();
    const on = p && p.alive && S.phase === 'choose';
    el.cells.classList.toggle('aimable', !!on && myTurn());
    if (!on || !p.style) return;
    const plan = planAttack(p, p.style, null);
    const marked = new Set();
    for (const r of plan.rays) {
      svg('polyline', { class: 'guide', points: r.pts.map(q => q.join(',')).join(' '), stroke: p.color });
      const e = r.pts[r.pts.length - 1];
      svg('circle', { class: 'guide-end', cx: e[0], cy: e[1], r: 0.09, fill: p.color });
      r.hits.forEach(h => marked.add(h.q));
    }
    for (const [x, y] of plan.cells) {
      svg('rect', { class: 'guide-cell', x: x + 0.1, y: y + 0.1, width: 0.8, height: 0.8, stroke: p.color });
      const q = at(x, y, p);
      if (q) marked.add(q);
    }
    // 이대로 쏘면 맞는 적 표시
    for (const q of marked) svg('circle', { class: 'guide-hit', cx: q.x + 0.5, cy: q.y + 0.5, r: 0.46 });
    // 위치형 스타일도 바라보는 방향(카메라)은 보이게
    if (!plan.rays.length && !plan.cells.length || !STYLES[p.style].aim) {
      const [vx, vy] = vec(p.ang);
      svg('line', { class: 'guide faint', x1: p.x + 0.5, y1: p.y + 0.5, x2: p.x + 0.5 + vx * 1.2, y2: p.y + 0.5 + vy * 1.2, stroke: p.color });
    }
  }

  async function doAttack(p, level, fast, target) {
    const s = STYLES[p.style] || STYLES.sniper;
    let dmg = s.dmg[level] + (fast ? FAST_DMG : 0);
    if (p.power) {
      dmg = Math.round(dmg * POWER_MULT);
      p.power = false;
      log(`${tag(p)} 💥 강화탄 발동! 피해 ${POWER_MULT}배`);
    }
    let tgt = target;
    if (p.style === 'scatter') {
      do { tgt = [rand(N), rand(N)]; } while (tgt[0] === p.x && tgt[1] === p.y);
    }
    let cross = null;
    if (tgt) {
      cross = svg('g', {});
      svg('circle', { class: 'crosshair', cx: tgt[0] + 0.5, cy: tgt[1] + 0.5, r: 0.35 }, cross);
      svg('line', { class: 'crosshair', x1: tgt[0] + 0.1, y1: tgt[1] + 0.5, x2: tgt[0] + 0.9, y2: tgt[1] + 0.5 }, cross);
      svg('line', { class: 'crosshair', x1: tgt[0] + 0.5, y1: tgt[1] + 0.1, x2: tgt[0] + 0.5, y2: tgt[1] + 0.9 }, cross);
      toast(`${s.icon} ${s.name} → ${coord(tgt[0], tgt[1])}`);
      await sleep(p.style === 'scatter' ? 900 : 400);
    } else {
      toast(`${s.icon} ${s.name}!`);
    }
    const plan = planAttack(p, p.style, tgt);
    let hitCount = 0;
    await Promise.all(plan.rays.map(r => animatePath(r.pts, p.color, 12, r.hits.map(h => ({
      d: h.d,
      fn: () => {
        hitCount++;
        burst(h.at[0], h.at[1], '#ff5d6c');
        damage(h.q, dmg, p, `${s.name}${h.bounces ? `(반사 ${h.bounces}회)` : ''}`);
      },
    })))));
    if (plan.cells.length) {
      if (p.style === 'mortar') await animatePath([[p.x + 0.5, p.y + 0.5], [tgt[0] + 0.5, tgt[1] + 0.5]], '#ff9f43', 10);
      for (const [x, y] of plan.cells) burst(x + 0.5, y + 0.5, p.style === 'mortar' ? '#ff9f43' : p.color);
      await sleep(250);
      for (const [x, y, w] of plan.cells) {
        const q = at(x, y);
        if (q) { hitCount++; damage(q, Math.round(dmg * w), p, s.name); }
      }
    }
    if (cross) cross.remove();
    if (!hitCount) log(`${tag(p)} ${s.icon} ${s.name}… 빗나감`);
  }

  // ------------------------------------------------------------------
  //  이동: 범위 안의 빈 칸으로 (킹처럼 8방향, 거리 = 가로·세로 중 큰 값)
  // ------------------------------------------------------------------
  async function doMove(p, dest, range) {
    if (!dest || at(dest[0], dest[1]) || Math.max(Math.abs(dest[0] - p.x), Math.abs(dest[1] - p.y)) > range) {
      log(`${tag(p)} 👣 이동할 수 없는 칸이라 제자리`);
      return;
    }
    burst(p.x + 0.5, p.y + 0.5, p.color);
    p.x = dest[0];
    p.y = dest[1];
    renderPieces();
    updateCamera();
    await sleep(450);
    burst(p.x + 0.5, p.y + 0.5, p.color);
    log(`${tag(p)} 👣 ${coord(p.x, p.y)} 로 이동`);
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
    const pool = BOX.filter(b => !((level === 'hard' || fast) && b.bad) && !(prepRound() && ['bolt', 'meteor'].includes(b.id)));
    const res = weighted(pool);
    const c = openModal(`
      <h2>🎁 랜덤박스</h2>
      <div class="roulette"><div class="slot">❔</div><div class="slot-name"></div></div>
      <div class="box-desc hidden"></div>
      <button class="primary full hidden">확인</button>`, 'small');
    const slot = c.querySelector('.slot');
    for (let i = 0; i < 16; i++) {
      slot.textContent = pool[Math.floor(Math.random() * pool.length)].icon; // 연출용 (결과와 무관)
      await sleep(55 + i * 10);
    }
    slot.textContent = res.icon;
    slot.classList.add('done');
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
      if (S.online) setTimeout(r, 1800); // 온라인: 모두의 화면이 멈추지 않도록 자동 진행
    });
    closeModal();
    log(`${tag(p)} 🎁 랜덤박스: ${res.icon} ${res.name}`);
    await applyBox(p, res);
  }

  async function applyBox(p, b) {
    const foes = enemies(p);
    switch (b.id) {
      case 'heal': {
        const before = p.hp;
        p.hp = Math.min(MAX_HP, p.hp + 25);
        floatText(p, `+${p.hp - before}`, 'heal');
        break;
      }
      case 'shield':
        p.shield = true;
        floatText(p, '🛡️', 'info');
        break;
      case 'power':
        p.power = true;
        floatText(p, '💥 x2', 'info');
        break;
      case 'bolt': {
        const t = foes[rand(foes.length)];
        if (t) {
          await animatePath([[t.x + 0.5, -1.5], [t.x + 0.5, t.y + 0.5]], '#ffe14d', 22);
          burst(t.x + 0.5, t.y + 0.5, '#ffe14d');
          damage(t, 20, p, '번개');
        }
        break;
      }
      case 'meteor':
        for (const t of foes) {
          await animatePath([[t.x - 1.5, t.y - 2.5], [t.x + 0.5, t.y + 0.5]], '#ff9f43', 18);
          burst(t.x + 0.5, t.y + 0.5, '#ff9f43');
          damage(t, 10, p, '유성우');
        }
        break;
      case 'tele': {
        const empty = [];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!at(x, y)) empty.push([x, y]);
        const [x, y] = empty[rand(empty.length)];
        burst(p.x + 0.5, p.y + 0.5, '#b18cff');
        p.x = x; p.y = y;
        renderPieces();
        await sleep(250);
        burst(x + 0.5, y + 0.5, '#b18cff');
        log(`${tag(p)} 🌀 ${coord(x, y)} 로 순간이동`);
        break;
      }
      case 'swap': {
        const t = foes[rand(foes.length)];
        if (t) {
          [p.x, p.y, t.x, t.y] = [t.x, t.y, p.x, p.y];
          burst(p.x + 0.5, p.y + 0.5, '#b18cff');
          burst(t.x + 0.5, t.y + 0.5, '#b18cff');
          log(`${tag(p)} 🔁 ${tag(t)} 와(과) 위치 교환`);
        }
        break;
      }
      case 'again':
        S.extra = true;
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
  const APP = 'pdeb2';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const HOST_SAVE = 'pdeb2-host';
  const ACT_KEYS = ['attack', 'move', 'box', 'pick', 'restart'];

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
      t: S.turn, r: S.round, o: S.pos, x: S.extraActive ? 1 : 0, g: S.gseed,
      p: S.players.map(p => [p.x, p.y, Math.round(p.ang * 10), p.hp, p.alive ? 1 : 0, p.shield ? 1 : 0, p.power ? 1 : 0, p.correct, p.tries, p.score, STYLE_KEYS.indexOf(p.style)]),
    };
  }
  function loadSnapshot(b) {
    if (!b || !Array.isArray(b.p)) return;
    S.turn = int(b.t, 0, S.players.length - 1);
    S.round = int(b.r, 1, 9999, 1);
    S.pos = int(b.o, 0, S.players.length - 1);
    S.extra = false;
    S.extraActive = !!b.x;
    S.gseed = int(b.g, 0, 2 ** 31, 1);
    b.p.forEach((a, i) => {
      const p = S.players[i];
      if (!p || !Array.isArray(a)) return;
      p.x = int(a[0], 0, N - 1); p.y = int(a[1], 0, N - 1); p.ang = int(a[2], 0, 3599) / 10;
      p.hp = int(a[3], 0, MAX_HP); p.alive = !!a[4] && p.hp > 0; p.shield = !!a[5]; p.power = !!a[6];
      p.correct = int(a[7], 0, 9999); p.tries = int(a[8], 0, 9999); p.score = int(a[9], 0, 1e7);
      p.style = STYLE_KEYS[int(a[10], -1, STYLE_KEYS.length - 1, -1)] || null;
    });
  }
  /** 다른 사람이 보낸 act 는 믿지 않고 형식을 맞춘다 */
  function cleanAct(a) {
    if (!a || !ACT_KEYS.includes(a.key)) return null;
    const act = { key: a.key, seq: int(a.seq, 0, 1e9), seed: int(a.seed, 0, 2 ** 31) };
    const cell = c => (Array.isArray(c) ? [int(c[0], 0, N - 1), int(c[1], 0, N - 1)] : null);
    if (a.key === 'pick') act.style = STYLE_KEYS.includes(a.style) ? a.style : null;
    if (['attack', 'move', 'box'].includes(a.key)) {
      act.level = a.level === 'hard' ? 'hard' : 'easy';
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
    const names = S.players.map(p => p.name);
    S.players = names.map((nm, i) => makePlayer(i, nm, names.length));
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
    const base = `pdeb2/${code}/p/`;
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
    hostPeer() { return this.peersInRoom().find(p => p.presence.role === 'host') || null; },
    peerOfSeat(i) {
      const seat = S.online && S.online.seats[i];
      if (!seat) return null;
      return this.peersInRoom().find(p => this.keyOf(p) === seat.k) || null;
    },
    seatOnline(i) {
      if (!S.online) return true;
      if (i === S.online.mySeat) return true;
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
      if (!S.online || myTurn() || S.applying || S.phase !== 'choose') return;
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
      S.online = { code, host: true, seats: [{ k: this.myKey(), n: this.nick }], mySeat: 0, phase: 'lobby', seq: 0, base: null, act: null, timer: $('#optTimer').checked };
      this.publish();
      showLobby();
    },
    async restore(h) {
      if (!(await this.connect(h.code))) return;
      this.nick = cleanText(h.nick, 10) || '방장';
      const seats = (h.seats || []).map(x => ({ k: cleanText(x.k, 60), n: cleanText(x.n, 10) }));
      if (!seats.length) return;
      seats[0].k = this.myKey();
      S.online = { code: h.code, host: true, seats, mySeat: 0, phase: h.phase === 'game' ? 'game' : 'lobby', seq: int(h.seq, 0, 1e9), base: null, act: null, timer: !!h.timer };
      if (S.online.phase === 'game') {
        this.enterGame();
        loadSnapshot(h.cur);
        S.online.base = snapshot();
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
        seats: o.seats, ph: o.phase, seq: o.seq, base: o.base, act: o.act, tm: o.timer ? 1 : 0, req: null,
      }).catch(() => toast('방 정보를 보내지 못했어요', 2500));
      store.set(HOST_SAVE, { code: o.code, nick: this.nick, seats: o.seats, phase: o.phase, seq: o.seq, timer: o.timer, cur: o.phase === 'game' ? snapshot() : null, at: Date.now() });
    },
    startGame() {
      const o = S.online;
      if (!o || !o.host || o.seats.length < 2) return;
      o.phase = 'game';
      this.enterGame();
      S.gseed = newSeed();
      o.seq = 0; o.act = null; o.base = snapshot();
      this.publish();
      log('🎮 게임 시작! 문제를 맞혀 행동하세요.');
      startOnlineTurn();
    },
    accept(a) {
      const o = S.online;
      const act = cleanAct({ ...a, seq: o.seq + 1, seed: newSeed() });
      if (!act) return;
      o.base = snapshot();
      o.act = act;
      o.seq = act.seq;
      this.publish();
      applyAct(act);
    },
    hostScan() {
      const o = S.online;
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

    // ---------- 참가자 ----------
    async join() {
      const code = cleanText($('#joinCode').value, 4).toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) { $('#joinCode').focus(); toast('방 코드 4자리를 입력하세요'); return; }
      if (!this.readNick()) return;
      if (!(await this.connect(code))) return;
      S.online = { code, host: false, seats: [], mySeat: -1, phase: 'joining', seq: -1, pending: null, timer: true };
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
      o.seats = (Array.isArray(h.seats) ? h.seats : []).slice(0, MAX_PLAYERS).map(x => ({ k: cleanText(x && x.k, 60), n: cleanText(x && x.n, 10) || '플레이어' }));
      o.mySeat = o.seats.findIndex(x => x.k === this.myKey());
      o.timer = !!h.tm;
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
      if (seq > o.seq) { o.pending = { seq, base: h.base, act: h.act }; this.processPending(); }
      else renderAll();
    },
    processPending() {
      const o = S.online;
      if (!o || o.host || !o.pending || S.applying) return;
      const h = o.pending;
      o.pending = null;
      loadSnapshot(h.base);
      o.seq = h.seq;
      const act = cleanAct(h.act);
      if (!act || h.seq === 0) { startOnlineTurn(); return; }
      applyAct(act);
    },
    submit(a) {
      const o = S.online;
      if (o.host) { this.accept(a); return; }
      const req = { ...a, seq: o.seq + 1, n: Date.now() % 1e9 };
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

    // ---------- 공통 ----------
    enterGame() {
      const o = S.online;
      S.timer = o.timer;
      S.players = o.seats.map((x, i) => makePlayer(i, x.n, o.seats.length));
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
          }
          // 로비에서 나간 사람은 자리에서 뺀다
          const keys = new Set(here.map(p => this.keyOf(p)));
          const kept = o.seats.filter((x, i) => i === 0 || keys.has(x.k));
          if (kept.length !== o.seats.length) { o.seats = kept; changed = true; }
          if (changed) this.publish();
          renderLobby();
        } else {
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
      if (o.host) { this.publishSaveOnly(); this.hostScan(); }
      else this.processPending();
    },
    publishSaveOnly() {
      const o = S.online;
      store.set(HOST_SAVE, { code: o.code, nick: this.nick, seats: o.seats, phase: o.phase, seq: o.seq, timer: o.timer, cur: snapshot(), at: Date.now() });
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
        ${x && i === 0 ? '<span class="chip host">방장</span>' : ''}${me ? '<span class="chip me">나</span>' : ''}
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
        <ul class="seats">${seats}</ul>
        <p class="lobby-msg">${message ? esc(message)
          : waitingHost ? '방을 찾는 중…'
          : full ? '자리가 다 찼어요. 게임이 시작되면 관전할 수 있어요.'
          : o.host ? (o.seats.length < 2 ? '친구가 들어오길 기다리는 중… (2~4명)' : `${o.seats.length}명 모였어요. 시작할 수 있어요.`)
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
        <p class="muted">8×8 체스판 위에서 2~4명이 싸우는 턴제 게임입니다. 마지막까지 살아남으면 승리! (HP ${MAX_HP})</p>
        <h3>턴 진행</h3>
        <ul>
          <li>첫 차례에 <b>증강</b>을 고릅니다. 무작위 공격 스타일 ${OFFER_N}개 중 하나를 골라 게임 끝까지 씁니다.</li>
          <li><b>조준은 무료</b>입니다. 판 위의 칸을 누르면 그 칸을 조준하고, 버튼으로 5°·15°씩 미세 조정할 수 있어요.</li>
          <li>공격·이동·랜덤박스 중 하나를 고르고, <b>과목</b>(공통·미적분·확률과 통계·기하)과 <b>난이도</b>(기본·심화)를 골라 문제를 풉니다. 맞히면 실행, 틀리면 턴 종료.</li>
          <li><b>밸런스</b>: 1라운드는 <b>준비 라운드</b>라 공격할 수 없고(이동·랜덤박스·증강만), 라운드마다 시작 순서가 한 칸씩 돌아갑니다 (A B C → B C A → C A B). 추가 행동으로는 공격할 수 없어요.</li>
          <li><b>온라인 관전</b>: 다른 사람 차례에는 그 사람이 고르는 과목·문제·답이 내 화면에도 실시간으로 보여요.</li>
          <li><b>점수</b>: 정답마다 기본 100점 / 심화 200점 + 속도 보너스(최대 100점). <b>⚡ 빠른 정답</b>(제한 시간 1/3 안)이면 공격 피해 +10, 이동 범위 +1칸, 랜덤박스 꽝 없음.</li>
        </ul>
        <h3>행동</h3>
        <table>
          <tr><th>행동</th><th>기본</th><th>심화</th></tr>
          <tr><td>⚔️ 공격 — 고른 증강 스타일로 공격</td><td colspan="2">스타일별 (아래 표)</td></tr>
          <tr><td>👣 이동 — 킹처럼 가로·세로·대각선 어느 방향이든, 표시된 빈 칸을 눌러 이동</td><td>${MOVE_RANGE.easy}칸 이내</td><td>${MOVE_RANGE.hard}칸 이내</td></tr>
          <tr><td>🎁 랜덤박스 — 회복·방패·강화탄·번개·유성우·순간이동·위치교환·추가행동·폭탄</td><td>전체</td><td>꽝 없음</td></tr>
        </table>
        <h3>증강 (공격 스타일)</h3>
        <table>
          <tr><th>스타일</th><th>기본</th><th>심화</th></tr>
          ${STYLE_KEYS.map(k => `<tr><td>${STYLES[k].icon} <b>${STYLES[k].name}</b> — ${STYLES[k].desc}</td><td>${STYLES[k].dmg.easy}</td><td>${STYLES[k].dmg.hard}</td></tr>`).join('')}
        </table>
        <h3>온라인 사설방</h3>
        <ul>
          <li>방장이 <b>방 만들기</b>를 누르면 4자리 방 코드와 초대 링크가 나옵니다. 친구는 로그인 없이 링크만 열면 되고, 코드가 자동으로 채워져요.</li>
          <li>2~4명이 모이면 방장이 시작합니다. 자리가 찬 뒤 들어온 사람은 관전합니다.</li>
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
        <ul><li>문제: 1~4 · 과목: Q W E R · 난이도: 1/2 · 증강: 1~3 · 조준: ← → (Shift: 15°) · 전체 보기: V</li></ul>
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
