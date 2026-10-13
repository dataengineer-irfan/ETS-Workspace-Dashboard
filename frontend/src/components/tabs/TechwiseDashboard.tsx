import React, { useState, useMemo } from 'react';
import type { TechwiseKPIs, FilterParams } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
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
  ExternalLink
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
  Cell,
  LabelList
} from 'recharts';

interface TechwiseDashboardProps {
  data: TechwiseKPIs | null;
  loading: boolean;
  filters?: FilterParams;
  setFilters?: React.Dispatch<React.SetStateAction<FilterParams>>;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
  techwiseMode?: 'depth' | 'modules' | 'matrix' | 'gaps';
  setTechwiseMode?: (mode: 'depth' | 'modules' | 'matrix' | 'gaps') => void;
}

export const TechwiseDashboard: React.FC<TechwiseDashboardProps> = ({
  data,
  loading,
  filters = {},
  setFilters,
  onSelectEmployee,
  onOpenEmployeeProfile,
  techwiseMode: propMode,
  setTechwiseMode: propSetMode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('primary_skill_exp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeExpBand, setActiveExpBand] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<'depth' | 'modules' | 'matrix' | 'gaps'>('depth');
  const rightPanelMode = propMode ?? internalMode;
  const setRightPanelMode = propSetMode ?? setInternalMode;
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

  // Toggle experience / seniority depth band filter
  const handleExpBandClick = (bandName: string) => {
    setActiveExpBand((prev) => (prev === bandName ? null : bandName));
    setCurrentPage(1);
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
    return <DashboardSkeleton variant="tech" title="Loading Technical Capability & Skills Analytics..." />;
  }

  if ((data.total_headcount ?? data.skill_roster?.length ?? 0) === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[400px]">
        <EmptyState
          title="No Technical Capability Records Match Active Filters"
          description="None of the verified technical competencies match the active filter criteria. Reset filters to restore view."
          onResetFilters={() => setFilters?.({})}
          resetLabel="Clear All Filters"
        />
      </div>
    );
  }

  // Filter and sort roster
  const rawList = data.skill_roster || [];

  const filteredRoster = rawList.filter((emp: any) => {
    // Seniority / Experience band filter
    if (activeExpBand) {
      const exp = Number(emp.primary_skill_exp ?? 0);
      if (activeExpBand.startsWith('< 2') && !(exp < 2.0)) return false;
      if (activeExpBand.startsWith('2 - 5') && !(exp >= 2.0 && exp < 5.0)) return false;
      if (activeExpBand.startsWith('5 - 8') && !(exp >= 5.0 && exp < 8.0)) return false;
      if (activeExpBand.startsWith('8+') && !(exp >= 8.0)) return false;
    }

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
    if (sortField === 'skills' || sortField === 'secondary_skills') {
      const getLen = (item: any) => {
        if (Array.isArray(item.skills)) return item.skills.length;
        if (Array.isArray(item.secondary_skills)) return item.secondary_skills.length;
        if (typeof item.secondary_skills === 'string') return item.secondary_skills.split(',').filter(Boolean).length;
        if (typeof item.skills === 'string') return item.skills.split(',').filter(Boolean).length;
        return 0;
      };
      av = getLen(a);
      bv = getLen(b);
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

  const renderTopTotalLabel = (isTopBar: 'advanced' | 'intermediate') => (props: any) => {
    const { x, y, width, index } = props;
    if (x == null || y == null) return null;
    
    let item: any = null;
    if (isTopBar === 'advanced') {
      item = data?.skill_distribution?.[index];
      // Only render on advanced bar if there is NO intermediate bar on top of it
      if (!item || (item.intermediate_count || 0) > 0) return null;
    } else {
      // For intermediate bar, only items with intermediate_count > 0 were rendered
      const nonZeroItems = (data?.skill_distribution || []).filter((s) => (s.intermediate_count || 0) > 0);
      item = nonZeroItems[index];
      if (!item) return null;
    }

    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        className="font-mono font-bold text-[9.5px] fill-slate-700 dark:fill-cyan-300"
      >
        {item.employee_count}
      </text>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-2 select-none h-full min-h-0">
      {/* Top 4 KPI Cards (Mathematically Reconciled 1:1 Headcount) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        <KPICard
          dominant={true}
          compact={true}
          title="Skilled Workforce Headcount"
          value={data.total_headcount ?? 590}
          subtitle="100% Mapped · 1:1 Headcount Ratio"
          icon={Users}
          badge="1:1 Ratio"
          badgeColor="emerald"
        />
        <KPICard
          compact={true}
          title="Core Primary Disciplines"
          value={data.total_unique_skills}
          subtitle={`Dominant: ${data.most_common_skill}`}
          icon={Cpu}
          badge="Disciplines"
          badgeColor="cyan"
        />
        <KPICard
          compact={true}
          title="Avg Primary Skill Depth"
          value={`${data.avg_skill_experience ?? 5.5} Yrs`}
          subtitle="Tenure focused in primary competency"
          icon={Award}
          badge="Specialization"
          badgeColor="cyan"
        />
        <KPICard
          compact={true}
          title="Cross-Skilled Capability"
          value={`${data.cross_skilled_pct ?? 100}%`}
          subtitle={`${data.cross_skilled_count ?? 590} with secondary proficiencies`}
          icon={Layers}
          badge="Multi-Skilled"
          badgeColor="purple"
        />
      </div>

      {/* Middle Visuals: Left Primary Skill Bar Chart + Right Context Panel */}
      <div className="grid grid-cols-12 gap-2 min-h-0 flex-[1.15]">
        {/* Left: Headcount by Primary Technical Skill (1:1 Allocation) */}
        <div className="col-span-12 xl:col-span-8 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Headcount by Primary Technical Skill
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                1:1 Allocated · Σ = {data.total_headcount || 590}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
              Click bar to filter workforce
            </span>
          </div>

          <div className="flex-1 min-h-0 pt-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.skill_distribution}
                layout="horizontal"
                barCategoryGap="4%"
                margin={{ top: 12, right: 16, left: 6, bottom: 40 }}
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
                  angle={-30}
                  textAnchor="end"
                  height={44}
                />
                <YAxis 
                  stroke="var(--muted)" 
                  tick={{ fontSize: 9.5, fill: 'var(--muted)' }} 
                  width={28}
                  domain={[0, 'auto']}
                  allowDataOverflow={false}
                />
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
                  maxBarSize={66}
                  radius={[3, 3, 0, 0]} 
                  onClick={(entry: any) => handleSkillSelect(entry?.skill_name || entry?.payload?.skill_name)}
                >
                  <LabelList content={renderTopTotalLabel('advanced')} />
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
                  maxBarSize={66}
                  radius={[3, 3, 0, 0]} 
                  onClick={(entry: any) => handleSkillSelect(entry?.skill_name || entry?.payload?.skill_name)}
                >
                  <LabelList content={renderTopTotalLabel('intermediate')} />
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
        <div className="col-span-12 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-0">
          {rightPanelMode === 'depth' && (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    Technical Depth & Seniority Bands
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeExpBand && (
                    <button
                      onClick={() => setActiveExpBand(null)}
                      className="text-[9.5px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-800 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900 cursor-pointer flex items-center gap-1"
                      title="Clear seniority filter"
                    >
                      <span>Clear Filter</span>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  <span className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800 font-semibold font-mono">
                    Avg: {data.avg_skill_experience || 5.5} Yrs
                  </span>
                </div>
              </div>

              {/* Seniority Depth Progress Bars (Interactive Click-to-Filter) */}
              <div className="flex flex-col gap-2 py-1.5 flex-1 justify-center">
                {(data.skill_depth_distribution || [
                  { band: '< 2 Yrs (Junior)', count: 153, percentage: 25.9 },
                  { band: '2 - 5 Yrs (Mid)', count: 81, percentage: 13.7 },
                  { band: '5 - 8 Yrs (Senior)', count: 256, percentage: 43.4 },
                  { band: '8+ Yrs (Lead / SME)', count: 100, percentage: 16.9 },
                ]).map((b, idx) => {
                  const isSelected = activeExpBand === b.band;
                  const colors = [
                    'from-amber-400 to-amber-500',
                    'from-sky-500 to-cyan-500',
                    'from-teal-500 to-emerald-500',
                    'from-indigo-500 to-purple-600',
                  ];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleExpBandClick(b.band)}
                      title={`Click to filter roster by ${b.band} depth`}
                      className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50/90 dark:bg-cyan-950/50 shadow-xs ring-1 ring-cyan-500'
                          : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60 hover:border-cyan-300 dark:hover:border-cyan-700 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${isSelected ? 'text-cyan-900 dark:text-cyan-200 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
                            {b.band}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] bg-cyan-600 text-white font-bold px-1.5 py-0.2 rounded-full font-mono">
                              Filtered
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{b.count}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">({b.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]}`}
                          style={{ width: `${b.percentage}%` }}
                        ></div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Senior Specialists Highlight */}
              {(() => {
                const depthArr = data.skill_depth_distribution || [];
                const seniorBands = depthArr.filter((b: any) => b.band && (b.band.includes('Senior') || b.band.includes('Lead') || b.band.includes('8+')));
                const seniorPct = seniorBands.length > 0 
                  ? seniorBands.reduce((acc: number, b: any) => acc + (b.percentage || b.pct || 0), 0).toFixed(1)
                  : '60.3';
                const avgDepth = data.avg_skill_experience || 5.5;
                return (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 shrink-0 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Seniority Concentration: <b className="text-emerald-600 dark:text-emerald-400 font-mono">{seniorPct}%</b> Senior+</span>
                    <span>Avg Skill Depth: <b className="text-cyan-600 dark:text-cyan-400 font-mono">{avgDepth} Yrs</b></span>
                  </div>
                );
              })()}
            </div>
          )}

          {rightPanelMode === 'matrix' && (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    Manager x Primary Skill Matrix
                    {data.manager_skill_matrix?.skills && data.manager_skill_matrix.skills.length > 5 && (
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        (Top 5 of {data.manager_skill_matrix.skills.length} skills)
                      </span>
                    )}
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
                        {data.manager_skill_matrix.skills.slice(0, 5).map((sk) => {
                          const isColActive = activeSkills.includes(sk);
                          return (
                            <th 
                              key={sk} 
                              onClick={() => handleSkillSelect(sk)}
                              className={`py-1 px-1 text-center truncate max-w-[70px] cursor-pointer transition-colors ${
                                isColActive 
                                  ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-100/60 dark:bg-cyan-950/80 font-bold' 
                                  : 'hover:text-cyan-600 dark:hover:text-cyan-400'
                              }`} 
                              title={`Click to filter by ${sk}`}
                            >
                              {sk.split(' ')[0]}
                            </th>
                          );
                        })}
                        <th className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {data.manager_skill_matrix.managers.map((mgr) => {
                        const row = data.manager_skill_matrix?.matrix[mgr] || {};
                        const rowTotal = data.manager_skill_matrix?.manager_totals[mgr] || 0;
                        const isMgrActive = activeManager.includes(mgr);
                        const cleanMgr = mgr.replace(/\s*\(\d+\)\s*$/, '').trim() || mgr;
                        return (
                          <tr
                            key={mgr}
                            onClick={() => handleManagerClick(mgr)}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                              isMgrActive ? 'bg-cyan-50/80 dark:bg-cyan-950/40 font-bold' : ''
                            }`}
                          >
                            <td className="py-1 px-2 font-sans text-slate-900 dark:text-slate-100 font-medium truncate max-w-[120px]" title={mgr}>
                              {cleanMgr}
                            </td>
                            {data.manager_skill_matrix?.skills.slice(0, 5).map((sk) => {
                              const count = row[sk] || 0;
                              return (
                                <td
                                  key={sk}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (count > 0 && setFilters) {
                                      setFilters((prev) => ({
                                        ...prev,
                                        manager: [mgr],
                                        skill_name: [sk]
                                      }));
                                    }
                                  }}
                                  title={count > 0 ? `Click to isolate ${cleanMgr} & ${sk} (${count})` : undefined}
                                  className={`py-1 px-1 text-center font-bold ${
                                    count > 0 ? 'cursor-pointer hover:ring-1 hover:ring-cyan-500 rounded transition-all' : ''
                                  } ${
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
                            <td 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManagerClick(mgr);
                              }}
                              title={`Filter all by ${cleanMgr} (${rowTotal})`}
                              className="py-1 px-2 text-right font-bold text-cyan-700 dark:text-cyan-400 cursor-pointer hover:underline"
                            >
                              {rowTotal}
                            </td>
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
                  const req = g.required ?? null;
                  const deficit = req !== null ? (g.deficit ?? Math.max(0, req - bench)) : null;
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
                          <span>Target: <b className="text-slate-800 dark:text-slate-200 font-mono">{req !== null ? req : 'Active'}</b></span>
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          deficit === null
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : deficit === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {deficit === null ? 'Active' : deficit === 0 ? 'Surplus' : `-${deficit} Gap`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rightPanelMode === 'modules' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    MMIS Enterprise Module Distribution
                  </span>
                </div>
                <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800 font-semibold">
                  {(data.module_distribution || []).length} Modules · Click to Filter
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar my-1 space-y-1">
                {(data.module_distribution || []).map((mod: any, idx: number) => {
                  const isActive = Array.isArray(filters.module)
                    ? filters.module.map((m: string) => m.toLowerCase()).includes(mod.module_name.toLowerCase())
                    : (filters.module as string | undefined)?.toLowerCase() === mod.module_name.toLowerCase();
                  const javaBar = Math.round((mod.java_count / Math.max(1, mod.employee_count)) * 100);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (!setFilters) return;
                        setFilters((prev: FilterParams) => {
                          const current = prev.module;
                          const arr = Array.isArray(current) ? current : current ? [current] : [];
                          if (arr.map((m: string) => m.toLowerCase()).includes(mod.module_name.toLowerCase())) {
                            const next = arr.filter((m: string) => m.toLowerCase() !== mod.module_name.toLowerCase());
                            const updated = { ...prev };
                            if (next.length === 0) delete updated.module;
                            else updated.module = next;
                            return updated;
                          }
                          return { ...prev, module: [...arr, mod.module_name] };
                        });
                      }}
                      className={`w-full text-left p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/40 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold truncate ${isActive ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-900 dark:text-slate-100'}`}>
                              {mod.module_name}
                            </span>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
                                style={{ width: `${javaBar}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                              {mod.java_count}J
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold font-mono text-slate-800 dark:text-slate-200">
                            {mod.employee_count}
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                            {mod.percentage}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Interactive Capability Roster */}
      <div className="glass-panel rounded-xl p-2.5 min-h-0 flex-1 flex flex-col justify-between overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Workforce Capability Roster
            </span>
            <span className="text-[10px] text-cyan-800 dark:text-cyan-300 bg-cyan-100/70 dark:bg-cyan-950/70 px-2 py-0.5 rounded font-mono border border-cyan-200 dark:border-cyan-800 font-bold">
              {filteredRoster.length} Active Records
            </span>
            {activeSkills.length > 0 && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1 font-medium">
                Skill: <b className="text-cyan-600 dark:text-cyan-400">{activeSkills.join(', ')}</b>
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
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Clear skill filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {activeManager.length > 0 && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1 font-medium">
                Mgr: <b className="text-teal-600 dark:text-teal-400">{activeManager.join(', ')}</b>
                <button
                  onClick={() => {
                    if (setFilters) {
                      setFilters((prev) => {
                        const next = { ...prev };
                        delete next.manager;
                        return next;
                      });
                    }
                  }}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Clear manager filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {activeExpBand && (
              <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1 font-medium">
                Depth: <b className="text-amber-900 dark:text-amber-200">{activeExpBand}</b>
                <button
                  onClick={() => setActiveExpBand(null)}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                  title="Clear seniority filter"
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
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-1 rounded-md focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 w-52 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <ExportButton data={sortedRoster} filename="workforce_capability_roster.csv" />
            
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>{currentPage} / {totalPages}</span>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors flex items-center justify-center"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors flex items-center justify-center"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar my-1">
          <table className="w-full min-w-[800px] text-left text-[11px] text-slate-700 dark:text-slate-300">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10">
              <tr>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'employee_number' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('employee_number'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('employee_number')}
                >
                  <div className="flex items-center gap-0.5">ID <SortIcon field="employee_number" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('name'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-0.5">Employee Name & Role <SortIcon field="name" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'job_level' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('job_level'); } }}
                  className="py-1 px-1.5 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('job_level')}
                >
                  <div className="flex items-center gap-0.5">Grade <SortIcon field="job_level" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'department' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('department'); } }}
                  className="py-1 px-1.5 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('department')}
                >
                  <div className="flex items-center gap-0.5">Dept <SortIcon field="department" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'location' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('location'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('location')}
                >
                  <div className="flex items-center gap-0.5">Location <SortIcon field="location" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'manager' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('manager'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('manager')}
                >
                  <div className="flex items-center gap-0.5">Reporting Manager <SortIcon field="manager" /></div>
                </th>
                <th
                  tabIndex={0}
                  role="button"
                  aria-sort={sortField === 'primary_skill' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('primary_skill'); } }}
                  className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  onClick={() => toggleSort('primary_skill')}
                >
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

                  const rawName = String(emp.name || emp['EMPLOYEE LABEL'] || '');
                  const cleanName = rawName.replace(/\s*\(\d+\)\s*$/, '').trim() || rawName;
                  const rawMgr = String(emp.manager || '');
                  const cleanMgr = rawMgr.replace(/\s*\(\d+\)\s*$/, '').trim() || rawMgr;

                  return (
                    <tr 
                      key={id}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onOpenEmployeeProfile && id) {
                            onOpenEmployeeProfile(id);
                          } else if (id) {
                            onSelectEmployee(id);
                          }
                        }
                      }}
                      onClick={() => {
                        if (onOpenEmployeeProfile && id) {
                          onOpenEmployeeProfile(id);
                        } else if (id) {
                          onSelectEmployee(id);
                        }
                      }}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group focus:outline-hidden focus:bg-cyan-50/20"
                    >
                      <td className="py-1 px-2 font-mono text-cyan-700 dark:text-cyan-400 font-bold text-[10px]">
                        {id}
                      </td>
                      <td className="py-1 px-2 min-w-[130px]">
                        <div className="font-medium text-slate-900 dark:text-slate-100 leading-tight">
                          {cleanName}
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
                        <div>{emp.department}</div>
                        {emp.module && !['none', 'null', 'undefined', '', 'global'].includes(String(emp.module).toLowerCase()) && (
                          <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[70px]" title={`Module: ${emp.module}`}>
                            {emp.module}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-2 text-[10px] text-slate-600 dark:text-slate-400">
                        {emp.location}
                      </td>
                      <td className="py-1 px-2 text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={emp.manager}>
                        {cleanMgr}
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
                  <td colSpan={9} className="py-6">
                    <EmptyState
                      compact
                      title="No matching employees found"
                      description={searchTerm ? `No records matched your search query "${searchTerm}".` : 'No engineers match the current filter selection.'}
                      onResetFilters={searchTerm ? () => setSearchTerm('') : (setFilters ? () => setFilters({}) : undefined)}
                      resetLabel={searchTerm ? 'Clear Search' : 'Reset Filters'}
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
