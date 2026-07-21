import { supabase, TABLES } from './supabase';
import { getToken } from './auth';
import type { QuestionBank, ParsedQuestion, Question } from './types';

/**
 * 创建题库 + 批量插入题目
 * share_code 由服务端 RPC 生成（查重），owner_id 取自 token
 * @param payload.type 题库类型：practice（练习题）| exam（试卷）
 */
export async function createBankWithQuestions(payload: {
  name: string;
  description: string;
  owner_id: string;
  questions: ParsedQuestion[];
  type?: 'practice' | 'exam';
}): Promise<{ success: boolean; id?: string; share_code?: string; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const questionsJson = payload.questions.map((q, i) => ({
    type: q.type,
    content: q.content,
    options: q.options,
    answer: q.answer,
    analysis: q.analysis || '',
    sort_order: q.sort_order ?? i,
  }));

  const { data, error } = await supabase.rpc('create_bank', {
    p_token: token,
    p_name: payload.name.trim(),
    p_description: payload.description.trim(),
    p_type: payload.type || 'practice',
    p_questions: questionsJson,
  });

  if (error) return { success: false, error: '题库创建失败：' + error.message };
  if (!data || data.error) return { success: false, error: data?.error || '创建失败' };

  return { success: true, id: data.id, share_code: data.share_code };
}

/**
 * 教师查询自己的题库
 */
export async function listMyBanks(ownerId: string): Promise<QuestionBank[]> {
  const { data, error } = await supabase
    .from(TABLES.QUESTION_BANKS)
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as QuestionBank[];
}

/**
 * 查询单个题库（直接查表，再用 get_all_banks_with_owner RPC 取 owner_name）
 */
export async function getBank(bankId: string): Promise<QuestionBank | null> {
  const { data, error } = await supabase
    .from(TABLES.QUESTION_BANKS)
    .select('*')
    .eq('id', bankId)
    .maybeSingle();
  if (error || !data) return null;

  // 通过 RPC 获取 owner_name（与其他列表保持一致）
  const all = await listAllBanks();
  const found = all.find((b) => b.id === bankId);
  return { ...(data as QuestionBank), owner_name: found?.owner_name };
}

export async function updateBankMeta(
  bankId: string,
  patch: { name?: string; description?: string },
): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('update_bank', {
    p_token: token,
    p_bank_id: bankId,
    p_name: patch.name !== undefined ? patch.name.trim() : null,
    p_description: patch.description !== undefined ? patch.description.trim() : null,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

export async function deleteBank(bankId: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('delete_bank', {
    p_token: token,
    p_bank_id: bankId,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

export async function getBankByShareCode(code: string): Promise<QuestionBank | null> {
  const { data, error } = await supabase
    .from(TABLES.QUESTION_BANKS)
    .select('*')
    .eq('share_code', code.trim().toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as QuestionBank;
}

/**
 * 管理员：查询全部题库（含 owner_name），调用 RPC get_all_banks_with_owner
 */
export async function listAllBanks(): Promise<QuestionBank[]> {
  const { data, error } = await supabase.rpc('get_all_banks_with_owner', {});
  if (error || !data) return [];
  // RPC 返回的字段可能是 owner_name 或 display_name，做兼容
  return (data as any[]).map((row) => ({
    ...row,
    owner_name: row.owner_name || row.display_name || '未知',
  })) as QuestionBank[];
}

export async function adminDeleteBank(bankId: string): Promise<{ success: boolean; error?: string }> {
  return deleteBank(bankId);
}

export type { Question };
