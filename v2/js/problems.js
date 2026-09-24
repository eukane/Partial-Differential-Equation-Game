/*
 * 수학 문제 생성기 — 과목 4개(공통 수학Ⅰ·Ⅱ / 미적분 / 확률과 통계 / 기하) × 난이도 2단계
 *  - easy : 고3 기본 (미분계수, 극한, 합성함수/곱의 미분, 정적분, 극값 …)
 *  - hard : 고3 심화 · 수능 미적분 킬러 유형 (미정계수, 역함수/음함수/매개변수 미분,
 *           정적분으로 정의된 함수, 급수, 넓이, 치환/부분적분, 변곡점, 미분가능성 …)
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
  //  심화 (고3 상위권: 수능 미적분 킬러 유형)
  // =====================================================================
  const HARD = [
    function undeterminedLimit() {
      // lim_{x→a} (x² + bx + c)/(x − a) = k  →  분자 = (x − a)(x + m), a + m = k
      const a = ri(1, 3), k = ri(a + 1, a + 5);
      const m = k - a;
      const b = m - a, c = -a * m;
      const ans = b + c;
      return num('미정계수 극한',
        `$\\displaystyle\\lim_{x \\to ${a}} \\frac{x^2 + bx + c}{x - ${a}} = ${k}$ 일 때, $b + c$ 의 값은?`, ans,
        [b - c, b * c, b, c, k - a],
        `분모 $\\to 0$ 이므로 분자도 $x = ${a}$ 에서 $0$. 분자 $= (x - ${a})(x + p)$ 로 두면 극한값은 $${a} + p = ${k}$ → $p = ${m}$. `
        + `$(x - ${a})(x${signed(m)}) = x^2${tail([[b, 'x'], [c, '']])}$ 이므로 $b + c = ${ans}$`);
    },

    function inverseDeriv() {
      // f(x) = x³ + ax + b, g = f⁻¹,  g'(f(t)) = 1 / f'(t)
      const a = ri(1, 4), b = ri(-3, 3), t = pick([1, 2, -1]);
      const v = t ** 3 + a * t + b;
      const fp = 3 * t * t + a;
      return build('역함수의 미분',
        `$f(x) = x^3${tail([[a, 'x'], [b, '']])}$ 의 역함수를 $g(x)$ 라 할 때, $g'(${v})$ 의 값은?`,
        T(frac(1, fp)),
        [String(fp), frac(1, 3 * v * v + a), frac(1, 3 * t + a), frac(1, a), frac(-1, fp), frac(2, fp)].map(T),
        `$f(${t}) = ${v}$ 이므로 $g(${v}) = ${t}$. $g'(${v}) = \\dfrac{1}{f'(${t})} = \\dfrac{1}{3\\cdot ${t * t} + ${a}} = ${frac(1, fp)}$`);
    },

    function integralDefined() {
      // ∫_1^x f(t) dt = x³ + ax² + bx  (모든 x) → x = 1 대입해 b, 미분해 f
      const a = ri(-3, 3), k = pick([2, 3, -1]);
      const b = -1 - a;
      const ans = 3 * k * k + 2 * a * k + b;
      return num('정적분으로 정의된 함수',
        `모든 실수 $x$ 에 대하여 $\\displaystyle\\int_1^x f(t)\\,dt = x^3${tail([[a, 'x^2']])} + bx$ 일 때, $f(${k})$ 의 값은?`, ans,
        [3 * k * k + 2 * a * k, 3 * k * k + 2 * a * k + 1 + a, k ** 3 + a * k * k + b * k, 3 * k * k + a * k + b],
        `$x = 1$ 대입: $0 = 1${signed(a)} + b$ → $b = ${b}$. 양변 미분: $f(x) = 3x^2${tail([[2 * a, 'x'], [b, '']])}$ → $f(${k}) = ${ans}$`);
    },

    function implicitDeriv() {
      // x² + axy + y² = C 위의 점 (p, q) 에서 dy/dx = −(2x + ay)/(ax + 2y)
      let a, p, q, den;
      do { a = nz(-3, 3); p = nz(-2, 2); q = nz(-2, 2); den = a * p + 2 * q; } while (den === 0 || 2 * p + a * q === 0);
      const C = p * p + a * p * q + q * q;
      const numr = -(2 * p + a * q);
      const ans = frac(numr, den);
      return build('음함수의 미분',
        `곡선 $x^2${tail([[a, 'xy']])} + y^2 = ${C}$ 위의 점 $(${p},\\ ${q})$ 에서의 접선의 기울기는?`,
        T(ans),
        [frac(-numr, den), frac(den, numr), frac(-den, numr), frac(-2 * p, 2 * q), frac(numr, den + 1), frac(numr - 1, den)].map(T),
        `양변을 $x$ 로 미분해 $\\dfrac{dy}{dx}$ 로 정리하면 $\\dfrac{dy}{dx} = -\\dfrac{2x${tail([[a, 'y']])}}{${cx(a)}x + 2y}$, 점 $(${p}, ${q})$ 대입 → $${ans}$`);
    },

    function parametricDeriv() {
      let a, b, k;
      do { a = ri(-3, 3); b = ri(-3, 3); k = pick([1, 2, -1]); } while (2 * k + a === 0 || 3 * k * k + b === 0);
      const top = 3 * k * k + b, bot = 2 * k + a;
      const ans = frac(top, bot);
      return build('매개변수 미분',
        `$x = t^2${tail([[a, 't']])},\\ y = t^3${tail([[b, 't']])}$ 일 때, $t = ${k}$ 에서 $\\dfrac{dy}{dx}$ 의 값은?`,
        T(ans),
        [frac(bot, top), frac(-top, bot), frac(6 * k, 2), frac(top, bot + 1), frac(top + 1, bot), String(top * bot)].map(T),
        `$\\dfrac{dx}{dt} = 2t${signed(a)}$, $\\dfrac{dy}{dt} = 3t^2${signed(b)}$ → $\\dfrac{dy}{dx} = \\dfrac{${top}}{${bot}} = ${ans}$`);
    },

    function eLimit() {
      const a = ri(1, 3), b = ri(2, 4);
      const e = n => (n === 1 ? 'e' : `e^{${n}}`);
      const form = pick([
        [`\\displaystyle\\lim_{x \\to 0} (1 + ${a}x)^{\\frac{${b}}{x}}`, `$(1 + ${a}x)^{\\frac{1}{${a}x}} \\to e$ 이므로 지수 $\\frac{${b}}{x} = ${a * b}\\cdot\\frac{1}{${a}x}$ →`],
        [`\\displaystyle\\lim_{n \\to \\infty} \\left(1 + \\frac{${a}}{n}\\right)^{${b}n}`, `$\\left(1 + \\frac{${a}}{n}\\right)^{\\frac{n}{${a}}} \\to e$ 이므로 지수 $${b}n = ${a * b}\\cdot\\frac{n}{${a}}$ →`],
      ]);
      return build('e 의 정의',
        `$${form[0]}$ 의 값은?`,
        T(e(a * b)),
        [e(a + b), `e^{${frac(a, b)}}`, `e^{${frac(b, a)}}`, e(2 * a * b), String(a * b), `e^{${a * b}} - 1`].map(T),
        `${form[1]} $${e(a * b)}$`);
    },

    function geometricSeries() {
      const c = ri(4, 7);
      const ans = frac(2 * (c - 3) + 3 * (c - 2), (c - 2) * (c - 3));
      return build('등비급수',
        `$\\displaystyle\\sum_{n=1}^{\\infty} \\frac{2^n + 3^n}{${c}^n}$ 의 값은?`,
        T(ans),
        [frac(c * (c - 3) + c * (c - 2), (c - 2) * (c - 3)), frac(2, c - 2), frac(3, c - 3), frac(5, c - 5 > 0 ? c - 5 : c), frac(2 * (c - 3) + 3 * (c - 2) + 1, (c - 2) * (c - 3))].map(T),
        `첫째항 $\\frac{2}{${c}}$, 공비 $\\frac{2}{${c}}$ 인 급수의 합 $\\frac{2}{${c - 2}}$ 와 첫째항 $\\frac{3}{${c}}$, 공비 $\\frac{3}{${c}}$ 인 급수의 합 $\\frac{3}{${c - 3}}$ 을 더하면 $${ans}$`);
    },

    function sqrtSeqLimit() {
      let a, b;
      do { a = ri(1, 8); b = ri(-4, 6); } while (a === b);
      const ans = frac(a - b, 2);
      const inner = (k) => `n^2${tail([[k, 'n']])}`;
      return build('수열의 극한',
        `$\\displaystyle\\lim_{n \\to \\infty} \\left(\\sqrt{${inner(a)}} - \\sqrt{${inner(b)}}\\right)$ 의 값은?`,
        T(ans),
        [frac(a + b, 2), String(a - b), '0', frac(a - b, 4), frac(b - a, 2), '1'].map(T),
        `분자를 유리화: $\\dfrac{${a - b}n}{\\sqrt{${inner(a)}} + \\sqrt{${inner(b)}}} \\to \\dfrac{${a - b}}{1 + 1} = ${ans}$`);
    },

    function areaBetween() {
      const k = ri(1, 4), m = pick([1, 2]);
      // y = m x² 와 y = k x 사이 넓이: 교점 x = k/m,  ∫ (kx − mx²) = k³ / (6m²)
      const ans = frac(k ** 3, 6 * m * m);
      return build('정적분과 넓이',
        `곡선 $y = ${cx(m)}x^2$ 과 직선 $y = ${cx(k)}x$ 로 둘러싸인 부분의 넓이는?`,
        T(ans),
        [frac(k ** 3, 3 * m * m), frac(k ** 3, 2 * m * m), frac(k * k, 6 * m), frac(k ** 3, 12 * m * m), frac(k ** 3, 6 * m), frac(k ** 3 + 1, 6 * m * m)].map(T),
        `교점 $x = 0,\\ ${frac(k, m)}$. $\\displaystyle\\int_0^{${frac(k, m)}} (${cx(k)}x - ${cx(m)}x^2)\\,dx = ${ans}$ (공식 $\\frac{|a|}{6}(\\beta - \\alpha)^3$)`);
    },

    function substitution() {
      const n = ri(1, 3);
      const ans = frac(2 ** (n + 1) - 1, 2 * (n + 1));
      return build('치환적분',
        `$\\displaystyle\\int_0^1 x(x^2 + 1)^{${n}}\\,dx$ 의 값은?`,
        T(ans),
        [frac(2 ** (n + 1) - 1, n + 1), frac(2 ** (n + 1), 2 * (n + 1)), frac(2 ** n - 1, 2 * n), frac(2 ** (n + 1) - 1, 4 * (n + 1)), frac(2 ** (n + 1) + 1, 2 * (n + 1))].map(T),
        `$u = x^2 + 1$, $du = 2x\\,dx$: $\\displaystyle\\frac{1}{2}\\int_1^2 u^{${n}}\\,du = \\frac{1}{2}\\cdot\\frac{2^{${n + 1}} - 1}{${n + 1}} = ${ans}$`);
    },

    function byParts() {
      const [q, ans, wrongs, why] = pick([
        ['\\int_1^{e} x\\ln x\\,dx', '\\frac{e^2 + 1}{4}', ['\\frac{e^2 - 1}{4}', '\\frac{e^2 + 1}{2}', '\\frac{e^2}{4}', '\\frac{e^2 - 1}{2}'], '$\\left[\\frac{x^2}{2}\\ln x - \\frac{x^2}{4}\\right]_1^{e} = \\frac{e^2}{4} + \\frac{1}{4}$'],
        ['\\int_0^{\\frac{\\pi}{2}} x\\cos x\\,dx', '\\frac{\\pi}{2} - 1', ['\\frac{\\pi}{2} + 1', '\\frac{\\pi}{2}', '1', '\\pi - 1'], '$\\left[x\\sin x + \\cos x\\right]_0^{\\frac{\\pi}{2}} = \\frac{\\pi}{2} - 1$'],
        ['\\int_0^{1} x e^{x}\\,dx', '1', ['e - 1', 'e', '2', 'e - 2'], '$\\left[xe^x - e^x\\right]_0^1 = 0 - (-1) = 1$'],
        ['\\int_1^{e} \\ln x\\,dx', '1', ['e - 1', 'e', '0', 'e + 1'], '$\\left[x\\ln x - x\\right]_1^{e} = 0 - (-1) = 1$'],
      ]);
      return build('부분적분', `$\\displaystyle ${q}$ 의 값은?`, T(ans), shuffle(wrongs).map(T), `부분적분: ${why}`);
    },

    function inflection() {
      // f = (x² + px)eˣ → f'' = (x² + (p+4)x + 2p + 2)eˣ, 판별식 p² + 8 > 0
      const p = ri(-3, 3);
      const ans = -(p + 4);
      return num('변곡점',
        `함수 $f(x) = (x^2${tail([[p, 'x']])})e^x$ 의 그래프의 두 변곡점의 $x$ 좌표의 합은?`, ans,
        [-(p + 2), p + 4, 2 * p + 2, -(2 * p + 2), -p],
        `$f'(x) = (x^2${tail([[p + 2, 'x'], [p, '']])})e^x$, $f''(x) = (x^2${tail([[p + 4, 'x'], [2 * p + 2, '']])})e^x$. `
        + `판별식 $${p * p + 8} > 0$ 이고 부호가 바뀌므로 근과 계수의 관계로 합은 $${ans}$`);
    },

    function trigLimit() {
      const a = ri(1, 4), b = ri(1, 3);
      const ans = frac(a * a, 2 * b);
      return build('삼각함수의 극한',
        `$\\displaystyle\\lim_{x \\to 0} \\frac{1 - \\cos ${cx(a)}x}{x\\sin ${cx(b)}x}$ 의 값은?`,
        T(ans),
        [frac(a * a, b), frac(a, 2 * b), frac(a * a, 4 * b), frac(a, b), frac(b, a * a), '0'].map(T),
        `$1 - \\cos ${cx(a)}x = 2\\sin^2\\frac{${cx(a)}x}{2} \\approx \\frac{${a * a}x^2}{2}$, $x\\sin ${cx(b)}x \\approx ${cx(b)}x^2$ → $${ans}$`);
    },

    function differentiable() {
      // x<k: x² + ax + b,  x≥k: mx  가 x = k 에서 미분가능 → 2k + a = m, b = k²
      const k = ri(1, 2), m = ri(3, 7);
      const a = m - 2 * k, b = k * k;
      const ans = a + b;
      return num('미분가능성',
        `함수 $f(x) = \\begin{cases} x^2 + ax + b & (x < ${k}) \\\\ ${m}x & (x \\ge ${k}) \\end{cases}$ 가 $x = ${k}$ 에서 미분가능할 때, $a + b$ 의 값은?`, ans,
        [a - b, a, b, m + b, a * b],
        `미분계수: $${2 * k} + a = ${m}$ → $a = ${a}$. 연속: $${k * k} + ${k}a + b = ${m * k}$ → $b = ${b}$. 따라서 $a + b = ${ans}$`);
    },
  ];

  // =====================================================================
  //  공통 (수학Ⅰ · 수학Ⅱ) 추가 문제
  // =====================================================================
  const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
  const C = (n, r) => (r < 0 || r > n ? 0 : fact(n) / (fact(r) * fact(n - r)));
  const P = (n, r) => fact(n) / fact(n - r);

  const COMMON_EXTRA_EASY = [
    function logCalc() {
      const a = pick([6, 10, 12, 15]), k = pick([2, 3]);
      const total = a ** k;
      const divs = [];
      for (let d = 2; d < total; d++) if (total % d === 0 && Math.log(d) / Math.log(a) % 1 !== 0) divs.push(d);
      const p = pick(divs), q = total / p;
      return num('로그의 계산',
        `$\\log_{${a}} ${p} + \\log_{${a}} ${q}$ 의 값은?`, k,
        [k + 1, k - 1, 2 * k, p + q, 1],
        `$\\log_{${a}} ${p} + \\log_{${a}} ${q} = \\log_{${a}} ${total} = \\log_{${a}} ${a}^{${k}} = ${k}$`);
    },

    function expEquation() {
      const c = pick([2, 3]), p = pick([2, 3]), m = ri(1, 3), a = ri(-3, 3);
      const ans = p * m - a;
      return num('지수방정식',
        `방정식 $${c}^{x${signed(a)}} = ${c ** p}^{${m}}$ 의 해는?`, ans,
        [p * m + a, m - a, p + m - a, p * m],
        `$${c ** p}^{${m}} = ${c}^{${p * m}}$ 이므로 $x${signed(a)} = ${p * m}$ → $x = ${ans}$`);
    },

    function arithSeq() {
      const a = ri(-5, 8), d = nz(-4, 5);
      const a3 = a + 2 * d, a7 = a + 6 * d, ans = a + 9 * d;
      return num('등차수열',
        `등차수열 $\\{a_n\\}$ 에서 $a_3 = ${a3},\\ a_7 = ${a7}$ 일 때, $a_{10}$ 의 값은?`, ans,
        [a + 10 * d, a + 8 * d, a7 + 4 * d, a7 + 2 * d],
        `$4d = ${a7} - (${a3}) = ${4 * d}$ → $d = ${d}$. $a_{10} = a_7 + 3d = ${a7}${signed(3 * d)} = ${ans}$`);
    },

    function geoSum() {
      const a = ri(1, 3), r = pick([2, 3]), n = ri(3, 5);
      const S = k => a * (r ** k - 1) / (r - 1);
      const ans = S(n);
      return num('등비수열의 합',
        `첫째항이 $${a}$, 공비가 $${r}$ 인 등비수열의 첫째항부터 제${n}항까지의 합은?`, ans,
        [a * r ** n, a * r ** (n - 1), S(n - 1), S(n + 1)],
        `$S_{${n}} = \\dfrac{${a}(${r}^{${n}} - 1)}{${r} - 1} = ${ans}$`);
    },

    function sigmaSum() {
      const n = ri(5, 10), c = ri(-3, 3);
      const ans = n * (n + 1) + c * n;
      return num('수열의 합 (∑)',
        `$\\displaystyle\\sum_{k=1}^{${n}} (2k${signed(c)})$ 의 값은?`, ans,
        [n * (n + 1) / 2 + c * n, n * n + c * n, n * (n + 1) + c, n * (n - 1) + c * n],
        `$2\\displaystyle\\sum k + ${c}\\cdot ${n} = 2\\cdot\\frac{${n}\\cdot ${n + 1}}{2}${signed(c * n)} = ${ans}$`);
    },

    function trigSpecial() {
      const vals = [
        ['0', 0], ['\\frac{1}{2}', 0.5], ['-\\frac{1}{2}', -0.5], ['\\frac{\\sqrt{3}}{2}', Math.sqrt(3) / 2], ['-\\frac{\\sqrt{3}}{2}', -Math.sqrt(3) / 2],
        ['\\frac{\\sqrt{2}}{2}', Math.SQRT1_2], ['-\\frac{\\sqrt{2}}{2}', -Math.SQRT1_2], ['1', 1], ['-1', -1], ['\\sqrt{3}', Math.sqrt(3)], ['-\\sqrt{3}', -Math.sqrt(3)],
        ['\\frac{\\sqrt{3}}{3}', Math.sqrt(3) / 3], ['-\\frac{\\sqrt{3}}{3}', -Math.sqrt(3) / 3],
      ];
      for (;;) {
        const den = pick([3, 4, 6]);
        const k = ri(1, 2 * den - 1);
        if (k % den === 0) continue;
        const fn = pick(['sin', 'cos', 'tan']);
        const th = k * Math.PI / den;
        if (fn === 'tan' && Math.abs(Math.cos(th)) < 1e-9) continue;
        const v = Math[fn](th);
        const hit = vals.find(x => Math.abs(x[1] - v) < 1e-9);
        if (!hit) continue;
        const g = gcd(k, den), a = k / g, b = den / g;
        const angle = b === 1 ? `${cx(a)}\\pi` : `\\frac{${cx(a)}\\pi}{${b}}`;
        const wrongs = shuffle(vals.filter(x => x !== hit));
        return build('삼각함수의 값',
          `$\\${fn} ${angle}$ 의 값은?`,
          T(hit[0]), wrongs.map(x => T(x[0])),
          `$\\${fn} ${angle} = ${hit[0]}$ (단위원 위 각의 좌표로 계산)`);
      }
    },
  ];

  const COMMON_EXTRA_HARD = [
    function recurrence() {
      const s = ri(1, 4), c = ri(-2, 3), k = ri(4, 6);
      const seq = [s];
      for (let i = 1; i < k + 1; i++) seq.push(2 * seq[i - 1] + c);
      const ans = seq[k - 1];
      return num('수열의 귀납적 정의',
        `$a_1 = ${s},\\ a_{n+1} = 2a_n${signed(c)}$ 일 때, $a_{${k}}$ 의 값은?`, ans,
        [seq[k], seq[k - 2], 2 ** (k - 1) * s, ans + c],
        `차례로 구하면 $${seq.slice(0, k).join(',\\ ')}$ → $a_{${k}} = ${ans}$`);
    },

    function logEquation() {
      const i = ri(1, 2), j = ri(i + 1, 4);
      const x = (2 ** i + 2 ** j) / 2, a = (2 ** j - 2 ** i) / 2, k = i + j;
      return num('로그방정식',
        `방정식 $\\log_2 (x + ${a}) + \\log_2 (x - ${a}) = ${k}$ 의 해는?`, x,
        [-x, x + a, 2 ** k, x * x, k],
        `진수 조건 $x > ${a}$. $(x + ${a})(x - ${a}) = 2^{${k}}$ → $x^2 = ${2 ** k + a * a}$ → $x = ${x}$ ($-${x}$ 는 진수 조건에 맞지 않음)`);
    },

    function trigQuadMax() {
      const a = pick([-4, -2, 2, 4]), b = ri(-2, 3);
      // cos²x + a sin x + b = −t² + a t + (b + 1),  t = sin x ∈ [−1, 1]
      const ans = Math.abs(a) <= 2 ? a * a / 4 + b + 1 : Math.abs(a) + b;
      return num('삼각함수의 최대·최소',
        `함수 $f(x) = \\cos^2 x${tail([[a, '\\sin x']])}${signed(b)}$ 의 최댓값은?`, ans,
        [a * a / 4 + b + 1, Math.abs(a) + b, b + 1, a * a / 4 + b, Math.abs(a) + b + 1].filter(v => v !== ans),
        `$\\sin x = t$ ($-1 \\le t \\le 1$) 로 두면 $f = -t^2${tail([[a, 't']])}${signed(b + 1)}$. `
        + (Math.abs(a) <= 2 ? `꼭짓점 $t = ${frac(a, 2)}$ 에서 최대 $${ans}$` : `꼭짓점이 범위 밖이므로 $t = ${a > 0 ? 1 : -1}$ 에서 최대 $${ans}$`));
    },

    function telescoping() {
      const n = ri(5, 12);
      if (Math.random() < 0.5) {
        return build('∑ 부분분수',
          `$\\displaystyle\\sum_{k=1}^{${n}} \\frac{1}{k(k+1)}$ 의 값은?`,
          T(frac(n, n + 1)),
          [frac(n + 1, n + 2), frac(n - 1, n), frac(1, n + 1), frac(n, 2 * (n + 1)), frac(2 * n, n + 1)].map(T),
          `$\\frac{1}{k(k+1)} = \\frac{1}{k} - \\frac{1}{k+1}$ → 합 $= 1 - \\frac{1}{${n + 1}} = ${frac(n, n + 1)}$`);
      }
      return build('∑ 부분분수',
        `$\\displaystyle\\sum_{k=1}^{${n}} \\frac{1}{(2k-1)(2k+1)}$ 의 값은?`,
        T(frac(n, 2 * n + 1)),
        [frac(2 * n, 2 * n + 1), frac(n, 2 * n - 1), frac(n + 1, 2 * n + 1), frac(n, 4 * n + 2), frac(1, 2 * n + 1)].map(T),
        `$\\frac{1}{(2k-1)(2k+1)} = \\frac{1}{2}\\left(\\frac{1}{2k-1} - \\frac{1}{2k+1}\\right)$ → $\\frac{1}{2}\\left(1 - \\frac{1}{${2 * n + 1}}\\right) = ${frac(n, 2 * n + 1)}$`);
    },
  ];

  // =====================================================================
  //  미적분 추가
  // =====================================================================
  const CALC_EXTRA_EASY = [
    function quotientDeriv() {
      let a, b;
      do { a = ri(-3, 3); b = ri(1, 4); } while (b - 1 - 2 * a === 0);
      const ans = frac(b - 1 - 2 * a, (1 + b) ** 2);
      return build('몫의 미분',
        `$f(x) = \\dfrac{x${signed(a)}}{x^2 + ${b}}$ 일 때, $f'(1)$ 의 값은?`,
        T(ans),
        [frac(b + 1 + 2 * a, (1 + b) ** 2), frac(b - 1 - 2 * a, 1 + b), frac(1, 2), frac(-(b - 1 - 2 * a), (1 + b) ** 2), frac(b - 1 - 2 * a + 1, (1 + b) ** 2), frac(1 - 2 * a, (1 + b) ** 2), frac(b - 1 - 2 * a, 2 * (1 + b) ** 2), frac(b + 2 * a, (1 + b) ** 2), frac(b - 2 * a, (1 + b) ** 2)].map(T),
        `$f'(x) = \\dfrac{(x^2 + ${b}) - (x${signed(a)})\\cdot 2x}{(x^2 + ${b})^2}$ → $f'(1) = \\dfrac{${1 + b} - ${2 * (1 + a)}}{${(1 + b) ** 2}} = ${ans}$`);
    },
  ];

  // =====================================================================
  //  확률과 통계
  // =====================================================================
  const PROB_EASY = [
    function permutation() {
      const n = ri(5, 7), r = ri(2, 3);
      return num('순열',
        `서로 다른 ${n}권의 책 중 ${r}권을 골라 책꽂이에 일렬로 꽂는 경우의 수는?`, P(n, r),
        [C(n, r), n ** r, P(n, r + 1), P(n - 1, r)],
        `$_{${n}}\\mathrm{P}_{${r}} = ${Array.from({ length: r }, (_, i) => n - i).join('\\times ')} = ${P(n, r)}$`);
    },
    function combination() {
      const n = ri(6, 9), r = ri(2, 4);
      return num('조합',
        `${n}명 중 대표 ${r}명을 뽑는 경우의 수는?`, C(n, r),
        [P(n, r), C(n, r + 1), C(n - 1, r), C(n, r - 1)],
        `$_{${n}}\\mathrm{C}_{${r}} = \\dfrac{${n}!}{${r}!\\,${n - r}!} = ${C(n, r)}$`);
    },
    function repComb() {
      const n = ri(3, 4), r = ri(3, 5);
      const ans = C(n + r - 1, r);
      return num('중복조합',
        `서로 다른 ${n}종류의 사탕 중에서 중복을 허락하여 ${r}개를 고르는 경우의 수는?`, ans,
        [C(n + r, r), n ** r, C(n + r - 1, r - 1) === ans ? C(n + r - 2, r) : C(n + r - 1, r - 1), P(n + r - 1, 2)],
        `$_{${n}}\\mathrm{H}_{${r}} = {}_{${n + r - 1}}\\mathrm{C}_{${r}} = ${ans}$`);
    },
    function binomCoef() {
      const n = ri(4, 6), a = ri(2, 3), k = ri(1, n - 1);
      const ans = C(n, k) * a ** (n - k);
      return num('이항정리',
        `$(x + ${a})^{${n}}$ 의 전개식에서 $x^{${k}}$ 의 계수는?`, ans,
        [C(n, k), C(n, k) * a ** k, C(n, k - 1) * a ** (n - k), a ** (n - k)],
        `일반항 $_{${n}}\\mathrm{C}_{r}\\,x^{r}\\,${a}^{${n}-r}$ 에서 $r = ${k}$: $${C(n, k)}\\times ${a}^{${n - k}} = ${ans}$`);
    },
    function diceSum() {
      const s = ri(4, 10);
      let cnt = 0;
      for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (i + j === s) cnt++;
      return build('수학적 확률',
        `주사위 두 개를 동시에 던질 때, 나온 눈의 합이 ${s}일 확률은?`,
        T(frac(cnt, 36)),
        [frac(cnt + 1, 36), frac(cnt - 1, 36), frac(cnt, 12), frac(1, 6), frac(cnt, 21), frac(cnt + 2, 36)].map(T),
        `합이 ${s}인 순서쌍은 ${cnt}개 → $\\dfrac{${cnt}}{36} = ${frac(cnt, 36)}$`);
    },
    function circularPerm() {
      const n = ri(4, 7);
      return num('원순열',
        `${n}명이 원탁에 둘러앉는 경우의 수는? (회전하여 같은 것은 한 가지)`, fact(n - 1),
        [fact(n), fact(n - 2), fact(n) / 2, n * (n - 1)],
        `$(${n} - 1)! = ${fact(n - 1)}$`);
    },
    function expectation() {
      let p1, p2, p3;
      do { p1 = ri(1, 6); p2 = ri(1, 6); p3 = 10 - p1 - p2; } while (p3 < 1);
      const ans = frac(p1 * 1 + p2 * 2 + p3 * 3, 10);
      return build('기댓값',
        `확률변수 $X$ 가 $1, 2, 3$ 을 각각 확률 $${frac(p1, 10)},\\ ${frac(p2, 10)},\\ ${frac(p3, 10)}$ 로 가질 때, $E(X)$ 는?`,
        T(ans),
        [frac(p1 * 3 + p2 * 2 + p3 * 1, 10), '2', frac(p1 + p2 * 4 + p3 * 9, 10), frac(p1 * 1 + p2 * 2 + p3 * 3, 30), frac(p1 * 1 + p2 * 2 + p3 * 3 + 1, 10)].map(T),
        `$E(X) = 1\\cdot ${frac(p1, 10)} + 2\\cdot ${frac(p2, 10)} + 3\\cdot ${frac(p3, 10)} = ${ans}$`);
    },
  ];

  const PROB_HARD = [
    function condProb() {
      const w = ri(3, 5), b = ri(2, 4);
      const ans = frac(w - 1, w + b - 1);
      return build('조건부확률',
        `흰 공 ${w}개, 검은 공 ${b}개가 든 주머니에서 공을 한 개씩 두 번 꺼낸다 (꺼낸 공은 되돌리지 않음). 두 번째 공이 흰 공일 때, 첫 번째 공도 흰 공일 확률은?`,
        T(ans),
        [frac(w, w + b), frac(w - 1, w + b), frac(w * (w - 1), (w + b) * (w + b - 1)), frac(w, w + b - 1), frac(b, w + b - 1)].map(T),
        `대칭성으로 두 번째가 흰 공일 확률 $= \\frac{${w}}{${w + b}}$. 둘 다 흰 공 $= \\frac{${w}\\cdot ${w - 1}}{${w + b}\\cdot ${w + b - 1}}$. 나누면 $${ans}$`);
    },
    function bernoulli() {
      const n = ri(4, 6), k = ri(1, n - 1);
      const numr = C(n, k) * 2 ** (n - k), den = 3 ** n;
      return build('독립시행',
        `주사위를 ${n}번 던질 때, 3의 배수의 눈이 정확히 ${k}번 나올 확률은?`,
        T(frac(numr, den)),
        [frac(C(n, k), 3 ** n), frac(C(n, k) * 2 ** k, den), frac(C(n, k), 2 ** n), frac(2 ** (n - k), den), frac(numr, 6 ** n)].map(T),
        `한 번에 $p = \\frac{1}{3}$. $_{${n}}\\mathrm{C}_{${k}}\\left(\\frac{1}{3}\\right)^{${k}}\\left(\\frac{2}{3}\\right)^{${n - k}} = ${frac(numr, den)}$`);
    },
    function binomVar() {
      const [n, pn, pd] = pick([[18, 1, 3], [36, 1, 3], [16, 1, 2], [20, 1, 2], [36, 1, 2], [45, 1, 3]]);
      const a = pick([2, 3, -2]), b = ri(1, 5);
      const v = n * pn * (pd - pn) / (pd * pd);
      const ans = a * a * v;
      return num('이항분포',
        `확률변수 $X$ 가 이항분포 $\\mathrm{B}\\left(${n},\\ ${frac(pn, pd)}\\right)$ 를 따를 때, $V(${a}X${signed(b)})$ 의 값은?`, ans,
        [Math.abs(a) * v, a * a * n * pn / pd, ans + b, v, a * a * v + b * b],
        `$V(X) = np(1-p) = ${n}\\cdot ${frac(pn, pd)}\\cdot ${frac(pd - pn, pd)} = ${v}$. $V(aX + b) = a^2 V(X) = ${ans}$`);
    },
    function normalStd() {
      const m = ri(5, 12) * 5, s = pick([2, 4, 5, 10]), z = pick([1, 1.5, 2, -1, -0.5]);
      const c = m + z * s;
      const fmt = x => String(x);
      return build('정규분포의 표준화',
        `확률변수 $X$ 가 정규분포 $\\mathrm{N}(${m},\\ ${s}^2)$ 을 따를 때, $P(X \\le ${c}) = P(Z \\le k)$ 를 만족시키는 $k$ 는? (단, $Z$ 는 표준정규분포)`,
        T(fmt(z)),
        [fmt(-z), fmt((c - m) / (s * s)), fmt(c - m), fmt(z * 2), fmt(z + 1)].filter(x => x !== fmt(z)).map(T),
        `$Z = \\dfrac{X - ${m}}{${s}}$ 이므로 $k = \\dfrac{${c} - ${m}}{${s}} = ${fmt(z)}$`);
    },
    function sameThingPerm() {
      const [word, counts] = pick([['AABBC', [2, 2, 1]], ['AAABBC', [3, 2, 1]], ['AABBCC', [2, 2, 2]], ['AAABCD', [3, 1, 1, 1]], ['AABBBCC', [2, 3, 2]], ['AAAABB', [4, 2]]]);
      const n = word.length;
      const ans = fact(n) / counts.reduce((m, c) => m * fact(c), 1);
      return num('같은 것이 있는 순열',
        `문자 ${word.split('').join(', ')} 를 모두 일렬로 나열하는 경우의 수는?`, ans,
        [fact(n), fact(n) / fact(counts[0]), ans * 2, fact(n - 1)],
        `$\\dfrac{${n}!}{${counts.map(c => c + '!').join('\\,')}} = ${ans}$`);
    },
    function intSolutions() {
      const n = ri(6, 10);
      return num('중복조합 (방정식의 해)',
        `방정식 $x + y + z = ${n}$ 을 만족시키는 양의 정수 $x, y, z$ 의 순서쌍 $(x, y, z)$ 의 개수는?`, C(n - 1, 2),
        [C(n + 2, 2), C(n, 2), C(n - 1, 3), C(n - 2, 2)],
        `$x' = x - 1$ 등으로 두면 $x' + y' + z' = ${n - 3}$ 의 음이 아닌 정수해: $_{3}\\mathrm{H}_{${n - 3}} = {}_{${n - 1}}\\mathrm{C}_{2} = ${C(n - 1, 2)}$`);
    },
    function increasingFunc() {
      const m = ri(2, 3), n = ri(4, 6);
      const strict = Math.random() < 0.5;
      const ans = strict ? C(n, m) : C(n + m - 1, m);
      const X = Array.from({ length: m }, (_, i) => i + 1).join(', ');
      return num('함수의 개수',
        `$X = \\{${X}\\}$, $Y = \\{1, 2, \\dots, ${n}\\}$ 일 때, $X$ 에서 $Y$ 로의 함수 $f$ 중 ${strict ? '$f(1) < f(2)' + (m === 3 ? ' < f(3)' : '') + '$' : '$f(1) \\le f(2)' + (m === 3 ? ' \\le f(3)' : '') + '$'} 인 것의 개수는?`, ans,
        [strict ? C(n + m - 1, m) : C(n, m), n ** m, P(n, m), C(n, m - 1)],
        strict ? `서로 다른 값 ${m}개를 고르면 순서가 정해지므로 $_{${n}}\\mathrm{C}_{${m}} = ${ans}$` : `중복을 허락해 ${m}개를 고르면 순서가 정해지므로 $_{${n}}\\mathrm{H}_{${m}} = {}_{${n + m - 1}}\\mathrm{C}_{${m}} = ${ans}$`);
    },
  ];

  // =====================================================================
  //  기하
  // =====================================================================
  const TRIPLES = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13]];
  const GEO_EASY = [
    function parabolaFocus() {
      const p = nz(-3, 3);
      if (Math.random() < 0.5) {
        return num('포물선의 초점',
          `포물선 $y^2 = ${4 * p}x$ 의 초점의 $x$ 좌표는?`, p,
          [4 * p, -p, 2 * p, p + 1],
          `$y^2 = 4px$ 꼴에서 $4p = ${4 * p}$ → $p = ${p}$, 초점 $(${p}, 0)$`);
      }
      return num('포물선의 초점',
        `포물선 $x^2 = ${4 * p}y$ 의 준선의 방정식이 $y = k$ 일 때, $k$ 의 값은?`, -p,
        [p, 4 * p, -4 * p, 2 * p],
        `$x^2 = 4py$ 꼴에서 $p = ${p}$, 준선은 $y = -p = ${-p}$`);
    },
    function ellipseFoci() {
      const [a, b, c] = pick([[5, 3, 4], [5, 4, 3], [13, 5, 12], [10, 6, 8], [10, 8, 6], [13, 12, 5]]);
      return num('타원의 초점',
        `타원 $\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1$ 의 두 초점 사이의 거리는?`, 2 * c,
        [c, 2 * a, 2 * b, a + b, 2 * c + 2],
        `$c^2 = ${a * a} - ${b * b} = ${c * c}$ → $c = ${c}$, 두 초점 $(\\pm ${c}, 0)$ 사이 거리 $${2 * c}$`);
    },
    function hyperbolaAsym() {
      let a, b;
      do { a = ri(1, 5); b = ri(1, 6); } while (a === b);
      return build('쌍곡선의 점근선',
        `쌍곡선 $\\dfrac{x^2}{${a * a}} - \\dfrac{y^2}{${b * b}} = 1$ 의 점근선 중 기울기가 양수인 것의 기울기는?`,
        T(frac(b, a)),
        [frac(a, b), frac(b * b, a * a), frac(a * a, b * b), frac(b, 2 * a), String(a * b)].map(T),
        `점근선 $y = \\pm\\dfrac{b}{a}x = \\pm ${frac(b, a)}x$`);
    },
    function vecNorm() {
      const [p, q, r] = pick(TRIPLES);
      const u1 = ri(-3, 3), u2 = ri(-3, 3);
      const s1 = pick([1, -1]) * p, s2 = pick([1, -1]) * q;
      const v1 = s1 - u1, v2 = s2 - u2;
      return num('벡터의 크기',
        `두 벡터 $\\vec a = (${u1},\\ ${u2})$, $\\vec b = (${v1},\\ ${v2})$ 에 대하여 $|\\vec a + \\vec b|$ 의 값은?`, r,
        [Math.abs(s1) + Math.abs(s2), r * r, r + 1, Math.abs(u1) + Math.abs(v1)],
        `$\\vec a + \\vec b = (${s1},\\ ${s2})$ → $\\sqrt{${s1 * s1} + ${s2 * s2}} = ${r}$`);
    },
    function dotProduct() {
      const a = [ri(-3, 4), ri(-3, 4), ri(-2, 3)], b = [ri(-3, 4), ri(-3, 4), ri(-2, 3)];
      const ans = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      return num('벡터의 내적',
        `$\\vec a = (${a.join(',\\ ')})$, $\\vec b = (${b.join(',\\ ')})$ 일 때, $\\vec a \\cdot \\vec b$ 의 값은?`, ans,
        [a[0] * b[0] + a[1] * b[1], ans + 2 * a[2] * b[2] || ans + 3, a[0] + b[0] + a[1] + b[1] + a[2] + b[2], -ans],
        `$${a[0]}\\cdot ${b[0] < 0 ? `(${b[0]})` : b[0]} + ${a[1]}\\cdot ${b[1] < 0 ? `(${b[1]})` : b[1]} + ${a[2]}\\cdot ${b[2] < 0 ? `(${b[2]})` : b[2]} = ${ans}$`);
    },
    function spaceDist() {
      const [d, qd] = pick([[[1, 2, 2], 3], [[2, 3, 6], 7], [[1, 4, 8], 9], [[2, 6, 9], 11], [[4, 4, 7], 9], [[2, 2, 1], 3]]);
      const A = [ri(-3, 3), ri(-3, 3), ri(-3, 3)];
      const sg = shuffle([d[0], d[1], d[2]]).map(x => x * pick([1, -1]));
      const B = A.map((x, i) => x + sg[i]);
      return num('좌표공간의 거리',
        `두 점 $A(${A.join(',\\ ')})$, $B(${B.join(',\\ ')})$ 사이의 거리는?`, qd,
        [qd * qd, d[0] + d[1] + d[2], qd + 1, qd - 1],
        `$\\sqrt{${sg.map(x => `(${x})^2`).join(' + ')}} = \\sqrt{${qd * qd}} = ${qd}$`);
    },
    function internalDiv() {
      const m = ri(1, 3), n = ri(1, 3);
      const A = [ri(-4, 4), ri(-4, 4), ri(-4, 4)];
      const B = A.map(x => x + (m + n) * ri(-2, 2));
      const Pt = A.map((x, i) => (m * B[i] + n * x) / (m + n));
      const ans = Pt[0] + Pt[1] + Pt[2];
      const Q = A.map((x, i) => (n * B[i] + m * x) / (m + n));
      return num('내분점',
        `두 점 $A(${A.join(',\\ ')})$, $B(${B.join(',\\ ')})$ 에 대하여 선분 $AB$ 를 $${m} : ${n}$ 으로 내분하는 점의 좌표를 $(a, b, c)$ 라 할 때, $a + b + c$ 의 값은?`, ans,
        [Q[0] + Q[1] + Q[2], (A[0] + B[0] + A[1] + B[1] + A[2] + B[2]) / 2, ans + m, ans - n],
        `$\\left(\\dfrac{${m}x_B + ${n}x_A}{${m + n}}, \\dots\\right) = (${Pt.join(',\\ ')})$ → 합 $${ans}$`);
    },
  ];

  const GEO_HARD = [
    function ellipseFocalSum() {
      const [a, b, c] = pick([[5, 3, 4], [5, 4, 3], [13, 5, 12], [10, 6, 8], [10, 8, 6]]);
      const d = ri(a - c + 1, a + c - 1);
      return num('타원의 정의',
        `타원 $\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1$ 의 두 초점을 $F, F'$ 이라 하자. 타원 위의 점 $P$ 에 대하여 $\\overline{PF} = ${d}$ 일 때, $\\overline{PF'}$ 의 값은?`, 2 * a - d,
        [2 * c - d, 2 * b - d, a + c - d, 2 * a + d],
        `타원 위의 점은 $\\overline{PF} + \\overline{PF'} = 2a = ${2 * a}$ → $\\overline{PF'} = ${2 * a - d}$`);
    },
    function hyperbolaFocalDiff() {
      const [a, b, c] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10]]);
      const d = ri(c - a + 1, c + 4);
      return num('쌍곡선의 정의',
        `쌍곡선 $\\dfrac{x^2}{${a * a}} - \\dfrac{y^2}{${b * b}} = 1$ 의 두 초점 $F(${c}, 0)$, $F'(-${c}, 0)$ 과 이 쌍곡선 위의 제1사분면의 점 $P$ 에 대하여 $\\overline{PF} = ${d}$ 일 때, $\\overline{PF'}$ 의 값은?`, d + 2 * a,
        [d - 2 * a, d + 2 * b, d + 2 * c, d + a],
        `오른쪽 가지 위의 점은 $\\overline{PF'} - \\overline{PF} = 2a = ${2 * a}$ → $\\overline{PF'} = ${d + 2 * a}$`);
    },
    function parabolaFocalDist() {
      const p = ri(1, 3), s = ri(1, 3);
      const L = p + p * s * s, y = 2 * p * s;
      return num('포물선의 정의',
        `포물선 $y^2 = ${4 * p}x$ 위의 점 $P$ 와 초점 $F$ 사이의 거리가 $${L}$ 일 때, 점 $P$ 의 $y$ 좌표의 양수 값은?`, y,
        [y * y, L - p, L, 2 * y],
        `초점까지 거리 = 준선 $x = -${p}$ 까지 거리이므로 $x_P + ${p} = ${L}$ → $x_P = ${L - p}$, $y^2 = ${4 * p}\\cdot ${L - p} = ${y * y}$ → $y = ${y}$`);
    },
    function vecAngle() {
      const [a1, a2, ar] = pick(TRIPLES), [b1, b2, br] = pick(TRIPLES);
      const s1 = pick([1, -1]), s2 = pick([1, -1]);
      const u = [a1, a2 * s1], v = [b1 * s2, b2];
      const dot = u[0] * v[0] + u[1] * v[1];
      const ans = frac(dot, ar * br);
      return build('벡터의 사잇각',
        `두 벡터 $\\vec a = (${u.join(',\\ ')})$, $\\vec b = (${v.join(',\\ ')})$ 가 이루는 각의 크기를 $\\theta$ 라 할 때, $\\cos\\theta$ 의 값은?`,
        T(ans),
        [frac(-dot, ar * br), frac(dot, ar * ar * br * br), frac(dot, ar + br), frac(dot + 1, ar * br), String(dot), frac(dot, 2 * ar * br), frac(dot - 1, ar * br), frac(dot + 5, ar * br)].map(T),
        `$\\cos\\theta = \\dfrac{\\vec a\\cdot\\vec b}{|\\vec a||\\vec b|} = \\dfrac{${dot}}{${ar}\\cdot ${br}} = ${ans}$`);
    },
    function sphereRadius() {
      const h = ri(-3, 3), k = ri(-3, 3), l = ri(-3, 3), r = ri(2, 5);
      const d = h * h + k * k + l * l - r * r;
      const eq = `x^2 + y^2 + z^2${tail([[-2 * h, 'x'], [-2 * k, 'y'], [-2 * l, 'z'], [d, '']])} = 0`;
      return num('구의 방정식',
        `구 $${eq}$ 의 반지름의 길이는?`, r,
        [r * r, r + 1, Math.abs(d) || r + 2, Math.abs(h) + Math.abs(k) + Math.abs(l)],
        `완전제곱식: $(x${signed(-h)})^2 + (y${signed(-k)})^2 + (z${signed(-l)})^2 = ${r * r}$ → 반지름 $${r}$`);
    },
    function projection() {
      const S = pick([4, 6, 8, 12, 18]), th = pick([30, 45, 60]);
      const half = S / 2;
      const ans = th === 60 ? String(half) : th === 45 ? `${half}\\sqrt{2}` : `${half}\\sqrt{3}`;
      return build('정사영',
        `넓이가 $${S}$ 인 도형을 이 도형이 놓인 평면과 $${th}^\\circ$ 의 각을 이루는 평면 위로 정사영한 도형의 넓이는?`,
        T(ans),
        [String(half), `${half}\\sqrt{2}`, `${half}\\sqrt{3}`, String(S), `${S}\\sqrt{3}`, `${S}\\sqrt{2}`].filter(x => x !== ans).map(T),
        `정사영의 넓이 $= S\\cos\\theta = ${S}\\cos ${th}^\\circ = ${ans}$`);
    },
    function ellipseTangent() {
      const x0 = nz(-3, 3), y0 = nz(-3, 3);
      // x²/(2x0²) + y²/(2y0²) = 1 은 (x0, y0) 를 지난다. 접선 기울기 = −(b² x0)/(a² y0) = −y0/x0
      const A = 2 * x0 * x0, B = 2 * y0 * y0;
      const ans = frac(-y0, x0);
      return build('타원의 접선',
        `타원 $\\dfrac{x^2}{${A}} + \\dfrac{y^2}{${B}} = 1$ 위의 점 $(${x0},\\ ${y0})$ 에서의 접선의 기울기는?`,
        T(ans),
        [frac(y0, x0), frac(-x0, y0), frac(x0, y0), frac(-B * x0, A), frac(-2 * y0, x0), frac(-y0, 2 * x0), frac(y0, 2 * x0), frac(-B, A), frac(-y0 - 1, x0)].map(T),
        `접선 $\\dfrac{${x0}x}{${A}} + \\dfrac{${y0}y}{${B}} = 1$ → 기울기 $-\\dfrac{${x0}/${A}}{${y0}/${B}} = ${ans}$`);
    },
  ];

  // =====================================================================
  //  과목(카테고리)별 문제 묶음
  // =====================================================================
  const byName = (arr, names) => names.map(n => {
    const f = arr.find(g => g.name === n);
    if (!f) throw new Error('없는 문제 유형: ' + n);
    return f;
  });
  const CATS = {
    common: {
      name: '공통', sub: '수학Ⅰ · 수학Ⅱ',
      easy: [...byName(EASY, ['polyDeriv', 'integral', 'extreme', 'tangent']), ...COMMON_EXTRA_EASY],
      hard: [...byName(HARD, ['undeterminedLimit', 'integralDefined', 'differentiable', 'areaBetween']), ...COMMON_EXTRA_HARD],
    },
    calc: {
      name: '미적분', sub: '미적분',
      easy: [...byName(EASY, ['limit', 'chain', 'product', 'logDeriv', 'second', 'trigMax']), ...CALC_EXTRA_EASY],
      hard: byName(HARD, ['inverseDeriv', 'implicitDeriv', 'parametricDeriv', 'eLimit', 'geometricSeries', 'sqrtSeqLimit', 'substitution', 'byParts', 'inflection', 'trigLimit']),
    },
    prob: { name: '확률과 통계', sub: '확률과 통계', easy: PROB_EASY, hard: PROB_HARD },
    geo: { name: '기하', sub: '기하', easy: GEO_EASY, hard: GEO_HARD },
  };
  let lastName = '';

  function generate(cat, level) {
    const c = CATS[cat] || CATS.calc;
    const pool = c[level] || c.easy;
    for (let tries = 0; tries < 30; tries++) {
      const g = pick(pool);
      if (g.name === lastName && pool.length > 1) continue;
      try {
        const p = g();
        lastName = g.name;
        p.level = level;
        p.cat = cat;
        return p;
      } catch (e) { /* 보기 부족 등 → 다시 생성 */ }
    }
    throw new Error('문제 생성 실패');
  }

  global.MathProblems = { generate, CATS, EASY, HARD };
})(typeof window !== 'undefined' ? window : globalThis);
