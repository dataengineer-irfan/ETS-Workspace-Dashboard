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
    <div className="w-full h-full flex flex-col justify-between select-none">
      {/* Sub-header Context */}
      <div className="flex items-center justify-between px-1 pb-1 shrink-0 text-[10px]">
        <span className="text-slate-500 dark:text-slate-400">
          Delivery Project Workforce Dynamics
        </span>
        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 text-[9px]">
          Start vs End of Year
        </span>
      </div>

      {/* Main Grouped Bar Chart */}
      <div className="flex-1 min-h-[130px] pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 8, left: -22, bottom: 0 }}
            barCategoryGap="20%"
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
              formatter={(value: any, name: any, item: any) => [
                `${value} Staff`,
                name === 'beginning' ? 'Beginning of the Year' : 'End of the Year',
              ]}
              labelFormatter={(label) => `Project: ${label}`}
            />

            {/* Beginning of Year Bar (Dark Blue / Indigo) */}
            <Bar
              dataKey="beginning"
              name="beginning"
              fill="#1e40af"
              radius={[3, 3, 0, 0]}
              onClick={(entry: any) => onSelectProject && onSelectProject(entry.project)}
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              <LabelList
                dataKey="beginning"
                position="top"
                style={{ fontSize: '8.5px', fontWeight: 'bold', fill: '#3b82f6' }}
              />
            </Bar>

            {/* End of Year Bar (Vibrant Sky Blue) */}
            <Bar
              dataKey="end"
              name="end"
              fill="#38bdf8"
              radius={[3, 3, 0, 0]}
              onClick={(entry: any) => onSelectProject && onSelectProject(entry.project)}
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              <LabelList
                dataKey="end"
                position="top"
                style={{ fontSize: '8.5px', fontWeight: 'bold', fill: '#0284c7' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend matching reference */}
      <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#1e40af]" />
            <span>Beginning of the year</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#38bdf8]" />
            <span>End of the year</span>
          </div>
        </div>

        <div className="font-mono text-[9px] text-slate-400">
          {data.length} Projects Tracked
        </div>
      </div>
    </div>
  );
};
