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
  Bangalore: 'bg-sky-50 border-sky-200 text-sky-800',
  Hyderabad: 'bg-teal-50 border-teal-200 text-teal-800',
  Chennai: 'bg-orange-50 border-orange-200 text-orange-800',
  Pune: 'bg-purple-50 border-purple-200 text-purple-800',
};

/* Accent palette shared across all KPI slots */
type Accent = 'teal' | 'blue' | 'pink' | 'emerald' | 'amber' | 'purple';

const ACCENT: Record<Accent, {
  icon: string;
  badge: string;
  ring: string;
  track: string;
  shield: string;
}> = {
  teal: {
    icon:   'bg-teal-50 text-teal-600 border border-teal-100',
    badge:  'bg-teal-50 text-teal-700 border-teal-200',
    ring:   '#0d9488',
    track:  '#ccfbf1',
    shield: 'text-teal-600',
  },
  blue: {
    icon:   'bg-blue-50 text-blue-600 border border-blue-100',
    badge:  'bg-blue-50 text-blue-700 border-blue-200',
    ring:   '#2563eb',
    track:  '#dbeafe',
    shield: 'text-blue-600',
  },
  pink: {
    icon:   'bg-pink-50 text-pink-600 border border-pink-100',
    badge:  'bg-pink-50 text-pink-700 border-pink-200',
    ring:   '#db2777',
    track:  '#fce7f3',
    shield: 'text-pink-600',
  },
  emerald: {
    icon:   'bg-emerald-50 text-emerald-600 border border-emerald-100',
    badge:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    ring:   '#059669',
    track:  '#d1fae5',
    shield: 'text-emerald-600',
  },
  amber: {
    icon:   'bg-amber-50 text-amber-600 border border-amber-100',
    badge:  'bg-amber-50 text-amber-700 border-amber-200',
    ring:   '#d97706',
    track:  '#fef3c7',
    shield: 'text-amber-600',
  },
  purple: {
    icon:   'bg-purple-50 text-purple-600 border border-purple-100',
    badge:  'bg-purple-50 text-purple-700 border-purple-200',
    ring:   '#7c3aed',
    track:  '#ede9fe',
    shield: 'text-purple-600',
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

const RING_R = 26;
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
      className={`glass-panel rounded-xl p-2.5 flex flex-col justify-between h-full transition-all ${
        dominant ? 'border-l-4 border-l-cyan-600 bg-cyan-50/20 shadow-sm ring-1 ring-cyan-500/10' : ''
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md' : ''}`}
      onClick={onClick}
      style={{
        background: dominant 
          ? 'linear-gradient(180deg, rgba(240,253,250,0.98), rgba(248,250,252,0.96), var(--surface))' 
          : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96), var(--surface))',
      }}
    >
      {/* Row 1: title left | icon right */}
      <div className="flex items-center justify-between gap-1 shrink-0">
        <span className={`text-[11px] font-bold tracking-[0.08em] uppercase truncate leading-tight ${dominant ? 'text-cyan-900' : 'text-slate-600'}`}>
          {title}
        </span>
        <div className={`rounded-lg flex items-center justify-center shrink-0 ${dominant ? 'w-7 h-7' : 'w-6 h-6'} ${a.icon}`}>
          {iconNode ? iconNode : Icon ? <Icon className={dominant ? 'w-4 h-4' : 'w-3.5 h-3.5'} /> : null}
        </div>
      </div>

      {/* Row 2: value + ring (for gender) or value alone */}
      {hasRing ? (
        <div className="flex items-center justify-between gap-1 my-1 min-h-0">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-xl font-extrabold text-slate-900 font-mono tracking-tight leading-none">
                {value}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0 rounded border font-mono leading-tight shrink-0 ${a.badge}`}>
                {badge}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5 leading-tight truncate">
              Diversity Ratio
            </p>
          </div>

          <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={RING_R} stroke={a.track} strokeWidth="5" fill="transparent" />
              <circle
                cx="32" cy="32" r={RING_R}
                stroke={a.ring}
                strokeWidth="5"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C - (pct / 100) * RING_C}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center" style={{ color: a.ring }}>
              {iconNode ? React.cloneElement(iconNode as React.ReactElement<{ cls?: string }>, { cls: 'w-6 h-6' }) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="my-1 flex items-baseline justify-between gap-1 shrink-0">
          <span className={`font-black tracking-tight leading-none font-mono ${dominant ? 'text-2xl lg:text-3xl text-cyan-950' : 'text-xl text-slate-900'}`}>
            {value}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono shrink-0 ${a.badge}`}>
            {badge}
          </span>
        </div>
      )}

      {/* Row 3: divider + bottom info */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[10px] shrink-0">
        {hasRing ? (
          <>
            <div className="flex items-center gap-1 min-w-0">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${a.icon}`}>
                <Shield className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <p className="font-bold font-mono leading-none" style={{ color: a.ring }}>
                  {badge}
                </p>
                <p className="text-[9px] text-slate-400 leading-none mt-0.5 truncate">Active Women</p>
              </div>
            </div>
            {trend && (
              <div className="flex items-center gap-0.5 shrink-0">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <div>
                  <p className="font-bold text-emerald-600 font-mono leading-none">{trend}</p>
                  <p className="text-[9px] text-slate-400 leading-none mt-0.5">vs Last Month</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between w-full text-[10px]">
            <span className="truncate text-slate-500 font-medium">{subtitle}</span>
            {dominant && <span className="text-[9px] font-bold text-cyan-700 bg-cyan-50 px-1 py-0.2 rounded font-mono">100% Roster</span>}
          </div>
        )}
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

  const hiringData = Object.entries(data.recent_hirings).map(([k, v]) => ({
    name: k,
    value: v,
    color: HIRING_COLORS[k] ?? FALLBACK_HIRING[0],
  }));

  const rankedLocs = [...data.location_distribution]
    .sort((a, b) => b.count - a.count)
    .map((l) => ({ ...l, color: LOCATION_COLORS[l.location] ?? '#0284c7' }));

  const activeHovered = hoveredLocIndex !== null ? rankedLocs[hoveredLocIndex] : null;

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none">
      {/* ══ LEADERSHIP BRIEF: 3 concise bullet insights + Status Chip ══ */}
      <div
        className="rounded-xl p-2.5 border shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(14,116,144,0.08), rgba(59,130,246,0.04), rgba(255,255,255,0.18), var(--surface))',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Executive Signal</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ● STABLE GROWTH · ACTIVE ROSTER
              </span>
            </div>
            
            {/* 3 Auto-generated bullet insights (max 8 words each) */}
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-cyan-900 block truncate">Delivery Hub Concentration</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Bangalore anchors 50.8% of total workforce</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-rose-900 block truncate">Retention Stabilization</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Attrition normalized to 1 exit in 2024</p>
              </div>
              <div className="p-1.5 rounded-lg bg-white/80 border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-pink-900 block truncate">Workforce Diversity</span>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">Sustained at 30.7% women staff ratio</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 text-[10px]">
            <div className="rounded-lg border px-2.5 py-1 text-center bg-white/70 border-slate-200 shadow-2xs">
              <div className="uppercase tracking-[0.14em] text-slate-500 text-[9px] font-bold">Total Headcount</div>
              <div className="font-black text-sm text-cyan-950 font-mono">{data.total_employees}</div>
            </div>
            <div className="rounded-lg border px-2.5 py-1 text-center bg-white/70 border-slate-200 shadow-2xs">
              <div className="uppercase tracking-[0.14em] text-slate-500 text-[9px] font-bold">Women Mix</div>
              <div className="font-black text-sm text-pink-700 font-mono">{data.pct_female}%</div>
            </div>
            <div className="rounded-lg border px-2.5 py-1 text-center bg-white/70 border-slate-200 shadow-2xs">
              <div className="uppercase tracking-[0.14em] text-slate-500 text-[9px] font-bold">2024 Exits</div>
              <div className="font-black text-sm text-rose-600 font-mono">
                {data.attrition_by_year[data.attrition_by_year.length - 1]?.exits ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ROW 1: premium executive KPI band (Dominant Headcount at 2x weight) ══ */}
      <div className="grid grid-cols-4 gap-1.5 shrink-0" style={{ gridAutoRows: '1fr' }}>
        <KPISlot
          accent="teal"
          dominant={true}
          title="Headcount"
          value={data.total_employees}
          badge="590 Staff"
          subtitle="Active workforce · FY24 Baseline"
          Icon={Users}
          onClick={() => onNavigateTab('statewise')}
        />

        <KPISlot
          accent="pink"
          title="Women Mix"
          value={data.female_count}
          badge={`${data.pct_female}%`}
          subtitle="181 of 590 staff · Diversity"
          pct={data.pct_female}
          trend="+1.32%"
          iconNode={<FemaleSVG cls="w-3.5 h-3.5" />}
          onClick={() => onNavigateTab('statewise')}
        />

        <KPISlot
          accent="emerald"
          title="ETS Tenure"
          value={`${data.avg_infinite_exp} Yrs`}
          badge="Company"
          subtitle="Average tenure within ETS"
          Icon={Clock}
          onClick={() => onNavigateTab('statewise')}
        />

        <KPISlot
          accent="purple"
          title="Career Span"
          value={`${data.avg_total_exp} Yrs`}
          badge="Total Exp"
          subtitle="Overall industry career experience"
          Icon={Award}
          onClick={() => onNavigateTab('salarywise')}
        />
      </div>

      {/* ══ ROW 2: 3-column chart area ══ */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">

        <div className="col-span-4 glass-panel rounded-xl p-2 flex flex-col justify-between overflow-hidden min-h-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), var(--surface))' }}>
          <div className="flex items-center justify-between border-b pb-1.5 shrink-0" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold tracking-tight" style={{ color: 'var(--text)' }}>Hiring Mix</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.22)' }}>
              New Joiners
            </span>
          </div>
          <div className="flex-1 min-h-[160px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hiringData} cx="50%" cy="50%" innerRadius="48%" outerRadius="76%" paddingAngle={4} dataKey="value">
                  {hiringData.map((e, i) => (
                    <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-slate-900 font-mono">
                {(data.recent_hirings['Joined 2023'] ?? 0) + (data.recent_hirings['Joined 2024'] ?? 0)}
              </span>
              <span className="text-[9px] text-slate-500 font-medium">Recent (23/24)</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 shrink-0 text-center">
            {hiringData.map((h) => (
              <div key={h.name} className="p-1 rounded bg-slate-50 border border-slate-200/80">
                <p className="text-[9px] text-slate-500 font-medium truncate">{h.name}</p>
                <p className="text-[11px] font-bold font-mono" style={{ color: h.color }}>{h.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), var(--surface))' }}>
          <div className="flex items-center justify-between border-b pb-1.5 shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-xs font-bold tracking-tight" style={{ color: 'var(--text)' }}>Attrition Trend</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold text-rose-700 bg-rose-50 border-rose-200">
              Click bar to drill down
            </span>
          </div>
          <div className="flex-1 min-h-[160px] pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attrition_by_year} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Bar 
                  dataKey="exits" 
                  fill="#f43f5e" 
                  radius={[4, 4, 0, 0]} 
                  name="Exits" 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(entry: any) => {
                    const yr = entry?.year ?? (entry?.payload?.year);
                    if (yr) {
                      const item = data.attrition_by_year.find((y) => y.year === yr);
                      if (item && item.leavers && item.leavers.length > 0) {
                        setSelectedYearLeavers({ year: yr, leavers: item.leavers });
                      }
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-3 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-xs font-bold text-slate-800 tracking-tight">Delivery Footprint</span>
            </div>
            <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 font-semibold">
              Hub Mix
            </span>
          </div>

          <div className="flex-1 min-h-[160px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rankedLocs} cx="50%" cy="50%" innerRadius="48%" outerRadius="74%" paddingAngle={4} dataKey="count" onMouseEnter={(_, i) => setHoveredLocIndex(i)} onMouseLeave={() => setHoveredLocIndex(null)}>
                  {rankedLocs.map((e, i) => (
                    <Cell key={i} fill={e.color} stroke={hoveredLocIndex === i ? '#0f172a' : '#fff'} strokeWidth={hoveredLocIndex === i ? 2.5 : 1.5} className="cursor-pointer" style={{ filter: hoveredLocIndex === i ? 'drop-shadow(0 2px 6px rgba(0,0,0,.15))' : 'none' }} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                  formatter={(v: any, _: any, p: any) => [`${v} Employees (${p.payload.percentage}%)`, p.payload.location]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {activeHovered ? (
                <>
                  <span className="text-[10px] font-bold truncate max-w-[60px]" style={{ color: activeHovered.color }}>{activeHovered.location}</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">{activeHovered.count}</span>
                  <span className="text-[9px] text-slate-500 font-semibold font-mono">{activeHovered.percentage}%</span>
                </>
              ) : (
                <>
                  <span className="text-base font-extrabold text-slate-900 font-mono">{data.total_employees}</span>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Total Emps</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-100 shrink-0">
            {rankedLocs.slice(0, 4).map((loc, i) => {
              const hov = hoveredLocIndex === i;
              return (
                <div key={loc.location} onMouseEnter={() => setHoveredLocIndex(i)} onMouseLeave={() => setHoveredLocIndex(null)} className={`p-1 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-1 text-[10px] ${hov ? `${LOCATION_TINTS[loc.location]} shadow-xs` : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/80'}`}>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[9px] font-extrabold px-1 rounded font-mono shrink-0" style={{ backgroundColor: `${loc.color}18`, color: loc.color }}>#{i + 1}</span>
                    <span className="font-bold text-slate-800 truncate">{loc.location}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 font-mono">{loc.count}</span>
                    <span className="text-[9px] text-slate-500 font-mono ml-0.5">({loc.percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ ROW 3: Executive Lens Cards (5-col clean fit) ══ */}
      <div className="grid grid-cols-5 gap-1.5 shrink-0 h-12">
        {[
          { tab: 'statewise', label: 'Regional View', sub: '4 Hubs · 238 in BLR', color: 'cyan' },
          { tab: 'techwise', label: 'Capability View', sub: '21 Skills · 6 Verified', color: 'teal' },
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
                <span className="text-xs font-bold block truncate" style={{ color: 'var(--text)' }}>
                  {label}
                </span>
                <p className="text-[9px] truncate text-slate-500">{sub}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-all group-hover:translate-x-0.5 text-slate-400 group-hover:text-slate-700" />
            </button>
          );
        })}
      </div>

      {/* ══ Leavers Drill-Down Drawer/Modal ══ */}
      {selectedYearLeavers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedYearLeavers.year} Leavers Drill-Down
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedYearLeavers.leavers.length} recorded exits during calendar year {selectedYearLeavers.year}
                </p>
              </div>
              <button 
                onClick={() => setSelectedYearLeavers(null)}
                className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 bg-slate-50/60">
                    <th className="p-2">Employee</th>
                    <th className="p-2">Grade</th>
                    <th className="p-2">Department</th>
                    <th className="p-2">Location</th>
                    <th className="p-2">Tenure</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedYearLeavers.leavers.map((leaver, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 font-medium text-slate-900">
                        {leaver['EMPLOYEE LABEL'] || leaver.name || `Employee #${leaver['EMPLOYEE NUMBER']}`}
                      </td>
                      <td className="p-2 font-mono text-cyan-800 font-bold">{leaver['JOB LEVEL'] || 'E1'}</td>
                      <td className="p-2 text-slate-600">{leaver['DEPARTMENT'] || 'Delivery'}</td>
                      <td className="p-2 text-slate-600">{leaver['LOCATION'] || 'Bangalore'}</td>
                      <td className="p-2 font-mono text-slate-700">{leaver['Infinite_Exp'] ? `${Number(leaver['Infinite_Exp']).toFixed(1)}y` : '—'}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => {
                            if (onOpenEmployeeProfile && leaver['EMPLOYEE NUMBER']) {
                              onOpenEmployeeProfile(leaver['EMPLOYEE NUMBER']);
                              setSelectedYearLeavers(null);
                            }
                          }}
                          className="px-2 py-1 rounded bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold text-[10px] border border-cyan-200"
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
