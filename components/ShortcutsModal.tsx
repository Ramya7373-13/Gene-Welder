import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const ShortcutRow = ({ keys, description }: { keys: string[], description: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-muted/20 last:border-0">
      <span className="text-muted-foreground/60 text-sm">{description}</span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="bg-muted border border-muted/40 rounded px-2 py-1 text-xs font-mono text-muted-foreground/80 min-w-[24px] text-center shadow-sm">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-muted/50 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-muted/20 bg-card/50">
          <h3 className="text-foreground font-semibold flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" /> Keyboard Shortcuts
          </h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-3 flex items-center gap-2">
               <Command size={12}/> General
            </h4>
            <ShortcutRow keys={['Ctrl', 'F']} description="Focus Search" />
            <ShortcutRow keys={['Shift', '?']} description="Show Shortcuts" />
            <ShortcutRow keys={['Esc']} description="Close Modals" />
          </div>

          <div>
            <h4 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-3 flex items-center gap-2">
               <Command size={12}/> Navigation
            </h4>
            <ShortcutRow keys={['Alt', '1']} description="Variant Explainer" />
            <ShortcutRow keys={['Alt', '2']} description="Compensatory Design" />
            <ShortcutRow keys={['Alt', '3']} description="Disease Tracer" />
            <ShortcutRow keys={['Alt', '4']} description="Splicing Decoder" />
          </div>
        </div>

        <div className="p-4 bg-card/50 border-t border-muted/20 text-center">
           <p className="text-xs text-muted-foreground/40">
             Shortcuts are disabled when typing in text fields (except Ctrl+F/Esc).
           </p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;