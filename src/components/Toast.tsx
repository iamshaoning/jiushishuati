import { create } from 'zustand';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (type: ToastType, message: string) => void;
  remove: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => get().remove(id), 4000);
  },
  remove: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

interface ToastCtx {
  push: (type: ToastType, message: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
}

const Ctx = createContext<ToastCtx>({
  push: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

function ToastList() {
  const [toasts, setToasts] = useState<Toast[]>(() => useToastStore.getState().toasts);

  useEffect(() => {
    const unsub = useToastStore.subscribe((state) => {
      setToasts(state.toasts);
    });
    return unsub;
  }, []);

  const remove = useToastStore.getState().remove;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-2 max-w-md pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const push = useToastStore.getState().push;

  const value: ToastCtx = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    warning: (m) => push('warning', m),
    info: (m) => push('info', m),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastList />
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const cfg = {
    success: { icon: CheckCircle2, color: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50' },
    error: { icon: XCircle, color: 'text-red-600', border: 'border-red-200', bg: 'bg-red-50' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50' },
    info: { icon: Info, color: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' },
  }[toast.type];

  const Icon = cfg.icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3 pr-2 rounded-lg border ${cfg.border} ${cfg.bg} shadow-card animate-slide-up min-w-[200px] w-fit max-w-md`}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0 text-sm text-gray-800 leading-relaxed break-words">{toast.message}</div>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-white/50 text-gray-400 hover:text-gray-600 flex-shrink-0"
        aria-label="关闭"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(Ctx);
}
