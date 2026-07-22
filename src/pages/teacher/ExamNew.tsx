import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { getBank, createBankWithQuestions } from '@/lib/banks';
import { listQuestions } from '@/lib/questions';
import type { QuestionBank, Question, QuestionType, ParsedQuestion } from '@/lib/types';
import { renderRichText } from '@/lib/renderRichText';
import {
  ArrowLeft,
  Loader2,
  Grid3x3,
  List,
  Shuffle,
  CheckCircle2,
  Save,
  FileText,
  ClipboardList,
} from 'lucide-react';

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  short: '填空题',
};

const TYPE_ORDER: QuestionType[] = ['single', 'multiple', 'judge', 'short'];

type ViewMode = 'icon' | 'detail';

export default function TeacherExamNew() {
  const { fromBankId } = useParams<{ fromBankId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [sourceBank, setSourceBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('icon');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 新试卷信息
  const [examName, setExamName] = useState('');
  const [examDesc, setExamDesc] = useState('');
  // 每种题型的随机抽取数量
  const [randomCounts, setRandomCounts] = useState<Record<QuestionType, number>>({
    single: 0,
    multiple: 0,
    judge: 0,
    short: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!fromBankId) return;
    setLoading(true);
    Promise.all([getBank(fromBankId), listQuestions(fromBankId)]).then(([b, qs]) => {
      setSourceBank(b);
      setQuestions(qs);
      if (b) {
        setExamName(`${b.name} - 试卷`);
        setExamDesc(`基于《${b.name}》生成的试卷`);
      }
      setLoading(false);
    });
  }, [fromBankId]);

  // 按题型分组
  const grouped = useMemo(() => {
    const m: Record<QuestionType, Question[]> = { single: [], multiple: [], judge: [], short: [] };
    questions.forEach((q) => m[q.type].push(q));
    return m;
  }, [questions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (list: Question[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = list.every((q) => next.has(q.id));
      if (allSelected) {
        list.forEach((q) => next.delete(q.id));
      } else {
        list.forEach((q) => next.add(q.id));
      }
      return next;
    });
  };

  const randomPick = (type: QuestionType) => {
    const count = randomCounts[type];
    const pool = grouped[type];
    if (count <= 0 || count > pool.length) {
      toast.warning(`数量需在 1-${pool.length} 之间`);
      return;
    }
    // 随机抽取 count 题
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      // 先移除该题型所有已选
      pool.forEach((q) => next.delete(q.id));
      // 再添加抽中的
      picked.forEach((q) => next.add(q.id));
      return next;
    });
    toast.success(`已随机抽取 ${count} 题${TYPE_LABELS[type]}`);
  };

  const selectedCount = selectedIds.size;
  const selectedQuestions = questions.filter((q) => selectedIds.has(q.id));

  const handleCreate = async () => {
    if (!user) return;
    if (!examName.trim()) {
      toast.warning('请填写试卷名称');
      return;
    }
    if (selectedCount === 0) {
      toast.warning('请至少选择一道题目');
      return;
    }
    setSubmitting(true);
    // 按 type 顺序 + 原顺序排列选中题目
    const ordered: ParsedQuestion[] = [];
    TYPE_ORDER.forEach((t) => {
      grouped[t].forEach((q) => {
        if (selectedIds.has(q.id)) {
          ordered.push({
            type: q.type,
            content: q.content,
            options: q.options,
            answer: q.answer,
            analysis: q.analysis,
            sort_order: ordered.length,
          });
        }
      });
    });

    const r = await createBankWithQuestions({
      name: examName.trim(),
      description: examDesc.trim(),
      owner_id: user.id,
      questions: ordered,
      type: 'exam',
    });
    setSubmitting(false);
    if (r.success && r.id) {
      if (r.share_code) {
        navigator.clipboard.writeText(r.share_code).then(
          () => toast.success(`试卷创建成功！分享码已自动复制：${r.share_code}`),
          () => toast.success(`试卷创建成功！分享码：${r.share_code}`),
        );
      } else {
        toast.success('试卷创建成功');
      }
      nav('/teacher');
    } else {
      toast.error(r.error || '创建失败');
    }
  };

  if (loading) {
    return (
      <>
        <div className="text-center text-gray-400 py-16 text-sm">
          <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
          加载源题库...
        </div>
      </>
    );
  }

  if (!sourceBank) {
    return (
      <>
        <div className="card p-12 text-center">
          <div className="text-gray-500">源题库不存在或无访问权限</div>
          <button onClick={() => nav('/teacher')} className="btn-primary mt-4">
            返回题库列表
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => nav('/teacher')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink-700 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        返回题库列表
      </button>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-700">创建试卷</h1>
        <p className="text-sm text-gray-500 mt-1">
          源题库：<b>{sourceBank.name}</b>（共 {questions.length} 题）
        </p>
      </div>

      {/* 试卷信息 */}
      <div className="card p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">试卷名称 *</label>
            <input
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="input-field"
              placeholder="如：高三数学期中试卷"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">试卷描述</label>
            <input
              value={examDesc}
              onChange={(e) => setExamDesc(e.target.value)}
              className="input-field"
              placeholder="可选"
            />
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">已选</span>
          <span className="font-num font-bold text-ink-700 text-lg">{selectedCount}</span>
          <span className="text-sm text-gray-500">/ {questions.length} 题</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('icon')}
            className={`btn-ghost text-xs ${viewMode === 'icon' ? 'bg-ink-50 text-ink-700' : ''}`}
            title="题号图标模式"
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            图标
          </button>
          <button
            onClick={() => setViewMode('detail')}
            className={`btn-ghost text-xs ${viewMode === 'detail' ? 'bg-ink-50 text-ink-700' : ''}`}
            title="详细题目模式"
          >
            <List className="w-3.5 h-3.5" />
            详细
          </button>
        </div>
      </div>

      {/* 按题型分组展示 */}
      <div className="space-y-6">
        {TYPE_ORDER.filter((t) => grouped[t].length > 0).map((type) => {
          const list = grouped[type];
          const selectedInType = list.filter((q) => selectedIds.has(q.id)).length;
          return (
            <div key={type} className="card p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-ink-700">{TYPE_LABELS[type]}</h3>
                  <span className="text-xs text-gray-500">
                    （{selectedInType}/{list.length}）
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={list.length}
                    value={randomCounts[type]}
                    onChange={(e) =>
                      setRandomCounts((p) => ({
                        ...p,
                        [type]: Math.max(0, Math.min(list.length, parseInt(e.target.value) || 0)),
                      }))
                    }
                    className="input-field w-16 text-xs"
                    placeholder="数量"
                  />
                  <button
                    onClick={() => randomPick(type)}
                    className="btn-secondary text-xs"
                    title="随机抽取指定数量"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    随机抽取
                  </button>
                  <button
                    onClick={() => selectAll(list)}
                    className="btn-ghost text-xs"
                    title="全选/取消全选"
                  >
                    {selectedInType === list.length ? '取消全选' : '全选'}
                  </button>
                </div>
              </div>

              {viewMode === 'icon' ? (
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                  {list.map((q, idx) => {
                    const checked = selectedIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => toggleSelect(q.id)}
                        className={`aspect-square rounded-md flex items-center justify-center text-sm font-num font-medium transition ${
                          checked
                            ? 'bg-ink-700 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={q.content.slice(0, 50)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {list.map((q, idx) => {
                    const checked = selectedIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => toggleSelect(q.id)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          checked
                            ? 'border-ink-400 bg-ink-50/60'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-num font-bold flex-shrink-0 ${
                              checked ? 'bg-ink-700 text-white' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-sm text-gray-800 line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: renderRichText(q.content) }}
                            />
                            {q.options && q.options.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1 truncate">
                                {q.options.slice(0, 4).join('  ')}
                              </div>
                            )}
                          </div>
                          {checked && (
                            <CheckCircle2 className="w-4 h-4 text-ink-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部创建栏 */}
      <div className="sticky bottom-4 mt-6">
        <div className="card p-4 flex items-center justify-between flex-wrap gap-3 shadow-lift">
          <div className="flex items-center gap-2 text-sm">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <span className="text-gray-600">
              试卷将包含 <b className="text-ink-700 font-num">{selectedCount}</b> 道题，
              创建后分享码自动复制
            </span>
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting || selectedCount === 0}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {submitting ? '创建中...' : '创建试卷'}
          </button>
        </div>
      </div>
    </>
  );
}
