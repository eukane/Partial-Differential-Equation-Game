/*
 * ∂ 미분 배틀 — 1 vs 1 vs 1 핫시트(한 기기) 턴제 보드게임
 *
 * 턴 흐름: 차례 넘기기 화면 → 카메라가 해당 플레이어 시점으로 이동
 *        → 행동 선택 → 난이도 선택 → 수학 문제 → 정답이면 행동 실행 → 다음 플레이어
 * 시점 전환은 문제 없이 자유롭게 할 수 있다.
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
  const MAX_HP = 100;
  const BUMP_DMG = 10;

  const PRESETS = [
    { name: '레드', color: '#ff5a5f', emoji: '🦊', x: 0, y: 7, dir: 1 },
    { name: '블루', color: '#4d8dff', emoji: '🐧', x: 7, y: 7, dir: 7 },
    { name: '그린', color: '#35d07f', emoji: '🐸', x: 3, y: 0, dir: 4 },
  ];

  const ACTIONS = {
    scatter: { icon: '🎲', name: '난사', sub: '랜덤 좌표로 발사 · 벽 3회 반사', easy: '피해 25', hard: '피해 35', dmg: { easy: 25, hard: 35 } },
    aim:     { icon: '🎯', name: '조준 사격', sub: '바라보는 방향으로 직선 발사', easy: '피해 20', hard: '피해 30', dmg: { easy: 20, hard: 30 } },
    rotate:  { icon: '🔄', name: '시점 전환', sub: '무료 · 문제 없음' },
    move:    { icon: '👣', name: '이동', sub: '바라보는 방향 · 벽에서 반사', easy: '1~3칸', hard: '1~5칸', max: { easy: 3, hard: 5 } },
    box:     { icon: '🎁', name: '랜덤박스', sub: '무작위 효과 획득', easy: '모든 효과 (꽝 포함)', hard: '꽝 없음' },
  };

  const LEVELS = {
    easy: { label: '기본', desc: '고3 미적분', time: 45 },
    hard: { label: '심화', desc: '대학 기초 · 편미분 / PDE', time: 75 },
  };

  const BOX = [
    { id: 'heal',   icon: '💚', name: '회복',     desc: 'HP +25',                  w: 3 },
    { id: 'shield', icon: '🛡️', name: '방패',     desc: '다음 피해 1회 무효',       w: 3 },
    { id: 'power',  icon: '💥', name: '강화탄',   desc: '다음 사격 피해 2배',       w: 3 },
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
  };

  const $ = s => document.querySelector(s);
  const el = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = n => Math.floor(Math.random() * n);
  const inB = (x, y) => x >= 0 && x < N && y >= 0 && y < N;
  const coord = (x, y) => 'ABCDEFGH'[x] + (N - y);
  const cur = () => S.players[S.turn];
  const alive = () => S.players.filter(p => p.alive);
  const enemies = p => S.players.filter(q => q.alive && q !== p);
  const at = (x, y, except) => S.players.find(p => p.alive && p !== except && p.x === x && p.y === y) || null;
  const dirIdx = (dx, dy) => DIRS.findIndex(d => d[0] === dx && d[1] === dy);
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
      compass: $('#compass .needle'), toast: $('#toast'), playerList: $('#playerList'),
      turnPanel: $('#turnPanel'), log: $('#log'), roundInfo: $('#roundInfo'),
      setup: $('#setup'), handover: $('#handover'), modal: $('#modal'), modalCard: $('#modalCard'),
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
    $('#setupPlayers').innerHTML = PRESETS.map((p, i) => `
      <div class="setup-row" style="--pc:${p.color}">
        <span>${p.emoji}</span>
        <input id="pname${i}" maxlength="10" value="${p.name}" aria-label="플레이어 ${i + 1} 이름">
      </div>`).join('');
    $('#btnStart').onclick = startGame;
    $('#btnRules').onclick = showRules;
    $('#btnRules2').onclick = showRules;
    $('#btnView').onclick = toggleView;

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    layout();
    // 시작 화면 뒤 보드 미리보기
    S.players = PRESETS.map((p, i) => makePlayer(p, i, p.name));
    renderPieces();
    updateCamera();
  }

  function makePlayer(p, i, name) {
    return { id: i, name, color: p.color, emoji: p.emoji, x: p.x, y: p.y, dir: p.dir,
      hp: MAX_HP, alive: true, shield: false, power: false, correct: 0, tries: 0 };
  }

  function startGame() {
    S.players = PRESETS.map((p, i) => makePlayer(p, i, ($(`#pname${i}`).value || p.name).trim() || p.name));
    S.timer = $('#optTimer').checked;
    S.turn = 0; S.round = 1; S.extra = false; S.extraActive = false;
    el.pieces.innerHTML = '';
    el.log.innerHTML = '';
    el.setup.classList.add('hidden');
    log('🎮 게임 시작! 문제를 맞혀 행동하세요.');
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
      target = -p.dir * 45;
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
    el.roundInfo.textContent = S.phase === 'setup' ? '' : `라운드 ${S.round} · 생존 ${alive().length}명`;
  }

  function renderPlayers() {
    el.playerList.innerHTML = S.players.map(p => `
      <div class="pcard ${p === cur() && S.phase !== 'over' ? 'active' : ''} ${p.alive ? '' : 'dead'}" style="--pc:${p.color}">
        <span class="pemoji">${p.emoji}</span>
        <div class="pinfo">
          <div class="pname">${esc(p.name)} ${p.shield ? '🛡️' : ''}${p.power ? '💥' : ''}</div>
          <div class="hp"><div class="hp-fill" style="width:${p.hp}%"></div></div>
        </div>
        <span class="hpnum">${p.alive ? p.hp : '탈락'}</span>
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
      node.style.setProperty('--dir', p.dir);
      node.style.setProperty('--pc', p.color);
      node.classList.toggle('current', p === cur() && ['choose', 'rotate', 'busy'].includes(S.phase));
      node.classList.toggle('dead', !p.alive);
      node.querySelector('.mini-hp i').style.width = p.hp + '%';
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
        <small>${coord(p.x, p.y)} · 바라보는 방향 ${ARROWS[p.dir]} ${DIR_NAMES[p.dir]}</small></div>
      </div>`;

    if (S.phase === 'rotate') {
      el.turnPanel.innerHTML = head + `
        <div class="rotate-box">
          <p>🔄 <b>시점 전환</b> (무료) — 원하는 방향으로 돌린 뒤 완료를 누르세요. <span class="muted">(← → 키)</span></p>
          <div class="rot-btns">
            <button data-r="-1">⟲ 왼쪽 45°</button>
            <button data-r="4">↩ 뒤돌기</button>
            <button data-r="1">⟳ 오른쪽 45°</button>
          </div>
          <button class="primary" data-r="done">✔ 완료</button>
        </div>`;
      el.turnPanel.querySelectorAll('[data-r]').forEach(b => {
        b.onclick = () => (b.dataset.r === 'done' ? finishRotate() : rotateBy(+b.dataset.r));
      });
      return;
    }

    const dis = S.phase !== 'choose' ? 'disabled' : '';
    const btn = (k, cls = '') => {
      const a = ACTIONS[k];
      return `<button class="act ${cls}" data-a="${k}" ${dis}><span class="ai">${a.icon}</span><span><b>${a.name}</b><br><small>${a.sub}</small></span></button>`;
    };
    el.turnPanel.innerHTML = head + `
      <div class="actions">
        ${btn('scatter')}${btn('aim')}${btn('move')}${btn('box')}${btn('rotate', 'free wide')}
      </div>
      <p class="hint">공격·이동·랜덤박스는 <b>문제를 맞혀야</b> 실행됩니다. 오답이면 그대로 턴 종료!<br>
      점선은 조준 사격 경로입니다. 시점 전환은 무료이니 먼저 방향을 맞추세요.</p>`;
    el.turnPanel.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => onAction(b.dataset.a); });
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

  function renderGuide() {
    clearFx('.guide, .guide-end');
    const p = cur();
    if (!p || !p.alive || !['choose', 'rotate'].includes(S.phase)) return;
    const { end } = traceAim(p);
    svg('line', { class: 'guide', x1: p.x + 0.5, y1: p.y + 0.5, x2: end[0], y2: end[1], stroke: p.color });
    svg('circle', { class: 'guide-end', cx: end[0], cy: end[1], r: 0.1, fill: p.color });
  }

  function burst(x, y, color = '#fff') {
    const c = svg('circle', { class: 'burst', cx: x, cy: y, r: 0.1, stroke: color });
    setTimeout(() => c.remove(), 700);
  }

  /** 폴리라인 경로를 따라 탄환을 날린다 */
  function animatePath(pts, color, speed = 11) {
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
        if (d < total) requestAnimationFrame(frame);
        else {
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
        <p>라운드 ${S.round} · 기기를 <b>${esc(p.name)}</b>에게 넘겨주세요.<br>HP ${p.hp} ${p.shield ? '· 🛡️ 방패' : ''} ${p.power ? '· 💥 강화탄' : ''}</p>
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
    };
  }

  async function endTurn() {
    if (checkWin()) return;
    S.extra = false;
    S.extraActive = false;
    const n = S.players.length;
    let i = S.turn;
    do {
      i = (i + 1) % n;
      if (i === 0) S.round++;
    } while (!S.players[i].alive);
    S.turn = i;
    await sleep(350);
    showHandover();
  }

  function checkWin() {
    const left = alive();
    if (left.length > 1) return false;
    S.phase = 'over';
    renderAll();
    const w = left[0];
    const stats = S.players.map(p => `<tr><td>${p.emoji} ${esc(p.name)}</td><td>${p.alive ? p.hp : '탈락'}</td><td>${p.correct}/${p.tries}</td></tr>`).join('');
    const c = openModal(`
      <div class="victory" style="--pc:${w ? w.color : '#fff'}">
        <div class="crown">${w ? '👑' : '🤝'}</div>
        <h2>${w ? `${w.emoji} ${esc(w.name)} 승리!` : '무승부'}</h2>
        <p class="muted">${S.round} 라운드 만에 결판이 났습니다.</p>
        <div class="rules"><table><tr><th>플레이어</th><th>HP</th><th>정답/시도</th></tr>${stats}</table></div>
        <p></p>
        <button class="primary big" id="btnAgain">다시 하기 ↻</button>
      </div>`, 'small');
    c.querySelector('#btnAgain').onclick = () => { closeModal(); el.setup.classList.remove('hidden'); S.phase = 'setup'; renderAll(); };
    log(w ? `🏆 ${tag(w)} 최종 승리!` : '🤝 무승부!');
    return true;
  }

  // ---------------- 시점 전환 (무료) ----------------
  function rotateBy(delta) {
    const p = cur();
    if (S.phase === 'choose') { S.phase = 'rotate'; S.rotStart = p.dir; }
    if (S.phase !== 'rotate') return;
    p.dir = (p.dir + delta + 8) % 8;
    renderAll();
  }
  function finishRotate() {
    const p = cur();
    if (p.dir !== S.rotStart) log(`${tag(p)} 🔄 시점 전환: ${DIR_NAMES[S.rotStart]} → ${DIR_NAMES[p.dir]}`);
    S.phase = 'choose';
    renderAll();
  }

  // ---------------- 행동 선택 ----------------
  async function onAction(key) {
    if (S.phase !== 'choose') return;
    const p = cur();
    if (key === 'rotate') { S.phase = 'rotate'; S.rotStart = p.dir; renderAll(); return; }

    const level = await pickLevel(key);
    if (!level) return;
    S.phase = 'busy';
    renderAll();

    const ok = await runQuiz(level);
    if (!ok) {
      await endTurn();
      return;
    }
    await perform(key, level);
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
  }

  function pickLevel(key) {
    const a = ACTIONS[key];
    return new Promise(resolve => {
      const c = openModal(`
        <h2>${a.icon} ${a.name}</h2>
        <p class="muted">${a.sub} — 난이도를 고르세요. 어려운 문제일수록 보상이 큽니다.</p>
        <div class="levels">
          ${['easy', 'hard'].map(l => `
            <button class="level ${l}" data-l="${l}">
              <b>${LEVELS[l].label}</b><span>${LEVELS[l].desc}</span><em>${a[l]}</em>
              ${S.timer ? `<small>⏱ ${LEVELS[l].time}초</small>` : ''}
            </button>`).join('')}
        </div>
        <button class="ghost wide" data-l="">취소</button>`, 'small');
      c.querySelectorAll('[data-l]').forEach(b => {
        b.onclick = () => { closeModal(); resolve(b.dataset.l || null); };
      });
      S.keyHandler = e => {
        if (e.key === '1') c.querySelector('[data-l="easy"]').click();
        if (e.key === '2') c.querySelector('[data-l="hard"]').click();
        if (e.key === 'Escape') c.querySelector('[data-l=""]').click();
      };
    });
  }

  function runQuiz(level) {
    const P = window.MathProblems.generate(level);
    const L = LEVELS[level];
    const p = cur();
    p.tries++;
    return new Promise(resolve => {
      const c = openModal(`
        <div class="quiz-head">
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

      const finish = i => {
        if (done) return;
        done = true;
        clearInterval(timerId);
        const ok = i === P.answer;
        if (ok) p.correct++;
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (j === P.answer) b.classList.add('correct');
          else if (j === i) b.classList.add('wrong');
        });
        const fb = c.querySelector('.feedback');
        fb.innerHTML = `
          <div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '정답! 🎉' : i === -1 ? '⏰ 시간 초과!' : '오답 😢'}</div>
          <div class="explain">💡 ${tex(P.explain)}</div>
          <button class="primary big" id="qNext">${ok ? '행동 실행 ▶' : '턴 종료 ▶'}</button>`;
        fb.classList.remove('hidden');
        const next = fb.querySelector('#qNext');
        next.focus();
        log(`${tag(p)} ${L.label} 문제(${esc(P.topic)}) ${ok ? '✅ 정답' : i === -1 ? '⏰ 시간 초과' : '❌ 오답'}`);
        S.keyHandler = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next.click(); } };
        next.onclick = () => { closeModal(); resolve(ok); };
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

  async function perform(key, level) {
    const p = cur();
    renderGuide();
    if (key === 'aim') await doAim(p, level);
    else if (key === 'scatter') await doScatter(p, level);
    else if (key === 'move') {
      const d = await pickDistance(p, ACTIONS.move.max[level]);
      await doMove(p, d);
    } else if (key === 'box') await doBox(p, level);
    await sleep(400);
  }

  // ------------------------------------------------------------------
  //  피해 처리
  // ------------------------------------------------------------------
  function takeShotDamage(p, level, key) {
    let dmg = ACTIONS[key].dmg[level];
    if (p.power) {
      dmg *= 2;
      p.power = false;
      log(`${tag(p)} 💥 강화탄 발동! 피해 2배`);
    }
    return dmg;
  }

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
  //  조준 사격: 바라보는 방향으로 직선
  // ------------------------------------------------------------------
  function traceAim(p) {
    const [dx, dy] = DIRS[p.dir];
    let x = p.x, y = p.y;
    for (;;) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) return { end: [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5], hit: null };
      const o = at(nx, ny, p);
      if (o) return { end: [nx + 0.5, ny + 0.5], hit: o };
      x = nx; y = ny;
    }
  }

  async function doAim(p, level) {
    const dmg = takeShotDamage(p, level, 'aim');
    const { end, hit } = traceAim(p);
    toast(`🎯 ${DIR_NAMES[p.dir]} 방향 사격!`);
    await animatePath([[p.x + 0.5, p.y + 0.5], end], p.color, 13);
    burst(end[0], end[1], hit ? '#ff5d6c' : '#fff');
    if (hit) damage(hit, dmg, p, '조준 사격');
    else log(`${tag(p)} 🎯 조준 사격… 빗나감`);
  }

  // ------------------------------------------------------------------
  //  난사: 무작위 좌표를 향해 발사, 벽에 최대 3번 반사
  // ------------------------------------------------------------------
  function traceScatter(p, tx, ty) {
    let pos = [p.x + 0.5, p.y + 0.5];
    let v = [tx + 0.5 - pos[0], ty + 0.5 - pos[1]];
    const len = Math.hypot(v[0], v[1]);
    v = [v[0] / len, v[1] / len];
    const pts = [pos];
    const EPS = 1e-9;
    for (let seg = 0; seg <= 3; seg++) {
      const tX = v[0] > EPS ? (N - pos[0]) / v[0] : v[0] < -EPS ? -pos[0] / v[0] : Infinity;
      const tY = v[1] > EPS ? (N - pos[1]) / v[1] : v[1] < -EPS ? -pos[1] / v[1] : Infinity;
      const t = Math.min(tX, tY);
      // 이 구간에서 가장 먼저 스치는 플레이어
      let best = null;
      for (const q of S.players) {
        if (!q.alive || (seg === 0 && q === p)) continue;
        const cx = q.x + 0.5 - pos[0], cy = q.y + 0.5 - pos[1];
        const s = cx * v[0] + cy * v[1];
        if (s < 0.05 || s > t) continue;
        const dist = Math.hypot(cx - v[0] * s, cy - v[1] * s);
        if (dist < 0.42 && (!best || s < best.s)) best = { q, s };
      }
      if (best) {
        pts.push([pos[0] + v[0] * best.s, pos[1] + v[1] * best.s]);
        return { pts, hit: best.q, bounces: seg };
      }
      pos = [pos[0] + v[0] * t, pos[1] + v[1] * t];
      pts.push(pos);
      if (seg === 3) break;
      if (tX <= tY + 1e-7) v = [-v[0], v[1]];
      if (tY <= tX + 1e-7) v = [v[0], -v[1]];
    }
    return { pts, hit: null, bounces: 3 };
  }

  async function doScatter(p, level) {
    const dmg = takeShotDamage(p, level, 'scatter');
    let tx, ty;
    do { tx = rand(N); ty = rand(N); } while (tx === p.x && ty === p.y);
    // 목표 좌표 표시
    const cross = svg('g', {});
    svg('circle', { class: 'crosshair', cx: tx + 0.5, cy: ty + 0.5, r: 0.35 }, cross);
    svg('line', { class: 'crosshair', x1: tx + 0.1, y1: ty + 0.5, x2: tx + 0.9, y2: ty + 0.5 }, cross);
    svg('line', { class: 'crosshair', x1: tx + 0.5, y1: ty + 0.1, x2: tx + 0.5, y2: ty + 0.9 }, cross);
    toast(`🎲 무작위 좌표 ${coord(tx, ty)} 로 발사!`);
    await sleep(900);
    const { pts, hit, bounces } = traceScatter(p, tx, ty);
    await animatePath(pts, p.color, 12);
    cross.remove();
    const end = pts[pts.length - 1];
    burst(end[0], end[1], hit ? '#ff5d6c' : '#fff');
    if (hit) damage(hit, dmg, p, `난사(반사 ${bounces}회)`);
    else log(`${tag(p)} 🎲 ${coord(tx, ty)} 방향 난사… 3번 튕기고 소멸`);
  }

  // ------------------------------------------------------------------
  //  이동: 바라보는 방향, 벽에서 반사, 다른 플레이어와 충돌 시 정지
  // ------------------------------------------------------------------
  function simulateMove(p, dist) {
    let x = p.x, y = p.y;
    let [dx, dy] = DIRS[p.dir];
    const steps = [];
    let bump = null;
    for (let i = 0; i < dist; i++) {
      let bounced = false;
      if (x + dx < 0 || x + dx >= N) { dx = -dx; bounced = true; }
      if (y + dy < 0 || y + dy >= N) { dy = -dy; bounced = true; }
      const nx = x + dx, ny = y + dy;
      const o = at(nx, ny, p);
      if (o) { bump = o; break; }
      x = nx; y = ny;
      steps.push({ x, y, dir: dirIdx(dx, dy), bounced });
    }
    return { steps, bump };
  }

  function drawMovePreview(p, dist) {
    clearFx('.preview, .preview-dot');
    const { steps, bump } = simulateMove(p, dist);
    const pts = [[p.x + 0.5, p.y + 0.5], ...steps.map(s => [s.x + 0.5, s.y + 0.5])];
    svg('polyline', { class: 'preview', stroke: p.color, points: pts.map(q => q.join(',')).join(' ') });
    const last = pts[pts.length - 1];
    svg('circle', { class: 'preview-dot', cx: last[0], cy: last[1], r: 0.22, fill: p.color });
    if (bump) svg('circle', { class: 'preview-dot', cx: bump.x + 0.5, cy: bump.y + 0.5, r: 0.45, fill: 'none', stroke: '#ff3b3b', 'stroke-width': 0.08 });
  }

  function pickDistance(p, max) {
    return new Promise(resolve => {
      const c = openModal(`
        <h2>👣 이동 거리</h2>
        <p class="muted">${ARROWS[p.dir]} ${DIR_NAMES[p.dir]} 방향으로 이동합니다. 벽에 닿으면 반사되고, 다른 플레이어와 부딪히면 그 앞에서 멈추며 상대에게 ${BUMP_DMG} 피해를 줍니다.</p>
        <div class="dist">${Array.from({ length: max }, (_, i) => `<button class="dist-btn" data-d="${i + 1}">${i + 1}칸</button>`).join('')}</div>
        <p class="muted" style="font-size:.8rem;margin:6px 0 0">버튼에 마우스를 올리면(또는 한 번 탭하면) 경로가 미리 보입니다.</p>`, 'small', true);
      let sel = 0;
      const choose = d => {
        clearFx('.preview, .preview-dot');
        closeModal();
        resolve(d);
      };
      const preview = d => {
        sel = d;
        c.querySelectorAll('.dist-btn').forEach(b => b.classList.toggle('sel', +b.dataset.d === d));
        drawMovePreview(p, d);
      };
      c.querySelectorAll('.dist-btn').forEach(b => {
        const d = +b.dataset.d;
        b.onmouseenter = () => preview(d);
        b.onfocus = () => preview(d);
        // 터치 기기: 첫 탭은 미리보기, 두 번째 탭에 확정
        b.onclick = () => { if (sel === d || matchMedia('(hover: hover)').matches) choose(d); else preview(d); };
      });
      preview(1);
      S.keyHandler = e => {
        const d = parseInt(e.key, 10);
        if (d >= 1 && d <= max) choose(d);
      };
    });
  }

  async function doMove(p, dist) {
    const { steps, bump } = simulateMove(p, dist);
    let bounced = false;
    for (const s of steps) {
      p.x = s.x; p.y = s.y; p.dir = s.dir;
      if (s.bounced) { bounced = true; burst(s.x + 0.5, s.y + 0.5, '#fff'); }
      renderPieces();
      updateCamera();
      await sleep(300);
    }
    log(`${tag(p)} 👣 ${steps.length}칸 이동 → ${coord(p.x, p.y)}${bounced ? ' (벽 반사)' : ''}`);
    if (bump) {
      burst(bump.x + 0.5, bump.y + 0.5, '#ff5d6c');
      damage(bump, BUMP_DMG, p, '충돌');
    }
    renderAll();
  }

  // ------------------------------------------------------------------
  //  랜덤박스
  // ------------------------------------------------------------------
  function weighted(pool) {
    const total = pool.reduce((s, b) => s + b.w, 0);
    let r = Math.random() * total;
    for (const b of pool) { r -= b.w; if (r < 0) return b; }
    return pool[pool.length - 1];
  }

  async function doBox(p, level) {
    const pool = BOX.filter(b => !(level === 'hard' && b.bad));
    const res = weighted(pool);
    const c = openModal(`
      <h2>🎁 랜덤박스</h2>
      <div class="roulette"><div class="slot">❔</div><div class="slot-name"></div></div>
      <div class="box-desc hidden"></div>
      <button class="primary full hidden">확인</button>`, 'small');
    const slot = c.querySelector('.slot');
    for (let i = 0; i < 16; i++) {
      slot.textContent = pool[rand(pool.length)].icon;
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
    await new Promise(r => { ok.onclick = r; S.keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); r(); } }; });
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
  //  규칙
  // ------------------------------------------------------------------
  function showRules() {
    const wasOpen = !el.modal.classList.contains('hidden');
    if (wasOpen) return;
    const c = openModal(`
      <div class="rules">
        <h2>📖 게임 규칙</h2>
        <p class="muted">8×8 체스판 위에서 3명이 싸우는 턴제 게임입니다. 마지막까지 살아남으면 승리! (HP ${MAX_HP})</p>
        <h3>턴 진행</h3>
        <ul>
          <li>차례가 되면 기기를 넘겨받고 <b>시작</b>을 누르세요. 카메라가 내 말의 시점(바라보는 방향이 화면 위쪽)으로 이동합니다.</li>
          <li>행동을 고르고 <b>기본(고3)</b> 또는 <b>심화(대학 기초)</b> 문제를 풉니다. 맞히면 행동 실행, 틀리면 턴 종료.</li>
          <li><b>시점 전환</b>은 무료입니다. 원하는 만큼 방향을 돌린 뒤 다른 행동을 고르세요.</li>
        </ul>
        <h3>행동</h3>
        <table>
          <tr><th>행동</th><th>기본</th><th>심화</th></tr>
          <tr><td>🎲 난사 — 무작위 좌표로 발사, 벽에 최대 3번 반사. 튕긴 탄에 <b>자신도</b> 맞을 수 있음</td><td>25</td><td>35</td></tr>
          <tr><td>🎯 조준 사격 — 바라보는 방향으로 직선, 처음 맞는 플레이어에게 피해</td><td>20</td><td>30</td></tr>
          <tr><td>👣 이동 — 바라보는 방향으로 이동, 벽에서 반사. 부딪히면 멈추고 상대에게 ${BUMP_DMG} 피해</td><td>1~3칸</td><td>1~5칸</td></tr>
          <tr><td>🎁 랜덤박스 — 회복·방패·강화탄·번개·유성우·순간이동·위치교환·추가행동·폭탄</td><td>전체</td><td>꽝 없음</td></tr>
          <tr><td>🔄 시점 전환 — 45° 단위 회전</td><td colspan="2">무료</td></tr>
        </table>
        <h3>문제 범위</h3>
        <ul>
          <li><b>기본</b>: 미분계수, 극한, 합성함수·곱·로그 미분, 이계도함수, 정적분, 극값, 접선, 삼각함수 합성</li>
          <li><b>심화</b>: 편미분, 혼합 편도함수, 기울기·방향도함수, 라플라시안, 다변수 연쇄법칙, 열·파동·라플라스 방정식, PDE 분류/계수/선형성, 수송방정식, 로피탈, 테일러, 이중적분, 야코비안</li>
        </ul>
        <h3>단축키</h3>
        <ul><li>문제: 1~4 · 난이도: 1/2 · 시점 전환: ← → · 전체 보기: V</li></ul>
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
    if (!el.handover.classList.contains('hidden')) return;
    if (e.key === 'v' || e.key === 'V') toggleView();
    if (S.phase === 'choose' || S.phase === 'rotate') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); rotateBy(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); rotateBy(1); }
      if (S.phase === 'rotate' && (e.key === 'Enter' || e.key === 'Escape')) finishRotate();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
