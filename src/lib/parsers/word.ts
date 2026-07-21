import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import omml2mathml from 'omml2mathml';
import { MathMLToLaTeX } from 'mathml-to-latex';
import type { ParsedQuestion } from '../types';
import type { ParseResult } from './types';
import { parsePastedText } from './text';

/**
 * 提取 Word 文件纯文本（保留 base64 图片为 <img>，OMML 公式转为 $...$ LaTeX），不进行题目解析
 * 供答案文件等场景复用
 */
export async function extractWordText(file: File): Promise<string> {
  let arrayBuffer = await file.arrayBuffer();

  // 预处理：将 OMML 公式替换为 $...$ LaTeX 文本，避免 mammoth 丢失公式
  arrayBuffer = await preprocessOmmlMath(arrayBuffer);

  // mammoth.convertToHtml 可在浏览器中使用
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(function (image: any) {
        // 直接转 base64 内嵌
        return image.read('base64').then(function (imageBuffer: string) {
          return {
            src: 'data:' + image.contentType + ';base64,' + imageBuffer,
          };
        });
      }),
    },
  );

  const html = result.value || '';
  // 将 HTML 转回简单文本，但保留 <img> 标签与 $...$ 公式文本
  return htmlToPlainWithImages(html);
}

/**
 * 预处理 docx：解压 → 提取 OMML 公式转 LaTeX → 替换回 document.xml → 重新打包
 *
 * 流程：
 * 1. JSZip 解压 docx，读取 word/document.xml
 * 2. DOMParser 解析 XML，遍历 oMathPara（块级公式）与独立 oMath（行内公式）节点
 * 3. omml2mathml 转 MathML → mathml-to-latex 转 LaTeX
 * 4. 用 $...$ / $$...$$ 文本节点替换原 OMML 节点（DOM 自动 XML 转义）
 * 5. 序列化回 document.xml，重新打包为 arrayBuffer 交给 mammoth
 *
 * 任何环节失败均返回原 arrayBuffer（降级为无公式解析，不影响图片/文本）
 */
async function preprocessOmmlMath(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) return arrayBuffer;

    const xml = await docFile.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    // 块级公式容器（整体替换，其内部 oMath 不再单独处理）
    const paraNodes = Array.from(doc.getElementsByTagNameNS('*', 'oMathPara'));
    // 行内公式：未被 oMathPara 包裹的独立 oMath
    const inlineNodes = Array.from(doc.getElementsByTagNameNS('*', 'oMath')).filter(
      (n) => !n.parentElement || n.parentElement.localName !== 'oMathPara',
    );

    let converted = 0;
    for (const node of paraNodes) {
      const latex = ommlToLatex(node);
      if (latex !== null) {
        replaceNodeWithText(node, `$$${latex}$$`);
        converted++;
      }
    }
    for (const node of inlineNodes) {
      const latex = ommlToLatex(node);
      if (latex !== null) {
        replaceNodeWithText(node, `$${latex}$`);
        converted++;
      }
    }

    if (converted === 0) return arrayBuffer;

    const newXml = new XMLSerializer().serializeToString(doc);
    zip.file('word/document.xml', newXml);
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch {
    // 预处理失败：降级返回原始 buffer，按原流程（无公式）解析
    return arrayBuffer;
  }
}

/** OMML 节点 → LaTeX 字符串，失败返回 null */
function ommlToLatex(node: Element): string | null {
  try {
    const mathmlEl = omml2mathml(node) as Element;
    const mathmlStr = new XMLSerializer().serializeToString(mathmlEl);
    const latex = MathMLToLaTeX.convert(mathmlStr);
    return latex;
  } catch {
    return null;
  }
}

/** 用 w:r > w:t 结构替换原节点，使 mammoth 能识别为正常文本输出 */
function replaceNodeWithText(node: Node, text: string): void {
  const parent = node.parentNode;
  const owner = node.ownerDocument;
  if (!parent || !owner) return;
  // mammoth 只遍历 w:r > w:t 提取文本，裸文本节点会被忽略导致内容丢失
  // 因此必须构造 w:r > w:t 结构，xml:space="preserve" 防止公式内空格被折叠
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';
  const r = owner.createElementNS(W_NS, 'w:r');
  const t = owner.createElementNS(W_NS, 'w:t');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  parent.replaceChild(r, node);
}

/**
 * 解析 Word 文件
 * mammoth 转 HTML 后抽取文本（保留 base64 图片为 <img>，OMML 公式已预处理为 $...$）
 */
export async function parseWordFile(file: File): Promise<ParseResult> {
  const text = await extractWordText(file);
  return parsePastedText(text);
}

/**
 * 将 mammoth 输出的 HTML 转为纯文本+图片标记
 * - <p> -> 换行
 * - <img src="..."> -> 保留原样
 * - <br> -> 换行
 * - 其他标签剥离（$...$ 公式文本保留）
 */
function htmlToPlainWithImages(html: string): string {
  // 替换 <img> 为占位以便后续保留
  const imgs: string[] = [];
  let tmp = html.replace(/<img[^>]*src="([^"]+)"[^>]*\/?>(?:<\/img>)?/gi, (_m, src) => {
    // 浏览器无法渲染 WMF/EMF 图元文件（通常为 MathType 旧版公式图片）
    // 输出明确提示，避免显示破损的 alt 文本
    if (/^data:image\/(?:x-)?(?:wmf|emf)/i.test(src)) {
      return '\n[此处为 MathType/WMF 公式图片，浏览器不支持显示。请在 Word 中将公式转换为原生公式（插入→公式）后重新上传]\n';
    }
    imgs.push(src);
    return `\n[IMG_${imgs.length - 1}]\n`;
  });

  // <p> / <br> 转换行
  tmp = tmp.replace(/<\/p>/gi, '\n');
  tmp = tmp.replace(/<p[^>]*>/gi, '');
  tmp = tmp.replace(/<br\s*\/?>/gi, '\n');

  // 剥离其他标签
  tmp = tmp.replace(/<[^>]+>/g, '');

  // 解码 HTML 实体
  tmp = decodeEntities(tmp);

  // 还原图片为 HTML 形式（题目内容存储格式）
  tmp = tmp.replace(/\[IMG_(\d+)\]/g, (_m, idx) => {
    const src = imgs[parseInt(idx, 10)];
    return src ? `<img src="${src}" alt="image" />` : '';
  });

  return tmp;
}

function decodeEntities(s: string): string {
  const map: Record<string, string> = {
    '&nbsp;': ' ',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
  };
  return s.replace(/&(nbsp|lt|gt|amp|quot|#39);/g, (m) => map[m] || m);
}
