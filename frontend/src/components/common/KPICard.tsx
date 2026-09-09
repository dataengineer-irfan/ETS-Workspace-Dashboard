import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' | 'blue';
  trend?: string;
  dominant?: boolean;
  onClick?: () => void;
}

const BADGE_STYLES = {
  cyan: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
};

const ICON_BG_STYLES = {
  cyan: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800',
  purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800',
  rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800',
  blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800',
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeColor = 'cyan',
  trend,
  dominant = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-xl p-2.5 flex flex-col justify-between transition-all relative overflow-hidden ${
        dominant ? 'border-l-4 border-l-cyan-600 shadow-sm' : ''
      } ${onClick ? 'cursor-pointer hover:border-cyan-400 hover:shadow-sm' : ''}`}
      style={{
        background: dominant 
          ? 'linear-gradient(180deg, var(--pill-bg), var(--surface))' 
          : 'linear-gradient(180deg, var(--panel), var(--surface))',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'linear-gradient(90deg, rgba(14,165,233,0.9), rgba(59,130,246,0.3), transparent)' }} />
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-bold tracking-[0.08em] uppercase ${dominant ? 'text-cyan-900 dark:text-cyan-300' : ''}`} style={{ color: dominant ? undefined : 'var(--muted)' }}>
          {title}
        </span>
        <div className={`rounded-md flex items-center justify-center shrink-0 ${dominant ? 'w-7 h-7' : 'w-6 h-6'} ${ICON_BG_STYLES[badgeColor]}`}>
          <Icon className={dominant ? 'w-4 h-4' : 'w-3 h-3'} />
        </div>
      </div>

      <div className="my-1 flex items-baseline justify-between gap-1 min-w-0">
        <span 
          title={typeof value === 'string' ? value : undefined}
          className={`font-black tracking-tight truncate ${
            dominant 
              ? 'text-2xl lg:text-3xl text-cyan-950 dark:text-cyan-200 font-mono' 
              : typeof value === 'string' && value.length > 16
              ? 'text-xs font-sans font-bold'
              : 'text-lg font-mono'
          }`} 
          style={{ color: dominant ? undefined : 'var(--text)' }}
        >
          {value}
        </span>
        {badge && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border font-mono ${BADGE_STYLES[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center justify-between text-[10px] font-medium pt-1 border-t" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
          <span className="truncate">{subtitle}</span>
          {trend && <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono shrink-0">{trend}</span>}
        </div>
      )}
    </div>
  );
};
