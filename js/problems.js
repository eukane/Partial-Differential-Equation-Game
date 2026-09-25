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

  /** 보기의 LaTeX 를 숫자로 계산 (e, π, 분수, 제곱근, 거듭제곱, ln·log·sin·cos·tan). 계산할 수 없는 보기(문자·식·말)는 null */
  function texValue(src) {
    const s = String(src).replace(/^\$+|\$+$/g, '').replace(/\\left|\\right|\\displaystyle/g, '').replace(/\\[,;!: ]/g, '').replace(/~/g, '');
    const tk = [];
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; tk.push(['n', parseFloat(s.slice(i, j))]); i = j; continue; }
      if (c === '\\') { let j = i + 1; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++; if (j === i + 1) j++; tk.push(['c', s.slice(i + 1, j)]); i = j; continue; }
      tk.push(['h', c]); i++;
    }
    let p = 0;
    const is = (t, v) => tk[p] && tk[p][0] === t && tk[p][1] === v;
    const expect = v => { if (!is('h', v)) throw 0; p++; };
    const FUN = { ln: Math.log, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10 };
    const group = () => {
      if (is('h', '{')) { p++; const v = expr(); expect('}'); return v; }
      const t = tk[p++];
      if (t && t[0] === 'n') return t[1];
      if (t && t[0] === 'h' && t[1] === 'e') return Math.E;
      if (t && t[0] === 'c' && t[1] === 'pi') return Math.PI;
      throw 0;
    };
    const atom = () => {
      const t = tk[p];
      if (!t) throw 0;
      if (t[0] === 'n') { p++; return t[1]; }
      if (t[0] === 'h' && t[1] === 'e') { p++; return Math.E; }
      if (t[0] === 'h' && t[1] === '(') { p++; const v = expr(); expect(')'); return v; }
      if (t[0] === 'h' && t[1] === '{') return group();
      if (t[0] === 'c') {
        p++;
        if (t[1] === 'pi') return Math.PI;
        if (/^[dt]?frac$/.test(t[1])) { const a = group(); return a / group(); }
        if (t[1] === 'sqrt') { let n = 2; if (is('h', '[')) { p++; n = expr(); expect(']'); } return Math.pow(group(), 1 / n); }
        if (FUN[t[1]]) {
          let base = null, pw = null;
          if (t[1] === 'log' && is('h', '_')) { p++; base = group(); }
          if (is('h', '^')) { p++; pw = group(); }
          const arg = power();
          const v = base != null ? Math.log(arg) / Math.log(base) : FUN[t[1]](arg);
          return pw != null ? Math.pow(v, pw) : v;
        }
      }
      throw 0;
    };
    const power = () => { const b = atom(); if (is('h', '^')) { p++; return Math.pow(b, is('h', '{') ? group() : unary()); } return b; };
    const unary = () => { if (is('h', '-')) { p++; return -unary(); } if (is('h', '+')) { p++; return unary(); } return power(); };
    const starts = t => t && (t[0] === 'n' || (t[0] === 'h' && '({e'.includes(t[1])) || (t[0] === 'c' && /^(pi|[dt]?frac|sqrt|ln|sin|cos|tan|log)$/.test(t[1])));
    const term = () => {
      let v = unary();
      for (;;) {
        if (is('c', 'cdot') || is('c', 'times')) { p++; v *= unary(); }
        else if (starts(tk[p])) v *= power();
        else return v;
      }
    };
    function expr() {
      let v = term();
      for (;;) {
        if (is('h', '+')) { p++; v += term(); } else if (is('h', '-')) { p++; v -= term(); } else return v;
      }
    }
    try {
      const v = expr();
      return p === tk.length && Number.isFinite(v) ? v : null;
    } catch (e) { return null; }
  }
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
    const vals = [texValue(correct)];
    const w = [];
    for (const x of wrongs) {
      if (x == null || seen.has(x)) continue;
      if (/\\[dt]?frac\{[^{}]*\}\{0\}/.test(x)) continue;   // 분모가 0 인 엉터리 보기
      // 글자는 달라도 값이 같은 보기(예: e^{1}+3 과 e+3)는 정답이 두 개가 되므로 뺀다
      const v = texValue(x);
      if (v != null && vals.some(u => u != null && Math.abs(u - v) <= 1e-9 * Math.max(1, Math.abs(u)))) continue;
      vals.push(v);
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
        [String(fp), frac(1, 3 * v * v + a), frac(1, (3 * t + a) || fp + 1), frac(1, a), frac(-1, fp), frac(2, fp)].map(T),
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
  //  추가 문제 유형 (2차)
  // =====================================================================
  const COMMON_MORE_EASY = [
    function expLaw() {
      const [b, e] = pick([[8, 3], [27, 3], [16, 4], [32, 5], [4, 2], [9, 2], [64, 6], [81, 4]]);
      const root = Math.round(b ** (1 / e));
      const m = ri(1, e + 1);
      const ans = root ** m;
      return num('지수법칙',
        `$${b}^{\\frac{${m}}{${e}}}$ 의 값은?`, ans,
        [b * m / e === Math.floor(b * m / e) ? b * m / e : ans + 2, root ** (m + 1), root * m, root ** (m - 1) || ans + 1],
        `$${b} = ${root}^{${e}}$ 이므로 $${b}^{\\frac{${m}}{${e}}} = ${root}^{${m}} = ${ans}$`);
    },
    function logChain() {
      const a = pick([2, 3, 5]), k = ri(2, 4), m = ri(2, 4);
      const b = pick([3, 7, 10, 11].filter(x => x !== a));
      const ans = k * m;
      return num('로그의 성질',
        `$\\log_{${a}} ${b} \\times \\log_{${b}} ${a ** k} \\times ${m}$ 의 값은?`, ans,
        [k + m, k, m, ans + 1, a * k],
        `밑 변환: $\\log_{${a}} ${b} \\cdot \\log_{${b}} ${a ** k} = \\log_{${a}} ${a ** k} = ${k}$ → $${k}\\times ${m} = ${ans}$`);
    },
    function radian() {
      const deg = pick([30, 45, 60, 90, 120, 135, 150, 210, 225, 240, 270, 300, 315, 330]);
      const g = gcd(deg, 180);
      const tx = (p, q) => (q === 1 ? `${cx(p)}\\pi` : `\\frac{${cx(p)}\\pi}{${q}}`);
      const ans = tx(deg / g, 180 / g);
      const alt = [[deg + 30, 180], [deg - 15, 180], [deg, 360], [2 * deg, 180], [180 - deg || 45, 180], [deg + 45, 180]]
        .map(([n, d]) => { const h = gcd(n, d); return tx(n / h, d / h); });
      return build('호도법',
        `$${deg}^\\circ$ 를 호도법으로 나타낸 것은?`,
        T(ans), alt.map(T),
        `$${deg}^\\circ = ${deg}\\times\\dfrac{\\pi}{180} = ${ans}$`);
    },
    function ratLimitInf() {
      const a = nz(-4, 5), b = ri(1, 4), c = ri(-5, 5), d = ri(-5, 5);
      const deg = pick([1, 2]);
      const top = deg === 2 ? poly([[a, 'x^2'], [c, 'x'], [1, '']]) : poly([[a, 'x'], [c, '']]);
      const bot = deg === 2 ? poly([[b, 'x^2'], [d, 'x'], [2, '']]) : poly([[b, 'x'], [d, '']]);
      const ans = frac(a, b);
      return build('함수의 극한 (∞)',
        `$\\displaystyle\\lim_{x \\to \\infty} \\frac{${top}}{${bot}}$ 의 값은?`,
        T(ans),
        [frac(b, a), frac(c, d || 7), '0', frac(a + c, b + d || 9), String(a), frac(a, 2 * b)].map(T),
        `최고차항의 계수의 비: $${ans}$`);
    },
    function avgRate() {
      const a = ri(1, 3), b = ri(-3, 3), p = ri(-1, 1), q = p + ri(1, 3);
      const f = x => a * x * x + b * x;
      const ans = (f(q) - f(p)) / (q - p);
      return num('평균변화율',
        `함수 $f(x) = ${poly([[a, 'x^2'], [b, 'x']])}$ 에서 $x$ 의 값이 $${p}$ 에서 $${q}$ 까지 변할 때의 평균변화율은?`, ans,
        [f(q) - f(p), 2 * a * q + b, 2 * a * p + b, ans + a],
        `$\\dfrac{f(${q}) - f(${p})}{${q} - (${p})} = \\dfrac{${f(q)} - (${f(p)})}{${q - p}} = ${ans}$ (= $a(p+q) + b$)`);
    },
  ];

  const COMMON_MORE_HARD = [
    function trigEqCount() {
      // 0 ≤ x < 2π 에서 sin(kx) = c 의 해의 개수
      const k = ri(1, 3), c = pick(['0', '\\frac{1}{2}', '-\\frac{1}{2}', '1', '\\frac{\\sqrt{3}}{2}']);
      const per = c === '0' ? 2 : c === '1' ? 1 : 2;   // 한 주기당 해 (sin t = 0 은 t = 0, π)
      const ans = per * k;
      return num('삼각방정식',
        `$0 \\le x < 2\\pi$ 에서 방정식 $\\sin ${cx(k)}x = ${c}$ 의 실근의 개수는?`, ans,
        [per, ans + 1, ans - 1, 2 * ans, k],
        `$t = ${cx(k)}x$ 는 $0 \\le t < ${2 * k === 2 ? '' : 2 * k}\\pi$ 를 움직이고, 한 주기 $2\\pi$ 에 $\\sin t = ${c}$ 인 $t$ 가 ${per}개씩 → $${ans}$개`);
    },
    function logIneq() {
      const a = ri(1, 3), k = ri(3, 5);
      // log_2 (x − a) < k,  진수 조건 x > a → a < x < a + 2^k, 정수 개수 2^k − 1
      const ans = 2 ** k - 1;
      return num('로그부등식',
        `부등식 $\\log_2 (x - ${a}) < ${k}$ 를 만족시키는 정수 $x$ 의 개수는?`, ans,
        [2 ** k, 2 ** k + 1, k, 2 ** k - a, a + 2 ** k],
        `진수 조건 $x > ${a}$, $x - ${a} < 2^{${k}}$ → $${a} < x < ${a + 2 ** k}$ → 정수 $${ans}$개`);
    },
    function absIntegral() {
      const a = ri(1, 3), b = ri(a + 1, 5);
      // ∫_0^b |x − a| dx = a²/2 + (b−a)²/2
      const ans = frac(a * a + (b - a) ** 2, 2);
      return build('절댓값 정적분',
        `$\\displaystyle\\int_0^{${b}} |x - ${a}|\\,dx$ 의 값은?`,
        T(ans),
        [frac(b * b, 2) + '' === ans ? frac(b * b - 2 * a * b, 2) : frac(b * b, 2), frac(b * b - 2 * a * b, 2), frac((b - a) ** 2, 2), frac(a * a, 2), frac(a * a + (b - a) ** 2 + 2, 2), String(b - a)].map(T),
        `$x = ${a}$ 에서 나눠 두 삼각형 넓이: $\\frac{${a}^2}{2} + \\frac{${b - a}^2}{2} = ${ans}$`);
    },
    function velocityDist() {
      // v(t) = t² − a t  (0 ≤ t ≤ a 에서 음수), 0 ~ a 에서 움직인 거리 = a³/6
      const a = pick([6, 12]);
      const moved = a ** 3 / 6;
      return num('속도와 거리',
        `수직선 위를 움직이는 점 $P$ 의 시각 $t$ 에서의 속도가 $v(t) = t^2 - ${a}t$ 일 때, $t = 0$ 에서 $t = ${a}$ 까지 점 $P$ 가 움직인 거리는?`, moved,
        [-moved, 2 * moved, a * a, moved + a],
        `$0 < t < ${a}$ 에서 $v < 0$ → 거리 $= \\int_0^{${a}} |v|\\,dt = \\left[\\frac{${a}t^2}{2} - \\frac{t^3}{3}\\right]_0^{${a}} = ${moved}$`);
    },
  ];

  const CALC_MORE_EASY = [
    function seqRatLimit() {
      const a = nz(-4, 6), b = ri(1, 5), c = ri(-5, 5), d = ri(1, 6);
      const ans = frac(a, b);
      return build('수열의 극한',
        `$\\displaystyle\\lim_{n \\to \\infty} \\frac{${poly([[a, 'n^2'], [c, 'n'], [3, '']])}}{${poly([[b, 'n^2'], [d, '']])}}$ 의 값은?`,
        T(ans),
        [frac(b, a), frac(c, d), '0', frac(a + c, b + d), String(a), frac(a, b + 1)].map(T),
        `분모·분자를 $n^2$ 으로 나누면 $\\dfrac{${a}}{${b}} = ${ans}$`);
    },
    function addFormula() {
      const [p, q] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [1, 5], [2, 5]]);
      // tan α = p, tan β = q → tan(α+β) = (p+q)/(1−pq)
      const ans = frac(p + q, 1 - p * q);
      return build('삼각함수의 덧셈정리',
        `$\\tan\\alpha = ${p},\\ \\tan\\beta = ${q}$ 일 때, $\\tan(\\alpha + \\beta)$ 의 값은?`,
        T(ans),
        [frac(p + q, 1 + p * q), frac(p - q, 1 + p * q), String(p + q), frac(-(p + q), 1 - p * q), String(p * q)].map(T),
        `$\\tan(\\alpha+\\beta) = \\dfrac{${p} + ${q}}{1 - ${p}\\cdot ${q}} = ${ans}$`);
    },
    function expLogDeriv() {
      const a = ri(1, 3), b = ri(1, 4);
      // f(x) = e^{ax} + b ln x → f'(1) = a e^a + b
      const E = a === 1 ? 'e' : `${a}e^{${a}}`;
      return build('지수·로그함수의 미분',
        `$f(x) = e^{${cx(a)}x} + ${cx(b)}\\ln x$ 일 때, $f'(1)$ 의 값은?`,
        T(`${E} + ${b}`),
        // a = 1 이면 'e^{1} + b', 'e + b' 가 정답과 같은 값이 되므로 다른 오답으로
        [a > 1 ? `e^{${a}} + ${b}` : `e^{2} + ${b}`, `${E}`, `${E} + ${b + 1}`, a > 1 ? `${a}e + ${b}` : `${b + 1}e`, `${E} - ${b}`].map(T),
        `$f'(x) = ${cx(a)}e^{${cx(a)}x} + \\dfrac{${b}}{x}$ → $f'(1) = ${E} + ${b}$`);
    },
  ];

  const CALC_MORE_HARD = [
    function arcLength() {
      const [k, m] = pick([['\\sqrt{3}', 2], ['2\\sqrt{2}', 3], ['\\sqrt{15}', 4]]);
      const ans = frac(2 * (m ** 3 - 1), 3);
      return build('곡선의 길이',
        `$x = t^2,\\ y = \\dfrac{2}{3}t^3$ $(0 \\le t \\le ${k})$ 으로 나타낸 곡선의 길이는?`,
        T(ans),
        [frac(2 * m ** 3, 3), frac(m ** 3 - 1, 3), frac(2 * (m ** 2 - 1), 3), frac(2 * (m ** 3 - 1), 3 * m), frac(4 * (m ** 3 - 1), 3)].map(T),
        `속력 $\\sqrt{(2t)^2 + (2t^2)^2} = 2t\\sqrt{1 + t^2}$ → $\\left[\\frac{2}{3}(1 + t^2)^{\\frac{3}{2}}\\right]_0^{${k}} = \\frac{2}{3}(${m}^3 - 1) = ${ans}$`);
    },
    function volumeSection() {
      // 단면이 한 변 √x 인 정사각형인 입체 (0 ≤ x ≤ a): V = ∫ x dx = a²/2
      const a = ri(2, 6);
      const ans = frac(a * a, 2);
      return build('입체의 부피',
        `$0 \\le x \\le ${a}$ 에서 $x$ 축에 수직인 평면으로 자른 단면이 한 변의 길이가 $\\sqrt{x}$ 인 정사각형인 입체의 부피는?`,
        T(ans),
        [String(a * a), frac(a * a, 3), frac(a ** 3, 3), frac(a * a, 4), frac(a * a + 1, 2)].map(T),
        `단면의 넓이 $S(x) = x$ → $\\displaystyle\\int_0^{${a}} x\\,dx = ${ans}$`);
    },
    function lnAreaParts() {
      const k = ri(2, 3);
      // ∫_1^{e^k} (ln x)/x dx = k²/2
      const ans = frac(k * k, 2);
      return build('치환적분',
        `$\\displaystyle\\int_1^{e^{${k}}} \\frac{\\ln x}{x}\\,dx$ 의 값은?`,
        T(ans),
        [String(k), frac(k, 2), String(k * k), frac(k * k, 4), frac(k * k + 1, 2)].map(T),
        `$t = \\ln x$, $dt = \\frac{dx}{x}$: $\\displaystyle\\int_0^{${k}} t\\,dt = ${ans}$`);
    },
  ];

  const PROB_MORE_EASY = [
    function complement() {
      const n = ri(2, 4);
      // 동전 n개 던져 적어도 하나 앞면: 1 − (1/2)^n
      const ans = frac(2 ** n - 1, 2 ** n);
      return build('여사건의 확률',
        `동전 ${n}개를 동시에 던질 때, 적어도 한 개는 앞면이 나올 확률은?`,
        T(ans),
        [frac(1, 2 ** n), frac(n, 2 ** n), frac(1, 2), frac(2 ** n - 2, 2 ** n), frac(n, n + 1)].map(T),
        `여사건(모두 뒷면)의 확률 $\\frac{1}{${2 ** n}}$ → $1 - \\frac{1}{${2 ** n}} = ${ans}$`);
    },
    function sampleMean() {
      const s = pick([4, 6, 8, 10, 12]), n = pick([4, 16, 36, 64].filter(q => (s * s) % q === 0 || true));
      const ans = frac(s * s, n);
      return build('표본평균의 분산',
        `모평균이 $50$, 모표준편차가 $${s}$ 인 모집단에서 크기가 $${n}$ 인 표본을 임의추출할 때, 표본평균 $\\overline{X}$ 의 분산은?`,
        T(ans),
        [String(s * s), frac(s, n), frac(s * s, Math.sqrt(n)), frac(s, Math.sqrt(n)), frac(s * s, n * n)].map(T),
        `$V(\\overline{X}) = \\dfrac{\\sigma^2}{n} = \\dfrac{${s * s}}{${n}} = ${ans}$`);
    },
    function binomMean() {
      const [n, p, q] = pick([[20, 1, 4], [30, 1, 3], [40, 1, 2], [60, 1, 6], [50, 2, 5], [36, 2, 3]]);
      const ans = n * p / q;
      return num('이항분포의 평균',
        `확률변수 $X$ 가 이항분포 $\\mathrm{B}\\left(${n},\\ ${frac(p, q)}\\right)$ 를 따를 때, $E(X)$ 는?`, ans,
        [n * p * (q - p) / (q * q), n / q, ans + p, n - ans],
        `$E(X) = np = ${n}\\times ${frac(p, q)} = ${ans}$`);
    },
  ];

  const PROB_MORE_HARD = [
    function circularAdj() {
      const n = ri(5, 7);
      // 특정 두 사람이 이웃: 둘을 묶어 (n−1)개의 원순열 × 2
      const ans = 2 * fact(n - 2);
      return num('원순열 (이웃)',
        `${n}명이 원탁에 둘러앉을 때, 특정한 두 사람 A, B 가 이웃하여 앉는 경우의 수는?`, ans,
        [fact(n - 2), 2 * fact(n - 1), fact(n - 1), 2 * fact(n - 3)],
        `A, B 를 한 묶음으로 보면 ${n - 1}개의 원순열 $(${n - 2})!$, 묶음 안에서 자리 바꿈 $2$ → $${ans}$`);
    },
    function sampleSd() {
      const s = pick([6, 8, 10, 12]), n = pick([4, 9, 16, 36]);
      const ans = frac(s, Math.sqrt(n));
      return build('표본평균의 표준편차',
        `모표준편차가 $${s}$ 인 정규모집단에서 크기 $${n}$ 인 표본을 뽑을 때, 표본평균의 표준편차는?`,
        T(ans),
        [frac(s, n), frac(s * s, n), String(s), frac(s * s, Math.sqrt(n)), frac(s + 1, Math.sqrt(n))].map(T),
        `$\\sigma(\\overline{X}) = \\dfrac{\\sigma}{\\sqrt{n}} = \\dfrac{${s}}{${Math.sqrt(n)}} = ${ans}$`);
    },
    function normalSym() {
      const m = ri(4, 10) * 5, k = pick([2, 3, 4, 5, 6]);
      const a = m - k;
      return num('정규분포의 대칭성',
        `확률변수 $X$ 가 정규분포 $\\mathrm{N}(${m},\\ 4^2)$ 을 따를 때, $P(X \\le ${a}) = P(X \\ge c)$ 를 만족시키는 상수 $c$ 는?`, m + k,
        [m - k, m, m + 2 * k, 2 * m - a + 4],
        `평균 $${m}$ 에 대해 대칭 → $c = 2\\times ${m} - ${a} = ${m + k}$`);
    },
    function repPermCond() {
      const n = ri(3, 4);
      // 숫자 1..n 으로 중복 허락 4자리, 홀수인 개수
      const odd = Math.ceil(n / 2);
      const ans = n ** 3 * odd;
      return num('중복순열',
        `숫자 $1, 2, \\dots, ${n}$ 중에서 중복을 허락하여 만든 네 자리 자연수 중 홀수의 개수는?`, ans,
        [n ** 4, n ** 3, ans + n ** 3, n ** 3 * (n - odd)],
        `일의 자리는 홀수 ${odd}가지, 나머지 세 자리는 $${n}^3$ → $${n ** 3}\\times ${odd} = ${ans}$`);
    },
  ];

  const GEO_MORE_EASY = [
    function vecParallel() {
      const a = nz(-3, 4), b = nz(-3, 4), t = nz(-3, 3);
      // (a, b) ∥ (ta, k) → k = tb
      return num('벡터의 평행',
        `두 벡터 $\\vec p = (${a},\\ ${b})$, $\\vec q = (${t * a},\\ k)$ 가 서로 평행할 때, $k$ 의 값은?`, t * b,
        [-t * b, t * a, b, t + b, t * b + 1],
        `$\\vec q = ${t}\\vec p$ 이어야 하므로 $k = ${t}\\times ${b < 0 ? `(${b})` : b} = ${t * b}$`);
    },
    function vecPerp() {
      const a = nz(-4, 4), b = nz(-4, 4), c = nz(-3, 3);
      // (a, b) ⊥ (c·b, k) → a c b + b k = 0 → k = −a c
      const ans = -a * c;
      return num('벡터의 수직',
        `두 벡터 $\\vec p = (${a},\\ ${b})$, $\\vec q = (${c * b},\\ k)$ 가 서로 수직일 때, $k$ 의 값은?`, ans,
        [a * c, -c * b, a * b, ans + 1],
        `내적 $= ${a}\\cdot ${c * b < 0 ? `(${c * b})` : c * b} + ${b < 0 ? `(${b})` : b}k = 0$ → $k = ${ans}$`);
    },
    function midpoint3() {
      const A = [ri(-5, 5), ri(-5, 5), ri(-5, 5)], M = [ri(-3, 3), ri(-3, 3), ri(-3, 3)];
      const B = A.map((x, i) => 2 * M[i] - x);
      const ans = B[0] + B[1] + B[2];
      return num('중점',
        `점 $A(${A.join(',\\ ')})$ 와 점 $B$ 의 중점이 $M(${M.join(',\\ ')})$ 일 때, 점 $B$ 의 좌표의 합은?`, ans,
        [M[0] + M[1] + M[2], A[0] + A[1] + A[2], (A[0] + A[1] + A[2] + M[0] + M[1] + M[2]), ans + 2],
        `$B = 2M - A = (${B.join(',\\ ')})$ → 합 $${ans}$`);
    },
  ];

  const GEO_MORE_HARD = [
    function sphereCircle() {
      const [r, d, c] = pick([[5, 3, 4], [5, 4, 3], [13, 5, 12], [10, 6, 8], [10, 8, 6], [13, 12, 5]]);
      return num('구와 평면',
        `반지름이 $${r}$ 인 구와 구의 중심으로부터 거리가 $${d}$ 인 평면이 만나서 생기는 원의 반지름은?`, c,
        [r - d, r + d, c * c, d],
        `$\\sqrt{${r}^2 - ${d}^2} = \\sqrt{${c * c}} = ${c}$`);
    },
    function hyperbolaVertex() {
      const [a, b, c] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13]]);
      return num('쌍곡선',
        `두 초점이 $(\\pm ${c},\\ 0)$ 이고 점근선이 $y = \\pm\\dfrac{${b}}{${a}}x$ 인 쌍곡선의 주축의 길이는?`, 2 * a,
        [a, 2 * b, 2 * c, a + b],
        `$\\frac{b}{a} = \\frac{${b}}{${a}}$, $a^2 + b^2 = ${c * c}$ → $a = ${a}$, 주축의 길이 $2a = ${2 * a}$`);
    },
    function ellipseTangentY() {
      const x0 = nz(-3, 3), y0 = nz(-3, 3);
      // 타원 x²/(2x0²) + y²/(2y0²) = 1 은 (x0, y0) 를 지나고, 그 점의 접선 y절편 = B / y0 = 2y0
      const A = 2 * x0 * x0, B = 2 * y0 * y0;
      return num('타원의 접선',
        `타원 $\\dfrac{x^2}{${A}} + \\dfrac{y^2}{${B}} = 1$ 위의 점 $(${x0},\\ ${y0})$ 에서의 접선의 $y$ 절편은?`, 2 * y0,
        [y0, -2 * y0, 2 * x0, B],
        `접선 $\\dfrac{${x0}x}{${A}} + \\dfrac{${y0}y}{${B}} = 1$ 에 $x = 0$ 대입 → $y = \\dfrac{${B}}{${y0}} = ${2 * y0}$`);
    },
  ];

  // =====================================================================
  //  심화 다단계 문제 (2~3단계를 엮은 수능 상위권 유형)
  // =====================================================================
  const COMMON_MULTI = [
    function cubicRootCount() {
      // f(x) = x³ − 3p²x + k 가 서로 다른 세 실근 ⇔ f(−p) > 0 > f(p) ⇔ −2p³ < k < 2p³
      const p = ri(1, 2);
      const ans = 4 * p ** 3 - 1;
      return num('삼차방정식의 실근 (다단계)',
        `방정식 $x^3 - ${3 * p * p}x + k = 0$ 이 서로 다른 세 실근을 갖도록 하는 정수 $k$ 의 개수는?`, ans,
        [4 * p ** 3 + 1, 2 * p ** 3 - 1, 2 * p ** 3, 4 * p ** 3],
        `① $f'(x) = 3x^2 - ${3 * p * p} = 0$ → $x = \\pm ${p}$. ② 극댓값 $f(-${p}) = ${2 * p ** 3} + k > 0$, 극솟값 $f(${p}) = -${2 * p ** 3} + k < 0$. ③ $-${2 * p ** 3} < k < ${2 * p ** 3}$ → 정수 $${ans}$개`);
    },
    function cubicMaxToMin() {
      // f' = 3(x − p)(x − q) → f(q) − f(p) = −(q − p)³ / 2
      const p = ri(-2, 1), d = pick([2, 4]), q = p + d, M = ri(-5, 12);
      const ans = M - d ** 3 / 2;
      return num('극댓값과 극솟값 (다단계)',
        `최고차항의 계수가 $1$ 인 삼차함수 $f(x)$ 가 $x = ${p}$ 에서 극대, $x = ${q}$ 에서 극소이다. 극댓값이 $${M}$ 일 때, 극솟값은?`, ans,
        [M - d ** 3, M - d ** 3 / 6, M + d ** 3 / 2, -M, M - d * d],
        `① $f'(x) = 3(x ${signed(-p)})(x ${signed(-q)})$. ② $f(${q}) - f(${p}) = \\displaystyle\\int_{${p}}^{${q}} f'(x)\\,dx = -\\frac{(${q} - (${p}))^3}{2} = -${d ** 3 / 2}$. ③ 극솟값 $= ${M} - ${d ** 3 / 2} = ${ans}$`);
    },
    function seqFromSum() {
      const pp = ri(1, 3), q = ri(-4, 4), m = ri(8, 15), k = ri(2, 6);
      // S_n = p n² + q n → a_n = p(2n − 1) + q
      const a = n => pp * (2 * n - 1) + q;
      const ans = a(m) + a(k);
      return num('수열의 합과 일반항 (다단계)',
        `수열 $\\{a_n\\}$ 의 첫째항부터 제$n$항까지의 합이 $S_n = ${poly([[pp, 'n^2'], [q, 'n']])}$ 일 때, $a_{${m}} + a_{${k}}$ 의 값은?`, ans,
        [pp * m * m + q * m + pp * k * k + q * k, a(m) + a(k) + 2 * pp, 2 * pp * (m + k) + 2 * q, a(m) - a(k)],
        `① $a_n = S_n - S_{n-1} = ${pp === 1 ? '' : pp}(2n - 1)${signed(q)}$ ($n \\ge 1$ 에서 성립). ② $a_{${m}} = ${a(m)}$, $a_{${k}} = ${a(k)}$ → 합 $${ans}$`);
    },
    function cubicLineArea() {
      // y = x³ 과 y = k²x 로 둘러싸인 넓이 (두 부분) = k⁴ / 2
      const k = ri(1, 3);
      const ans = frac(k ** 4, 2);
      return build('두 곡선 사이의 넓이 (다단계)',
        `곡선 $y = x^3$ 과 직선 $y = ${k * k === 1 ? '' : k * k}x$ 로 둘러싸인 두 부분의 넓이의 합은?`,
        T(ans),
        [frac(k ** 4, 4), String(k ** 4), frac(k ** 4, 8), frac(k ** 3, 2), frac(k ** 4, 3)].map(T),
        `① 교점 $x = 0,\\ \\pm ${k}$. ② 대칭이므로 $2\\displaystyle\\int_0^{${k}} (${k * k === 1 ? '' : k * k}x - x^3)\\,dx = 2\\left(\\frac{${k ** 4}}{2} - \\frac{${k ** 4}}{4}\\right) = ${ans}$`);
    },
    function sinCosCube() {
      // sinθ + cosθ = r → sinθcosθ = (r² − 1)/2 → sin³θ + cos³θ = r(3 − r²)/2
      const [n, d] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]);
      const ans = frac(n * (3 * d * d - n * n), 2 * d ** 3);
      return build('삼각함수의 활용 (다단계)',
        `$\\sin\\theta + \\cos\\theta = ${frac(n, d)}$ 일 때, $\\sin^3\\theta + \\cos^3\\theta$ 의 값은?`,
        T(ans),
        [frac(n ** 3, d ** 3), frac(n * n - d * d, 2 * d * d), frac(n * (3 * d * d + n * n), 2 * d ** 3), frac(n * (d * d - n * n), 2 * d ** 3), frac(3 * n, 2 * d)].map(T),
        `① 제곱: $1 + 2\\sin\\theta\\cos\\theta = ${frac(n * n, d * d)}$ → $\\sin\\theta\\cos\\theta = ${frac(n * n - d * d, 2 * d * d)}$. ② $s^3 + c^3 = (s + c)^3 - 3sc(s + c) = ${ans}$`);
    },
    function logSystem() {
      let a, b;
      do { a = ri(3, 8); b = ri(1, 4); } while ((a + b) % 2 || b >= a);
      const x = 2 ** ((a + b) / 2), y = 2 ** ((a - b) / 2);
      return num('로그 연립방정식 (다단계)',
        `$\\log_2 x + \\log_2 y = ${a}$, $\\log_2 x - \\log_2 y = ${b}$ 일 때, $x + y$ 의 값은?`, x + y,
        [x * y, x - y, 2 ** a + 2 ** b, a + b],
        `① 더하면 $2\\log_2 x = ${a + b}$ → $x = 2^{${(a + b) / 2}} = ${x}$. ② 빼면 $2\\log_2 y = ${a - b}$ → $y = ${y}$. ③ $x + y = ${x + y}$`);
    },
  ];

  const CALC_MULTI = [
    function paramTangentIntercept() {
      let a, b, k;
      do { a = ri(-2, 2); b = ri(-3, 3); k = pick([1, 2, -1]); } while (2 * k + a === 0);
      const x0 = k * k + a * k, y0 = k ** 3 + b * k, top = 3 * k * k + b, bot = 2 * k + a;
      // y절편 = y0 − m x0 = (y0·bot − top·x0) / bot
      const ans = frac(y0 * bot - top * x0, bot);
      return build('매개변수 곡선의 접선 (다단계)',
        `$x = t^2${tail([[a, 't']])},\\ y = t^3${tail([[b, 't']])}$ 위의 $t = ${k}$ 에 대응하는 점에서의 접선의 $y$ 절편은?`,
        T(ans),
        [frac(top, bot), frac(y0 * bot + top * x0, bot), String(y0 - x0), frac(y0 * top - bot * x0, top), frac(-(y0 * bot - top * x0), bot), String(y0), frac(y0 * bot - top * x0 + bot, bot), frac(y0 * bot - top * x0 - bot, bot), frac(y0 * bot - top * x0 + 2 * bot, bot)].map(T),
        `① 점 $(${x0},\\ ${y0})$. ② 기울기 $\\dfrac{dy/dt}{dx/dt} = ${frac(top, bot)}$. ③ $y = ${frac(top, bot)}(x - ${x0 < 0 ? `(${x0})` : x0})${signed(y0)}$ 에 $x = 0$ → $${ans}$`);
    },
    function inverseComposite() {
      const a = ri(1, 3), t = pick([1, 2, -1]), c = pick([1, 3, -1, 5]);
      const v = t ** 3 + a * t;
      if ((v - c) % 2) return inverseComposite();
      const pp = (v - c) / 2;
      const fp = 3 * t * t + a;
      const ans = frac(2, fp);
      return build('역함수와 합성함수 (다단계)',
        `$f(x) = x^3${tail([[a, 'x']])}$ 의 역함수를 $g(x)$ 라 하고 $h(x) = g(2x${signed(c)})$ 라 할 때, $h'(${pp})$ 의 값은?`,
        T(ans),
        [frac(1, fp), frac(2, 3 * v * v + a), String(2 * fp), frac(1, 2 * fp), frac(2, fp + 1)].map(T),
        `① $2\\cdot ${pp < 0 ? `(${pp})` : pp}${signed(c)} = ${v} = f(${t})$ → $g(${v}) = ${t}$. ② $h'(x) = 2g'(2x${signed(c)})$. ③ $g'(${v}) = \\dfrac{1}{f'(${t})} = \\dfrac{1}{${fp}}$ → $h'(${pp}) = ${ans}$`);
    },
    function integralFuncMax() {
      // F(x) = ∫_0^x (t − a)(t − b) dt, a < b → 극댓값 F(a) = a³/3 − (a+b)a²/2 + a²b
      const a = ri(1, 2), b = a + ri(1, 3);
      const ans = frac(2 * a ** 3 - 3 * (a + b) * a * a + 6 * a * a * b, 6);
      return build('정적분으로 정의된 함수의 극값 (다단계)',
        `$F(x) = \\displaystyle\\int_0^x (t - ${a})(t - ${b})\\,dt$ 의 극댓값은?`,
        T(ans),
        [frac(2 * b ** 3 - 3 * (a + b) * b * b + 6 * a * b * b, 6), frac(a * a * b, 2), frac(-(2 * a ** 3 - 3 * (a + b) * a * a + 6 * a * a * b), 6), frac(2 * a ** 3 - 3 * (a + b) * a * a + 6 * a * a * b, 3), String(a * b)].map(T),
        `① $F'(x) = (x - ${a})(x - ${b})$ → $x = ${a}$ 에서 극대. ② $F(${a}) = \\left[\\frac{t^3}{3} - \\frac{${a + b}t^2}{2} + ${a * b}t\\right]_0^{${a}} = ${ans}$`);
    },
    function geoSeriesFromTerms() {
      const [rn, rd] = pick([[1, 2], [1, 3], [2, 3], [-1, 2]]);
      const a1 = pick([rd ** 3 * 2, rd ** 3 * 3, rd ** 3]);
      const a2 = frac(a1 * rn, rd), a4 = frac(a1 * rn ** 3, rd ** 3);
      const ans = frac(a1 * rd, rd - rn);
      return build('등비급수 (다단계)',
        `등비수열 $\\{a_n\\}$ 에서 $a_2 = ${a2},\\ a_4 = ${a4}$ 이고 공비가 ${rn > 0 ? '양수' : '음수'}일 때, $\\displaystyle\\sum_{n=1}^{\\infty} a_n$ 의 값은?`,
        T(ans),
        [frac(a1 * rn, rd - rn), frac(a1 * rd, rd + rn), String(a1), frac(a1 * rd, 2 * (rd - rn)), frac(2 * a1 * rd, rd - rn)].map(T),
        `① $r^2 = \\dfrac{a_4}{a_2} = ${frac(rn * rn, rd * rd)}$ → $r = ${frac(rn, rd)}$. ② $a_1 = \\dfrac{a_2}{r} = ${a1}$. ③ $\\dfrac{a_1}{1 - r} = ${ans}$`);
    },
    function expTangentIntercept() {
      const k = ri(1, 3);
      const E = k === 1 ? 'e' : `e^{${k}}`;
      return build('접선의 방정식 (다단계)',
        `곡선 $y = xe^x$ 위의 점 $(${k},\\ ${k === 1 ? '' : k}${E})$ 에서의 접선의 $y$ 절편은?`,
        T(`-${k * k === 1 ? '' : k * k}${E}`),
        [`${k * k === 1 ? '' : k * k}${E}`, `-${k === 1 ? '' : k}${E}`, `${k + 1}${E}`, `-${k * (k + 1)}${E}`, `-${E}`, `-${k + 1}${E}`].map(T),
        `① $y' = (x + 1)e^x$ → 기울기 $${k + 1}${E}$. ② $y = ${k + 1}${E}(x - ${k}) + ${k === 1 ? '' : k}${E}$. ③ $x = 0$: $${k}${E} - ${k * (k + 1)}${E} = -${k * k === 1 ? '' : k * k}${E}$`);
    },
    function expFuncMax() {
      // f(x) = (x² − a)e^{−x}, 1 + a = s² → 극대 x = 1 + s, 극댓값 (2 + 2s)e^{−(1+s)}
      const s = ri(2, 3), a = s * s - 1;
      return build('함수의 극값 (다단계)',
        `함수 $f(x) = (x^2 - ${a})e^{-x}$ 의 극댓값은?`,
        T(`${2 + 2 * s}e^{-${1 + s}}`),
        [`${2 - 2 * s}e^{${s - 1}}`, `${2 + 2 * s}e^{${1 + s}}`, `${(1 + s) ** 2}e^{-${1 + s}}`, `${2 + 2 * s}e^{-${s}}`, `-${a}`].map(T),
        `① $f'(x) = -(x^2 - 2x - ${a})e^{-x}$ → $x = 1 \\pm ${s}$. ② 부호가 $+ \\to -$ 로 바뀌는 $x = ${1 + s}$ 에서 극대. ③ $f(${1 + s}) = (${(1 + s) ** 2} - ${a})e^{-${1 + s}} = ${2 + 2 * s}e^{-${1 + s}}$`);
    },
  ];

  const PROB_MULTI = [
    function bayesBags() {
      const w1 = ri(2, 4), b1 = ri(1, 3), w2 = ri(1, 3), b2 = ri(2, 4);
      // 주사위 1, 2 → A (1/3), 나머지 → B (2/3)
      const pA = frac(1, 3);
      const n = w1 * (w2 + b2), d = w1 * (w2 + b2) + 2 * w2 * (w1 + b1);
      const ans = frac(n, d);
      return build('조건부확률 (다단계)',
        `주머니 A 에는 흰 공 ${w1}개, 검은 공 ${b1}개, 주머니 B 에는 흰 공 ${w2}개, 검은 공 ${b2}개가 있다. 주사위를 던져 2 이하이면 A, 아니면 B 에서 공을 하나 꺼낸다. 꺼낸 공이 흰 공일 때, 그 공이 A 에서 나왔을 확률은?`,
        T(ans),
        [frac(w1, w1 + b1), pA, frac(w1, w1 + w2), frac(w1 * (w2 + b2), w1 * (w2 + b2) + w2 * (w1 + b1)), frac(2 * w2 * (w1 + b1), d), frac(n + 1, d), frac(n, d + 1), frac(n - 1, d)].map(T),
        `① $P(A \\cap 흰) = \\frac{1}{3}\\cdot\\frac{${w1}}{${w1 + b1}}$. ② $P(흰) = \\frac{1}{3}\\cdot\\frac{${w1}}{${w1 + b1}} + \\frac{2}{3}\\cdot\\frac{${w2}}{${w2 + b2}}$. ③ 나누면 $${ans}$`);
    },
    function expectedMax() {
      const n = ri(4, 9);
      const ans = frac(2 * (n + 1), 3);
      return build('기댓값 (다단계)',
        `$1$ 부터 $${n}$ 까지 적힌 카드 ${n}장 중 2장을 동시에 뽑을 때, 뽑힌 두 수 중 큰 수를 $X$ 라 하자. $E(X)$ 는?`,
        T(ans),
        [frac(n + 1, 2), frac(2 * n + 1, 3), frac(n + 2, 2), frac(2 * n, 3), frac(n * (n + 1), 2 * (n - 1))].map(T),
        `① $P(X = k) = \\dfrac{k - 1}{_{${n}}\\mathrm{C}_2}$. ② $E(X) = \\dfrac{\\sum_{k=2}^{${n}} k(k-1)}{${n * (n - 1) / 2}} = \\dfrac{${(n + 1) * n * (n - 1) / 3}}{${n * (n - 1) / 2}} = ${ans}$`);
    },
    function binomAtLeast() {
      const n = ri(4, 7);
      const ans = frac(n + 1, 2 ** n);
      return build('이항분포의 확률 (다단계)',
        `동전을 ${n}번 던질 때 앞면이 나오는 횟수를 $X$ 라 하자. $P(X \\ge ${n - 1})$ 의 값은?`,
        T(ans),
        [frac(n, 2 ** n), frac(1, 2 ** n), frac(n + 1, 2 ** (n - 1)), frac(2 * n, 2 ** n), frac(n - 1, 2 ** n)].map(T),
        `① $P(X = ${n - 1}) = \\frac{${n}}{2^{${n}}}$, $P(X = ${n}) = \\frac{1}{2^{${n}}}$. ② 합 $= ${ans}$`);
    },
    function normalTable() {
      // P(0 ≤ Z ≤ 1) = 0.3413, P(0 ≤ Z ≤ 2) = 0.4772
      const m = ri(5, 12) * 10, s = pick([4, 5, 10]);
      const [lo, hi, ans, why] = pick([
        [m - s, m + 2 * s, '0.8185', '0.3413 + 0.4772'],
        [m + s, null, '0.1587', '0.5 - 0.3413'],
        [m - 2 * s, m + s, '0.8185', '0.4772 + 0.3413'],
        [m + s, m + 2 * s, '0.1359', '0.4772 - 0.3413'],
        [null, m - 2 * s, '0.0228', '0.5 - 0.4772'],
      ]);
      const q = lo != null && hi != null ? `P(${lo} \\le X \\le ${hi})` : lo != null ? `P(X \\ge ${lo})` : `P(X \\le ${hi})`;
      return build('정규분포 (다단계)',
        `확률변수 $X$ 가 정규분포 $\\mathrm{N}(${m},\\ ${s}^2)$ 을 따를 때, $${q}$ 의 값은? (단, $P(0 \\le Z \\le 1) = 0.3413$, $P(0 \\le Z \\le 2) = 0.4772$)`,
        T(ans),
        ['0.8185', '0.1587', '0.1359', '0.0228', '0.6826', '0.9544', '0.3413'].map(T),
        `① 표준화 $Z = \\dfrac{X - ${m}}{${s}}$. ② 구간을 $Z$ 로 바꾸면 ${why} $= ${ans}$`);
    },
    function nonAdjacent() {
      const a = ri(3, 4), b = ri(2, 3);
      const ans = fact(a) * P(a + 1, b);
      return num('이웃하지 않는 순열 (다단계)',
        `남학생 ${a}명과 여학생 ${b}명이 일렬로 설 때, 여학생끼리 서로 이웃하지 않게 서는 경우의 수는?`, ans,
        [fact(a + b) - ans, fact(a) * C(a + 1, b), fact(a + b), fact(a) * fact(b)],
        `① 남학생을 먼저 세우기 $${a}! = ${fact(a)}$. ② 사이사이와 양 끝 ${a + 1}자리 중 ${b}자리에 여학생 세우기 $_{${a + 1}}\\mathrm{P}_{${b}} = ${P(a + 1, b)}$. ③ $${ans}$`);
    },
    function monotoneWithValue() {
      const c = ri(2, 4);
      const ans = c * C(7 - c, 2);
      return num('함수의 개수 (다단계)',
        `$X = \\{1, 2, 3, 4\\}$, $Y = \\{1, 2, 3, 4, 5\\}$ 에 대하여 $f(1) \\le f(2) \\le f(3) \\le f(4)$, $f(2) = ${c}$ 를 만족시키는 함수 $f: X \\to Y$ 의 개수는?`, ans,
        [c * C(6 - c, 2), C(7 - c, 2), c + C(7 - c, 2), c * (6 - c) ** 2],
        `① $f(1) \\le ${c}$: ${c}가지. ② $${c} \\le f(3) \\le f(4) \\le 5$: $_{${6 - c}}\\mathrm{H}_2 = ${C(7 - c, 2)}$. ③ $${c}\\times ${C(7 - c, 2)} = ${ans}$`);
    },
  ];

  const GEO_MULTI = [
    function ellipseRightTriangle() {
      // ∠FPF' = 90° 인 점 P 는 원 x² + y² = c² 위에 있으므로 c ≥ b 인 타원에서만 존재한다
      const [a, b, c] = pick([[5, 3, 4], [13, 5, 12], [10, 6, 8]]);
      return num('타원과 직각삼각형 (다단계)',
        `타원 $\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1$ 의 두 초점 $F, F'$ 과 타원 위의 점 $P$ 에 대하여 $\\angle FPF' = 90^\\circ$ 일 때, 삼각형 $PFF'$ 의 넓이는?`, b * b,
        [2 * b * b, c * c, b * c, a * b],
        `① $\\overline{PF} + \\overline{PF'} = ${2 * a}$. ② $\\overline{PF}^2 + \\overline{PF'}^2 = (2c)^2 = ${4 * c * c}$. ③ $2\\overline{PF}\\cdot\\overline{PF'} = ${4 * a * a} - ${4 * c * c}$ → 넓이 $\\frac{1}{2}\\overline{PF}\\cdot\\overline{PF'} = ${b * b}$`);
    },
    function hyperbolaRightTriangle() {
      const [a, b, c] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10]]);
      return num('쌍곡선과 직각삼각형 (다단계)',
        `쌍곡선 $\\dfrac{x^2}{${a * a}} - \\dfrac{y^2}{${b * b}} = 1$ 의 두 초점 $F, F'$ 과 쌍곡선 위의 점 $P$ 에 대하여 $\\angle FPF' = 90^\\circ$ 일 때, 삼각형 $PFF'$ 의 넓이는?`, b * b,
        [2 * b * b, a * a, a * b, c * c - b * b + 1],
        `① $|\\overline{PF'} - \\overline{PF}| = ${2 * a}$. ② $\\overline{PF}^2 + \\overline{PF'}^2 = ${4 * c * c}$. ③ $2\\overline{PF}\\cdot\\overline{PF'} = ${4 * c * c} - ${4 * a * a}$ → 넓이 $${b * b}$`);
    },
    function vecMinNorm() {
      const [r, s, L] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10]]);
      let p, q;
      do { p = ri(-5, 6); q = ri(-5, 6); } while (p * s - q * r === 0);
      const ans = frac(Math.abs(p * s - q * r), L);
      return build('벡터의 크기의 최솟값 (다단계)',
        `두 벡터 $\\vec a = (${p},\\ ${q})$, $\\vec b = (${r},\\ ${s})$ 와 실수 $t$ 에 대하여 $|\\vec a + t\\vec b|$ 의 최솟값은?`,
        T(ans),
        [frac(Math.abs(p * r + q * s), L), frac(Math.abs(p * s - q * r), L * L), String(Math.abs(p * s - q * r)), frac(Math.abs(p * s - q * r) + 1, L), frac(Math.abs(p * s - q * r), 2 * L)].map(T),
        `① $|\\vec a + t\\vec b|^2$ 는 $t$ 에 대한 이차식, $t = -\\dfrac{\\vec a\\cdot\\vec b}{|\\vec b|^2}$ 에서 최소. ② 최솟값 $= \\dfrac{|${p}\\cdot ${s} - ${q < 0 ? `(${q})` : q}\\cdot ${r}|}{${L}} = ${ans}$ (수직 성분의 길이)`);
    },
    function focalChord() {
      const p = ri(1, 3), m = pick([1, 2]);
      // y² = 4px, 초점 (p, 0) 을 지나는 기울기 m 인 현의 길이 = 4p(1 + m²)/m²
      const ans = frac(4 * p * (1 + m * m), m * m);
      return build('포물선의 초점현 (다단계)',
        `포물선 $y^2 = ${4 * p}x$ 의 초점을 지나고 기울기가 $${m}$ 인 직선이 포물선과 만나는 두 점을 $A, B$ 라 할 때, 선분 $AB$ 의 길이는?`,
        T(ans),
        [frac(4 * p, m * m), String(4 * p), frac(4 * p * (1 + m * m), m), frac(2 * p * (1 + m * m), m * m), frac(4 * p * (1 + m), m * m), String(6 * p), String(10 * p), String(12 * p), String(2 * p), String(3 * p)].map(T),
        `① 교점의 $x$ 좌표 합: $(${m === 1 ? '' : m * m}(x - ${p})^2 = ${4 * p}x)$ 에서 $x_1 + x_2 = ${frac(2 * p * m * m + 4 * p, m * m)}$. ② 포물선의 정의로 $\\overline{AB} = x_1 + x_2 + 2p = ${ans}$`);
    },
    function pointPlaneDist() {
      const [[a, b, c], n] = pick([[[1, 2, 2], 3], [[2, 1, 2], 3], [[2, 3, 6], 7], [[6, 2, 3], 7], [[1, 4, 8], 9], [[4, 4, 7], 9]]);
      const P0 = [ri(-3, 3), ri(-3, 3), ri(-3, 3)], d = ri(-9, 9);
      const v = a * P0[0] + b * P0[1] + c * P0[2] + d;
      if (v === 0) return pointPlaneDist();
      const ans = frac(Math.abs(v), n);
      return build('점과 평면 사이의 거리 (다단계)',
        `점 $(${P0.join(',\\ ')})$ 과 평면 $${poly([[a, 'x'], [b, 'y'], [c, 'z'], [d, '']])} = 0$ 사이의 거리는?`,
        T(ans),
        [String(Math.abs(v)), frac(Math.abs(v), n * n), frac(Math.abs(v - d), n), frac(Math.abs(v) + 1, n), frac(Math.abs(v), a + b + c)].map(T),
        `① 법선벡터 $(${a},\\ ${b},\\ ${c})$ 의 크기 $\\sqrt{${a * a + b * b + c * c}} = ${n}$. ② $\\dfrac{|${v}|}{${n}} = ${ans}$`);
    },
    function vecProjection() {
      const [r, s, L] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13]]);
      const p = ri(-4, 6), q = ri(-4, 6);
      const dot = p * r + q * s;
      if (dot === 0) return vecProjection();
      const ans = frac(Math.abs(dot), L);
      return build('정사영 (다단계)',
        `$\\vec a = (${p},\\ ${q})$ 의 $\\vec b = (${r},\\ ${s})$ 위로의 정사영의 크기는?`,
        T(ans),
        [String(Math.abs(dot)), frac(Math.abs(dot), L * L), frac(Math.abs(p * s - q * r), L), frac(Math.abs(dot) + 1, L), frac(Math.abs(dot), 2 * L)].map(T),
        `① $\\vec a\\cdot\\vec b = ${dot}$, $|\\vec b| = ${L}$. ② 정사영의 크기 $= \\dfrac{|\\vec a\\cdot\\vec b|}{|\\vec b|} = ${ans}$`);
    },
  ];

  // =====================================================================
  //  과목(카테고리)별 문제 묶음
  // =====================================================================
  // =====================================================================
  //  추가 유형 (4차) — 각 문제는 검증용 매개변수를 _p 에 담는다 (화면에는 안 쓰임)
  // =====================================================================
  const withP = (prob, params) => { prob._p = params; return prob; };
  /** 분수 × π TeX */
  const fracPi = (p, q) => { const f = frac(p, q); return f === '0' ? '0' : f === '1' ? '\\pi' : f === '-1' ? '-\\pi' : f.includes('frac') ? f + '\\pi' : f + '\\pi'; };

  const COMMON_V4_EASY = [
    function expIneqMax() {
      const a = ri(1, 6), k = pick([2, 3, 4, 5]);
      // (1/2)^{x-a} ≥ 2^k  →  -(x-a) ≥ k  →  x ≤ a - k
      const ans = a - k;
      return withP(num('지수부등식',
        `부등식 $\\left(\\frac{1}{2}\\right)^{x - ${a}} \\ge ${2 ** k}$ 을 만족시키는 정수 $x$ 의 최댓값은?`, ans,
        [a + k, k - a, ans - 1, ans + 1],
        `$2^{-(x-${a})} \\ge 2^{${k}}$ → $-(x-${a}) \\ge ${k}$ → $x \\le ${ans}$`), { a, k, ans });
    },
    function continuity() {
      const b = nz(-4, 4), c = ri(-3, 5);
      // f(x) = x^2 + a (x<1),  bx + c (x≥1) 가 x=1 에서 연속 → 1 + a = b + c
      const ans = b + c - 1;
      return withP(num('함수의 연속',
        `함수 $f(x) = \\begin{cases} x^2 + a & (x < 1) \\\\ ${cx(b)}x${signed(c)} & (x \\ge 1) \\end{cases}$ 가 실수 전체에서 연속일 때, 상수 $a$ 의 값은?`, ans,
        [b + c, b + c + 1, b - c - 1, c - b - 1],
        `$\\lim_{x \\to 1^-} f(x) = 1 + a$, $f(1) = ${b + c}$ → $a = ${ans}$`), { b, c, ans });
    },
    function limitZeroZero() {
      const a = nz(-4, 5), b = nz(-5, 5);
      // (x^2 + (b-a)x - ab)/(x - a) = x + b → a + b
      const ans = a + b;
      return withP(num('함수의 극한 (0/0 꼴)',
        `$\\displaystyle\\lim_{x \\to ${a}} \\frac{x^2${tail([[b - a, 'x'], [-a * b, '']])}}{x${signed(-a)}}$ 의 값은?`, ans,
        [a - b, b - a, 2 * a, a * b],
        `분자 $= (x${signed(-a)})(x${signed(b)})$ → $\\lim (x${signed(b)}) = ${ans}$`), { a, b, ans });
    },
    function sectorArea() {
      const r = ri(2, 8), k = pick([2, 3, 4, 6]);
      // 반지름 r, 중심각 π/k → 넓이 r²π/(2k)
      const ans = fracPi(r * r, 2 * k);
      return withP(build('부채꼴의 넓이',
        `반지름의 길이가 $${r}$ 이고 중심각의 크기가 $\\frac{\\pi}{${k}}$ 인 부채꼴의 넓이는?`,
        T(ans),
        [fracPi(r * r, k), fracPi(r, k), fracPi(r, 2 * k), fracPi(2 * r, k), fracPi(r * r, 4 * k)].map(T),
        `$S = \\frac{1}{2} r^2 \\theta = \\frac{1}{2}\\cdot ${r * r} \\cdot \\frac{\\pi}{${k}} = ${ans}$`), { r, k, num: r * r, den: 2 * k });
    },
    function meanValue() {
      const p = ri(-3, 2), q = p + pick([2, 4, 6]), a = nz(-5, 5), b = ri(-5, 5);
      // f(x)=x²+ax+b 에서 평균값 정리를 만족하는 c = (p+q)/2
      const ans = (p + q) / 2;
      return withP(num('평균값 정리',
        `함수 $f(x) = x^2${tail([[a, 'x'], [b, '']])}$ 에 대하여 닫힌구간 $[${p},\\ ${q}]$ 에서 평균값 정리를 만족시키는 $c$ 의 값은?`, ans,
        [q - p, p + q, ans + 1, ans - 1],
        `$\\dfrac{f(${q}) - f(${p})}{${q} - (${p})} = ${p + q + a}$, $f'(c) = 2c${signed(a)}$ → $c = ${ans}$`), { p, q, a, b, ans });
    },
    function oddEvenIntegral() {
      const a = pick([1, 2, 3]), b = pick([3, 6, -3]), c = nz(-5, 5), d = ri(-4, 4);
      // ∫_{-a}^{a} (c x³ + b x² + 5x + d) dx = 2(b a³/3 + d a)
      const ans = 2 * (b * a ** 3 / 3 + d * a);
      return withP(num('정적분 (우함수·기함수)',
        `$\\displaystyle\\int_{-${a}}^{${a}} \\left(${poly([[c, 'x^3'], [b, 'x^2'], [5, 'x'], [d, '']])}\\right) dx$ 의 값은?`, ans,
        [ans / 2, ans + 2 * c * a ** 4 / 4, 0, 2 * d * a],
        `홀수 차수 항은 적분하면 0 → $2\\int_0^{${a}} (${poly([[b, 'x^2'], [d, '']])})dx = ${ans}$`), { a, b, c, d, ans });
    },
  ];

  const COMMON_V4_HARD = [
    function arithSumMid() {
      const m = ri(2, 9), s = pick([2, 4, 6]);
      const p = m - 2 * s, q = m + 2 * s;   // a3 = p, a7 = q → a5 = m
      const ans = 9 * m;                     // S9 = 9 a5
      return withP(num('등차수열의 합',
        `등차수열 $\\{a_n\\}$ 에서 $a_3 = ${p}$, $a_7 = ${q}$ 일 때, $\\displaystyle\\sum_{k=1}^{9} a_k$ 의 값은?`, ans,
        [p + q, 9 * (p + q), 10 * m, 8 * m],
        `$a_5 = \\frac{a_3 + a_7}{2} = ${m}$, $S_9 = \\frac{9(a_1 + a_9)}{2} = 9a_5 = ${ans}$`), { p, q, ans });
    },
    function tangentFromPoint() {
      const k = ri(1, 4);
      // 점 (0, -k²) 에서 y = x² 에 그은 접선: 접점 (t, t²), 기울기 2t, t² = k² → 양수 기울기 2k
      const ans = 2 * k;
      return withP(num('곡선 밖의 점에서 그은 접선',
        `점 $(0,\\ ${-k * k})$ 에서 곡선 $y = x^2$ 에 그은 두 접선 중 기울기가 양수인 접선의 기울기는?`, ans,
        [k, k * k, 4 * k, 2 * k * k],
        `접점 $(t,\\ t^2)$: $-${k * k} = t^2 - 2t\\cdot t$ → $t^2 = ${k * k}$ → 기울기 $2t = ${ans}$`), { k, ans });
    },
    function tangentArea() {
      const a = ri(1, 4);
      // y = x², x=a 에서의 접선, y축으로 둘러싸인 넓이 = a³/3
      const ans = frac(a ** 3, 3);
      return withP(build('곡선과 접선 사이의 넓이',
        `곡선 $y = x^2$ 위의 점 $(${a},\\ ${a * a})$ 에서의 접선과 곡선 및 $y$ 축으로 둘러싸인 부분의 넓이는?`,
        T(ans),
        [frac(a ** 3, 6), frac(a ** 3, 2), frac(2 * a ** 3, 3), String(a ** 3), frac(a * a, 3)].map(T),
        `$\\int_0^{${a}} (x^2 - ${2 * a}x + ${a * a})\\,dx = \\int_0^{${a}} (x - ${a})^2 dx = ${ans}$`), { a, n: a ** 3, d: 3 });
    },
    function displacement() {
      const [a, b] = pick([[1, 3], [2, 3], [1, 4], [2, 5], [3, 4], [1, 2]]);
      // v(t) = t² - (a+b)t + ab, 0~b 위치 변화 = b³/3 - (a+b)b²/2 + ab² = b²(3a - b)/6
      const n = b * b * (3 * a - b), d = 6;
      const ans = frac(n, d);
      return withP(build('위치의 변화량',
        `수직선 위를 움직이는 점 $P$ 의 시각 $t$ 에서의 속도가 $v(t) = t^2 - ${a + b}t + ${a * b}$ 일 때, 시각 $t = 0$ 에서 $t = ${b}$ 까지 점 $P$ 의 위치의 변화량은?`,
        T(ans),
        [frac(-n, d), frac(b ** 3, 3), frac(n, 3), frac(a * a * (3 * b - a), 6), frac(n + 6, d)].map(T),
        `$\\int_0^{${b}} v(t)\\,dt = ${frac(b ** 3, 3)} - ${frac((a + b) * b * b, 2)} + ${a * b * b} = ${ans}$`), { a, b, n, d });
    },
  ];

  const COMMON_V4_KILLER = [
    function closedMaxMin() {
      const k = ri(-5, 25);
      // f(x) = x³ - 3x² - 9x + k, [-2, 4]: 극대 f(-1)=5+k, 극소 f(3)=k-27, 끝 f(-2)=k-2, f(4)=k-20 → 최댓값 5+k, 최솟값 k-27
      const M = 5 + k, ans = k - 27;
      return withP(num('닫힌구간의 최대·최소 (다단계)',
        `닫힌구간 $[-2,\\ 4]$ 에서 함수 $f(x) = x^3 - 3x^2 - 9x + a$ 의 최댓값이 $${M}$ 일 때, 최솟값은?`, ans,
        [k - 20, k - 2, M - 20, k - 32],
        `$f'(x) = 3(x+1)(x-3)$. $f(-1) = a + 5 = ${M}$ → $a = ${k}$. 후보 $f(-2) = ${k - 2}$, $f(3) = ${k - 27}$, $f(4) = ${k - 20}$ → 최솟값 $${ans}$`), { k, M, ans });
    },
    function logSigma() {
      const e = ri(3, 7), n = 2 ** e - 1;
      // ∑_{k=1}^{n} log₂(1 + 1/k) = log₂(n+1) = e
      return withP(num('로그와 수열의 합 (다단계)',
        `$\\displaystyle\\sum_{k=1}^{${n}} \\log_2\\left(1 + \\frac{1}{k}\\right)$ 의 값은?`, e,
        [e - 1, e + 1, n, 2 * e],
        `$\\log_2\\frac{k+1}{k}$ 을 더하면 망원합: $\\log_2 \\frac{2}{1}\\cdot\\frac{3}{2}\\cdots\\frac{${n + 1}}{${n}} = \\log_2 ${n + 1} = ${e}$`), { n, e });
    },
  ];

  const CALC_V4_EASY = [
    function trigDeriv() {
      const a = pick([1, 2, 3]), b = pick([1, 2, 3]);
      // f(x) = sin(ax) + cos(bx), f'(π/2) = a cos(aπ/2) - b sin(bπ/2)
      const cosv = [1, 0, -1, 0][a % 4], sinv = [0, 1, 0, -1][b % 4];
      const ans = a * cosv - b * sinv;
      return withP(num('삼각함수의 미분',
        `$f(x) = \\sin ${cx(a)}x + \\cos ${cx(b)}x$ 일 때, $f'\\left(\\frac{\\pi}{2}\\right)$ 의 값은?`, ans,
        [a + b, a - b, -ans, a * sinv - b * cosv],
        `$f'(x) = ${a === 1 ? '' : a}\\cos ${cx(a)}x - ${b === 1 ? '' : b}\\sin ${cx(b)}x$ → $f'\\left(\\frac{\\pi}{2}\\right) = ${ans}$`), { a, b, ans });
    },
    function expLnLimit() {
      const a = ri(1, 6), b = ri(1, 6), useLn = Math.random() < 0.5;
      const ans = frac(a, b);
      const q = useLn ? `\\displaystyle\\lim_{x \\to 0} \\frac{\\ln(1 + ${a}x)}{${b}x}` : `\\displaystyle\\lim_{x \\to 0} \\frac{e^{${a}x} - 1}{${b}x}`;
      return withP(build(useLn ? '로그함수의 극한' : '지수함수의 극한',
        `$${q}$ 의 값은?`, T(ans),
        [frac(b, a), String(a * b), String(a), frac(1, b), '0', frac(a + 1, b)].map(T),
        `$\\lim \\frac{${useLn ? `\\ln(1+${a}x)` : `e^{${a}x}-1`}}{${a}x} = 1$ → $\\frac{${a}}{${b}} = ${ans}$`), { a, b, useLn });
    },
    function trigIntegral() {
      const a = ri(1, 6), b = ri(-4, 6);
      // ∫_0^{π/2} (a sin x + b cos x) dx = a + b
      const ans = a + b;
      return withP(num('삼각함수의 정적분',
        `$\\displaystyle\\int_0^{\\frac{\\pi}{2}} \\left(${a === 1 ? '' : a}\\sin x ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\cos x\\right) dx$ 의 값은?`, ans,
        [a - b, b - a, 2 * a, a * b],
        `$[-${a === 1 ? '' : a}\\cos x ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\sin x]_0^{\\pi/2} = ${b} + ${a} = ${ans}$`), { a, b, ans });
    },
    function expIntegral() {
      const k = ri(2, 9), c = ri(1, 3);
      // ∫_0^{ln k} c e^x dx = c(k - 1)
      const ans = c * (k - 1);
      return withP(num('지수함수의 정적분',
        `$\\displaystyle\\int_0^{\\ln ${k}} ${c === 1 ? '' : c}e^x\\,dx$ 의 값은?`, ans,
        [c * k, c * (k + 1), k - 1, c * k - 1],
        `$${c === 1 ? '' : c}[e^x]_0^{\\ln ${k}} = ${c === 1 ? '' : c}(${k} - 1) = ${ans}$`), { k, c, ans });
    },
  ];

  const CALC_V4_HARD = [
    function lnTangent() {
      const k = ri(1, 4);
      // y = ln x, x = e^k 에서의 접선 y = x/e^k + k - 1 → y절편 k - 1
      const ans = k - 1;
      return withP(num('로그함수의 접선',
        `곡선 $y = \\ln x$ 위의 점 $(e^{${k}},\\ ${k})$ 에서의 접선의 $y$ 절편은?`, ans,
        [k, k + 1, -1, 1 - k],
        `기울기 $\\frac{1}{e^{${k}}}$ → $y = \\frac{x}{e^{${k}}} + ${k} - 1$ → $y$ 절편 $${ans}$`), { k, ans });
    },
    function riemannSum() {
      const m = pick([1, 2, 3]), c = pick([1, 2, 3]);
      // lim (c/n) ∑ (1 + k/n)^m = c ∫_1^2 x^m dx = c(2^{m+1} - 1)/(m+1)
      const n = c * (2 ** (m + 1) - 1), d = m + 1;
      const ans = frac(n, d);
      return withP(build('구분구적법',
        `$\\displaystyle\\lim_{n \\to \\infty} \\frac{${c}}{n} \\sum_{k=1}^{n} \\left(1 + \\frac{k}{n}\\right)^{${m}}$ 의 값은?`, T(ans),
        [frac(c, m + 1), frac(c * 2 ** (m + 1), m + 1), frac(n, m), frac(c * (2 ** m - 1), m), String(c * 2 ** m)].map(T),
        `$${c}\\int_1^2 x^{${m}}\\,dx = ${c}\\cdot\\frac{2^{${m + 1}} - 1}{${m + 1}} = ${ans}$`), { m, c, n, d });
    },
  ];

  const CALC_V4_KILLER = [
    function tangentThroughOrigin() {
      const a = pick([1, 2, 3]);
      // y = e^{ax} 에 원점에서 그은 접선: 접점 x = 1/a, 기울기 a·e
      const ans = `${a === 1 ? '' : a}e`;
      return withP(build('원점을 지나는 접선 (다단계)',
        `원점에서 곡선 $y = e^{${a === 1 ? '' : a}x}$ 에 그은 접선의 기울기는?`, T(ans),
        ['e', '1', `${a + 1}e`, a > 1 ? `\\frac{e}{${a}}` : '\\frac{e}{2}', `${2 * a}e`, 'e^2', `${a}`].map(T),
        `접점 $(t,\\ e^{${a}t})$: $e^{${a}t} = ${a}e^{${a}t}\\cdot t$ → $t = \\frac{1}{${a}}$ → 기울기 $${a}e^{1} = ${ans}$`), { a });
    },
    function rootCount() {
      // x e^{-x} = k 의 실근 개수: 최댓값 1/e (x=1), x→∞ 에서 0⁺, x→-∞ 에서 -∞
      const [kTex, kv] = pick([['\\frac{1}{e}', 1 / Math.E], ['\\frac{1}{2e}', 1 / (2 * Math.E)], ['\\frac{1}{3}', 1 / 3], ['\\frac{2}{e}', 2 / Math.E], ['0', 0], ['-1', -1], ['\\frac{1}{4}', 0.25]]);
      const ans = kv > 1 / Math.E + 1e-12 ? 0 : Math.abs(kv - 1 / Math.E) < 1e-12 ? 1 : kv > 0 ? 2 : 1;
      return withP(build('방정식의 실근의 개수 (다단계)',
        `방정식 $xe^{-x} = ${kTex}$ 의 서로 다른 실근의 개수는?`, T(ans),
        ['0', '1', '2', '3'].map(T),
        `$f(x) = xe^{-x}$: $f'(x) = (1 - x)e^{-x}$ → $x = 1$ 에서 최댓값 $\\frac{1}{e}$, $x \\to \\infty$ 이면 $0$ 에 가까워지고 $x \\to -\\infty$ 이면 $-\\infty$. 직선 $y = ${kTex}$ 와의 교점 → ${ans}개`), { kv, ans });
    },
  ];

  const PROB_V4_EASY = [
    function endsFixed() {
      const n = ri(4, 7);
      // n명 일렬, 특정 2명이 양 끝: 2 × (n-2)!
      const f = k => (k <= 1 ? 1 : k * f(k - 1));
      const ans = 2 * f(n - 2);
      return withP(num('순열 (양 끝 고정)',
        `${n}명이 일렬로 설 때, 특정한 두 사람 A, B 가 양 끝에 서는 경우의 수는?`, ans,
        [f(n - 2), f(n) - ans, 2 * f(n - 1), f(n - 1)],
        `A, B 가 양 끝에 서는 방법 $2$, 나머지 $${n - 2}$명 $${n - 2}! = ${f(n - 2)}$ → $${ans}$`), { n, ans });
    },
    function committee() {
      const m = ri(4, 7), w = ri(3, 5), r = pick([3, 4]);
      const C = (a, b) => { let v = 1; for (let i = 0; i < b; i++) v = v * (a - i) / (i + 1); return v; };
      // 여학생 정확히 1명: C(w,1)·C(m, r-1)
      const ans = w * C(m, r - 1);
      return withP(num('조합 (조건이 있는 선택)',
        `남학생 ${m}명, 여학생 ${w}명 중에서 ${r}명을 뽑을 때, 여학생이 정확히 1명 뽑히는 경우의 수는?`, ans,
        [C(m + w, r), C(m, r - 1), w * C(m + w - 1, r - 1), C(m, r)],
        `$_{${w}}\\mathrm{C}_1 \\times {}_{${m}}\\mathrm{C}_{${r - 1}} = ${w} \\times ${C(m, r - 1)} = ${ans}$`), { m, w, r, ans });
    },
    function independentUnion() {
      const [p1, q1] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]), [p2, q2] = pick([[1, 2], [1, 3], [1, 4], [2, 5], [1, 5]]);
      // P(A∪B) = P(A) + P(B) - P(A)P(B)
      const n = p1 * q2 + p2 * q1 - p1 * p2, d = q1 * q2;
      const ans = frac(n, d);
      return withP(build('독립사건',
        `두 사건 $A$, $B$ 가 서로 독립이고 $P(A) = ${frac(p1, q1)}$, $P(B) = ${frac(p2, q2)}$ 일 때, $P(A \\cup B)$ 는?`, T(ans),
        [frac(p1 * q2 + p2 * q1, d), frac(p1 * p2, d), frac(d - n, d), frac(p1 * q2 + p2 * q1 - 2 * p1 * p2, d), frac(n + 1, d)].map(T),
        `$P(A \\cup B) = P(A) + P(B) - P(A)P(B) = ${ans}$`), { p1, q1, p2, q2, n, d });
    },
  ];

  const PROB_V4_HARD = [
    function constantTerm() {
      const [n, r] = pick([[3, 2], [6, 4]]), a = pick([1, 2, 3]);
      const C = (x, y) => { let v = 1; for (let i = 0; i < y; i++) v = v * (x - i) / (i + 1); return v; };
      // (x² + a/x)^n 의 일반항 C(n,r)(x²)^{n-r}(a/x)^r, 상수항: 2(n-r) = r
      const ans = C(n, r) * a ** r;
      return withP(num('이항정리 (상수항)',
        `$\\left(x^2 + \\frac{${a}}{x}\\right)^{${n}}$ 의 전개식에서 상수항은?`, ans,
        [C(n, r), C(n, r - 1) * a ** (r - 1), ans * a, C(n, r) * a],
        `일반항 $_{${n}}\\mathrm{C}_r (x^2)^{${n}-r}\\left(\\frac{${a}}{x}\\right)^r$, $${2 * n} - 3r = 0$ → $r = ${r}$ → $${ans}$`), { n, a, ans });
    },
    function linearTransform() {
      const m = ri(2, 8), v = pick([2, 3, 4, 5]), a = pick([2, 3, -2]), b = ri(-5, 5);
      // E(aX+b) = am + b, V(aX+b) = a² v → 둘 중 하나를 묻는다
      const askV = Math.random() < 0.5;
      const ans = askV ? a * a * v : a * m + b;
      return withP(num(askV ? '확률변수 aX+b 의 분산' : '확률변수 aX+b 의 평균',
        `확률변수 $X$ 에 대하여 $E(X) = ${m}$, $V(X) = ${v}$ 일 때, ${askV ? `$V(${a}X${signed(b)})$` : `$E(${a}X${signed(b)})$`} 의 값은?`, ans,
        askV ? [a * v, a * a * v + b, Math.abs(a) * v, a * v + b] : [a * m, m + b, a * a * m + b, a * (m + b)],
        askV ? `$V(aX+b) = a^2 V(X) = ${a * a}\\times ${v} = ${ans}$` : `$E(aX+b) = aE(X) + b = ${ans}$`), { m, v, a, b, askV, ans });
    },
    function drawBalls() {
      const w = ri(3, 5), bk = ri(2, 4);
      const C = (x, y) => { let r = 1; for (let i = 0; i < y; i++) r = r * (x - i) / (i + 1); return r; };
      // 흰 공 w, 검은 공 bk 에서 3개를 꺼낼 때 흰 공이 정확히 2개
      const n = C(w, 2) * bk, d = C(w + bk, 3);
      const ans = frac(n, d);
      return withP(build('공 꺼내기 확률',
        `흰 공 ${w}개와 검은 공 ${bk}개가 들어 있는 주머니에서 임의로 3개의 공을 동시에 꺼낼 때, 흰 공이 2개 나올 확률은?`, T(ans),
        [frac(C(w, 2), d), frac(C(w, 3), d), frac(w * C(bk, 2), d), frac(n, C(w + bk, 2) * 3), frac(w * 2, w + bk)].map(T),
        `$\\dfrac{_{${w}}\\mathrm{C}_2 \\times {}_{${bk}}\\mathrm{C}_1}{_{${w + bk}}\\mathrm{C}_3} = \\dfrac{${n}}{${d}} = ${ans}$`), { w, bk, n, d });
    },
  ];

  const PROB_V4_KILLER = [
    function surjection() {
      const n = pick([4, 5, 6]);
      // 서로 다른 공 n개를 서로 다른 상자 3개에 빈 상자 없이: 3^n - 3·2^n + 3
      const ans = 3 ** n - 3 * 2 ** n + 3;
      return withP(num('빈 상자 없이 나누기 (다단계)',
        `서로 다른 공 ${n}개를 서로 다른 상자 3개에 남김없이 넣을 때, 빈 상자가 없도록 넣는 경우의 수는?`, ans,
        [3 ** n, 3 ** n - 3 * 2 ** n, 3 ** n - 2 ** n, ans / 6],
        `전체 $3^{${n}}$ − (빈 상자가 하나 이상) $3\\cdot 2^{${n}} - 3\\cdot 1$ → $${3 ** n} - ${3 * 2 ** n} + 3 = ${ans}$`), { n, ans });
    },
    function diceConditional() {
      const s = ri(5, 9), k = pick([1, 2, 3, 4, 5, 6].filter(v => v < s && s - v <= 6));
      // 두 주사위 눈의 합이 s 일 때, 적어도 한 눈이 k 일 조건부확률
      let tot = 0, good = 0;
      for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (x + y === s) { tot++; if (x === k || y === k) good++; }
      const ans = frac(good, tot);
      return withP(build('주사위 조건부확률 (다단계)',
        `두 개의 주사위를 동시에 던져 나온 눈의 수의 합이 $${s}$ 일 때, 적어도 한 주사위의 눈이 $${k}$ 일 확률은?`, T(ans),
        [frac(good, 36), frac(1, 6), frac(11, 36), frac(1, tot), frac(good + 1, tot), frac(tot, 36)].map(T),
        `합이 $${s}$ 인 경우 $${tot}$가지 중 눈 $${k}$ 가 있는 경우 $${good}$가지 → $${ans}$`), { s, k, good, tot });
    },
  ];

  const GEO_V4_EASY = [
    function parabolaDirectrix() {
      const p = nz(-5, 5), vert = Math.random() < 0.5;
      // y² = 4px → 준선 x = -p  /  x² = 4py → 준선 y = -p
      const ans = -p;
      return withP(num('포물선의 준선',
        vert ? `포물선 $x^2 = ${4 * p}y$ 의 준선이 $y = k$ 일 때, $k$ 의 값은?` : `포물선 $y^2 = ${4 * p}x$ 의 준선이 $x = k$ 일 때, $k$ 의 값은?`, ans,
        [p, 4 * p, -4 * p, 2 * p],
        `$${vert ? 'x^2 = 4py' : 'y^2 = 4px'}$ 에서 $p = ${p}$, 준선 $${vert ? 'y' : 'x'} = -p = ${ans}$`), { p, ans });
    },
    function vectorOps() {
      const u = [nz(-3, 3), nz(-3, 3)], v = [nz(-3, 3), nz(-3, 3)], a = pick([2, 3]), b = pick([1, -1, 2]);
      // a·u + b·v 의 x 성분 + y 성분
      const w = [a * u[0] + b * v[0], a * u[1] + b * v[1]];
      const ans = w[0] + w[1];
      return withP(num('벡터의 연산',
        `두 벡터 $\\vec a = (${u[0]},\\ ${u[1]})$, $\\vec b = (${v[0]},\\ ${v[1]})$ 에 대하여 $${a}\\vec a ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\vec b = (p,\\ q)$ 일 때, $p + q$ 의 값은?`, ans,
        [u[0] + u[1] + v[0] + v[1], a * (u[0] + u[1]), ans + 2, w[0] - w[1]],
        `$(${w[0]},\\ ${w[1]})$ → $p + q = ${ans}$`), { u, v, a, b, ans });
    },
    function spaceVectorNorm() {
      const [x, y, z, n] = pick([[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [2, 10, 11, 15]]);
      const sg = () => pick([1, -1]);
      const v = [x * sg(), y * sg(), z * sg()];
      return withP(num('공간벡터의 크기',
        `좌표공간에서 벡터 $\\vec v = (${v[0]},\\ ${v[1]},\\ ${v[2]})$ 의 크기는?`, n,
        [x + y + z, n * n, n + 1, n - 1],
        `$|\\vec v| = \\sqrt{${x * x} + ${y * y} + ${z * z}} = \\sqrt{${n * n}} = ${n}$`), { v, n });
    },
  ];

  const GEO_V4_HARD = [
    function projectionLength() {
      const [bx, by, L] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10]]);
      const ax = nz(-4, 6), ay = nz(-4, 6);
      // a 의 b 위로의 정사영 길이 = |a·b| / |b|
      const n = Math.abs(ax * bx + ay * by), ans = frac(n, L);
      if (n === 0) throw new Error('수직');
      return withP(build('벡터의 정사영의 길이',
        `두 벡터 $\\vec a = (${ax},\\ ${ay})$, $\\vec b = (${bx},\\ ${by})$ 에 대하여 $\\vec a$ 의 $\\vec b$ 위로의 정사영의 길이는?`, T(ans),
        [String(n), frac(n, L * L), frac(L, n || 1), frac(n + L, L), frac(Math.abs(ax * by - ay * bx), L)].map(T),
        `$\\dfrac{|\\vec a \\cdot \\vec b|}{|\\vec b|} = \\dfrac{${n}}{${L}} = ${ans}$`), { ax, ay, bx, by, n, L });
    },
    function triangleAreaVec() {
      const a = [nz(-5, 5), nz(-5, 5)], b = [nz(-5, 5), nz(-5, 5)];
      const cr = a[0] * b[1] - a[1] * b[0];
      if (cr === 0) throw new Error('평행');
      const ans = frac(Math.abs(cr), 2);
      return withP(build('벡터와 삼각형의 넓이',
        `좌표평면에서 $\\overrightarrow{OA} = (${a[0]},\\ ${a[1]})$, $\\overrightarrow{OB} = (${b[0]},\\ ${b[1]})$ 일 때, 삼각형 $OAB$ 의 넓이는?`, T(ans),
        [String(Math.abs(cr)), frac(Math.abs(a[0] * b[0] + a[1] * b[1]), 2), frac(Math.abs(cr) + 2, 2), frac(Math.abs(cr), 4), frac(Math.abs(a[0] * b[1] + a[1] * b[0]), 2)].map(T),
        `$\\frac{1}{2}|x_1y_2 - x_2y_1| = \\frac{1}{2}|${cr}| = ${ans}$`), { a, b, cr });
    },
  ];

  const GEO_V4_KILLER = [
    function ellipsePerimeter() {
      const [a, b, c] = pick([[5, 3, 4], [5, 4, 3], [13, 5, 12], [10, 6, 8], [10, 8, 6], [13, 12, 5]]);
      // 타원 위의 점 P 와 두 초점 F, F' 가 만드는 삼각형의 둘레 = 2a + 2c
      const ans = 2 * a + 2 * c;
      return withP(num('타원과 삼각형의 둘레 (다단계)',
        `타원 $\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1$ 의 두 초점을 $F$, $F'$ 이라 하자. 타원 위의 점 $P$ ($x$ 축 위가 아닌 점) 에 대하여 삼각형 $PFF'$ 의 둘레의 길이는?`, ans,
        [2 * a, 2 * a + c, 2 * b + 2 * c, a + 2 * c, 2 * a + 2 * b],
        `$PF + PF' = 2a = ${2 * a}$, $FF' = 2c = 2\\sqrt{${a * a} - ${b * b}} = ${2 * c}$ → $${ans}$`), { a, b, c, ans });
    },
    function circleDotMax() {
      const r = ri(1, 4), d = ri(2, 6);
      // 원 x²+y²=r² 위의 P, A(d,0): OP·AP = r² - OP·OA ≤ r² + rd
      const ans = r * r + r * d;
      return withP(num('원 위의 점과 내적 (다단계)',
        `원점 $O$ 와 점 $A(${d},\\ 0)$ 이 있다. 원 $x^2 + y^2 = ${r * r}$ 위를 움직이는 점 $P$ 에 대하여 $\\overrightarrow{OP} \\cdot \\overrightarrow{AP}$ 의 최댓값은?`, ans,
        [r * r, r * d, r * r - r * d, (r + d) ** 2, r * r + d * d],
        `$\\overrightarrow{AP} = \\overrightarrow{OP} - \\overrightarrow{OA}$ → $|\\overrightarrow{OP}|^2 - \\overrightarrow{OP}\\cdot\\overrightarrow{OA} = ${r * r} - ${d}x$, $x = -${r}$ 일 때 최대 $${ans}$`), { r, d, ans });
    },
  ];

  const byName = (arr, names) => names.map(n => {
    const f = arr.find(g => g.name === n);
    if (!f) throw new Error('없는 문제 유형: ' + n);
    return f;
  });
  // 기본 = 교과서 기본 / 심화 = 공식 한두 번 (모의고사 수준) / 킬러 = 2~3단계를 엮는 수능 상위권
  const ALL = [...EASY, ...HARD, ...COMMON_EXTRA_EASY, ...COMMON_EXTRA_HARD, ...COMMON_MORE_EASY, ...COMMON_MORE_HARD,
    ...CALC_EXTRA_EASY, ...CALC_MORE_EASY, ...CALC_MORE_HARD, ...PROB_EASY, ...PROB_HARD, ...PROB_MORE_EASY, ...PROB_MORE_HARD,
    ...GEO_EASY, ...GEO_HARD, ...GEO_MORE_EASY, ...GEO_MORE_HARD];
  const pickN = names => byName(ALL, names);
  const CATS = {
    common: {
      name: '공통', sub: '수학Ⅰ · 수학Ⅱ',
      easy: [...pickN(['polyDeriv', 'integral', 'extreme', 'tangent']), ...COMMON_EXTRA_EASY, ...COMMON_MORE_EASY, ...COMMON_V4_EASY],
      hard: [...pickN(['areaBetween', 'recurrence', 'telescoping', 'logEquation', 'trigEqCount', 'logIneq', 'absIntegral', 'velocityDist']), ...COMMON_V4_HARD],
      killer: [...pickN(['undeterminedLimit', 'integralDefined', 'differentiable', 'trigQuadMax']), ...COMMON_MULTI, ...COMMON_V4_KILLER],
    },
    calc: {
      name: '미적분', sub: '미적분',
      easy: [...pickN(['limit', 'chain', 'product', 'logDeriv', 'second', 'trigMax']), ...CALC_EXTRA_EASY, ...CALC_MORE_EASY, ...CALC_V4_EASY],
      hard: [...pickN(['inverseDeriv', 'implicitDeriv', 'parametricDeriv', 'eLimit', 'sqrtSeqLimit', 'trigLimit', 'substitution', 'byParts', 'lnAreaParts', 'volumeSection']), ...CALC_V4_HARD],
      killer: [...pickN(['geometricSeries', 'inflection', 'arcLength']), ...CALC_MULTI, ...CALC_V4_KILLER],
    },
    prob: {
      name: '확률과 통계', sub: '확률과 통계',
      easy: [...PROB_EASY, ...PROB_MORE_EASY, ...PROB_V4_EASY],
      hard: [...PROB_HARD, ...PROB_MORE_HARD, ...PROB_V4_HARD],
      killer: [...PROB_MULTI, ...pickN(['condProb', 'increasingFunc']), ...PROB_V4_KILLER],
    },
    geo: {
      name: '기하', sub: '기하',
      easy: [...GEO_EASY, ...GEO_MORE_EASY, ...GEO_V4_EASY],
      hard: [...GEO_HARD, ...GEO_MORE_HARD, ...GEO_V4_HARD],
      killer: [...GEO_MULTI, ...pickN(['parabolaFocalDist', 'vecAngle']), ...GEO_V4_KILLER],
    },
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
