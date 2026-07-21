import { supabase, TABLES } from './supabase';
import { getToken } from './auth';
import type { QuestionBank, PracticeRecord } from './types';

/**
 * 学生领取题库：
 * 服务端 RPC 完成查题库、检查已领取、插入 bank_access
 * student_id 由服务端从 token 反查
 */
export async function claimBank(
  studentId: string,
  shareCode: string,
): Promise<{
  success: boolean;
  bank?: QuestionBank;
  error?: string;
  alreadyClaimed?: boolean;
}> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('claim_bank', {
    p_token: token,
    p_share_code: shareCode,
  });

  if (error) return { success: false, error: '领取失败：' + error.message };
  if (!data || data.error) {
    const err = data?.error;
    return {
      success: false,
      error: err === 'invalid_share_code' ? '分享码无效，请检查后重试' : err || '领取失败',
    };
  }

  return {
    success: true,
    bank: data.bank as QuestionBank,
    alreadyClaimed: data.already_claimed,
  };
}

/**
 * 查询学生已领取的全部题库
 * 两步查询：先查 bank_access，再批量查 question_banks
 */
export async function listStudentBanks(studentId: string): Promise<QuestionBank[]> {
  const { data: accesses, error: accErr } = await supabase
    .from(TABLES.BANK_ACCESS)
    .select('bank_id, claimed_at')
    .eq('student_id', studentId)
    .order('claimed_at', { ascending: false });

  if (accErr || !accesses || accesses.length === 0) return [];

  const bankIds = accesses.map((a) => a.bank_id);
  const { data: banks, error: bankErr } = await supabase
    .from(TABLES.QUESTION_BANKS)
    .select('*')
    .in('id', bankIds);

  if (bankErr || !banks) return [];

  // 按 claimed_at 顺序排序
  const orderMap = new Map(accesses.map((a, i) => [a.bank_id, i]));
  return (banks as QuestionBank[]).sort(
    (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
  );
}

/**
 * 移除已领取的题库（取消收藏，不删除题库本身）
 */
export async function removeClaimedBank(
  studentId: string,
  bankId: string,
): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('remove_claimed_bank', {
    p_token: token,
    p_bank_id: bankId,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 记录一次练习/考试结果
 * student_id 由服务端从 token 反查
 */
export async function recordPractice(payload: {
  student_id: string;
  bank_id: string;
  mode: 'practice' | 'exam';
  total: number;
  correct: number;
  started_at: string;
}): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('record_practice', {
    p_token: token,
    p_bank_id: payload.bank_id,
    p_mode: payload.mode,
    p_total: payload.total,
    p_correct: payload.correct,
    p_started_at: payload.started_at,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 查询学生练习记录（含题库名），按时间倒序
 */
export async function listPracticeRecords(
  studentId: string,
  limit = 20,
): Promise<PracticeRecord[]> {
  const { data, error } = await supabase
    .from(TABLES.PRACTICE_RECORDS)
    .select('*')
    .eq('student_id', studentId)
    .order('ended_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const records = data as PracticeRecord[];

  // 批量查询题库名
  if (records.length > 0) {
    const bankIds = [...new Set(records.map((r) => r.bank_id))];
    const { data: banks } = await supabase
      .from(TABLES.QUESTION_BANKS)
      .select('id, name')
      .in('id', bankIds);
    const nameMap = new Map((banks || []).map((b: any) => [b.id, b.name]));
    records.forEach((r) => {
      r.bank_name = nameMap.get(r.bank_id) || '（已删除）';
    });
  }
  return records;
}

/**
 * 学生练习统计：累计练习次数、平均正确率
 */
export async function getStudentStats(
  studentId: string,
): Promise<{ totalCount: number; avgAccuracy: number }> {
  const { data, error } = await supabase
    .from(TABLES.PRACTICE_RECORDS)
    .select('total, correct')
    .eq('student_id', studentId);
  if (error || !data || data.length === 0) return { totalCount: 0, avgAccuracy: 0 };

  const totalCount = data.length;
  const sumAccuracy = (data as { total: number; correct: number }[]).reduce(
    (s, r) => s + (r.total > 0 ? r.correct / r.total : 0),
    0,
  );
  return { totalCount, avgAccuracy: Math.round((sumAccuracy / totalCount) * 100) };
}
