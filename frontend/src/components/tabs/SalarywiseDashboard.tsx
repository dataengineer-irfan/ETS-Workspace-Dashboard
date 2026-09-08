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
  ArrowDown
} from 'lucide-react';

interface SalarywiseDashboardProps {
  data: SalarywiseKPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
}

export const SalarywiseDashboard: React.FC<SalarywiseDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
}) => {
  const [topLimit, setTopLimit] = useState(10);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerSortField, setManagerSortField] = useState<string>('manager');
  const [managerSortDir, setManagerSortDir] = useState<'asc' | 'desc'>('asc');
  const [activePayLens, setActivePayLens] = useState<'cost' | 'leadership' | 'bench'>('cost');

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
      setManagerSortDir('asc');
    }
  };

  const ManagerSortIcon = ({ field }: { field: string }) => {
    if (managerSortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return managerSortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  const sortedManagers = (data.manager_grade_ctc_matrix.managers || [])
    .filter((mgr) => !managerSearch.trim() || mgr.toLowerCase().includes(managerSearch.toLowerCase().trim()))
    .sort((a, b) => {
      if (managerSortField === 'manager') {
        return managerSortDir === 'asc'
          ? a.localeCompare(b)
          : b.localeCompare(a);
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

  const displayedTopEarners = data.top_n_earners.slice(0, topLimit);

  return (
    <div className="flex-1 flex flex-col gap-2 overflow-hidden select-none">
      <div className="rounded-xl border p-3" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(168,85,247,0.05), rgba(255,255,255,0.18), var(--surface))', borderColor: 'var(--border)', boxShadow: 'var(--shadow-soft)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--muted)' }}>Compensation Overview</p>
            <h2 className="text-xl font-bold tracking-tight mt-1 leading-tight" style={{ color: 'var(--text)' }}>
              Compensation remains well structured, with cost concentration aligned to senior delivery leadership and critical role coverage.
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { id: 'cost', label: 'Cost structure', active: activePayLens === 'cost' },
                { id: 'leadership', label: 'Leadership mix', active: activePayLens === 'leadership' },
                { id: 'bench', label: 'Band spread', active: activePayLens === 'bench' },
              ].map((lens) => (
                <button
                  key={lens.id}
                  onClick={() => setActivePayLens(lens.id as 'cost' | 'leadership' | 'bench')}
                  className="px-2 py-1 rounded-full border text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    background: lens.active ? 'rgba(59,130,246,0.08)' : 'var(--panel)',
                    borderColor: lens.active ? 'var(--border-strong)' : 'var(--border)',
                    color: lens.active ? 'var(--blue-strong)' : 'var(--muted)',
                  }}
                >
                  {lens.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border px-3 py-2 text-right shrink-0" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
            <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>Max CTC</div>
            <div className="font-bold text-lg mt-0.5" style={{ color: 'var(--text)' }}>₹{(data.max_ctc / 100000).toFixed(1)}L</div>
          </div>
        </div>
      </div>

      {/* Top KPI Metric Cards - focus on the decision metrics */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        <KPICard
          title="Total CTC"
          value={`₹${(data.total_ctc / 10000000).toFixed(2)} Cr`}
          subtitle={`Avg: ₹${(data.avg_ctc / 100000).toFixed(1)}L`}
          icon={TrendingUp}
          badge="Cost"
          badgeColor="emerald"
        />
        <KPICard
          title="Top CTC"
          value={`₹${(data.max_ctc / 100000).toFixed(1)} L`}
          subtitle="Leadership ceiling"
          icon={ArrowUpRight}
          badge="Ceiling"
          badgeColor="purple"
        />
        <KPICard
          title="Bonus Pool"
          value={`₹${(data.total_bonus / 100000).toFixed(1)} L`}
          subtitle={`Avg: ₹${(data.avg_bonus / 1000).toFixed(0)}k`}
          icon={Award}
          badge="Incentives"
          badgeColor="amber"
        />
        <KPICard
          title="Perks & Allowances"
          value={`₹${(data.total_perks / 100000).toFixed(1)} L`}
          subtitle="Executive benefits"
          icon={BadgeIndianRupee}
          badge="Perks"
          badgeColor="rose"
        />
      </div>

      {/* Middle Visuals: supporting detail panel + summary leader board */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* Left: Employee CTC by Reporting Manager & Grade */}
        <div className="col-span-8 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-xs font-bold text-slate-800 tracking-tight">Employee CTC by Reporting Manager & Grade</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search manager..."
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-40 hover:border-slate-300 transition-colors leading-none"
                />
                {managerSearch && (
                  <button
                    onClick={() => setManagerSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 font-semibold shrink-0">
                CTC Sum (₹ Lakhs)
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar my-1">
            <table className="w-full text-left text-[10px] text-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleManagerSort('manager')}>
                    <div className="flex items-center gap-0.5">Reporting Manager <ManagerSortIcon field="manager" /></div>
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
                {sortedManagers.length > 0 ? (
                  sortedManagers.map((mgr) => {
                    const row = data.manager_grade_ctc_matrix.matrix[mgr] || {};
                    const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={mgr} className="hover:bg-slate-50/80">
                        <td className="py-1 px-2 font-sans text-slate-900 font-medium truncate max-w-[150px]">{mgr}</td>
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

        {/* Right: Top N Earners Table */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Top Earners Table</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
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
                  <th className="py-1 px-2">Employee Name</th>
                  <th className="py-1 px-2">Grade</th>
                  <th className="py-1 px-2 text-right">Monthly Sal</th>
                  <th className="py-1 px-2 text-right font-bold text-slate-900">Total CTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayedTopEarners.map((e, idx) => (
                  <tr 
                    key={e.employee_number}
                    onClick={() => onSelectEmployee(e.employee_number)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-1 px-2 text-slate-400 font-sans">{idx + 1}</td>
                    <td className="py-1 px-2 font-sans font-medium text-slate-900 truncate max-w-[130px]">{e.name}</td>
                    <td className="py-1 px-2 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                        {e.job_level}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right text-slate-800">₹{e.m_salary.toLocaleString()}</td>
                    <td className="py-1 px-2 text-right font-bold text-emerald-700">₹{e.total_ctc.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
