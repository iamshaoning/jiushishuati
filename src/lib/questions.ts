import { supabase, TABLES } from './supabase';
import { getToken } from './auth';
import type { Question, ParsedQuestion } from './types';

export async function listQuestions(bankId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from(TABLES.QUESTIONS)
    .select('*')
    .eq('bank_id', bankId)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as Question[];
}

export async function createQuestion(
  bankId: string,
  q: ParsedQuestion,
): Promise<{ success: boolean; question?: Question; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('create_question', {
    p_token: token,
    p_bank_id: bankId,
    p_question: {
      type: q.type,
      content: q.content,
      options: q.options,
      answer: q.answer,
      analysis: q.analysis || '',
      sort_order: q.sort_order,
    },
  });

  if (error) return { success: false, error: error.message };
  if (!data || data.error) return { success: false, error: data?.error || '创建失败' };

  const question: Question = {
    id: data.id,
    bank_id: bankId,
    type: q.type,
    content: q.content,
    options: q.options,
    answer: q.answer,
    analysis: q.analysis || '',
    sort_order: q.sort_order,
    created_at: new Date().toISOString(),
  };
  return { success: true, question };
}

export async function updateQuestion(
  qid: string,
  bankId: string,
  patch: Partial<Question>,
): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const patchJson: Record<string, unknown> = {};
  for (const k of ['type', 'content', 'options', 'answer', 'analysis', 'sort_order'] as const) {
    if (patch[k] !== undefined) patchJson[k] = patch[k];
  }

  const { data, error } = await supabase.rpc('update_question', {
    p_token: token,
    p_question_id: qid,
    p_bank_id: bankId,
    p_patch: patchJson,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

export async function deleteQuestion(qid: string, bankId: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('delete_question', {
    p_token: token,
    p_question_id: qid,
    p_bank_id: bankId,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}


