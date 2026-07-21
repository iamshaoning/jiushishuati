import type { ParsedQuestion, QuestionType } from '../types';
import type { ParseResult } from './types';
import { detectType, normalizeAnswer, normalizeOption, matchTypeHeader, extractTypeFromContent, splitOptions } from './types';

/**
 * 解析粘贴文本格式
 *
 * 支持特性：
 * 1. 类型标题（优先级最高）：「一、单选题」「二．多选题」「三.填空」「四、判断」
 *    命中后，到下一个类型标题前的题目都按该题型处理
 * 2. 题干内题型标记：「1.（单选题）题目」「1.题目(判断)」命中后本题按对应题型处理
 * 3. 题号格式：1./1．/1、/1)/1）/(1)/（1）/[1]/①（不支持中文数字题号）
 * 4. 选项格式：A./A．/A、/A)/A）/A:/A：
 *    选项分行灵活：每选项一行 / 所有选项一行 / 任意个数选项一行多行（如 AB一行 CD一行）
 * 5. 题答一体：题干 + 选项 + 答案：xxx + 解析：xxx
 * 6. 题答分离：调用 parseSeparateText
 * 7. 填空题空位标记：()/（）/__ 保留在题干中
 */
export function parsePastedText(text: string): ParseResult {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  // 统一换行
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // 题号正则：
  // - 数字 + 分隔符：1. / 1． / 1、 / 1) / 1）
  // - 括号数字（不需额外分隔符）：(1) / （1） / [1]
  // - 圈号：① ② ③ ... ⑳
  const qStartRe = /^\s*(?:\d+\s*[、.．.)）]|[\[（(]\s*\d+\s*[）)\]]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/;

  // 选项行正则：A. / A． / A、 / A) / A） / A: / A：
  const optionRe = /^\s*[A-Za-z]\s*[.．、)）：:]/;

  let cur: (Partial<ParsedQuestion> & { _opts?: string[] }) | null = null;
  let curAnswerRaw = '';
  let curAnalysisRaw = '';
  let inOptions = false;
  let inAnswer = false;
  let inAnalysis = false;
  // 当前类型标题指定的题型（null 表示未指定，使用自动检测）
  let currentForcedType: QuestionType | null = null;

  const pushCurrent = () => {
    if (!cur || !cur.content) return;
    const opts = cur._opts && cur._opts.length > 0 ? cur._opts : null;
    // 优先级：类型标题 > 题干内题型标记 > 自动检测
    const { type: typeFromContent, content: cleanedContent } = extractTypeFromContent(cur.content.trim());
    const type = currentForcedType || typeFromContent || detectType(opts, curAnswerRaw || cur.answer || '');
    questions.push({
      type,
      content: cleanedContent,
      options: opts ? opts.map(normalizeOption) : null,
      answer: normalizeAnswer(curAnswerRaw || cur.answer || '', type),
      analysis: curAnalysisRaw.trim() || cur.analysis || '',
      sort_order: questions.length,
    });
    cur = null;
    curAnswerRaw = '';
    curAnalysisRaw = '';
    inOptions = false;
    inAnswer = false;
    inAnalysis = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      // 空行：保持当前状态（不强制结束）
      continue;
    }

    // 类型标题识别（优先级最高）
    const headerType = matchTypeHeader(line);
    if (headerType) {
      // 提交当前题目
      pushCurrent();
      currentForcedType = headerType;
      inOptions = false;
      inAnswer = false;
      inAnalysis = false;
      continue;
    }

    // 答案标记
    if (/^答案[:：]/.test(line)) {
      inAnswer = true;
      inAnalysis = false;
      inOptions = false;
      curAnswerRaw = line.replace(/^答案[:：]\s*/, '').trim();
      continue;
    }
    if (/^解析[:：]/.test(line)) {
      inAnalysis = true;
      inAnswer = false;
      inOptions = false;
      curAnalysisRaw = line.replace(/^解析[:：]\s*/, '').trim();
      continue;
    }

    // 新题开始
    if (qStartRe.test(line)) {
      pushCurrent();
      cur = { content: '', answer: '', analysis: '', _opts: [] };
      cur.content = line.replace(qStartRe, '').trim();
      inOptions = false;
      inAnswer = false;
      inAnalysis = false;
      continue;
    }

    // 选项行（支持一行多个选项：A. xxx B. yyy / 全部一行 / AB一行 CD一行）
    if (optionRe.test(line)) {
      inOptions = true;
      inAnswer = false;
      inAnalysis = false;
      if (cur) {
        if (!cur._opts) cur._opts = [];
        const parts = splitOptions(line);
        if (parts.length > 0) {
          cur._opts.push(...parts);
        } else {
          cur._opts.push(line);
        }
      }
      continue;
    }

    // 续行
    if (!cur) {
      // 没有题号开头：作为新题处理
      cur = { content: line, answer: '', analysis: '', _opts: [] };
      continue;
    }

    if (inAnswer) {
      curAnswerRaw += ' ' + line;
    } else if (inAnalysis) {
      curAnalysisRaw += ' ' + line;
    } else if (inOptions) {
      // 选项续行：可能含新选项（如选项内容换行后接 B.xxx）
      const parts = splitOptions(line);
      if (parts.length > 0 && cur._opts) {
        cur._opts.push(...parts);
      } else if (cur._opts && cur._opts.length > 0) {
        cur._opts[cur._opts.length - 1] += ' ' + line;
      }
    } else {
      // 题干续行
      cur.content = (cur.content || '') + '\n' + line;
    }
  }
  pushCurrent();

  if (questions.length === 0) {
    warnings.push('未识别到任何题目，请检查格式（每题需以 1. 或 1、 或 ① 开头）');
  }

  // 校验
  questions.forEach((q, i) => {
    if (q.type !== 'short' && q.type !== 'judge' && (!q.options || q.options.length === 0)) {
      warnings.push(`第 ${i + 1} 题缺少选项`);
    }
    if (!q.answer) {
      warnings.push(`第 ${i + 1} 题缺少答案`);
    }
  });

  return { questions, warnings };
}

/**
 * 解析题答分离格式：
 *   questionsText: 仅含题干+选项
 *   answersText: "1.A 2.BCD 3.对 4.填空答案..."
 */
export function parseSeparateText(questionsText: string, answersText: string): ParseResult {
  const warnings: string[] = [];
  const base = parsePastedText(questionsText);

  // 解析答案表
  const answerMap = new Map<number, string>();
  // 支持 "1.A" / "1、A" / "1) A" / "1）A" / "①A" / "1．A" / "1: A" / "1：A"
  const ansRe = /(?:(\d+)|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*[.．、)）：:]?\s*([^\n\r]+)/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = ansRe.exec(answersText)) !== null) {
    idx += 1;
    const ans = m[2].trim();
    // 截断到下一个题号前
    const next = ans.search(/(?:\d+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*[.．、)）：:]/);
    const cleaned = next > 0 ? ans.slice(0, next).trim() : ans;
    answerMap.set(idx, cleaned);
  }

  // 应用答案
  base.questions.forEach((q, i) => {
    const ans = answerMap.get(i + 1);
    if (ans) {
      const type = detectType(q.options, ans);
      q.type = type;
      q.answer = normalizeAnswer(ans, type);
    } else {
      warnings.push(`第 ${i + 1} 题未在答案中找到对应`);
    }
  });

  return { questions: base.questions, warnings: base.warnings.concat(warnings) };
}

