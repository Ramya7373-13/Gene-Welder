import React from 'react';
import { Zap, AlertCircle } from 'lucide-react';

interface UsageBadgeProps {
  feature: string;
  used: number;
  limit: number;
  plan: string;
}

export default function UsageBadge({ feature, used, limit, plan }: UsageBadgeProps) {
  if (plan === 'pro') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
        <Zap size={12} />
        <span>Pro - Unlimited</span>
      </div>
    );
  }

  const remaining = Math.max(0, limit - used);
  const isLow = remaining <= 1;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
      isLow
        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
        : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
    }`}>
      {isLow ? <AlertCircle size={12} /> : <Zap size={12} />}
      <span>{remaining} of {limit} free uses left</span>
    </div>
  );
}
