import React, { useState, useMemo } from 'react';
import type { HomeKPIs, EmployeeListItem, FilterParams } from '../../types/dashboard';
import {
  Users,
  Clock,
  Briefcase,
  Award,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Compass,
  Shield,
  Layers,
  BarChart3,
  Building2,
  Search,
  Filter,
  ExternalLink,
  LucideIcon,
  X,
} from 'lucide-react';
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
}

/* ─── Color tokens ────────────────────────────────────────────── */
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
      {/* Row 1: title left | icon right */}
      <div className="flex items-center justify-between gap-1 shrink-0">
        <span className={`text-[10px] font-bold tracking-[0.08em] uppercase truncate leading-tight ${dominant ? 'text-cyan-900 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-400'}`}>
          {title}
        </span>
        <div className={`rounded-md flex items-center justify-center shrink-0 ${dominant ? 'w-6 h-6' : 'w-5 h-5'} ${a.icon} group-hover:scale-110 transition-transform`}>
          {iconNode ? iconNode : Icon ? <Icon className={dominant ? 'w-3.5 h-3.5' : 'w-3 h-3'} /> : null}
        </div>
      </div>

      {/* Row 2: value + ring (for gender) or value + badge */}
      {hasRing ? (
        <div className="flex items-center justify-between gap-1 my-1 min-h-0">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight leading-none">
                {value}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono leading-tight shrink-0 ${a.badge}`}>
                {badge}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-tight truncate">
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
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono shrink-0 ${a.badge}`}>
            {badge}
          </span>
        </div>
      )}

      {/* Row 3: divider + bottom info */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[9px] shrink-0">
        <span className="truncate text-slate-500 dark:text-slate-400 font-medium">{subtitle}</span>
        {dominant && <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1.5 py-0.5 rounded font-mono shrink-0">100% Active</span>}
        {trend && <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">{trend}</span>}
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
  total_exp?: number;
  infinite_exp?: number;
  manager?: string;
  gender?: string;
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
}) => {
  const [hoveredLocIndex, setHoveredLocIndex] = useState<number | null>(null);
  const [hoveredGenderIndex, setHoveredGenderIndex] = useState<number | null>(null);
  const [activeDrilldown, setActiveDrilldown] = useState<ActiveDrilldown | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs min-h-[300px]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading ETS Executive Dashboard...</span>
        </div>
      </div>
    );
  }

  // Location Ranking
  const rankedLocs = [...data.location_distribution]
    .sort((a, b) => b.count - a.count)
    .map((l) => ({ ...l, color: LOCATION_COLORS[l.location] ?? '#0284c7' }));

  const activeHovered = hoveredLocIndex !== null ? rankedLocs[hoveredLocIndex] : null;

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

  // Gender data for center spotlight
  const genderDonutData = [
    { name: 'Female', value: data.female_count || 181, color: '#ec4899', percentage: data.pct_female },
    { name: 'Male', value: data.male_count || 409, color: '#0284c7', percentage: data.pct_male },
  ];

  const activeHoveredGender = hoveredGenderIndex !== null ? genderDonutData[hoveredGenderIndex] : null;

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

  const currentYearExits = data.attrition_by_year[data.attrition_by_year.length - 1]?.exits ?? 4;

  // Dynamic calculated metrics for growth summary cards
  const peakYear = growthHistory.reduce(
    (max, cur) => (cur.joiners > max.joiners ? cur : max),
    growthHistory[0] || { year: '2022', joiners: 240 }
  );
  const currentAttrRate = data.attrition_rate_current !== undefined ? data.attrition_rate_current : 0.7;
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

  // Convert employeeList to DrilldownItem format for lightning-fast drilldown modals
  const allDrilldownItems: DrilldownItem[] = (employeeList || []).map((e) => ({
    id: e['EMPLOYEE NUMBER'],
    name: e['EMPLOYEE LABEL'] || `Employee #${e['EMPLOYEE NUMBER']}`,
    job_level: e['JOB LEVEL'] || '—',
    job_title: e['JOB TITLE'] || 'Engineer',
    department: e['DEPARTMENT'] || 'Delivery',
    location: e['LOCATION'] || 'Bangalore',
    total_exp: e['Total_Exp'] !== undefined && e['Total_Exp'] !== null && e['Total_Exp'] !== ('' as any) ? Number(e['Total_Exp']) : undefined,
    infinite_exp: e['Infinite_Exp'] !== undefined && e['Infinite_Exp'] !== null && e['Infinite_Exp'] !== ('' as any) ? Number(e['Infinite_Exp']) : undefined,
    manager: e['MANAGER'],
    gender: e['GENDER'],
  }));

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

  return (
    <div className="flex-1 flex flex-col gap-2 select-none h-full min-h-0">
      
      {/* ══ ROW 1: 5-Card Executive KPI Band (Interactive Drilldowns) ══ */}
      <div className="grid grid-cols-5 gap-2 shrink-0">
        <KPISlot
          accent="cyan"
          dominant={true}
          title="Total Headcount"
          value={data.total_employees}
          badge="Enterprise"
          subtitle="Active ETS enterprise workforce"
          Icon={Users}
          onClick={() => {
            openDrilldown(
              'Enterprise Workforce Roster',
              `All ${data.total_employees} active staff members in current scope`,
              `${data.total_employees} Staff`,
              allDrilldownItems
            );
          }}
        />

        <KPISlot
          accent="emerald"
          title="Active & Retention"
          value={data.total_employees}
          badge={`${currentYearExits} Exits`}
          subtitle={`Low attrition · ${retentionRate}% Stability`}
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
              `${allLeavers.length || currentYearExits} recorded separations (${currentAttrRate}% current attrition)`,
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
          title="Workforce Stability"
          value={`${data.avg_infinite_exp} Yrs`}
          badge="Company"
          subtitle="Average tenure within ETS"
          Icon={Clock}
          onClick={() => {
            openDrilldown(
              'Workforce Tenure Overview',
              `Average company tenure is ${data.avg_infinite_exp} years across ${data.total_employees} active staff`,
              `Avg ${data.avg_infinite_exp}y`,
              allDrilldownItems
            );
          }}
        />

        <KPISlot
          accent="pink"
          title="Gender Diversity"
          value={`${data.pct_female}%`}
          badge={`${data.female_count} Women`}
          subtitle={`${data.female_count} Female · ${data.male_count} Male staff`}
          iconNode={<FemaleSVG cls="w-3.5 h-3.5" />}
          pct={data.pct_female}
          onClick={() => {
            const women = (employeeList || [])
              .filter((e) => (e as any).GENDER === 'Female' || (e as any).gender === 'Female')
              .map((e) => ({
                id: e['EMPLOYEE NUMBER'],
                name: e['EMPLOYEE LABEL'],
                job_level: e['JOB LEVEL'],
                job_title: e['JOB TITLE'],
                department: e['DEPARTMENT'],
                location: e['LOCATION'],
                total_exp: e['Total_Exp'],
              }));
            openDrilldown(
              'Female Workforce Representation',
              `${data.female_count} women professionals (${data.pct_female}% diversity ratio)`,
              `${data.female_count} Women`,
              women.length > 0 ? women : allDrilldownItems
            );
          }}
        />

        <KPISlot
          accent="purple"
          title="Career Span"
          value={`${data.avg_total_exp} Yrs`}
          badge="Total Exp"
          subtitle="Overall industry market depth"
          Icon={Award}
          onClick={() => onNavigateTab('salarywise')}
        />
      </div>

      {/* ══ ROW 2: WORKFORCE DYNAMICS & COMPOSITION (Growth + Diversity + Pyramid) ══ */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        
        {/* Module 1: Headcount & Hiring Growth (Combo Bar + Line) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Headcount & Hiring Growth
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Annual hiring volume & active workforce trajectory</p>
            </div>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
              2020 – 2024
            </span>
          </div>

          <div className="flex-1 min-h-[140px] pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={growthHistory}
                margin={{ top: 10, right: 0, left: -22, bottom: 0 }}
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
                <XAxis dataKey="year" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis yAxisId="left" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
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
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                <Bar yAxisId="left" dataKey="joiners" fill="#0284c7" name="Joiners" radius={[3, 3, 0, 0]} className="cursor-pointer" />
                <Line yAxisId="right" type="monotone" dataKey="headcount" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} name="Active Headcount" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Dynamic metric summary badges */}
          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
            <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block truncate">Peak Joiners</span>
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono">{peakYear.joiners} in {peakYear.year}</span>
            </div>
            <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block truncate">Current Scope</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">{data.total_employees} Active</span>
            </div>
            <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block truncate">Stability Index</span>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 font-mono">{retentionRate}% Retained</span>
            </div>
          </div>
        </div>

        {/* Module 2: Diversity % Spotlight (Big Donut on Left, Slim Legend on Right) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Diversity % Spotlight</span>
            </div>
            <span className="text-[10px] text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/60 px-1.5 py-0.5 rounded border border-pink-200 dark:border-pink-800 font-bold font-mono">
              {data.pct_female}% Women
            </span>
          </div>

          <div className="flex-1 grid grid-cols-12 gap-2 items-center min-h-0 py-1">
            {/* Left: Big Hero Donut (7 cols) */}
            <div className="col-span-7 h-full relative flex items-center justify-center min-h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="80%"
                    paddingAngle={3}
                    dataKey="value"
                    onMouseEnter={(_, i) => setHoveredGenderIndex(i)}
                    onMouseLeave={() => setHoveredGenderIndex(null)}
                    onClick={(e: any) => {
                      const genderName = e?.name || e?.payload?.name;
                      if (genderName) {
                        const items = (employeeList || [])
                          .filter((emp) => ((emp as any).GENDER === genderName || (emp as any).gender === genderName))
                          .map((emp) => ({
                            id: emp['EMPLOYEE NUMBER'],
                            name: emp['EMPLOYEE LABEL'],
                            job_level: emp['JOB LEVEL'],
                            job_title: emp['JOB TITLE'],
                            department: emp['DEPARTMENT'],
                            location: emp['LOCATION'],
                            total_exp: emp['Total_Exp'],
                            gender: emp['GENDER'],
                          }));
                        openDrilldown(
                          `${genderName} Workforce Representation`,
                          `${genderName === 'Female' ? data.female_count : data.male_count} ${genderName.toLowerCase()} employees (${genderName === 'Female' ? data.pct_female : data.pct_male}%)`,
                          `${genderName === 'Female' ? data.female_count : data.male_count} Staff`,
                          items.length > 0 ? items : allDrilldownItems
                        );
                      }
                    }}
                  >
                    {genderDonutData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={e.color}
                        stroke={hoveredGenderIndex === i ? 'var(--text)' : 'var(--surface)'}
                        strokeWidth={hoveredGenderIndex === i ? 2.5 : 1.5}
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
                    formatter={(v: any, _: any, p: any) => [`${v} Staff (${p.payload.percentage}%)`, p.payload.name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {activeHoveredGender ? (
                  <>
                    <span className="text-[10px] font-bold truncate max-w-[65px]" style={{ color: activeHoveredGender.color }}>
                      {activeHoveredGender.name}
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                      {activeHoveredGender.value}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono mt-0.5">
                      {activeHoveredGender.percentage}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono leading-none">
                      {data.total_employees}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      Total Staff
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Slim, High-Density Legend (5 cols) */}
            <div className="col-span-5 flex flex-col justify-center gap-2 h-full pl-1 border-l border-slate-100 dark:border-slate-800/80">
              {genderDonutData.map((g, i) => {
                const hov = hoveredGenderIndex === i;
                const isFemale = g.name === 'Female';
                return (
                  <div
                    key={g.name}
                    onMouseEnter={() => setHoveredGenderIndex(i)}
                    onMouseLeave={() => setHoveredGenderIndex(null)}
                    onClick={() => {
                      const items = (employeeList || [])
                        .filter((e) => (e as any).GENDER === g.name || (e as any).gender === g.name)
                        .map((e) => ({
                          id: e['EMPLOYEE NUMBER'],
                          name: e['EMPLOYEE LABEL'],
                          job_level: e['JOB LEVEL'],
                          job_title: e['JOB TITLE'],
                          department: e['DEPARTMENT'],
                          location: e['LOCATION'],
                          total_exp: e['Total_Exp'],
                          gender: e['GENDER'],
                        }));
                      openDrilldown(
                        `${g.name} Workforce Representation`,
                        `${g.value} ${g.name.toLowerCase()} employees (${g.percentage}%)`,
                        `${g.value} Staff`,
                        items.length > 0 ? items : allDrilldownItems
                      );
                    }}
                    className={`px-1.5 py-1.5 rounded-md transition-all cursor-pointer flex flex-col gap-1 ${
                      hov
                        ? isFemale
                          ? 'bg-pink-50 dark:bg-pink-950/40 shadow-2xs'
                          : 'bg-sky-50 dark:bg-sky-950/40 shadow-2xs'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                    title={`Click to view ${g.name} workforce roster`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                        <span className={`font-semibold truncate text-[11px] ${
                          hov
                            ? isFemale
                              ? 'text-pink-600 dark:text-pink-400 font-bold'
                              : 'text-sky-600 dark:text-sky-400 font-bold'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {g.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                        <b className="text-slate-800 dark:text-slate-100 font-bold">{g.value}</b> ({g.percentage}%)
                      </span>
                    </div>
                    {/* Slim progress bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, g.percentage)}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-footer insight */}
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Ratio Balance: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{(data.male_count / (data.female_count || 1)).toFixed(1)} : 1 (M:F)</strong></span>
            <span className="font-mono text-pink-600 dark:text-pink-400 font-bold">{data.pct_female}% Female</span>
          </div>
        </div>

        {/* Module 3: Job Level Hierarchy (Pyramid Representation with Drilldown) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Job Level Hierarchy
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Structural grade pyramid distribution</p>
            </div>
            <span className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-bold font-mono">
              E1 – E10
            </span>
          </div>

          {/* Stepped Tiered Pyramid with Interactive Click */}
          <div className="flex-1 flex flex-col justify-between py-1.5 min-h-0 gap-1.5">
            {pyramidTiers.map((tier: any, idx: number) => {
              const widths = ['w-[68%]', 'w-[80%]', 'w-[90%]', 'w-full'];
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
                  className={`${widths[idx]} mx-auto px-2.5 py-1 rounded-lg border flex items-center justify-between shadow-2xs transition-all cursor-pointer hover:scale-[1.02] hover:shadow-sm active:scale-[0.99] ${bgColors[idx]}`}
                  title={`Click to view roster for ${tier.tier}`}
                >
                  <div className="min-w-0 flex items-center gap-1.5 flex-1 pr-1">
                    <span className="text-[10px] font-bold truncate">{tier.tier}</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-white/70 dark:bg-slate-900/70 border border-black/10 dark:border-white/10 shrink-0">
                      {tier.grades?.join(', ') || ''}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-extrabold font-mono text-xs">{tier.count}</span>
                    <span className="text-[9px] font-mono opacity-75 ml-1">({tier.percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-1.5 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Organizational Structure:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{pyramidLabel}</span>
          </div>
        </div>
      </div>

      {/* ══ ROW 3: STABILITY, FOOTPRINT & DEPARTMENTS (Interactive Slicers) ══ */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        
        {/* Module 4: Stability & Tenure Bands (Clickable Horizontal Bars) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Workforce Stability & Tenure</span>
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
                      undefined,
                      undefined,
                      false,
                      true
                    );
                  }}
                  className="flex flex-col gap-0.5 cursor-pointer group p-0.5 rounded hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  title={`Click to view ${bandItems.length} employees in ${band.band} tenure band`}
                >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
                    {band.band}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[9px]">
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

          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>{stabilityFooterText}</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold">
              {data.avg_infinite_exp >= 2.5 ? 'High Stability' : 'Active Ramp-up'}
            </span>
          </div>
        </div>

        {/* Module 5: Regional Delivery Footprint Hubs (Big Donut on Left, Slim Legend on Right) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Delivery Footprint</span>
            </div>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
              4 Regional Hubs
            </span>
          </div>

          <div className="flex-1 grid grid-cols-12 gap-2 items-center min-h-0 py-1">
            {/* Left: Big Hero Donut (7 cols) */}
            <div className="col-span-7 h-full relative flex items-center justify-center min-h-[140px]">
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
                      if (locName) {
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
                      }
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
                      {data.total_employees}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      Total Staff
                    </span>
                  </>
                )}
              </div>
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
                    onClick={() => {
                      const items = allDrilldownItems.filter(
                        (item) => item.location.toLowerCase() === loc.location.toLowerCase()
                      );
                      const locData = rankedLocs.find((l) => l.location.toLowerCase() === loc.location.toLowerCase());
                      openDrilldown(
                        `${loc.location} Delivery Hub`,
                        `${locData?.count || items.length} team members stationed in ${loc.location} (${locData?.percentage || 0}% of workforce)`,
                        `${locData?.count || items.length} Staff`,
                        items,
                        'location',
                        [loc.location]
                      );
                    }}
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
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Primary Hub: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{rankedLocs[0]?.location || 'N/A'}</strong></span>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{rankedLocs[0]?.percentage || 0}% load</span>
          </div>
        </div>

        {/* Module 6: Department Allocation (Clickable Functional Units) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Department Allocation</span>
            </div>
            <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-semibold font-mono">
              {deptList.length} Units
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-around py-1.5 min-h-0">
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
                className="flex flex-col gap-0.5 cursor-pointer group p-0.5 rounded hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                title={`Click to view team members in ${d.department}`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                    {d.department}
                  </span>
                  <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
                    <b className="text-slate-900 dark:text-slate-100">{d.count}</b> ({d.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 dark:bg-blue-400 h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                    style={{ width: `${Math.max(4, d.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Primary Focus:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{top2Names} ({top2Pct.toFixed(1)}%)</span>
          </div>
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
                placeholder="Search by name, ID, grade, department, or location..."
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
                    item.location.toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No matching records found in this segment.
                    </div>
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
