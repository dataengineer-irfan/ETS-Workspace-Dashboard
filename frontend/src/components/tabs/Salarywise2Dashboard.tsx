import React, { useMemo, useState } from 'react';
import type { Salarywise2KPIs } from '../../types/dashboard';
import { ExportButton } from '../common/ExportButton';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from 'recharts';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, Users, Filter } from 'lucide-react';

interface Salarywise2DashboardProps {
  data: Salarywise2KPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

type SortField = 'Total_CTC' | 'M_Salary' | 'EMPLOYEE LABEL';
type SortDir = 'asc' | 'desc';

const TS = {
  contentStyle: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  itemStyle: { color: '#0f172a' },
};

export const Salarywise2Dashboard: React.FC<Salarywise2DashboardProps> = ({ 
  data, 
  loading, 
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterGrade, setRosterGrade] = useState('');
  const [rosterLocation, setRosterLocation] = useState('');
  const [rosterDept, setRosterDept] = useState('');
  const [sortField, setSortField] = useState<SortField>('Total_CTC');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Hooks must precede early returns
  const earners = data?.top_earners ?? [];

  const uniqueGrades    = useMemo(() => [...new Set(earners.map(e => e['JOB LEVEL']))].sort(), [earners]);
  const uniqueLocations = useMemo(() => [...new Set(earners.map(e => e['LOCATION']))].sort(), [earners]);
  const uniqueDepts     = useMemo(() => [...new Set(earners.map(e => e['DEPARTMENT']))].sort(), [earners]);

  const filteredRoster = useMemo(() => {
    let rows = [...earners];
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      rows = rows.filter(e => e['EMPLOYEE LABEL'].toLowerCase().includes(q));
    }
    if (rosterGrade)    rows = rows.filter(e => e['JOB LEVEL'] === rosterGrade);
    if (rosterLocation) rows = rows.filter(e => e['LOCATION'] === rosterLocation);
    if (rosterDept)     rows = rows.filter(e => e['DEPARTMENT'] === rosterDept);
    rows.sort((a, b) => {
      const av = a[sortField] as string | number;
      const bv = b[sortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [earners, rosterSearch, rosterGrade, rosterLocation, rosterDept, sortField, sortDir]);

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Advanced Salary &amp; Promotion Analytics...</span>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredRoster.length / PAGE_SIZE));
  const paginatedRoster = filteredRoster.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };
  const clearFilters = () => { setRosterSearch(''); setRosterGrade(''); setRosterLocation(''); setRosterDept(''); setPage(1); };
  const hasFilter = !!(rosterSearch || rosterGrade || rosterLocation || rosterDept);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-0.5" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-cyan-600 inline ml-0.5" />
      : <ArrowDown className="w-3 h-3 text-cyan-600 inline ml-0.5" />;
  };

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* Leadership Brief Banner */}
      <div 
        className="rounded-xl border p-2.5 shrink-0" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.04), rgba(255,255,255,0.2), var(--surface))', 
          borderColor: 'var(--border)', 
          boxShadow: 'var(--shadow-soft)' 
        }}
      >
        <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Longitudinal Analysis</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ● MULTI-YEAR COMPENSATION PROGRESSION
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Longitudinal: 28 Records
              </span>
            </div>

            {/* 3 Concise Bullet Insights */}
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-emerald-900 block truncate">5-Year Growth Rate</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Base salary grew at 8.4% CAGR through 2023</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-amber-900 block truncate">2024 Data Baseline</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">2024 dip reflects partial year cohort records</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-cyan-900 block truncate">High-Yield Roles</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Delivery & Architecture lead average base pay</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500">Dataset Scope</span>
            <div className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-right shadow-2xs">
              <span className="text-xs font-bold text-slate-800 font-mono block">
                {data.filtered_count ?? data.top_earners.length} Matched Records
              </span>
              <span className="text-[9px] text-slate-400">Finance History Sheet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Team Average Salary & 5-Year Trend */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: Average Salary by Team (7 Cols) */}
        <div className="col-span-7 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Average Salary by Team</span>
              <span className="text-[9px] text-slate-400 font-mono">Click bar to filter roster</span>
            </div>
            <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200 font-semibold">Base vs CTC</span>
          </div>
          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.team_avg_salary} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="department" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip {...TS} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Bar 
                  dataKey="avg_salary" 
                  fill="#0284c7" 
                  name="Avg Base" 
                  radius={[2,2,0,0]} 
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const dept = entry?.department ?? entry?.payload?.department;
                    if (dept) setRosterDept(dept);
                  }}
                />
                <Bar 
                  dataKey="avg_ctc" 
                  fill="#10b981" 
                  name="Avg CTC" 
                  radius={[2,2,0,0]} 
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const dept = entry?.department ?? entry?.payload?.department;
                    if (dept) setRosterDept(dept);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: 5-Year Salary Trend with 2024 Annotation (5 Cols) */}
        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">5-Year Salary Progression</span>
            </div>
            <span className="text-[9px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-bold">
              *2024 Partial Year
            </span>
          </div>
          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.salary_trend_years} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip {...TS} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Line type="monotone" dataKey="avg_salary" stroke="#0284c7" strokeWidth={2.5} name="Avg Base" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="avg_ctc" stroke="#10b981" strokeWidth={2.5} name="Avg CTC" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Component Breakdown & Interactive Roster */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: Component-wise Compensation per Band (7 Cols) */}
        <div className="col-span-7 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 tracking-tight">Compensation Mix per Band</span>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-semibold">Base + Bonus + Perks</span>
          </div>
          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.compensation_by_band} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="salary_bin" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip {...TS} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Area type="monotone" dataKey="avg_base" stackId="1" stroke="#0284c7" fill="#0284c7" fillOpacity={0.8} name="Base" />
                <Area type="monotone" dataKey="avg_bonus" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.8} name="Bonus" />
                <Area type="monotone" dataKey="avg_perks" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.8} name="Perks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Interactive Compensation Roster (5 Cols) */}
        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col gap-1 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Compensation Roster</span>
              <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 rounded border border-slate-200">{filteredRoster.length}</span>
            </div>
            <div className="flex items-center gap-1">
              {hasFilter && (
                <button onClick={clearFilters} className="flex items-center gap-0.5 text-[9px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded hover:bg-rose-100 transition-colors">
                  <X className="w-2.5 h-2.5" /> Clear
                </button>
              )}
              <ExportButton data={filteredRoster} filename="salarywise2_top_earners.csv" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 shrink-0">
            <div className="relative col-span-2">
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search employee…" 
                value={rosterSearch}
                onChange={e => { setRosterSearch(e.target.value); setPage(1); }}
                className="w-full pl-6 pr-6 py-0.5 text-[10px] bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400" 
              />
              {rosterSearch && (
                <button onClick={() => { setRosterSearch(''); setPage(1); }} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                </button>
              )}
            </div>
            <select 
              value={rosterGrade} 
              onChange={e => { setRosterGrade(e.target.value); setPage(1); }}
              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none focus:border-cyan-400"
            >
              <option value="">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select 
              value={rosterDept} 
              onChange={e => { setRosterDept(e.target.value); setPage(1); }}
              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none focus:border-cyan-400"
            >
              <option value="">All Departments</option>
              {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-[11px] text-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-1 px-1.5">
                    <button onClick={() => toggleSort('EMPLOYEE LABEL')} className="flex items-center gap-0.5 hover:text-cyan-700">Employee <SortIcon field="EMPLOYEE LABEL" /></button>
                  </th>
                  <th className="py-1 px-1.5">Grade</th>
                  <th className="py-1 px-1.5 text-right">
                    <button onClick={() => toggleSort('Total_CTC')} className="flex items-center gap-0.5 ml-auto hover:text-cyan-700">Total CTC <SortIcon field="Total_CTC" /></button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedRoster.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-slate-400 text-[11px] font-sans">
                    <Filter className="w-4 h-4 mx-auto mb-1 text-slate-300" />
                    No matching records
                  </td></tr>
                ) : paginatedRoster.map(e => (
                  <tr 
                    key={e['EMPLOYEE NUMBER']} 
                    onClick={() => {
                      if (onOpenEmployeeProfile) {
                        onOpenEmployeeProfile(e['EMPLOYEE NUMBER']);
                      } else {
                        onSelectEmployee(e['EMPLOYEE NUMBER']);
                      }
                    }} 
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                  >
                    <td className="py-1 px-1.5 font-sans font-medium text-slate-900 truncate max-w-[120px] group-hover:text-cyan-700">{e['EMPLOYEE LABEL']}</td>
                    <td className="py-1 px-1.5 font-sans">{e['JOB LEVEL']}</td>
                    <td className="py-1 px-1.5 text-right font-bold text-emerald-700">₹{e['Total_CTC'].toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 shrink-0 text-[10px]">
              <span className="text-slate-500 font-mono">{page}/{totalPages} · {filteredRoster.length} rows</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-30 hover:bg-slate-100 transition-colors shadow-2xs">‹ Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-30 hover:bg-slate-100 transition-colors shadow-2xs">Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
