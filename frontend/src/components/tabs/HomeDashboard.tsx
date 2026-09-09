import React, { useState } from 'react';
import type { HomeKPIs } from '../../types/dashboard';
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
  LucideIcon,
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

interface HomeDashboardProps {
  data: HomeKPIs | null;
  loading: boolean;
  onNavigateTab: (tab: string) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

/* ─── Color tokens ────────────────────────────────────────────── */
const HIRING_COLORS: Record<string, string> = {
  'Joined 2024': '#10b981',
  'Joined 2023': '#0284c7',
  'Joined Earlier': '#f59e0b',
};
const FALLBACK_HIRING = ['#10b981', '#0284c7', '#f59e0b'];

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

/* Accent palette shared across all KPI slots */
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
      className={`glass-panel rounded-xl p-2 flex flex-col justify-between h-full transition-all ${
        dominant ? 'border-l-4 border-l-cyan-600 shadow-sm ring-1 ring-cyan-500/20' : ''
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md' : ''}`}
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
        <div className={`rounded-md flex items-center justify-center shrink-0 ${dominant ? 'w-6 h-6' : 'w-5 h-5'} ${a.icon}`}>
          {iconNode ? iconNode : Icon ? <Icon className={dominant ? 'w-3.5 h-3.5' : 'w-3 h-3'} /> : null}
        </div>
      </div>

      {/* Row 2: value + ring (for gender) or value + badge */}
      {hasRing ? (
        <div className="flex items-center justify-between gap-1 my-0.5 min-h-0">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight leading-none">
                {value}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0 rounded border font-mono leading-tight shrink-0 ${a.badge}`}>
                {badge}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-tight truncate">
              Diversity Ratio
            </p>
          </div>

          <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
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
        <div className="my-0.5 flex items-baseline justify-between gap-1 shrink-0">
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

/* ─── Main Dashboard ──────────────────────────────────────────── */
export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  data,
  loading,
  onNavigateTab,
  onOpenEmployeeProfile,
}) => {
  const [hoveredLocIndex, setHoveredLocIndex] = useState<number | null>(null);
  const [selectedLens, setSelectedLens] = useState<'regional' | 'capability' | 'compensation' | 'attendance'>('regional');
  const [selectedYearLeavers, setSelectedYearLeavers] = useState<{ year: string; leavers: any[] } | null>(null);

  const lenses = [
    { id: 'regional', label: 'Regional view', description: 'Delivery footprint', action: () => onNavigateTab('statewise') },
    { id: 'capability', label: 'Capability view', description: 'Skill depth', action: () => onNavigateTab('techwise') },
    { id: 'compensation', label: 'Compensation view', description: 'Pay structure', action: () => onNavigateTab('salarywise') },
    { id: 'attendance', label: 'Health view', description: 'Leave & attendance', action: () => onNavigateTab('calendar') },
  ] as const;

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
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
    { name: 'Male', value: data.male_count || 409, color: '#0284c7' },
    { name: 'Female', value: data.female_count || 181, color: '#ec4899' },
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

  const currentYearExits = data.attrition_by_year[data.attrition_by_year.length - 1]?.exits ?? 4;

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      
      {/* ══ ROW 1: 5-Card Executive KPI Band (Inspired by Reference Top Bar) ══ */}
      <div className="grid grid-cols-5 gap-1.5 shrink-0" style={{ gridAutoRows: '1fr' }}>
        <KPISlot
          accent="cyan"
          dominant={true}
          title="Total Headcount"
          value={data.total_employees}
          badge="Enterprise"
          subtitle="Active ETS enterprise workforce"
          Icon={Users}
          onClick={() => onNavigateTab('statewise')}
        />

        <KPISlot
          accent="emerald"
          title="Active & Retention"
          value={data.total_employees}
          badge={`${currentYearExits} Exits`}
          subtitle="Low attrition · 99.3% Stability"
          Icon={Shield}
          onClick={() => onNavigateTab('statewise')}
        />

        <KPISlot
          accent="teal"
          title="Workforce Stability"
          value={`${data.avg_infinite_exp} Yrs`}
          badge="Company"
          subtitle="Average tenure within ETS"
          Icon={Clock}
          onClick={() => onNavigateTab('statewise')}
        />

        <KPISlot
          accent="pink"
          title="Gender Diversity"
          value={`${data.pct_female}%`}
          badge={`${data.female_count} Women`}
          subtitle={`${data.female_count} Female · ${data.male_count} Male staff`}
          iconNode={<FemaleSVG cls="w-3.5 h-3.5" />}
          pct={data.pct_female}
          onClick={() => onNavigateTab('statewise')}
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
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        
        {/* Module 1: Headcount & Hiring Growth (Combo Bar + Line) */}
        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
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
              <ComposedChart data={growthHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Bar yAxisId="left" dataKey="joiners" fill="#0284c7" name="Joiners" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="headcount" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} name="Active Headcount" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Quick metric summary badges */}
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
            <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Peak Joiners</span>
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 font-mono">240 in 2022</span>
            </div>
            <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Baseline Roster</span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">590 Active</span>
            </div>
            <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">2024 Stability</span>
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 font-mono">99.3% Retained</span>
            </div>
          </div>
        </div>

        {/* Module 2: Diversity % Spotlight (Donut + Gender Avatars) */}
        <div className="col-span-3 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
              Diversity % Spotlight
            </span>
            <span className="text-[10px] text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/60 px-1.5 py-0.5 rounded border border-pink-200 dark:border-pink-800 font-bold font-mono">
              {data.pct_female}% Women
            </span>
          </div>

          <div className="flex-1 min-h-[120px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="46%"
                  outerRadius="68%"
                  paddingAngle={4}
                  dataKey="value"
                >
                  {genderDonutData.map((e, i) => (
                    <Cell key={i} fill={e.color} stroke="var(--surface)" strokeWidth={2} />
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
                  formatter={(v: any, name: any) => [`${v} Employees (${name === 'Female' ? data.pct_female : data.pct_male}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                {data.total_employees}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                Total Staff
              </span>
            </div>
          </div>

          {/* Gender breakdown footer cards */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <div className="p-1 rounded-lg bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <div className="w-4 h-4 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <MaleSVG cls="w-2.5 h-2.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-sky-900 dark:text-sky-200 block leading-tight truncate">Male</span>
                  <span className="text-[9px] text-sky-600 dark:text-sky-400 font-mono leading-none">{data.pct_male}%</span>
                </div>
              </div>
              <span className="text-xs font-black text-sky-950 dark:text-sky-100 font-mono shrink-0 pl-1">{data.male_count}</span>
            </div>

            <div className="p-1 rounded-lg bg-pink-50/70 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800 flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <div className="w-4 h-4 rounded bg-pink-500/20 text-pink-600 dark:text-pink-300 flex items-center justify-center shrink-0">
                  <FemaleSVG cls="w-2.5 h-2.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-pink-900 dark:text-pink-200 block leading-tight truncate">Female</span>
                  <span className="text-[9px] text-pink-600 dark:text-pink-400 font-mono leading-none">{data.pct_female}%</span>
                </div>
              </div>
              <span className="text-xs font-black text-pink-950 dark:text-pink-100 font-mono shrink-0 pl-1">{data.female_count}</span>
            </div>
          </div>
        </div>

        {/* Module 3: Job Level Hierarchy (Pyramid Representation) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
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

          {/* Stepped Tiered Pyramid */}
          <div className="flex-1 flex flex-col justify-center gap-1.5 py-1 min-h-0">
            {pyramidTiers.map((tier: any, idx: number) => {
              const widths = ['w-[68%]', 'w-[80%]', 'w-[90%]', 'w-full'];
              const bgColors = [
                'bg-purple-50/80 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200',
                'bg-cyan-50/80 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200',
                'bg-teal-50/80 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200',
                'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
              ];

              return (
                <div
                  key={tier.tier}
                  className={`${widths[idx]} mx-auto px-2 py-1 rounded-lg border flex items-center justify-between shadow-2xs transition-all hover:scale-[1.01] ${bgColors[idx]}`}
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

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Organizational Balance:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Healthy Broad-Base Pyramid</span>
          </div>
        </div>
      </div>

      {/* ══ ROW 3: STABILITY, FOOTPRINT & DEPARTMENTS (Inspired by Reference Bottom Row) ══ */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        
        {/* Module 4: Stability & Tenure Bands (Horizontal Bars) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Workforce Stability & Tenure</span>
            </div>
            <span className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 font-mono font-bold">
              Avg {data.avg_infinite_exp} Yrs
            </span>
          </div>

          {/* Horizontal Progress Bars */}
          <div className="flex-1 flex flex-col justify-around py-1 min-h-0">
            {stabilityBands.map((band: any) => (
              <div key={band.band} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{band.band}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[9px]">
                    <b className="text-slate-800 dark:text-slate-200 font-bold">{band.count}</b> ({band.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, band.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>67.8% in 1–3 Yr Core Delivery Band</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold">High Stability</span>
          </div>
        </div>

        {/* Module 5: Regional Delivery Footprint Hubs */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Delivery Footprint</span>
            </div>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
              4 Regional Hubs
            </span>
          </div>

          <div className="flex-1 min-h-[120px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rankedLocs}
                  cx="50%"
                  cy="50%"
                  innerRadius="46%"
                  outerRadius="72%"
                  paddingAngle={4}
                  dataKey="count"
                  onMouseEnter={(_, i) => setHoveredLocIndex(i)}
                  onMouseLeave={() => setHoveredLocIndex(null)}
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
                  <span className="text-[10px] font-bold truncate max-w-[60px]" style={{ color: activeHovered.color }}>
                    {activeHovered.location}
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                    {activeHovered.count}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold font-mono">
                    {activeHovered.percentage}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                    {data.total_employees}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    Total Staff
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
            {rankedLocs.slice(0, 4).map((loc, i) => {
              const hov = hoveredLocIndex === i;
              return (
                <div
                  key={loc.location}
                  onMouseEnter={() => setHoveredLocIndex(i)}
                  onMouseLeave={() => setHoveredLocIndex(null)}
                  className={`p-1 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-1 text-[10px] ${
                    hov
                      ? `${LOCATION_TINTS[loc.location]} shadow-xs`
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="text-[9px] font-extrabold px-1 rounded font-mono shrink-0"
                      style={{ backgroundColor: `${loc.color}18`, color: loc.color }}
                    >
                      #{i + 1}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{loc.location}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{loc.count}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono ml-0.5">({loc.percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Module 6: Department Distribution (Functional Breakdown) */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight">Department Allocation</span>
            </div>
            <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-semibold font-mono">
              6 Units
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-around py-1 min-h-0">
            {deptList.map((d: any) => (
              <div key={d.department} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{d.department}</span>
                  <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
                    <b className="text-slate-900 dark:text-slate-100">{d.count}</b> ({d.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 dark:bg-blue-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, d.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>Primary Focus:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">IT & Core Delivery (90.8%)</span>
          </div>
        </div>
      </div>

      {/* ══ ROW 4: Executive Lens Navigation Dock (5 Cards) ══ */}
      <div className="grid grid-cols-5 gap-1.5 shrink-0 h-12">
        {[
          { tab: 'statewise', label: 'Regional View', sub: '4 Hubs · 238 in BLR', color: 'cyan' },
          { tab: 'techwise', label: 'Capability View', sub: '21 Skills · 5 Verified', color: 'teal' },
          { tab: 'salarywise', label: 'Compensation View', sub: '₹45.8Cr · 54 Managers', color: 'amber' },
          { tab: 'salarywise2', label: 'Trend View', sub: '5-Year CTC Evolution', color: 'emerald' },
          { tab: 'calendar', label: 'Attendance View', sub: '13.2% Leave Rate', color: 'purple' },
        ].map(({ tab, label, sub, color }) => {
          const borderColorMap: Record<string, string> = {
            cyan: '#67e8f9',
            teal: '#2dd4bf',
            amber: '#fbbf24',
            emerald: '#34d399',
            purple: '#c4b5fd',
          };
          const textColorMap: Record<string, string> = {
            cyan: '#0891b2',
            teal: '#0f766e',
            amber: '#b45309',
            emerald: '#047857',
            purple: '#6d28d9',
          };

          return (
            <button
              key={tab}
              onClick={() => onNavigateTab(tab)}
              className="glass-card rounded-xl p-2 flex items-center justify-between text-left transition-all group hover:scale-[1.01]"
              style={{ borderColor: borderColorMap[color] }}
            >
              <div className="min-w-0 pr-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] block leading-tight" style={{ color: textColorMap[color] }}>
                  Executive Lens
                </span>
                <span className="text-xs font-bold block truncate text-slate-800 dark:text-slate-100">
                  {label}
                </span>
                <p className="text-[9px] truncate text-slate-500 dark:text-slate-400">{sub}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-all group-hover:translate-x-0.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
            </button>
          );
        })}
      </div>

      {/* ══ Leavers Drill-Down Drawer/Modal ══ */}
      {selectedYearLeavers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0e1b2d] rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 dark:border-[#2b3d52] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#2b3d52] flex items-center justify-between bg-slate-50 dark:bg-[#12223a]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedYearLeavers.year} Leavers Drill-Down
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedYearLeavers.leavers.length} recorded exits during calendar year {selectedYearLeavers.year}
                </p>
              </div>
              <button 
                onClick={() => setSelectedYearLeavers(null)}
                className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2b3d52] text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-[#162a45]">
                    <th className="p-2">Employee</th>
                    <th className="p-2">Grade</th>
                    <th className="p-2">Department</th>
                    <th className="p-2">Location</th>
                    <th className="p-2">Tenure</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedYearLeavers.leavers.map((leaver, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#132238] transition-colors">
                      <td className="p-2 font-medium text-slate-900 dark:text-slate-100">
                        {leaver['EMPLOYEE LABEL'] || leaver.name || `Employee #${leaver['EMPLOYEE NUMBER']}`}
                      </td>
                      <td className="p-2 font-mono text-cyan-800 dark:text-cyan-300 font-bold">{leaver['JOB LEVEL'] || 'E1'}</td>
                      <td className="p-2 text-slate-600 dark:text-slate-300">{leaver['DEPARTMENT'] || 'Delivery'}</td>
                      <td className="p-2 text-slate-600 dark:text-slate-300">{leaver['LOCATION'] || 'Bangalore'}</td>
                      <td className="p-2 font-mono text-slate-700 dark:text-slate-300">{leaver['Infinite_Exp'] ? `${Number(leaver['Infinite_Exp']).toFixed(1)}y` : '—'}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => {
                            if (onOpenEmployeeProfile && leaver['EMPLOYEE NUMBER']) {
                              onOpenEmployeeProfile(leaver['EMPLOYEE NUMBER']);
                              setSelectedYearLeavers(null);
                            }
                          }}
                          className="px-2 py-1 rounded bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 font-bold text-[10px] border border-cyan-200 dark:border-cyan-800/60"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedYearLeavers(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
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
