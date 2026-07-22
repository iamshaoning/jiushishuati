import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { getBank } from '@/lib/banks';
import { listQuestions } from '@/lib/questions';
import { listExamStudentsByBank, listExamWrongAnswersByStudent } from '@/lib/exam';
import type { QuestionBank, Question, ExamAnswer } from '@/lib/types';
import { renderRichText } from '@/lib/renderRichText';
import { ArrowLeft, Loader2, Users, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  short: '填空题',
} as const;

export default function TeacherExamRecordDetail() {
  const { bankId } = useParams<{ bankId: string }>();
  const toast = useToast();
  const nav = useNavigate();

  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<
    { student_id: string; display_name: string; wrong_count: number; created_at: string }[]
  >([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [wrongAnswers, setWrongAnswers] = useState<ExamAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!bankId) return;
    setLoading(true);
    Promise.all([getBank(bankId), listQuestions(bankId), listExamStudentsByBank(bankId)]).then(
      ([b, qs, sts]) => {
        setBank(b);
        setQuestions(qs);
        setStudents(sts);
        if (sts.length > 0) setSelectedStudent(sts[0].student_id);
        setLoading(false);
      },
    );
  }, [bankId]);

  // 加载选中学生的错题详情
  useEffect(() => {
    if (!bankId || !selectedStudent) {
      setWrongAnswers([]);
      return;
    }
    setLoadingDetail(true);
    listExamWrongAnswersByStudent(bankId, selectedStudent).then((ans) => {
      setWrongAnswers(ans);
      setLoadingDetail(false);
    });
  }, [bankId, selectedStudent]);

  // 错题映射：questionId -> examAnswer
  const wrongMap = useMemo(() => {
    const m = new Map<string, ExamAnswer>();
    wrongAnswers.forEach((a) => m.set(a.question_id, a));
    return m;
  }, [wrongAnswers]);

  const selectedStudentInfo = students.find((s) => s.student_id === selectedStudent);

  if (loading) {
    return (
      <>
        <div className="text-center text-gray-400 py-16 text-sm">
          <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
          加载中...
        </div>
      </>
    );
  }

  if (!bank) {
    return (
      <>
        <div className="card p-12 text-center">
          <div className="text-gray-500">试卷不存在</div>
          <button onClick={() => nav('/teacher/exam-records')} className="btn-primary mt-4">
            返回考试记录
          </button>
        </div>
      </>
    );
  }

  const correctCount = questions.length - wrongAnswers.length;

  return (
    <>
      <button
        onClick={() => nav('/teacher/exam-records')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink-700 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        返回考试记录
      </button>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">{bank.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          共 {questions.length} 题 · {students.length} 名学生参与
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 左侧学生列表 */}
        <div className="lg:col-span-1">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-ink-600" />
              <span className="font-medium text-sm">学生列表</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {students.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-xs">暂无学生参与</div>
              ) : (
                students.map((s) => {
                  const isSelected = s.student_id === selectedStudent;
                  const accuracy =
                    questions.length > 0
                      ? Math.round(
                          ((questions.length - s.wrong_count) / questions.length) * 100,
                        )
                      : 0;
                  return (
                    <button
                      key={s.student_id}
                      onClick={() => setSelectedStudent(s.student_id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 transition ${
                        isSelected ? 'bg-ink-50/60 border-l-2 border-l-ink-600' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-sm text-ink-700 truncate">
                        {s.display_name}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          {questions.length - s.wrong_count}/{questions.length}
                        </span>
                        <span
                          className={`text-xs font-num font-bold ${
                            accuracy >= 80
                              ? 'text-green-600'
                              : accuracy >= 60
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {accuracy}%
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 右侧答题详情 */}
        <div className="lg:col-span-3">
          {!selectedStudent ? (
            <div className="card p-12 text-center text-sm text-gray-400">
              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              选择左侧学生查看答题详情
            </div>
          ) : (
            <>
              {/* 成绩汇总 */}
              <div className="card p-5 mb-4 bg-gradient-to-br from-amber-50/50 to-cream">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-xs text-gray-500">{selectedStudentInfo?.display_name} 的考试结果</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-num text-3xl font-bold text-green-600">
                        {correctCount}
                      </span>
                      <span className="text-gray-400">/ {questions.length}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        正确率{' '}
                        <b className="font-num">
                          {questions.length > 0
                            ? Math.round((correctCount / questions.length) * 100)
                            : 0}
                          %
                        </b>
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedStudentInfo &&
                      `考试时间：${new Date(selectedStudentInfo.created_at).toLocaleString('zh-CN')}`}
                  </div>
                </div>
              </div>

              {/* 题目列表（标注错题） */}
              {loadingDetail ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
                  加载答题详情...
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const wrong = wrongMap.get(q.id);
                    const isWrong = !!wrong;
                    return (
                      <div
                        key={q.id}
                        className={`card p-4 border-l-4 ${
                          isWrong ? 'border-l-red-500' : 'border-l-green-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-num text-xs text-gray-400">#{idx + 1}</span>
                          <span className="tag-neutral">{TYPE_LABELS[q.type]}</span>
                          {isWrong ? (
                            <span className="tag-danger flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              错误
                            </span>
                          ) : (
                            <span className="tag-success flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              正确
                            </span>
                          )}
                        </div>
                        <div
                          className="question-content text-sm text-gray-800 leading-relaxed mb-2"
                          dangerouslySetInnerHTML={{ __html: renderRichText(q.content) }}
                        />
                        {q.options && (
                          <ul className="text-xs text-gray-600 space-y-0.5 pl-4 mb-2">
                            {q.options.map((o, j) => (
                              <li key={j} dangerouslySetInnerHTML={{ __html: renderRichText(o) }} />
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-4 text-xs pt-1 border-t border-gray-50">
                          <span>
                            <span className="text-gray-400">正确答案：</span>
                            <span className="text-ink-700 font-medium font-num" dangerouslySetInnerHTML={{ __html: renderRichText(q.answer) }} />
                          </span>
                          {isWrong && (
                            <span>
                              <span className="text-gray-400">学生作答：</span>
                              <span className="text-red-600 font-medium font-num">
                                {wrong!.student_answer || '（未作答）'}
                              </span>
                            </span>
                          )}
                        </div>
                        {q.analysis && (
                          <div className="mt-2 text-xs text-gray-500">
                            <div className="text-gray-400 mb-0.5">解析</div>
                            <div className="question-content" dangerouslySetInnerHTML={{ __html: renderRichText(q.analysis) }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
