/**
 * 屏幕尺寸守卫：宽 < 375 或高 < 730 时显示禁止使用画面
 */
import { useState, useEffect, type ReactNode } from 'react';

const MIN_WIDTH = 375;
const MIN_HEIGHT = 730;

export default function ScreenGuard({ children }: { children: ReactNode }) {
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    const check = () => {
      setTooSmall(window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (tooSmall) {
    return (
      <div className="fixed inset-0 z-[9999] bg-ink-700 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-300 flex items-center justify-center shadow-lg mb-5">
          <svg
            viewBox="0 0 24 24"
            className="w-9 h-9 text-ink-700"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <h1 className="text-lg font-bold mb-2">屏幕尺寸过小</h1>
        <p className="text-sm text-ink-100/70 leading-relaxed">
          本系统需要更大的屏幕显示。
          <br />
          请使用宽度 ≥ 375px 且高度 ≥ 730px 的设备访问。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
