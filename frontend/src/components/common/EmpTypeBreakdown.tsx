import React, { useState } from 'react';
import { UserCheck, Briefcase, GraduationCap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
        return <UserCheck className="w-2.5 h-2.5" />;
      case 'contract':
        return <Briefcase className="w-2.5 h-2.5" />;
      case 'intern':
      default:
        return <GraduationCap className="w-2.5 h-2.5" />;
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
  const activeHoveredItem = hoveredType ? typesWithColors.find((t) => t.type === hoveredType) : null;

  return (
    <div className="w-full h-full flex flex-col select-none min-h-0 min-w-0" data-composition>
      <div className="grid grid-cols-12 gap-1.5 flex-1 items-stretch min-h-0 min-w-0 py-0.5">
        <div className="col-span-5 h-full relative flex items-center justify-center min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typesWithColors}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="84%"
                paddingAngle={2}
                dataKey="count"
                isAnimationActive={false}
                onMouseEnter={(_, idx) => setHoveredType(typesWithColors[idx]?.type || null)}
                onMouseLeave={() => setHoveredType(null)}
                onClick={(entry: any) => onSelectType && onSelectType(entry.type)}
              >
                {typesWithColors.map((item) => (
                  <Cell
                    key={item.type}
                    fill={item.color}
                    stroke={hoveredType === item.type ? 'var(--text)' : 'var(--surface)'}
                    strokeWidth={hoveredType === item.type ? 2.5 : 1.5}
                    className="cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  boxShadow: 'var(--shadow-soft)',
                }}
                formatter={(val: any, _: any, p: any) => [`${val} Staff (${p.payload.percentage}%)`, p.payload.label]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
              {activeHoveredItem ? activeHoveredItem.count : (data.total || 590)}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-0.5 leading-none">
              {activeHoveredItem ? `${activeHoveredItem.percentage}%` : 'Total FTE'}
            </span>
          </div>
        </div>

        <div
          className="col-span-7 min-w-0 min-h-0 h-full grid content-stretch pl-1.5 border-l border-slate-100 dark:border-slate-800/80"
          style={{ gridTemplateRows: `repeat(${Math.max(typesWithColors.length, 1)}, minmax(0, 1fr))` }}
        >
          {typesWithColors.map((item) => {
            const isHov = hoveredType === item.type;
            return (
              <div
                key={item.type}
                onMouseEnter={() => setHoveredType(item.type)}
                onMouseLeave={() => setHoveredType(null)}
                onClick={() => onSelectType && onSelectType(item.type)}
                className={`min-w-0 min-h-0 px-1 rounded-md cursor-pointer flex flex-col justify-center gap-0.5 ${
                  isHov
                    ? `${item.hoverBg}`
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
                title={`Click to view ${item.label} workforce roster`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${item.bg} ${item.text}`}
                  >
                    {getIcon(item.type)}
                  </div>
                  <span
                    data-comp-name={item.label}
                    className={`block min-w-0 flex-1 text-[11px] font-semibold leading-tight whitespace-normal break-words ${
                      isHov ? `${item.activeText} font-bold` : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0 pl-5">
                  <span className="h-[3px] flex-1 min-w-0 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(4, Math.min(100, item.percentage))}%`, backgroundColor: item.color }}
                    />
                  </span>
                  <span data-comp-count={item.count} className="shrink-0 whitespace-nowrap font-mono text-[10px] leading-none tabular-nums text-slate-500 dark:text-slate-400">
                    <b className="text-slate-900 dark:text-slate-100">{item.count}</b>
                    <span className="ml-0.5">({item.percentage}%)</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 shrink-0 min-w-0">
        <span className="min-w-0 whitespace-normal">Primary: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{primaryType?.label}</strong></span>
        <span className="font-mono text-blue-600 dark:text-blue-400 font-bold shrink-0">
          {primaryType?.percentage}% core
        </span>
      </div>
    </div>
  );
};
