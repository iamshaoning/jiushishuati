// 分享码生成（密码哈希由 Supabase RPC login_user/register_user 在服务端处理）

/**
 * 生成 8 位分享码（大写字母+数字，去除易混淆字符）
 * @param existingCodes 已存在的分享码集合，用于查重（数据库 UNIQUE 约束兜底）
 */
export function generateShareCode(existingCodes: string[] = []): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const existing = new Set(existingCodes.map((c) => c.toUpperCase()));
  const arr = new Uint8Array(8);
  // 最多重试 10 次，避免极小概率冲突
  for (let attempt = 0; attempt < 10; attempt++) {
    crypto.getRandomValues(arr);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[arr[i] % chars.length];
    }
    if (!existing.has(code)) return code;
  }
  // 兜底：返回最后一次生成的（数据库 UNIQUE 约束会拦截）
  crypto.getRandomValues(arr);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[arr[i] % chars.length];
  }
  return code;
}
