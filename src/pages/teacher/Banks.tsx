import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { listMyBanks, deleteBank } from '@/lib/banks';
import type { QuestionBank } from '@/lib/types';
import {
  BookOpen,
  FileText,
  Plus,
  Search,
  Copy,
  Pencil,
  Trash2,
  Share2,
  ClipboardList,
  Loader2,
} from 'lucide-react';

export default function TeacherBanks() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [delTarget, setDelTarget] = useState<QuestionBank | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const data = await listMyBanks(user.id);
    setBanks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const filtered = banks.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(s) ||
      (b.share_code || '').toLowerCase().includes(s) ||
      (b.description || '').toLowerCase().includes(s)
    );
  });

  const totalQuestions = banks.reduce((s, b) => s + (b.question_count || 0), 0);
  const totalShares = banks.filter((b) => b.share_code).length;
  const examCount = banks.filter((b) => b.type === 'exam').length;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast.success(`分享码已复制：${code}`),
      () => toast.error('复制失败，请手动选择'),
    );
  };

  const confirmDel = async () => {
    if (!delTarget) return;
    const r = await deleteBank(delTarget.id);
    if (r.success) {
      toast.success('题库已删除');
      setDelTarget(null);
      load();
    } else {
      toast.error(r.error || '删除失败');
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-700">我的题库</h1>
          <p className="text-sm text-gray-500 mt-1">管理您创建的题库与试卷，生成分享码下发给学生</p>
        </div>
        <Link to="/teacher/banks/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          新建题库
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="题库总数" value={banks.length} icon={<BookOpen className="w-6 h-6" />} />
        <StatCard label="题目总数" value={totalQuestions} icon={<FileText className="w-6 h-6" />} />
        <StatCard label="已分享" value={totalShares} icon={<Share2 className="w-6 h-6" />} />
        <StatCard label="试卷数" value={examCount} icon={<ClipboardList className="w-6 h-6" />} />
      </div>

      <div className="card p-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索题库名 / 分享码 / 描述"
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            {banks.length === 0 ? '暂无题库，点击右上角「新建题库」开始' : '未匹配到任何题库'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">题库名</th>
                  <th className="text-left px-4 py-3 font-medium">类型</th>
                  <th className="text-left px-4 py-3 font-medium">题数</th>
                  <th className="text-left px-4 py-3 font-medium">分享码</th>
                  <th className="text-left px-4 py-3 font-medium">创建时间</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100 table-row-hover">
                    <td className="px-4 py-3">
                      <div
                        className="font-medium text-ink-700 cursor-pointer hover:text-ink-600"
                        onClick={() => nav(`/teacher/banks/${b.id}`)}
                      >
                        {b.name}
                      </div>
                      {b.description && (
                        <div className="text-xs text-gray-400 truncate max-w-xs">{b.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {b.type === 'exam' ? (
                        <span className="tag-warning">试卷</span>
                      ) : (
                        <span className="tag-info">练习题</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="tag-neutral">{b.question_count}</span>
                    </td>
                    <td className="px-4 py-3 font-num text-xs">
                      {b.share_code ? (
                        <button
                          onClick={() => copyCode(b.share_code!)}
                          className="inline-flex items-center gap-1 text-ink-700 hover:text-ink-600"
                          title="点击复制"
                        >
                          {b.share_code}
                          <Copy className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => nav(`/teacher/banks/${b.id}`)}
                          className="btn-ghost text-xs"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        {b.type === 'practice' && (
                          <button
                            onClick={() => nav(`/teacher/exam-new/${b.id}`)}
                            className="btn-ghost text-xs text-amber-700 hover:bg-amber-50"
                            title="从该题库创建试卷"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            创建试卷
                          </button>
                        )}
                        <button
                          onClick={() => setDelTarget(b)}
                          className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
        title="确认删除题库"
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
        确定要删除题库「<b>{delTarget?.name}</b>」吗？该操作会同时删除题库下所有题目，且无法撤销。
      </Modal>
    </>
  );
}
