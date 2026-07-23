import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  LogOut,
  History,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';

// 适配 vite base 路径（生产环境为 /jiushishuati/，dev 为 /）
const FAVICON = `${import.meta.env.BASE_URL}favicon.svg`;

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

// 判断菜单项是否激活（根路径只精确匹配，避免 /admin 误激活 /admin/banks）
function isActiveItem(pathname: string, to: string): boolean {
  const isRoot = ['/teacher', '/admin', '/student'].includes(to);
  return pathname === to || (!isRoot && pathname.startsWith(to + '/'));
}

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [leaving, setLeaving] = useState(false);
  // 进入时元素淡入（从 AuthPage 形变过来后，系统元素缓慢淡入）
  const [entering, setEntering] = useState(true);

  // 滑动指示器：记录每个菜单项的 DOM 位置
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, visible: false });

  if (!user) return null;
  const isAdmin = user.role === 'admin';
  const isStudent = user.role === 'student';
  const navItems = isAdmin ? adminNav : isStudent ? studentNav : teacherNav;
  const roleLabel = isAdmin ? '管理员控制台' : isStudent ? '学生练习台' : '教师工作台';

  // 路由变化时更新指示器位置
  useLayoutEffect(() => {
    const activeIdx = navItems.findIndex((item) => isActiveItem(loc.pathname, item.to));
    const el = itemRefs.current[activeIdx];
    if (el) {
      setIndicator({ top: el.offsetTop, height: el.offsetHeight, visible: true });
    } else {
      setIndicator((prev) => ({ ...prev, visible: false }));
    }
  }, [loc.pathname, navItems]);

  // 进入时淡入：挂载后触发系统元素淡入
  useEffect(() => {
    const timer = setTimeout(() => {
      setEntering(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    // 登出：菜单/内容淡出（logo 区域保持可见），然后跳转 AuthPage
    // 淡出时长 0.3s，与 AuthPage 中部大字/版权消失时长一致
    setLeaving(true);
    sessionStorage.setItem('authLogoutTransition', '1');
    setTimeout(() => {
      logout();
      nav('/login', { replace: true });
    }, 300);
  };

  // 通用淡入淡出 class：进入时 0.5s 淡入，登出时 0.3s 淡出
  // （与 AuthPage 中部大字/版权出现/消失时长一致）
  const fadeClass = leaving
    ? 'duration-300 opacity-0'
    : entering
    ? 'duration-500 opacity-0'
    : 'duration-500 opacity-100';
  const asideContentClass = `transition-opacity ${fadeClass}`;
  const mainClass = `transition-opacity ${fadeClass}`;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏：背景色保持，logo 区域始终可见，菜单/用户信息淡入淡出 */}
      <aside className="hidden desktop:flex desktop:w-64 flex-col bg-ink-700 text-white shadow-lg z-50">
        {/* 品牌区域：logo + 大标题，始终可见，衔接 AuthPage logo 形变后的位置 */}
        <div className="px-5 py-6 border-b border-ink-600/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-300 flex items-center justify-center shadow-md p-1.5">
              <img src={FAVICON} alt="玖拾刷题" className="w-full h-full object-contain" />
            </div>
            <div className="font-display font-bold text-base leading-tight">玖拾刷题</div>
          </div>
          {/* 小标题：独立一行，跟随淡入淡出，不影响 logo 和大标题 */}
          <div className={`text-xs text-ink-100/70 mt-1.5 transition-opacity ${fadeClass}`}>
            {roleLabel}
          </div>
        </div>

        {/* 菜单 + 用户信息：entering/leaving 时淡入淡出 */}
        <div className={`flex flex-col flex-1 ${asideContentClass}`}>
          <nav className="relative flex-1 py-4">
            {/* 滑动指示器 */}
            {indicator.visible && (
              <div
                className="absolute left-0 right-0 bg-amber-300/15 border-l-2 border-amber-300 pointer-events-none"
                style={{
                  top: indicator.top,
                  height: indicator.height,
                  transition: 'top 0.3s ease-out, height 0.3s ease-out',
                }}
              />
            )}
            {navItems.map((item, i) => {
              const Icon = item.icon;
              const active = isActiveItem(loc.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className={`relative flex items-center gap-3 px-5 py-2.5 text-sm transition-colors duration-300 border-l-2 border-transparent ${
                    active
                      ? 'text-amber-200'
                      : 'text-ink-100/80 hover:bg-ink-600/40 hover:text-white'
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
        </div>
      </aside>

      {/* 移动端 fixed 顶部块：顶栏 + 次级导航合并（无空行，整体不随滚动）。
          父块统一墨绿背景，次级导航文字淡出时背景由父块填充，避免登出闪烁 */}
      <div className="desktop:hidden fixed top-0 inset-x-0 z-50 bg-ink-700">
        {/* 顶栏：黄框 logo + 标题 + 右侧操作一行不换行；py-3 让顶部块总高度精确为 88px（顶栏 44 + 次级导航 44） */}
        <div className="bg-ink-700 text-white px-3 py-3 flex items-center justify-between shadow-md">
          {/* 品牌：黄框 logo + 标题，shrink-0 防压缩，始终可见（不跟随淡出，衔接 AuthPage 形变） */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-5 h-5 rounded bg-amber-300 flex items-center justify-center shadow-sm">
              <img src={FAVICON} alt="玖拾刷题" className="w-3.5 h-3.5 object-contain" />
            </div>
            <span className="text-sm font-bold text-white whitespace-nowrap">玖拾刷题</span>
          </div>
          {/* 右侧操作：用户名 + 退出，shrink-0 防换行，跟随淡入淡出 */}
          <div className={`flex items-center gap-1.5 shrink-0 ${asideContentClass}`}>
            <span className="text-xs text-ink-100/70 truncate max-w-[120px]">{user.display_name}</span>
            <button onClick={handleLogout} aria-label="退出" title="退出登录">
              <LogOut className="w-4 h-4 text-ink-100/70" />
            </button>
          </div>
        </div>
        {/* 次级导航：紧贴顶栏，文字跟随登出/进入淡出，背景由父块提供保持墨绿；选中琥珀色（同步桌面端菜单配色） */}
        <div className={`px-4 py-2 flex gap-2 overflow-x-auto transition-opacity ${fadeClass}`}>
          {navItems.map((item) => {
            const active = isActiveItem(loc.pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-shrink-0 px-3 py-1.5 rounded text-xs transition-colors ${
                  active
                    ? 'text-amber-200 font-medium'
                    : 'text-ink-100/70 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 主内容：进入时淡入，登出时淡出；独立滚动不影响侧边栏 */}
      <main className={`flex-1 min-w-0 overflow-y-auto pt-[88px] desktop:pt-0 ${mainClass}`}>
        {/* 右侧内容：key 变化触发重新挂载，播放 route-fade-in 淡入动画 */}
        <div
          key={loc.pathname}
          className="px-4 desktop:px-10 py-6 desktop:py-8 max-w-7xl mx-auto route-fade-in"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
