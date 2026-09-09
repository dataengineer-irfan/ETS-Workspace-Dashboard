import React, { useState } from 'react';
import type { CalendarData, FilterParams } from '../../types/dashboard';
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
  filters?: FilterParams;
  setFilters?: React.Dispatch<React.SetStateAction<FilterParams>>;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  filters,
  setFilters,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const activeYear = React.useMemo(() => {
    if (filters?.year) {
      const yVal = Array.isArray(filters.year) ? filters.year[0] : filters.year;
      if (yVal && !isNaN(Number(yVal))) return Number(yVal);
    }
    if (filters?.date) {
      const parsed = new Date(filters.date);
      if (!isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return 2024;
  }, [filters?.year, filters?.date]);

  const activeMonthIdx = React.useMemo(() => {
    if (filters?.month) {
      const mVal = Array.isArray(filters.month) ? filters.month[0] : filters.month;
      const mIdx = MONTH_SHORT.findIndex(m => m.toLowerCase() === String(mVal).toLowerCase().slice(0, 3));
      if (mIdx !== -1) return mIdx;
    }
    if (filters?.date) {
      const parsed = new Date(filters.date);
      if (!isNaN(parsed.getTime())) return parsed.getMonth();
    }
    return 0;
  }, [filters?.month, filters?.date]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (filters?.date) return filters.date;
    return '2024-01-16';
  });

  React.useEffect(() => {
    if (filters?.date) {
      setSelectedDate(filters.date);
    } else {
      const prefix = `${activeYear}-${String(activeMonthIdx + 1).padStart(2, '0')}`;
      if (!selectedDate.startsWith(prefix)) {
        setSelectedDate(`${prefix}-${activeYear === 2024 && activeMonthIdx === 0 ? '16' : '01'}`);
      }
    }
  }, [filters?.date, activeYear, activeMonthIdx]);

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

  const daysInMonthCount = new Date(activeYear, activeMonthIdx + 1, 0).getDate();
  const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
  const firstDayWeekday = (new Date(activeYear, activeMonthIdx, 1).getDay() + 6) % 7;

  const handleSelectDay = (d: number) => {
    const dateStr = `${activeYear}-${String(activeMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  const formattedProjects = (data.project_distribution || []).map((p) => ({
    ...p,
    fullName: PROJECT_NAMES[p.project] || p.project,
  }));

  const primaryLeaveType = data.leave_type_breakdown?.[0]?.leave_type || 'Casual / Sick';
  const primaryLeaveDays = data.leave_type_breakdown?.[0]?.total_days || 0;
  const primaryLeavePct = data.total_leave_days > 0 ? Math.round((primaryLeaveDays / data.total_leave_days) * 100) : 0;
  const avgDurationStr = data.unique_employees_on_leave > 0 ? (data.total_leave_days / data.unique_employees_on_leave).toFixed(1) : '0.0';

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      <div 
        className="rounded-xl border p-2.5 shrink-0" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(14,116,144,0.08), rgba(168,85,247,0.04), var(--panel), var(--surface))', 
          borderColor: 'var(--border)', 
          boxShadow: 'var(--shadow-soft)' 
        }}
      >
        <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 dark:text-slate-400">Attendance Health</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                ● CONTROLLED OPERATIONAL IMPACT
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Month: {MONTH_NAMES[activeMonthIdx]} {activeYear}
              </span>
            </div>

            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                <span className="font-bold text-cyan-900 dark:text-cyan-300 block truncate">Monthly Leave Rate</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{MONTH_NAMES[activeMonthIdx]} leave rate stands at {data.leave_rate_pct}%</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                <span className="font-bold text-purple-900 dark:text-purple-300 block truncate">Volume Concentration</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{primaryLeaveType} accounts for {primaryLeavePct}% of leaves</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                <span className="font-bold text-rose-900 dark:text-rose-300 block truncate">Workforce Impact</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{data.unique_employees_on_leave} staff logged {data.total_leave_days}d total absence</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Leave Ratio</span>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">Leave Rate</span>
                <span className="text-sm font-black text-cyan-800 dark:text-cyan-300 font-mono">{data.leave_rate_pct}%</span>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">Total Days</span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{data.total_leave_days}d</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          dominant={true}
          title="Employees On Leave"
          value={data.unique_employees_on_leave}
          subtitle={`${data.unique_employees_on_leave} Staff · ${data.leave_rate_pct}% Workforce Leave Rate`}
          icon={Users}
          badge={`${data.leave_rate_pct}% Rate`}
          badgeColor="cyan"
        />
        <KPICard
          title="Total Leave Days"
          value={`${data.total_leave_days} Days`}
          subtitle={`${MONTH_NAMES[activeMonthIdx]} logged absence duration`}
          icon={CalendarDays}
          badge="Utilization"
          badgeColor="emerald"
        />
        <KPICard
          title="Primary Leave Type"
          value={primaryLeaveType}
          subtitle={`${primaryLeavePct}% of total time-off requests`}
          icon={Clock}
          badge="Predominant"
          badgeColor="purple"
        />
        <KPICard
          title="Average Duration"
          value={`${avgDurationStr} Day`}
          subtitle="Average time-off length per incident"
          icon={CalendarDays}
          badge="Average"
          badgeColor="amber"
        />
      </div>

      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Leave Heatmap Calendar ({MONTH_SHORT[activeMonthIdx]} {activeYear})</span>
            </div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Intensity: Heat Colored</span>
          </div>

          <div className="flex-1 flex flex-col justify-between my-1">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-slate-400 dark:text-slate-500">Sat</span>
              <span className="text-slate-400 dark:text-slate-500">Sun</span>
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1 py-1">
              {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                <div key={`pad-${idx}`} className="h-7 rounded opacity-0 pointer-events-none" />
              ))}
              {daysInMonth.map((d) => {
                const dateStr = `${activeYear}-${String(activeMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const count = data.daily_leave_counts?.[dateStr] || 0;
                const isSelected = selectedDate === dateStr;

                let heatStyle = 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700';
                if (count >= 10) {
                  heatStyle = 'bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-bold hover:bg-rose-200 dark:hover:bg-rose-900';
                } else if (count >= 5) {
                  heatStyle = 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-200 dark:hover:bg-amber-900';
                } else if (count > 0) {
                  heatStyle = 'bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 font-semibold hover:bg-cyan-100 dark:hover:bg-cyan-900';
                }

                if (isSelected) {
                  heatStyle = 'bg-cyan-600 text-white font-bold ring-2 ring-cyan-500 shadow-xs';
                }

                return (
                  <button
                    key={d}
                    onClick={() => handleSelectDay(d)}
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

          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0 font-medium">
            <span>Selected Date: <strong className="text-slate-900 dark:text-slate-100 font-mono">{selectedDate}</strong></span>
            <span><b>{eventsOnSelectedDate.length}</b> staff on leave</span>
          </div>
        </div>

        {/* Center 4 cols: Daily Roster on Selected Date */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">On Leave: {selectedDate}</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 font-mono font-semibold">
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
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-cyan-700 dark:group-hover:text-cyan-400">{ev.employee_name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{ev.department} · {ev.location}</p>
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
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{ev.days} Day(s)</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-xs">
                <p>No leaves recorded for this date.</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Full workforce active.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 3 cols: Workforce by Project Working Pie with Acronym Expansions */}
        <div className="col-span-3 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Project Working Spread</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-semibold">Distribution</span>
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
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-soft)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0 text-center">
            {formattedProjects.slice(0, 3).map((p, i) => (
              <div key={p.project} className="p-1 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-[9px] text-slate-600 dark:text-slate-400 truncate font-bold">{p.project}</p>
                <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 font-mono" style={{ color: PROJECT_COLORS[i] }}>{p.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Breakdown of Workforce by Geography and Job Level (Pivot Table) */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 h-40 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Workforce Breakdown by Geography and Job Level</span>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold">Cross-Tabulation Matrix</span>
          </div>

          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search location..."
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-44 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
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
          <table className="w-full text-left text-[11px] text-slate-700 dark:text-slate-300">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-0.5 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleMatrixSort('location')}>
                  <div className="flex items-center gap-0.5">Location <MatrixSortIcon field="location" /></div>
                </th>
                {data.geography_grade_matrix.grades.map((g) => (
                  <th key={g} className="py-0.5 px-1.5 text-center cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleMatrixSort(g)}>
                    <div className="flex items-center justify-center gap-0.5">{g} <MatrixSortIcon field={g} /></div>
                  </th>
                ))}
                <th className="py-0.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleMatrixSort('total')}>
                  <div className="flex items-center justify-end gap-0.5">Total <MatrixSortIcon field="total" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {sortedLocations.length > 0 ? (
                sortedLocations.map((loc) => {
                  const row = data.geography_grade_matrix.matrix[loc] || {};
                  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={loc} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                      <td className="py-0.5 px-2 font-sans text-slate-900 dark:text-slate-100 font-medium">{loc}</td>
                      {data.geography_grade_matrix.grades.map((g) => (
                        <td key={g} className="py-0.5 px-1.5 text-center">
                          {row[g] || '-'}
                        </td>
                      ))}
                      <td className="py-0.5 px-2 text-right font-bold text-cyan-700 dark:text-cyan-400">{rowTotal}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={data.geography_grade_matrix.grades.length + 2} className="py-4 text-center text-slate-400 dark:text-slate-500 text-xs font-sans">
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
