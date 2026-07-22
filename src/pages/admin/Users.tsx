import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { STATUS } from '@/lib/auth';
import {
  listAllUsers,
  approveTeacher,
  rejectTeacher,
  banUser,
  unbanUser,
  deleteUser,
  getUserStats,
} from '@/lib/users';
import { supabase } from '@/lib/supabase';
import type { User, UserStats } from '@/lib/types';
import {
  Users as UsersIcon,
  GraduationCap,
  Clock,
  Ban,
  Check,
  X,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Loader2,
} from 'lucide-react';

type Filter = 'all' | 'pending' | 'teacher' | 'student' | 'banned';

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({ students: 0, teachers: 0, pending: 0, banned: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [u, s] = await Promise.all([listAllUsers(), getUserStats()]);
    setUsers(u);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // 订阅 users 表 INSERT 事件：新教师注册时自动刷新并提醒
  useEffect(() => {
    const channel = supabase
      .channel('users-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'users' },
        (payload) => {
          const newUser = payload.new as User;
          if (newUser.role === 'teacher' && newUser.status === STATUS.PENDING) {
            toast.info(`新教师注册：${newUser.display_name} (@${newUser.username})，请审批`);
          }
          // 任何新用户都刷新列表
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    const r = await fn();
    if (r.success) {
      toast.success(okMsg);
      load();
    } else {
      toast.error(r.error || '操作失败');
    }
  };

  // 状态语义：0=正常, 1=封禁, 2=待审批
  const filtered = users.filter((u) => {
    if (filter === 'pending' && !(u.role === 'teacher' && u.status === STATUS.PENDING)) return false;
    if (filter === 'teacher' && u.role !== 'teacher') return false;
    if (filter === 'student' && u.role !== 'student') return false;
    if (filter === 'banned' && u.status !== STATUS.BANNED) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.username.toLowerCase().includes(s) && !u.display_name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const confirmDel = async () => {
    if (!delTarget || !me) return;
    await act(() => deleteUser(delTarget.id, me.id), '账号已删除');
    setDelTarget(null);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">账号管理</h1>
        <p className="text-sm text-gray-500 mt-1">审批教师注册、管理所有账号</p>
      </div>

      {/* 统计卡片：白底黑字 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="学生账号" value={stats.students} icon={<GraduationCap className="w-6 h-6" />} />
        <StatCard label="教师账号" value={stats.teachers} icon={<UsersIcon className="w-6 h-6" />} />
        <StatCard
          label="待审批"
          value={stats.pending}
          icon={<Clock className="w-6 h-6" />}
        />
        <StatCard label="已封禁" value={stats.banned} icon={<Ban className="w-6 h-6" />} />
      </div>

      {/* 筛选与搜索 */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'pending', 'teacher', 'student', 'banned'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs transition ${
              filter === f ? 'bg-ink-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {labelOf(f)}
          </button>
        ))}
        <div className="ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户名或姓名"
            className="input-field w-56"
          />
        </div>
      </div>

      {/* 表格 */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">ID</th>
                  <th className="text-left px-4 py-3 font-medium">昵称</th>
                  <th className="text-left px-4 py-3 font-medium">角色</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-left px-4 py-3 font-medium">注册时间</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 table-row-hover">
                    <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3">{u.display_name}</td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="tag-warning">管理员</span>
                      ) : u.role === 'teacher' ? (
                        <span className="tag-info">教师</span>
                      ) : (
                        <span className="tag-neutral">学生</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusTag(u)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {u.role === 'teacher' && u.status === STATUS.PENDING && (
                          <>
                            <button
                              onClick={() => act(() => approveTeacher(u.id), '已通过审批')}
                              className="btn-ghost text-xs text-green-700 hover:bg-green-50"
                              title="通过"
                            >
                              <Check className="w-3.5 h-3.5" />
                              通过
                            </button>
                            <button
                              onClick={() => act(() => rejectTeacher(u.id, me.id), '已拒绝并删除')}
                              className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                              title="拒绝并删除"
                            >
                              <X className="w-3.5 h-3.5" />
                              拒绝
                            </button>
                          </>
                        )}
                        {u.role !== 'admin' && u.status === STATUS.NORMAL && (
                          <button
                            onClick={() => act(() => banUser(u.id), '已封禁')}
                            className="btn-ghost text-xs text-amber-700 hover:bg-amber-50"
                            title="封禁"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            封禁
                          </button>
                        )}
                        {u.role !== 'admin' && u.status === STATUS.BANNED && (
                          <button
                            onClick={() => act(() => unbanUser(u.id), '已解封')}
                            className="btn-ghost text-xs text-green-700 hover:bg-green-50"
                            title="解封"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            解封
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => setDelTarget(u)}
                            className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!delTarget}
        title="确认删除账号"
        onClose={() => setDelTarget(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDelTarget(null)}>
              取消
            </button>
            <button className="btn-danger" onClick={confirmDel}>
              确认删除
            </button>
          </>
        }
      >
        确定要删除账号「<b>{delTarget?.display_name}</b>（@{delTarget?.username}）」吗？
        {delTarget?.role === 'teacher' && ' 该教师名下的题库 owner_id 将置空，题库仍保留。'}
        此操作无法撤销。
      </Modal>
    </>
  );
}

function labelOf(f: Filter): string {
  return { all: '全部', pending: '待审批', teacher: '教师', student: '学生', banned: '已封禁' }[f];
}

function statusTag(u: User) {
  if (u.role === 'admin') return <span className="tag-warning">正常</span>;
  if (u.status === STATUS.NORMAL) return <span className="tag-success">正常</span>;
  if (u.status === STATUS.BANNED) return <span className="tag-danger">已封禁</span>;
  return <span className="tag-neutral">待审批</span>;
}
