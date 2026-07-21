import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import Layout from '@/components/Layout';
import QuestionEditor from '@/components/QuestionEditor';
import { createBankWithQuestions } from '@/lib/banks';

import { parsePastedText } from '@/lib/parsers/text';
import { parseWordFile } from '@/lib/parsers/word';
import { parseExcelFile } from '@/lib/parsers/excel';
import { parseAnswerFile } from '@/lib/parsers/answer';
import { detectType, normalizeAnswer } from '@/lib/parsers/types';
import type { ParseResult } from '@/lib/parsers/types';
import type { ParsedQuestion, QuestionType } from '@/lib/types';
import { renderRichText } from '@/lib/renderRichText';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  FileType2,
  Sheet,
  SplitSquareHorizontal,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Plus,
  BookOpen,
  ClipboardList,
} from 'lucide-react';

type UploadMode = 'text' | 'word' | 'excel' | 'separate';
type BankType = 'practice' | 'exam';

const STEPS = ['题库信息', '上传方式', '预览题目', '完成导入'] as const;

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  short: '填空',
};

export default function BankNew() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bankType, setBankType] = useState<BankType>('practice');
  const [mode, setMode] = useState<UploadMode>('text');

  // 文本粘贴
  const [textQ, setTextQ] = useState('');

  // 分文件上传
  const [qFile, setQFile] = useState<File | null>(null);
  const [aFile, setAFile] = useState<File | null>(null);

  // 单文件上传
  const [singleFile, setSingleFile] = useState<File | null>(null);

  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const goBack = () => {
    if (step === 0) {
      nav('/teacher');
    } else {
      setStep(step - 1);
    }
  };

  const handleParse = async () => {
    setParsing(true);
    setWarnings([]);
    try {
      let result: { questions: ParsedQuestion[]; warnings: string[] } = { questions: [], warnings: [] };

      if (mode === 'text') {
        if (!textQ.trim()) {
          toast.warning('请粘贴题目内容');
          setParsing(false);
          return;
        }
        result = parsePastedText(textQ);
      } else if (mode === 'word') {
        if (!singleFile) {
          toast.warning('请上传 .docx 文件');
          setParsing(false);
          return;
        }
        result = await parseWordFile(singleFile);
      } else if (mode === 'excel') {
        if (!singleFile) {
          toast.warning('请上传 .xlsx 文件');
          setParsing(false);
          return;
        }
        result = await parseExcelFile(singleFile);
      } else if (mode === 'separate') {
        // 题答分文件：题目文件识别题型/题干/选项，答案文件识别答案/解析
        if (!qFile) {
          toast.warning('请上传题目文件');
          setParsing(false);
          return;
        }
        // 1. 解析题目文件（题型、题干、选项；忽略其自带答案/解析）
        const qResult = await parseQuestionFile(qFile);
        const qs = qResult.questions;
        const ws = qResult.warnings.filter((w) => !w.includes('缺少答案'));
        if (qs.length === 0) {
          result = { questions: [], warnings: ws };
        } else if (aFile) {
          // 2. 解析答案文件，按顺序与题目合并
          const answers = await parseAnswerFile(aFile);
          qs.forEach((q, i) => {
            const a = answers[i];
            if (a) {
              const type = detectType(q.options, a.answer);
              q.type = type;
              q.answer = normalizeAnswer(a.answer, type);
              q.analysis = a.analysis;
            }
          });
          if (answers.length < qs.length) {
            ws.push(`答案文件仅 ${answers.length} 条，题目 ${qs.length} 道，部分题目未匹配到答案`);
          } else if (answers.length > qs.length) {
            ws.push(`答案文件 ${answers.length} 条多于题目 ${qs.length} 道，多余答案已忽略`);
          }
          result = { questions: qs, warnings: ws };
        } else {
          // 无答案文件：保留题目文件自带的答案（若有）
          result = { questions: qs, warnings: ws };
        }
      }

      if (result.questions.length === 0) {
        toast.error('未解析到任何题目，请检查格式');
        setParsing(false);
        return;
      }

      setQuestions(result.questions);
      setWarnings(result.warnings);
      setStep(2);
      toast.success(`解析到 ${result.questions.length} 道题`);
    } catch (e: any) {
      toast.error('解析失败：' + (e?.message || '未知错误'));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.warning('请先填写题库名');
      setStep(0);
      return;
    }
    if (questions.length === 0) {
      toast.warning('没有可导入的题目');
      return;
    }
    setSubmitting(true);
    const r = await createBankWithQuestions({
      name,
      description,
      owner_id: user.id,
      questions,
      type: bankType,
    });
    setSubmitting(false);
    if (r.success && r.id) {
      // 自动复制分享码到剪贴板
      if (r.share_code) {
        navigator.clipboard.writeText(r.share_code).then(
          () => toast.success(`导入成功！分享码已自动复制：${r.share_code}`),
          () => toast.success(`导入成功！分享码：${r.share_code}`),
        );
      } else {
        toast.success('导入成功');
      }
      nav(`/teacher/banks/${r.id}`);
    } else {
      toast.error(r.error || '导入失败');
    }
  };

  const updateQuestion = (i: number, q: ParsedQuestion) => {
    setQuestions((arr) => arr.map((x, idx) => (idx === i ? q : x)));
  };

  const removeQuestion = (i: number) => {
    setQuestions((arr) => arr.filter((_, idx) => idx !== i));
    setEditingIndex(null);
  };

  const addBlank = () => {
    setQuestions((arr) => [
      ...arr,
      { type: 'single', content: '', options: ['A. ', 'B. ', 'C. ', 'D. '], answer: '', analysis: '', sort_order: arr.length },
    ]);
    setEditingIndex(questions.length);
  };

  return (
    <Layout>
      <button onClick={goBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink-700 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        返回
      </button>

      <h1 className="font-display text-2xl font-bold text-ink-700 mb-1">新建题库</h1>
      <p className="text-sm text-gray-500 mb-6">按步骤上传题目，预览无误后导入系统</p>

      {/* 步骤进度条 */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-num font-bold transition-colors ${
                    i < step
                      ? 'bg-ink-700 text-white'
                      : i === step
                        ? 'bg-amber-300 text-ink-700'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <div className={`text-xs mt-1.5 ${i <= step ? 'text-ink-700 font-medium' : 'text-gray-400'}`}>{s}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 -mt-5 ${i < step ? 'bg-ink-700' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 步骤 0：题库信息 */}
      {step === 0 && (
        <div className="card p-6 animate-fade-in">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">题库名称 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="如：高三数学一轮复习"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">题库描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input-field"
                placeholder="可选，简要描述题库内容"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">题库类型 *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBankType('practice')}
                  className={`text-left p-4 rounded-xl2 border transition-all ${
                    bankType === 'practice'
                      ? 'border-ink-500 bg-ink-50/50 shadow-soft'
                      : 'border-gray-200 bg-white hover:border-ink-200 hover:bg-ink-50/30'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
                      bankType === 'practice' ? 'bg-ink-700 text-amber-300' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className={`font-medium text-sm ${bankType === 'practice' ? 'text-ink-700' : 'text-gray-700'}`}>
                    练习题
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    学生可练习（即时反馈）与模拟考试（统一交卷）
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBankType('exam')}
                  className={`text-left p-4 rounded-xl2 border transition-all ${
                    bankType === 'exam'
                      ? 'border-ink-500 bg-ink-50/50 shadow-soft'
                      : 'border-gray-200 bg-white hover:border-ink-200 hover:bg-ink-50/30'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
                      bankType === 'exam' ? 'bg-ink-700 text-amber-300' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className={`font-medium text-sm ${bankType === 'exam' ? 'text-ink-700' : 'text-gray-700'}`}>
                    试卷
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    学生只能开始考试，交卷后教师可查看错题详情
                  </div>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                disabled={!name.trim()}
                className="btn-primary"
              >
                下一步
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 步骤 1：上传方式 */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <ModeCard
              active={mode === 'text'}
              icon={<FileText className="w-5 h-5" />}
              title="文本粘贴"
              desc="纯文本快速导入"
              onClick={() => setMode('text')}
            />
            <ModeCard
              active={mode === 'word'}
              icon={<FileType2 className="w-5 h-5" />}
              title="Word 文件"
              desc="支持公式与插图"
              onClick={() => setMode('word')}
            />
            <ModeCard
              active={mode === 'excel'}
              icon={<Sheet className="w-5 h-5" />}
              title="Excel 文件"
              desc="仅支持公式"
              onClick={() => setMode('excel')}
            />
            <ModeCard
              active={mode === 'separate'}
              icon={<SplitSquareHorizontal className="w-5 h-5" />}
              title="题答分文件"
              desc="题目与答案分别上传"
              onClick={() => setMode('separate')}
            />
          </div>

          <div className="card p-5">
            {mode === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">题目内容</label>
                  <textarea
                    value={textQ}
                    onChange={(e) => setTextQ(e.target.value)}
                    rows={7}
                    className="input-field font-mono text-xs"
                    placeholder={`一、单选题\n1. 题干内容...\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案：A\n\n二、多选题\n2. 题干...\nA. 选项\nB. 选项\n答案：ABD\n\n三、填空题\n3. 题干中有（  ）空\n答案：填空答案\n\n四、判断题\n4. 题干...\n答案：对`}
                  />
                </div>
                <TextFormatHint />
              </div>
            )}

            {mode === 'word' && (
              <div className="space-y-3">
                <FileUpload
                  accept=".docx"
                  file={singleFile}
                  onChange={setSingleFile}
                />
                <TextFormatHint />
              </div>
            )}

            {mode === 'excel' && (
              <div className="space-y-3">
                <FileUpload
                  accept=".xlsx"
                  file={singleFile}
                  onChange={setSingleFile}
                />
                <ExcelFormatHint />
              </div>
            )}

            {mode === 'separate' && (
              <div className="space-y-4">
                <FileUpload
                  accept=".docx,.xlsx"
                  file={qFile}
                  onChange={setQFile}
                  label="题目文件"
                />
                <FileUpload
                  accept=".docx,.xlsx"
                  file={aFile}
                  onChange={setAFile}
                  label="答案文件"
                />
                <div className="bg-ink-50/40 border border-ink-100 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                  <div className="font-bold text-ink-700 mb-1">分文件上传说明</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><b>题目文件</b>：只识别题型、题目、选项（格式要求与对应文件类型一致）</li>
                    <li><b>答案文件（word）</b>：每行「序号 + 间隔符 + 答案」，一号一行一答案，不需要「答案：」文本。例：1，A / 2.B</li>
                    <li><b>答案文件（excel）</b>：每行第一个单元格为答案（有序号或「答案：」都行），第二个单元格若存在则视为本题解析（有「解析：」都行），向下依次排序</li>
                    <li>答案与题目按顺序一一对应</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setStep(0)} className="btn-secondary">
              上一步
            </button>
            <button onClick={handleParse} disabled={parsing} className="btn-primary">
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {parsing ? '解析中...' : '解析并预览'}
            </button>
          </div>
        </div>
      )}

      {/* 步骤 2：预览 */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          {warnings.length > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/50">
              <div className="flex items-start gap-2 text-amber-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium mb-1">解析警告（{warnings.length}）</div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-600">
                    {warnings.slice(0, 8).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {warnings.length > 8 && <li>... 共 {warnings.length} 条</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">已解析题目</div>
              <div className="font-num text-2xl font-bold text-ink-700">{questions.length}</div>
            </div>
            <button onClick={addBlank} className="btn-secondary">
              <Plus className="w-4 h-4" />
              手动添加一题
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-num text-xs text-gray-400">#{i + 1}</span>
                    <span className="tag-neutral">{TYPE_LABELS[q.type]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                      className="btn-ghost text-xs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      编辑
                    </button>
                    <button onClick={() => removeQuestion(i)} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingIndex === i ? (
                  <QuestionEditor
                    question={q}
                    onChange={(nq) => updateQuestion(i, nq)}
                    onDelete={() => removeQuestion(i)}
                  />
                ) : (
                  <QuestionPreview q={q} />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setStep(1)} className="btn-secondary">
              上一步
            </button>
            <button onClick={handleImport} disabled={submitting || questions.length === 0} className="btn-primary">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? '导入中...' : `导入系统（${questions.length} 题）`}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ModeCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl2 border transition-all ${
        active
          ? 'border-ink-500 bg-ink-50/50 shadow-soft'
          : 'border-gray-200 bg-white hover:border-ink-200 hover:bg-ink-50/30'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
          active ? 'bg-ink-700 text-amber-300' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {icon}
      </div>
      <div className={`font-medium text-sm ${active ? 'text-ink-700' : 'text-gray-700'}`}>{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
    </button>
  );
}

function FileUpload({
  file,
  onChange,
  accept,
  hint,
  label,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  accept: string;
  hint?: string;
  label?: string;
}) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <label className="block border-2 border-dashed border-gray-200 rounded-xl2 p-6 text-center cursor-pointer hover:border-ink-300 hover:bg-ink-50/30 transition">
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        {file ? (
          <div className="text-sm text-ink-700 font-medium">{file.name}</div>
        ) : (
          <div className="text-sm text-gray-500">点击选择文件（{accept}）</div>
        )}
        {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
      </label>
      {file && (
        <button onClick={() => onChange(null)} className="text-xs text-red-500 mt-1 hover:underline">
          移除文件
        </button>
      )}
    </div>
  );
}

function QuestionPreview({ q }: { q: ParsedQuestion }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="question-content text-gray-800" dangerouslySetInnerHTML={{ __html: renderRichText(q.content) }} />
      {q.options && (
        <ul className="text-xs text-gray-600 space-y-0.5 pl-4">
          {q.options.map((o, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderRichText(o) }} />
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
  );
}

/** 分文件上传：按扩展名解析题目文件（题型、题干、选项） */
async function parseQuestionFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return parseWordFile(file);
  if (name.endsWith('.xlsx')) return parseExcelFile(file);
  return { questions: [], warnings: ['不支持的文件格式，仅支持 .docx / .xlsx'] };
}

/** 文本 / Word 格式说明（与直接粘贴格式要求一致） */
function TextFormatHint() {
  return (
    <div className="bg-ink-50/40 border border-ink-100 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
      <div className="font-bold text-ink-700 mb-1">支持的格式说明</div>
      <ul className="list-disc list-inside space-y-0.5">
        <li><b>题型标题</b>：「一、单选题」「二．多选题」「三.填空」「四、判断」，命中后到下一标题前都按该题型处理</li>
        <li><b>题干内题型标记</b>：「1.（单选题）题目」「1.题目(判断)」，缺少题型标题时，命中后本题按对应题型处理</li>
        <li><b>题号格式</b>：1. / 1． / 1、 / 1) / 1） / (1) / （1） / [1] / ①</li>
        <li><b>选项格式</b>：A. / A． / A、 / A) / A） / A: / A：</li>
        <li><b>选项分行</b>：每选项一行 / 所有选项一行 / 任意个数选项一行多行（如 AB一行 CD一行）</li>
        <li><b>答案格式</b>：单选「答案：A」多选「答案：ABD」单空填空「答案：1」多空填空「答案：1 2 3」判断「答案：对」</li>
        <li><b>解析格式</b>：「解析：xxx」/「解析:xxx」</li>
        <li><b>判断题答案支持</b>：对/错、正确/错误、Y/N</li>
        <li><b>多空填空与多选答案分隔支持</b>：“空格”、“，”、“,”、“、”</li>
        <li><b>填空题空位标记支持</b>：() / （） / __</li>
        <li>参数缺乏时将进可能自动识别</li>
      </ul>
    </div>
  );
}

/** Excel 格式说明 */
function ExcelFormatHint() {
  return (
    <div className="bg-ink-50/40 border border-ink-100 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
      <div className="font-bold text-ink-700 mb-1">Excel 格式说明</div>
      <ul className="list-disc list-inside space-y-0.5">
        <li><b>题型标题行</b>：从第一行开始，题型标题需在单独一行的第一个单元格（如「一、单选题」），到下一标题行前均按该题型处理</li>
        <li><b>题目行</b>：题型标题行的次行起，每行第一个单元格为题目内容（题号自动剥离）</li>
        <li><b>选项格</b>：题目格向后扫描，选项格式文本（A. xxx）视为选项格，支持每选项一格也支持多选项一格</li>
        <li><b>答案格</b>：答案格式文本（「答案：A」或纯答案）视为答案格，多选/多空填空答案应在同一格</li>
        <li><b>解析格</b>：「解析：xxx」/「解析:xxx」视为解析格</li>
        <li>不支持题干内题型标记，参数缺乏时将尽可能自动识别</li>
      </ul>
    </div>
  );
}
