import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * 将含 $...$ / $$...$$ 数学公式、<img> 图片标签、\n 换行的文本转为可安全渲染的 HTML 字符串
 *
 * - 块级公式 $$...$$ → KaTeX displayMode 渲染
 * - 行内公式 $...$ → KaTeX inline 渲染
 * - <img> 标签原样保留
 * - \n → <br>
 * - 公式语法错误时 throwOnError:false 降级显示原文，不抛异常
 *
 * 用法：<div dangerouslySetInnerHTML={{ __html: renderRichText(text) }} />
 */
/** LaTeX 预处理：修正 OMML→LaTeX 转换的常见问题 */
function normalizeLatex(tex: string): string {
  // 度数符号：数字后的裸 \circ 转为上标 ^\circ（OMML 转换常丢失 ^ 上标）
  // 不影响复合函数 f \circ g（字母后的 \circ 保留基线）
  return tex.replace(/(\d)\s*\\circ\b/g, '$1^\\circ');
}

export function renderRichText(text: string): string {
  if (!text) return '';
  let html = text;

  // 块级公式 $$...$$（先处理，避免被行内正则吞掉）
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    try {
      return katex.renderToString(normalizeLatex(tex), { displayMode: true, throwOnError: false });
    } catch {
      return tex;
    }
  });

  // 行内公式 $...$（不跨行，避免误匹配）
  html = html.replace(/\$([^\$\n]+?)\$/g, (_m, tex: string) => {
    try {
      return katex.renderToString(normalizeLatex(tex), { displayMode: false, throwOnError: false });
    } catch {
      return tex;
    }
  });

  // 限制图片尺寸：统一缩放到 220×160 框内（移动端不超过容器宽度），等比缩放保持比例
  // 移除固定 width/height 属性，避免 Word 原始像素尺寸覆盖限制
  html = html.replace(/<img([^>]*?)\s*\/?>/gi, (_m, attrs) => {
    const cleaned = attrs.replace(/\s+(?:width|height)\s*=\s*"[^"]*"/gi, '');
    return `<img${cleaned} style="max-width:min(220px,100%);max-height:160px;height:auto;" />`;
  });

  // 换行
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * 将含 LaTeX 公式的文本转为纯文本（用于填空题判分等需要纯文本比较的场景）
 * 覆盖初中数学常见符号与结构：分数、根式（含根指数）、上下标、弧、向量、
 * 几何/集合/逻辑符号、希腊字母等。
 * 学生作答为纯文本，正确答案可能含 LaTeX 公式标记，判分前需统一归一化。
 */
export function latexToPlainText(s: string): string {
  if (!s) return '';
  let r = s;
  // 去除图片标签（答案不应含图片，保险处理）
  r = r.replace(/<img[^>]*>/gi, '');
  // 去除公式定界符 $$...$$ 和 $...$
  r = r.replace(/\$\$([\s\S]+?)\$\$/g, '$1');
  r = r.replace(/\$([^\$\n]+?)\$/g, '$1');

  // === 复合结构（必须在去花括号和单符号替换之前处理）===
  // 分数 \frac{a}{b} / \dfrac{a}{b} / \tfrac{a}{b} → a/b（不处理嵌套分数）
  r = r.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
  // 根式 \sqrt[n]{x} → ⁿ√x（根指数转上标）；\sqrt{x} → √x
  r = r.replace(/\\sqrt\[([^\][]+)\]\{([^{}]*)\}/g, (_m, n: string, x: string) => `${toSuperscript(n)}√${x}`);
  r = r.replace(/\\sqrt\{([^{}]*)\}/g, '√$1');
  // 弧 \widehat{AB} / \overset{\frown}{AB} → ⌒AB
  r = r.replace(/\\widehat\{([^{}]*)\}/g, '⌒$1');
  r = r.replace(/\\overset\{[^{}]*\\frown[^{}]*\}\{([^{}]*)\}/g, '⌒$1');
  // 向量 \vec{a} → a→，\overrightarrow{AB} / \overleftarrow{AB} → AB→
  r = r.replace(/\\vec\{([^{}])\}/g, '$1→');
  r = r.replace(/\\over(?:right|left)arrow\{([^{}]*)\}/g, '$1→');
  // 线段/下划线 \overline{AB} / \underline{AB} → AB（初中线段通常直接写字母）
  r = r.replace(/\\over(?:line|underline)\{([^{}]*)\}/g, '$1');

  // === 度数符号（必须在通用 \circ 之前处理 ^\circ）===
  r = r.replace(/\^\\circ\b/g, '°');
  r = r.replace(/\\circ\b/g, '°');
  r = r.replace(/\\degree\b/g, '°');

  // === 关系符号 ===
  r = r.replace(/\\leqslant\b/g, '≤');
  r = r.replace(/\\geqslant\b/g, '≥');
  r = r.replace(/\\leq?\b/g, '≤');
  r = r.replace(/\\geq?\b/g, '≥');
  r = r.replace(/\\neq?\b/g, '≠');
  r = r.replace(/\\approx\b/g, '≈');
  r = r.replace(/\\equiv\b/g, '≡');
  r = r.replace(/\\cong\b/g, '≅');
  r = r.replace(/\\sim\b/g, '∼');
  r = r.replace(/\\propto\b/g, '∝');

  // === 几何符号 ===
  r = r.replace(/\\angle\b/g, '∠');
  r = r.replace(/\\triangle\b/g, '△');
  r = r.replace(/\\Delta\b/g, '△');
  r = r.replace(/\\perp\b/g, '⊥');
  r = r.replace(/\\parallel\b/g, '∥');
  r = r.replace(/\\odot\b/g, '⊙');

  // === 运算符号 ===
  r = r.replace(/\\cdot\b/g, '·');
  r = r.replace(/\\times\b/g, '×');
  r = r.replace(/\\div\b/g, '÷');
  r = r.replace(/\\pm\b/g, '±');
  r = r.replace(/\\mp\b/g, '∓');

  // === 集合符号 ===
  r = r.replace(/\\in\b/g, '∈');
  r = r.replace(/\\notin\b/g, '∉');
  r = r.replace(/\\cap\b/g, '∩');
  r = r.replace(/\\cup\b/g, '∪');
  r = r.replace(/\\subseteq\b/g, '⊆');
  r = r.replace(/\\subset\b/g, '⊂');
  r = r.replace(/\\(?:emptyset|varnothing)\b/g, '∅');
  r = r.replace(/\\forall\b/g, '∀');
  r = r.replace(/\\exists\b/g, '∃');

  // === 逻辑符号 ===
  r = r.replace(/\\because\b/g, '∵');
  r = r.replace(/\\therefore\b/g, '∴');
  r = r.replace(/\\(?:to|rightarrow)\b/g, '→');
  r = r.replace(/\\Rightarrow\b/g, '⇒');
  r = r.replace(/\\Leftarrow\b/g, '⇐');
  r = r.replace(/\\Leftrightarrow\b/g, '⇔');

  // === 省略号 / 撇号 ===
  r = r.replace(/\\cdots\b/g, '⋯');
  r = r.replace(/\\dots\b/g, '…');
  r = r.replace(/\\ldots\b/g, '…');
  r = r.replace(/\\prime\b/g, '′');

  // === 希腊字母 ===
  r = r.replace(/\\alpha\b/g, 'α');
  r = r.replace(/\\beta\b/g, 'β');
  r = r.replace(/\\gamma\b/g, 'γ');
  r = r.replace(/\\delta\b/g, 'δ');
  r = r.replace(/\\(?:epsilon|varepsilon)\b/g, 'ε');
  r = r.replace(/\\zeta\b/g, 'ζ');
  r = r.replace(/\\eta\b/g, 'η');
  r = r.replace(/\\(?:theta|vartheta)\b/g, 'θ');
  r = r.replace(/\\iota\b/g, 'ι');
  r = r.replace(/\\kappa\b/g, 'κ');
  r = r.replace(/\\lambda\b/g, 'λ');
  r = r.replace(/\\mu\b/g, 'μ');
  r = r.replace(/\\nu\b/g, 'ν');
  r = r.replace(/\\xi\b/g, 'ξ');
  r = r.replace(/\\pi\b/g, 'π');
  r = r.replace(/\\rho\b/g, 'ρ');
  r = r.replace(/\\sigma\b/g, 'σ');
  r = r.replace(/\\tau\b/g, 'τ');
  r = r.replace(/\\upsilon\b/g, 'υ');
  r = r.replace(/\\(?:phi|varphi)\b/g, 'φ');
  r = r.replace(/\\chi\b/g, 'χ');
  r = r.replace(/\\psi\b/g, 'ψ');
  r = r.replace(/\\omega\b/g, 'ω');
  r = r.replace(/\\infty\b/g, '∞');

  // === 上下标（必须在单符号替换之后、去花括号之前）===
  // 上标 ^{...} 逐字转上标，^x 单字符上标
  r = r.replace(/\^\{([^{}]*)\}/g, (_m, n: string) => toSuperscript(n));
  r = r.replace(/\^(\w)/g, (_m, n: string) => toSuperscript(n));
  // 下标 _{...} 逐字转下标，_x 单字符下标
  r = r.replace(/_\{([^{}]*)\}/g, (_m, n: string) => toSubscript(n));
  r = r.replace(/_(\w)/g, (_m, n: string) => toSubscript(n));

  // 去除剩余 LaTeX 命令的反斜杠（保留字母部分，如 \text → text）
  r = r.replace(/\\([a-zA-Z]+)/g, '$1');
  // 去除花括号
  r = r.replace(/[{}]/g, '');
  // 移除所有空格：数学表达式空格无语义，且 LaTeX 命令替换后常残留空格
  // （如 OMML→LaTeX 输出 "50 \circ" → 度数替换后 "50 °"，需移除中间空格
  // 才能与学生纯文本 "50°" 匹配）。多空答案的分隔符为 |，不在本函数处理范围内
  r = r.replace(/\s+/g, '');
  return r;
}

/** 将字符串逐字转为上标 Unicode（不能转的字符保留原样） */
function toSuperscript(n: string): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ',
  };
  return n.split('').map((c) => map[c] || c).join('');
}

/** 将字符串逐字转为下标 Unicode（不能转的字符保留原样） */
function toSubscript(n: string): string {
  const map: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
    'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
    'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
    'v': 'ᵥ', 'x': 'ₓ',
  };
  return n.split('').map((c) => map[c] || c).join('');
}
