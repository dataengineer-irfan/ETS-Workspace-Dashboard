import React, { useState } from 'react';
import { UserCheck, Briefcase, GraduationCap } from 'lucide-react';

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

// Enterprise executive palette (Synchronized with ETS Blue / Cyan / Indigo dashboard theme)
const PALETTE: Record<string, { color: string; bg: string; text: string; hoverBg: string; activeText: string }> = {
  Permanent: {
    color: '#2563eb', // Royal Blue (Core Permanent Staff)
    bg: 'bg-blue-500/10 dark:bg-blue-400/10',
    text: 'text-blue-600 dark:text-blue-400',
    hoverBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    activeText: 'text-blue-600 dark:text-blue-400',
  },
  Contract: {
    color: '#0284c7', // Sky Blue / Cyan (Specialist Technical Contractors)
    bg: 'bg-sky-500/10 dark:bg-sky-400/10',
    text: 'text-sky-600 dark:text-sky-400',
    hoverBg: 'bg-sky-500/10 dark:bg-sky-500/15',
    activeText: 'text-sky-600 dark:text-sky-400',
  },
  Intern: {
    color: '#6366f1', // Indigo (Graduate Interns & Trainees)
    bg: 'bg-indigo-500/10 dark:bg-indigo-400/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    hoverBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    activeText: 'text-indigo-600 dark:text-indigo-400',
  },
};

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
        return <UserCheck className="w-3.5 h-3.5" />;
      case 'contract':
        return <Briefcase className="w-3.5 h-3.5" />;
      case 'intern':
      default:
        return <GraduationCap className="w-3.5 h-3.5" />;
    }
  };

  const typesWithColors = data.types.map((t) => ({
    ...t,
    color: PALETTE[t.type]?.color || t.color || '#2563eb',
    bg: PALETTE[t.type]?.bg || 'bg-blue-500/10',
    text: PALETTE[t.type]?.text || 'text-blue-600',
    hoverBg: PALETTE[t.type]?.hoverBg || 'bg-blue-500/10',
    activeText: PALETTE[t.type]?.activeText || 'text-blue-600',
  }));

  const primaryType = typesWithColors[0];

  return (
    <div className="w-full h-full flex flex-col justify-between select-none min-h-0">
      {/* Main Content Area: Left 4 Cols (Proportional Gauge) + Right 8 Cols (Slim Legend Rows) */}
      <div className="grid grid-cols-12 gap-2 flex-1 items-center min-h-[140px] py-1">
        
        {/* Left: Vertical Stacked Proportional Bar (4 cols) */}
        <div className="col-span-4 h-full flex items-center justify-center">
          <div className="relative w-11 h-[130px] rounded-lg overflow-hidden flex flex-col shadow-inner bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
            {typesWithColors.map((item) => {
              const isHov = hoveredType === item.type;
              return (
                <div
                  key={item.type}
                  style={{
                    height: `${Math.max(16, item.percentage)}%`,
                    backgroundColor: item.color,
                  }}
                  onMouseEnter={() => setHoveredType(item.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  onClick={() => onSelectType && onSelectType(item.type)}
                  className={`w-full flex items-center justify-center transition-all cursor-pointer relative group ${
                    isHov ? 'brightness-110 shadow-md ring-2 ring-white/60 z-10' : 'opacity-95'
                  }`}
                  title={`${item.label}: ${item.count} staff (${item.percentage}%)`}
                >
                  <span className="text-[10px] font-black text-white font-mono drop-shadow-xs select-none">
                    {Math.round(item.percentage)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Slim, High-Density Legend Rows (8 cols) - Matching Delivery Footprint & Diversity Spotlight */}
        <div className="col-span-8 flex flex-col justify-center gap-1.5 h-full pl-1 border-l border-slate-100 dark:border-slate-800/80">
          {typesWithColors.map((item) => {
            const isHov = hoveredType === item.type;
            return (
              <div
                key={item.type}
                onMouseEnter={() => setHoveredType(item.type)}
                onMouseLeave={() => setHoveredType(null)}
                onClick={() => onSelectType && onSelectType(item.type)}
                className={`px-2 py-1.5 rounded-lg transition-all cursor-pointer flex flex-col gap-1 ${
                  isHov
                    ? `${item.hoverBg} shadow-2xs`
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
                title={`Click to view ${item.label} workforce roster`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${item.bg} ${item.text}`}
                    >
                      {getIcon(item.type)}
                    </div>
                    <span
                      className={`font-semibold truncate text-[11px] ${
                        isHov
                          ? `${item.activeText} font-bold`
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  <div className="font-mono text-right shrink-0">
                    <b className="text-slate-900 dark:text-slate-100 text-xs">{item.count}</b>{' '}
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      ({item.percentage}%)
                    </span>
                  </div>
                </div>

                {/* Slim progress bar track */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-footer insight (Integrated cleanly with zero overflow) */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
        <span>Primary Workforce: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{primaryType?.label}</strong></span>
        <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
          {primaryType?.percentage}% core
        </span>
      </div>
    </div>
  );
};
