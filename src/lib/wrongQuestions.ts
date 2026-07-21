import { supabase, TABLES } from './supabase';
import { getToken } from './auth';
import type { WrongQuestion, QuestionType } from './types';

/**
 * 记录或更新错题（upsert：同一学生同一题只保留最近一次）
 * student_id 由服务端从 token 反查
 */
export async function upsertWrongQuestion(payload: {
  student_id: string;
  bank_id: string;
  question_id: string;
  student_answer: string;
  correct_answer: string;
  mode: 'practice' | 'exam';
}): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('upsert_wrong_question', {
    p_token: token,
    p_bank_id: payload.bank_id,
    p_question_id: payload.question_id,
    p_student_answer: payload.student_answer,
    p_correct_answer: payload.correct_answer,
    p_mode: payload.mode,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 批量记录错题（考试模式一次性提交多题）
 */
export async function upsertWrongQuestions(
  studentId: string,
  items: {
    bank_id: string;
    question_id: string;
    student_answer: string;
    correct_answer: string;
    mode: 'practice' | 'exam';
  }[],
): Promise<{ success: boolean; error?: string }> {
  if (items.length === 0) return { success: true };

  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('upsert_wrong_questions', {
    p_token: token,
    p_items: items,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 查询学生错题本（含题目内容与题库名）
 */
export async function listWrongQuestions(
  studentId: string,
): Promise<WrongQuestion[]> {
  // 1. 查询错题记录
  const { data: wrongs, error } = await supabase
    .from(TABLES.WRONG_QUESTIONS)
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error || !wrongs || wrongs.length === 0) return [];

  // 2. 批量查询题目内容
  const questionIds = [...new Set(wrongs.map((w: any) => w.question_id))];
  const { data: questions } = await supabase
    .from(TABLES.QUESTIONS)
    .select('id, content, type, options, bank_id')
    .in('id', questionIds);
  const qMap = new Map((questions || []).map((q: any) => [q.id, q]));

  // 3. 批量查询题库名
  const bankIds = [...new Set(wrongs.map((w: any) => w.bank_id))];
  const { data: banks } = await supabase
    .from(TABLES.QUESTION_BANKS)
    .select('id, name')
    .in('id', bankIds);
  const bankMap = new Map((banks || []).map((b: any) => [b.id, b.name]));

  return (wrongs as any[]).map((w) => {
    const q = qMap.get(w.question_id);
    return {
      ...w,
      bank_name: bankMap.get(w.bank_id) || '（已删除）',
      question_content: q?.content || '（题目已删除）',
      question_type: q?.type as QuestionType | undefined,
      question_options: q?.options || null,
    } as WrongQuestion;
  });
}

/**
 * 删除错题（学生重做正确后调用）
 */
export async function removeWrongQuestion(
  studentId: string,
  questionId: string,
): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('remove_wrong_question', {
    p_token: token,
    p_question_id: questionId,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 错题本统计：总数 + 按题型分组
 */
export async function getWrongQuestionStats(
  studentId: string,
): Promise<{ total: number; byType: Record<QuestionType, number> }> {
  const { data: wrongs, error } = await supabase
    .from(TABLES.WRONG_QUESTIONS)
    .select('question_id')
    .eq('student_id', studentId);

  if (error || !wrongs || wrongs.length === 0) {
    return { total: 0, byType: { single: 0, multiple: 0, judge: 0, short: 0 } };
  }

  // 查询题目类型
  const questionIds = [...new Set(wrongs.map((w: any) => w.question_id))];
  const { data: questions } = await supabase
    .from(TABLES.QUESTIONS)
    .select('id, type')
    .in('id', questionIds);
  const typeMap = new Map((questions || []).map((q: any) => [q.id, q.type]));

  const byType: Record<QuestionType, number> = { single: 0, multiple: 0, judge: 0, short: 0 };
  (wrongs as any[]).forEach((w) => {
    const t = typeMap.get(w.question_id) as QuestionType | undefined;
    if (t) byType[t] += 1;
  });

  return { total: wrongs.length, byType };
}
