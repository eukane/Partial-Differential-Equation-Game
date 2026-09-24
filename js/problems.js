/*
 * 수학 문제 생성기
 *  - easy : 고3 미적분 수준 (미분계수, 극한, 합성함수/곱의 미분, 정적분, 극값 …)
 *  - hard : 대학 기초 (편미분, 기울기, 방향도함수, 라플라시안, 열/파동 방정식, PDE 분류 …)
 * 모든 문제는 매번 숫자가 바뀌는 무작위 생성형이며 4지선다로 출제된다.
 * 문자열 안의 $...$ 구간은 TeX 수식으로 렌더링된다.
 */
(function (global) {
  'use strict';

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const nz = (a, b) => { let v = 0; while (v === 0) v = ri(a, b); return v; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  // ---- TeX 포맷 도우미 -------------------------------------------------
  const T = s => `$${s}$`;
  /** 계수: 1 → '', -1 → '-' */
  const cx = a => (a === 1 ? '' : a === -1 ? '-' : String(a));
  /** ' + 3' / ' - 3' */
  const signed = n => (n < 0 ? ` - ${-n}` : ` + ${n}`);
  /** 거듭제곱: pw('x',1) → 'x', pw('x',0) → '' */
  const pw = (v, e) => (e === 0 ? '' : e === 1 ? v : `${v}^{${e}}`);
  /** 기약분수 TeX */
  function frac(p, q) {
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(Math.abs(p), q) || 1;
    p /= g; q /= g;
    if (q === 1) return String(p);
    return `${p < 0 ? '-' : ''}\\frac{${Math.abs(p)}}{${q}}`;
  }
  /** [[계수, '문자']] → 다항식 TeX */
  function poly(terms) {
    let s = '';
    for (const [c, v] of terms) {
      if (!c) continue;
      const a = Math.abs(c);
      const body = v ? (a === 1 ? '' : a) + v : String(a);
      if (!s) s = (c < 0 ? '-' : '') + body;
      else s += (c < 0 ? ' - ' : ' + ') + body;
    }
    return s || '0';
  }
  /** 앞에 붙일 항들: ' + 3x - 2' */
  function tail(terms) {
    let s = '';
    for (const [c, v] of terms) {
      if (!c) continue;
      const a = Math.abs(c);
      s += (c < 0 ? ' - ' : ' + ') + (v ? (a === 1 ? '' : a) + v : String(a));
    }
    return s;
  }

  // ---- 보기 구성 ------------------------------------------------------
  function build(topic, q, correct, wrongs, explain) {
    const seen = new Set([correct]);
    const w = [];
    for (const x of wrongs) {
      if (x == null || seen.has(x)) continue;
      seen.add(x);
      w.push(x);
      if (w.length === 3) break;
    }
    if (w.length < 3) throw new Error('distractor 부족: ' + topic);
    const choices = shuffle([correct, ...w]);
    return { topic, q, choices, answer: choices.indexOf(correct), explain };
  }
  /** 정수 정답 문제: 부족한 오답은 정답 ± d 로 채운다 */
  function num(topic, q, ans, wrongs, explain) {
    const extra = [];
    for (let d = 1; d <= 6; d++) extra.push(ans + d, ans - d);
    const pool = [...wrongs.filter(Number.isFinite), ...shuffle(extra)].map(v => T(v));
    return build(topic, q, T(ans), pool, explain);
  }

  // =====================================================================
  //  기본 (고3)
  // =====================================================================
  const EASY = [
    function polyDeriv() {
      const a = ri(1, 3), b = ri(-4, 4), c = ri(-5, 5), d = ri(-5, 5), k = ri(-2, 2);
      const f = poly([[a, 'x^3'], [b, 'x^2'], [c, 'x'], [d, '']]);
      const ans = 3 * a * k * k + 2 * b * k + c;
      return num('미분계수',
        `$f(x) = ${f}$ 일 때, $f'(${k})$ 의 값은?`, ans,
        [a * k ** 3 + b * k * k + c * k + d, 3 * a * k * k + b * k + c, 6 * a * k + 2 * b, a * k * k + b * k + c],
        `$f'(x) = ${poly([[3 * a, 'x^2'], [2 * b, 'x'], [c, '']])}$ 이므로 $f'(${k}) = ${ans}$`);
    },

    function limit() {
      const a = ri(1, 6);
      let b = ri(1, 6);
      while (b === a) b = ri(1, 6);
      const top = pick([`e^{${cx(a)}x} - 1`, `\\sin ${cx(a)}x`, `\\ln(1 + ${cx(a)}x)`, `\\tan ${cx(a)}x`]);
      const bot = pick([`\\sin ${cx(b)}x`, `\\tan ${cx(b)}x`, `${cx(b)}x`, `e^{${cx(b)}x} - 1`]);
      return build('극한',
        `$\\displaystyle\\lim_{x \\to 0} \\frac{${top}}{${bot}}$ 의 값은?`,
        T(frac(a, b)),
        [frac(b, a), String(a * b), '1', frac(a, 2 * b), '0', frac(a + 1, b)].map(T),
        `$x \\to 0$ 일 때 분자 $\\approx ${cx(a)}x$, 분모 $\\approx ${cx(b)}x$ 이므로 극한값은 $${frac(a, b)}$`);
    },

    function chain() {
      const a = ri(1, 3), b = ri(1, 3), n = ri(2, 4);
      const ans = n * a * b ** (n - 1);
      const inner = `(${cx(a)}x + ${b})`;
      return num('합성함수의 미분',
        `$f(x) = ${inner}^{${n}}$ 일 때, $f'(0)$ 의 값은?`, ans,
        [n * b ** (n - 1), a * b ** (n - 1), n * a * b ** n, b ** n],
        `연쇄법칙: $f'(x) = ${n}\\cdot ${a}\\cdot ${inner}${n - 1 > 1 ? `^{${n - 1}}` : ''}$ → $f'(0) = ${ans}$`);
    },

    function product() {
      const p = nz(-3, 3), q = ri(1, 3);
      const ans = 1 + p * q;
      const e = `e^{${cx(q)}x}`;
      return num('곱의 미분',
        `$f(x) = (x${signed(p)})${e}$ 일 때, $f'(0)$ 의 값은?`, ans,
        [p * q, 1 + p, p + q, q, p * q - 1],
        `$f'(x) = ${e} + ${cx(q)}(x${signed(p)})${e}$ → $f'(0) = 1 + ${q}\\cdot(${p}) = ${ans}$`);
    },

    function integral() {
      const m = ri(1, 2), n = ri(1, 3), k = ri(1, 3);
      const ans = m * k ** 3 + n * k * k;
      return num('정적분',
        `$\\displaystyle\\int_0^{${k}} \\left(${poly([[3 * m, 'x^2'], [2 * n, 'x']])}\\right) dx$ 의 값은?`, ans,
        [3 * m * k ** 3 + 2 * n * k * k, 6 * m * k + 2 * n, m * k * k + n * k, ans + k],
        `부정적분 $${poly([[m, 'x^3'], [n, 'x^2']])}$ 에 $x = ${k}$ 대입 → $${m * k ** 3} + ${n * k * k} = ${ans}$`);
    },

    function extreme() {
      const p = ri(1, 3);
      const isMax = Math.random() < 0.5;
      const ans = isMax ? 2 * p ** 3 : -2 * p ** 3;
      return num('극값',
        `$f(x) = x^3 - ${3 * p * p}x$ 의 ${isMax ? '극댓값' : '극솟값'}은?`, ans,
        [-ans, p ** 3, -(p ** 3), 3 * p ** 3, 0],
        `$f'(x) = 3x^2 - ${3 * p * p} = 0$ → $x = \\pm ${p}$. ${isMax ? `극대는 $x = -${p}$` : `극소는 $x = ${p}$`} 에서 $f = ${ans}$`);
    },

    function tangent() {
      const a = ri(-4, 4), k = ri(1, 3);
      const ans = -k * k;
      const slope = 2 * k + a, fk = k * k + a * k;
      return num('접선의 방정식',
        `곡선 $y = ${poly([[1, 'x^2'], [a, 'x']])}$ 위의 점 $x = ${k}$ 에서 그은 접선의 $y$절편은?`, ans,
        [k * k, -2 * k * k, slope, a * k, fk],
        `기울기 $f'(${k}) = ${slope}$, 접점 $(${k},\\ ${fk})$ → $y = ${slope}(x - ${k})${signed(fk)}$, $x = 0$ 대입 → $${ans}$`);
    },

    function logDeriv() {
      const a = ri(1, 4), b = ri(1, 4);
      const ans = frac(2 * a, a + b);
      return build('로그함수의 미분',
        `$f(x) = \\ln(${cx(a)}x^2 + ${b})$ 일 때, $f'(1)$ 의 값은?`,
        T(ans),
        [frac(a, a + b), frac(2 * a, b), frac(1, a + b), frac(2, a + b), frac(2 * a + 1, a + b), String(2 * a)].map(T),
        `$f'(x) = \\dfrac{${2 * a}x}{${cx(a)}x^2 + ${b}}$ → $f'(1) = ${ans}$`);
    },

    function second() {
      const a = ri(1, 3), b = nz(-3, 3), c = ri(-3, 3);
      const ans = a * a + 2 * c;
      const f = `e^{${cx(a)}x}${tail([[b, 'x^3'], [c, 'x^2']])}`;
      return num('이계도함수',
        `$f(x) = ${f}$ 일 때, $f''(0)$ 의 값은?`, ans,
        [a + 2 * c, a * a + c, a * a, 2 * c, a * a + 2 * c + 6 * b],
        `$f''(x) = ${cx(a * a)}e^{${cx(a)}x}${tail([[6 * b, 'x'], [2 * c, '']])}$ → $f''(0) = ${ans}$`);
    },

    function trigMax() {
      const [a, b, r] = pick([[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [6, 8, 10], [8, 6, 10]]);
      return num('삼각함수의 최대',
        `$f(x) = ${a}\\sin x + ${b}\\cos x$ 의 최댓값은?`, r,
        [a + b, Math.max(a, b), r * r, a * b, r + 1],
        `$f(x) = \\sqrt{${a}^2 + ${b}^2}\\,\\sin(x + \\alpha)$ 꼴이므로 최댓값은 $${r}$`);
    },
  ];

  // =====================================================================
  //  심화 (대학 기초: 편미분 · 다변수 · PDE)
  // =====================================================================
  const HARD = [
    function partialX() {
      const a = ri(1, 3), b = nz(-2, 2), c = ri(-3, 3), p = nz(-2, 2), q = nz(-2, 2);
      const f = poly([[a, 'x^2y'], [b, 'xy^3'], [c, 'y']]);
      const ans = 2 * a * p * q + b * q ** 3;
      const fy = a * p * p + 3 * b * p * q * q + c;
      return num('편미분',
        `$f(x,y) = ${f}$ 일 때, $\\dfrac{\\partial f}{\\partial x}(${p},\\ ${q})$ 의 값은?`, ans,
        [fy, a * p * q + b * q ** 3, 2 * a * p * q + 3 * b * q * q, 2 * a * p + b * q ** 3],
        `$f_x = ${poly([[2 * a, 'xy'], [b, 'y^3']])}$ ($y$는 상수 취급) → $f_x(${p}, ${q}) = ${ans}$`);
    },

    function partialY() {
      const a = ri(1, 3), b = nz(-2, 2), c = nz(-3, 3), p = nz(-2, 2), q = nz(-2, 2);
      const f = poly([[a, 'x^2y'], [b, 'xy^3'], [c, 'y']]);
      const ans = a * p * p + 3 * b * p * q * q + c;
      const fx = 2 * a * p * q + b * q ** 3;
      return num('편미분',
        `$f(x,y) = ${f}$ 일 때, $\\dfrac{\\partial f}{\\partial y}(${p},\\ ${q})$ 의 값은?`, ans,
        [fx, a * p * p + b * p * q * q + c, a * p * p + 3 * b * p * q * q, 3 * b * p * q * q + c],
        `$f_y = ${poly([[a, 'x^2'], [3 * b, 'xy^2'], [c, '']])}$ ($x$는 상수 취급) → $f_y(${p}, ${q}) = ${ans}$`);
    },

    function mixed() {
      const m = ri(1, 3), n = ri(2, 3);
      const ans = m * n * 2 ** (n - 1);
      return num('혼합 편도함수',
        `$f(x,y) = ${pw('x', m)}${pw('y', n)}$ 일 때, $f_{xy}(1,\\ 2)$ 의 값은?`, ans,
        [m * n, m * n * 2 ** n, m * 2 ** (n - 1), n * 2 ** (n - 1), m * n * (n - 1)],
        `$f_{xy} = ${m * n}${pw('x', m - 1)}${pw('y', n - 1)}$ → $f_{xy}(1, 2) = ${ans}$`);
    },

    function gradient() {
      const [p, q, r] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13]]);
      if (Math.random() < 0.5) {
        return num('기울기 벡터',
          `$f(x,y) = x^2 + y^2$ 의 점 $(${p},\\ ${q})$ 에서 $|\\nabla f|$ 의 값은?`, 2 * r,
          [r, p + q, 2 * (p + q), r * r, 4 * r],
          `$\\nabla f = (2x,\\ 2y) = (${2 * p},\\ ${2 * q})$ → $|\\nabla f| = ${2 * r}$`);
      }
      const c = ri(-5, 5);
      return num('기울기 벡터',
        `$f(x,y) = ${poly([[p, 'x'], [q, 'y'], [c, '']])}$ 에 대하여 $|\\nabla f|$ 의 값은?`, r,
        [p + q, r * r, p * q, 2 * r, r + 1],
        `$\\nabla f = (${p},\\ ${q})$ → $|\\nabla f| = \\sqrt{${p * p} + ${q * q}} = ${r}$`);
    },

    function directional() {
      const a = ri(1, 3), b = ri(1, 4);
      const [u1, u2] = pick([[3, 4], [4, 3]]);
      const ans = frac(2 * a * u1 + b * u2, 5);
      return build('방향도함수',
        `$f(x,y) = ${cx(a)}x^2 + ${cx(b)}y$ 의 점 $(1,\\ 1)$ 에서 단위벡터 $\\mathbf{u} = \\left(\\tfrac{${u1}}{5},\\ \\tfrac{${u2}}{5}\\right)$ 방향의 방향도함수 값은?`,
        T(ans),
        [frac(2 * a * u2 + b * u1, 5), String(2 * a + b), frac(a * u1 + b * u2, 5), frac(2 * a * u1 + b * u2, 25), String(2 * a * u1 + b * u2), frac(2 * a * u1 + b * u2 + 1, 5)].map(T),
        `$\\nabla f(1,1) = (${2 * a},\\ ${b})$, $D_{\\mathbf u} f = \\nabla f \\cdot \\mathbf u = \\dfrac{${2 * a}\\cdot ${u1} + ${b}\\cdot ${u2}}{5} = ${ans}$`);
    },

    function laplacian() {
      const a = ri(1, 2), b = nz(-3, 3), c = ri(1, 3), p = ri(-2, 2);
      const f = poly([[a, 'x^3'], [b, 'y^2'], [c, 'xy']]);
      const ans = 6 * a * p + 2 * b;
      return num('라플라시안',
        `$f(x,y) = ${f}$ 에 대해 $\\nabla^2 f = f_{xx} + f_{yy}$ 의 점 $(${p},\\ 1)$ 에서의 값은?`, ans,
        [ans + 2 * c, 3 * a * p * p + 2 * b, 6 * a * p + b, ans + c, 2 * b - 6 * a * p],
        `$f_{xx} = ${6 * a}x$, $f_{yy} = ${2 * b}$ ($xy$ 항은 두 번 미분하면 사라짐) → $${6 * a}\\cdot(${p})${signed(2 * b)} = ${ans}$`);
    },

    function heat() {
      const b = ri(2, 4), al = pick([1, 1, 2, 3]);
      const ans = al * b * b;
      const eq = al === 1 ? 'u_t = u_{xx}' : `u_t = ${al}u_{xx}`;
      return num('열방정식',
        `$u(x,t) = e^{-kt}\\sin ${b}x$ 가 열방정식 $${eq}$ 을 만족하려면 상수 $k$ 는?`, ans,
        [al * b, b * b, al * al * b * b, -ans, 2 * al * b, b],
        `$u_t = -k\\,u$, $u_{xx} = -${b * b}\\,u$ → $-k = -${al === 1 ? '' : al + '\\cdot '}${b * b}$ → $k = ${ans}$`);
    },

    function wave() {
      const a = ri(2, 3), b = ri(1, 3);
      const ans = a * b;
      return num('파동방정식',
        `$u(x,t) = \\sin(${cx(b)}x - ct)$ 가 파동방정식 $u_{tt} = ${a * a}u_{xx}$ 를 만족할 때, 양수 $c$ 의 값은?`, ans,
        [a * a * b, a * b * b, a * a * b * b, a + b, a, b],
        `$u_{tt} = -c^2 u$, $u_{xx} = -${cx(b * b)}u$ → $c^2 = ${a * a}\\cdot ${b * b}$ → $c = ${ans}$`);
    },

    function classify() {
      const cls = pick(['타원형', '포물형', '쌍곡형']);
      let A, B, C, D;
      if (cls === '포물형') {
        const m = ri(1, 2), n = ri(1, 2), s = pick([1, -1]);
        A = s * m * m; C = s * n * n; B = pick([1, -1]) * 2 * m * n * s;
      } else {
        do {
          A = nz(-3, 3); B = ri(-4, 4); C = nz(-3, 3);
          D = B * B - 4 * A * C;
        } while (cls === '타원형' ? D >= 0 : D <= 0);
      }
      D = B * B - 4 * A * C;
      const eq = poly([[A, 'u_{xx}'], [B, 'u_{xy}'], [C, 'u_{yy}']]) + ' = 0';
      return build('PDE 분류',
        `2계 편미분방정식 $${eq}$ 의 유형은?`,
        cls,
        shuffle(['타원형', '포물형', '쌍곡형', '판정할 수 없음']),
        `$Au_{xx} + Bu_{xy} + Cu_{yy} = 0$ 에서 판별식 $B^2 - 4AC = ${B * B} - 4\\cdot(${A})\\cdot(${C}) = ${D}$ → ${D < 0 ? '음수이므로 타원형' : D === 0 ? '0이므로 포물형' : '양수이므로 쌍곡형'}`);
    },

    function orderLinear() {
      const [eq, ans, why] = pick([
        ['u_t + u\\,u_x = 0', '1계 비선형', '$u\\,u_x$ 항이 비선형 (버거스 방정식)'],
        ['u_{tt} = 4u_{xx}', '2계 선형', '파동방정식은 2계 선형'],
        ['u_t = u_{xxx} + u_x', '3계 선형', '최고계 도함수 $u_{xxx}$, 모든 항이 1차'],
        ['(u_x)^2 + (u_y)^2 = 1', '1계 비선형', '도함수의 제곱 항 (아이코날 방정식)'],
        ['u_x + 3u_y = 0', '1계 선형', '1계 도함수만 1차로 등장'],
        ['u_{xx} + u_{yy} = \\sin u', '2계 비선형', '$\\sin u$ 가 $u$ 에 대해 비선형'],
        ['u_t = u_{xx} + x^2 u', '2계 선형', '계수 $x^2$ 는 독립변수 함수라 선형성 유지'],
        ['u_t + u_{xxx} + 6u\\,u_x = 0', '3계 비선형', 'KdV 방정식: $u\\,u_x$ 항이 비선형'],
        ['x\\,u_x + y\\,u_y = u', '1계 선형', '계수가 $x, y$ 에만 의존 → 선형'],
      ]);
      return build('PDE 계수·선형성',
        `편미분방정식 $${eq}$ 의 계수(order)와 선형성은?`,
        ans,
        shuffle(['1계 선형', '1계 비선형', '2계 선형', '2계 비선형', '3계 선형', '3계 비선형']),
        `${why} → ${ans}`);
    },

    function harmonic() {
      const [g, why] = pick([
        ['x^2 - y^2', '$u_{xx} = 2,\\ u_{yy} = -2$'],
        ['xy', '$u_{xx} = u_{yy} = 0$'],
        ['e^x\\cos y', '$u_{xx} = e^x\\cos y,\\ u_{yy} = -e^x\\cos y$'],
        ['e^x\\sin y', '$u_{xx} = e^x\\sin y,\\ u_{yy} = -e^x\\sin y$'],
        ['x^3 - 3xy^2', '$u_{xx} = 6x,\\ u_{yy} = -6x$'],
      ]);
      const bads = shuffle(['x^2 + y^2', 'x^2y', 'e^{x+y}', '\\sin x\\sin y', 'x^3 + y^3', 'xy^2']);
      return build('라플라스 방정식',
        `다음 중 라플라스 방정식 $u_{xx} + u_{yy} = 0$ 을 만족하는 함수는?`,
        T(`u = ${g}`),
        bads.map(b => T(`u = ${b}`)),
        `${why} → 합이 $0$ 이므로 조화함수`);
    },

    function chainMulti() {
      const m = ri(1, 3), n = ri(1, 3);
      const ans = m + 2 * n;
      return num('다변수 연쇄법칙',
        `$z = ${pw('x', m)}${pw('y', n)}$, $x = t$, $y = t^2$ 일 때 $t = 1$ 에서 $\\dfrac{dz}{dt}$ 의 값은?`, ans,
        [m + n, m * n, 2 * m * n, 2 * m + n, ans + 1],
        `$\\dfrac{dz}{dt} = z_x\\dfrac{dx}{dt} + z_y\\dfrac{dy}{dt} = z_x + 2t\\,z_y$, $t = 1$ 이면 $x = y = 1$: $${m} + 2\\cdot ${n} = ${ans}$`);
    },

    function lhopital() {
      const a = ri(1, 4);
      const ans = frac(a * a, 2);
      return build('로피탈 정리',
        `$\\displaystyle\\lim_{x \\to 0} \\frac{1 - \\cos ${cx(a)}x}{x^2}$ 의 값은?`,
        T(ans),
        [frac(a, 2), String(a * a), frac(a * a, 4), '0', String(2 * a * a), frac(1, 2), '1'].map(T),
        `로피탈 두 번: $\\dfrac{${cx(a)}\\sin ${cx(a)}x}{2x} \\to \\dfrac{${a * a}\\cos ${cx(a)}x}{2} \\to ${ans}$`);
    },

    function taylor() {
      const a = ri(1, 3), n = ri(2, 3);
      const fact = n === 2 ? 2 : 6;
      const ans = frac(a ** n, fact);
      return build('테일러 급수',
        `$e^{${cx(a)}x}$ 의 매클로린 급수에서 $x^{${n}}$ 의 계수는?`,
        T(ans),
        [frac(a ** n, n), frac(a, fact), String(a ** n), frac(a ** (n - 1), fact), frac(a ** n, fact * 2), frac(a ** n + 1, fact), frac(a ** n, fact + 1), String(fact)].map(T),
        `$e^{u} = \\sum_k \\dfrac{u^k}{k!}$, $u = ${cx(a)}x$ → $\\dfrac{${a}^{${n}}}{${n}!} = ${ans}$`);
    },

    function doubleInt() {
      const a = ri(1, 3), b = ri(1, 3);
      const ans = frac(a * a * b * b, 4);
      return build('이중적분',
        `$\\displaystyle\\int_0^{${a}}\\!\\!\\int_0^{${b}} xy\\,dy\\,dx$ 의 값은?`,
        T(ans),
        [frac(a * b, 4), frac(a * a * b * b, 2), String(a * a * b * b), frac(a * b, 2), frac(a * a * b * b, 8), frac(a * a * b * b + 1, 4)].map(T),
        `$\\displaystyle\\int_0^{${a}} x\\,dx \\cdot \\int_0^{${b}} y\\,dy = \\frac{${a * a}}{2}\\cdot\\frac{${b * b}}{2} = ${ans}$`);
    },

    function byParts() {
      const [q, ans, wrongs, why] = pick([
        ['\\int_0^1 x e^x\\,dx', '1', ['e', 'e - 1', '2', '0'], '$\\left[xe^x - e^x\\right]_0^1 = 0 - (-1) = 1$'],
        ['\\int_0^{\\pi} x\\sin x\\,dx', '\\pi', ['2', '0', '-\\pi', '2\\pi'], '$\\left[-x\\cos x + \\sin x\\right]_0^{\\pi} = \\pi$'],
        ['\\int_1^{e} \\ln x\\,dx', '1', ['e', 'e - 1', '0', 'e + 1'], '$\\left[x\\ln x - x\\right]_1^{e} = 0 - (-1) = 1$'],
      ]);
      return build('부분적분',
        `$\\displaystyle ${q}$ 의 값은?`,
        T(ans), shuffle(wrongs).map(T), `부분적분: ${why}`);
    },

    function jacobian() {
      const k = ri(2, 5);
      return build('야코비안',
        `극좌표 $x = r\\cos\\theta,\\ y = r\\sin\\theta$ 에서 $\\left|\\dfrac{\\partial(x,y)}{\\partial(r,\\theta)}\\right|$ 의 $r = ${k}$ 에서의 값은?`,
        T(String(k)),
        [String(k * k), '1', frac(1, k), String(2 * k), '0'].map(T),
        `$\\det\\begin{pmatrix}\\cos\\theta & -r\\sin\\theta \\\\ \\sin\\theta & r\\cos\\theta\\end{pmatrix} = r(\\cos^2\\theta + \\sin^2\\theta) = r = ${k}$`);
    },

    function transport() {
      const a = ri(2, 4);
      return build('1계 PDE (수송방정식)',
        `편미분방정식 $u_x + ${a}u_y = 0$ 의 일반해는? ($f$ 는 임의의 미분가능 함수)`,
        T(`u = f(y - ${a}x)`),
        shuffle([`u = f(y + ${a}x)`, `u = f(x - ${a}y)`, `u = f(x + ${a}y)`, `u = f(${a}y - x)`]).map(T),
        `$u = f(y - ${a}x)$ 이면 $u_x = -${a}f'$, $u_y = f'$ → $u_x + ${a}u_y = 0$ (특성선 $y - ${a}x =$ 상수)`);
    },
  ];

  const POOLS = { easy: EASY, hard: HARD };
  let lastName = '';

  function generate(level) {
    const pool = POOLS[level] || EASY;
    for (let tries = 0; tries < 20; tries++) {
      const g = pick(pool);
      if (g.name === lastName && pool.length > 1) continue;
      try {
        const p = g();
        lastName = g.name;
        p.level = level;
        return p;
      } catch (e) { /* 보기 부족 등 → 다시 생성 */ }
    }
    throw new Error('문제 생성 실패');
  }

  global.MathProblems = { generate, EASY, HARD };
})(typeof window !== 'undefined' ? window : globalThis);
