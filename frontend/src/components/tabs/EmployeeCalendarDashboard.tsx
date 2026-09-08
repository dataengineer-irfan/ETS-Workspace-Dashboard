import React, { useState } from 'react';
import type { CalendarData } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { 
  CalendarDays, 
  Users, 
  Clock,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

interface EmployeeCalendarDashboardProps {
  data: CalendarData | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

const LEAVE_COLORS: { [key: string]: string } = {
  'Casual / Sick': '#0284c7',
  'Privilege': '#10b981',
  'LOP': '#f43f5e',
  'Maternity': '#ec4899',
  'Paternity': '#8b5cf6',
  'Bereavement': '#64748b',
};

const PROJECT_NAMES: Record<string, string> = {
  NH: 'New Hampshire (NH)',
  ND: 'North Dakota (ND)',
  AK: 'Alaska (AK)',
  Other: 'Special Projects',
};

const PROJECT_COLORS = ['#0284c7', '#0d9488', '#d97706', '#8b5cf6'];

export const EmployeeCalendarDashboard: React.FC<EmployeeCalendarDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2024-01-16');
  const [matrixSearch, setMatrixSearch] = useState<string>('');
  const [matrixSortField, setMatrixSortField] = useState<string>('location');
  const [matrixSortDir, setMatrixSortDir] = useState<'asc' | 'desc'>('asc');

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Attendance & Leave Schedules...</span>
        </div>
      </div>
    );
  }

  const toggleMatrixSort = (field: string) => {
    if (matrixSortField === field) {
      setMatrixSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setMatrixSortField(field);
      setMatrixSortDir('asc');
    }
  };

  const MatrixSortIcon = ({ field }: { field: string }) => {
    if (matrixSortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return matrixSortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  const sortedLocations = (data.geography_grade_matrix.locations || [])
    .filter((loc) => !matrixSearch.trim() || loc.toLowerCase().includes(matrixSearch.toLowerCase().trim()))
    .sort((a, b) => {
      if (matrixSortField === 'location') {
        return matrixSortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }
      if (matrixSortField === 'total') {
        const aTotal = Object.values(data.geography_grade_matrix.matrix[a] || {}).reduce((x, y) => x + y, 0);
        const bTotal = Object.values(data.geography_grade_matrix.matrix[b] || {}).reduce((x, y) => x + y, 0);
        return matrixSortDir === 'asc' ? aTotal - bTotal : bTotal - aTotal;
      }
      const aVal = (data.geography_grade_matrix.matrix[a] || {})[matrixSortField] || 0;
      const bVal = (data.geography_grade_matrix.matrix[b] || {})[matrixSortField] || 0;
      return matrixSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const eventsOnSelectedDate = (data.events || []).filter(
    (ev) => ev.start <= selectedDate && ev.end >= selectedDate
  );

  const daysInJan = Array.from({ length: 31 }, (_, i) => i + 1);

  // Project distribution with expanded labels
  const formattedProjects = (data.project_distribution || []).map((p) => ({
    ...p,
    fullName: PROJECT_NAMES[p.project] || p.project,
  }));

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* Leadership Brief Banner */}
      <div 
        className="rounded-xl border p-2.5 shrink-0" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(14,116,144,0.08), rgba(168,85,247,0.04), rgba(255,255,255,0.2), var(--surface))', 
          borderColor: 'var(--border)', 
          boxShadow: 'var(--shadow-soft)' 
        }}
      >
        <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Attendance Health</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-100 text-cyan-800 border border-cyan-300">
                ● CONTROLLED OPERATIONAL IMPACT
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Month: January 2024
              </span>
            </div>

            {/* 3 Concise Bullet Insights */}
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-cyan-900 block truncate">Monthly Leave Rate</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">January leave rate held steady at 13.2%</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-purple-900 block truncate">Volume Concentration</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Casual & Sick accounts for 64% of leaves</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-rose-900 block truncate">Peak Absenteeism</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Peak absence observed on Jan 16 (12 on leave)</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500">Leave Ratio</span>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">Leave Rate</span>
                <span className="text-sm font-black text-cyan-800 font-mono">13.2%</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Days</span>
                <span className="text-sm font-black text-slate-900 font-mono">{data.total_leave_days}d</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards (Dominant Unique Employees on Leave) */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          dominant={true}
          title="Employees On Leave"
          value={data.unique_employees_on_leave}
          subtitle="78 Staff · 13.2% Workforce Leave Rate"
          icon={Users}
          badge="13.2% Rate"
          badgeColor="cyan"
        />
        <KPICard
          title="Total Leave Days"
          value={`${data.total_leave_days} Days`}
          subtitle="January logged absence duration"
          icon={CalendarDays}
          badge="Utilization"
          badgeColor="emerald"
        />
        <KPICard
          title="Primary Leave Type"
          value="Casual / Sick"
          subtitle="64% of total time-off requests"
          icon={Clock}
          badge="Predominant"
          badgeColor="purple"
        />
        <KPICard
          title="Average Duration"
          value="1.0 Day"
          subtitle="Average time-off length per incident"
          icon={CalendarDays}
          badge="Average"
          badgeColor="amber"
        />
      </div>

      {/* Middle Grid: Interactive Visual Calendar with Heatmap + Daily Inspector + Project Spread */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left 5 cols: Interactive Visual Calendar Grid with Heatmap Overlay */}
        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-xs font-bold text-slate-800 tracking-tight">Leave Heatmap Calendar (Jan 2024)</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono">Intensity: Heat Colored</span>
          </div>

          <div className="flex-1 flex flex-col justify-between my-1">
            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 border-b border-slate-100 pb-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-slate-400">Sat</span>
              <span className="text-slate-400">Sun</span>
            </div>

            {/* Calendar Days with Heat Intensity */}
            <div className="grid grid-cols-7 gap-1 flex-1 py-1">
              {daysInJan.map((d) => {
                const dateStr = `2024-01-${String(d).padStart(2, '0')}`;
                const count = data.daily_leave_counts?.[dateStr] || 0;
                const isSelected = selectedDate === dateStr;

                // Color cell based on leave intensity
                let heatStyle = 'bg-slate-50 text-slate-600 hover:bg-slate-100';
                if (count >= 10) {
                  heatStyle = 'bg-rose-100 border border-rose-300 text-rose-900 font-bold hover:bg-rose-200';
                } else if (count >= 5) {
                  heatStyle = 'bg-amber-100 border border-amber-300 text-amber-900 font-bold hover:bg-amber-200';
                } else if (count > 0) {
                  heatStyle = 'bg-cyan-50 border border-cyan-200 text-cyan-900 font-semibold hover:bg-cyan-100';
                }

                if (isSelected) {
                  heatStyle = 'bg-cyan-600 text-white font-bold ring-2 ring-cyan-500 shadow-xs';
                }

                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-7 rounded flex flex-col items-center justify-center relative text-[11px] font-mono transition-all ${heatStyle}`}
                    title={`${dateStr}: ${count} on leave`}
                  >
                    <span>{d}</span>
                    {count > 0 && !isSelected && (
                      <span className={`w-1 h-1 rounded-full absolute bottom-0.5 ${count >= 5 ? 'bg-rose-600' : 'bg-cyan-600'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 shrink-0 font-medium">
            <span>Selected Date: <strong className="text-slate-900 font-mono">{selectedDate}</strong></span>
            <span><b>{eventsOnSelectedDate.length}</b> staff on leave</span>
          </div>
        </div>

        {/* Center 4 cols: Daily Roster on Selected Date */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 tracking-tight">On Leave: {selectedDate}</span>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-mono font-semibold">
              {eventsOnSelectedDate.length} Records
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar my-1 flex flex-col gap-1.5">
            {eventsOnSelectedDate.length > 0 ? (
              eventsOnSelectedDate.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (onOpenEmployeeProfile) {
                      onOpenEmployeeProfile(ev.employee_number);
                    } else {
                      onSelectEmployee(ev.employee_number);
                    }
                  }}
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-cyan-400 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-cyan-700">{ev.employee_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{ev.department} · {ev.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span 
                      className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                      style={{ 
                        color: LEAVE_COLORS[ev.leave_type] || '#0284c7',
                        borderColor: `${LEAVE_COLORS[ev.leave_type] || '#0284c7'}50`,
                        backgroundColor: `${LEAVE_COLORS[ev.leave_type] || '#0284c7'}15`
                      }}
                    >
                      {ev.leave_type}
                    </span>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{ev.days} Day(s)</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                <p>No leaves recorded for this date.</p>
                <p className="text-[10px] text-slate-500 mt-1">Full workforce active.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 3 cols: Workforce by Project Working Pie with Acronym Expansions */}
        <div className="col-span-3 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 tracking-tight">Project Working Spread</span>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-semibold">Distribution</span>
          </div>

          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formattedProjects}
                  cx="50%"
                  cy="50%"
                  innerRadius="48%"
                  outerRadius="72%"
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="fullName"
                >
                  {formattedProjects.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PROJECT_COLORS[index % PROJECT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 shrink-0 text-center">
            {formattedProjects.slice(0, 3).map((p, i) => (
              <div key={p.project} className="p-1 rounded bg-slate-50 border border-slate-200">
                <p className="text-[9px] text-slate-600 truncate font-bold">{p.project}</p>
                <p className="text-[11px] font-bold text-slate-900 font-mono" style={{ color: PROJECT_COLORS[i] }}>{p.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Breakdown of Workforce by Geography and Job Level (Pivot Table) */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 h-40 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 tracking-tight">Workforce Breakdown by Geography and Job Level</span>
            <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 font-semibold">Cross-Tabulation Matrix</span>
          </div>

          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search location..."
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-44 hover:border-slate-300 transition-colors leading-none"
            />
            {matrixSearch && (
              <button
                onClick={() => setMatrixSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar my-0.5">
          <table className="w-full text-left text-[11px] text-slate-700">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
              <tr>
                <th className="py-0.5 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleMatrixSort('location')}>
                  <div className="flex items-center gap-0.5">Location <MatrixSortIcon field="location" /></div>
                </th>
                {data.geography_grade_matrix.grades.map((g) => (
                  <th key={g} className="py-0.5 px-1.5 text-center cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleMatrixSort(g)}>
                    <div className="flex items-center justify-center gap-0.5">{g} <MatrixSortIcon field={g} /></div>
                  </th>
                ))}
                <th className="py-0.5 px-2 text-right font-bold text-slate-900 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleMatrixSort('total')}>
                  <div className="flex items-center justify-end gap-0.5">Total <MatrixSortIcon field="total" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {sortedLocations.length > 0 ? (
                sortedLocations.map((loc) => {
                  const row = data.geography_grade_matrix.matrix[loc] || {};
                  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={loc} className="hover:bg-slate-50/80">
                      <td className="py-0.5 px-2 font-sans text-slate-900 font-medium">{loc}</td>
                      {data.geography_grade_matrix.grades.map((g) => (
                        <td key={g} className="py-0.5 px-1.5 text-center">
                          {row[g] || '-'}
                        </td>
                      ))}
                      <td className="py-0.5 px-2 text-right font-bold text-cyan-700">{rowTotal}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={data.geography_grade_matrix.grades.length + 2} className="py-4 text-center text-slate-400 text-xs font-sans">
                    No matching locations found for "{matrixSearch}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
