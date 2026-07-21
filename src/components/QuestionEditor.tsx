import { useState } from 'react';
import type { ParsedQuestion, Question, QuestionType } from '@/lib/types';
import { renderRichText } from '@/lib/renderRichText';
import { Trash2, Plus } from 'lucide-react';

interface Props {
  question: ParsedQuestion | Question;
  onChange: (q: ParsedQuestion) => void;
  onDelete?: () => void;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  short: '填空题',
};

/** 从选项文本提取前缀字母（A/B/C...） */
function letterOf(opt: string): string {
  const m = opt.match(/^\s*([A-Za-z])[.、):]/);
  return m ? m[1].toUpperCase() : '';
}

export default function QuestionEditor({ question, onChange, onDelete }: Props) {
  const [draft, setDraft] = useState<ParsedQuestion>({
    type: question.type,
    content: question.content,
    options: question.options ? [...question.options] : null,
    answer: question.answer,
    analysis: question.analysis || '',
    sort_order: 'sort_order' in question ? question.sort_order : 0,
  });

  const update = (patch: Partial<ParsedQuestion>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };

  const hasOptions = draft.type === 'single' || draft.type === 'multiple';

  const updateOption = (i: number, val: string) => {
    const opts = [...(draft.options || [])];
    opts[i] = val;
    update({ options: opts });
  };

  const addOption = () => {
    const opts = [...(draft.options || [])];
    const next = String.fromCharCode(65 + opts.length); // A, B, C...
    opts.push(`${next}. `);
    update({ options: opts });
  };

  const removeOption = (i: number) => {
    const opts = [...(draft.options || [])];
    opts.splice(i, 1);
    update({ options: opts.length > 0 ? opts : null });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          value={draft.type}
          onChange={(e) => update({ type: e.target.value as QuestionType })}
          className="input-field w-32"
        >
          {(['single', 'multiple', 'judge', 'short'] as QuestionType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {onDelete && (
          <button onClick={onDelete} className="btn-ghost text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
            删除此题
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">题干内容（支持 &lt;img&gt; 标签嵌入图片）</label>
        <textarea
          value={draft.content}
          onChange={(e) => update({ content: e.target.value })}
          rows={4}
          className="input-field font-mono text-xs"
          placeholder="题干..."
        />
      </div>

      {hasOptions && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">选项</label>
          <div className="space-y-2">
            {(draft.options || []).map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className="input-field flex-1"
                  placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                />
                <button
                  onClick={() => removeOption(i)}
                  className="btn-ghost text-red-500 hover:bg-red-50"
                  aria-label="删除选项"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addOption} className="btn-secondary text-xs" type="button">
              <Plus className="w-3.5 h-3.5" />
              添加选项
            </button>
          </div>
        </div>
      )}

      {/* 答案区域：选择题直接选择，填空题自由输入 */}
      {draft.type === 'short' ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">参考答案</label>
          <textarea
            value={draft.answer}
            onChange={(e) => update({ answer: e.target.value })}
            rows={2}
            className="input-field"
            placeholder="填空题参考答案..."
          />
        </div>
      ) : draft.type === 'judge' ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">答案</label>
          <div className="flex gap-3">
            {[
              { v: '对', label: '正确' },
              { v: '错', label: '错误' },
            ].map((opt) => {
              const checked = draft.answer === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => update({ answer: opt.v })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                    checked
                      ? 'border-ink-400 bg-ink-50/60 text-ink-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            答案（{draft.type === 'multiple' ? '可多选' : '单选'}）
          </label>
          {(!draft.options || draft.options.length === 0) ? (
            <div className="text-xs text-gray-400 py-2">请先添加选项</div>
          ) : (
            <div className="space-y-2">
              {(draft.options || []).map((opt, i) => {
                const letter = letterOf(opt) || String.fromCharCode(65 + i);
                const checked =
                  draft.type === 'multiple'
                    ? draft.answer.includes(letter)
                    : draft.answer === letter;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (draft.type === 'multiple') {
                        const letters = draft.answer.split('').filter(Boolean);
                        const idx = letters.indexOf(letter);
                        if (idx >= 0) letters.splice(idx, 1);
                        else letters.push(letter);
                        letters.sort();
                        update({ answer: letters.join('') });
                      } else {
                        update({ answer: letter });
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-sm text-left transition ${
                      checked
                        ? 'border-ink-400 bg-ink-50/60 text-ink-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 flex-shrink-0 rounded ${
                        draft.type === 'multiple' ? '' : 'rounded-full'
                      } flex items-center justify-center text-xs font-bold ${
                        checked ? 'bg-ink-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {letter}
                    </span>
                    <span
                      className="flex-1"
                      dangerouslySetInnerHTML={{
                        __html: renderRichText(opt.replace(/^\s*[A-Za-z][.、):]\s*/, '')),
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">解析（可选）</label>
        <textarea
          value={draft.analysis}
          onChange={(e) => update({ analysis: e.target.value })}
          rows={2}
          className="input-field"
          placeholder="解析..."
        />
      </div>
    </div>
  );
}
