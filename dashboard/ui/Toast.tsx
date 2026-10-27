'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; text: string; kind: 'success' | 'error' | 'info' };
const Ctx = createContext<{ toast: (text: string, kind?: Toast['kind']) => void }>({ toast: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, text, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="d-toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`d-toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx).toast;
