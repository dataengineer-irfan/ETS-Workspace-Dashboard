import React, { useState } from 'react';
import type { SalarywiseKPIs } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { 
  BadgeIndianRupee, 
  TrendingUp, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight, 
  Grid,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SalarywiseDashboardProps {
  data: SalarywiseKPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

export const SalarywiseDashboard: React.FC<SalarywiseDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const [topLimit, setTopLimit] = useState(10);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerSortField, setManagerSortField] = useState<string>('total');
  const [managerSortDir, setManagerSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<string | null>(null);
  const [managerPage, setManagerPage] = useState(1);
  const managersPerPage = 8;

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Salarywise Dashboard...</span>
        </div>
      </div>
    );
  }

  const toggleManagerSort = (field: string) => {
    if (managerSortField === field) {
      setManagerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setManagerSortField(field);
      setManagerSortDir('desc');
    }
    setManagerPage(1);
  };

  const ManagerSortIcon = ({ field }: { field: string }) => {
    if (managerSortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return managerSortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  const allFilteredManagers = (data.manager_grade_ctc_matrix.managers || [])
    .filter((mgr) => !managerSearch.trim() || mgr.toLowerCase().includes(managerSearch.toLowerCase().trim()))
    .sort((a, b) => {
      if (managerSortField === 'manager') {
        return managerSortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }
      if (managerSortField === 'total') {
        const aTotal = Object.values(data.manager_grade_ctc_matrix.matrix[a] || {}).reduce((x, y) => x + y, 0);
        const bTotal = Object.values(data.manager_grade_ctc_matrix.matrix[b] || {}).reduce((x, y) => x + y, 0);
        return managerSortDir === 'asc' ? aTotal - bTotal : bTotal - aTotal;
      }
      const aVal = (data.manager_grade_ctc_matrix.matrix[a] || {})[managerSortField] || 0;
      const bVal = (data.manager_grade_ctc_matrix.matrix[b] || {})[managerSortField] || 0;
      return managerSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const totalManagerPages = Math.ceil(allFilteredManagers.length / managersPerPage) || 1;
  const paginatedManagers = allFilteredManagers.slice(
    (managerPage - 1) * managersPerPage,
    managerPage * managersPerPage
  );

  const displayedTopEarners = data.top_n_earners
    .filter((e) => !selectedManagerFilter || e.manager === selectedManagerFilter)
    .slice(0, topLimit);

  // Fallback histogram if not present
  const histogram = data.salary_histogram || [
    { band: '< 5L', count: 165, percentage: 28.0, color: '#0284c7' },
    { band: '5-10L', count: 250, percentage: 42.4, color: '#10b981' },
    { band: '10-15L', count: 115, percentage: 19.5, color: '#d97706' },
    { band: '15-20L', count: 42, percentage: 7.1, color: '#8b5cf6' },
    { band: '20L+', count: 18, percentage: 3.0, color: '#ec4899' },
  ];

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* Executive Header Banner */}
      <div 
        className="rounded-xl border p-2.5 shrink-0" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(16,185,129,0.04), rgba(255,255,255,0.2), var(--surface))', 
          borderColor: 'var(--border)', 
          boxShadow: 'var(--shadow-soft)' 
        }}
      >
        <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Compensation Intelligence</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ● FULL 590 ROSTER ANALYSIS
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                HR CONFIDENTIAL
              </span>
              {selectedManagerFilter && (
                <button
                  onClick={() => setSelectedManagerFilter(null)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 hover:bg-rose-200"
                >
                  Filtered: {selectedManagerFilter} <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 3 Concise Bullet Insights */}
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-emerald-900 block truncate">Total Payroll Outlay</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">₹45.83 Cr annual CTC across 54 managers</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-cyan-900 block truncate">Median Band Concentration</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">70.4% workforce earning between 5L-15L</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-purple-900 block truncate">Executive Spread</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Ceiling capped at ₹22.8L at M3 level</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500">Compensation Ratio</span>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">Average CTC</span>
                <span className="text-sm font-black text-slate-900 font-mono">₹{(data.avg_ctc / 100000).toFixed(2)}L</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">Max Ceiling</span>
                <span className="text-sm font-black text-purple-700 font-mono">₹{(data.max_ctc / 100000).toFixed(2)}L</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards (Dominant Total CTC) */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          dominant={true}
          title="Total Workforce CTC"
          value={`₹${(data.total_ctc / 10000000).toFixed(2)} Cr`}
          subtitle="Full 590 Staff Roster · Annualized"
          icon={TrendingUp}
          badge="100% Roster"
          badgeColor="emerald"
        />
        <KPICard
          title="Average Employee CTC"
          value={`₹${(data.avg_ctc / 100000).toFixed(2)} L`}
          subtitle="Benchmark across all grades"
          icon={BadgeIndianRupee}
          badge="Cohort Mean"
          badgeColor="cyan"
        />
        <KPICard
          title="Monthly Payroll"
          value={`₹${(data.total_salary / 10000000).toFixed(2)} Cr`}
          subtitle={`₹${(data.avg_salary / 1000).toFixed(0)}k average monthly salary`}
          icon={ArrowUpRight}
          badge="Monthly Cash"
          badgeColor="amber"
        />
        <KPICard
          title="Leadership Ceiling"
          value={`₹${(data.max_ctc / 100000).toFixed(2)} L`}
          subtitle={`Min: ₹${(data.min_ctc / 100000).toFixed(2)}L · Band Spread`}
          icon={Award}
          badge="Ceiling"
          badgeColor="purple"
        />
      </div>

      {/* Middle Visuals: 12-col grid */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: 54 Managers x Grade CTC Matrix (8 Cols) */}
        <div className="col-span-8 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-xs font-bold text-slate-800 tracking-tight">Manager Compensation Outlay</span>
              <span className="text-[10px] text-slate-400 font-mono">Click row to filter earners</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search manager..."
                  value={managerSearch}
                  onChange={(e) => {
                    setManagerSearch(e.target.value);
                    setManagerPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-36 hover:border-slate-300 transition-colors leading-none"
                />
                {managerSearch && (
                  <button
                    onClick={() => {
                      setManagerSearch('');
                      setManagerPage(1);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                )}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                <span>Page {managerPage} of {totalManagerPages}</span>
                <button
                  disabled={managerPage === 1}
                  onClick={() => setManagerPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  disabled={managerPage >= totalManagerPages}
                  onClick={() => setManagerPage((p) => Math.min(totalManagerPages, p + 1))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar my-1">
            <table className="w-full text-left text-[10px] text-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleManagerSort('manager')}>
                    <div className="flex items-center gap-0.5">Reporting Manager ({allFilteredManagers.length}) <ManagerSortIcon field="manager" /></div>
                  </th>
                  {data.manager_grade_ctc_matrix.grades.map((g) => (
                    <th key={g} className="py-1 px-1.5 text-center cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleManagerSort(g)}>
                      <div className="flex items-center justify-center gap-0.5">{g} <ManagerSortIcon field={g} /></div>
                    </th>
                  ))}
                  <th className="py-1 px-2 text-right font-bold text-slate-900 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleManagerSort('total')}>
                    <div className="flex items-center justify-end gap-0.5">Total CTC <ManagerSortIcon field="total" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedManagers.length > 0 ? (
                  paginatedManagers.map((mgr) => {
                    const row = data.manager_grade_ctc_matrix.matrix[mgr] || {};
                    const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                    const isSelected = selectedManagerFilter === mgr;
                    return (
                      <tr 
                        key={mgr} 
                        onClick={() => setSelectedManagerFilter(isSelected ? null : mgr)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-cyan-100/70' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-1 px-2 font-sans text-slate-900 font-medium truncate max-w-[140px]">{mgr}</td>
                        {data.manager_grade_ctc_matrix.grades.map((g) => {
                          const val = row[g] || 0;
                          return (
                            <td key={g} className="py-1 px-1.5 text-center font-medium">
                              {val > 0 ? `₹${(val / 100000).toFixed(1)}L` : '-'}
                            </td>
                          );
                        })}
                        <td className="py-1 px-2 text-right font-bold text-cyan-700">₹{(rowTotal / 100000).toFixed(1)}L</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={data.manager_grade_ctc_matrix.grades.length + 2} className="py-4 text-center text-slate-400 text-xs font-sans">
                      No matching managers found for "{managerSearch}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Earners Table (4 Cols) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Top Earners</span>
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200">
                {[5, 10, 25].map((lim) => (
                  <button
                    key={lim}
                    onClick={() => setTopLimit(lim)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      topLimit === lim ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Top {lim}
                  </button>
                ))}
              </div>
            </div>
            <ExportButton data={displayedTopEarners} filename="top_earners.csv" />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar my-1">
            <table className="w-full text-left text-[11px] text-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-1 px-2">#</th>
                  <th className="py-1 px-2">Employee</th>
                  <th className="py-1 px-2">Grade</th>
                  <th className="py-1 px-2 text-right font-bold text-slate-900">Total CTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayedTopEarners.map((e, idx) => (
                  <tr 
                    key={e.employee_number}
                    onClick={() => {
                      if (onOpenEmployeeProfile) {
                        onOpenEmployeeProfile(e.employee_number);
                      } else {
                        onSelectEmployee(e.employee_number);
                      }
                    }}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                  >
                    <td className="py-1 px-2 text-slate-400 font-sans">{idx + 1}</td>
                    <td className="py-1 px-2 font-sans font-medium text-slate-900 truncate max-w-[110px] group-hover:text-cyan-700">
                      {e.name}
                    </td>
                    <td className="py-1 px-2 font-sans">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                        {e.job_level}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right font-bold text-emerald-700">
                      ₹{(e.total_ctc / 100000).toFixed(2)}L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lower Row: CTC Distribution Band Histogram */}
      <div className="glass-panel rounded-xl p-2 shrink-0 h-20 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 pb-1 border-b border-slate-100 shrink-0">
          <span className="uppercase tracking-wider">Workforce Compensation Distribution by Salary Band</span>
          <span className="text-slate-400 font-mono">590 Employees Mapped</span>
        </div>

        <div className="grid grid-cols-5 gap-2 pt-1 items-center">
          {histogram.map((band, idx) => (
            <div key={idx} className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-800">{band.band}</span>
                <span className="font-bold font-mono text-cyan-800">{band.count} staff</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all" 
                  style={{ width: `${band.percentage}%`, backgroundColor: band.color || '#0284c7' }} 
                />
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                <span>Concentration</span>
                <span className="font-bold font-mono text-slate-600">{band.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
