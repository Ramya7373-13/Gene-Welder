import React, { createContext, useContext, useRef, useCallback } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export const Tabs: React.FC<{
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}> = ({ value, onValueChange, children, className }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}> = ({ children, className, 'aria-label': ariaLabel }) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow-key keyboard navigation between tabs
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not([disabled])');
    if (!tabs || tabs.length === 0) return;

    const tabsArray = Array.from(tabs);
    const focused = document.activeElement as HTMLButtonElement;
    const idx = tabsArray.indexOf(focused);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      tabsArray[(idx + 1) % tabsArray.length]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      tabsArray[(idx - 1 + tabsArray.length) % tabsArray.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      tabsArray[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      tabsArray[tabsArray.length - 1]?.focus();
    }
  }, []);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex p-1 bg-slate-900/60 rounded-xl border border-slate-800/80 backdrop-blur-sm ${className ?? ''}`}
    >
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}> = ({ value, children, className, icon }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => context.onValueChange(value)}
      className={[
        'relative flex-1 flex items-center justify-center gap-1.5',
        'px-4 py-2.5 text-sm font-medium rounded-lg',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900',
        isActive
          ? 'bg-cyan-400 text-slate-900 font-semibold shadow-lg shadow-cyan-400/20'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700',
        className ?? '',
      ].join(' ')}
    >
      {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className }) => {
  const context = useContext(TabsContext);
  if (!context) return null;

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={`animate-in fade-in slide-in-from-bottom-2 duration-200 focus:outline-none ${className ?? ''}`}
    >
      {children}
    </div>
  );
};
