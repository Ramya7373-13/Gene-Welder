import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  headline: string;
  subtext?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Extra class on the container */
  className?: string;
  /** Icon size in px — default 48 */
  iconSize?: number;
  /** 'normal' (default) or 'compact' for tighter panels */
  size?: 'normal' | 'compact';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  headline,
  subtext,
  action,
  className = '',
  iconSize = 48,
  size = 'normal',
}) => {
  const ActionIcon = action?.icon;

  return (
    <div
      className={[
        'ds-empty-state animate-in fade-in duration-300',
        size === 'compact' ? 'py-8 gap-2' : 'py-12 gap-3',
        className,
      ].join(' ')}
    >
      {/* Icon */}
      <div className="ds-empty-state-icon">
        <Icon size={iconSize} strokeWidth={1.5} aria-hidden="true" />
      </div>

      {/* Headline */}
      <p className="ds-empty-state-headline">
        {headline}
      </p>

      {/* Subtext */}
      {subtext && (
        <p className="ds-empty-state-subtext">
          {subtext}
        </p>
      )}

      {/* Optional CTA */}
      {action && (
        <button
          onClick={action.onClick}
          className={[
            'mt-2 inline-flex items-center gap-2',
            'px-4 py-2 rounded-lg text-sm font-semibold',
            'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400',
            'hover:bg-cyan-400/20 hover:border-cyan-400/50',
            'transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
            'active:scale-[0.97]',
          ].join(' ')}
        >
          {ActionIcon && <ActionIcon size={16} aria-hidden="true" />}
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
