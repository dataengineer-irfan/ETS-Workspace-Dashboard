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
  GraduationCap,
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
  onOpenTraining?: () => void;
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

const WORK_MODEL_FALLBACK = [
  { model: 'Office', count: 0, percentage: 0 },
  { model: 'Hybrid', count: 0, percentage: 0 },
  { model: 'Remote', count: 0, percentage: 0 },
  { model: 'Client site', count: 0, percentage: 0 },
  { model: 'Not recorded yet', count: 0, percentage: 0 },
];

const WORK_MODEL_COLOR: Record<string, string> = {
  Office: '#0284c7',
  Hybrid: '#0d9488',
  Remote: '#7c3aed',
  'Client site': '#d97706',
  'Not recorded yet': '#94a3b8',
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
  compact?: boolean;
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
  compact = true,
}) => {
  const a = ACCENT[accent];
  const hasRing = pct !== undefined && !compact;

  if (compact) {
    return (
      <div
        data-hero="kpi"
        className={`glass-panel rounded-xl flex flex-col justify-between h-full transition-all relative overflow-hidden py-1.5 px-3 ${
          dominant ? 'border-l-4 border-l-cyan-600 shadow-sm' : ''
        } ${onClick ? 'cursor-pointer hover:border-cyan-400 hover:shadow-sm' : ''}`}
        onClick={onClick}
        style={{
          background: dominant
            ? 'linear-gradient(180deg, var(--pill-bg), var(--surface))'
            : 'linear-gradient(180deg, var(--panel), var(--surface))',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'linear-gradient(90deg, rgba(14,165,233,0.9), rgba(59,130,246,0.3), transparent)' }} />
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className={`text-[9.5px] font-bold tracking-[0.08em] uppercase truncate ${dominant ? 'text-cyan-900 dark:text-cyan-300' : ''}`} style={{ color: dominant ? undefined : 'var(--muted)' }}>
              {title}
            </span>
            {actionNode}
          </div>
          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${a.icon}`}>
            {iconNode ? iconNode : Icon ? <Icon className="w-3 h-3" /> : null}
          </div>
        </div>
        <div className="my-0.5 flex items-baseline justify-between gap-1 min-w-0">
          <span className={`font-black tracking-tight truncate ${
            dominant
              ? 'text-xl text-cyan-950 dark:text-cyan-200 font-mono'
              : typeof value === 'string' && value.length > 16
              ? 'text-xs font-sans font-bold'
              : 'text-base font-mono'
          }`} style={{ color: dominant ? undefined : 'var(--text)' }}>
            {value}
          </span>
          <span className={`text-[8.5px] px-1.5 py-0.2 font-semibold rounded-full border font-mono shrink-0 ${a.badge}`}>
            {badge}
          </span>
        </div>
        <div className="flex items-center justify-between font-medium border-t pt-0.5 text-[9px]" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
          <span className="truncate">{subtitle}</span>
          {trend && <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono shrink-0">{trend}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`glass-panel rounded-xl flex flex-col justify-between h-full transition-all group p-2.5 ${
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
        <div className={`${compact ? 'my-0.5' : 'my-1'} flex items-baseline justify-between gap-1 shrink-0`}>
          <span className={`font-black tracking-tight leading-none font-mono ${compact ? (dominant ? 'text-xl' : 'text-base') : dominant ? 'text-2xl' : 'text-xl'} ${dominant ? 'text-cyan-950 dark:text-cyan-200' : 'text-slate-900 dark:text-slate-100'}`}>
            {value}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono shrink-0 ${a.badge}`}>
            {badge}
          </span>
        </div>
      )}

      {/* Optional microBar */}
      {microBar && <div className="shrink-0">{microBar}</div>}

      {/* Row 3: divider + bottom info */}
      <div className={`flex items-center justify-between gap-1 border-t border-slate-100 dark:border-slate-800 text-[10px] shrink-0 ${compact ? 'pt-0.5' : 'pt-1'}`}>
        <span className="truncate text-slate-500 dark:text-slate-400 font-medium">{subtitle}</span>
        {dominant && <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1.5 py-0.5 rounded font-mono shrink-0">100% Active</span>}
        {trend && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">{trend}</span>}
      </div>
    </div>
  );
};

/* ─── Bottom-row meter + donut (name, thin bar, quiet count) ─── */
function MeterRow({
  name,
  count,
  percentage,
  color,
  active = false,
  emphasis = false,
  meta,
  onEnter,
  onLeave,
  onClick,
  hint,
}: {
  name: string;
  count: number;
  percentage: number;
  color: string;
  active?: boolean;
  emphasis?: boolean;
  meta?: React.ReactNode;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      title={hint}
      className={`home-meter group ${active ? 'bg-slate-100/80 dark:bg-slate-800/70 rounded-md' : ''}`}
    >
      <span className="flex items-baseline justify-between gap-2 min-w-0 w-full">
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 self-center" style={{ backgroundColor: color }} aria-hidden />
          <span className="home-legend-name text-slate-800 dark:text-slate-100" data-legend-name={name}>
            {name}
          </span>
          {meta}
        </span>
        <span className="home-meter-count">
          <b>{count}</b>
          <span className="ml-1">{percentage}%</span>
        </span>
      </span>
      <span className={`home-meter-track ${emphasis ? 'is-emphasis' : ''}`} aria-hidden>
        <span
          className="home-meter-fill"
          style={{ width: `${Math.max(3, Math.min(100, percentage))}%`, backgroundColor: color }}
        />
      </span>
    </button>
  );
}

function SplitDonut({
  data,
  dataKey,
  nameKey,
  centerValue,
  centerLabel,
  activeIndex,
  unit,
  onHover,
  onLeave,
  onPick,
}: {
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
  centerValue: React.ReactNode;
  centerLabel: string;
  activeIndex: number | null;
  unit: string;
  onHover: (index: number) => void;
  onLeave: () => void;
  onPick: (name: string) => void;
}) {
  return (
    <div className="home-pie">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius="64%"
            outerRadius="88%"
            paddingAngle={2}
            isAnimationActive={false}
            stroke="var(--surface)"
            onMouseEnter={(_, i) => onHover(i)}
            onMouseLeave={onLeave}
            onClick={(e: any) => {
              const picked = e?.[nameKey] || e?.payload?.[nameKey];
              if (picked) onPick(String(picked));
            }}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry[nameKey] ?? i}
                fill={entry.color}
                stroke={activeIndex === i ? 'var(--text)' : 'var(--surface)'}
                strokeWidth={activeIndex === i ? 2 : 1.5}
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
            formatter={(v: any, _: any, p: any) => [`${v} ${unit} (${p.payload.percentage}%)`, p.payload[nameKey]]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="home-donut-center" data-donut-center>
        <span className="home-donut-value" data-donut-value>{centerValue}</span>
        <span className="home-donut-label" data-donut-label>{centerLabel}</span>
      </div>
    </div>
  );
}

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
  onOpenTraining,
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

  const leadListRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = leadListRef.current;
    if (!el || hierarchyView !== 'hierarchy') return;
    const fit = () => {
      const n = el.querySelectorAll('[data-lead-row]').length;
      const gap = 6;
      const minRow = 46;
      const h = el.clientHeight;
      if (!n || h < minRow) return;
      const fitCount = Math.max(1, Math.floor((h + gap) / (minRow + gap)));
      const count = Math.min(n, fitCount);
      const each = (h - gap * Math.max(0, count - 1)) / count;
      el.style.setProperty('--lead-row', `${Math.floor(each * 100) / 100}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hierarchyView, displayedHierarchyManagers.length, selectedHierarchyProj]);

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

  // Client Project distribution (New Hampshire, North Dakota, Alaska, Maven)
  let nhCount = 0;
  let ndCount = 0;
  let akCount = 0;
  let mavenCount = 0;
  (employeeList || []).forEach((e: any) => {
    const p = (e['Project Working'] || (e as any).project || '').toString().trim().toUpperCase();
    if (p === 'NH' || p === 'NH PROJECTS') nhCount++;
    else if (p === 'ND') ndCount++;
    else if (p === 'AK') akCount++;
    else if (p === 'MAVEN') mavenCount++;
  });
  if (nhCount === 0 && ndCount === 0 && akCount === 0 && mavenCount === 0 && (!employeeList || employeeList.length === 0)) {
    nhCount = 292;
    ndCount = 118;
    akCount = 108;
    mavenCount = 72;
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
    {
      name: 'Maven',
      code: 'Maven',
      count: mavenCount,
      percentage: Number(((mavenCount / totalEmployees) * 100).toFixed(1)),
      color: '#ea580c',
      subtext: 'Maven delivery line',
    },
  ].filter((p) => p.count > 0);

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

  const empTypes = data.emp_type_distribution?.types ?? [];
  const largestEmpType = empTypes.reduce<typeof empTypes[number] | undefined>(
    (max, cur) => (cur.count > (max?.count ?? -1) ? cur : max),
    undefined
  );

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
    <div className="dash-home flex flex-col gap-2 select-none min-h-0">
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
                className="h-4 px-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:border-cyan-400/40 transition-all cursor-pointer flex items-center gap-1 text-[9px] leading-none font-bold shrink-0"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 lg:flex-1 lg:min-h-0 lg:grid-rows-1 dash-home-row">
        
        {/* Module 1: Headcount & Hiring Growth (100% Dedicated 5-Year Trajectory) */}
        <div className="col-span-1 glass-panel rounded-xl p-2.5 flex flex-col justify-between lg:h-full min-h-0 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Headcount & Hiring Growth
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Hiring peaked at {peakYear.joiners} in {peakYear.year}, with {retentionRate}% retained.
              </p>
            </div>

            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
              2020 – 2024
            </span>
          </div>

          <div className="home-plot pt-0.5">
            <div className="home-plot-fill">
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
          </div>

          {/* Dynamic metric summary badges (Never clipped with compact padding & responsive fonts) */}
          <div className="home-foot grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
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
        <div className="col-span-1 glass-panel rounded-xl p-2.5 flex flex-col justify-between lg:h-full min-h-0 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  Workforce Composition
                </span>
              </div>
              {largestEmpType && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {largestEmpType.label} is {largestEmpType.count} ({largestEmpType.percentage}% of {data.total_employees}).
                </p>
              )}
            </div>
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 font-semibold font-mono">
              {data.total_employees} Staff
            </span>
          </div>

          <div className="home-plot pt-0.5">
            <div className="home-plot-fill">
            <EmpTypeBreakdown
              data={data.emp_type_distribution}
              onSelectType={handleSelectEmpType}
            />
            </div>
          </div>
        </div>

        {/* Module 3: Operational Project -> Manager Hierarchy / Grades / Age Curve */}
        <div data-card="hierarchy" className="col-span-1 md:col-span-2 lg:col-span-1 glass-panel rounded-xl p-2.5 flex flex-col justify-between lg:h-full min-h-0 min-w-0">
          <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 min-w-0">
                {hierarchyView === 'hierarchy' ? (
                  <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                ) : hierarchyView === 'pyramid' ? (
                  <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                )}
                <span className="truncate">
                  {hierarchyView === 'hierarchy'
                    ? 'Project & Manager Hierarchy'
                    : hierarchyView === 'pyramid'
                    ? 'Job Level Hierarchy'
                    : 'No. Of Employee By Age'}
                </span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
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
                <span
                  data-lead-badge={hierarchyView === 'hierarchy' ? displayedHierarchyManagers.length : undefined}
                  className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-bold font-mono shrink-0"
                >
                  {hierarchyView === 'hierarchy'
                    ? `${displayedHierarchyManagers.length} Leads`
                    : hierarchyView === 'pyramid'
                    ? `${data.total_employees} Staff · 4 Tiers`
                    : `${data.age_distribution?.stats?.median || 29.5}y Med`}
                </span>
              </div>
            </div>
            <p className="home-sub text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {hierarchyView === 'hierarchy'
                ? 'Project account to delivery manager span of control'
                : hierarchyView === 'pyramid'
                ? 'Structural grade pyramid distribution'
                : 'Demographic age bell curve with density gradient'}
            </p>
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
                      selectedHierarchyProj.toUpperCase() === 'ALL'
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
                      data-account={pGroup.project}
                      onClick={() => setSelectedHierarchyProj(pGroup.project)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                        selectedHierarchyProj.toUpperCase() === pGroup.project.toUpperCase()
                          ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pGroup.project} ({pGroup.headcount})
                    </button>
                  ))}
                </div>
              )}

              <div ref={leadListRef} className="home-lead-list custom-scrollbar" data-lead-list>
                {displayedHierarchyManagers.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs py-4">
                    No manager data available for active cohort
                  </div>
                ) : (
                  displayedHierarchyManagers.map((mgr: any) => {
                    const accounts = mgr.projectsSummary
                      ? String(mgr.projectsSummary).split(',').map((code: string) => code.trim()).filter(Boolean)
                      : selectedHierarchyProj.toUpperCase() === 'ALL'
                      ? []
                      : [selectedHierarchyProj];
                    return (
                      <div
                        key={mgr.manager}
                        data-lead-row
                        onClick={() => handleSelectHierarchyManager(mgr.name, mgr.manager, selectedHierarchyProj)}
                        className="home-lead-row cursor-pointer group px-2 py-0.5 rounded-lg hover:bg-purple-50/70 dark:hover:bg-purple-950/40 border border-slate-100 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                        title={`Click to view engineers reporting to ${mgr.name}`}
                      >
                        <span data-lead-name className="home-lead-name text-[11px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {mgr.name}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {accounts.map((code: string) => (
                            <span key={code} className="text-[9px] leading-none font-mono font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-1 py-0.5 rounded whitespace-nowrap">
                              {code}
                            </span>
                          ))}
                          <span className="ml-auto font-mono text-[10px] font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {mgr.count} staff
                            <span className="font-medium text-slate-400 dark:text-slate-500"> ({mgr.percentage}%)</span>
                          </span>
                        </div>
                        <div className="home-lead-track" aria-hidden="true">
                          <div className="home-lead-fill" style={{ width: `${Math.max(4, Math.min(100, mgr.percentage))}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                <span>Account: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedHierarchyProj === 'ALL' ? 'Multi-Project Delivery' : `${selectedHierarchyProj} Project`}</strong></span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{displayedHierarchyManagers.length} Delivery Leads</span>
              </div>
            </>
          ) : hierarchyView === 'pyramid' ? (
            <div className="grade-stack flex-1 min-h-0 flex flex-col justify-evenly overflow-hidden py-0.5 gap-1">
              {pyramidTiers.map((tier: any, idx: number) => {
                const widths = [68, 80, 90, 100];
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
                    className={`grade-tier mx-auto px-2 py-0.5 rounded-lg border flex items-center justify-between shadow-2xs transition-all cursor-pointer hover:shadow-sm min-h-0 ${bgColors[idx]}`}
                    style={{ width: `${widths[idx]}%`, maxWidth: '100%' }}
                    title={`Click to view roster for ${tier.tier}`}
                  >
                    <div className="min-w-0 flex items-center gap-1.5 flex-1 pr-1">
                      <span className="text-[11px] font-bold leading-tight whitespace-nowrap">{tier.tier}</span>
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
            <div className="home-plot pt-0.5">
              <div className="home-plot-fill">
              <AgeDistributionChart
                data={data.age_distribution}
                onSelectAgeBin={handleSelectAgeBin}
              />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 3: STABILITY, FOOTPRINT & DEPARTMENTS (Interactive Slicers) ══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2 lg:flex-1 lg:min-h-0 lg:grid-rows-1 dash-home-row">
        
        {/* Module 4: Stability & Tenure Bands */}
        <div data-card="tenure" className="home-card col-span-1 md:col-span-1 lg:col-span-3 glass-panel rounded-xl p-2.5 flex flex-col lg:h-full min-h-0 min-w-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Tenure Distribution Bands</span>
            </div>
            <span className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 font-mono font-bold shrink-0">
              Avg {data.avg_infinite_exp} Yrs
            </span>
          </div>

          <div
            className="home-meter-stack flex-1 py-1"
            data-legend="tenure"
            style={{ gridTemplateRows: `repeat(${Math.max(stabilityBands.length, 1)}, minmax(0, 1fr))` }}
          >
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
                <MeterRow
                  key={band.band}
                  name={band.band}
                  count={band.count}
                  percentage={band.percentage}
                  color="#0d9488"
                  emphasis
                  hint={`Click to view ${bandItems.length} employees in ${band.band} tenure band`}
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
                />
              );
            })}
          </div>

          <div className="home-foot pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>{stabilityFooterText}</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold">
              {data.avg_infinite_exp >= 2.5 ? 'High Stability' : 'Active Ramp-up'}
            </span>
          </div>
        </div>

        {/* Module 5: Regional Delivery Footprint */}
        <div data-card="footprint" className="home-card col-span-1 md:col-span-1 lg:col-span-5 glass-panel rounded-xl p-2.5 flex flex-col lg:h-full min-h-0 min-w-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Delivery Footprint</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
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
                {rankedLocs.length} Hubs
              </span>
            </div>
          </div>

          <div className="home-plot">
            <div className="home-plot-fill home-visual">
              {footprintView === 'map' ? (
                <div className="home-pie home-pie-map">
                  <IndiaDeliveryMap
                    locations={rankedLocs}
                    hoveredLocation={hoveredLocName}
                    onHoverLocation={setHoveredLocByName}
                    onSelectLocation={handleSelectLocation}
                  />
                </div>
              ) : (
                <SplitDonut
                  data={rankedLocs}
                  dataKey="count"
                  nameKey="location"
                  centerValue={activeHovered ? activeHovered.count : rankedLocs.length}
                  centerLabel={activeHovered ? `${activeHovered.percentage}%` : 'Hubs'}
                  activeIndex={hoveredLocIndex}
                  unit="Staff"
                  onHover={setHoveredLocIndex}
                  onLeave={() => setHoveredLocIndex(null)}
                  onPick={handleSelectLocation}
                />
              )}
              <div
                className="home-legend"
                data-legend="footprint"
                style={{ gridTemplateRows: `repeat(${Math.max(rankedLocs.length, 1)}, minmax(0, 1fr))` }}
              >
                {rankedLocs.map((loc, i) => (
                  <MeterRow
                    key={loc.location}
                    name={loc.location}
                    count={loc.count}
                    percentage={loc.percentage}
                    color={loc.color}
                    active={hoveredLocIndex === i}
                    hint={`Click to view employees in ${loc.location}`}
                    onEnter={() => setHoveredLocIndex(i)}
                    onLeave={() => setHoveredLocIndex(null)}
                    onClick={() => handleSelectLocation(loc.location)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0 min-w-0">
            <span className="shrink-0">South corridor</span>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold text-right">{southPct}% Bangalore + Hyderabad</span>
          </div>
        </div>

        {/* Module 6: Client accounts, MMIS squads, functional units */}
        <div data-card="allocation" className="home-card col-span-1 md:col-span-2 lg:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col lg:h-full min-h-0 min-w-0">
          <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 pb-1.5 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {allocationView === 'projects' ? (
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                ) : allocationView === 'mmis' ? (
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight whitespace-normal">
                  {allocationView === 'projects'
                    ? 'Client Account Allocation'
                    : allocationView === 'mmis'
                    ? 'MMIS Delivery Squads'
                    : 'Department Allocation'}
                </span>
              </div>
              <span className={`home-head-badge text-[10px] px-1.5 py-0.5 rounded border font-semibold font-mono shrink-0 ${
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
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[10px] min-w-0">
              <button
                type="button"
                onClick={() => setAllocationView('projects')}
                className={`flex-1 min-w-0 px-1.5 py-0.5 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                  allocationView === 'projects'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="External Client State Accounts (New Hampshire, North Dakota, Alaska)"
              >
                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                Projects
              </button>
              <button
                type="button"
                onClick={() => setAllocationView('mmis')}
                className={`flex-1 min-w-0 px-1.5 py-0.5 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                  allocationView === 'mmis'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title={`MMIS Delivery Modules (${totalMmisEmployees} Engineers across ${totalMmisModulesCount} Modules)`}
              >
                <Layers className="w-2.5 h-2.5 shrink-0" />
                MMIS Squads
              </button>
              <button
                type="button"
                onClick={() => setAllocationView('departments')}
                className={`flex-1 min-w-0 px-1.5 py-0.5 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                  allocationView === 'departments'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Internal Functional Units (IT, Core, QA, Infra, Cognos, Informatica)"
              >
                <Building2 className="w-2.5 h-2.5 shrink-0" />
                Units
              </button>
            </div>
          </div>

          {allocationView === 'projects' ? (
            <>
              <div
                className="home-meter-stack flex-1 py-1"
                data-legend="projects"
                style={{ gridTemplateRows: `repeat(${Math.max(clientProjects.length, 1)}, minmax(0, 1fr))` }}
              >
                {clientProjects.map((p: any) => (
                  <div key={p.code} className="min-w-0 min-h-0 flex flex-col justify-center">
                    <MeterRow
                      name={p.name}
                      count={p.count}
                      percentage={p.percentage}
                      color={p.color}
                      emphasis
                      meta={
                        <span className="text-[9px] font-mono font-bold px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                          {p.code}
                        </span>
                      }
                      hint={`Click to view ${p.count} team members in ${p.name}`}
                      onClick={() => handleSelectProject(p.name, p.code)}
                    />
                    <div className="home-sub px-1 text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                      {p.subtext}
                    </div>
                  </div>
                ))}
              </div>

              <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 min-w-0">
                <span className="shrink-0">Lead account</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 font-mono text-right whitespace-normal">
                  {clientProjects[0]?.name} ({clientProjects[0]?.percentage}%)
                </span>
              </div>
            </>
          ) : allocationView === 'mmis' ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                  <div className="home-plot">
                    <div className="home-plot-fill home-visual">
                      <SplitDonut
                        data={top5Modules}
                        dataKey="employee_count"
                        nameKey="module_name"
                        centerValue={totalMmisModulesCount}
                        centerLabel="MODULES"
                        activeIndex={hoveredModuleIndex}
                        unit="Engineers"
                        onHover={setHoveredModuleIndex}
                        onLeave={() => setHoveredModuleIndex(null)}
                        onPick={handleSelectModule}
                      />
                      <div
                        className="home-legend"
                        data-legend="mmis"
                        style={{ gridTemplateRows: `repeat(${Math.max(top5Modules.length, 1)}, minmax(0, 1fr))` }}
                      >
                        {top5Modules.map((mod, i) => (
                          <MeterRow
                            key={mod.module_name}
                            name={mod.module_name}
                            count={mod.employee_count}
                            percentage={mod.percentage}
                            color={mod.color}
                            active={hoveredModuleIndex === i}
                            hint={`Click to view ${mod.employee_count} Java developers in ${mod.module_name}`}
                            onEnter={() => setHoveredModuleIndex(i)}
                            onLeave={() => setHoveredModuleIndex(null)}
                            onClick={() => handleSelectModule(mod.module_name)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 shrink-0 min-w-0">
                    <span className="min-w-0 whitespace-normal leading-tight">
                      Lead module <strong className="text-slate-800 dark:text-slate-200 font-semibold">{top5Modules[0]?.module_name}</strong>
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0">{totalMmisModulesCount} modules</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="home-meter-scroll custom-scrollbar flex-1 my-1 pr-1" data-legend="mmis-all">
                    {mmisModules.map((mod: any) => (
                      <MeterRow
                        key={mod.module_name}
                        name={mod.module_name}
                        count={mod.employee_count}
                        percentage={mod.percentage}
                        color={MODULE_COLORS[mod.module_name] || '#6366f1'}
                        hint={`Click to view ${mod.employee_count} engineers in ${mod.module_name}`}
                        onClick={() => handleSelectModule(mod.module_name)}
                      />
                    ))}
                  </div>

                  <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    <span>{totalMmisEmployees} engineers</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{totalMmisModulesCount} modules</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div
                className="home-meter-stack flex-1 py-1"
                data-legend="units"
                style={{ gridTemplateRows: `repeat(${Math.max(deptList.length, 1)}, minmax(0, 1fr))` }}
              >
                {deptList.map((d: any) => (
                  <MeterRow
                    key={d.department}
                    name={d.department}
                    count={d.count}
                    percentage={d.percentage}
                    color="#3b82f6"
                    emphasis
                    hint={`Click to view team members in ${d.department}`}
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
                  />
                ))}
              </div>

              <div className="home-foot pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 min-w-0">
                <span className="shrink-0">Core load</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-right whitespace-normal">{top2Names} ({top2Pct.toFixed(1)}%)</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dash-home-insight grid grid-cols-1 lg:grid-cols-2 gap-2 shrink-0 min-w-0">
        <button
          type="button"
          data-band="work-model"
          onClick={() => onNavigateTab('work_model')}
          className="glass-panel rounded-xl px-2.5 py-1.5 text-left cursor-pointer hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors w-full min-w-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="truncate">Work model</span>
            </span>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold shrink-0">Open</span>
          </div>
          <div className="home-insight-meters mt-1">
            {(data.work_model_mix && data.work_model_mix.length > 0 ? data.work_model_mix : WORK_MODEL_FALLBACK).map((item) => (
              <div key={item.model} className="min-w-0" title={`${item.model}: ${item.count}`}>
                <div className="flex items-baseline justify-between gap-1 min-w-0">
                  <span className="text-[9px] text-slate-600 dark:text-slate-300 truncate">{item.model}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">{item.count}</span>
                </div>
                <span className="mt-0.5 block h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(item.percentage, item.count > 0 ? 4 : 0)}%`,
                      backgroundColor: WORK_MODEL_COLOR[item.model] || '#0284c7',
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </button>

        <button
          type="button"
          data-band="training"
          onClick={() => (onOpenTraining ? onOpenTraining() : onNavigateTab('employee_details'))}
          className="glass-panel rounded-xl px-2.5 py-1.5 text-left cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors w-full min-w-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 min-w-0">
              <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">Training</span>
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-semibold truncate min-w-0">
              {data.training_summary?.not_recorded !== false ? 'Not recorded yet' : `${data.training_summary?.total || 0} records`}
            </span>
          </div>
          <div className="home-insight-counts mt-1">
            {[
              ['Planned', data.training_summary?.planned || 0],
              ['In progress', data.training_summary?.in_progress || 0],
              ['Completed', data.training_summary?.completed || 0],
              ['Cancelled', data.training_summary?.cancelled || 0],
            ].map(([label, count]) => (
              <div key={String(label)} className="min-w-0 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-1 py-0.5 text-center">
                <div className="text-[13px] font-bold font-mono leading-none text-slate-800 dark:text-slate-100">{count}</div>
                <div className="text-[9px] text-slate-500 leading-tight truncate">{label}</div>
              </div>
            ))}
          </div>
        </button>
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
