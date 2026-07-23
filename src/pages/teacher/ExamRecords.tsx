import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/StatCard';
import { listMyBanks } from '@/lib/banks';
import { listExamStudentsByBank } from '@/lib/exam';
import type { QuestionBank } from '@/lib/types';
import { ClipboardList, Loader2, Users, FileText, ChevronRight } from 'lucide-react';

interface ExamRow {
  bank: QuestionBank;
  students: { student_id: string; display_name: string; wrong_count: number; created_at: string }[];
  loading: boolean;
}

export default function TeacherExamRecords() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const all = await listMyBanks(user.id);
      const examBanks = all.filter((b) => b.type === 'exam');
      // 初始化空记录
      setRows(examBanks.map((bank) => ({ bank, students: [], loading: true })));
      // 并行查询每个试卷的学生记录
      examBanks.forEach(async (bank, idx) => {
        const students = await listExamStudentsByBank(bank.id);
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, students, loading: false } : r)),
        );
      });
      setLoading(false);
    };
    load();
  }, [user]);

  const totalStudents = new Set(rows.flatMap((r) => r.students.map((s) => s.student_id))).size;
  const totalRecords = rows.reduce((s, r) => s + r.students.length, 0);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">考试记录</h1>
        <p className="text-sm text-gray-500 mt-1">查看试卷被哪些学生获取并完成考试的情况</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="试卷总数"
          value={rows.length}
          icon={<ClipboardList className="w-6 h-6" />}
        />
        <StatCard
          label="参与学生"
          value={totalStudents}
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          label="考试记录"
          value={totalRecords}
          icon={<FileText className="w-6 h-6" />}
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12 text-sm">
          <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
          加载中...
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-7 h-7 text-ink-300" />
          </div>
          <h3 className="font-display text-lg font-bold text-ink-700 mb-1">暂无试卷</h3>
          <p className="text-sm text-gray-500">从练习题库创建试卷后，学生考试记录会显示在这里</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">试卷名</th>
                  <th className="text-left px-4 py-3 font-medium">题数</th>
                  <th className="text-left px-4 py-3 font-medium">参与人数</th>
                  <th className="text-left px-4 py-3 font-medium">平均错题</th>
                  <th className="text-left px-4 py-3 font-medium">分享码</th>
                  <th className="text-left px-4 py-3 font-medium">创建时间</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ bank, students, loading: rowLoading }) => {
                  const avgWrong =
                    students.length > 0
                      ? Math.round(
                          students.reduce((s, x) => s + x.wrong_count, 0) / students.length,
                        )
                      : 0;
                  return (
                    <tr
                      key={bank.id}
                      className="border-t border-gray-100 table-row-hover cursor-pointer"
                      onClick={() => nav(`/teacher/exam-records/${bank.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-700">{bank.name}</div>
                        {bank.description && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">
                            {bank.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="tag-neutral">{bank.question_count}</span>
                      </td>
                      <td className="px-4 py-3 font-num">
                        {rowLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        ) : (
                          <span className="font-bold text-ink-700">{students.length}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-num text-xs">
                        {students.length > 0 ? `${avgWrong} 题` : '—'}
                      </td>
                      <td className="px-4 py-3 font-num text-xs">{bank.share_code || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(bank.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nav(`/teacher/exam-records/${bank.id}`);
                          }}
                          className="btn-ghost text-xs"
                        >
                          查看详情
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
