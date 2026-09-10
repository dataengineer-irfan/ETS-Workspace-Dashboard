import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

interface AgeBin {
  bin: string;
  label: string;
  start: number;
  end: number;
  count: number;
  percentage: number;
}

interface AgeDistributionProps {
  data?: {
    stats: { median: number; mean: number; min: number; max: number; total: number };
    bins_3: AgeBin[];
    bins_2: AgeBin[];
    bins_5: AgeBin[];
  };
  onSelectAgeBin?: (start: number, end: number, label: string) => void;
}

export const AgeDistributionChart: React.FC<AgeDistributionProps> = ({
  data,
  onSelectAgeBin,
}) => {
  const [binSize, setBinSize] = useState<2 | 3 | 5>(3);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeBins = useMemo(() => {
    if (!data) return [];
    if (binSize === 2) return data.bins_2 || [];
    if (binSize === 5) return data.bins_5 || [];
    return data.bins_3 || [];
  }, [data, binSize]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...activeBins.map((b) => b.count));
  }, [activeBins]);

  // Color generator: interpolates from soft lilac (low) to deep purple/magenta (peak)
  const getBarColor = (count: number, isHovered: boolean) => {
    const ratio = count / maxCount;
    if (isHovered) return '#a855f7'; // Bright purple on hover
    if (ratio > 0.75) return '#7c3aed'; // Deep violet
    if (ratio > 0.45) return '#9333ea'; // Rich purple
    if (ratio > 0.2) return '#a855f7';  // Medium violet
    return '#c084fc';                   // Soft lilac
  };

  if (!data || activeBins.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        No age data available
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between select-none min-h-0">
      {/* Sub-header Controls: Bin Selector & Stats */}
      <div className="flex items-center justify-between px-1 pb-1 shrink-0 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Bin Size:</span>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200/80 dark:border-slate-700/80">
            {([2, 3, 5] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setBinSize(sz)}
                className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  binSize === sz
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {sz}y
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-500 dark:text-slate-400">
            Median: <strong className="text-purple-600 dark:text-purple-400 font-bold">{data.stats.median} Yrs</strong>
          </span>
          <span className="text-slate-400 dark:text-slate-500">·</span>
          <span className="text-slate-500 dark:text-slate-400">
            Span: <strong className="text-slate-700 dark:text-slate-300 font-bold">{data.stats.min} – {data.stats.max}</strong>
          </span>
        </div>
      </div>

      {/* Main Histogram Chart */}
      <div className="flex-1 min-h-0 pt-0.5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activeBins}
            margin={{ top: 14, right: 2, left: -24, bottom: 0 }}
            barCategoryGap={binSize === 2 ? 1 : 2}
          >
            <XAxis
              dataKey="bin"
              tick={{ fill: 'var(--text-muted, #94a3b8)', fontSize: binSize === 2 ? 8 : 9 }}
              axisLine={{ stroke: 'var(--border, #cbd5e1)' }}
              tickLine={false}
              interval={binSize === 2 ? 1 : 0}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted, #94a3b8)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface, #1e293b)',
                borderColor: 'var(--border, #334155)',
                borderRadius: '8px',
                fontSize: '11px',
                boxShadow: 'var(--shadow-soft, 0 4px 6px -1px rgba(0,0,0,0.1))',
              }}
              formatter={(value: any, _: any, item: any) => [
                `${value} Staff (${item.payload.percentage}%)`,
                `Age Bracket: ${item.payload.label}`,
              ]}
            />
            <Bar
              dataKey="count"
              radius={[3, 3, 0, 0]}
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(entry: any) => {
                if (entry && onSelectAgeBin) {
                  onSelectAgeBin(entry.start, entry.end, entry.label);
                }
              }}
              className="cursor-pointer"
            >
              {/* Value label on top of bars */}
              <LabelList
                dataKey="count"
                position="top"
                formatter={(val: any) => (val > 0 ? val : '')}
                style={{
                  fontSize: binSize === 2 ? '7.5px' : '8.5px',
                  fontWeight: 'bold',
                  fill: 'var(--text, #64748b)',
                }}
              />
              {activeBins.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.count, hoveredIndex === index)}
                  stroke={hoveredIndex === index ? '#ffffff' : 'none'}
                  strokeWidth={hoveredIndex === index ? 1.5 : 0}
                  className="transition-all duration-150"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Density Legend */}
      <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <span>Density:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#c084fc]" />
            <span className="text-[8.5px]">Low</span>
            <span className="w-6 h-1.5 rounded-full bg-gradient-to-r from-[#c084fc] via-[#9333ea] to-[#6b21a8]" />
            <span className="text-[8.5px]">Peak</span>
            <span className="w-2 h-2 rounded-xs bg-[#6b21a8]" />
          </div>
        </div>
        <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
          {data.stats.total} Employees Analyzed
        </span>
      </div>
    </div>
  );
};
