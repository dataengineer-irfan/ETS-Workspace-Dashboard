import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

export interface ProjectTrend {
  project: string;
  beginning: number;
  end: number;
  net_change: number;
  growth_pct: number;
  current_active: number;
}

interface ProjectComparisonChartProps {
  data?: ProjectTrend[];
  onSelectProject?: (project: string) => void;
}

export const ProjectComparisonChart: React.FC<ProjectComparisonChartProps> = ({
  data = [],
  onSelectProject,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        No project headcount trend data available
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between select-none min-h-0">
      {/* Main Grouped Bar Chart */}
      <div className="flex-1 min-h-0 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 8, left: -22, bottom: 0 }}
            barCategoryGap="24%"
            barGap={3}
          >
            <XAxis
              dataKey="project"
              tick={{ fill: 'var(--text-muted, #94a3b8)', fontSize: 10, fontWeight: 600 }}
              axisLine={{ stroke: 'var(--border, #cbd5e1)' }}
              tickLine={false}
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
              formatter={(value: any, name: any) => [
                `${value} Staff`,
                name === 'beginning' ? 'Beginning of the Year' : 'End of the Year',
              ]}
              labelFormatter={(label) => `Project: ${label}`}
            />

            {/* Beginning of Year Bar (Indigo - vibrant in light & dark mode) */}
            <Bar
              dataKey="beginning"
              name="beginning"
              fill="#6366f1"
              radius={[3, 3, 0, 0]}
              onClick={(entry: any) => onSelectProject && onSelectProject(entry.project)}
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              <LabelList
                dataKey="beginning"
                position="top"
                style={{ fontSize: '9px', fontWeight: 'bold', fill: '#6366f1' }}
              />
            </Bar>

            {/* End of Year Bar (Cyan - bright and high-contrast) */}
            <Bar
              dataKey="end"
              name="end"
              fill="#06b6d4"
              radius={[3, 3, 0, 0]}
              onClick={(entry: any) => onSelectProject && onSelectProject(entry.project)}
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              <LabelList
                dataKey="end"
                position="top"
                style={{ fontSize: '9px', fontWeight: 'bold', fill: '#06b6d4' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend matching standard ETS subfooter */}
      <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#6366f1]" />
            <span className="text-slate-700 dark:text-slate-300 font-medium text-[9.5px]">Start of Year</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#06b6d4]" />
            <span className="text-slate-700 dark:text-slate-300 font-medium text-[9.5px]">End of Year</span>
          </div>
        </div>

        <div className="font-mono text-[9.5px] text-cyan-600 dark:text-cyan-400 font-bold">
          {data.length} Projects Tracked
        </div>
      </div>
    </div>
  );
};
