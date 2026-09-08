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
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
};

const ICON_BG_STYLES = {
  cyan: 'bg-cyan-50 text-cyan-600 border border-cyan-100',
  emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  amber: 'bg-amber-50 text-amber-600 border border-amber-100',
  purple: 'bg-purple-50 text-purple-600 border border-purple-100',
  rose: 'bg-rose-50 text-rose-600 border border-rose-100',
  blue: 'bg-blue-50 text-blue-600 border border-blue-100',
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
        dominant ? 'border-l-4 border-l-cyan-600 bg-cyan-50/20 shadow-sm' : ''
      } ${onClick ? 'cursor-pointer hover:border-cyan-400 hover:shadow-sm' : ''}`}
      style={{
        background: dominant 
          ? 'linear-gradient(180deg, rgba(240,253,250,0.95), var(--surface))' 
          : 'linear-gradient(180deg, rgba(255,255,255,0.96), var(--surface))',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'linear-gradient(90deg, rgba(14,165,233,0.9), rgba(59,130,246,0.3), transparent)' }} />
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-bold tracking-[0.08em] uppercase ${dominant ? 'text-cyan-900' : ''}`} style={{ color: dominant ? undefined : 'var(--muted)' }}>
          {title}
        </span>
        <div className={`rounded-md flex items-center justify-center shrink-0 ${dominant ? 'w-7 h-7' : 'w-6 h-6'} ${ICON_BG_STYLES[badgeColor]}`}>
          <Icon className={dominant ? 'w-4 h-4' : 'w-3 h-3'} />
        </div>
      </div>

      <div className="my-1 flex items-baseline justify-between gap-2">
        <span 
          className={`font-black tracking-tight font-mono ${dominant ? 'text-2xl lg:text-3xl text-cyan-950' : 'text-lg'}`} 
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
          {trend && <span className="text-emerald-600 font-bold font-mono shrink-0">{trend}</span>}
        </div>
      )}
    </div>
  );
};
