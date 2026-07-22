import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/StatCard';
import { listPracticeRecords, getStudentStats } from '@/lib/student';
import type { PracticeRecord } from '@/lib/types';
import { History, Target, TrendingUp, Loader2, Calendar, Award } from 'lucide-react';

export default function StudentPracticeRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [stats, setStats] = useState<{ totalCount: number; avgAccuracy: number }>({
    totalCount: 0,
    avgAccuracy: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [recs, st] = await Promise.all([
      listPracticeRecords(user.id, 100),
      getStudentStats(user.id),
    ]);
    setRecords(recs);
    setStats(st);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  // 按题库分组统计
  const bankGroupMap = new Map<string, { name: string; count: number; bestAccuracy: number }>();
  records.forEach((r) => {
    const key = r.bank_id;
    const existing = bankGroupMap.get(key);
    const acc = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
    if (existing) {
      existing.count += 1;
      existing.bestAccuracy = Math.max(existing.bestAccuracy, acc);
    } else {
      bankGroupMap.set(key, {
        name: r.bank_name || '（已删除）',
        count: 1,
        bestAccuracy: acc,
      });
    }
  });
  const bankGroups = Array.from(bankGroupMap.entries()).map(([id, v]) => ({ id, ...v }));

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">练习记录</h1>
        <p className="text-sm text-gray-500 mt-1">查看您的全部练习与考试历史</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
        <StatCard
          label="练习题库"
          value={bankGroups.length}
          icon={<Target className="w-6 h-6" />}
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16 text-sm">
          <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
          加载中...
        </div>
      ) : records.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
            <Target className="w-7 h-7 text-ink-300" />
          </div>
          <h3 className="font-display text-lg font-bold text-ink-700 mb-1">暂无练习记录</h3>
          <p className="text-sm text-gray-500">前往"我的题库"开始第一次练习吧</p>
        </div>
      ) : (
        <>
          {/* 按题库分组 */}
          {bankGroups.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-lg font-bold text-ink-700 mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                题库表现
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bankGroups.map((g) => (
                  <div key={g.id} className="card p-4">
                    <div className="font-medium text-ink-700 truncate mb-2">{g.name}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">练习 {g.count} 次</span>
                      <span
                        className={`font-num font-bold ${
                          g.bestAccuracy >= 80
                            ? 'text-green-600'
                            : g.bestAccuracy >= 60
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        最佳 {g.bestAccuracy}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 全部记录表格 */}
          <div>
            <h2 className="font-display text-lg font-bold text-ink-700 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-ink-600" />
              历史明细
            </h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50/50 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-3 font-medium">题库</th>
                      <th className="text-left px-4 py-3 font-medium">模式</th>
                      <th className="text-left px-4 py-3 font-medium">得分</th>
                      <th className="text-left px-4 py-3 font-medium">正确率</th>
                      <th className="text-left px-4 py-3 font-medium">完成时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const accuracy = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                      return (
                        <tr key={r.id} className="border-t border-gray-100 table-row-hover">
                          <td className="px-4 py-3 truncate max-w-[200px]">{r.bank_name}</td>
                          <td className="px-4 py-3">
                            {r.mode === 'practice' ? (
                              <span className="tag-info">练习</span>
                            ) : (
                              <span className="tag-warning">考试</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-num">
                            <span className="font-bold text-ink-700">{r.correct}</span>
                            <span className="text-gray-400"> / {r.total}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-num font-bold ${
                                accuracy >= 80
                                  ? 'text-green-600'
                                  : accuracy >= 60
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {accuracy}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {new Date(r.ended_at).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
