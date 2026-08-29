import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'destructive' renders red confirm button; 'default' renders primary teal */
  variant?: 'destructive' | 'default';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel on open (safer default for destructive actions)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Trap focus within modal
  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusables = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };

  if (!isOpen) return null;

  const isDestructive = variant === 'destructive';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleTabKey}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-150 ds-glass rounded-2xl border border-slate-700/60 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        <div className="p-6">
          {/* Icon + close button row */}
          <div className="flex items-start justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${
              isDestructive
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-cyan-400/10 border border-cyan-400/20'
            }`}>
              {isDestructive
                ? <AlertTriangle size={22} className="text-red-400" aria-hidden="true" />
                : <Trash2 size={22} className="text-cyan-400" aria-hidden="true" />
              }
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:outline-none"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>

          {/* Title */}
          <h2
            id="confirm-modal-title"
            className="text-lg font-bold text-white mb-2"
          >
            {title}
          </h2>

          {/* Description */}
          <p
            id="confirm-modal-desc"
            className="text-sm text-slate-400 leading-relaxed mb-6"
          >
            {description}
          </p>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              ref={cancelRef}
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-150 focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:outline-none active:scale-[0.97]"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={() => { onConfirm(); onClose(); }}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
                'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none',
                'active:scale-[0.97]',
                isDestructive
                  ? 'bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 hover:border-red-500/60 focus-visible:ring-red-500/50'
                  : 'bg-cyan-400 text-slate-900 hover:bg-cyan-300 focus-visible:ring-cyan-400/70',
              ].join(' ')}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
