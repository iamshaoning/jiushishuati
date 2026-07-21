import type { ParsedQuestion, QuestionType } from '../types';

export interface ParseResult {
  questions: ParsedQuestion[];
  warnings: string[];
}

/**
 * 检测题型：根据选项和答案推断
 */
export function detectType(options: string[] | null, answer: string): QuestionType {
  if (!options || options.length === 0) {
    // 无选项
    const a = answer.trim().toUpperCase();
    // 判断题答案：对/错、正确/错误、Y/N
    if (['对', '错', '正确', '错误', 'Y', 'N'].includes(a)) {
      return 'judge';
    }
    return 'short';
  }
  // 多选判定：答案含多个字母（分隔符支持 空格/，/,/、）
  const cleaned = answer.replace(/[\s,，、]/g, '').toUpperCase();
  if (cleaned.length > 1 && /^[A-Z]+$/.test(cleaned)) {
    return 'multiple';
  }
  return 'single';
}

/**
 * 规整答案：
 * - judge：统一为 对/错（输入支持 对/错、正确/错误、Y/N）
 * - multiple：去重排序（分隔符支持 空格/，/,/、）
 * - single：保留单字母
 * - short：多空答案分隔符统一为 |（输入支持 空格/，/,/、）
 */
export function normalizeAnswer(answer: string, type: QuestionType): string {
  const a = answer.trim();
  if (type === 'judge') {
    const up = a.toUpperCase();
    if (['对', '正确', 'Y'].includes(up)) return '对';
    if (['错', '错误', 'N'].includes(up)) return '错';
    return a;
  }
  if (type === 'multiple') {
    const cleaned = a.replace(/[\s,，、]/g, '').toUpperCase();
    return cleaned
      .split('')
      .filter((c) => /[A-Z]/.test(c))
      .sort()
      .join('');
  }
  if (type === 'single') {
    return a.replace(/[,，\s]/g, '').toUpperCase();
  }
  // short：多空答案分隔符统一为 |（输入支持 空格/，/,/、）
  const parts = a.split(/[\s,，、]+/).filter((s) => s.length > 0);
  return parts.join('|');
}

/**
 * 规整选项：剥离前缀
 * 支持分隔符：. ． 、 ) ） : ：
 */
export function normalizeOption(opt: string): string {
  const m = opt.match(/^\s*([A-Za-z])\s*[.．、)）：:]\s*(.+)$/);
  if (m) {
    return `${m[1].toUpperCase()}. ${m[2].trim()}`;
  }
  return opt.trim();
}

/**
 * 推断选项前缀字母
 * 支持分隔符：. ． 、 ) ） : ：
 */
export function optionLetter(opt: string): string {
  const m = opt.match(/^\s*([A-Za-z])\s*[.．、)）：:]/);
  return m ? m[1].toUpperCase() : '';
}

/**
 * 检测行是否为"类型标题"：如 "一、单选题" / "二．多选题" / "三.填空" / "四、判断"
 * 支持分隔符：、 . ．
 * 题型支持：单选/多选/填空/判断（可加"题"字）
 * 返回匹配到的题型，未匹配返回 null
 */
export function matchTypeHeader(line: string): QuestionType | null {
  const m = line.match(/^\s*[一二三四五六七八九十]+\s*[、.．]\s*(单选|多选|填空|判断)(?:题)?\s*$/);
  if (!m) return null;
  const map: Record<string, QuestionType> = {
    单选: 'single',
    多选: 'multiple',
    填空: 'short',
    判断: 'judge',
  };
  return map[m[1]] || null;
}

/**
 * 拆分一行中的多个选项
 * 支持："A. 选项A B. 选项B" → ["A. 选项A", "B. 选项B"]
 * 也支持单选项："A. 选项A" → ["A. 选项A"]
 */
export function splitOptions(line: string): string[] {
  const re = /^\s*[A-Za-z]\s*[.．、)）：:]/;
  if (!re.test(line)) return [];
  // 在空格+选项前缀处分割
  const parts = line.split(/\s+(?=[A-Za-z]\s*[.．、)）：:])/);
  return parts
    .map((p) => p.trim())
    .filter((p) => p && re.test(p));
}

/**
 * 从题干内容中提取题型标记
 * 支持位置：题干开头或结尾
 * 支持括号：中文（）和英文 ()
 * 返回 { type, content } — content 已移除标记
 */
export function extractTypeFromContent(content: string): {
  type: QuestionType | null;
  content: string;
} {
  const map: Record<string, QuestionType> = {
    单选: 'single',
    多选: 'multiple',
    填空: 'short',
    判断: 'judge',
  };
  const re = /[（(]\s*(单选|多选|填空|判断)(?:题)?\s*[）)]/;
  const m = content.match(re);
  if (!m) return { type: null, content };
  return {
    type: map[m[1]] || null,
    content: content.replace(re, '').trim(),
  };
}
