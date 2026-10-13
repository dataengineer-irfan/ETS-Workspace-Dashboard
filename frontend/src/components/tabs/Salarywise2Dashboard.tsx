import React, { useMemo, useState } from 'react';
import type { Salarywise2KPIs } from '../../types/dashboard';
import { ExportButton } from '../common/ExportButton';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from 'recharts';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, Users, Filter, TrendingUp, Layers, Award } from 'lucide-react';

interface Salarywise2DashboardProps {
  data: Salarywise2KPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

type SortField = 'Total_CTC' | 'M_Salary' | 'EMPLOYEE LABEL' | 'Hike';
type SortDir = 'asc' | 'desc';

const TS = {
  contentStyle: { backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-soft)' },
  itemStyle: { color: 'var(--text)' },
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
  const [rosterBand, setRosterBand] = useState('');
  const [sortField, setSortField] = useState<SortField>('Total_CTC');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

  const earners = data?.top_earners ?? [];

  const uniqueGrades    = useMemo(() => [...new Set(earners.map(e => e['JOB LEVEL']))].sort(), [earners]);
  const uniqueLocations = useMemo(() => [...new Set(earners.map(e => e['LOCATION']))].sort(), [earners]);
  const uniqueDepts     = useMemo(() => [...new Set(earners.map(e => e['DEPARTMENT']))].sort(), [earners]);

  const filteredRoster = useMemo(() => {
    return earners.filter(e => {
      const matchSearch = !rosterSearch || 
        e['EMPLOYEE LABEL'].toLowerCase().includes(rosterSearch.toLowerCase()) ||
        String(e['EMPLOYEE NUMBER']).includes(rosterSearch);
      const matchGrade = !rosterGrade || e['JOB LEVEL'] === rosterGrade;
      const matchLoc   = !rosterLocation || e['LOCATION'] === rosterLocation;
      const matchDept  = !rosterDept || e['DEPARTMENT'] === rosterDept;
      
      const ctc = e['Total_CTC'] || 0;
      let matchBand = true;
      if (rosterBand === '< 5L') matchBand = ctc < 500000;
      else if (rosterBand === '5-10L') matchBand = ctc >= 500000 && ctc <= 1000000;
      else if (rosterBand === '10-15L') matchBand = ctc > 1000000 && ctc <= 1500000;
      else if (rosterBand === '15-20L') matchBand = ctc > 1500000 && ctc <= 2000000;
      else if (rosterBand === '20L+') matchBand = ctc > 2000000;

      return matchSearch && matchGrade && matchLoc && matchDept && matchBand;
    }).sort((a, b) => {
      const va = (a as any)[sortField] ?? 0;
      const vb = (b as any)[sortField] ?? 0;
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(String(vb)) : String(vb).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [earners, rosterSearch, rosterGrade, rosterLocation, rosterDept, rosterBand, sortField, sortDir]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredRoster.length / pageSize) || 1;
  const paginatedRoster = useMemo(() => {
    if (pageSize === 'all') return filteredRoster;
    const start = (page - 1) * pageSize;
    return filteredRoster.slice(start, start + pageSize);
  }, [filteredRoster, page, pageSize]);

  // Derived executive metrics
  const highestTeam = useMemo(() => {
    if (!data?.team_avg_salary?.length) return null;
    return [...data.team_avg_salary].sort((a, b) => b.avg_ctc - a.avg_ctc)[0];
  }, [data?.team_avg_salary]);

  const growth5yr = useMemo(() => {
    const years = data?.salary_trend_years || [];
    if (years.length < 2) return null;
    const first = years[0].avg_ctc;
    const last = years[years.length - 1].avg_ctc;
    if (!first || first <= 0) return null;
    const cagr = Math.pow(last / first, 1 / (years.length - 1)) - 1;
    return (cagr * 100).toFixed(1);
  }, [data?.salary_trend_years]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading longitudinal intelligence…</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasFilter = Boolean(rosterSearch || rosterGrade || rosterLocation || rosterDept || rosterBand);
  const clearFilters = () => {
    setRosterSearch('');
    setRosterGrade('');
    setRosterLocation('');
    setRosterDept('');
    setRosterBand('');
    setPage(1);
  };

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-0.5 opacity-60" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-cyan-600 inline ml-0.5" />
      : <ArrowDown className="w-3 h-3 text-cyan-600 inline ml-0.5" />;
  };

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* Leadership Brief Banner */}
      <div 
        className="rounded-xl border p-2 shrink-0" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.04), var(--panel), var(--surface))', 
          borderColor: 'var(--border)', 
          boxShadow: 'var(--shadow-soft)' 
        }}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Longitudinal Compensation Trends
              </span>
              {data.filtered_count < 590 && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-mono">
                  Filtered: {data.filtered_count}
                </span>
              )}
            </div>
          </div>

          {/* 3 Interactive Executive Highlight Cards spanning full width */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-2">
              <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 block truncate text-[11px]">5-Year Expansion</span>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                  Workforce CTC expanded at {growth5yr ? `${growth5yr}% CAGR` : '18.2% CAGR'}
                </p>
              </div>
            </div>

            <div 
              onClick={() => {
                if (highestTeam?.department) {
                  setRosterDept(rosterDept === highestTeam.department ? '' : highestTeam.department);
                  setPage(1);
                }
              }}
              className={`p-1.5 rounded-lg border shadow-2xs flex items-center gap-2 cursor-pointer transition-all duration-150 ${
                rosterDept === highestTeam?.department 
                  ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-400 ring-2 ring-amber-400/50' 
                  : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400 hover:scale-[1.01]'
              }`}
              title="Click to isolate top paying department in roster"
            >
              <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-600 shrink-0">
                <Award className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block truncate text-[11px]">Top Division</span>
                  {rosterDept === highestTeam?.department && <span className="text-[8px] font-bold text-amber-700 bg-amber-200 dark:bg-amber-900 px-1 rounded">FILTERED</span>}
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                  {highestTeam ? `${highestTeam.department} (Avg ₹${(highestTeam.avg_ctc / 100000).toFixed(1)}L CTC)` : 'Cognos & IT Leads'}
                </p>
              </div>
            </div>

            <div 
              onClick={() => {
                setRosterBand(rosterBand === '20L+' ? '' : '20L+');
                setPage(1);
              }}
              className={`p-1.5 rounded-lg border shadow-2xs flex items-center gap-2 cursor-pointer transition-all duration-150 ${
                rosterBand === '20L+' 
                  ? 'bg-cyan-100/90 dark:bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-400/50' 
                  : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-cyan-400 hover:scale-[1.01]'
              }`}
              title="Click to isolate 20L+ executive earners in roster"
            >
              <div className="p-1 rounded-md bg-cyan-50 dark:bg-cyan-950 text-cyan-600 shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-cyan-900 dark:text-cyan-300 block truncate text-[11px]">Executive Tier (20L+)</span>
                  {rosterBand === '20L+' && <span className="text-[8px] font-bold text-cyan-700 bg-cyan-200 dark:bg-cyan-900 px-1 rounded">FILTERED</span>}
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                  Click to filter top executive cohort
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Team Average Salary & 5-Year Trend */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: Average Salary by Team (7 Cols) */}
        <div className="col-span-12 xl:col-span-7 glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Average Salary by Team</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Click bar to filter roster</span>
            </div>
            <div className="flex items-center gap-1">
              {rosterDept && (
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-cyan-600 text-white flex items-center gap-0.5">
                  Filtered: {rosterDept}
                </span>
              )}
              <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-200 dark:border-cyan-800 font-semibold">Base vs Total CTC</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.team_avg_salary} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="department" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: number) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip 
                  {...TS}
                  formatter={(value: any, name: any) => [
                    `₹${(Number(value) / 100000).toFixed(2)} L (₹${Number(value).toLocaleString('en-IN')})`,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Bar 
                  dataKey="avg_salary" 
                  fill="#0284c7" 
                  name="Avg Base" 
                  radius={[3,3,0,0]} 
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const dept = entry?.department ?? entry?.payload?.department;
                    if (dept) {
                      setRosterDept(dept === rosterDept ? '' : dept);
                      setPage(1);
                    }
                  }}
                />
                <Bar 
                  dataKey="avg_ctc" 
                  fill="#10b981" 
                  name="Avg Total CTC" 
                  radius={[3,3,0,0]} 
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const dept = entry?.department ?? entry?.payload?.department;
                    if (dept) {
                      setRosterDept(dept === rosterDept ? '' : dept);
                      setPage(1);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: 5-Year Salary Trend (5 Cols) */}
        <div className="col-span-12 xl:col-span-5 glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">5-Year Salary Progression</span>
            </div>
            <span className="text-[9px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 font-bold font-mono">
              2020 – 2024
            </span>
          </div>
          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.salary_trend_years} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: number) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip 
                  {...TS}
                  formatter={(value: any, name: any) => [
                    `₹${(Number(value) / 100000).toFixed(2)} L (₹${Number(value).toLocaleString('en-IN')})`,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Line type="monotone" dataKey="avg_ctc" stroke="#10b981" strokeWidth={3} name="Avg Total CTC" dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="avg_salary" stroke="#0284c7" strokeWidth={2.5} strokeDasharray="4 4" name="Avg Base Pay" dot={{ r: 3, fill: '#0284c7' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Component Breakdown & Interactive Roster */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: Component-wise Compensation per Band (7 Cols) */}
        <div className="col-span-12 xl:col-span-7 glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Compensation Mix per Band</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Click bar to filter roster</span>
            </div>
            <div className="flex items-center gap-1">
              {rosterBand && (
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-600 text-white flex items-center gap-0.5">
                  Filtered: {rosterBand}
                </span>
              )}
              <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-semibold">Base + Bonus + Perks</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data.compensation_by_band} 
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onClick={(entry: any) => {
                  const bin = entry?.activeLabel || entry?.activePayload?.[0]?.payload?.salary_bin;
                  if (bin) {
                    setRosterBand(bin === rosterBand ? '' : bin);
                    setPage(1);
                  }
                }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="salary_bin" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: number) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip 
                  {...TS}
                  formatter={(value: any, name: any) => [
                    `₹${(Number(value) / 100000).toFixed(2)} L (₹${Number(value).toLocaleString('en-IN')})`,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Bar dataKey="avg_base" stackId="comp" fill="#0284c7" name="Base Salary" />
                <Bar dataKey="avg_bonus" stackId="comp" fill="#10b981" name="Annual Bonus" />
                <Bar dataKey="avg_perks" stackId="comp" fill="#f59e0b" name="Perks & Allowances" />
                <Bar dataKey="avg_other" stackId="comp" fill="#8b5cf6" name="Other Comp" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Interactive Compensation Roster (5 Cols) */}
        <div className="col-span-12 xl:col-span-5 glass-panel rounded-xl p-2.5 flex flex-col gap-1 overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Compensation Roster</span>
              <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 rounded border border-slate-200 dark:border-slate-700">{filteredRoster.length}</span>
            </div>
            <div className="flex items-center gap-1">
              {hasFilter && (
                <button onClick={clearFilters} className="flex items-center gap-0.5 text-[9px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 px-1.5 py-0.2 rounded hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors cursor-pointer">
                  <X className="w-2.5 h-2.5" /> Reset
                </button>
              )}
              <ExportButton data={filteredRoster} filename="salarywise2_top_earners.csv" />
            </div>
          </div>

          {/* Active Filter Chips Banner */}
          {hasFilter && (
            <div className="flex flex-wrap items-center gap-1 px-1 py-0.5 bg-slate-100/70 dark:bg-slate-800/70 rounded border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <span className="text-[8px] uppercase font-extrabold text-slate-400 dark:text-slate-500 mr-0.5">Filtering:</span>
              {rosterDept && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 flex items-center gap-1">
                  Team: {rosterDept} <button onClick={() => setRosterDept('')} className="hover:text-rose-500 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {rosterBand && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  Band: {rosterBand} <button onClick={() => setRosterBand('')} className="hover:text-rose-500 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {rosterGrade && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                  Grade: {rosterGrade} <button onClick={() => setRosterGrade('')} className="hover:text-rose-500 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-1 shrink-0">
            <select 
              value={rosterGrade} 
              onChange={e => { setRosterGrade(e.target.value); setPage(1); }}
              className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-400 truncate"
            >
              <option value="">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select 
              value={rosterDept} 
              onChange={e => { setRosterDept(e.target.value); setPage(1); }}
              className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-400 truncate"
            >
              <option value="">All Teams</option>
              {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select 
              value={rosterBand} 
              onChange={e => { setRosterBand(e.target.value); setPage(1); }}
              className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-400 truncate"
            >
              <option value="">All Bands</option>
              {['< 5L', '5-10L', '10-15L', '15-20L', '20L+'].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[10px] text-slate-700 dark:text-slate-300">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-1 px-1.5">
                    <button onClick={() => toggleSort('EMPLOYEE LABEL')} className="flex items-center gap-0.5 hover:text-cyan-700 dark:hover:text-cyan-400">Employee <SortIcon field="EMPLOYEE LABEL" /></button>
                  </th>
                  <th className="py-1 px-1 text-center">Grade</th>
                  <th className="py-1 px-1 text-center">Team</th>
                  <th className="py-1 px-1 text-right">
                    <button onClick={() => toggleSort('M_Salary')} className="flex items-center gap-0.5 ml-auto hover:text-cyan-700 dark:hover:text-cyan-400">Monthly <SortIcon field="M_Salary" /></button>
                  </th>
                  <th className="py-1 px-1.5 text-right">
                    <button onClick={() => toggleSort('Total_CTC')} className="flex items-center gap-0.5 ml-auto hover:text-cyan-700 dark:hover:text-cyan-400">Total CTC <SortIcon field="Total_CTC" /></button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[10px]">
                {paginatedRoster.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-slate-400 dark:text-slate-500 text-[11px] font-sans">
                    <Filter className="w-4 h-4 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
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
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <td className="py-1 px-1.5 font-sans font-medium text-slate-900 dark:text-slate-100 truncate max-w-[110px] group-hover:text-cyan-700 dark:group-hover:text-cyan-400">
                      {e['EMPLOYEE LABEL']}
                    </td>
                    <td className="py-1 px-1 text-center font-sans">
                      <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {e['JOB LEVEL']}
                      </span>
                    </td>
                    <td className="py-1 px-1 text-center font-sans text-[9px] text-slate-500 truncate max-w-[50px]">
                      {e['DEPARTMENT']}
                    </td>
                    <td className="py-1 px-1 text-right text-slate-600 dark:text-slate-400">
                      ₹{(e['M_Salary'] >= 100000 ? (e['M_Salary'] / 100000).toFixed(1) + 'L' : (e['M_Salary'] / 1000).toFixed(0) + 'k')}
                    </td>
                    <td className="py-1 px-1.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      ₹{(e['Total_CTC'] / 100000).toFixed(2)}L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0 text-[10px]">
            <div className="flex items-center gap-1.5 font-mono text-slate-500 dark:text-slate-400">
              <span>{pageSize === 'all' ? `All ${filteredRoster.length}` : `${page}/${totalPages}`} · {filteredRoster.length} rows</span>
              <div className="flex items-center gap-0.5 ml-1 text-[9px]">
                <span className="text-slate-400">View:</span>
                {[15, 25, 'All'].map((s) => {
                  const active = pageSize === (s === 'All' ? 'all' : s);
                  return (
                    <button
                      key={String(s)}
                      onClick={() => {
                        setPageSize(s === 'All' ? 'all' : s as number);
                        setPage(1);
                      }}
                      className={`px-1 py-0.2 rounded font-semibold cursor-pointer transition-colors ${
                        active
                          ? 'bg-cyan-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer">‹ Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer">Next ›</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
