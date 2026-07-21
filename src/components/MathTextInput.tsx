import { useRef, useState } from 'react';
import { Sigma, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 数学符号分组（初中数学常见）
 * 点击符号插入到 textarea 光标位置
 */
const SYMBOL_GROUPS: { label: string; symbols: string[] }[] = [
  {
    label: '常用',
    symbols: ['°', '√', '±', '∓', '×', '÷', '·', '≈', '≠', '≤', '≥', '≡', '∞', 'π'],
  },
  {
    label: '几何',
    symbols: ['∠', '△', '⊥', '∥', '⊙', '⌒', '≅', '∼'],
  },
  {
    label: '集合',
    symbols: ['∈', '∉', '∩', '∪', '∅', '⊆', '⊂', '∀', '∃'],
  },
  {
    label: '逻辑',
    symbols: ['∵', '∴', '→', '⇒', '⇐', '⇔', '∝'],
  },
  {
    label: '希腊',
    symbols: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'ν', 'ξ', 'ρ', 'σ', 'φ', 'ψ', 'ω'],
  },
  {
    label: '上下标',
    symbols: ['²', '³', '⁴', '⁻¹', 'ⁿ', '₁', '₂', '₃', 'ₙ'],
  },
  {
    label: '其他',
    symbols: ['⋯', '…', '′', '″', '∂', '∇', '%'],
  },
];

interface MathTextInputProps {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: string;
}

/**
 * 带数学符号面板的文本输入框
 * 供填空题作答使用：点击符号插入到光标位置，避免手打特殊符号失误
 */
export default function MathTextInput({
  value,
  disabled,
  onChange,
  placeholder,
  minHeight = '100px',
}: MathTextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPad, setShowPad] = useState(false);

  const insert = (sym: string) => {
    const ta = ref.current;
    if (!ta) {
      onChange(value + sym);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + sym + value.slice(end);
    onChange(next);
    // 恢复焦点并将光标移到插入符号之后
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + sym.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowPad((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-ink-700 mb-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sigma className="w-3.5 h-3.5" />
        数学符号
        {showPad ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showPad && (
        <div className="mb-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          {SYMBOL_GROUPS.map((g) => (
            <div key={g.label} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 mt-1.5 w-10 flex-shrink-0">{g.label}</span>
              <div className="flex flex-wrap gap-1">
                {g.symbols.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => insert(s)}
                    disabled={disabled}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-sm hover:bg-ink-50 hover:border-ink-300 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="input-field resize-y"
        style={{ minHeight }}
        placeholder={placeholder}
      />
    </div>
  );
}
