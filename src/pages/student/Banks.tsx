import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import {
  claimBank,
  listStudentBanks,
  removeClaimedBank,
  getStudentStats,
} from '@/lib/student';
import type { QuestionBank } from '@/lib/types';
import {
  BookOpen,
  FileText,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Ticket,
  Loader2,
  GraduationCap,
  ClipboardCheck,
  History,
  TrendingUp,
} from 'lucide-react';

export default function StudentBanks() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<QuestionBank | null>(null);
  const [stats, setStats] = useState<{ totalCount: number; avgAccuracy: number }>({
    totalCount: 0,
    avgAccuracy: 0,
  });

  // 点击菜单外部关闭菜单（替代 fixed 覆盖层，避免闪烁）
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-wrap]')) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [data, st] = await Promise.all([
      listStudentBanks(user.id),
      getStudentStats(user.id),
    ]);
    setBanks(data);
    setStats(st);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const totalQuestions = banks.reduce((s, b) => s + (b.question_count || 0), 0);

  const onClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!code.trim()) {
      toast.warning('请输入分享码');
      return;
    }
    setClaiming(true);
    const r = await claimBank(user.id, code.trim());
    setClaiming(false);
    if (!r.success) {
      toast.error(r.error || '领取失败');
      return;
    }
    if (r.alreadyClaimed) {
      toast.info(`已在您的列表中：${r.bank?.name}`);
    } else {
      toast.success(`已添加题库：${r.bank?.name}`);
    }
    setCode('');
    load();
  };

  const confirmDel = async () => {
    if (!delTarget || !user) return;
    const r = await removeClaimedBank(user.id, delTarget.id);
    if (r.success) {
      toast.success('已移除题库');
      setDelTarget(null);
      load();
    } else {
      toast.error(r.error || '移除失败');
    }
  };

  const startPractice = (bankId: string, mode: 'practice' | 'exam') => {
    setMenuOpen(null);
    nav(`/student/practice/${bankId}?mode=${mode}`);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">我的题库</h1>
        <p className="text-sm text-gray-500 mt-1">输入教师提供的分享码领取题库，开始练习</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="已领取题库" value={banks.length} icon={<BookOpen className="w-6 h-6" />} />
        <StatCard label="题目总数" value={totalQuestions} icon={<FileText className="w-6 h-6" />} />
        <StatCard
          label="累计练习"
          value={stats.totalCount}
          icon={<History className="w-6 h-6" />}
        />
        <StatCard
          label="平均正确率"
          value={`${stats.avgAccuracy}%`}
          icon={<TrendingUp className="w-6 h-6" />}
        />
      </div>

      {/* 领取题库卡片 */}
      <form onSubmit={onClaim} className="card p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="w-4 h-4 text-amber-500" />
          <h3 className="font-display font-bold text-ink-700">领取题库</h3>
        </div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="input-field flex-1 font-num tracking-wider"
            placeholder="输入 8 位分享码，如 ABCD1234"
            maxLength={8}
            autoFocus
          />
          <button type="submit" disabled={claiming} className="btn-primary">
            {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {claiming ? '领取中...' : '领取'}
          </button>
        </div>
      </form>

      {/* 题库列表 */}
      {loading ? (
        <div className="text-center text-gray-400 py-16 text-sm">加载中...</div>
      ) : banks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-7 h-7 text-ink-300" />
          </div>
          <h3 className="font-display text-lg font-bold text-ink-700 mb-1">还没有题库</h3>
          <p className="text-sm text-gray-500">在上方输入分享码领取您的第一份题库</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((b) => {
            const isExam = b.type === 'exam';
            return (
              <div key={b.id} className="card-hover p-5 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-ink-700 truncate">{b.name}</h3>
                      {isExam && <span className="tag-warning">试卷</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(b.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div className="relative" data-menu-wrap>
                    <button
                      onClick={() => setMenuOpen(menuOpen === b.id ? null : b.id)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                      aria-label="更多操作"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === b.id && (
                      <div className="absolute right-0 top-8 z-30 w-36 bg-white rounded-lg shadow-lift border border-gray-100 py-1 text-sm">
                        {!isExam && (
                          <button
                            onClick={() => startPractice(b.id, 'practice')}
                            className="w-full text-left px-3 py-1.5 hover:bg-ink-50 flex items-center gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            练习模式
                          </button>
                        )}
                        <button
                          onClick={() => startPractice(b.id, 'exam')}
                          className="w-full text-left px-3 py-1.5 hover:bg-ink-50 flex items-center gap-2"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          {isExam ? '开始考试' : '模拟考试'}
                        </button>
                        <button
                          onClick={() => {
                            setDelTarget(b);
                            setMenuOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          移除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px] mb-3">
                  {b.description || '（暂无描述）'}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="tag-info">{b.question_count} 题</span>
                  <button
                    onClick={() => startPractice(b.id, isExam ? 'exam' : 'practice')}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {isExam ? '开始考试' : '开始练习'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!delTarget}
        title="确认移除题库"
        onClose={() => setDelTarget(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDelTarget(null)}>
              取消
            </button>
            <button className="btn-danger" onClick={confirmDel}>
              确认移除
            </button>
          </>
        }
      >
        确定要从您的列表中移除题库「<b>{delTarget?.name}</b>」吗？
        <br />
        移除后可重新通过分享码领取，题库本身不受影响。
      </Modal>
    </>
  );
}
