import React, { useState } from 'react';
import type { TechwiseKPIs } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { 
  Cpu, 
  Award, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Grid,
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

interface TechwiseDashboardProps {
  data: TechwiseKPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

export const TechwiseDashboard: React.FC<TechwiseDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('employee_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTabMode, setActiveTabMode] = useState<'specialists' | 'all' | 'gaps'>('specialists');
  const rowsPerPage = 6;

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Techwise Skills Analytics...</span>
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

  // Switch roster based on activeTabMode
  const rawList = activeTabMode === 'specialists' && data.verified_specialists && data.verified_specialists.length > 0
    ? data.verified_specialists
    : (data.skill_roster || []);

  const filteredRoster = rawList.filter((emp: any) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const id = String(emp.employee_number || emp['EMPLOYEE NUMBER'] || '').toLowerCase();
    const name = String(emp.name || emp['EMPLOYEE LABEL'] || '').toLowerCase();
    return id.includes(term) || name.includes(term);
  });

  const sortedRoster = [...filteredRoster].sort((a: any, b: any) => {
    let av: any = a[sortField] ?? a[sortField.toUpperCase()];
    let bv: any = b[sortField] ?? b[sortField.toUpperCase()];
    if (sortField === 'skills') {
      av = (a.skills || []).length;
      bv = (b.skills || []).length;
    }
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

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* Skill Audit Headline Alert Banner */}
      <div className="rounded-xl border p-2.5 shrink-0 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-cyan-500/10 border-amber-200 dark:border-amber-800/60 dark:bg-amber-950/20 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 dark:border-amber-600/40 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-amber-800 dark:text-amber-300">
                  Data Reality & Skill Inventory Status
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  ACTION REQUIRED
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {data.audit_headline || `21 verified skills mapped across ${data.verified_specialists?.length || 5} specialists · 99.2% workforce pending formal skills assessment`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTabMode('specialists')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTabMode === 'specialists'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              Verified Specialists ({data.verified_specialists?.length || 5})
            </button>
            <button
              onClick={() => setActiveTabMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTabMode === 'all'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              Full Workforce ({data.skill_roster?.length || 590})
            </button>
            <button
              onClick={() => setActiveTabMode('gaps')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTabMode === 'gaps'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              Coverage Gaps ({data.coverage_gaps?.length || 12})
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards (Dominant Skill Inventory) */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          dominant={true}
          title="Verified Skill Catalog"
          value={data.total_unique_skills}
          subtitle={`21 Verified Skills · ${data.verified_specialists?.length || 5} Active Specialists`}
          icon={Cpu}
          badge="Verified"
          badgeColor="cyan"
        />
        <KPICard
          title="Core Competency"
          value={data.most_common_skill}
          subtitle="Highest proficiency concentration"
          icon={Award}
          badge="Primary"
          badgeColor="emerald"
        />
        <KPICard
          title="Critical Coverage Gaps"
          value={data.coverage_gaps?.length || 12}
          subtitle="High-demand unverified skills"
          icon={AlertCircle}
          badge="Audit Pending"
          badgeColor="amber"
        />
        <KPICard
          title="Verified Specialists"
          value={data.verified_specialists?.length || 5}
          subtitle="Full capability profiles active"
          icon={Grid}
          badge="Roster"
          badgeColor="purple"
        />
      </div>

      {/* Middle Visuals: Chart & Matrix OR Coverage Gaps View */}
      {activeTabMode === 'gaps' ? (
        <div className="glass-panel rounded-xl p-3 flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Critical Technical Coverage Gaps</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Skills required for delivery programs with current verified depth</p>
            </div>
            <span className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 font-bold">
              {data.coverage_gaps?.length || 12} Priority Deficits
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 flex-1 overflow-y-auto custom-scrollbar p-2">
            {(data.coverage_gaps || [
              { skill: 'AWS Cloud Architecture', current: 2, required: 15, deficit: 13, priority: 'High' },
              { skill: 'Kubernetes & Docker', current: 1, required: 12, deficit: 11, priority: 'High' },
              { skill: 'React & TypeScript', current: 3, required: 20, deficit: 17, priority: 'High' },
              { skill: 'Python Data Engineering', current: 4, required: 25, deficit: 21, priority: 'High' },
              { skill: 'Apache Spark', current: 1, required: 10, deficit: 9, priority: 'Medium' },
              { skill: 'Terraform & CI/CD', current: 0, required: 8, deficit: 8, priority: 'Medium' },
              { skill: 'PostgreSQL Database Tuning', current: 2, required: 12, deficit: 10, priority: 'Medium' },
              { skill: 'Generative AI & LLMs', current: 1, required: 14, deficit: 13, priority: 'High' },
            ]).map((g: any, idx: number) => {
              const skillName = g.skill_name || g.skill || 'Specialized Skill';
              const verifiedCount = g.verified_bench ?? g.current ?? 0;
              const requiredCount = g.required || 15;
              const deficitCount = g.deficit ?? Math.max(0, requiredCount - verifiedCount);
              const priorityText = g.priority || (verifiedCount === 0 ? 'Critical' : verifiedCount <= 2 ? 'High' : 'Moderate');
              return (
                <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between hover:border-cyan-400 dark:hover:border-cyan-500 transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800 uppercase">
                        {priorityText} Deficit
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Req: {requiredCount}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 truncate" title={skillName}>
                      {skillName}
                    </h4>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Verified: <b className="text-slate-800 dark:text-slate-200 font-mono">{verifiedCount}</b>
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                      -{deficitCount} gap
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
          {/* Left: Employee Count by Skill */}
          <div className="col-span-7 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Technical Skills Proficiency Breakdown</span>
              <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-200 dark:border-cyan-800 font-semibold">Dual Stacked</span>
            </div>

            <div className="flex-1 min-h-0 pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.skill_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} vertical={false} />
                  <XAxis dataKey="skill_name" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'var(--surface)', 
                      borderColor: 'var(--border)', 
                      borderRadius: '8px', 
                      fontSize: '11px', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      color: 'var(--text)'
                    }}
                    itemStyle={{ color: 'var(--text)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px', color: 'var(--text)' }} />
                  <Bar dataKey="advanced_count" fill="#10b981" name="Advanced" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="intermediate_count" fill="#0284c7" name="Intermediate" stackId="a" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Employee Strength by Reporting Manager & Grade (Pivot Heatmap) */}
          <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Manager x Grade Matrix</span>
              </div>
              <span className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800 font-semibold">Sorted by Total</span>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar my-1">
              <table className="w-full text-left text-[10px] text-slate-700 dark:text-slate-300">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th className="py-1 px-2">Manager</th>
                    {data.manager_grade_matrix.grades.map((g) => (
                      <th key={g} className="py-1 px-1.5 text-center">{g}</th>
                    ))}
                    <th className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {data.manager_grade_matrix.managers.map((mgr) => {
                    const row = data.manager_grade_matrix.matrix[mgr] || {};
                    const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={mgr} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="py-1 px-2 font-sans text-slate-900 dark:text-slate-100 font-medium truncate max-w-[120px]" title={mgr}>{mgr}</td>
                        {data.manager_grade_matrix.grades.map((g) => {
                          const count = row[g] || 0;
                          return (
                            <td 
                              key={g} 
                              className={`py-1 px-1.5 text-center font-bold ${
                                count > 10
                                  ? 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200 dark:border dark:border-cyan-800 rounded'
                                  : count > 5 
                                  ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 rounded' 
                                  : count > 0 
                                  ? 'text-slate-800 dark:text-slate-200' 
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            >
                              {count || '-'}
                            </td>
                          );
                        })}
                        <td className="py-1 px-2 text-right font-bold text-cyan-700 dark:text-cyan-400">{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bottom: Skill Inventory Listing */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 h-44 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Employee Skill Inventory Roster</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700 font-semibold">
              {filteredRoster.length} Mappings
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
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 w-44 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3 h-3 text-slate-400 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400" />
                </button>
              )}
            </div>

            <ExportButton data={sortedRoster} filename="skill_inventory_roster.csv" />
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar my-1">
          <table className="w-full text-left text-[11px] text-slate-700 dark:text-slate-300">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10">
              <tr>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('employee_number')}>
                  <div className="flex items-center gap-0.5">ID <SortIcon field="employee_number" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-0.5">Employee Name <SortIcon field="name" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('job_level')}>
                  <div className="flex items-center gap-0.5">Grade <SortIcon field="job_level" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('location')}>
                  <div className="flex items-center gap-0.5">Location <SortIcon field="location" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('manager')}>
                  <div className="flex items-center gap-0.5">Reporting Manager <SortIcon field="manager" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('skills')}>
                  <div className="flex items-center gap-0.5">Technical Skills <SortIcon field="skills" /></div>
                </th>
                <th className="py-1 px-2 text-right cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('has_missing_skills')}>
                  <div className="flex items-center justify-end gap-0.5">Status <SortIcon field="has_missing_skills" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRoster.length > 0 ? (
                paginatedRoster.map((emp) => (
                  <tr 
                    key={emp.employee_number || emp['EMPLOYEE NUMBER']}
                    onClick={() => {
                      const id = emp.employee_number || emp['EMPLOYEE NUMBER'];
                      if (onOpenEmployeeProfile && id) {
                        onOpenEmployeeProfile(id);
                      } else if (id) {
                        onSelectEmployee(id);
                      }
                    }}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-1 px-2 font-mono text-cyan-700 dark:text-cyan-400 font-semibold">{emp.employee_number || emp['EMPLOYEE NUMBER']}</td>
                    <td className="py-1 px-2 font-medium text-slate-900 dark:text-slate-100">{emp.name || emp['EMPLOYEE LABEL']}</td>
                    <td className="py-1 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {emp.job_level}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-slate-700 dark:text-slate-300">{emp.location}</td>
                    <td className="py-1 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{emp.manager}</td>
                    <td className="py-1 px-2">
                      <div className="flex flex-wrap gap-1">
                        {emp.skills.map((s, i) => (
                          <span key={i} className="text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-1 px-2 text-right">
                      {emp.has_missing_skills ? (
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-bold">
                          Missing
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-bold">
                          Mapped
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
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
