import { createContext, useState, ReactNode, useCallback } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function Toaster() {
  const context = ToastContext;
  
  if (!context) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 right-0 p-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {context._currentValue?.toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg p-4 shadow-lg flex gap-3 items-center transform transition-all duration-300
            ${toast.variant === 'destructive' ? 'bg-red-900' : 
              toast.variant === 'success' ? 'bg-green-900' : 'bg-gray-800'}
          `}
          style={{
            animation: 'slideIn 0.4s ease forwards',
          }}
        >
          <div className="flex-1">
            <h3 className="font-medium text-white">{toast.title}</h3>
            {toast.description && (
              <p className="text-sm mt-1 text-gray-300">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => context._currentValue?.removeToast(toast.id)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}