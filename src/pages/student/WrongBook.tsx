import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import {
  listWrongQuestions,
  getWrongQuestionStats,
  removeWrongQuestion,
  upsertWrongQuestion,
} from '@/lib/wrongQuestions';
import type { WrongQuestion, QuestionType } from '@/lib/types';
import { renderRichText, latexToPlainText } from '@/lib/renderRichText';
import MathTextInput from '@/components/MathTextInput';
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCw,
  BookOpen,
  Clock,
} from 'lucide-react';

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  short: '填空题',
};

/** 答案归一化：去除空白/逗号/顿号/斜杠，大写，排序 */
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
function judgeAnswer(q: { type: QuestionType; answer: string }, userAnswer: string): boolean {
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

export default function StudentWrongBook() {
  const { user } = useAuth();
  const toast = useToast();

  const [wrongs, setWrongs] = useState<WrongQuestion[]>([]);
  const [stats, setStats] = useState<{ total: number; byType: Record<QuestionType, number> }>({
    total: 0,
    byType: { single: 0, multiple: 0, judge: 0, short: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [redoId, setRedoId] = useState<string | null>(null);
  const [redoAnswer, setRedoAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [list, s] = await Promise.all([
      listWrongQuestions(user.id),
      getWrongQuestionStats(user.id),
    ]);
    setWrongs(list);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  /** 按题库分组 */
  const grouped = useMemo(() => {
    const map = new Map<string, { bankName: string; items: WrongQuestion[] }>();
    wrongs.forEach((w) => {
      const key = w.bank_id;
      if (!map.has(key)) {
        map.set(key, { bankName: w.bank_name || '（已删除题库）', items: [] });
      }
      map.get(key)!.items.push(w);
    });
    return Array.from(map.entries()).map(([bankId, v]) => ({ bankId, ...v }));
  }, [wrongs]);

  /** 最近新增时间 */
  const latestTime = useMemo(() => {
    if (wrongs.length === 0) return null;
    return wrongs.reduce((latest, w) => {
      return new Date(w.created_at) > new Date(latest) ? w.created_at : latest;
    }, wrongs[0].created_at);
  }, [wrongs]);

  /** 提交重做 */
  const submitRedo = async (w: WrongQuestion) => {
    if (!user) return;
    if (!redoAnswer.trim()) {
      toast.warning('请先作答');
      return;
    }

    // 所有题型自动判分（包括填空题严格比较）
    const ok = judgeAnswer(
      { type: w.question_type || 'single', answer: w.correct_answer },
      redoAnswer,
    );
    setSubmitting(true);
    if (ok) {
      const r = await removeWrongQuestion(user.id, w.question_id);
      setSubmitting(false);
      if (r.success) {
        toast.success('回答正确，已从错题本移除');
        setRedoId(null);
        setRedoAnswer('');
        load();
      } else {
        toast.error(r.error || '移除失败');
      }
    } else {
      const r = await upsertWrongQuestion({
        student_id: user.id,
        bank_id: w.bank_id,
        question_id: w.question_id,
        student_answer: redoAnswer,
        correct_answer: w.correct_answer,
        mode: 'practice',
      });
      setSubmitting(false);
      if (r.success) {
        toast.error('回答错误，已更新错题记录');
        setRedoId(null);
        setRedoAnswer('');
        load();
      } else {
        toast.error(r.error || '更新失败');
      }
    }
  };

  const startRedo = (w: WrongQuestion) => {
    setRedoId(w.id);
    setRedoAnswer('');
  };

  const cancelRedo = () => {
    setRedoId(null);
    setRedoAnswer('');
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">错题本</h1>
        <p className="text-sm text-gray-500 mt-1">自动收集练习与考试中的错题，可再次作答</p>
      </div>

      {/* 统计卡片：白底黑字 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="错题总数"
          value={stats.total}
          icon={<AlertCircle className="w-6 h-6" />}
        />
        <StatCard
          label="题型分布"
          value={
            <span className="text-sm font-num">
              单<span className="text-ink-700 font-bold">{stats.byType.single}</span>
              <span className="text-gray-300 mx-1">·</span>
              多<span className="text-ink-700 font-bold">{stats.byType.multiple}</span>
              <span className="text-gray-300 mx-1">·</span>
              判<span className="text-ink-700 font-bold">{stats.byType.judge}</span>
              <span className="text-gray-300 mx-1">·</span>
              填<span className="text-ink-700 font-bold">{stats.byType.short}</span>
            </span>
          }
          icon={<BookOpen className="w-6 h-6" />}
        />
        <StatCard
          label="最近新增"
          value={latestTime ? new Date(latestTime).toLocaleString('zh-CN') : '—'}
          icon={<Clock className="w-6 h-6" />}
        />
      </div>

      {/* 错题列表 */}
      {loading ? (
        <div className="card p-12 text-center text-sm text-gray-400">
          <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
          加载中...
        </div>
      ) : wrongs.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <div className="font-display text-lg font-bold text-ink-700 mb-1">暂无错题</div>
          <p className="text-sm text-gray-500">继续加油，错题会自动收集到这里</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.bankId}>
              {/* 题库分组标题 */}
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-ink-500" />
                <h2 className="font-display text-base font-bold text-ink-700">
                  {group.bankName}
                </h2>
                <span className="text-xs text-gray-400">（{group.items.length} 题）</span>
              </div>

              {/* 题目列表 */}
              <div className="space-y-3">
                {group.items.map((w, idx) => (
                  <div key={w.id} className="card p-5">
                    {/* 题头 */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-num text-xs text-gray-400">#{idx + 1}</span>
                      <span className="tag-neutral">
                        {TYPE_LABELS[w.question_type || 'single']}
                      </span>
                      <span
                        className={`tag ${
                          w.mode === 'exam' ? 'tag-warning' : 'tag-info'
                        }`}
                      >
                        {w.mode === 'exam' ? '来自考试' : '来自练习'}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {new Date(w.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>

                    {/* 题干 */}
                    <div
                      className="question-content text-sm text-gray-800 leading-relaxed mb-3"
                      dangerouslySetInnerHTML={{
                        __html: renderRichText(w.question_content || '（题目已删除）'),
                      }}
                    />

                    {/* 答案对比 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-xs text-red-500 mb-1">我的答案</div>
                        <div className="text-sm font-num font-bold text-red-700 break-words">
                          {w.student_answer || '（未作答）'}
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-xs text-green-600 mb-1">正确答案</div>
                        <div className="text-sm font-num font-bold text-green-700 break-words">
                          <span dangerouslySetInnerHTML={{ __html: renderRichText(w.correct_answer || '—') }} />
                        </div>
                      </div>
                    </div>

                    {/* 重做区域 */}
                    {redoId === w.id ? (
                      <div className="border-t border-gray-100 pt-4">
                        <div className="text-xs text-gray-500 mb-2 font-medium">重新作答</div>
                        <RedoInput
                          question={w}
                          value={redoAnswer}
                          onChange={setRedoAnswer}
                        />
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => submitRedo(w)}
                            disabled={submitting || !redoAnswer.trim()}
                            className="btn-primary text-xs"
                          >
                            {submitting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            提交
                          </button>
                          <button
                            onClick={cancelRedo}
                            disabled={submitting}
                            className="btn-ghost text-xs"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => startRedo(w)}
                          className="btn-secondary text-xs"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          重新作答
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

/** 重做输入组件：根据题型渲染对应交互 */
function RedoInput({
  question,
  value,
  onChange,
}: {
  question: WrongQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const type = question.question_type || 'single';
  const options = question.question_options;

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
              }`}
            >
              <input
                type="radio"
                name={`redo-${question.id}`}
                checked={checked}
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
    const toggle = (val: string) => {
      const letters = selected.slice();
      const i = letters.indexOf(val);
      if (i >= 0) letters.splice(i, 1);
      else letters.push(val);
      letters.sort();
      onChange(letters.join(''));
    };
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
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(val)}
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
              }`}
            >
              <input
                type="radio"
                name={`redo-${question.id}`}
                checked={checked}
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
      onChange={onChange}
      placeholder="请输入您的答案..."
    />
  );
}
