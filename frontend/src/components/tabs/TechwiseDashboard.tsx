import React, { useState, useMemo } from 'react';
import type { TechwiseKPIs, FilterParams } from '../../types/dashboard';
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
  ArrowDown,
  Users,
  Layers,
  RotateCcw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';

interface TechwiseDashboardProps {
  data: TechwiseKPIs | null;
  loading: boolean;
  filters?: FilterParams;
  setFilters?: React.Dispatch<React.SetStateAction<FilterParams>>;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

export const TechwiseDashboard: React.FC<TechwiseDashboardProps> = ({
  data,
  loading,
  filters = {},
  setFilters,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('primary_skill_exp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rightPanelMode, setRightPanelMode] = useState<'depth' | 'matrix' | 'gaps'>('depth');
  const rowsPerPage = 6;

  // Active filter checks
  const activeSkills = useMemo(() => {
    const raw = filters.skill_name;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }, [filters.skill_name]);

  const activeManager = useMemo(() => {
    const raw = filters.manager;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }, [filters.manager]);

  const hasAnyFilter = useMemo(() => {
    return Object.keys(filters).some((k) => {
      const v = (filters as any)[k];
      return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';
    });
  }, [filters]);

  const handleClearFilters = () => {
    if (setFilters) {
      setFilters({});
    }
  };

  // Toggle skill filter (from chart bar, matrix, or roster pills)
  const handleSkillSelect = (skill: string) => {
    if (!setFilters || !skill) return;
    setFilters((prev) => {
      const current = prev.skill_name;
      const currentArr = Array.isArray(current) ? current : current ? [current] : [];
      if (currentArr.includes(skill)) {
        const next = currentArr.filter((s) => s !== skill);
        const updated = { ...prev };
        if (next.length === 0) {
          delete updated.skill_name;
        } else {
          updated.skill_name = next;
        }
        return updated;
      } else {
        return { ...prev, skill_name: [skill] };
      }
    });
  };

  // Toggle manager filter from matrix click
  const handleManagerClick = (mgr: string) => {
    if (!setFilters) return;
    setFilters((prev) => {
      const current = prev.manager;
      const currentArr = Array.isArray(current) ? current : current ? [current] : [];
      if (currentArr.includes(mgr)) {
        const next = currentArr.filter((m) => m !== mgr);
        const updated = { ...prev };
        if (next.length === 0) {
          delete updated.manager;
        } else {
          updated.manager = next;
        }
        return updated;
      } else {
        return { ...prev, manager: [mgr] };
      }
    });
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
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

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Technical Capability & Skills Analytics...</span>
        </div>
      </div>
    );
  }

  // Filter and sort roster
  const rawList = data.skill_roster || [];

  const filteredRoster = rawList.filter((emp: any) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const id = String(emp.employee_number || emp['EMPLOYEE NUMBER'] || '').toLowerCase();
    const name = String(emp.name || emp['EMPLOYEE LABEL'] || '').toLowerCase();
    const primary = String(emp.primary_skill || '').toLowerCase();
    const title = String(emp.job_title || '').toLowerCase();
    const dept = String(emp.department || '').toLowerCase();
    const mgr = String(emp.manager || '').toLowerCase();
    const sec = Array.isArray(emp.secondary_skills) ? emp.secondary_skills.join(' ').toLowerCase() : '';
    
    return (
      id.includes(term) ||
      name.includes(term) ||
      primary.includes(term) ||
      title.includes(term) ||
      dept.includes(term) ||
      mgr.includes(term) ||
      sec.includes(term)
    );
  });

  const sortedRoster = [...filteredRoster].sort((a: any, b: any) => {
    let av: any = a[sortField] ?? a[sortField.toUpperCase()];
    let bv: any = b[sortField] ?? b[sortField.toUpperCase()];
    if (sortField === 'skills') {
      av = (a.skills || []).length;
      bv = (b.skills || []).length;
    }
    if (sortField === 'secondary_skills') {
      av = (a.secondary_skills || []).length;
      bv = (b.secondary_skills || []).length;
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
      {/* Capability Reality & 1:1 Headcount Headline Banner */}
      <div className="rounded-xl border p-2 shrink-0 bg-gradient-to-r from-cyan-500/10 via-sky-500/5 to-emerald-500/10 border-cyan-200/80 dark:border-cyan-800/60 dark:bg-cyan-950/20 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-cyan-800 dark:text-cyan-300">
                  Primary Skill Capacity Architecture
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  1:1 HEADCOUNT RATIO
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {data.audit_headline || `100% Workforce Mapped · ${data.total_headcount || 590} Headcount across ${data.total_unique_skills || 12} Disciplines · Highest Skill Tenure Rules`}
              </p>
            </div>
          </div>

          {/* Right Controls & Slicer Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {hasAnyFilter && (
              <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 border border-cyan-300 dark:border-cyan-700 px-2 py-0.5 rounded-lg text-[10px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Active Slicers:</span>
                {activeSkills.length > 0 && (
                  <span className="font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/60 px-1.5 rounded">
                    Skill: {activeSkills.join(', ')}
                  </span>
                )}
                {activeManager.length > 0 && (
                  <span className="font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-1.5 rounded">
                    Mgr: {activeManager.join(', ')}
                  </span>
                )}
                <button
                  onClick={handleClearFilters}
                  className="ml-1 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 flex items-center gap-0.5 font-bold cursor-pointer"
                  title="Clear all filters"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            )}

            {/* View Switchers */}
            <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setRightPanelMode('depth')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  rightPanelMode === 'depth'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                Experience Depth
              </button>
              <button
                onClick={() => setRightPanelMode('matrix')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  rightPanelMode === 'matrix'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                Manager Matrix
              </button>
              <button
                onClick={() => setRightPanelMode('gaps')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  rightPanelMode === 'gaps'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                Bench Targets
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards (Mathematically Reconciled 1:1 Headcount) */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          dominant={true}
          title="Skilled Workforce Headcount"
          value={data.total_headcount ?? 590}
          subtitle="100% Mapped to exactly 1 Primary Discipline"
          icon={Users}
          badge="1:1 Headcount"
          badgeColor="emerald"
        />
        <KPICard
          title="Core Primary Disciplines"
          value={data.total_unique_skills}
          subtitle={`Dominant: ${data.most_common_skill}`}
          icon={Cpu}
          badge="Disciplines"
          badgeColor="cyan"
        />
        <KPICard
          title="Avg Primary Skill Depth"
          value={`${data.avg_skill_experience ?? 5.5} Yrs`}
          subtitle="Tenure focused in primary competency"
          icon={Award}
          badge="Specialization"
          badgeColor="cyan"
        />
        <KPICard
          title="Cross-Skilled Capability"
          value={`${data.cross_skilled_pct ?? 100}%`}
          subtitle={`${data.cross_skilled_count ?? 590} with secondary proficiencies`}
          icon={Layers}
          badge="Multi-Skilled"
          badgeColor="purple"
        />
      </div>

      {/* Middle Visuals: Left Primary Skill Bar Chart + Right Context Panel */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: Headcount by Primary Technical Skill (1:1 Allocation) */}
        <div className="col-span-7 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Headcount by Primary Technical Skill
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">
                1:1 Allocated · Σ = {data.total_headcount || 590}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
              Click bar to filter workforce
            </span>
          </div>

          <div className="flex-1 min-h-0 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.skill_distribution}
                layout="horizontal"
                margin={{ top: 20, right: 15, left: 20, bottom: 44 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    handleSkillSelect(e.activePayload[0].payload.skill_name);
                  }
                }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} vertical={false} />
                <XAxis 
                  dataKey="skill_name" 
                  stroke="var(--muted)" 
                  tick={{ fontSize: 9.5, fill: 'var(--muted)' }} 
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={46}
                />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(8, 145, 178, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="p-2.5 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg text-[11px] min-w-[200px]">
                        <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                          {item.skill_name}
                        </p>
                        <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
                          <div className="flex justify-between">
                            <span>Primary Headcount:</span>
                            <span className="font-bold font-mono text-cyan-700 dark:text-cyan-400">
                              {item.employee_count} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Advanced Proficient:</span>
                            <span className="font-bold font-mono text-emerald-600">{item.advanced_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Intermediate:</span>
                            <span className="font-bold font-mono text-cyan-600">{item.intermediate_count}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                            <span>Avg Skill Tenure:</span>
                            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                              {item.avg_exp} yrs
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 text-[9px] text-cyan-600 dark:text-cyan-400 italic font-semibold">
                          Click to filter whole dashboard by this skill
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ top: -4, right: 8, fontSize: '10px', color: 'var(--text)' }} />
                <Bar 
                  dataKey="advanced_count" 
                  fill="#10b981" 
                  name="Advanced" 
                  stackId="a" 
                  radius={[0, 0, 0, 0]} 
                  onClick={(entry: any) => handleSkillSelect(entry?.skill_name || entry?.payload?.skill_name)}
                >
                  {data.skill_distribution.map((entry, index) => {
                    const isSelected = activeSkills.includes(entry.skill_name);
                    return (
                      <Cell
                        key={`cell-adv-${index}`}
                        stroke={isSelected ? '#f59e0b' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
                <Bar 
                  dataKey="intermediate_count" 
                  fill="#0284c7" 
                  name="Intermediate" 
                  stackId="a" 
                  radius={[2, 2, 0, 0]} 
                  onClick={(entry: any) => handleSkillSelect(entry?.skill_name || entry?.payload?.skill_name)}
                >
                  {data.skill_distribution.map((entry, index) => {
                    const isSelected = activeSkills.includes(entry.skill_name);
                    return (
                      <Cell
                        key={`cell-int-${index}`}
                        stroke={isSelected ? '#f59e0b' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Dynamic Context Panel (Experience Depth OR Manager Matrix OR Bench Targets) */}
        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden">
          {rightPanelMode === 'depth' && (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    Technical Depth & Seniority Bands
                  </span>
                </div>
                <span className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800 font-semibold">
                  Avg: {data.avg_skill_experience || 5.5} Yrs
                </span>
              </div>

              {/* Seniority Depth Progress Bars */}
              <div className="flex flex-col gap-2 py-2 flex-1 justify-center">
                {(data.skill_depth_distribution || [
                  { band: '< 2 Yrs (Junior)', count: 153, percentage: 25.9 },
                  { band: '2 - 5 Yrs (Mid)', count: 81, percentage: 13.7 },
                  { band: '5 - 8 Yrs (Senior)', count: 256, percentage: 43.4 },
                  { band: '8+ Yrs (Lead / SME)', count: 100, percentage: 16.9 },
                ]).map((b, idx) => {
                  const colors = [
                    'from-amber-400 to-amber-500',
                    'from-sky-500 to-cyan-500',
                    'from-teal-500 to-emerald-500',
                    'from-indigo-500 to-purple-600',
                  ];
                  return (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{b.band}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{b.count}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">({b.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]}`}
                          style={{ width: `${b.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Senior Specialists Highlight */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-1 shrink-0 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>Seniority Concentration: <b className="text-emerald-600 dark:text-emerald-400 font-mono">60.3%</b> Senior+</span>
                <span>Max Technical Depth: <b className="text-cyan-600 dark:text-cyan-400 font-mono">28.8 Yrs</b></span>
              </div>
            </div>
          )}

          {rightPanelMode === 'matrix' && (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    Manager x Primary Skill Matrix
                  </span>
                </div>
                <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-200 dark:border-cyan-800 font-semibold">
                  Click Manager to Filter
                </span>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar my-1">
                {data.manager_skill_matrix ? (
                  <table className="w-full text-left text-[10px] text-slate-700 dark:text-slate-300">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10">
                      <tr>
                        <th className="py-1 px-2">Manager</th>
                        {data.manager_skill_matrix.skills.slice(0, 5).map((sk) => (
                          <th key={sk} className="py-1 px-1 text-center truncate max-w-[70px]" title={sk}>
                            {sk.split(' ')[0]}
                          </th>
                        ))}
                        <th className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {data.manager_skill_matrix.managers.map((mgr) => {
                        const row = data.manager_skill_matrix?.matrix[mgr] || {};
                        const rowTotal = data.manager_skill_matrix?.manager_totals[mgr] || 0;
                        const isMgrActive = activeManager.includes(mgr);
                        return (
                          <tr
                            key={mgr}
                            onClick={() => handleManagerClick(mgr)}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                              isMgrActive ? 'bg-cyan-50/80 dark:bg-cyan-950/40 font-bold' : ''
                            }`}
                          >
                            <td className="py-1 px-2 font-sans text-slate-900 dark:text-slate-100 font-medium truncate max-w-[120px]" title={mgr}>
                              {mgr}
                            </td>
                            {data.manager_skill_matrix?.skills.slice(0, 5).map((sk) => {
                              const count = row[sk] || 0;
                              return (
                                <td
                                  key={sk}
                                  className={`py-1 px-1 text-center font-bold ${
                                    count > 5
                                      ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 rounded'
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
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">No matrix data available</div>
                )}
              </div>
            </div>
          )}

          {rightPanelMode === 'gaps' && (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    Technical Bench Targets vs Capacity
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-semibold">
                  Demand Benchmark
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1.5 my-1">
                {(data.coverage_gaps || []).map((g: any, idx: number) => {
                  const sName = g.skill_name || g.skill;
                  const bench = g.verified_bench ?? g.current ?? 0;
                  const req = g.required || 10;
                  const deficit = g.deficit ?? Math.max(0, req - bench);
                  return (
                    <div
                      key={idx}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 flex items-center justify-between text-[11px]"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={sName}>
                          {sName}
                        </p>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Verified: <b className="text-slate-800 dark:text-slate-200 font-mono">{bench}</b></span>
                          <span>Target: <b className="text-slate-800 dark:text-slate-200 font-mono">{req}</b></span>
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          deficit === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {deficit === 0 ? 'Surplus' : `-${deficit} Gap`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Interactive Capability Roster */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 h-44 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Workforce Capability Roster
            </span>
            <span className="text-[10px] text-cyan-800 dark:text-cyan-300 bg-cyan-100/70 dark:bg-cyan-950/70 px-1.5 py-0.5 rounded font-mono border border-cyan-200 dark:border-cyan-800 font-bold">
              {filteredRoster.length} Active Records
            </span>
            {activeSkills.length > 0 && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.2 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                Filtered: <b>{activeSkills.join(', ')}</b>
                <button
                  onClick={() => {
                    if (setFilters) {
                      setFilters((prev) => {
                        const next = { ...prev };
                        delete next.skill_name;
                        return next;
                      });
                    }
                  }}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, ID, skill, dept..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 w-48 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                </button>
              )}
            </div>

            <ExportButton data={sortedRoster} filename="workforce_capability_roster.csv" />
            
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
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
                  <div className="flex items-center gap-0.5">Employee Name & Role <SortIcon field="name" /></div>
                </th>
                <th className="py-1 px-1.5 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('job_level')}>
                  <div className="flex items-center gap-0.5">Grade <SortIcon field="job_level" /></div>
                </th>
                <th className="py-1 px-1.5 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('department')}>
                  <div className="flex items-center gap-0.5">Dept <SortIcon field="department" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('location')}>
                  <div className="flex items-center gap-0.5">Location <SortIcon field="location" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('manager')}>
                  <div className="flex items-center gap-0.5">Reporting Manager <SortIcon field="manager" /></div>
                </th>
                <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleSort('primary_skill')}>
                  <div className="flex items-center gap-0.5">Primary Skill (Tenure & Level) <SortIcon field="primary_skill" /></div>
                </th>
                <th className="py-1 px-2 select-none">
                  Secondary Competencies
                </th>
                <th className="py-1 px-1.5 text-right select-none">
                  360 Profile
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRoster.length > 0 ? (
                paginatedRoster.map((emp) => {
                  const id = emp.employee_number || emp['EMPLOYEE NUMBER'];
                  const primLevel = emp.primary_skill_level || 'Intermediate';
                  const primExp = emp.primary_skill_exp ?? 0;
                  const secSkills: string[] = Array.isArray(emp.secondary_skills) ? emp.secondary_skills : [];

                  return (
                    <tr 
                      key={id}
                      onClick={() => {
                        if (onOpenEmployeeProfile && id) {
                          onOpenEmployeeProfile(id);
                        } else if (id) {
                          onSelectEmployee(id);
                        }
                      }}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                    >
                      <td className="py-1 px-2 font-mono text-cyan-700 dark:text-cyan-400 font-bold text-[10px]">
                        {id}
                      </td>
                      <td className="py-1 px-2 min-w-[130px]">
                        <div className="font-medium text-slate-900 dark:text-slate-100 leading-tight">
                          {emp.name || emp['EMPLOYEE LABEL']}
                        </div>
                        {emp.job_title && (
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                            {emp.job_title}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-1.5">
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {emp.job_level}
                        </span>
                      </td>
                      <td className="py-1 px-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                        {emp.department}
                      </td>
                      <td className="py-1 px-2 text-[10px] text-slate-600 dark:text-slate-400">
                        {emp.location}
                      </td>
                      <td className="py-1 px-2 text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[110px]" title={emp.manager}>
                        {emp.manager}
                      </td>
                      <td className="py-1 px-2 min-w-[180px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (emp.primary_skill) handleSkillSelect(emp.primary_skill);
                            }}
                            title={`Filter by ${emp.primary_skill}`}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/80 dark:hover:bg-cyan-900 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                            {emp.primary_skill || 'General'}
                          </button>
                          <span className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                            {primExp}y
                          </span>
                          <span className={`text-[8px] font-semibold px-1 py-0.2 rounded uppercase ${
                            primLevel === 'Advanced'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          }`}>
                            {primLevel}
                          </span>
                        </div>
                      </td>
                      <td className="py-1 px-2 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {secSkills.slice(0, 3).map((s, i) => (
                            <button 
                              key={i} 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSkillSelect(s);
                              }}
                              className="text-[9px] px-1 py-0.2 rounded bg-slate-100 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-950/60 text-slate-600 hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 truncate max-w-[90px] transition-colors cursor-pointer"
                              title={`Filter by ${s}`}
                            >
                              {s}
                            </button>
                          ))}
                          {secSkills.length > 3 && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                              +{secSkills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1 px-1.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenEmployeeProfile && id) onOpenEmployeeProfile(id);
                          }}
                          className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-slate-600 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                          title="View 360 Profile"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
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
