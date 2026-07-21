import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { login } from '@/lib/auth';
import { Loader2, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const { setUser } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.warning('请输入用户名和密码');
      return;
    }
    setLoading(true);
    const r = await login(username.trim(), password);
    setLoading(false);
    if (r.success && r.user) {
      setUser(r.user);
      toast.success('登录成功');
      const target =
        r.user.role === 'admin' ? '/admin' : r.user.role === 'student' ? '/student' : '/teacher';
      nav(target, { replace: true });
    } else {
      toast.error(r.error || '登录失败');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="w-full max-w-md">
        <div className="card p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center shadow-md">
              <LogIn className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink-700">玖拾刷题</h2>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">用户名</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="请输入用户名"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            还没有账号？
            <Link to="/register" className="inline-flex items-center gap-1 text-ink-700 hover:underline ml-1">
              <UserPlus className="w-3.5 h-3.5" />
              立即注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
