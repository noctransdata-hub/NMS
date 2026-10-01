import React from 'react';

interface StatusBadgeProps {
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR' | 'DISABLED' | 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED' | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'md' }) => {
  const normalized = status?.toUpperCase() || 'UNKNOWN';

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let dotColor = 'bg-slate-400';

  if (normalized === 'ONLINE' || normalized === 'CLEARED' || normalized === 'UP' || normalized === 'CONNECTED') {
    colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60 shadow-xs shadow-emerald-900/20';
    dotColor = 'bg-emerald-400 animate-pulse';
  } else if (normalized === 'OFFLINE' || normalized === 'CRITICAL' || normalized === 'DOWN' || normalized === 'FAULT') {
    colorClasses = 'bg-rose-950/80 text-rose-300 border-rose-800/60 shadow-xs shadow-rose-900/20';
    dotColor = 'bg-rose-400';
  } else if (normalized === 'ERROR' || normalized === 'MAJOR' || normalized === 'UNREACHABLE') {
    colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-800/60';
    dotColor = 'bg-amber-400';
  } else if (normalized === 'UNKNOWN' || normalized === 'PLANNING' || normalized === 'ACKNOWLEDGED') {
    colorClasses = 'bg-sky-950/80 text-sky-300 border-sky-800/60';
    dotColor = 'bg-sky-400';
  } else if (normalized === 'DISABLED' || normalized === 'MAINTENANCE') {
    colorClasses = 'bg-slate-900 text-slate-400 border-slate-800';
    dotColor = 'bg-slate-500';
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs tracking-wide';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${paddingClass} ${colorClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label || normalized}</span>
    </span>
  );
};
