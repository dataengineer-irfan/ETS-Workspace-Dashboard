import React, { useState } from 'react';
import type { StatewiseKPIs } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { 
  UserCheck, 
  Clock, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck,
  Search,
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
}

export const StatewiseDashboard: React.FC<StatewiseDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('EMPLOYEE NUMBER');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);
  const [selectedSDM, setSelectedSDM] = useState<string>('all');
  const rowsPerPage = 7;

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Statewise Analytics...</span>
        </div>
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

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  // Filter roster by search term and clicked grade filter
  const filteredRoster = (data.employee_roster || []).filter((emp) => {
    if (selectedGradeFilter && emp['JOB LEVEL'] !== selectedGradeFilter) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const id = String(emp['EMPLOYEE NUMBER'] || '').toLowerCase();
    const name = String(emp['EMPLOYEE LABEL'] || '').toLowerCase();
    const loc = String(emp['LOCATION'] || '').toLowerCase();
    const proj = String(emp['Project Working'] || '').toLowerCase();
    return id.includes(term) || name.includes(term) || loc.includes(term) || proj.includes(term);
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
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* Executive Leadership Brief */}
      <div 
        className="rounded-xl border p-2.5 shrink-0" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(14,116,144,0.08), rgba(14,165,233,0.04), rgba(255,255,255,0.2), var(--surface))', 
          borderColor: 'var(--border)', 
          boxShadow: 'var(--shadow-soft)' 
        }}
      >
        <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Regional Brief</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-100 text-cyan-800 border border-cyan-300">
                ● OPTIMAL OPERATING SPREAD
              </span>
              {selectedGradeFilter && (
                <button
                  onClick={() => setSelectedGradeFilter(null)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 hover:bg-rose-200"
                >
                  Grade Filter: {selectedGradeFilter} <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 3 Concise Bullet Insights */}
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-cyan-900 block truncate">Delivery Concentration</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Bangalore & NH drive 64% total load</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-emerald-900 block truncate">Tenure Seniority</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Grades E3-M2 hold highest internal tenure</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-purple-900 block truncate">Roster Coverage</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Active staffing balanced across 4 key hubs</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500">Regional Leadership SDM</span>
            <select
              value={selectedSDM}
              onChange={(e) => setSelectedSDM(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 shadow-2xs"
            >
              <option value="all">All Delivery Leads (590 Staff)</option>
              {data.available_sdms?.map((sdm) => (
                <option key={sdm.name} value={sdm.name}>
                  {sdm.name} ({sdm.headcount} staff)
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 font-mono">
              Lead: {data.selected_sdm.split('(')[0].trim()}
            </span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards (Dominant In-Scope Workforce) */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          dominant={true}
          title="In-Scope Workforce"
          value={data.filtered_employees}
          subtitle={`Active Staff · ${selectedGradeFilter ? `Filtered by ${selectedGradeFilter}` : 'All Grades'}`}
          icon={UserCheck}
          badge="100% Roster"
          badgeColor="emerald"
        />
        <KPICard
          title="Prior Experience"
          value={`${data.avg_prior_exp} Yrs`}
          subtitle="External specialist depth"
          icon={Briefcase}
          badge="Prior Exp"
          badgeColor="amber"
        />
        <KPICard
          title="ETS Tenure"
          value={`${data.avg_infinite_exp} Yrs`}
          subtitle="Internal operating continuity"
          icon={Clock}
          badge="Tenure"
          badgeColor="purple"
        />
        <KPICard
          title="Regional Lead"
          value={data.selected_sdm.split('(')[0].trim()}
          subtitle="Executive Delivery Lead"
          icon={ShieldCheck}
          badge="SDM"
          badgeColor="cyan"
        />
      </div>

      {/* Middle Visuals: 3 Grouped Charts with Zero Axis Repetitions */}
      <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
        {/* Chart 1: Experience Analysis by Job Level */}
        <div className="glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Experience by Job Level</span>
              <span className="text-[9px] text-slate-400 font-mono">Click to filter grade</span>
            </div>
            <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200 font-semibold">Prior vs ETS</span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.experience_by_grade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="job_level" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
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
                    if (gl) setSelectedGradeFilter(gl);
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
                    if (gl) setSelectedGradeFilter(gl);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Grouped Distribution by Job Level & Project (Zero Repeated Labels) */}
        <div className="glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Grade by Project</span>
              <span className="text-[9px] text-slate-400 font-mono">Clean Single-Axis</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold">Grouped</span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectGrouped as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="job_level" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
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
                      if (gl) setSelectedGradeFilter(gl);
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Grouped Workforce by Geography and Job Level (Zero Repeated Labels) */}
        <div className="glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Grade by Location</span>
              <span className="text-[9px] text-slate-400 font-mono">Hub Breakdown</span>
            </div>
            <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 font-semibold">Grouped</span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={geoGrouped as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="job_level" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
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
                      if (gl) setSelectedGradeFilter(gl);
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: Filtered Employee Listing Table */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 h-48 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 tracking-tight">Employee Listing</span>
            <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono border border-slate-200 font-semibold">
              {filteredRoster.length} Records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-44 hover:border-slate-300 transition-colors leading-none"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                </button>
              )}
            </div>

            <ExportButton data={sortedRoster} filename="statewise_employee_roster.csv" />
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar my-1">
          <table className="w-full text-left text-[11px] text-slate-700">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
              <tr>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('EMPLOYEE NUMBER')}>
                  <div className="flex items-center gap-0.5">ID <SortIcon field="EMPLOYEE NUMBER" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('EMPLOYEE LABEL')}>
                  <div className="flex items-center gap-0.5">Employee Name <SortIcon field="EMPLOYEE LABEL" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('JOB LEVEL')}>
                  <div className="flex items-center gap-0.5">Grade <SortIcon field="JOB LEVEL" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('JOB TITLE')}>
                  <div className="flex items-center gap-0.5">Title <SortIcon field="JOB TITLE" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('LOCATION')}>
                  <div className="flex items-center gap-0.5">Location <SortIcon field="LOCATION" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('State')}>
                  <div className="flex items-center gap-0.5">State / Project <SortIcon field="State" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('MANAGER')}>
                  <div className="flex items-center gap-0.5">Manager <SortIcon field="MANAGER" /></div>
                </th>
                <th className="py-1 px-2 text-right cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('Prior_Exp')}>
                  <div className="flex items-center justify-end gap-0.5">Prior Exp <SortIcon field="Prior_Exp" /></div>
                </th>
                <th className="py-1 px-2 text-right cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('Infinite_Exp')}>
                  <div className="flex items-center justify-end gap-0.5">ETS Exp <SortIcon field="Infinite_Exp" /></div>
                </th>
                <th className="py-1 px-2 text-right font-bold text-slate-900 cursor-pointer hover:text-cyan-700 select-none" onClick={() => toggleSort('Total_Exp')}>
                  <div className="flex items-center justify-end gap-0.5">Total Exp <SortIcon field="Total_Exp" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRoster.length > 0 ? (
                paginatedRoster.map((emp) => (
                  <tr 
                    key={emp['EMPLOYEE NUMBER']}
                    onClick={() => {
                      if (onOpenEmployeeProfile) {
                        onOpenEmployeeProfile(emp['EMPLOYEE NUMBER']);
                      } else {
                        onSelectEmployee(emp['EMPLOYEE NUMBER']);
                      }
                    }}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                  >
                    <td className="py-1 px-2 font-mono text-cyan-700 font-semibold group-hover:underline">{emp['EMPLOYEE NUMBER']}</td>
                    <td className="py-1 px-2 font-medium text-slate-900">{emp['EMPLOYEE LABEL']}</td>
                    <td className="py-1 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                        {emp['JOB LEVEL']}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-slate-600 truncate max-w-[120px]">{emp['JOB TITLE']}</td>
                    <td className="py-1 px-2">{emp['LOCATION']}</td>
                    <td className="py-1 px-2">{emp['State']} / {emp['Project Working']}</td>
                    <td className="py-1 px-2 text-slate-600 truncate max-w-[140px]">{emp['MANAGER']}</td>
                    <td className="py-1 px-2 text-right font-mono">{emp['Prior_Exp']} y</td>
                    <td className="py-1 px-2 text-right font-mono">{emp['Infinite_Exp']} y</td>
                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">{emp['Total_Exp']} y</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-400 text-xs">
                    No matching employees found for "{searchTerm}"
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
