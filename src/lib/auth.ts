import { supabase } from './supabase';
import type { User, UserRole, UserStatus } from './types';

const SESSION_KEY = 'shuati_admin_session';

// 与本地刷题工具一致的状态语义
// 0 = NORMAL（正常）, 1 = BANNED（封禁）, 2 = PENDING（待审批）
export const STATUS = {
  NORMAL: 0,
  BANNED: 1,
  PENDING: 2,
} as const;

export interface SessionUser {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  auth_token: string;
}

/**
 * 登录：调用 Supabase RPC login_user（密码 hash 由服务端处理）
 */
export async function login(
  username: string,
  password: string,
): Promise<{ success: boolean; user?: SessionUser; error?: string }> {
  const { data, error } = await supabase.rpc('login_user', {
    p_username: username.trim(),
    p_password: password,
  });

  if (error) {
    return { success: false, error: '登录失败：' + error.message };
  }
  if (!data || !data.id) {
    return { success: false, error: '用户名或密码错误' };
  }

  const user = data as SessionUser;

  // 管理员不限制状态
  if (user.role !== 'admin') {
    if (user.status === STATUS.PENDING) {
      return { success: false, error: '账号待审批，请等待管理员通过' };
    }
    if (user.status === STATUS.BANNED) {
      return { success: false, error: '账号已被封禁，请联系管理员' };
    }
  }

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    status: user.status,
    auth_token: (user as any).auth_token,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

/**
 * 教师注册：调用 Supabase RPC register_user
 * 教师注册后状态为 PENDING（2），需管理员审批
 */
export async function registerTeacher(payload: {
  username: string;
  password: string;
  display_name: string;
}): Promise<{ success: boolean; error?: string }> {
  const username = payload.username.trim();
  const display_name = payload.display_name.trim();

  if (!username || !payload.password || !display_name) {
    return { success: false, error: '请填写完整信息' };
  }
  if (username.length < 3 || username.length > 32) {
    return { success: false, error: '用户名长度需 3-32 字符' };
  }
  if (payload.password.length < 6) {
    return { success: false, error: '密码至少 6 位' };
  }

  const { data, error } = await supabase.rpc('register_user', {
    p_username: username,
    p_password: payload.password,
    p_display_name: display_name,
    p_role: 'teacher',
  });

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data || !data.id) {
    // 可能是 RPC 返回的 { error: 'username_exists' } 等结构
    const errCode = (data as any)?.error;
    if (errCode === 'username_exists') return { success: false, error: '用户名已被使用' };
    if (errCode === 'invalid_role') return { success: false, error: '身份选择无效' };
    return { success: false, error: errCode || '注册失败' };
  }

  return { success: true };
}

/**
 * 学生注册：调用 register_user RPC，role='student'
 * 修改后的 RPC 会自动设置 status=NORMAL(0)，注册后可直接登录（无需审批）
 */
export async function registerStudent(payload: {
  username: string;
  password: string;
  display_name: string;
}): Promise<{ success: boolean; error?: string }> {
  const username = payload.username.trim();
  const display_name = payload.display_name.trim();

  if (!username || !payload.password || !display_name) {
    return { success: false, error: '请填写完整信息' };
  }
  if (username.length < 3 || username.length > 32) {
    return { success: false, error: '用户名长度需 3-32 字符' };
  }
  if (payload.password.length < 6) {
    return { success: false, error: '密码至少 6 位' };
  }

  const { data, error } = await supabase.rpc('register_user', {
    p_username: username,
    p_password: payload.password,
    p_display_name: display_name,
    p_role: 'student',
  });

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data || !data.id) {
    const errCode = (data as any)?.error;
    if (errCode === 'username_exists') return { success: false, error: '用户名已被使用' };
    if (errCode === 'invalid_role') return { success: false, error: '身份选择无效' };
    return { success: false, error: errCode || '注册失败' };
  }

  return { success: true };
}

export function getCurrentUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * 获取当前登录 token（供 lib 写函数调 RPC 时传 p_token）
 */
export function getToken(): string | null {
  return getCurrentUser()?.auth_token ?? null;
}

export function logout(): void {
  const token = getToken();
  if (token) {
    // best-effort 清空服务端 token，不阻塞（即使失败也清本地）
    supabase.rpc('logout', { p_token: token }).then(() => {}, () => {});
  }
  localStorage.removeItem(SESSION_KEY);
}

// 兼容性导出（避免其他文件引用断裂）
export type { User };
