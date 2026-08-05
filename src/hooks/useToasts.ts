import { useCallback, useState } from 'react';
import type { ToastItem, ToastKind } from '../types';

let idCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = `t${++idCounter}`;
    setToasts((prev) => [...prev, { id, kind, title, description }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
