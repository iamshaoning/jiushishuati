import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import QuestionEditor from '@/components/QuestionEditor';
import Modal from '@/components/Modal';
import { getBank, updateBankMeta, deleteBank } from '@/lib/banks';
import { listQuestions, updateQuestion, deleteQuestion, createQuestion } from '@/lib/questions';
import type { QuestionBank, Question, ParsedQuestion, QuestionType } from '@/lib/types';
import { renderRichText } from '@/lib/renderRichText';
import { ArrowLeft, Copy, Trash2, Pencil, Plus, Save, Loader2, BookOpen, ShieldCheck } from 'lucide-react';

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  short: '填空',
};

export default function AdminBankEdit() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const toast = useToast();

  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMeta, setEditMeta] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newQ, setNewQ] = useState<ParsedQuestion | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [b, qs] = await Promise.all([getBank(id), listQuestions(id)]);
    setBank(b);
    setQuestions(qs);
    setMetaName(b?.name || '');
    setMetaDesc(b?.description || '');
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const copyCode = () => {
    if (!bank?.share_code) return;
    navigator.clipboard.writeText(bank.share_code).then(
      () => toast.success(`分享码已复制：${bank.share_code}`),
      () => toast.error('复制失败'),
    );
  };

  const saveMeta = async () => {
    if (!bank) return;
    if (!metaName.trim()) {
      toast.warning('题库名不能为空');
      return;
    }
    const r = await updateBankMeta(bank.id, { name: metaName, description: metaDesc });
    if (r.success) {
      toast.success('已保存');
      setEditMeta(false);
      load();
    } else {
      toast.error(r.error || '失败');
    }
  };

  const confirmDel = async () => {
    if (!bank) return;
    const r = await deleteBank(bank.id);
    if (r.success) {
      toast.success('题库已删除');
      nav('/admin/banks');
    } else {
      toast.error(r.error || '失败');
    }
  };

  const saveQuestion = async (q: ParsedQuestion) => {
    if (!bank) return;
    setSaving(true);
    if (editingId) {
      const r = await updateQuestion(editingId, bank.id, {
        type: q.type,
        content: q.content,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
      });
      if (r.success) {
        toast.success('已保存');
        setEditingId(null);
        load();
      } else {
        toast.error(r.error || '失败');
      }
    } else if (addingNew && newQ) {
      const r = await createQuestion(bank.id, q);
      if (r.success) {
        toast.success('已添加');
        setAddingNew(false);
        setNewQ(null);
        load();
      } else {
        toast.error(r.error || '失败');
      }
    }
    setSaving(false);
  };

  const removeQ = async (qid: string) => {
    if (!bank) return;
    const r = await deleteQuestion(qid, bank.id);
    if (r.success) {
      toast.success('已删除');
      load();
    } else {
      toast.error(r.error || '失败');
    }
  };

  const startAdd = () => {
    setNewQ({
      type: 'single',
      content: '',
      options: ['A. ', 'B. ', 'C. ', 'D. '],
      answer: '',
      analysis: '',
      sort_order: questions.length,
    });
    setAddingNew(true);
    setEditingId(null);
  };

  if (loading) {
    return (
      <>
        <div className="text-center text-gray-400 py-16 text-sm">加载中...</div>
      </>
    );
  }

  if (!bank) {
    return (
      <>
        <div className="card p-12 text-center">
          <div className="text-gray-500">题库不存在</div>
          <button onClick={() => nav('/admin/banks')} className="btn-primary mt-4">
            返回列表
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => nav('/admin/banks')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回题库列表
        </button>
        <span className="tag-warning ml-2">
          <ShieldCheck className="w-3 h-3 mr-1 inline" />
          管理员视图
        </span>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            {editMeta ? (
              <div className="space-y-2 max-w-md">
                <input value={metaName} onChange={(e) => setMetaName(e.target.value)} className="input-field" />
                <textarea
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  rows={2}
                  className="input-field"
                />
                <div className="flex gap-2">
                  <button onClick={saveMeta} className="btn-primary text-xs">
                    <Save className="w-3.5 h-3.5" />
                    保存
                  </button>
                  <button onClick={() => setEditMeta(false)} className="btn-secondary text-xs">
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold text-ink-700">{bank.name}</h1>
                <p className="text-sm text-gray-500 mt-1">{bank.description || '（无描述）'}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>教师：{bank.owner_name || '—'}</span>
                  <span>·</span>
                  <span>{bank.question_count} 题</span>
                  <span>·</span>
                  <span>{new Date(bank.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMeta(!editMeta)} className="btn-secondary text-xs">
              <Pencil className="w-3.5 h-3.5" />
              编辑信息
            </button>
            <button onClick={() => setDelOpen(true)} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="text-xs text-gray-500">分享码（全局唯一不可重置）：</div>
          <code className="font-num text-lg font-bold text-ink-700 bg-ink-50 px-3 py-1 rounded">
            {bank.share_code || '未生成'}
          </code>
          <button onClick={copyCode} disabled={!bank.share_code} className="btn-ghost text-xs">
            <Copy className="w-3.5 h-3.5" />
            复制
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold text-ink-700 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          题目列表（{questions.length}）
        </h2>
        <button onClick={startAdd} className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" />
          添加题目
        </button>
      </div>

      {addingNew && newQ && (
        <div className="card p-4 mb-3 border-amber-200">
          <div className="text-xs text-amber-700 mb-2 font-medium">新增题目</div>
          <QuestionEditor
            question={newQ}
            onChange={(q) => setNewQ(q)}
            onDelete={() => {
              setAddingNew(false);
              setNewQ(null);
            }}
          />
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
            <button onClick={() => setAddingNew(false)} className="btn-secondary text-xs">
              取消
            </button>
            <button onClick={() => saveQuestion(newQ)} disabled={saving || !newQ.content} className="btn-primary text-xs">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {questions.length === 0 && !addingNew && (
          <div className="card p-10 text-center text-sm text-gray-400">暂无题目</div>
        )}
        {questions.map((q, i) => (
          <div key={q.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-num text-xs text-gray-400">#{i + 1}</span>
                <span className="tag-neutral">{TYPE_LABELS[q.type]}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingId(editingId === q.id ? null : q.id)}
                  className="btn-ghost text-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingId === q.id ? '收起' : '编辑'}
                </button>
                <button onClick={() => removeQ(q.id)} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {editingId === q.id ? (
              <QuestionEditor
                question={q}
                onChange={(nq) => {
                  setQuestions((arr) => arr.map((x) => (x.id === q.id ? ({ ...x, ...nq } as Question) : x)));
                }}
                onDelete={() => removeQ(q.id)}
              />
            ) : (
              <div className="space-y-2 text-sm">
                <div
                  className="question-content text-gray-800"
                  dangerouslySetInnerHTML={{ __html: renderRichText(q.content) }}
                />
                {q.options && (
                  <ul className="text-xs text-gray-600 space-y-0.5 pl-4">
                    {q.options.map((o, j) => (
                      <li key={j} dangerouslySetInnerHTML={{ __html: renderRichText(o) }} />
                    ))}
                  </ul>
                )}
                <div className="flex gap-4 text-xs pt-1">
                  <span>
                    <span className="text-gray-400">答案：</span>
                    <span className="text-ink-700 font-medium" dangerouslySetInnerHTML={{ __html: renderRichText(q.answer || '—') }} />
                  </span>
                  {q.analysis && (
                    <span className="text-gray-500 flex-1 truncate">
                      <span className="text-gray-400">解析：</span>
                      <span dangerouslySetInnerHTML={{ __html: renderRichText(q.analysis) }} />
                    </span>
                  )}
                </div>
              </div>
            )}

            {editingId === q.id && (
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">
                  取消
                </button>
                <button
                  onClick={() => {
                    const cur = questions.find((x) => x.id === q.id);
                    if (cur) {
                      saveQuestion({
                        type: cur.type,
                        content: cur.content,
                        options: cur.options,
                        answer: cur.answer,
                        analysis: cur.analysis,
                        sort_order: cur.sort_order,
                      });
                    }
                  }}
                  disabled={saving}
                  className="btn-primary text-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  保存
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={delOpen}
        title="确认删除题库"
        onClose={() => setDelOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDelOpen(false)}>
              取消
            </button>
            <button className="btn-danger" onClick={confirmDel}>
              确认删除
            </button>
          </>
        }
      >
        确定要删除题库「<b>{bank.name}</b>」吗？该操作会同时删除题库下所有题目，且无法撤销。
      </Modal>
    </>
  );
}
