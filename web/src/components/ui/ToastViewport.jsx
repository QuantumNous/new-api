/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const toastStyles = {
  info: {
    icon: Info,
    className: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950 dark:text-sky-100',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-100',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100',
  },
  error: {
    icon: AlertCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950 dark:text-rose-100',
  },
};

const normalizeMessage = (detail) => ({
  id: detail?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type: detail?.type || 'info',
  message: detail?.message || '',
  duration: detail?.duration ?? 4000,
});

const ToastViewport = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const handleToast = (event) => {
      const item = normalizeMessage(event.detail);
      setItems((prev) => [...prev.slice(-4), item]);

      if (item.duration !== false) {
        window.setTimeout(() => {
          setItems((prev) => prev.filter((toast) => toast.id !== item.id));
        }, item.duration);
      }
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className='pointer-events-none fixed right-4 top-20 z-[9999] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3'>
      {items.map((item) => {
        const style = toastStyles[item.type] || toastStyles.info;
        const Icon = style.icon;

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${style.className}`}
          >
            <Icon className='mt-0.5 shrink-0' size={18} />
            <div className='min-w-0 flex-1 break-words'>{item.message}</div>
            <button
              type='button'
              className='rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10'
              onClick={() =>
                setItems((prev) => prev.filter((toast) => toast.id !== item.id))
              }
              aria-label='Close'
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastViewport;
