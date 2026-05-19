import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const ToastContainer: React.FC = () => {
  const toasts = useAuthStore((s) => s.toasts);
  const removeToast = useAuthStore((s) => s.removeToast);

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-800',
    error: 'border-red-800',
    info: 'border-cyan-800',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 bg-[#1A1A24] border ${borders[toast.type]} rounded-lg px-4 py-3 shadow-xl animate-in slide-in-from-right-4`}
        >
          {icons[toast.type]}
          <p className="text-sm text-[#F1F5F9] flex-1">{toast.message}</p>
          <button onClick={() => removeToast(toast.id)} className="text-[#475569] hover:text-[#94A3B8] shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
