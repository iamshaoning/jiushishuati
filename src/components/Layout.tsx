import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  LogOut,
  GraduationCap,
  ShieldCheck,
  History,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const teacherNav = [
  { to: '/teacher', label: '我的题库', icon: BookOpen },
  { to: '/teacher/banks/new', label: '新建题库', icon: LayoutDashboard },
  { to: '/teacher/exam-records', label: '考试记录', icon: ClipboardList },
];

const adminNav = [
  { to: '/admin', label: '账号管理', icon: Users },
  { to: '/admin/banks', label: '题库管理', icon: BookOpen },
];

const studentNav = [
  { to: '/student', label: '我的题库', icon: BookOpen },
  { to: '/student/records', label: '练习记录', icon: History },
  { to: '/student/wrong', label: '错题本', icon: AlertCircle },
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  if (!user) return null;
  const isAdmin = user.role === 'admin';
  const isStudent = user.role === 'student';
  const navItems = isAdmin ? adminNav : isStudent ? studentNav : teacherNav;
  const BrandIcon = isAdmin ? ShieldCheck : GraduationCap;
  const roleLabel = isAdmin ? '管理员控制台' : isStudent ? '学生练习台' : '教师工作台';

  const handleLogout = () => {
    logout();
    nav('/login');
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏 */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col bg-ink-700 text-white shadow-lg">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-ink-600/40">
          <div className="w-10 h-10 rounded-lg bg-amber-300/90 flex items-center justify-center shadow-md">
            <BrandIcon className="w-5 h-5 text-ink-700" />
          </div>
          <div>
            <div className="font-display font-bold text-base leading-tight">玖拾刷题</div>
            <div className="text-xs text-ink-100/70">{roleLabel}</div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            // 精确匹配，或前缀匹配（根路径只精确匹配，避免 /admin 误激活 /admin/banks）
            const isRoot = ['/teacher', '/admin', '/student'].includes(item.to);
            const active =
              loc.pathname === item.to ||
              (!isRoot && loc.pathname.startsWith(item.to + '/'));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-amber-300/15 text-amber-200 border-l-2 border-amber-300'
                    : 'text-ink-100/80 hover:bg-ink-600/40 hover:text-white border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-ink-600/40">
          <div className="text-xs text-ink-100/60 mb-1">当前账号</div>
          <div className="text-sm font-medium truncate">{user.display_name}</div>
          <div className="text-xs text-ink-100/50 mb-3">@{user.username}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-ink-100/70 hover:text-amber-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-ink-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <BrandIcon className="w-5 h-5 text-amber-300" />
          <span className="font-display font-bold">{isAdmin ? '管理员' : isStudent ? '学生' : '教师'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-100/70 truncate max-w-[120px]">{user.display_name}</span>
          <button onClick={handleLogout} aria-label="退出">
            <LogOut className="w-4 h-4 text-ink-100/70" />
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        {/* 移动端次级导航 */}
        <div className="md:hidden bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const active = loc.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-shrink-0 px-3 py-1.5 rounded text-xs ${
                  active ? 'bg-ink text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="px-4 md:px-8 lg:px-10 py-6 md:py-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
