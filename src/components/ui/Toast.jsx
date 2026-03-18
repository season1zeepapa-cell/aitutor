// 토스트 알림 시스템
import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const showToast = useCallback((message, type) => addToast(message, type), [addToast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg border fade-in
            ${t.type === 'success' ? 'bg-green-50 border-green-200 text-success' :
              t.type === 'error' ? 'bg-red-50 border-red-200 text-danger' :
              t.type === 'warn' ? 'bg-yellow-50 border-yellow-200 text-warning' :
              'bg-blue-50 border-blue-200 text-primary'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
