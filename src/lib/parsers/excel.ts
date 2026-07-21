import * as XLSX from 'xlsx';
import type { ParsedQuestion, QuestionType } from '../types';
import type { ParseResult } from './types';
import {
  detectType,
  normalizeAnswer,
  normalizeOption,
  matchTypeHeader,
  splitOptions,
} from './types';

/**
 * 解析 Excel 文件
 *
 * 格式要求：
 * - 从第一行开始应为题型标题行，题型标题需在单独一行的第一个单元格
 *   （如「一、单选题」「二．多选题」「三.填空」「四、判断」）
 * - 题型标题行与下一个题型标题行之间视为一个题型区块，区内题目均按该题型处理
 * - 不支持题干内题型标记
 * - 从题型标题行的次行开始，每一行第一个单元格视为题目格（放置题目内容）
 * - 在同一行向后查找下一单元格：空则继续；答案格式文本视为答案格
 *   （多选/多空填空答案也应在一个单元格内）；选项格式文本视为选项格；
 *   解析格式文本（「解析：xxx」/「解析:xxx」）视为解析格
 * - 选项格支持每个选项一格，也支持多个选项在同一格
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return { questions, warnings: ['Excel 文件中未找到工作表'] };
  }

  // 二维数组形式读取（每行为单元格数组）
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  if (rows.length === 0) {
    return { questions, warnings: ['Excel 文件没有数据行'] };
  }

  // 题号前缀剥离（与文本解析保持一致）
  const qStartRe = /^\s*(?:\d+\s*[、.．.)）]|[\[（(]\s*\d+\s*[）)\]]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/;

  // 当前题型标题指定的题型（null 表示未指定，使用自动检测）
  let currentForcedType: QuestionType | null = null;

  rows.forEach((row, rowIdx) => {
    if (!Array.isArray(row)) return;
    const firstCell = String(row[0] ?? '').trim();

    // 题型标题行：第一个单元格为类型标题
    const headerType = matchTypeHeader(firstCell);
    if (headerType) {
      currentForcedType = headerType;
      return;
    }

    // 空行跳过
    if (!firstCell) return;

    // 题目行：第一个单元格为题目内容（剥离题号前缀）
    const stripped = firstCell.replace(qStartRe, '').trim();
    const content = stripped || firstCell;

    const options: string[] = [];
    let answer = '';
    let analysis = '';

    // 向后扫描单元格
    for (let c = 1; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      if (!cell) continue;

      // 选项格式：字母 + 分隔符 + 内容（支持一格多选项）
      const opts = splitOptions(cell);
      if (opts.length > 0) {
        options.push(...opts);
        continue;
      }

      // 解析格式：视为解析格（支持「解析：xxx」/「解析:xxx」）
      if (/^解析[:：]/.test(cell)) {
        analysis = cell.replace(/^解析[:：]\s*/, '').trim();
        continue;
      }

      // 答案格式：支持「答案：xxx」前缀，或纯答案文本（取最后一个作为答案）
      if (/^答案[:：]/.test(cell)) {
        answer = cell.replace(/^答案[:：]\s*/, '').trim();
      } else {
        answer = cell;
      }
    }

    // 题型判定：题型标题 > 自动检测（不支持题干内标记）
    const opts = options.length > 0 ? options : null;
    const type = currentForcedType || detectType(opts, answer);

    questions.push({
      type,
      content,
      options: opts ? opts.map(normalizeOption) : null,
      answer: normalizeAnswer(answer, type),
      analysis,
      sort_order: questions.length,
    });
  });

  if (questions.length === 0) {
    warnings.push('未识别到任何题目，请检查格式（第一行应为题型标题行，如「一、单选题」）');
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
