import React, { useState } from 'react';
import { Briefcase, UserCheck, GraduationCap } from 'lucide-react';

export interface EmpTypeItem {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  description?: string;
}

interface EmpTypeBreakdownProps {
  data?: {
    total: number;
    types: EmpTypeItem[];
  };
  onSelectType?: (type: string) => void;
}

export const EmpTypeBreakdown: React.FC<EmpTypeBreakdownProps> = ({
  data,
  onSelectType,
}) => {
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  if (!data || !data.types || data.types.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        No employment type data available
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'permanent':
        return <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'contract':
        return <Briefcase className="w-4 h-4 text-amber-500 dark:text-amber-300" />;
      case 'intern':
      default:
        return <GraduationCap className="w-4 h-4 text-amber-400 dark:text-amber-200" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between select-none">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-1 pb-1 shrink-0 text-[10px]">
        <span className="text-slate-500 dark:text-slate-400">
          Workforce Engagement Model
        </span>
        <span className="font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-bold text-[9px]">
          {data.total} Active Headcount
        </span>
      </div>

      {/* Main Content: Vertical Stacked Bar on Left (3 cols), Badges on Right (9 cols) */}
      <div className="flex-1 grid grid-cols-12 gap-3 items-center min-h-0 py-1">
        {/* Left: Vertical Stacked Proportional Bar (4 cols) */}
        <div className="col-span-4 h-full flex items-center justify-center">
          <div className="relative w-10 h-full max-h-[140px] rounded-lg overflow-hidden flex flex-col shadow-inner bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
            {data.types.map((item) => {
              const isHov = hoveredType === item.type;
              return (
                <div
                  key={item.type}
                  style={{
                    height: `${Math.max(12, item.percentage)}%`,
                    backgroundColor: item.color,
                  }}
                  onMouseEnter={() => setHoveredType(item.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  onClick={() => onSelectType && onSelectType(item.type)}
                  className={`w-full flex items-center justify-center transition-all cursor-pointer relative group ${
                    isHov ? 'brightness-110 shadow-md ring-2 ring-white/50 z-10' : 'opacity-90'
                  }`}
                  title={`${item.label}: ${item.count} staff (${item.percentage}%)`}
                >
                  <span className="text-[9px] font-black text-white/95 font-mono drop-shadow-xs select-none">
                    {Math.round(item.percentage)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Summary Badges (8 cols) */}
        <div className="col-span-8 flex flex-col justify-between gap-1.5 h-full">
          {data.types.map((item) => {
            const isHov = hoveredType === item.type;
            return (
              <div
                key={item.type}
                onMouseEnter={() => setHoveredType(item.type)}
                onMouseLeave={() => setHoveredType(null)}
                onClick={() => onSelectType && onSelectType(item.type)}
                className={`flex items-center justify-between p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isHov
                    ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-2xs scale-[1.02]'
                    : 'bg-slate-50/70 dark:bg-slate-850 border-slate-200/70 dark:border-slate-800/70 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-amber-100/70 dark:bg-amber-900/40 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                    {getIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 block truncate">
                      {item.label}
                    </span>
                    <span className="text-[8.5px] text-slate-400 block truncate">
                      {item.description || item.type}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                    {item.count}
                  </span>
                  <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-footer insight */}
      <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">
        <span>Permanent Core Ratio:</span>
        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
          {data.types.find((t) => t.type === 'Permanent')?.percentage || 0}% Staff
        </span>
      </div>
    </div>
  );
};
