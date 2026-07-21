import * as XLSX from 'xlsx';
import { extractWordText } from './word';

export interface AnswerEntry {
  answer: string;
  analysis: string;
}

// 序号前缀：数字/圈号 + 必需分隔符（分隔符必需，避免误清填空数字答案如 "1"）
const NUM_PREFIX_RE = /^\s*(?:\d+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*[.．、)）：:]\s*/;
const ANSWER_PREFIX_RE = /^答案[:：]\s*/;
const ANALYSIS_PREFIX_RE = /^解析[:：]\s*/;

/**
 * 剥离答案文本中的序号与「答案：」前缀
 * 循环清理，兼容「答案：1.A」「1.答案：A」等任意顺序
 */
function cleanAnswerPrefix(s: string): string {
  let prev: string;
  let cur = s.trim();
  do {
    prev = cur;
    cur = cur
      .replace(ANSWER_PREFIX_RE, '')
      .replace(NUM_PREFIX_RE, '')
      .trim();
  } while (cur !== prev);
  return cur;
}

/**
 * 解析答案文件（题答分文件上传时的答案文件）
 *
 * - word：按「序号 + 间隔符 + 答案内容」格式，一号一行一答案（不需要「答案：」文本）
 * - excel：每行第一个单元格为一个题的答案（有序号 / 「答案：」文本都行），
 *   第二个单元格若存在内容则视为本题解析（有 / 无「解析：」文本都行），向下依次排序
 */
export async function parseAnswerFile(file: File): Promise<AnswerEntry[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    return parseAnswerExcel(file);
  }
  if (name.endsWith('.docx')) {
    return parseAnswerText(await extractWordText(file));
  }
  return [];
}

/**
 * 解析 word 答案文本
 * 每行格式：「序号 + 可选间隔符 + 答案内容」，一号一行一答案
 * 可选「解析：xxx」行归入上一题解析
 */
export function parseAnswerText(text: string): AnswerEntry[] {
  const entries: AnswerEntry[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  // 序号 + 可选分隔符 + 答案内容（答案内容至少一字符）
  const re = /^\s*(?:\d+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*[.．、)）：:,，]?\s*(.+)$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // 解析行：归入上一题
    if (ANALYSIS_PREFIX_RE.test(line)) {
      if (entries.length > 0) {
        entries[entries.length - 1].analysis = line.replace(ANALYSIS_PREFIX_RE, '').trim();
      }
      continue;
    }

    const m = line.match(re);
    if (m) {
      entries.push({ answer: cleanAnswerPrefix(m[1]), analysis: '' });
    }
    // 非答案非解析行：跳过
  }
  return entries;
}

/**
 * 解析 excel 答案文件
 * 每行第一格为答案（自动剥离序号与「答案：」前缀），第二格为解析（剥离「解析：」前缀）
 * 空行跳过，向下依次与题目顺序对应
 */
async function parseAnswerExcel(file: File): Promise<AnswerEntry[]> {
  const entries: AnswerEntry[] = [];
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return entries;

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const a = String(row[0] ?? '').trim();
    if (!a) continue; // 空行跳过

    const answer = cleanAnswerPrefix(a);
    let analysis = '';
    if (row.length > 1) {
      const b = String(row[1] ?? '').trim();
      if (b) {
        analysis = b.replace(ANALYSIS_PREFIX_RE, '').trim();
      }
    }
    entries.push({ answer, analysis });
  }
  return entries;
}
