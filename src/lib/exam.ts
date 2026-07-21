import { supabase, TABLES } from './supabase';
import { getToken } from './auth';
import type { ExamAnswer } from './types';

/**
 * 批量记录试卷答题的错题
 * 仅在考试模式（试卷型题库）下调用，只记录做错的题目
 * student_id 由服务端从 token 反查，不接受前端传入
 */
export async function recordExamAnswers(payload: {
  student_id: string;
  bank_id: string;
  wrong_answers: { question_id: string; student_answer: string; correct_answer: string }[];
}): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };

  const { data, error } = await supabase.rpc('record_exam_answers', {
    p_token: token,
    p_bank_id: payload.bank_id,
    p_wrong_answers: payload.wrong_answers,
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 教师查询某试卷的所有学生考试记录
 * 返回每个学生的错题数与考试时间
 */
export async function listExamStudentsByBank(
  bankId: string,
): Promise<
  {
    student_id: string;
    display_name: string;
    wrong_count: number;
    created_at: string;
  }[]
> {
  // 1. 以 practice_records（mode='exam'）为主表获取参与学生，取每个学生最新一次考试时间
  //    （exam_answers 只存错题，全对学生无记录，不能作为参与名单来源）
  const { data: records, error } = await supabase
    .from(TABLES.PRACTICE_RECORDS)
    .select('student_id, ended_at')
    .eq('bank_id', bankId)
    .eq('mode', 'exam')
    .order('ended_at', { ascending: false });

  if (error || !records || records.length === 0) return [];

  const latestMap = new Map<string, string>();
  (records as { student_id: string; ended_at: string }[]).forEach((r) => {
    const existing = latestMap.get(r.student_id);
    if (!existing || new Date(r.ended_at) > new Date(existing)) {
      latestMap.set(r.student_id, r.ended_at);
    }
  });

  // 2. 查询 exam_answers 统计每个学生的错题数（recordExamAnswers 每次交卷先 delete 再 insert，故仅保留最新一次）
  const { data: answers } = await supabase
    .from(TABLES.EXAM_ANSWERS)
    .select('student_id')
    .eq('bank_id', bankId);

  const wrongCountMap = new Map<string, number>();
  (answers || []).forEach((a: any) => {
    wrongCountMap.set(a.student_id, (wrongCountMap.get(a.student_id) || 0) + 1);
  });

  // 3. 批量查询学生姓名
  const studentIds = Array.from(latestMap.keys());
  const { data: users } = await supabase
    .from(TABLES.USERS)
    .select('id, display_name')
    .in('id', studentIds);
  const nameMap = new Map(
    (users || []).map((u: any) => [u.id, u.display_name]),
  );

  return Array.from(latestMap.entries()).map(([sid, endedAt]) => ({
    student_id: sid,
    display_name: nameMap.get(sid) || '未知学生',
    wrong_count: wrongCountMap.get(sid) || 0,
    created_at: endedAt,
  }));
}

/**
 * 教师查询单个学生在某试卷的详细错题
 */
export async function listExamWrongAnswersByStudent(
  bankId: string,
  studentId: string,
): Promise<ExamAnswer[]> {
  const { data, error } = await supabase
    .from(TABLES.EXAM_ANSWERS)
    .select('*')
    .eq('bank_id', bankId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as ExamAnswer[];
}

