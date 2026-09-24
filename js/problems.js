/*
 * 수학 문제 생성기
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
