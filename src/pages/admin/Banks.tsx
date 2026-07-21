import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { listAllBanks, adminDeleteBank } from '@/lib/banks';
import type { QuestionBank } from '@/lib/types';
import { BookOpen, FileText, Users, Search, Trash2, Pencil, Loader2 } from 'lucide-react';

export default function AdminBanks() {
  const toast = useToast();
  const nav = useNavigate();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [delTarget, setDelTarget] = useState<QuestionBank | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await listAllBanks();
    setBanks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = banks.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(s) ||
      (b.share_code || '').toLowerCase().includes(s) ||
      (b.owner_name || '').toLowerCase().includes(s)
    );
  });

  const totalQuestions = banks.reduce((s, b) => s + (b.question_count || 0), 0);
  const owners = new Set(banks.map((b) => b.owner_id).filter(Boolean)).size;

  const confirmDel = async () => {
    if (!delTarget) return;
    const r = await adminDeleteBank(delTarget.id);
    if (r.success) {
      toast.success('题库已删除');
      setDelTarget(null);
      load();
    } else {
      toast.error(r.error || '失败');
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">题库管理</h1>
        <p className="text-sm text-gray-500 mt-1">查看与管理系统内全部题库</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="题库总数" value={banks.length} icon={<BookOpen className="w-6 h-6" />} />
        <StatCard label="题目总数" value={totalQuestions} icon={<FileText className="w-6 h-6" />} />
        <StatCard label="教师数" value={owners} icon={<Users className="w-6 h-6" />} />
      </div>

      <div className="card p-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索题库名 / 分享码 / 教师"
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
          <div className="text-center text-gray-400 py-12 text-sm">暂无题库</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">题库名</th>
                  <th className="text-left px-4 py-3 font-medium">教师</th>
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
                      <div className="font-medium text-ink-700">{b.name}</div>
                      {b.description && (
                        <div className="text-xs text-gray-400 truncate max-w-xs">{b.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{b.owner_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="tag-info">{b.question_count}</span>
                    </td>
                    <td className="px-4 py-3 font-num text-xs">{b.share_code || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => nav(`/admin/banks/${b.id}`)}
                          className="btn-ghost text-xs"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
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
    </Layout>
  );
}
