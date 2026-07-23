import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { login, registerTeacher, registerStudent } from '@/lib/auth';
import {
  Loader2,
  UserPlus,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Clock,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

// 适配 vite base 路径（生产环境为 /jiushishuati/，dev 为 /）
const FAVICON = `${import.meta.env.BASE_URL}favicon.svg`;

type Mode = 'login' | 'register';
type Role = 'teacher' | 'student';

/**
 * 形变过渡阶段：
 * - idle：正常态（登录/注册模式自由切换）
 * - form-fading：登录中，表单 + 墨绿元素淡出（比例不变）
 * - expanding：登录中，白色区域向左展开至系统页比例
 * - leaving-start：登出进入，匹配系统页比例的起始态
 * - leaving-expand：登出进入，墨绿侧边栏展开至登录页比例
 * - mode-switching：登录/注册模式切换，旧表单淡出 + 背景形变 + 新表单淡入
 */
type Phase = 'idle' | 'form-fading' | 'expanding' | 'leaving-start' | 'leaving-expand' | 'mode-switching';

/* ---------- 登录表单 ---------- */
function LoginForm({
  onRegister,
  onLoginSuccess,
}: {
  onRegister: () => void;
  onLoginSuccess: (target: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
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
      const target =
        r.user.role === 'admin' ? '/admin' : r.user.role === 'student' ? '/student' : '/teacher';
      // 触发形变过渡，不立即跳转
      onLoginSuccess(target);
    } else {
      toast.error(r.error || '登录失败');
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in-slow">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-ink-700 mb-1">欢迎回来</h2>
        <p className="text-sm text-gray-500">- Sign In -</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">用户名</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field pl-9"
              placeholder="请输入用户名"
              autoComplete="username"
              autoFocus
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pl-9 pr-9"
              placeholder="请输入密码"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              tabIndex={-1}
              aria-label={showPwd ? '隐藏密码' : '显示密码'}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        还没有账号？
        <button
          type="button"
          onClick={onRegister}
          className="inline-flex items-center gap-1 text-ink-700 hover:underline ml-1 font-medium"
        >
          <UserPlus className="w-3.5 h-3.5" />
          立即注册
        </button>
      </div>
    </div>
  );
}

/* ---------- 注册表单 ---------- */
function RegisterForm({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<Role>('teacher');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
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
      // 先淡出表单，再切换到成功卡片
      setFading(true);
      setTimeout(() => setDone(true), 300);
    } else {
      toast.error(r.error || '注册失败');
    }
  };

  // 注册成功：渐现成功卡片
  if (done) {
    const isTeacher = role === 'teacher';
    return (
      <div className="w-full max-w-md animate-slide-up-slow">
        <div className="text-center">
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
                点击下方按钮前往登录。
              </>
            )}
          </p>
          <button onClick={onBack} className="btn-primary w-full">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-md animate-fade-in-slow"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease-out' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink-700 mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        返回登录
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-ink-700 flex items-center justify-center shadow-md">
          <UserPlus className="w-5 h-5 text-amber-300" />
        </div>
        <h2 className="font-display text-xl font-bold text-ink-700">账号注册</h2>
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
  );
}

/* ---------- 主页面：纵向(移动)/横向(桌面) + mode 切换动画 + 登录/登出形变过渡 ---------- */
export default function AuthPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>(loc.pathname === '/register' ? 'register' : 'login');
  const [formKey, setFormKey] = useState(0);
  const [targetMode, setTargetMode] = useState<Mode | null>(null);
  // 惰性初始化：如果是从登出跳过来（sessionStorage 有标记），直接以 leaving-start 起始
  const [phase, setPhase] = useState<Phase>(() => {
    if (sessionStorage.getItem('authLogoutTransition')) {
      sessionStorage.removeItem('authLogoutTransition');
      return 'leaving-start';
    }
    return 'idle';
  });

  const switchMode = (m: Mode) => {
    if (m === mode || phase !== 'idle') return;
    // 先淡出旧表单 + 背景形变，再切换到新表单淡入
    setTargetMode(m);
    setPhase('mode-switching');
    setTimeout(() => {
      setMode(m);
      setFormKey((k) => k + 1);
      setTargetMode(null);
      setPhase('idle');
    }, 300);
  };

  const isLogin = mode === 'login';

  // 登录成功：表单淡出 → 白色展开 → 跳转系统页
  const onLoginSuccess = (target: string) => {
    setPhase('form-fading');
    setTimeout(() => {
      setPhase('expanding');
      setTimeout(() => {
        nav(target, { replace: true });
      }, 500);
    }, 300);
  };

  // 登出进入：如果初始 phase 是 leaving-start，播放反向形变
  // 用 useEffect（浏览器绘制后执行）确保 leaving-start 先被渲染绘制，再切换到 leaving-expand 触发 transition
  useEffect(() => {
    if (phase !== 'leaving-start') return;
    const timer = setTimeout(() => {
      setPhase('leaving-expand');
      setTimeout(() => setPhase('idle'), 500);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // 根据 phase 计算布局参数
  const getLayout = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1100;
    // 移动端：纵向布局，墨绿品牌区在上、白色表单区在下；形变目标为系统页顶部块高度（顶栏44+次级导航44=88px）
    if (isMobile) {
      // 顶栏 logo：px-3(12px) py-3(12px) 黄框 w-5(20px)；idle logo：top-8 left-8(32px) w-10(40px)
      // 形变后位移至顶栏位置：translate(12-32, 12-32) = (-20, -20)，并 scale(0.5) 缩到顶栏 logo 尺寸
      const logoAtBar = 'translate(-20px, -20px) scale(0.5)';
      const logoAtIdle = 'translate(0px, 0px) scale(1)';
      // 文字额外缩放：idle 文字 text-base(16px)，顶栏文字 text-sm(14px)
      // 容器整体 scale(0.5) 后文字视觉 8px，需额外 scale(1.75) 抵消到 14px
      // 配合 transformOrigin: left center，文字左边对齐顶栏文字左边
      const titleAtBar = 'scale(1.75)';
      const titleAtIdle = 'scale(1)';
      switch (phase) {
        case 'form-fading':
          return { leftBasis: '40vh', rightBasis: '0', mainGrow: 1, sideOpacity: 0, formOpacity: 0, logoTransform: logoAtIdle, titleTransform: titleAtIdle };
        case 'expanding':
          return { leftBasis: '88px', rightBasis: '0', mainGrow: 1, sideOpacity: 0, formOpacity: 0, logoTransform: logoAtBar, titleTransform: titleAtBar };
        case 'leaving-start':
          return { leftBasis: '88px', rightBasis: '0', mainGrow: 1, sideOpacity: 0, formOpacity: 0, logoTransform: logoAtBar, titleTransform: titleAtBar };
        case 'leaving-expand':
          return { leftBasis: '40vh', rightBasis: '0', mainGrow: 1, sideOpacity: 0, formOpacity: 0, logoTransform: logoAtIdle, titleTransform: titleAtIdle };
        case 'mode-switching':
          return { leftBasis: '40vh', rightBasis: '0', mainGrow: 1, sideOpacity: 1, formOpacity: 0, logoTransform: logoAtIdle, titleTransform: titleAtIdle };
        default:
          return { leftBasis: '40vh', rightBasis: '0', mainGrow: 1, sideOpacity: 1, formOpacity: 1, logoTransform: logoAtIdle, titleTransform: titleAtIdle };
      }
    }
    // 桌面端：左右分栏，形变目标为系统页侧边栏宽度占比（lg:w-64 = 256px）
    const sidebarWidth = 256;
    const sidebarPercent = (sidebarWidth / Math.max(window.innerWidth, 1)) * 100;
    // mode-switching 阶段用目标 mode 的比例（旧 mode 还未切换）
    const effectiveLogin = targetMode ? targetMode === 'login' : isLogin;
    // 桌面端文字 text-base 与侧边栏文字 text-base 尺寸一致，无需额外缩放
    const titleTransform = 'scale(1)';
    switch (phase) {
      case 'form-fading':
        return { leftBasis: '60%', rightBasis: '40%', mainGrow: 0, sideOpacity: 0, formOpacity: 0, logoTransform: 'translate(0px, 0px) scale(1)', titleTransform };
      case 'expanding':
        return {
          leftBasis: `${sidebarPercent}%`,
          rightBasis: `${100 - sidebarPercent}%`,
          mainGrow: 0,
          sideOpacity: 0,
          formOpacity: 0,
          logoTransform: 'translate(-28px, -24px) scale(1)',
          titleTransform,
        };
      case 'leaving-start':
        return {
          leftBasis: `${sidebarPercent}%`,
          rightBasis: `${100 - sidebarPercent}%`,
          mainGrow: 0,
          sideOpacity: 0,
          formOpacity: 0,
          logoTransform: 'translate(-28px, -24px) scale(1)',
          titleTransform,
        };
      case 'leaving-expand':
        return { leftBasis: '60%', rightBasis: '40%', mainGrow: 0, sideOpacity: 0, formOpacity: 0, logoTransform: 'translate(0px, 0px) scale(1)', titleTransform };
      case 'mode-switching':
        return {
          leftBasis: effectiveLogin ? '60%' : '50%',
          rightBasis: effectiveLogin ? '40%' : '50%',
          mainGrow: 0,
          sideOpacity: 1,
          formOpacity: 0,
          logoTransform: 'translate(0px, 0px) scale(1)',
          titleTransform,
        };
      default:
        return {
          leftBasis: isLogin ? '60%' : '50%',
          rightBasis: isLogin ? '40%' : '50%',
          mainGrow: 0,
          sideOpacity: 1,
          formOpacity: 1,
          logoTransform: 'translate(0px, 0px) scale(1)',
          titleTransform,
        };
    }
  };

  const layout = getLayout();
  // logo 旁的品牌文字始终跟随 logo 容器的 transform 一起位移缩放，到达目标位置
  const titleOpacity = 1;
  // 中部大字/版权的 opacity transition：
  // - idle 阶段 0.5s（登出时文字出现，与 Layout entering 0.5s 一致）
  // - 其他阶段 0.3s（登录时文字消失 0.3s）
  const sideOpacityTransition =
    phase === 'idle' ? 'opacity 0.5s ease-out' : 'opacity 0.3s ease-out';

  return (
    <div className="min-h-screen flex flex-col desktop:flex-row bg-cream">
      {/* 品牌氛围区：移动端在上（纵向），桌面端在左 */}
      <aside
        className="relative flex flex-col justify-between overflow-hidden bg-ink-700 text-white p-8 desktop:p-12"
        style={{
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: layout.leftBasis,
          transition: 'flex-basis 0.5s ease-out',
        }}
      >
        {/* 装饰光晕：左上较小 + 右下较大（部分溢出） */}
        <div className="absolute top-40 left-64 w-80 h-80 rounded-full bg-amber-300/5 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-20 w-[36rem] h-[36rem] rounded-full bg-amber-300/5 blur-3xl pointer-events-none" />

        {/* logo：绝对定位，位置稳定不受 aside 高度变化影响（修复形变结束向下闪现） */}
        <div
          className="absolute top-8 left-8 desktop:top-12 desktop:left-12 flex items-center gap-3"
          style={{
            transform: layout.logoTransform,
            transformOrigin: 'top left',
            transition: 'transform 0.5s ease-out',
          }}
        >
          <div className="w-10 h-10 rounded-lg bg-amber-300 flex items-center justify-center shadow-md p-1.5">
            <img src={FAVICON} alt="玖拾刷题" className="w-full h-full object-contain" />
          </div>
          <div
            className="font-display text-base font-bold leading-tight"
            style={{
              opacity: titleOpacity,
              transform: layout.titleTransform,
              transformOrigin: 'left center',
              transition: 'opacity 0.3s ease-out, transform 0.5s ease-out',
            }}
          >
            玖拾刷题
          </div>
        </div>

        {/* 中部大字 + 版权：flex 布局 */}
        <div className="relative flex flex-col justify-between h-full pointer-events-none">
          <div />
          {/* 中部大字：sideOpacity 控制 */}
          <div
            style={{
              opacity: layout.sideOpacity,
              transition: sideOpacityTransition,
            }}
          >
            <h1 className="font-display text-4xl desktop:text-5xl font-bold leading-tight text-white">刷题 · 管理</h1>
          </div>

          {/* 底部版权：sideOpacity 控制 */}
          <div
            className="text-xs text-ink-100/50"
            style={{
              opacity: layout.sideOpacity,
              transition: sideOpacityTransition,
            }}
          >
            2026 · 闫少宁
          </div>
        </div>
      </aside>

      {/* 表单区：移动端 flex-1 占满剩余，桌面端固定比例 */}
      <main
        className="flex items-center justify-center p-6"
        style={{
          flexGrow: layout.mainGrow,
          flexShrink: 0,
          flexBasis: layout.rightBasis,
          transition: 'flex-basis 0.5s ease-out, flex-grow 0.5s ease-out',
        }}
      >
        <div className="w-full max-w-md mx-auto">
          {/* 表单区：用 opacity 控制淡入淡出 */}
          <div
            style={{
              opacity: layout.formOpacity,
              transition: 'opacity 0.3s ease-out',
            }}
          >
            <div key={formKey}>
              {isLogin ? (
                <LoginForm
                  onRegister={() => switchMode('register')}
                  onLoginSuccess={onLoginSuccess}
                />
              ) : (
                <RegisterForm onBack={() => switchMode('login')} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
