import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { getBank } from '@/lib/banks';
import { listQuestions } from '@/lib/questions';
import { recordPractice } from '@/lib/student';
import { upsertWrongQuestions } from '@/lib/wrongQuestions';
import { recordExamAnswers } from '@/lib/exam';
import type { QuestionBank, Question } from '@/lib/types';
import { renderRichText, latexToPlainText } from '@/lib/renderRichText';
import MathTextInput from '@/components/MathTextInput';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Award,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

/** 答案归一化：去除空白/逗号，大写，排序 */
function normalize(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[\s,，、/]/g, '')
    .split('')
    .sort()
    .join('');
}

/** 判断题答案归一化：只支持 对/错、正确/错误、Y/N */
function normalizeJudge(s: string): string {
  const up = s.trim().toUpperCase();
  if (['对', '正确', 'Y'].includes(up)) return '对';
  if (['错', '错误', 'N'].includes(up)) return '错';
  return up;
}

/** 判分：填空题完全一致、判断题归一化比较、其他题归一化比较 */
function judgeAnswer(q: Question, userAnswer: string): boolean {
  if (!userAnswer) return false;
  if (q.type === 'short') {
    // 填空题判分：正确答案归一化（LaTeX 公式转纯文本，$50^\circ$ → 50°），与学生纯文本作答比较
    // 多空按 | 分隔，顺序、数量、每位内容需完全匹配
    const correctParts = q.answer
      .split(/[|｜]/)
      .map((s) => latexToPlainText(s).trim())
      .filter((s) => s.length > 0);
    const userParts = userAnswer.split(/[|｜,，\s]+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (correctParts.length === 0) return false;
    if (correctParts.length !== userParts.length) return false;
    return correctParts.every((c, i) => c === userParts[i]);
  }
  if (q.type === 'judge') {
    return normalizeJudge(userAnswer) === normalizeJudge(q.answer);
  }
  return normalize(userAnswer) === normalize(q.answer);
}

/** 选项值提取：从 "A. 选项内容" 中提取 "A" */
function optionValue(opt: string): string {
  const m = opt.match(/^\s*([A-Za-z])/);
  return m ? m[1].toUpperCase() : '';
}

export default function StudentPractice() {
  const { bankId } = useParams<{ bankId: string }>();
  const [searchParams] = useSearchParams();
  const urlMode: 'practice' | 'exam' = searchParams.get('mode') === 'exam' ? 'exam' : 'practice';
  const toast = useToast();
  const { user } = useAuth();

  const [bank, setBank] = useState<QuestionBank | null>(null);
  // 试卷型题库强制考试模式（设计约束：试卷类型学生获取后仅可考试不能练习）
  const mode: 'practice' | 'exam' = bank?.type === 'exam' ? 'exam' : urlMode;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 共用作答状态：Record<questionId, userAnswer>
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // 练习模式：每题是否已提交
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});
  // 练习模式：当前题目索引
  const [currentIdx, setCurrentIdx] = useState(0);
  // 考试模式：是否已交卷
  const [examSubmitted, setExamSubmitted] = useState(false);

  // 练习记录相关
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    if (!bankId) return;
    setLoading(true);
    Promise.all([getBank(bankId), listQuestions(bankId)])
      .then(([b, qs]) => {
        if (!b) {
          setError('题库不存在或已删除');
        } else {
          setBank(b);
          setQuestions(qs);
          if (qs.length === 0) setError('该题库暂无题目');
        }
      })
      .finally(() => setLoading(false));
  }, [bankId]);

  const total = questions.length;
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] || '').trim().length > 0).length,
    [questions, answers],
  );
  const correctCount = useMemo(
    () =>
      questions.filter((q) => submittedMap[q.id] && judgeAnswer(q, answers[q.id] || '')).length,
    [questions, answers, submittedMap],
  );
  const examCorrectCount = useMemo(
    () => questions.filter((q) => judgeAnswer(q, answers[q.id] || '')).length,
    [questions, answers],
  );

  // 练习模式：全部题目提交后自动记录一次
  useEffect(() => {
    if (mode !== 'practice' || recorded || !user || !bankId || total === 0) return;
    if (Object.keys(submittedMap).length >= total) {
      setRecorded(true);
      recordPractice({
        student_id: user.id,
        bank_id: bankId,
        mode: 'practice',
        total,
        correct: correctCount,
        started_at: startedAt,
      }).then((r) => {
        if (!r.success) toast.error('练习记录保存失败：' + (r.error || ''));
      });
    }
  }, [submittedMap, mode, recorded, user, bankId, total, correctCount, startedAt, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-ink-700 mb-2">{error}</h2>
          <Link to="/student" className="btn-primary mt-4 inline-flex">
            返回题库列表
          </Link>
        </div>
      </div>
    );
  }

  /** 设置某题作答 */
  const setAnswer = (qid: string, v: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: v }));
  };

  /** 多选切换 */
  const toggleMulti = (qid: string, val: string) => {
    setAnswers((prev) => {
      const cur = prev[qid] || '';
      const letters = cur.split('').filter(Boolean);
      const i = letters.indexOf(val);
      if (i >= 0) letters.splice(i, 1);
      else letters.push(val);
      letters.sort();
      return { ...prev, [qid]: letters.join('') };
    });
  };

  /** 练习模式：提交当前题（不收集错题，仅模拟考试和试卷考试收集） */
  const submitCurrent = () => {
    const q = questions[currentIdx];
    if (!q) return;
    if (!(answers[q.id] || '').trim()) {
      toast.warning('请先作答再提交');
      return;
    }
    setSubmittedMap((prev) => ({ ...prev, [q.id]: true }));
    const ok = judgeAnswer(q, answers[q.id] || '');
    if (ok) {
      toast.success('回答正确');
    } else {
      toast.error('回答错误，查看解析');
    }
  };

  /** 考试模式：交卷 */
  const submitExam = () => {
    const unanswered = total - answeredCount;
    if (unanswered > 0) {
      if (!window.confirm(`还有 ${unanswered} 题未作答，确认交卷吗？`)) return;
    }
    setExamSubmitted(true);
    toast.success(`交卷完成，得分 ${examCorrectCount}/${total}`);
    // 记录一次考试
    if (!recorded && user && bankId) {
      setRecorded(true);
      recordPractice({
        student_id: user.id,
        bank_id: bankId,
        mode: 'exam',
        total,
        correct: examCorrectCount,
        started_at: startedAt,
      }).then((r) => {
        if (!r.success) toast.error('练习记录保存失败：' + (r.error || ''));
      });
    }

    // 收集所有错题（含填空题，填空题通过 latexToPlainText 归一化判分）
    if (user && bankId) {
      const wrongItems = questions
        .filter((q) => !judgeAnswer(q, answers[q.id] || ''))
        .map((q) => ({
          bank_id: bankId,
          question_id: q.id,
          student_answer: answers[q.id] || '',
          correct_answer: q.answer,
          mode: 'exam' as const,
        }));

      if (wrongItems.length > 0) {
        // 1. 加入错题本（模拟考试 + 试卷考试都加）
        upsertWrongQuestions(user.id, wrongItems).catch(() => toast.error('错题保存失败，可稍后在错题本重试'));

        // 2. 试卷型题库：上传到 exam_answers 供教师查看
        if (bank?.type === 'exam') {
          recordExamAnswers({
            student_id: user.id,
            bank_id: bankId,
            wrong_answers: wrongItems.map((w) => ({
              question_id: w.question_id,
              student_answer: w.student_answer,
              correct_answer: w.correct_answer,
            })),
          }).catch(() => toast.error('考试答题上传失败'));
        }
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** 再练一次 */
  const retry = () => {
    setAnswers({});
    setSubmittedMap({});
    setExamSubmitted(false);
    setCurrentIdx(0);
    setRecorded(false);
    setStartedAt(new Date().toISOString());
    toast.info('已重置，开始新一轮');
  };

  // ============ 练习模式渲染 ============
  if (mode === 'practice') {
    const q = questions[currentIdx];
    if (!q) return null;
    const isSubmitted = !!submittedMap[q.id];
    const userAns = answers[q.id] || '';
    const isCorrect = isSubmitted && judgeAnswer(q, userAns);
    const progress = ((currentIdx + 1) / total) * 100;

    return (
      <div className="min-h-screen bg-cream">
        {/* 顶部进度栏 */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <Link
                to="/student"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-ink-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回列表
              </Link>
              <div className="text-xs text-gray-500">
                <span className="font-num text-ink-700 font-bold">{currentIdx + 1}</span> / {total}
                <span className="mx-3 text-gray-300">|</span>
                已答对 <span className="font-num text-green-600 font-bold">{correctCount}</span> 题
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="mb-3">
            <h1 className="font-display text-xl font-bold text-ink-700">{bank?.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">练习模式 · 即时反馈</p>
          </div>

          {/* 题目卡片 */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="tag-info">第 {currentIdx + 1} 题</span>
              <span className="tag-neutral">{typeLabel(q.type)}</span>
            </div>

            <div
              className="question-content text-base text-gray-900 leading-relaxed mb-5"
              dangerouslySetInnerHTML={{ __html: renderRichText(q.content) }}
            />

            {/* 选项渲染 */}
            <QuestionInput
              question={q}
              value={userAns}
              disabled={isSubmitted}
              onChange={(v) => setAnswer(q.id, v)}
              onToggleMulti={(v) => toggleMulti(q.id, v)}
            />

            {/* 提交后反馈 */}
            {isSubmitted && (
              <div
                className={`mt-5 p-4 rounded-lg border ${
                  isCorrect
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span
                    className={`font-bold text-sm ${
                      isCorrect ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {isCorrect ? '回答正确' : '回答错误'}
                  </span>
                </div>
                {!isCorrect && (
                  <div className="text-sm text-gray-700 mb-1">
                    正确答案：<span className="font-num font-bold text-ink-700" dangerouslySetInnerHTML={{ __html: renderRichText(q.answer) }} />
                  </div>
                )}
                {q.analysis && (
                  <div className="text-sm text-gray-600 mt-2">
                    <div className="text-xs text-gray-500 mb-1">解析</div>
                    <div className="question-content" dangerouslySetInnerHTML={{ __html: renderRichText(q.analysis) }} />
                  </div>
                )}
              </div>
            )}

            {/* 提交按钮 */}
            {!isSubmitted && (
              <button
                onClick={submitCurrent}
                disabled={!userAns.trim()}
                className="btn-primary w-full mt-5"
              >
                提交答案
              </button>
            )}
          </div>

          {/* 翻页按钮 */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
              className="btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
              上一题
            </button>
            {currentIdx < total - 1 ? (
              <button onClick={() => setCurrentIdx(currentIdx + 1)} className="btn-primary">
                下一题
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <Link to="/student" className="btn-primary">
                <CheckCircle2 className="w-4 h-4" />
                完成练习
              </Link>
            )}
          </div>

          {/* 成绩汇总 */}
          {Object.keys(submittedMap).length >= total && (
            <div className="card p-6 mt-6 text-center bg-gradient-to-br from-amber-50 to-cream">
              <Award className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h3 className="font-display text-lg font-bold text-ink-700">练习完成</h3>
              <p className="text-sm text-gray-600 mt-1">
                共 {total} 题，答对 <span className="font-num text-green-600 font-bold">{correctCount}</span> 题，
                正确率 <span className="font-num font-bold">{Math.round((correctCount / total) * 100)}%</span>
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <button onClick={retry} className="btn-secondary">
                  <RefreshCw className="w-4 h-4" />
                  再练一次
                </button>
                <Link to="/student" className="btn-primary">
                  返回列表
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ 考试模式渲染 ============
  return (
    <div className="min-h-screen bg-cream">
      {/* 顶部进度栏 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/student"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-ink-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回列表
          </Link>
          <div className="text-xs text-gray-500">
            {bank?.name} · 共 {total} 题
          </div>
          {examSubmitted ? (
            <button onClick={retry} className="btn-secondary text-xs px-3 py-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              再练一次
            </button>
          ) : (
            <button onClick={submitExam} className="btn-primary text-xs px-3 py-1.5">
              交卷
            </button>
          )}
        </div>
        {!examSubmitted && (
          <div className="max-w-3xl mx-auto px-4 pb-2 text-xs text-gray-500">
            已作答 <span className="font-num text-ink-700 font-bold">{answeredCount}</span> / {total}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {examSubmitted && (
          <div className="card p-6 mb-5 text-center bg-gradient-to-br from-amber-50 to-cream">
            <Award className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h3 className="font-display text-lg font-bold text-ink-700">考试完成</h3>
            <p className="text-sm text-gray-600 mt-1">
              得分 <span className="font-num text-2xl font-bold text-green-600">{examCorrectCount}</span>
              <span className="text-gray-400"> / {total}</span>，
              正确率 <span className="font-num font-bold">{Math.round((examCorrectCount / total) * 100)}%</span>
            </p>
          </div>
        )}

        {questions.map((q, idx) => {
          const userAns = answers[q.id] || '';
          const isCorrect = judgeAnswer(q, userAns);
          const isAnswered = userAns.trim().length > 0;
          return (
            <div key={q.id} className="card p-6 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="tag-info">第 {idx + 1} 题</span>
                <span className="tag-neutral">{typeLabel(q.type)}</span>
                {examSubmitted && (
                  <span className={`tag ${isCorrect ? 'tag-success' : isAnswered ? 'tag-danger' : 'tag-neutral'}`}>
                    {isCorrect ? '正确' : isAnswered ? '错误' : '未作答'}
                  </span>
                )}
              </div>

              <div
                className="question-content text-base text-gray-900 leading-relaxed mb-5"
                dangerouslySetInnerHTML={{ __html: renderRichText(q.content) }}
              />

              <QuestionInput
                question={q}
                value={userAns}
                disabled={examSubmitted}
                onChange={(v) => setAnswer(q.id, v)}
                onToggleMulti={(v) => toggleMulti(q.id, v)}
              />

              {examSubmitted && (
                <div
                  className={`mt-4 p-3 rounded-lg border text-sm ${
                    isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="text-gray-700">
                    正确答案：<span className="font-num font-bold text-ink-700" dangerouslySetInnerHTML={{ __html: renderRichText(q.answer) }} />
                  </div>
                  {q.analysis && (
                    <div className="mt-2 text-gray-600">
                      <div className="text-xs text-gray-500 mb-1">解析</div>
                      <div className="question-content" dangerouslySetInnerHTML={{ __html: renderRichText(q.analysis) }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {examSubmitted && (
          <div className="flex gap-2 justify-center mt-6">
            <button onClick={retry} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
              再练一次
            </button>
            <Link to="/student" className="btn-primary">
              返回列表
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** 题型中文标签 */
function typeLabel(t: Question['type']): string {
  return { single: '单选题', multiple: '多选题', judge: '判断题', short: '填空题' }[t];
}

/** 题目输入组件：根据题型渲染不同交互 */
function QuestionInput({
  question,
  value,
  disabled,
  onChange,
  onToggleMulti,
}: {
  question: Question;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onToggleMulti: (v: string) => void;
}) {
  const { type, options } = question;

  if (type === 'single' && options) {
    return (
      <div className="space-y-2">
        {options.map((opt, i) => {
          const val = optionValue(opt) || String(i);
          const checked = value === val;
          return (
            <label
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                checked
                  ? 'border-ink-400 bg-ink-50/60'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(val)}
                className="mt-0.5 accent-ink-600"
              />
              <span className="text-sm text-gray-800 flex-1" dangerouslySetInnerHTML={{ __html: renderRichText(opt) }} />
            </label>
          );
        })}
      </div>
    );
  }

  if (type === 'multiple' && options) {
    const selected = value.split('').filter(Boolean);
    return (
      <div className="space-y-2">
        <div className="text-xs text-gray-400 mb-1">多选题，可选择多个</div>
        {options.map((opt, i) => {
          const val = optionValue(opt) || String(i);
          const checked = selected.includes(val);
          return (
            <label
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                checked
                  ? 'border-ink-400 bg-ink-50/60'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggleMulti(val)}
                className="mt-0.5 accent-ink-600"
              />
              <span className="text-sm text-gray-800 flex-1" dangerouslySetInnerHTML={{ __html: renderRichText(opt) }} />
            </label>
          );
        })}
      </div>
    );
  }

  if (type === 'judge') {
    return (
      <div className="flex gap-3">
        {[
          { v: '对', label: '正确' },
          { v: '错', label: '错误' },
        ].map((opt) => {
          const checked = value === opt.v;
          return (
            <label
              key={opt.v}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                checked
                  ? 'border-ink-400 bg-ink-50/60'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(opt.v)}
                className="accent-ink-600"
              />
              <span className="text-sm text-gray-800">{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // 填空题
  return (
    <MathTextInput
      value={value}
      disabled={disabled}
      onChange={onChange}
      placeholder="请输入您的答案..."
    />
  );
}
