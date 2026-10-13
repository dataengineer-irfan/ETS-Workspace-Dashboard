import React, { useState, useMemo } from 'react';
import type { HomeKPIs, EmployeeListItem, FilterParams } from '../../types/dashboard';
import {
  Users,
  Clock,
  Briefcase,
  Award,
  TrendingUp,
  Shield,
  Layers,
  BarChart3,
  Search,
  ExternalLink,
  LucideIcon,
  X,
  MapPin,
  PieChart as PieChartIcon,
  UserCheck,
  Sparkles,
  Building2,
  Compass,
  Filter,
  BadgeIndianRupee,
  Database,
} from 'lucide-react';
import { IndiaDeliveryMap } from '../common/IndiaDeliveryMap';
import { AgeDistributionChart } from '../common/AgeDistributionChart';
import { EmpTypeBreakdown } from '../common/EmpTypeBreakdown';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
import { ExportButton } from '../common/ExportButton';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';

export interface HomeDashboardProps {
  data: HomeKPIs | null;
  loading: boolean;
  onNavigateTab: (tab: string) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
  employeeList?: EmployeeListItem[];
  filters?: FilterParams;
  setFilters?: React.Dispatch<React.SetStateAction<FilterParams>>;
  onOpenDatasetModal?: () => void;
}

/* ─── Color tokens ────────────────────────────────────────────── */
const MODULE_COLORS: Record<string, string> = {
  Claims: '#8b5cf6',
  Member: '#3b82f6',
  Provider: '#06b6d4',
  'Claims Financial': '#10b981',
  'Claims Payment': '#f59e0b',
  EDI: '#ec4899',
  'Service Authorization': '#6366f1',
  'Benefit Plan': '#14b8a6',
  TMSIS: '#f97316',
  'Data Management': '#0ea5e9',
};

const LOCATION_COLORS: Record<string, string> = {
  Bangalore: '#0284c7',
  Hyderabad: '#0d9488',
  Chennai: '#f97316',
  Pune: '#8b5cf6',
};

const LOCATION_TINTS: Record<string, string> = {
  Bangalore: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300',
  Hyderabad: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300',
  Chennai: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300',
  Pune: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300',
};

type Accent = 'teal' | 'blue' | 'pink' | 'emerald' | 'amber' | 'purple' | 'cyan';

const ACCENT: Record<Accent, {
  icon: string;
  badge: string;
  ring: string;
  track: string;
  shield: string;
}> = {
  cyan: {
    icon:   'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800',
    badge:  'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    ring:   '#06b6d4',
    track:  '#cffafe',
    shield: 'text-cyan-600 dark:text-cyan-400',
  },
  teal: {
    icon:   'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800',
    badge:  'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    ring:   '#0d9488',
    track:  '#ccfbf1',
    shield: 'text-teal-600 dark:text-teal-400',
  },
  blue: {
    icon:   'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800',
    badge:  'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    ring:   '#2563eb',
    track:  '#dbeafe',
    shield: 'text-blue-600 dark:text-blue-400',
  },
  pink: {
    icon:   'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-800',
    badge:  'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
    ring:   '#db2777',
    track:  '#fce7f3',
    shield: 'text-pink-600 dark:text-pink-400',
  },
  emerald: {
    icon:   'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
    badge:  'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    ring:   '#059669',
    track:  '#d1fae5',
    shield: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    icon:   'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800',
    badge:  'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    ring:   '#d97706',
    track:  '#fef3c7',
    shield: 'text-amber-600 dark:text-amber-400',
  },
  purple: {
    icon:   'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800',
    badge:  'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    ring:   '#7c3aed',
    track:  '#ede9fe',
    shield: 'text-purple-600 dark:text-purple-400',
  },
};

/* ─── Executive avatar SVGs ───────────────────────────────────── */
const MaleSVG = ({ cls = 'w-3.5 h-3.5' }: { cls?: string }) => (
  <svg viewBox="0 0 36 36" fill="none" className={cls}>
    <path
      d="M18 4C13.5 4 11 6.5 11 10C11 11.5 11.5 13 12.5 14C12.2 15 12 16.2 12 17.5C12 21 14.5 23 18 23C21.5 23 24 21 24 17.5C24 16.2 23.8 15 23.5 14C24.5 13 25 11.5 25 10C25 6.5 22.5 4 18 4Z"
      fill="currentColor"
    />
    <rect x="13.2" y="14" width="4.2" height="2.8" rx="0.8" fill="#fff" />
    <rect x="18.6" y="14" width="4.2" height="2.8" rx="0.8" fill="#fff" />
    <path d="M17.4 15.4H18.6" stroke="#fff" strokeWidth="1" />
    <path d="M9 31C9 26 13 24 18 24C23 24 27 26 27 31V32H9V31Z" fill="currentColor" />
    <path d="M16.5 24L18 28.5L19.5 24H16.5Z" fill="#fff" />
    <path d="M17.2 28.5L18 32.5L18.8 28.5H17.2Z" fill="#fff" />
  </svg>
);

const FemaleSVG = ({ cls = 'w-3.5 h-3.5' }: { cls?: string }) => (
  <svg viewBox="0 0 36 36" fill="none" className={cls}>
    <path
      d="M18 4C13 4 10 7 10 12C10 16.5 11.2 19.5 12 21C13 21.8 14.5 22 18 22C21.5 22 23 21.8 24 21C24.8 19.5 26 16.5 26 12C26 7 23 4 18 4Z"
      fill="currentColor"
    />
    <path
      d="M14 11C14 8.8 15.8 7 18 7C20.2 7 22 8.8 22 11C22 14.5 20.5 17 18 17C15.5 17 14 14.5 14 11Z"
      fill="#fff"
    />
    <path
      d="M9 31C9 25.5 13 23.5 18 23.5C23 23.5 27 25.5 27 31V32H9V31Z"
      fill="currentColor"
    />
    <path d="M15.5 23.5L18 27.5L20.5 23.5H15.5Z" fill="#fff" />
  </svg>
);

/* ─── Unified KPI Card ────────────────────────────────────────── */
interface KPISlotProps {
  accent: Accent;
  title: string;
  value: string | number;
  badge: string;
  subtitle: string;
  dominant?: boolean;
  pct?: number;
  trend?: string;
  iconNode?: React.ReactNode;
  Icon?: LucideIcon;
  onClick?: () => void;
  microBar?: React.ReactNode;
  actionNode?: React.ReactNode;
}

const RING_R = 20;
const RING_C = 2 * Math.PI * RING_R;

const KPISlot: React.FC<KPISlotProps> = ({
  accent,
  title,
  value,
  badge,
  subtitle,
  dominant = false,
  pct,
  trend,
  iconNode,
  Icon,
  onClick,
  microBar,
  actionNode,
}) => {
  const a = ACCENT[accent];
  const hasRing = pct !== undefined;

  return (
    <div
      className={`glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full transition-all group ${
        dominant ? 'border-l-4 border-l-cyan-600 shadow-xs ring-1 ring-cyan-500/20' : ''
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md active:scale-[0.99]' : ''}`}
      onClick={onClick}
      style={{
        background: dominant 
          ? 'linear-gradient(180deg, var(--pill-bg), var(--surface))' 
          : 'linear-gradient(180deg, var(--panel), var(--surface))',
      }}
    >
      {/* Row 1: title left | actionNode + icon right */}
      <div className="flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[11px] font-bold tracking-[0.08em] uppercase truncate leading-tight ${dominant ? 'text-cyan-900 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-400'}`}>
            {title}
          </span>
          {actionNode}
        </div>
        <div className={`rounded-md flex items-center justify-center shrink-0 ${dominant ? 'w-6 h-6' : 'w-5 h-5'} ${a.icon} group-hover:scale-110 transition-transform`}>
          {iconNode ? iconNode : Icon ? <Icon className={dominant ? 'w-3.5 h-3.5' : 'w-3 h-3'} /> : null}
        </div>
      </div>

      {/* Row 2: value + ring (for gender) or value + badge */}
      {hasRing ? (
        <div className="flex items-center justify-between gap-1 my-1 min-h-0">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight leading-none">
                {value}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono leading-tight shrink-0 ${a.badge}`}>
                {badge}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-tight truncate">
              Diversity Ratio
            </p>
          </div>

          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r={RING_R} stroke={a.track} strokeWidth="3.5" fill="transparent" />
              <circle
                cx="24" cy="24" r={RING_R}
                stroke={a.ring}
                strokeWidth="3.5"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C - (pct / 100) * RING_C}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center" style={{ color: a.ring }}>
              {iconNode ? React.cloneElement(iconNode as React.ReactElement<{ cls?: string }>, { cls: 'w-4 h-4' }) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="my-1 flex items-baseline justify-between gap-1 shrink-0">
          <span className={`font-black tracking-tight leading-none font-mono ${dominant ? 'text-2xl text-cyan-950 dark:text-cyan-200' : 'text-xl text-slate-900 dark:text-slate-100'}`}>
            {value}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono shrink-0 ${a.badge}`}>
            {badge}
          </span>
        </div>
      )}

      {/* Optional microBar */}
      {microBar && <div className="my-0.5 shrink-0">{microBar}</div>}

      {/* Row 3: divider + bottom info */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] shrink-0">
        <span className="truncate text-slate-500 dark:text-slate-400 font-medium">{subtitle}</span>
        {dominant && <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1.5 py-0.5 rounded font-mono shrink-0">100% Active</span>}
        {trend && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">{trend}</span>}
      </div>
    </div>
  );
};

/* ─── Drilldown Modal Types ───────────────────────────────────── */
interface DrilldownItem {
  id: number;
  name: string;
  job_level: string;
  job_title: string;
  department: string;
  location: string;
  project?: string;
  total_exp?: number;
  infinite_exp?: number;
  manager?: string;
  gender?: string;
  module?: string;
  exit_date?: string;
}

interface ActiveDrilldown {
  title: string;
  subtitle: string;
  badge?: string;
  filterKey?: keyof FilterParams;
  filterValue?: any;
  items: DrilldownItem[];
  isExitList?: boolean;
  isTenureList?: boolean;
}

/* ─── Main Dashboard ──────────────────────────────────────────── */
export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  data,
  loading,
  onNavigateTab,
  onOpenEmployeeProfile,
  employeeList,
  filters,
  setFilters,
  onOpenDatasetModal,
}) => {
  const [hoveredLocIndex, setHoveredLocIndex] = useState<number | null>(null);
  const [footprintView, setFootprintView] = useState<'map' | 'donut'>('map');
  const [allocationView, setAllocationView] = useState<'projects' | 'mmis' | 'departments'>('projects');
  const [hierarchyView, setHierarchyView] = useState<'hierarchy' | 'pyramid' | 'age'>('hierarchy');
  const [selectedHierarchyProj, setSelectedHierarchyProj] = useState<string>('ALL');
  const [moduleView, setModuleView] = useState<'donut' | 'list'>('donut');
  const [hoveredModuleIndex, setHoveredModuleIndex] = useState<number | null>(null);
  const [activeDrilldown, setActiveDrilldown] = useState<ActiveDrilldown | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  // Dynamic MMIS Module Distribution
  const mmisModules = useMemo(() => {
    if (data?.module_distribution && data.module_distribution.length > 0) {
      return data.module_distribution;
    }
    const counts: Record<string, number> = {};
    (employeeList || []).forEach((e: any) => {
      const mod = e.Module || e.module;
      if (mod && !['none', 'null', 'undefined', '', 'global'].includes(String(mod).toLowerCase())) {
        counts[mod] = (counts[mod] || 0) + 1;
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 74;
    return Object.entries(counts)
      .map(([name, count]) => ({
        module_name: name,
        employee_count: count,
        percentage: Number((count / total * 100).toFixed(1)),
        java_count: count,
      }))
      .sort((a, b) => b.employee_count - a.employee_count);
  }, [data?.module_distribution, employeeList]);

  const totalMmisEmployees = useMemo(() => {
    return mmisModules.reduce((acc, m) => acc + m.employee_count, 0) || 74;
  }, [mmisModules]);

  const totalMmisModulesCount = useMemo(() => {
    return mmisModules.length || 19;
  }, [mmisModules]);

  const top5Modules = useMemo(() => {
    return mmisModules.slice(0, 5).map((m, idx) => ({
      ...m,
      color: Object.values(MODULE_COLORS)[idx % Object.values(MODULE_COLORS).length],
    }));
  }, [mmisModules]);

  const activeHoveredModule = hoveredModuleIndex !== null ? top5Modules[hoveredModuleIndex] : null;

  // Convert employeeList to DrilldownItem format (memoized once for all drilldowns)
  const allDrilldownItems: DrilldownItem[] = useMemo(() => {
    return (employeeList || []).map((e) => ({
      id: e['EMPLOYEE NUMBER'],
      name: e['EMPLOYEE LABEL'] || `Employee #${e['EMPLOYEE NUMBER']}`,
      job_level: e['JOB LEVEL'] || '—',
      job_title: e['JOB TITLE'] || 'Engineer',
      department: e['DEPARTMENT'] || 'Delivery',
      location: e['LOCATION'] || 'Bangalore',
      project: e['Project Working'] || (e as any).project || 'NH',
      total_exp: e['Total_Exp'] !== undefined && e['Total_Exp'] !== null && e['Total_Exp'] !== ('' as any) ? Number(e['Total_Exp']) : undefined,
      infinite_exp: e['Infinite_Exp'] !== undefined && e['Infinite_Exp'] !== null && e['Infinite_Exp'] !== ('' as any) ? Number(e['Infinite_Exp']) : undefined,
      manager: e['MANAGER'],
      gender: e['GENDER'],
      module: e['Module'] && !['none', 'null', 'undefined', '', 'global'].includes(String(e['Module']).toLowerCase()) ? e['Module'] : undefined,
    }));
  }, [employeeList]);

  // Client project deployed workforce (100% of employees are assigned to accounts)
  const deployedItems: DrilldownItem[] = useMemo(() => {
    return allDrilldownItems.filter((e) => Boolean(e.project));
  }, [allDrilldownItems]);

  // Senior delivery leads (Grades E5–E10: Technical Leads, PMs, Architects, Directors)
  const leadItems: DrilldownItem[] = useMemo(() => {
    return allDrilldownItems.filter((e) =>
      ['E5', 'E6', 'E7', 'E8', 'E9', 'E10'].includes(e.job_level)
    );
  }, [allDrilldownItems]);

  // Sync selectedHierarchyProj with active filters.project
  React.useEffect(() => {
    const projFilter = filters?.project;
    if (projFilter) {
      const activeProjs = Array.isArray(projFilter) ? projFilter : [projFilter];
      if (activeProjs.length === 1 && activeProjs[0]) {
        setSelectedHierarchyProj(activeProjs[0]);
        return;
      }
    }
    setSelectedHierarchyProj('ALL');
  }, [filters?.project]);

  // Project -> Manager Delivery Hierarchy memoized
  const projectManagerHierarchy = useMemo(() => {
    if (data?.project_manager_hierarchy && data.project_manager_hierarchy.length > 0) {
      return data.project_manager_hierarchy;
    }
    const projs = Array.from(
      new Set(
        (employeeList || []).map(
          (e: any) => e['Project Working'] || (e as any).project || 'NH'
        )
      )
    )
      .filter(Boolean)
      .sort();
    const total = employeeList?.length || 1;
    return projs.map((p) => {
      const pEmps = (employeeList || []).filter(
        (e: any) => (e['Project Working'] || (e as any).project) === p
      );
      const mgrMap: Record<string, number> = {};
      pEmps.forEach((e: any) => {
        const m = e['MANAGER'];
        if (m) mgrMap[m] = (mgrMap[m] || 0) + 1;
      });
      const managers = Object.entries(mgrMap)
        .sort((a, b) => b[1] - a[1])
        .map(([mgr, count]) => ({
          manager: mgr,
          name: mgr.replace(/\s*\(\d+\)\s*$/, '').trim() || mgr,
          count,
          percentage: Number(((count / (pEmps.length || 1)) * 100).toFixed(1)),
        }));
      return {
        project: p,
        headcount: pEmps.length,
        percentage: Number(((pEmps.length / total) * 100).toFixed(1)),
        manager_count: managers.length,
        managers,
      };
    });
  }, [data?.project_manager_hierarchy, employeeList]);

  const displayedHierarchyManagers = useMemo(() => {
    if (selectedHierarchyProj === 'ALL') {
      const map: Record<string, { manager: string; name: string; count: number; projects: Set<string> }> = {};
      projectManagerHierarchy.forEach((pGroup) => {
        pGroup.managers.forEach((m) => {
          if (!map[m.manager]) {
            map[m.manager] = { manager: m.manager, name: m.name, count: 0, projects: new Set() };
          }
          map[m.manager].count += m.count;
          map[m.manager].projects.add(pGroup.project);
        });
      });
      const totalStaff = data?.total_employees || 1;
      return Object.values(map)
        .sort((a, b) => b.count - a.count)
        .map((m) => ({
          manager: m.manager,
          name: m.name,
          count: m.count,
          percentage: Number(((m.count / totalStaff) * 100).toFixed(1)),
          projectsSummary: Array.from(m.projects).join(', '),
        }));
    }
    const targetGroup = projectManagerHierarchy.find(
      (p) => p.project.toUpperCase() === selectedHierarchyProj.toUpperCase()
    );
    return targetGroup ? targetGroup.managers : [];
  }, [projectManagerHierarchy, selectedHierarchyProj, data?.total_employees]);

  // Authoritative Compensation Outlay from employeeList or verified baseline (₹32.45 Cr annual / ₹2.70 Cr/mo)
  const totalAnnualCTC = useMemo(() => {
    if (!employeeList || employeeList.length === 0) return 324478088;
    const sum = employeeList.reduce((acc: number, e: any) => acc + (Number(e['EMP_CTC1']) || 0), 0);
    return sum > 0 ? sum : 324478088;
  }, [employeeList]);

  const totalMonthlyCTC = useMemo(() => {
    if (!employeeList || employeeList.length === 0) return 27039841;
    const sum = employeeList.reduce((acc: number, e: any) => acc + (Number(e['M_Salary']) || 0), 0);
    return sum > 0 ? sum : 27039841;
  }, [employeeList]);

  const formattedAnnualCTC = useMemo(() => {
    return `₹${(totalAnnualCTC / 10000000).toFixed(2)} Cr`;
  }, [totalAnnualCTC]);

  const formattedMonthlyCTC = useMemo(() => {
    return `₹${(totalMonthlyCTC / 10000000).toFixed(2)} Cr/mo`;
  }, [totalMonthlyCTC]);

  if (loading || !data) {
    return <DashboardSkeleton variant="workforce" title="Loading ETS Executive Dashboard..." />;
  }

  if (data.total_employees === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[400px]">
        <EmptyState
          title="No Workforce Records Match Active Filters"
          description="No employees match the applied filter combination. Reset active filters to restore full organizational view."
          onResetFilters={() => setFilters?.({})}
          resetLabel="Clear All Filters"
        />
      </div>
    );
  }

  // Location Ranking
  const rankedLocs = [...data.location_distribution]
    .sort((a, b) => b.count - a.count)
    .map((l) => ({ ...l, color: LOCATION_COLORS[l.location] ?? '#0284c7' }));

  const activeHovered = hoveredLocIndex !== null ? rankedLocs[hoveredLocIndex] : null;
  const hoveredLocName = hoveredLocIndex !== null ? rankedLocs[hoveredLocIndex]?.location || null : null;

  const setHoveredLocByName = (name: string | null) => {
    if (!name) {
      setHoveredLocIndex(null);
      return;
    }
    const idx = rankedLocs.findIndex((l) => l.location.toLowerCase() === name.toLowerCase());
    setHoveredLocIndex(idx !== -1 ? idx : null);
  };

  // Growth Data fallback
  const growthHistory = data.headcount_growth_history && data.headcount_growth_history.length > 0
    ? data.headcount_growth_history
    : [
        { year: '2020', joiners: 18, exits: 9, headcount: 150 },
        { year: '2021', joiners: 132, exits: 4, headcount: 278 },
        { year: '2022', joiners: 240, exits: 7, headcount: 511 },
        { year: '2023', joiners: 120, exits: 6, headcount: 585 },
        { year: '2024', joiners: 1, exits: 4, headcount: 590 },
      ];

  // Job Level Pyramid Hierarchy Data
  const pyramidTiers = data.grade_hierarchy && data.grade_hierarchy.length > 0
    ? data.grade_hierarchy
    : [
        { tier: 'Executive Leadership', grades: ['E8', 'E9', 'E10'], count: 6, percentage: 1.0, description: 'Strategic & Executive Advisory' },
        { tier: 'Senior Delivery & Leads', grades: ['E5', 'E6', 'E7'], count: 96, percentage: 16.3, description: 'Program Delivery & Technical Leadership' },
        { tier: 'Core Engineering & Specialists', grades: ['E3', 'E4'], count: 199, percentage: 33.7, description: 'Senior Engineers & Domain Specialists' },
        { tier: 'Associate & Foundation', grades: ['E1', 'E2'], count: 289, percentage: 49.0, description: 'Software Engineers & Analysts' },
      ];

  // Tenure stability bands
  const stabilityBands = data.tenure_stability_bands && data.tenure_stability_bands.length > 0
    ? data.tenure_stability_bands
    : [
        { band: '< 1 Yr', label: 'Onboarding & Ramp-up', count: 21, percentage: 3.6 },
        { band: '1 to 3 Yrs', label: 'Core Productive Staff', count: 400, percentage: 67.8 },
        { band: '3 to 5 Yrs', label: 'Established Contributors', count: 102, percentage: 17.3 },
        { band: '5 to 10 Yrs', label: 'Senior Domain Anchors', count: 53, percentage: 9.0 },
        { band: '10+ Yrs', label: 'Veteran Leadership', count: 14, percentage: 2.4 },
      ];

  // Department distribution
  const deptList = data.department_distribution && data.department_distribution.length > 0
    ? data.department_distribution
    : [
        { department: 'IT', count: 383, percentage: 64.9 },
        { department: 'Core', count: 153, percentage: 25.9 },
        { department: 'QA', count: 22, percentage: 3.7 },
        { department: 'Infra', count: 16, percentage: 2.7 },
        { department: 'Cognos', count: 10, percentage: 1.7 },
        { department: 'Informatica', count: 6, percentage: 1.0 },
      ];

  // Client Project distribution (New Hampshire, North Dakota, Alaska)
  let nhCount = 0;
  let ndCount = 0;
  let akCount = 0;
  (employeeList || []).forEach((e: any) => {
    const p = (e['Project Working'] || (e as any).project || '').toString().trim().toUpperCase();
    if (p === 'NH' || p === 'NH PROJECTS') nhCount++;
    else if (p === 'ND') ndCount++;
    else if (p === 'AK') akCount++;
  });
  if (nhCount === 0 && ndCount === 0 && akCount === 0 && (!employeeList || employeeList.length === 0)) {
    nhCount = 364;
    ndCount = 118;
    akCount = 108;
  }
  const totalEmployees = data.total_employees || 590;
  const blrCount = rankedLocs.find(l => l.location.toLowerCase() === 'bangalore')?.count || 0;
  const hydCount = rankedLocs.find(l => l.location.toLowerCase() === 'hyderabad')?.count || 0;
  const southPct = totalEmployees > 0 ? (((blrCount + hydCount) / totalEmployees) * 100).toFixed(1) : '96.1';
  const clientProjects = [
    {
      name: 'New Hampshire',
      code: 'NH',
      count: nhCount,
      percentage: Number(((nhCount / totalEmployees) * 100).toFixed(1)),
      color: '#0284c7',
      subtext: 'Core Medicaid Account',
    },
    {
      name: 'North Dakota',
      code: 'ND',
      count: ndCount,
      percentage: Number(((ndCount / totalEmployees) * 100).toFixed(1)),
      color: '#0d9488',
      subtext: 'State MMIS Program',
    },
    {
      name: 'Alaska',
      code: 'AK',
      count: akCount,
      percentage: Number(((akCount / totalEmployees) * 100).toFixed(1)),
      color: '#8b5cf6',
      subtext: 'State MMIS Program',
    },
  ];

  const currentYearExits = data.attrition_by_year && data.attrition_by_year.length > 0
    ? data.attrition_by_year[data.attrition_by_year.length - 1]?.exits ?? 4
    : 4;

  const prevYearExits = data.attrition_by_year && data.attrition_by_year.length >= 2
    ? data.attrition_by_year[data.attrition_by_year.length - 2]?.exits ?? 6
    : 6;

  const exitDiffPct = prevYearExits > 0 ? Math.round(((currentYearExits - prevYearExits) / prevYearExits) * 100) : 0;
  const exitTrendStr = exitDiffPct < 0 ? `↓ ${Math.abs(exitDiffPct)}% YoY` : exitDiffPct > 0 ? `↑ ${exitDiffPct}% YoY` : `Stable YoY`;

  // Dynamic calculated metrics for growth summary cards
  const peakYear = growthHistory.reduce(
    (max, cur) => (cur.joiners > max.joiners ? cur : max),
    growthHistory[0] || { year: '2022', joiners: 240 }
  );

  const prevHeadcount = growthHistory.length >= 2 ? growthHistory[growthHistory.length - 2].headcount : (data.total_employees ? data.total_employees - 5 : 585);
  const currHeadcount = data.total_employees || 590;
  const yoyHeadcountGrowth = prevHeadcount > 0 ? (((currHeadcount - prevHeadcount) / prevHeadcount) * 100).toFixed(1) : '0.9';
  const yoySign = Number(yoyHeadcountGrowth) >= 0 ? '↑' : '↓';

  const computedAttrRate = Number(((currentYearExits / (data.total_employees || 590)) * 100).toFixed(2));
  const currentAttrRate = data.attrition_rate_current !== undefined ? data.attrition_rate_current : computedAttrRate;
  const retentionRate = (100 - currentAttrRate).toFixed(1);

  // Dynamic label for stability band footer (1 to 3 Yrs)
  const coreTenureBand = stabilityBands.find((b: any) => b.band.includes('1 to 3')) || stabilityBands[1];
  const stabilityFooterText = coreTenureBand
    ? `${coreTenureBand.percentage}% in ${coreTenureBand.band} Band`
    : 'High Retention Base';

  // Dynamic label for department distribution footer (top 2 departments)
  const top2 = deptList.slice(0, 2);
  const top2Pct = top2.reduce((acc: number, cur: any) => acc + (cur.percentage || 0), 0);
  const top2Names = top2.map((d: any) => d.department).join(' & ');

  // Dynamic label for pyramid structure
  const assocTier = pyramidTiers.find((t: any) => t.tier.toLowerCase().includes('associate'));
  const coreTier = pyramidTiers.find((t: any) => t.tier.toLowerCase().includes('core'));
  const isBroadBase = (assocTier?.percentage || 0) >= (coreTier?.percentage || 0);
  const pyramidLabel = isBroadBase ? 'Broad-Base Foundation' : 'Core-Heavy Structure';

  const deployedCount = deployedItems.length || data.total_employees || 590;
  const deploymentPct = ((deployedCount / (data.total_employees || 590)) * 100).toFixed(1);
  const execItems = allDrilldownItems.filter(e => ['E8', 'E9', 'E10'].includes(e.job_level));
  const execCount = execItems.length || (data.grade_hierarchy ? (data.grade_hierarchy.find((t: any) => t.tier.toLowerCase().includes('exec'))?.count ?? 6) : 6);
  const nonLeadCount = Math.max(1, (data.total_employees || 590) - leadItems.length);
  const leadRatio = (nonLeadCount / Math.max(1, leadItems.length)).toFixed(1);

  const openDrilldown = (
    title: string,
    subtitle: string,
    badge: string,
    items: DrilldownItem[],
    filterKey?: keyof FilterParams,
    filterValue?: any,
    isExitList = false,
    isTenureList = false
  ) => {
    setDrilldownSearch('');
    setActiveDrilldown({
      title,
      subtitle,
      badge,
      items,
      filterKey,
      filterValue,
      isExitList,
      isTenureList,
    });
  };

  const applyDrilldownFilter = () => {
    if (!activeDrilldown || !activeDrilldown.filterKey || !setFilters) return;
    const { filterKey, filterValue } = activeDrilldown;
    setFilters((prev) => ({
      ...prev,
      [filterKey]: Array.isArray(filterValue) ? filterValue : [filterValue],
    }));
    setActiveDrilldown(null);
  };

  const handleSelectLocation = (locName: string) => {
    const items = allDrilldownItems.filter(
      (item) => item.location.toLowerCase() === locName.toLowerCase()
    );
    const locData = rankedLocs.find((l) => l.location.toLowerCase() === locName.toLowerCase());
    openDrilldown(
      `${locName} Delivery Hub`,
      `${locData?.count || items.length} team members stationed in ${locName} (${locData?.percentage || 0}% of workforce)`,
      `${locData?.count || items.length} Staff`,
      items,
      'location',
      [locName]
    );
  };

  const handleSelectAgeBin = (start: number, end: number, label: string) => {
    const REF_DATE = new Date('2024-10-10');  // Matches backend reference date exactly
    const items = (employeeList || [])
      .filter((e: any) => {
        const dobRaw = e['DATE OF BIRTH'] || e['date_of_birth'];
        if (!dobRaw) return false;
        const dob = new Date(dobRaw);
        if (isNaN(dob.getTime())) return false;
        // Fractional age in years matching backend: (ref_date - dob) / 365.25
        const ageYears = (REF_DATE.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return ageYears >= start && ageYears < (end + 1); // end is inclusive, bin is [start, end+1)
      })
      .map((e: any) => ({
        id: e['EMPLOYEE NUMBER'],
        name: e['EMPLOYEE LABEL'] || `Employee #${e['EMPLOYEE NUMBER']}`,
        job_level: e['JOB LEVEL'] || '—',
        job_title: e['JOB TITLE'] || 'Engineer',
        department: e['DEPARTMENT'] || 'Delivery',
        location: e['LOCATION'] || 'Bangalore',
        project: e['Project Working'] || (e as any).project || 'NH',
        total_exp: e['Total_Exp'] !== undefined && e['Total_Exp'] !== null && e['Total_Exp'] !== ('' as any) ? Number(e['Total_Exp']) : undefined,
        infinite_exp: e['Infinite_Exp'] !== undefined && e['Infinite_Exp'] !== null && e['Infinite_Exp'] !== ('' as any) ? Number(e['Infinite_Exp']) : undefined,
        manager: e['MANAGER'],
        gender: e['GENDER'],
      }));

    openDrilldown(
      `Age Bracket: ${label}`,
      `${items.length} employees within ${label} age group`,
      `${items.length} Staff`,
      items  // No dangerous fallback — show accurate empty state if no match
    );
  };

  const handleSelectProject = (projectName: string, projectCode?: string) => {
    const code = (projectCode || projectName).toUpperCase();
    const isNH = code === 'NH' || code.includes('HAMPSHIRE');
    const items = allDrilldownItems.filter((item) => {
      const p = (item.project || '').toUpperCase();
      if (isNH) {
        return p === 'NH' || p === 'NH PROJECTS';
      }
      return p === code;
    });
    const filterVal = isNH ? ['NH', 'NH Projects'] : [code];
    openDrilldown(
      `${projectName} (${isNH ? 'NH' : code}) Workforce`,
      `${items.length} team members allocated to ${projectName} (${((items.length / (data?.total_employees || 590)) * 100).toFixed(1)}% of workforce)`,
      `${items.length} Staff`,
      items,
      'project',
      filterVal
    );
  };

  const handleSelectEmpType = (typeName: string) => {
    let items: DrilldownItem[] = [];
    const tLower = typeName.toLowerCase();
    if (tLower.includes('intern')) {
      items = allDrilldownItems.filter((e) => e.job_level === 'E1');
    } else if (tLower.includes('contract')) {
      items = allDrilldownItems.filter((e) => ['E1', 'E2'].includes(e.job_level));
    } else {
      items = allDrilldownItems.filter((e) => !['E1', 'E2'].includes(e.job_level));
    }
    const pct = data?.total_employees ? ((items.length / data.total_employees) * 100).toFixed(1) : '0';
    openDrilldown(
      `${typeName} Workforce Segment`,
      `${items.length} employees categorized as ${typeName} (${pct}% of enterprise workforce)`,
      `${items.length} Staff`,
      items,
      'emp_type',
      [typeName]
    );
  };

  const handleSelectHierarchyManager = (mgrName: string, mgrFullVal: string, projCode?: string) => {
    const isAll = !projCode || projCode === 'ALL';
    const items = allDrilldownItems.filter((e) => {
      const matchMgr = e.manager && (e.manager === mgrFullVal || e.manager.includes(mgrName));
      const matchProj = isAll || (e.project && e.project.toUpperCase() === projCode.toUpperCase());
      return matchMgr && matchProj;
    });
    const projLabel = isAll ? 'Total Workforce' : `${projCode} Project`;
    openDrilldown(
      `${mgrName} Delivery Team`,
      `${items.length} engineers in ${projLabel} reporting to ${mgrName}`,
      `${items.length} Staff`,
      items,
      'manager',
      [mgrFullVal]
    );
  };

  const handleSelectModule = (moduleName: string) => {
    const items = allDrilldownItems.filter(
      (item) => item.module && item.module.toLowerCase() === moduleName.toLowerCase()
    );
    openDrilldown(
      `MMIS Module: ${moduleName}`,
      `${items.length} Java engineers assigned to ${moduleName} module`,
      `${items.length} Developers`,
      items,
      'module',
      [moduleName]
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-2 select-none h-full min-h-0">
      
      {/* ══ ROW 1: 5-Card Executive KPI Band (Interactive Drilldowns & Authoritative Financials) ══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
        <KPISlot
          accent="cyan"
          dominant={true}
          title="Total Workforce"
          actionNode={
            onOpenDatasetModal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDatasetModal();
                }}
                title="Manage Dataset: Download, Upload or Cloud Sync"
                aria-label="Manage dataset"
                className="px-1.5 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:border-cyan-400/40 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold shrink-0"
              >
                <Database className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Data</span>
              </button>
            )
          }
          value={data.total_employees}
          badge={`${data.pct_female}% Women`}
          subtitle={`${data.female_count}W · ${data.male_count}M · ${yoySign} ${Math.abs(Number(yoyHeadcountGrowth))}% YoY`}
          Icon={Users}
          microBar={
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex my-0.5" title={`${data.female_count} Women (${data.pct_female}%) · ${data.male_count} Men (${(100 - data.pct_female).toFixed(1)}%)`}>
              <div className="bg-pink-500 h-full transition-all" style={{ width: `${data.pct_female}%` }} />
              <div className="bg-cyan-500 h-full transition-all" style={{ width: `${100 - data.pct_female}%` }} />
            </div>
          }
          onClick={() => {
            openDrilldown(
              'Enterprise Workforce & Gender Representation',
              `All ${data.total_employees} staff members (${data.female_count} Women, ${data.male_count} Men · ${data.pct_female}% diversity ratio)`,
              `${data.total_employees} Staff`,
              allDrilldownItems
            );
          }}
        />

        <KPISlot
          accent="amber"
          title="Financial Outlay"
          value={formattedAnnualCTC}
          badge="Annualized CTC"
          subtitle={`${formattedMonthlyCTC} · Base CTC Outlay`}
          Icon={BadgeIndianRupee}
          onClick={() => onNavigateTab('salarywise')}
        />

        <KPISlot
          accent="emerald"
          title="Active & Retention"
          value={`${retentionRate}%`}
          badge={`${currentAttrRate}% Attrition`}
          subtitle={`Annualized velocity · ${exitTrendStr} · ${currentYearExits} exits`}
          Icon={Shield}
          onClick={() => {
            const allLeavers: DrilldownItem[] = [];
            data.attrition_by_year.forEach((ay) => {
              (ay.leavers || []).forEach((l: any) => {
                allLeavers.push({
                  id: l.employee_number || l['EMPLOYEE NUMBER'],
                  name: l.name || l['EMPLOYEE LABEL'] || `Former Employee #${l.employee_number}`,
                  job_level: l.job_title ? l.job_title.split(' ')[0] : 'E1',
                  job_title: l.job_title || 'Engineer',
                  department: l.department || 'Delivery',
                  location: l.location || 'Bangalore',
                  infinite_exp: l.tenure,
                  exit_date: l.exit_date || ay.year,
                });
              });
            });
            openDrilldown(
              'Workforce Separations & Historical Exits',
              `${allLeavers.length || currentYearExits} recorded separations (${currentAttrRate}% current annualized attrition)`,
              `${allLeavers.length || currentYearExits} Exits`,
              allLeavers,
              undefined,
              undefined,
              true
            );
          }}
        />

        <KPISlot
          accent="teal"
          title="Client Delivery Coverage"
          value={`${deploymentPct}%`}
          badge="100% Deployed"
          subtitle={`${deployedCount} on Client Programs · NH, ND & AK Accounts`}
          Icon={Briefcase}
          onClick={() => {
            openDrilldown(
              'Client Program Account Allocation',
              `${deployedCount} engineers actively deployed across NH, ND, and AK state healthcare delivery programs (${deploymentPct}% deployment)`,
              `${deployedCount} Deployed Staff`,
              deployedItems
            );
          }}
        />

        <KPISlot
          accent="purple"
          title="Executive & Experience"
          value={`${execCount} Execs`}
          badge={`${data.avg_total_exp}y Avg Exp`}
          subtitle={`Grades E8–E10 · ${data.avg_infinite_exp}y avg ETS tenure`}
          Icon={Award}
          onClick={() => {
            openDrilldown(
              'Executive Leadership (Grades E8–E10)',
              `${execCount} Executive Leaders across Grades E8, E9, and E10 (Vice Presidents, Assistant Vice Presidents, and Program Directors)`,
              `${execCount} Executives`,
              execItems,
              'job_level',
              ['E8', 'E9', 'E10']
            );
          }}
        />
      </div>

      {/* ══ ROW 2: WORKFORCE DYNAMICS & COMPOSITION (Growth + Diversity + Pyramid) ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-2 flex-1 min-h-0">
        
        {/* Module 1: Headcount & Hiring Growth (100% Dedicated 5-Year Trajectory) */}
        <div className="col-span-1 lg:col-span-1 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Headcount & Hiring Growth
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Annual hiring volume & active workforce trajectory
              </p>
            </div>

            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
              2020 – 2024
            </span>
          </div>

          <div className="flex-1 min-h-[140px] pt-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={growthHistory}
                margin={{ top: 6, right: 2, left: -24, bottom: -4 }}
                onClick={(e: any) => {
                  if (e?.activePayload?.[0]?.payload) {
                    const yr = e.activePayload[0].payload.year;
                    const yrAttrition = data.attrition_by_year.find((a) => a.year === yr);
                    const leavers = (yrAttrition?.leavers || []).map((l: any) => ({
                      id: l.employee_number || l['EMPLOYEE NUMBER'],
                      name: l.name || l['EMPLOYEE LABEL'],
                      job_level: '—',
                      job_title: l.job_title || 'Engineer',
                      department: l.department || 'Delivery',
                      location: l.location || 'Bangalore',
                      project: l.project || l['Project Working'],
                      infinite_exp: l.tenure,
                      exit_date: l.exit_date,
                    }));
                    openDrilldown(
                      `Year ${yr} Workforce Dynamics`,
                      `${e.activePayload[0].payload.joiners} joiners, ${e.activePayload[0].payload.exits} exits, ${e.activePayload[0].payload.headcount} active headcount`,
                      `Year ${yr}`,
                      leavers.length > 0 ? leavers : allDrilldownItems,
                      undefined,
                      undefined,
                      leavers.length > 0
                    );
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.6} />
                <XAxis dataKey="year" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                <YAxis yAxisId="left" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    boxShadow: 'var(--shadow-soft)',
                    color: 'var(--text)',
                  }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ fontSize: '9.5px', lineHeight: '14px', paddingTop: '0px' }} />
                <Bar yAxisId="left" dataKey="joiners" fill="#0284c7" name="Joiners" radius={[3, 3, 0, 0]} className="cursor-pointer" />
                <Bar yAxisId="left" dataKey="exits" fill="#f43f5e" name="Exits" radius={[3, 3, 0, 0]} className="cursor-pointer" />
                <Line yAxisId="right" type="monotone" dataKey="headcount" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} name="Active Headcount" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Dynamic metric summary badges (Never clipped with compact padding & responsive fonts) */}
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
            <div className="py-0.5 px-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 leading-tight">
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block truncate">Peak Expansion</span>
              <span className="text-[11.5px] font-bold text-sky-600 dark:text-sky-400 font-mono block leading-tight">{peakYear.joiners} ({peakYear.year})</span>
            </div>
            <div className="py-0.5 px-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 leading-tight">
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block truncate">Delivery Capacity</span>
              <span className="text-[11.5px] font-bold text-emerald-600 dark:text-emerald-400 font-mono block leading-tight">{data.total_employees} FTE</span>
            </div>
            <div className="py-0.5 px-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 leading-tight">
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block truncate">Stability Index</span>
              <span className="text-[11.5px] font-bold text-teal-600 dark:text-teal-400 font-mono block leading-tight">{retentionRate}% Retained</span>
            </div>
          </div>
        </div>

        {/* Module 2: Workforce Composition (Permanent vs Contractor vs Intern FTEs) */}
        <div className="col-span-1 lg:col-span-1 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Workforce Composition
              </span>
            </div>
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 font-semibold font-mono">
              {data.total_employees} Staff
            </span>
          </div>

          <div className="flex-1 min-h-0 flex flex-col pt-0.5">
            <EmpTypeBreakdown
              data={data.emp_type_distribution}
              onSelectType={handleSelectEmpType}
            />
          </div>
        </div>

        {/* Module 3: Operational Project -> Manager Hierarchy / Grades / Age Curve */}
        <div className="col-span-1 lg:col-span-2 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                {hierarchyView === 'hierarchy' ? (
                  <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                ) : hierarchyView === 'pyramid' ? (
                  <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                )}
                {hierarchyView === 'hierarchy'
                  ? 'Project & Manager Hierarchy'
                  : hierarchyView === 'pyramid'
                  ? 'Job Level Hierarchy'
                  : 'No. Of Employee By Age'}
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {hierarchyView === 'hierarchy'
                  ? 'Project account to delivery manager span of control'
                  : hierarchyView === 'pyramid'
                  ? 'Structural grade pyramid distribution'
                  : 'Demographic age bell curve with density gradient'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px]">
                <button
                  type="button"
                  onClick={() => setHierarchyView('hierarchy')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    hierarchyView === 'hierarchy'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Project -> Delivery Manager Hierarchy"
                >
                  <Building2 className="w-2.5 h-2.5" />
                  Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchyView('pyramid')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    hierarchyView === 'pyramid'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Grade Pyramid View"
                >
                  <Layers className="w-2.5 h-2.5" />
                  Grades
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchyView('age')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    hierarchyView === 'age'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Age Distribution Histogram"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  Age
                </button>
              </div>
              <span className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-bold font-mono">
                {hierarchyView === 'hierarchy'
                  ? `${displayedHierarchyManagers.length} Leads`
                  : hierarchyView === 'pyramid'
                  ? `${data.total_employees} Staff · 4 Tiers`
                  : `${data.age_distribution?.stats?.median || 29.5}y Med`}
              </span>
            </div>
          </div>

          {hierarchyView === 'hierarchy' ? (
            <>
              {/* Project Tab Switcher (if multiple projects) */}
              {projectManagerHierarchy.length > 1 && (
                <div className="flex items-center gap-1 pt-1 overflow-x-auto custom-scrollbar shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedHierarchyProj('ALL')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedHierarchyProj === 'ALL'
                        ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    All ({data.total_employees})
                  </button>
                  {projectManagerHierarchy.map((pGroup) => (
                    <button
                      key={pGroup.project}
                      type="button"
                      onClick={() => setSelectedHierarchyProj(pGroup.project)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                        selectedHierarchyProj === pGroup.project
                          ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pGroup.project} ({pGroup.headcount})
                    </button>
                  ))}
                </div>
              )}

              {/* Scrollable List of Delivery Managers */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-1 space-y-1 min-h-0 max-h-[160px]">
                {displayedHierarchyManagers.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs py-4">
                    No manager data available for active cohort
                  </div>
                ) : (
                  displayedHierarchyManagers.map((mgr: any) => (
                    <div
                      key={mgr.manager}
                      onClick={() => handleSelectHierarchyManager(mgr.name, mgr.manager, selectedHierarchyProj)}
                      className="flex flex-col gap-0.5 cursor-pointer group p-1.5 rounded-lg hover:bg-purple-50/70 dark:hover:bg-purple-950/40 border border-slate-100 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all shadow-2xs"
                      title={`Click to view engineers reporting to ${mgr.name}`}
                    >
                      <div className="flex items-center justify-between text-[10.5px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                            {mgr.name}
                          </span>
                          {mgr.projectsSummary && (
                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[80px]">
                              [{mgr.projectsSummary}]
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{mgr.count} staff</span>
                          <span className="text-slate-400 dark:text-slate-500">({mgr.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-600 dark:bg-purple-400 h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                          style={{ width: `${Math.max(4, mgr.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                <span>Account: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedHierarchyProj === 'ALL' ? 'Multi-Project Delivery' : `${selectedHierarchyProj} Project`}</strong></span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{displayedHierarchyManagers.length} Delivery Leads</span>
              </div>
            </>
          ) : hierarchyView === 'pyramid' ? (
            <div className="flex-1 flex flex-col justify-around py-2 min-h-0 gap-1.5">
              {pyramidTiers.map((tier: any, idx: number) => {
                const widths = ['w-[65%]', 'w-[78%]', 'w-[88%]', 'w-full'];
                const bgColors = [
                  'bg-purple-50/80 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 hover:border-purple-400',
                  'bg-cyan-50/80 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 hover:border-cyan-400',
                  'bg-teal-50/80 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 hover:border-teal-400',
                  'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:border-emerald-400',
                ];

                return (
                  <div
                    key={tier.tier}
                    onClick={() => {
                      const items = allDrilldownItems.filter((e) => tier.grades?.includes(e.job_level));
                      openDrilldown(
                        `${tier.tier} (${tier.grades?.join(', ')})`,
                        `${tier.count} staff members in this organizational grade tier (${tier.percentage}% of workforce)`,
                        `${tier.count} Staff`,
                        items,
                        'job_level',
                        tier.grades
                      );
                    }}
                    className={`${widths[idx]} mx-auto px-3 py-1.5 rounded-xl border flex items-center justify-between shadow-2xs transition-all cursor-pointer hover:scale-[1.02] hover:shadow-sm active:scale-[0.99] ${bgColors[idx]}`}
                    title={`Click to view roster for ${tier.tier}`}
                  >
                    <div className="min-w-0 flex items-center gap-1.5 flex-1 pr-1">
                      <span className="text-[11.5px] font-bold truncate">{tier.tier}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.2 rounded bg-white/70 dark:bg-slate-900/70 border border-black/10 dark:border-white/10 shrink-0">
                        {tier.grades?.join(', ') || ''}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold font-mono text-[13px]">{tier.count}</span>
                      <span className="text-[10.5px] font-mono opacity-75 ml-1">({tier.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col pt-0.5">
              <AgeDistributionChart
                data={data.age_distribution}
                onSelectAgeBin={handleSelectAgeBin}
              />
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 3: STABILITY, FOOTPRINT & DEPARTMENTS (Interactive Slicers) ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-2 flex-1 min-h-0">
        
        {/* Module 4: Stability & Tenure Bands (Clickable Horizontal Bars) */}
        <div className="col-span-1 lg:col-span-1 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Tenure Distribution Bands</span>
            </div>
            <span className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 font-mono font-bold">
              Avg {data.avg_infinite_exp} Yrs
            </span>
          </div>

          {/* Horizontal Progress Bars */}
          <div className="flex-1 flex flex-col justify-around py-1.5 min-h-0">
            {stabilityBands.map((band: any) => {
              const bandFilters: Record<string, (exp: number) => boolean> = {
                '< 1 Yr': (exp) => exp < 1,
                '1 to 3 Yrs': (exp) => exp >= 1 && exp < 3,
                '3 to 5 Yrs': (exp) => exp >= 3 && exp < 5,
                '5 to 10 Yrs': (exp) => exp >= 5 && exp < 10,
                '10+ Yrs': (exp) => exp >= 10,
              };
              const filterFn = bandFilters[band.band];
              const bandItems = filterFn
                ? allDrilldownItems.filter((e) => e.infinite_exp !== undefined && filterFn(e.infinite_exp))
                : allDrilldownItems;

              return (
                <div
                  key={band.band}
                  onClick={() => {
                    openDrilldown(
                      `Tenure Band: ${band.band} (${band.label})`,
                      `${bandItems.length} employees with ${band.band} tenure at ETS (${band.percentage}% of workforce)`,
                      `${bandItems.length} Staff`,
                      bandItems,
                      'tenure_band',
                      [band.band],
                      false,
                      true
                    );
                  }}
                  className="flex flex-col gap-0.5 cursor-pointer group p-0.5 rounded hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  title={`Click to view ${bandItems.length} employees in ${band.band} tenure band`}
                >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
                    {band.band}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                    <b className="text-slate-800 dark:text-slate-200 font-bold">{band.count}</b> ({band.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                    style={{ width: `${Math.max(4, band.percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
          </div>

          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>{stabilityFooterText}</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold">
              {data.avg_infinite_exp >= 2.5 ? 'High Stability' : 'Active Ramp-up'}
            </span>
          </div>
        </div>

        {/* Module 5: Regional Delivery Footprint Hubs (Interactive India Geo Map & Donut Switcher) */}
        <div className="col-span-1 lg:col-span-1 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Delivery Footprint</span>
            </div>

            {/* View Switcher & Badge */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px]">
                <button
                  type="button"
                  onClick={() => setFootprintView('map')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    footprintView === 'map'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Geographic Hub Map View"
                >
                  <MapPin className="w-2.5 h-2.5" />
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setFootprintView('donut')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    footprintView === 'donut'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Donut Chart View"
                >
                  <PieChartIcon className="w-2.5 h-2.5" />
                  Donut
                </button>
              </div>
              <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
                4 Hubs
              </span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-12 gap-2 items-center min-h-0 py-1">
            {/* Left: Interactive India Map or Big Hero Donut (7 cols) */}
            <div className="col-span-7 h-full relative flex items-center justify-center min-h-[140px]">
              {footprintView === 'map' ? (
                <IndiaDeliveryMap
                  locations={rankedLocs}
                  hoveredLocation={hoveredLocName}
                  onHoverLocation={setHoveredLocByName}
                  onSelectLocation={handleSelectLocation}
                />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={rankedLocs}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="count"
                        onMouseEnter={(_, i) => setHoveredLocIndex(i)}
                        onMouseLeave={() => setHoveredLocIndex(null)}
                        onClick={(e: any) => {
                          const locName = e?.location || e?.payload?.location;
                          if (locName) handleSelectLocation(locName);
                        }}
                      >
                        {rankedLocs.map((e, i) => (
                          <Cell
                            key={i}
                            fill={e.color}
                            stroke={hoveredLocIndex === i ? 'var(--text)' : 'var(--surface)'}
                            strokeWidth={hoveredLocIndex === i ? 2.5 : 1.5}
                            className="cursor-pointer"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: 'var(--shadow-soft)',
                        }}
                        formatter={(v: any, _: any, p: any) => [`${v} Staff (${p.payload.percentage}%)`, p.payload.location]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {activeHovered ? (
                      <>
                        <span className="text-[10px] font-bold truncate max-w-[65px]" style={{ color: activeHovered.color }}>
                          {activeHovered.location}
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                          {activeHovered.count}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono mt-0.5">
                          {activeHovered.percentage}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                          {rankedLocs.length}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                          Hub Cities
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right: Slim, High-Density Legend (5 cols) */}
            <div className="col-span-5 flex flex-col justify-center gap-1.5 h-full pl-1 border-l border-slate-100 dark:border-slate-800/80">
              {rankedLocs.slice(0, 4).map((loc, i) => {
                const hov = hoveredLocIndex === i;
                return (
                  <div
                    key={loc.location}
                    onMouseEnter={() => setHoveredLocIndex(i)}
                    onMouseLeave={() => setHoveredLocIndex(null)}
                    onClick={() => handleSelectLocation(loc.location)}
                    className={`px-1.5 py-1 rounded-md transition-all cursor-pointer flex flex-col gap-0.5 ${
                      hov
                        ? 'bg-slate-100 dark:bg-slate-800 shadow-2xs'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                    title={`Click to view employees in ${loc.location}`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: loc.color }}
                        />
                        <span className={`font-semibold truncate text-[11px] ${hov ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
                          {loc.location}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                        <b className="text-slate-800 dark:text-slate-100 font-bold">{loc.count}</b> ({loc.percentage}%)
                      </span>
                    </div>
                    {/* Slim progress bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(3, loc.percentage)}%`, backgroundColor: loc.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-footer insight */}
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Geographic Concentration:</span>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{southPct}% South Corridor (BLR + HYD)</span>
          </div>
        </div>

        {/* Module 6: Operational Allocation (Client Accounts, MMIS Squads, Functional Units) */}
        <div className="col-span-1 lg:col-span-2 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              {allocationView === 'projects' ? (
                <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : allocationView === 'mmis' ? (
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                {allocationView === 'projects'
                  ? 'Client Account Allocation'
                  : allocationView === 'mmis'
                  ? 'MMIS Delivery Squads'
                  : 'Department Allocation'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px]">
                <button
                  type="button"
                  onClick={() => setAllocationView('projects')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    allocationView === 'projects'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="External Client State Accounts (New Hampshire, North Dakota, Alaska)"
                >
                  <Briefcase className="w-2.5 h-2.5" />
                  Projects
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationView('mmis')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    allocationView === 'mmis'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title={`MMIS Delivery Modules (${totalMmisEmployees} Engineers across ${totalMmisModulesCount} Modules)`}
                >
                  <Layers className="w-2.5 h-2.5" />
                  MMIS Squads
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationView('departments')}
                  className={`px-1.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    allocationView === 'departments'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Internal Functional Units (IT, Core, QA, Infra, Cognos, Informatica)"
                >
                  <Building2 className="w-2.5 h-2.5" />
                  Units
                </button>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold font-mono ${
                allocationView === 'mmis'
                  ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800'
                  : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
              }`}>
                {allocationView === 'projects'
                  ? `${clientProjects.length} Accounts`
                  : allocationView === 'mmis'
                  ? `${totalMmisEmployees} Engineers`
                  : `${deptList.length} Units`}
              </span>
            </div>
          </div>

          {allocationView === 'projects' ? (
            <>
              {/* Client Accounts View (NH, ND, AK) with high visual polish */}
              <div className="flex-1 min-h-0 flex flex-col justify-around py-1 overflow-hidden">
                {clientProjects.map((p: any) => (
                  <div
                    key={p.code}
                    onClick={() => handleSelectProject(p.name, p.code)}
                    className="flex flex-col gap-0.5 cursor-pointer group p-1.5 rounded-lg hover:bg-slate-50/70 dark:hover:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 transition-all hover:scale-[1.01]"
                    title={`Click to view ${p.count} team members in ${p.name}`}
                  >
                    <div className="flex items-center justify-between text-[10.5px] leading-tight">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors truncate">
                          {p.name}
                        </span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                          {p.code}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                        <b className="text-slate-900 dark:text-slate-100 font-bold">{p.count}</b> ({p.percentage}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                        style={{ width: `${Math.max(4, p.percentage)}%`, backgroundColor: p.color }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[9.5px] text-slate-400 dark:text-slate-500 leading-none">
                      <span>{p.subtext}</span>
                      <span className="font-medium text-slate-600 dark:text-slate-400 font-mono">
                        {p.count} of {data?.total_employees || 590} FTE
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 leading-tight">
                <span>Dominant Account:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                  {clientProjects[0]?.name} ({clientProjects[0]?.percentage}%)
                </span>
              </div>
            </>
          ) : allocationView === 'mmis' ? (
            <>
              {/* MMIS Squads View with Top 5 Donut & All Toggle */}
              <div className="flex items-center justify-between py-0.5 text-[10.5px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {moduleView === 'donut' ? 'Top 5 Delivery Modules' : `All ${totalMmisModulesCount} Modules Ranked`}
                </span>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded border border-slate-200/60 dark:border-slate-700/60 text-[9.5px]">
                  <button
                    type="button"
                    onClick={() => setModuleView('donut')}
                    className={`px-1.5 py-0.2 rounded font-semibold transition-all ${
                      moduleView === 'donut'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() => setModuleView('list')}
                    className={`px-1.5 py-0.2 rounded font-semibold transition-all ${
                      moduleView === 'list'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    All {totalMmisModulesCount}
                  </button>
                </div>
              </div>

              {moduleView === 'donut' ? (
                <>
                  <div className="flex-1 grid grid-cols-12 gap-2 items-center min-h-0 py-0.5">
                    {/* Left: Donut Chart (7 cols) */}
                    <div className="col-span-7 h-full relative flex items-center justify-center min-h-[135px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={top5Modules}
                            cx="50%"
                            cy="50%"
                            innerRadius="50%"
                            outerRadius="80%"
                            paddingAngle={3}
                            dataKey="employee_count"
                            onMouseEnter={(_, i) => setHoveredModuleIndex(i)}
                            onMouseLeave={() => setHoveredModuleIndex(null)}
                            onClick={(e: any) => {
                              const modName = e?.module_name || e?.payload?.module_name;
                              if (modName) handleSelectModule(modName);
                            }}
                          >
                            {top5Modules.map((e, i) => (
                              <Cell
                                key={i}
                                fill={e.color}
                                stroke={hoveredModuleIndex === i ? 'var(--text)' : 'var(--surface)'}
                                strokeWidth={hoveredModuleIndex === i ? 2.5 : 1.5}
                                className="cursor-pointer"
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--border)',
                              borderRadius: '8px',
                              fontSize: '11px',
                              boxShadow: 'var(--shadow-soft)',
                            }}
                            formatter={(v: any, _: any, p: any) => [`${v} Engineers (${p.payload.percentage}%)`, p.payload.module_name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {activeHoveredModule ? (
                          <>
                            <span className="text-[10px] font-bold truncate max-w-[65px]" style={{ color: activeHoveredModule.color }}>
                              {activeHoveredModule.module_name}
                            </span>
                            <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                              {activeHoveredModule.employee_count}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono mt-0.5">
                              {activeHoveredModule.percentage}%
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                              {totalMmisModulesCount}
                            </span>
                            <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              MODULES
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Slim Top 5 Legend (5 cols) */}
                    <div className="col-span-5 flex flex-col justify-center gap-1 h-full pl-1 border-l border-slate-100 dark:border-slate-800/80">
                      {top5Modules.map((mod, i) => {
                        const hov = hoveredModuleIndex === i;
                        return (
                          <div
                            key={mod.module_name}
                            onMouseEnter={() => setHoveredModuleIndex(i)}
                            onMouseLeave={() => setHoveredModuleIndex(null)}
                            onClick={() => handleSelectModule(mod.module_name)}
                            className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer flex flex-col gap-0.5 ${
                              hov
                                ? 'bg-slate-100 dark:bg-slate-800 shadow-2xs'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                            title={`Click to view ${mod.employee_count} Java developers in ${mod.module_name}`}
                          >
                            <div className="flex items-center justify-between text-[10.5px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: mod.color }} />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[65px]">
                                  {mod.module_name}
                                </span>
                              </div>
                              <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] shrink-0">
                                <b className="text-slate-900 dark:text-slate-100">{mod.employee_count}</b>
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(4, mod.percentage)}%`, backgroundColor: mod.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    <span>Primary Focus: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{top5Modules[0]?.module_name} ({top5Modules[0]?.employee_count} Devs · {top5Modules[0]?.percentage}%)</strong></span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{totalMmisModulesCount} Delivery Modules</span>
                  </div>
                </>
              ) : (
                <>
                  {/* All Modules: High-Density Scrollable List */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-1 space-y-1 min-h-0 max-h-[170px]">
                    {mmisModules.map((mod: any) => (
                      <div
                        key={mod.module_name}
                        onClick={() => handleSelectModule(mod.module_name)}
                        className="flex flex-col gap-0.5 cursor-pointer group p-1 rounded hover:bg-slate-50/60 dark:hover:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 transition-colors"
                        title={`Click to view ${mod.employee_count} engineers in ${mod.module_name}`}
                      >
                        <div className="flex items-center justify-between text-[10.5px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                              {mod.module_name}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                            <b className="text-slate-900 dark:text-slate-100 font-bold">{mod.employee_count}</b> ({mod.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 dark:bg-indigo-400 h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                            style={{ width: `${Math.max(4, mod.percentage * 4)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    <span>Workforce Scope: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{totalMmisEmployees} Engineers</strong></span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{totalMmisModulesCount} MMIS Modules</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col justify-between py-1 overflow-hidden">
                {deptList.map((d: any) => (
                  <div
                    key={d.department}
                    onClick={() => {
                      const items = allDrilldownItems.filter(
                        (item) => item.department.toLowerCase() === d.department.toLowerCase()
                      );
                      openDrilldown(
                        `${d.department} Department Team`,
                        `${d.count} specialists allocated to ${d.department} (${d.percentage}% of workforce)`,
                        `${d.count} Staff`,
                        items,
                        'department',
                        [d.department]
                      );
                    }}
                    className="flex flex-col gap-0.5 cursor-pointer group px-1 py-0.5 rounded hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                    title={`Click to view team members in ${d.department}`}
                  >
                    <div className="flex items-center justify-between text-[10.5px] leading-none">
                      <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors truncate">
                        {d.department}
                      </span>
                      <span className="font-mono text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">
                        <b className="text-slate-900 dark:text-slate-100 font-bold">{d.count}</b> ({d.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 dark:bg-blue-400 h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                        style={{ width: `${Math.max(3, d.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 leading-tight">
                <span>Core Delivery Load:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{top2Names} ({top2Pct.toFixed(1)}%)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ Unified Interactive Drill-Down Modal ══ */}
      {activeDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0c1829] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#0f1f35] shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    {activeDrilldown.title}
                  </h3>
                  {activeDrilldown.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-mono shrink-0">
                      {activeDrilldown.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {activeDrilldown.subtitle}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ExportButton
                  data={activeDrilldown.items}
                  filename={`${activeDrilldown.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_roster.csv`}
                  label="Export CSV"
                />
                {activeDrilldown.filterKey && setFilters && (
                  <button
                    onClick={applyDrilldownFilter}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-xs"
                    title="Apply this segment as a global filter"
                  >
                    <Filter className="w-3 h-3" />
                    <span>Filter Dashboard</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveDrilldown(null)}
                  className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Search Bar */}
            <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#0c1829] flex items-center gap-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, ID, grade, department, location, or project..."
                value={drilldownSearch}
                onChange={(e) => setDrilldownSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden"
              />
              {drilldownSearch && (
                <button onClick={() => setDrilldownSearch('')} className="text-slate-400 hover:text-slate-600 text-xs">
                  Clear
                </button>
              )}
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 min-h-[260px]">
              {(() => {
                const q = drilldownSearch.toLowerCase().trim();
                const filtered = activeDrilldown.items.filter((item) => {
                  if (!q) return true;
                  return (
                    item.name.toLowerCase().includes(q) ||
                    String(item.id).includes(q) ||
                    item.job_level.toLowerCase().includes(q) ||
                    item.job_title.toLowerCase().includes(q) ||
                    item.department.toLowerCase().includes(q) ||
                    item.location.toLowerCase().includes(q) ||
                    (item.project && item.project.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <EmptyState
                      compact
                      title="No matching records found"
                      description="No employees match your search query in this segment."
                      onResetFilters={drilldownSearch ? () => setDrilldownSearch('') : undefined}
                      resetLabel="Clear Search"
                    />
                  );
                }

                return (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-[#12223a]">
                        <th className="p-2">Employee</th>
                        <th className="p-2">Grade</th>
                        <th className="p-2">Title</th>
                        <th className="p-2">Department</th>
                        <th className="p-2">Location</th>
                        <th className="p-2">
                          {activeDrilldown.isExitList ? 'Exit Date' : activeDrilldown.isTenureList ? 'Company Tenure' : 'Experience'}
                        </th>
                        <th className="p-2 text-right">360 View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filtered.slice(0, 100).map((emp) => (
                        <tr
                          key={emp.id}
                          className="hover:bg-cyan-500/5 dark:hover:bg-cyan-500/10 transition-colors"
                        >
                          <td className="p-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">{emp.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">#{emp.id}</span>
                          </td>
                          <td className="p-2 font-mono font-bold text-cyan-700 dark:text-cyan-300">
                            {emp.job_level}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-300 truncate max-w-[140px]" title={emp.job_title}>
                            {emp.job_title}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-300">{emp.department}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-300">{emp.location}</td>
                          <td className="p-2 font-mono text-slate-600 dark:text-slate-300">
                            {activeDrilldown.isExitList ? (
                              emp.exit_date || 'Separated'
                            ) : activeDrilldown.isTenureList ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-teal-600 dark:text-teal-400">
                                  {emp.infinite_exp !== undefined ? `${emp.infinite_exp.toFixed(1)}y ETS` : '—'}
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  Total: {emp.total_exp !== undefined ? `${emp.total_exp.toFixed(1)}y` : '—'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {emp.total_exp !== undefined ? `${emp.total_exp.toFixed(1)}y` : '—'}
                                </span>
                                {emp.infinite_exp !== undefined && (
                                  <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium">
                                    ETS: {emp.infinite_exp.toFixed(1)}y
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => {
                                if (onOpenEmployeeProfile && emp.id) {
                                  onOpenEmployeeProfile(emp.id);
                                  setActiveDrilldown(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold text-[10px] border border-cyan-500/20 inline-flex items-center gap-1 transition-all"
                            >
                              <span>Profile</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f1f35] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Showing up to {Math.min(100, activeDrilldown.items.length)} of {activeDrilldown.items.length} records · Click "Profile" for 360 view
              </span>
              <button
                onClick={() => setActiveDrilldown(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
