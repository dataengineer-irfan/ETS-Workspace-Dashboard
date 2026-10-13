import React, { useState } from 'react';
import type { StatewiseKPIs } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
import { 
  UserCheck, 
  Clock, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

interface StatewiseDashboardProps {
  data: StatewiseKPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
  filters?: Record<string, any>;
  setFilters?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export const StatewiseDashboard: React.FC<StatewiseDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
  onOpenEmployeeProfile,
  filters,
  setFilters,
}) => {
  const [sortField, setSortField] = useState<string>('EMPLOYEE NUMBER');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);
  const rowsPerPage = 8;

  if (loading || !data) {
    return <DashboardSkeleton variant="client" title="Loading Client Delivery Analytics..." />;
  }

  if (data.filtered_employees === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[400px]">
        <EmptyState
          title="No Client Delivery Records Match Active Filters"
          description="None of the client accounts or employees match the active filters. Reset filters to restore view."
          onResetFilters={() => setFilters?.({})}
          resetLabel="Clear All Filters"
        />
      </div>
    );
  }

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const handleGradeClick = (grade: string) => {
    setSelectedGradeFilter((prev) => {
      const next = prev === grade ? null : grade;
      if (setFilters) {
        setFilters((fPrev) => {
          const updated = { ...fPrev };
          if (next) {
            updated.job_level = [next];
          } else {
            delete updated.job_level;
          }
          return updated;
        });
      }
      return next;
    });
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  // Filter roster by clicked grade filter
  const filteredRoster = (data.employee_roster || []).filter((emp) => {
    if (selectedGradeFilter && emp['JOB LEVEL'] !== selectedGradeFilter) return false;
    return true;
  });

  const sortedRoster = [...filteredRoster].sort((a, b) => {
    const av = a[sortField as keyof typeof a];
    const bv = b[sortField as keyof typeof b];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    return sortDir === 'asc'
      ? String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
      : String(bv ?? '').localeCompare(String(av ?? ''), undefined, { numeric: true });
  });

  const totalPages = Math.ceil(sortedRoster.length / rowsPerPage) || 1;
  const paginatedRoster = sortedRoster.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Grouped chart data
  const projectGrouped = data.project_grade_grouped && data.project_grade_grouped.length > 0
    ? data.project_grade_grouped
    : data.project_grade_distribution;

  const projectKeys = data.project_grade_grouped && data.project_grade_grouped.length > 0
    ? Object.keys(data.project_grade_grouped[0]).filter(k => k !== 'job_level' && k !== 'total')
    : ['count'];

  const PROJECT_PALETTE = ['#0284c7', '#10b981', '#d97706', '#8b5cf6', '#ec4899', '#64748b'];

  const geoGrouped = data.geography_grade_grouped && data.geography_grade_grouped.length > 0
    ? data.geography_grade_grouped
    : data.geography_grade_breakdown;

  const geoKeys = data.geography_grade_grouped && data.geography_grade_grouped.length > 0
    ? Object.keys(data.geography_grade_grouped[0]).filter(k => k !== 'job_level' && k !== 'total')
    : ['count'];

  const GEO_PALETTE = ['#0284c7', '#0d9488', '#f97316', '#7c3aed', '#64748b'];

  return (
    <div className="flex-1 flex flex-col gap-2.5 min-h-full select-none">
      {/* Top 4 KPI Cards (Compact & Dominant In-Scope Workforce) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        <KPICard
          dominant={true}
          compact={true}
          title="In-Scope Workforce"
          value={selectedGradeFilter ? filteredRoster.length : data.filtered_employees}
          subtitle={`Active Staff · ${selectedGradeFilter ? `Grade: ${selectedGradeFilter}` : 'All Grades'}`}
          icon={UserCheck}
          badge={selectedGradeFilter ? `${filteredRoster.length} FTE` : "100% Roster"}
          badgeColor="emerald"
        />
        <KPICard
          compact={true}
          title="Prior Experience"
          value={`${data.avg_prior_exp} Yrs`}
          subtitle="External specialist depth"
          icon={Briefcase}
          badge="Prior Exp"
          badgeColor="amber"
        />
        <KPICard
          compact={true}
          title="ETS Tenure"
          value={`${data.avg_infinite_exp} Yrs`}
          subtitle="Internal operating continuity"
          icon={Clock}
          badge="Tenure"
          badgeColor="purple"
        />
        <KPICard
          compact={true}
          title="Delivery Lead"
          value={(data.selected_sdm || '').replace(/\s*\(\d+\)\s*$/, '').trim() || data.selected_sdm}
          subtitle="Executive Program Lead"
          icon={ShieldCheck}
          badge="Lead"
          badgeColor="cyan"
        />
      </div>

      {/* Middle Visuals: 3 Grouped Charts with Zero Axis Repetitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 flex-1 min-h-[260px]">
        {/* Chart 1: Experience Analysis by Job Level */}
        <div className="col-span-1 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-[240px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Experience Depth by Grade</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Click to filter</span>
            </div>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-200 dark:border-cyan-800 font-semibold">Prior vs ETS</span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.experience_by_grade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="job_level" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-soft)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Bar 
                  dataKey="prior_exp" 
                  fill="#d97706" 
                  name="Prior Exp (Yrs)" 
                  radius={[2, 2, 0, 0]} 
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const gl = entry?.job_level ?? entry?.payload?.job_level;
                    if (gl) handleGradeClick(gl);
                  }}
                />
                <Bar 
                  dataKey="infinite_exp" 
                  fill="#0284c7" 
                  name="ETS Exp (Yrs)" 
                  radius={[2, 2, 0, 0]} 
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const gl = entry?.job_level ?? entry?.payload?.job_level;
                    if (gl) handleGradeClick(gl);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Grouped Distribution by Job Level & Client Account */}
        <div className="col-span-1 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-[240px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Grade by Client Account</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">NH · ND · AK</span>
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">Grouped</span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectGrouped as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="job_level" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-soft)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                {projectKeys.map((key, idx) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={PROJECT_PALETTE[idx % PROJECT_PALETTE.length]}
                    radius={[2, 2, 0, 0]}
                    name={key}
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      const gl = entry?.job_level ?? entry?.payload?.job_level;
                      if (gl) handleGradeClick(gl);
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Grouped Workforce by Delivery Location and Job Level */}
        <div className="col-span-1 md:col-span-2 xl:col-span-1 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-[240px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Grade by Delivery Location</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">India Hubs</span>
            </div>
            <span className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800 font-semibold">Hub Spread</span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={geoGrouped as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="job_level" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-soft)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                {geoKeys.map((key, idx) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={GEO_PALETTE[idx % GEO_PALETTE.length]}
                    radius={[2, 2, 0, 0]}
                    name={key}
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      const gl = entry?.job_level ?? entry?.payload?.job_level;
                      if (gl) handleGradeClick(gl);
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: Filtered Employee Listing Table (Calibrated Dynamic Height) */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 min-h-[190px] h-auto flex-1 flex flex-col justify-between overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Employee Listing</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700 font-semibold">
              {filteredRoster.length} Records
            </span>
            {selectedGradeFilter && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                <span>Grade: {selectedGradeFilter}</span>
                <button
                  onClick={() => {
                    setSelectedGradeFilter(null);
                    if (setFilters) {
                      setFilters((fPrev) => {
                        const updated = { ...fPrev };
                        delete updated.job_level;
                        return updated;
                      });
                    }
                    setCurrentPage(1);
                  }}
                  className="hover:text-rose-600 transition-colors ml-0.5"
                  title="Clear grade filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ExportButton data={sortedRoster} filename="client_delivery_roster.csv" />
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 flex items-center justify-center cursor-pointer transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 flex items-center justify-center cursor-pointer transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar my-1">
          <table className="w-full min-w-[850px] text-left text-[11px] text-slate-700 dark:text-slate-300">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10 backdrop-blur-xs">
              <tr>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'EMPLOYEE NUMBER' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('EMPLOYEE NUMBER'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('EMPLOYEE NUMBER')}
                >
                  <div className="flex items-center gap-0.5">ID <SortIcon field="EMPLOYEE NUMBER" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'EMPLOYEE LABEL' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('EMPLOYEE LABEL'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('EMPLOYEE LABEL')}
                >
                  <div className="flex items-center gap-0.5">Employee Name <SortIcon field="EMPLOYEE LABEL" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'JOB LEVEL' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('JOB LEVEL'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('JOB LEVEL')}
                >
                  <div className="flex items-center gap-0.5">Grade <SortIcon field="JOB LEVEL" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'JOB TITLE' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('JOB TITLE'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('JOB TITLE')}
                >
                  <div className="flex items-center gap-0.5">Title <SortIcon field="JOB TITLE" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'LOCATION' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('LOCATION'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('LOCATION')}
                >
                  <div className="flex items-center gap-0.5">Location <SortIcon field="LOCATION" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'State' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('State'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('State')}
                >
                  <div className="flex items-center gap-0.5">Client Account <SortIcon field="State" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'MANAGER' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('MANAGER'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('MANAGER')}
                >
                  <div className="flex items-center gap-0.5">Manager <SortIcon field="MANAGER" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'Prior_Exp' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('Prior_Exp'); } }}
                  className="py-1 px-2 text-right cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('Prior_Exp')}
                >
                  <div className="flex items-center justify-end gap-0.5">Prior Exp <SortIcon field="Prior_Exp" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'Infinite_Exp' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('Infinite_Exp'); } }}
                  className="py-1 px-2 text-right cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('Infinite_Exp')}
                >
                  <div className="flex items-center justify-end gap-0.5">ETS Exp <SortIcon field="Infinite_Exp" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'Total_Exp' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('Total_Exp'); } }}
                  className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('Total_Exp')}
                >
                  <div className="flex items-center justify-end gap-0.5">Total Exp <SortIcon field="Total_Exp" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRoster.length > 0 ? (
                paginatedRoster.map((emp) => (
                  <tr 
                    key={emp['EMPLOYEE NUMBER']}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onOpenEmployeeProfile) {
                          onOpenEmployeeProfile(emp['EMPLOYEE NUMBER']);
                        } else {
                          onSelectEmployee(emp['EMPLOYEE NUMBER']);
                        }
                      }
                    }}
                    onClick={() => {
                      if (onOpenEmployeeProfile) {
                        onOpenEmployeeProfile(emp['EMPLOYEE NUMBER']);
                      } else {
                        onSelectEmployee(emp['EMPLOYEE NUMBER']);
                      }
                    }}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group focus:outline-hidden focus:bg-cyan-50/20"
                  >
                    <td className="py-1 px-2 font-mono text-cyan-700 dark:text-cyan-400 font-semibold group-hover:underline">{emp['EMPLOYEE NUMBER']}</td>
                    <td className="py-1 px-2 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={emp['EMPLOYEE LABEL']}>{emp['EMPLOYEE LABEL']}</td>
                    <td className="py-1 px-2">
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGradeClick(emp['JOB LEVEL']);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-colors"
                        title="Click to filter this grade"
                      >
                        {emp['JOB LEVEL']}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={emp['JOB TITLE']}>{emp['JOB TITLE']}</td>
                    <td className="py-1 px-2 text-slate-700 dark:text-slate-300" title={emp['LOCATION']}>{emp['LOCATION']}</td>
                    <td className="py-1 px-2 text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={`${emp['State']} / ${emp['Project Working']}`}>{emp['State']} / {emp['Project Working']}</td>
                    <td className="py-1 px-2 text-slate-600 dark:text-slate-400 truncate max-w-[140px]" title={emp['MANAGER']}>{emp['MANAGER']}</td>
                    <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{emp['Prior_Exp']} y</td>
                    <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{emp['Infinite_Exp']} y</td>
                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{emp['Total_Exp']} y</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6">
                    <EmptyState
                      compact
                      title="No matching employees found"
                      description={selectedGradeFilter ? `No records found for grade "${selectedGradeFilter}".` : 'No employee records match the current filter selection.'}
                      onResetFilters={selectedGradeFilter ? () => setSelectedGradeFilter(null) : (setFilters ? () => setFilters({}) : undefined)}
                      resetLabel={selectedGradeFilter ? 'Clear Grade Filter' : 'Reset Filters'}
                    />
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
