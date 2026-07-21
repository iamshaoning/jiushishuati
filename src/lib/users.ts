import { supabase } from './supabase';
import { STATUS, getToken } from './auth';
import type { User, UserStats } from './types';

/**
 * 管理员：查询所有用户（调用 RPC get_all_users，需 admin token）
 */
export async function listAllUsers(): Promise<User[]> {
  const token = getToken();
  if (!token) return [];
  const { data, error } = await supabase.rpc('get_all_users', { p_token: token });
  if (error || !data) return [];
  return data as User[];
}

/**
 * 审批通过教师：status 2(PENDING) -> 0(NORMAL)
 */
export async function approveTeacher(userId: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };
  const { data, error } = await supabase.rpc('update_user_status', {
    p_token: token,
    p_user_id: userId,
    p_status: STATUS.NORMAL,
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 拒绝教师注册：直接删除账号（不保留记录）
 */
export async function rejectTeacher(
  userId: string,
  adminId: string,
): Promise<{ success: boolean; error?: string }> {
  return deleteUser(userId, adminId);
}

/**
 * 封禁：status -> 1(BANNED)
 */
export async function banUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };
  const { data, error } = await supabase.rpc('update_user_status', {
    p_token: token,
    p_user_id: userId,
    p_status: STATUS.BANNED,
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 解封：status -> 0(NORMAL)
 */
export async function unbanUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };
  const { data, error } = await supabase.rpc('update_user_status', {
    p_token: token,
    p_user_id: userId,
    p_status: STATUS.NORMAL,
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 管理员删除用户：调用 RPC delete_user_by_admin（需 admin token）
 * adminId 参数保留以兼容调用方，实际身份由 token 反查
 */
export async function deleteUser(userId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录，请重新登录' };
  const { data, error } = await supabase.rpc('delete_user_by_admin', {
    p_token: token,
    p_user_id: userId,
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/**
 * 用户统计：get_all_users 返回后前端计算
 */
export async function getUserStats(): Promise<UserStats> {
  const token = getToken();
  if (!token) return { students: 0, teachers: 0, pending: 0, banned: 0 };
  const { data, error } = await supabase.rpc('get_all_users', { p_token: token });
  if (error || !data) return { students: 0, teachers: 0, pending: 0, banned: 0 };

  const stats: UserStats = { students: 0, teachers: 0, pending: 0, banned: 0 };
  for (const row of data as Pick<User, 'role' | 'status'>[]) {
    if (row.role === 'student') stats.students++;
    if (row.role === 'teacher') {
      stats.teachers++;
      if (row.status === STATUS.PENDING) stats.pending++;
    }
    if (row.status === STATUS.BANNED && row.role !== 'admin') stats.banned++;
  }
  return stats;
}
