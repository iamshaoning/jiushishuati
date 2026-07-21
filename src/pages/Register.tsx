import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { registerTeacher, registerStudent } from '@/lib/auth';
import { Loader2, ArrowLeft, UserPlus, Clock, GraduationCap, ShieldCheck, CheckCircle2 } from 'lucide-react';

type Role = 'teacher' | 'student';

export default function Register() {
  const [role, setRole] = useState<Role>('teacher');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const nav = useNavigate();
  const toast = useToast();

  const switchRole = (r: Role) => {
    if (r === role) return;
    setRole(r);
    setUsername('');
    setDisplayName('');
    setPassword('');
    setPassword2('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim() || !password) {
      toast.warning('请填写完整信息');
      return;
    }
    if (password !== password2) {
      toast.error('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      toast.warning('密码至少 6 位');
      return;
    }
    setLoading(true);
    const payload = { username, password, display_name: displayName };
    const r = role === 'teacher' ? await registerTeacher(payload) : await registerStudent(payload);
    setLoading(false);
    if (r.success) {
      if (role === 'teacher') {
        toast.success('注册成功，请等待管理员审批');
      } else {
        toast.success('注册成功，请登录');
      }
      setDone(true);
    } else {
      toast.error(r.error || '注册失败');
    }
  };

  if (done) {
    const isTeacher = role === 'teacher';
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <div className="card max-w-md w-full p-8 text-center animate-slide-up">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isTeacher ? 'bg-amber-50' : 'bg-green-50'
            }`}
          >
            {isTeacher ? (
              <Clock className="w-7 h-7 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            )}
          </div>
          <h2 className="font-display text-xl font-bold text-ink-700 mb-2">
            {isTeacher ? '注册已提交，等待审批' : '注册成功'}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {isTeacher ? (
              <>
                您的注册信息已成功提交，管理员审批通过后即可登录使用。
                <br />
                请耐心等待，如有疑问请联系管理员。
              </>
            ) : (
              <>
                您的学生账号已创建成功，现在可以登录开始练习了。
                <br />
                点击下方按钮前往登录页。
              </>
            )}
          </p>
          <button onClick={() => nav('/login')} className="btn-primary w-full">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink-700 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          返回登录
        </Link>

        <div className="card p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center shadow-md">
              <UserPlus className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink-700">账号注册</h2>
            </div>
          </div>

          {/* 角色切换标签 */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => switchRole('teacher')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${
                role === 'teacher' ? 'bg-white text-ink-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              教师注册
            </button>
            <button
              type="button"
              onClick={() => switchRole('student')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition ${
                role === 'student' ? 'bg-white text-ink-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              学生注册
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">用户名</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="3-32 字符"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">昵称</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                placeholder={role === 'teacher' ? '如：张老师' : '如：小明同学'}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="至少 6 位"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">确认密码</label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="input-field"
                placeholder="再次输入密码"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '提交中...' : role === 'teacher' ? '提交注册' : '立即注册'}
            </button>
          </form>

          <div className="mt-5 text-xs text-gray-400 leading-relaxed bg-amber-50/60 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
            {role === 'teacher' ? (
              <>
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>教师账号注册后需等待管理员审批通过方可登录。</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>学生账号注册后即可登录使用，无需等待审批</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
