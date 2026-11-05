import React, { useMemo } from 'react';
import type {
  AIAttentionCard,
  AIFunnelStage,
  AIHealthBand,
  AIHealthRow,
  AIQuadrantRow,
  AIUtilizationKPIs,
} from '../../types/dashboard';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
import { AIUtilizationPage2 } from './AIUtilizationPage2';
import { AIUtilizationPage3 } from './AIUtilizationPage3';
import {
  AlertTriangle,
  ArrowUpDown,
  CircleDollarSign,
  Clock3,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AIUtilizationDashboardProps {
  data: AIUtilizationKPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
  /** Global FilterBar slice — used to prune stale Page 2/3 drill when Project changes. */
  filters?: { project?: string | string[]; release?: string | string[] };
}

const BAND_TILE: Record<string, string> = {
  green: 'ai-band-green',
  amber: 'ai-band-amber',
  red: 'ai-band-red',
  info: 'ai-band-info',
  neutral: 'ai-band-neutral',
};

const BAND_KPI: Record<string, string> = {
  green: 'border-t-emerald-700 dark:border-t-emerald-400',
  amber: 'border-t-amber-700 dark:border-t-amber-400',
  red: 'border-t-rose-700 dark:border-t-rose-400',
  info: 'border-t-sky-600 dark:border-t-sky-400',
  neutral: 'border-t-slate-400 dark:border-t-slate-500',
};

function bandOf(value: string | undefined | null): AIHealthBand | 'info' {
  const key = String(value || 'neutral').toLowerCase();
  if (key === 'green' || key === 'amber' || key === 'red' || key === 'info') return key;
  return 'neutral';
}

function money(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function fmt(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
}

function pct(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(digits)}%`;
}

function BandIcon({ band, className = 'w-3 h-3' }: { band: string; className?: string }) {
  const tone = bandOf(band);
  if (tone === 'green') return <TrendingUp className={className} aria-hidden />;
  if (tone === 'red') return <TrendingDown className={className} aria-hidden />;
  return <Minus className={`${className} ${tone === 'neutral' ? 'opacity-50' : ''}`} aria-hidden />;
}

function Sparkline({ series }: { series: AIHealthRow['release_series'] }) {
  const points = [...series].sort((a, b) => a.sequence - b.sequence).slice(-4);
  const values = points.map((row) => row.adoption_pct).filter((value): value is number => value != null);
  if (values.length < 2) return <span className="text-[9px] font-mono opacity-70">no trend</span>;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const width = 52;
  const height = 14;
  const coords = points.map((row, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (((row.adoption_pct ?? min) - min) / (max - min || 1)) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ai-spark" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" points={coords.join(' ')} />
    </svg>
  );
}

function varianceLine(actual: number | null | undefined, target: number | null | undefined, kind: 'pct' | 'num' | 'money', forecast?: number | null) {
  if (actual == null || target == null) {
    return forecast == null ? 'tgt —' : `fc ${kind === 'money' ? money(forecast) : kind === 'pct' ? pct(forecast, 0) : fmt(forecast, 1)}`;
  }
  const delta = actual - target;
  const sign = delta > 0 ? '+' : '';
  const base = kind === 'pct'
    ? `tgt ${fmt(target, 0)}% · ${sign}${fmt(delta, 1)} pts`
    : kind === 'money'
      ? `tgt ${money(target)} · ${sign}${money(delta)}`
      : `tgt ${fmt(target, 1)} · ${sign}${fmt(delta, 1)}`;
  if (forecast == null) return base;
  const fc = kind === 'money' ? money(forecast) : kind === 'pct' ? pct(forecast, 0) : fmt(forecast, 1);
  return `${base} · fc ${fc}`;
}

/** Map legacy recommendation labels to the single executive badge vocabulary. */
function normalizeRec(raw: string | null | undefined): string {
  const text = String(raw || '').trim();
  const key = text.toLowerCase();
  if (!key) return 'Monitor';
  if (key.includes('executive')) return 'Executive Review';
  if (key.includes('drive adopt')) return 'Drive Adoption';
  if (key.includes('scale')) return 'Scale Best Practices';
  if (key.includes('improve qa') || key.includes('qa')) return 'Improve QA';
  if (key.includes('optimize') || key.includes('monitor')) return 'Monitor';
  return text;
}

function trendArrow(delta: number | null | undefined, higherIsBetter = true): 'up' | 'down' | 'flat' {
  if (delta == null || Number.isNaN(delta)) return 'flat';
  if (Math.abs(delta) < 0.5) return 'flat';
  const up = delta > 0;
  if (higherIsBetter) return up ? 'up' : 'down';
  return up ? 'down' : 'up';
}

/** Executive-readable trend chips: ▲ Improving / ▼ Declining / ▬ Stable (+ short why). */
function execTrendChip(
  delta: number | null | undefined,
  opts?: { higherIsBetter?: boolean; vsTargetGap?: number | null; gained?: string; suffix?: string },
): string {
  const hib = opts?.higherIsBetter !== false;
  if (opts?.vsTargetGap != null && opts.vsTargetGap < -0.5) {
    return `▼ vs target`;
  }
  const dir = trendArrow(delta, hib);
  if (dir === 'flat') return '▬ Stable';
  if (dir === 'up') {
    if (opts?.gained) return `▲ ${opts.gained}`;
    return '▲ Improving';
  }
  return '▼ Declining';
}

/** Deterministic health recommendation when API omits it (backward compatible). */
function healthRecommendation(row: AIHealthRow, riskCount = 0): string {
  if (row.recommendation) return normalizeRec(row.recommendation);
  const score = row.health_score;
  const adopt = row.adoption_pct;
  const potential = row.potential_value_usd ?? 0;
  const value = row.value_usd ?? 0;
  const qaRisk = (row.badges ?? []).some((b) => /QA/i.test(b));
  if (score != null && score < 70) return 'Executive Review';
  if (riskCount >= 3 && (score == null || score < 80)) return 'Executive Review';
  if (qaRisk && (score == null || (score >= 70 && score < 80)) && (adopt == null || adopt >= 60)) return 'Improve QA';
  const highA = adopt != null && adopt >= 80;
  const highV = potential > 0 && value >= potential * 0.5;
  if (highA && !highV) return 'Monitor';
  if (!highA && highV) return 'Drive Adoption';
  if (score != null && score >= 80) return 'Scale Best Practices';
  if (adopt != null && adopt < 60) return 'Drive Adoption';
  if (qaRisk) return 'Improve QA';
  return 'Monitor';
}

function buildPortfolioNarrative(
  summary: AIUtilizationKPIs['summary'],
  health: AIHealthRow[],
  attention: AIAttentionCard[],
  quadrant: AIQuadrantRow[],
): string[] {
  if (summary.portfolio_narrative?.length) return summary.portfolio_narrative.slice(0, 5);
  const bullets: string[] = [];
  const adopt = summary.adoption_evidence_pct;
  const tAdopt = summary.targets?.Adoption_Pct ?? 80;
  if (adopt != null) {
    const gap = adopt - (tAdopt ?? 80);
    bullets.push(`Situation: Portfolio adoption is ${adopt.toFixed(1)}% (${gap >= 0 ? 'on target' : `${Math.abs(gap).toFixed(1)} pts below target`}).`);
  } else {
    bullets.push('Situation: Portfolio AI adoption is not yet quantified for this release.');
  }
  const missed = summary.unrealized_value_usd;
  const potential = summary.potential_value_usd;
  const actual = summary.business_value_usd ?? summary.est_cost_savings_usd;
  const recovery = summary.recovery_potential_usd ?? missed;
  if (missed != null && potential) {
    const pctMiss = (missed / potential) * 100;
    bullets.push(`Opportunity: Recover ${money(recovery)} (${pctMiss.toFixed(0)}% of ${money(potential)} potential); realized ${money(actual)}.`);
  } else {
    bullets.push(`Opportunity: Business value generated ${money(actual)} this period.`);
  }
  const need = summary.projects_requiring_attention ?? 0;
  const redN = attention.filter((c) => c.severity === 'red').length;
  const riskBit = attention.length || need
    ? `${need} critical project(s) · ${attention.length} issue(s) (${redN} P1)${missed ? ` · ${money(missed)} value at risk` : ''}`
    : 'no leadership exceptions';
  bullets.push(`Risk: ${riskBit}.`);
  const worst = [...health].sort((a, b) => (a.health_score ?? 999) - (b.health_score ?? 999))[0];
  const leaders = quadrant.filter((q) => q.quadrant === 'Strategic Leaders');
  const turnaround = quadrant.filter((q) => q.quadrant === 'Turnaround Required' || q.quadrant === 'Executive Attention');
  if (worst) {
    bullets.push(`Priority: ${worst.project} — ${healthRecommendation(worst, worst.risk_count ?? 0)}; owner ${worst.manager || 'SDM'}.`);
  } else {
    bullets.push('Priority: No project health score available yet.');
  }
  if (turnaround.length) {
    bullets.push(`Executive Action: Schedule review for ${turnaround.slice(0, 3).map((q) => q.project).join(', ')}; recover value on lowest-health projects.`);
  } else if (leaders.length) {
    bullets.push(`Executive Action: Scale Best Practices from ${leaders.slice(0, 3).map((q) => q.project).join(', ')}.`);
  } else {
    bullets.push('Executive Action: Hold portfolio AI standup on unrealized value and QA gaps.');
  }
  return bullets.slice(0, 5);
}

function quadrantLabel(name: string | undefined | null): string {
  const raw = String(name || '');
  if (raw === 'Hidden Gems' || raw === 'Scaling Candidates') return 'Growth Candidates';
  if (raw === 'Optimization Required' || raw === 'Optimization Needed') return 'Execution Risk';
  if (raw === 'Immediate Attention' || raw === 'Executive Attention') return 'Turnaround Required';
  return raw || '—';
}

/** Short chip label for single-line Portfolio quadrant header */
function quadrantChipLabel(name: string | undefined | null): string {
  const full = quadrantLabel(name);
  if (full === 'Strategic Leaders') return 'Leaders';
  if (full === 'Growth Candidates') return 'Growth';
  if (full === 'Execution Risk') return 'Risk';
  if (full === 'Turnaround Required') return 'Turnaround';
  return full;
}

/** CSS tone class — matches scatter Cell fills (leaders cyan, growth green, risk amber, turnaround red). */
function quadrantChipTone(name: string | undefined | null): string {
  const full = quadrantLabel(name);
  if (full === 'Strategic Leaders') return 'ai-quad-tone-leaders';
  if (full === 'Growth Candidates') return 'ai-quad-tone-growth';
  if (full === 'Execution Risk') return 'ai-quad-tone-risk';
  if (full === 'Turnaround Required') return 'ai-quad-tone-turnaround';
  return 'ai-quad-tone-neutral';
}

/** Scatter / chip solid — same palette as .ai-quad-tone-* and health rank bars. */
function quadrantDotFill(name: string | undefined | null): string {
  const full = quadrantLabel(name);
  if (full === 'Strategic Leaders') return '#0284c7';
  if (full === 'Growth Candidates') return '#047857';
  if (full === 'Execution Risk') return '#b45309';
  if (full === 'Turnaround Required') return '#be123c';
  return '#0284c7';
}

function trendBadge(pts: number | null | undefined): { arrow: string; label: string; tone: string } | null {
  if (pts == null) return null;
  if (Math.abs(pts) < 0.5) return { arrow: '▬', label: 'Stable', tone: 'neutral' };
  if (pts > 0) return { arrow: '▲', label: `${fmt(pts, 0)} pts`, tone: 'green' };
  return { arrow: '▼', label: `${fmt(Math.abs(pts), 0)} pts`, tone: 'red' };
}

const ATTN_ACTION: Record<string, string> = {
  'ATT-1': 'Drive Adoption',
  'ATT-2': 'Convert tokens to savings',
  'ATT-3': 'Improve QA',
  'ATT-4': 'Arrest adoption decline',
  'ATT-5': 'Quantify activity hours',
  'ATT-6': 'Reclaim unused seats',
  'ATT-7': 'Improve QA',
  'ATT-8': 'Start AI documentation',
  'ATT-9': 'Cover uncovered releases',
};

function QuadDot(props: {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: { project?: string };
  onDrill?: (project: string) => void;
}) {
  const { cx, cy, fill, payload, onDrill } = props;
  if (cx == null || cy == null) return null;
  const project = payload?.project;
  return (
    <g
      className="ai-quad-dot"
      role={project ? 'button' : undefined}
      tabIndex={project ? 0 : undefined}
      aria-label={project ? `Open ${project}` : undefined}
      onClick={(event) => {
        if (!project || !onDrill) return;
        event.stopPropagation();
        onDrill(project);
      }}
      onKeyDown={(event) => {
        if (!project || !onDrill) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDrill(project);
        }
      }}
    >
      <circle cx={cx} cy={cy} r={9} fill={fill || '#0284c7'} stroke="var(--surface)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill={fill || '#0284c7'} opacity={0.35} />
    </g>
  );
}

/** Center project name above the bubble — bypasses Recharts Text width clamp that skews longer labels (e.g. Maven). */
function QuadScatterLabel(props: {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  x?: number;
  y?: number;
  width?: number;
  value?: string | number;
}) {
  const { value, viewBox } = props;
  if (value == null || value === '') return null;
  const baseX = viewBox?.x ?? props.x;
  const baseY = viewBox?.y ?? props.y;
  const w = viewBox?.width ?? props.width ?? 0;
  if (baseX == null || baseY == null) return null;
  // Scatter viewBox x/y is the symbol top-left; center on the point (same as bubble cx).
  const cx = baseX + w / 2;
  return (
    <text
      x={cx}
      y={baseY - 10}
      textAnchor="middle"
      dominantBaseline="auto"
      className="ai-quad-label"
      style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text)' }}
    >
      {String(value)}
    </text>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  band,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  trend: string;
  band: string;
  icon: React.ReactNode;
}) {
  const tone = bandOf(band);
  return (
    <div className={`ai-kpi-card glass-panel rounded-xl text-left min-w-0 h-full border-t-2 ${BAND_KPI[tone] || BAND_KPI.neutral}`}>
      <span className="ai-kpi-line1">
        <span className="ai-kpi-head">
          {icon}
          <span className="ai-kpi-label truncate">{label}</span>
        </span>
        <span className={`ai-trend-chip ${BAND_TILE[tone]}`} title="Delta / trend">{trend}</span>
      </span>
      <span className="ai-kpi-line2">
        <span className="ai-kpi-cur">Current</span>
        <span className="ai-kpi-value truncate whitespace-nowrap" title={value}>{value}</span>
      </span>
      <span className="ai-kpi-line3">
        <BandIcon band={tone} className="ai-kpi-trend w-3 h-3 shrink-0" />
        <span className="ai-kpi-sub truncate" title={sub}>{sub}</span>
      </span>
    </div>
  );
}

/** Switch Portfolio health from rich tiles to compact rows when project count reaches this. */
const HEALTH_COMPACT_AT = 4;

/** Portfolio health tile / chip order — default intervention-first. */
type HealthSortDir = 'worst' | 'best';

/**
 * Token efficiency `$ Generated / 1K tok` is higher-is-better.
 * Band chips relative to peers (terciles) using existing green/amber/red tones.
 */
function effChipTone(
  value: number | null | undefined,
  peers: Array<number | null | undefined>,
): AIHealthBand | 'neutral' {
  if (value == null || Number.isNaN(value)) return 'neutral';
  const nums = peers.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length <= 1) return 'green';
  const sorted = [...nums].sort((a, b) => a - b);
  const lo = sorted[Math.floor((sorted.length - 1) / 3)];
  const hi = sorted[Math.ceil((2 * (sorted.length - 1)) / 3)];
  if (value >= hi) return 'green';
  if (value <= lo) return 'red';
  return 'amber';
}

function healthDisplay(row: AIHealthRow) {
  const band = bandOf(row.band);
  const score = row.health_score == null ? '—' : fmt(row.health_score, 0);
  const label = row.band_label || (row.health_score != null && row.health_score < 70 ? 'Attention' : band);
  const bandText = label === 'Attention Required' ? 'Attention' : label;
  const value = money(row.value_usd ?? row.est_cost_savings_usd);
  const hours = `${fmt(row.hours_saved, 1)} h`;
  const adopt = pct(row.adoption_pct);
  const risk = row.risk_count ?? 0;
  const rec = healthRecommendation(row, risk);
  const trendPts = row.trend_pts;
  const trend = trendBadge(trendPts);
  return { band, score, bandText, value, hours, adopt, risk, rec, trendPts, trend };
}

function HealthTile({ row, onSelect }: { row: AIHealthRow; onSelect: (project: string) => void }) {
  const { band, score, bandText, value, hours, adopt, risk, rec, trend } = healthDisplay(row);
  const trendTitle = trend
    ? `${row.project} Health ${score} ${trend.arrow} ${trend.label}`
    : `${row.project} Health ${score}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.project)}
      className={`ai-health-tile glass-panel ai-health-accent-${band}`}
      title={`${trendTitle}. ${rec}. Adoption ${adopt}. ${hours}, ${value}. Risk ${risk}.`}
    >
      <span className="ai-health-top">
        <span className="ai-health-identity">
          <b className="ai-health-name">{row.project}</b>
          <span className={`ai-health-band ai-health-band-${band}`}>{bandText}</span>
        </span>
        <span className={`ai-health-score ai-health-score-${band}`}>
          <BandIcon band={band} className="w-3.5 h-3.5" />
          <span className="ai-health-score-num">{score}</span>
        </span>
      </span>
      <span className="ai-health-manager" title={row.manager || undefined}>
        {row.manager || 'Manager —'}
        {risk > 0 ? ` · ${risk} risk` : ''}
      </span>
      <span className="ai-health-metrics" aria-label={`Adoption ${adopt}, value ${value}, hours ${hours}, risk ${risk}`}>
        <span className="ai-health-metric">
          <span className="ai-health-metric-val">{adopt}</span>
          <span className="ai-health-metric-lbl">adopt</span>
        </span>
        <span className="ai-health-metric">
          <span className="ai-health-metric-val">{value}</span>
          <span className="ai-health-metric-lbl">value</span>
        </span>
        <span className="ai-health-metric">
          <span className="ai-health-metric-val">{hours}</span>
          <span className="ai-health-metric-lbl">hours</span>
        </span>
      </span>
      <span className="ai-health-foot">
        <span className={`ai-health-trend ai-health-trend-${band}`}>
          <Sparkline series={row.release_series} />
        </span>
        {trend && (
          <span className={`ai-health-delta ai-health-delta-${trend.tone}`} title={trendTitle}>
            {trend.arrow} {trend.label}
          </span>
        )}
        <span className="ai-health-rec" title={rec}>{rec}</span>
      </span>
    </button>
  );
}

/** Dense 5-cell strip when Portfolio health has ≥ HEALTH_COMPACT_AT projects.
 *  Cells: Project | Recommendation | Score + adopt/%/$ (one cell, inline) | Band | Trend pts.
 *  Layout: full-width flex row; scorecell `margin-left: auto` packs metrics|band|trend
 *  flush to the right padding (hole after rec is OK; nothing after trend).
 *  Hours omitted when tight; metrics share the score cell — no separate metrics column. */
function HealthCompactRow({ row, onSelect }: { row: AIHealthRow; onSelect: (project: string) => void }) {
  const { band, score, bandText, value, hours, adopt, risk, rec, trend } = healthDisplay(row);
  const trendTitle = trend
    ? `${row.project} Health ${score} ${trend.arrow} ${trend.label}`
    : `${row.project} Health ${score}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.project)}
      className={`ai-health-row glass-panel ai-health-accent-${band}`}
      title={`${trendTitle}. ${rec}. Adoption ${adopt}. ${hours}, ${value}. Risk ${risk}.`}
    >
      <b className="ai-health-row-code">{row.project}</b>
      <span className="ai-health-rec" title={rec}>{rec}</span>
      <span className="ai-health-row-scorecell">
        <span className={`ai-health-score ai-health-score-${band}`}>
          <BandIcon band={band} className="w-2 h-2" />
          <span className="ai-health-row-score">{score}</span>
        </span>
        <span className="ai-health-row-metrics" aria-label={`Adoption ${adopt}, value ${value}, hours ${hours}, risk ${risk}`}>
          <span>{adopt}</span>
          <span className="ai-health-row-sep" aria-hidden>·</span>
          <span>{value}</span>
        </span>
      </span>
      <span className={`ai-health-band ai-health-band-${band}`}>{bandText}</span>
      <span className="ai-health-row-trendcell">
        <span className={`ai-health-trend ai-health-trend-${band}`}>
          <Sparkline series={row.release_series} />
        </span>
        {trend && (
          <span className="ai-health-delta ai-health-delta-band" title={trendTitle}>
            {trend.arrow} {trend.label}
          </span>
        )}
      </span>
    </button>
  );
}

function attnIssueTitle(card: AIAttentionCard): string {
  const title = (card.title || '').trim();
  return title.replace(/^[A-Za-z0-9._-]{1,16}\s*[:·\-–]\s*/i, '').trim() || title || ATTN_RULE_LABEL[card.rule] || card.rule;
}

function attnImpactShort(card: AIAttentionCard): string {
  if (card.est_value_lost_usd != null && card.est_value_lost_usd > 0) {
    const label = String(card.business_impact || '').split('·')[0]?.trim() || 'Impact';
    return `${label} ${money(card.est_value_lost_usd)}`;
  }
  return card.business_impact || (card.severity === 'red' ? 'Release Risk' : card.severity === 'amber' ? 'Medium Impact' : 'Watch');
}

/** One-line alert used in matrix expand + heatmap cell popover. */
function AttentionAlertLine({ card, onSelect }: { card: AIAttentionCard; onSelect: (project: string) => void }) {
  const sev = card.severity === 'red' ? 'red' : card.severity === 'info' ? 'info' : 'amber';
  const action = card.recommended_action || ATTN_ACTION[card.rule] || 'Review';
  const impactBits = [
    card.priority || (sev === 'red' ? 'P1' : sev === 'amber' ? 'P2' : 'P3'),
    attnImpactShort(card),
    card.owner ? `Owner ${card.owner}` : null,
    action,
  ].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onSelect(card.project)}
      className={`ai-attn-line sev-${sev}`}
      title={impactBits || card.detail || card.title}
    >
      <span className="ai-attn-line-pip" aria-hidden />
      <span className="ai-attn-line-title">{attnIssueTitle(card)}</span>
      <span className="ai-attn-line-detail">{impactBits || card.detail}</span>
      <span className="ai-attn-line-go" aria-hidden>&gt;</span>
    </button>
  );
}

/** View mode ids stay stable; UI labels (Project / Type) can swap without confusing state. */
type AttnViewMode = 'heatmap' | 'matrix';

const ATTN_RULE_LABEL: Record<string, string> = {
  'ATT-1': 'Low adoption',
  'ATT-2': 'Token waste',
  'ATT-3': 'QA gap',
  'ATT-4': 'Decline',
  'ATT-5': 'Unquantified',
  'ATT-6': 'Unused seats',
  'ATT-7': 'QA below target',
  'ATT-8': 'No docs',
  'ATT-9': 'No coverage',
};

function attnProjectKey(card: AIAttentionCard): string {
  const raw = (card.project || '').trim();
  if (!raw) {
    const prefix = card.title?.match(/^([A-Za-z]{2,12})\s*:/)?.[1];
    if (prefix) return prefix.toUpperCase();
    return 'Other';
  }
  if (/^portfolio$/i.test(raw)) return 'Portfolio';
  return raw;
}

function attnTypeKey(card: AIAttentionCard): string {
  const rule = (card.rule || '').trim().toUpperCase();
  if (rule && ATTN_RULE_LABEL[rule]) return ATTN_RULE_LABEL[rule];
  if (rule) return rule;
  return 'Other';
}

type AttnHeatCell = {
  type: string;
  project: string;
  count: number;
  impact: number;
  worst: 'red' | 'amber' | 'info' | 'neutral';
  cards: AIAttentionCard[];
};

type AttnHeatmap = {
  types: string[];
  projects: string[];
  cells: Map<string, AttnHeatCell>;
  maxCount: number;
};

function attnSeverityRank(severity: string): number {
  if (severity === 'red') return 0;
  if (severity === 'amber') return 1;
  if (severity === 'info') return 2;
  return 3;
}

function attnWorstSeverity(cards: AIAttentionCard[]): AttnHeatCell['worst'] {
  const rank = Math.min(...cards.map((c) => attnSeverityRank(c.severity)), 3);
  if (rank === 0) return 'red';
  if (rank === 1) return 'amber';
  if (rank === 2) return 'info';
  return 'neutral';
}

function heatCellKey(type: string, project: string) {
  return `${type}\0${project}`;
}

function buildAttnHeatmap(cards: AIAttentionCard[]): AttnHeatmap {
  const typeOrder = Object.values(ATTN_RULE_LABEL);
  const typeSet = new Set<string>();
  const projectSet = new Set<string>();
  const buckets = new Map<string, AIAttentionCard[]>();

  for (const card of cards) {
    const type = attnTypeKey(card);
    const project = attnProjectKey(card);
    typeSet.add(type);
    projectSet.add(project);
    const key = heatCellKey(type, project);
    const list = buckets.get(key);
    if (list) list.push(card);
    else buckets.set(key, [card]);
  }

  const types = [...typeSet].sort((a, b) => {
    const ai = typeOrder.indexOf(a);
    const bi = typeOrder.indexOf(b);
    const aKnown = ai >= 0 ? 0 : 1;
    const bKnown = bi >= 0 ? 0 : 1;
    if (aKnown !== bKnown) return aKnown - bKnown;
    if (ai !== bi && ai >= 0 && bi >= 0) return ai - bi;
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  const projects = [...projectSet].sort((a, b) => {
    const aSpecial = a === 'Portfolio' || a === 'Other' ? 1 : 0;
    const bSpecial = b === 'Portfolio' || b === 'Other' ? 1 : 0;
    if (aSpecial !== bSpecial) return aSpecial - bSpecial;
    return a.localeCompare(b);
  });

  const cells = new Map<string, AttnHeatCell>();
  let maxCount = 0;
  let maxImpact = 0;
  for (const [key, groupCards] of buckets) {
    const [type, project] = key.split('\0');
    const count = groupCards.length;
    const impact = groupCards.reduce((sum, card) => sum + (card.est_value_lost_usd || 0), 0);
    maxCount = Math.max(maxCount, count);
    maxImpact = Math.max(maxImpact, impact);
    cells.set(key, {
      type,
      project,
      count,
      impact,
      worst: attnWorstSeverity(groupCards),
      cards: groupCards,
    });
  }

  return { types, projects, cells, maxCount: Math.max(maxCount, maxImpact > 0 ? maxImpact : maxCount) };
}

function attnHeatLevel(count: number, maxCount: number, impact = 0): 0 | 1 | 2 | 3 | 4 {
  const weight = impact > 0 ? Math.max(count, impact / Math.max(maxCount / 4, 1)) : count;
  if (weight <= 0) return 0;
  if (maxCount <= 1) return 3;
  const ratio = weight / maxCount;
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

function AttentionHeatmap({
  cards,
  onSelect,
}: {
  cards: AIAttentionCard[];
  onSelect: (project: string) => void;
}) {
  const heat = useMemo(() => buildAttnHeatmap(cards), [cards]);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [selected, setSelected] = React.useState<{ type: string; project: string } | null>(null);
  const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null);

  const clearSelection = React.useCallback(() => {
    setSelected(null);
    setAnchor(null);
  }, []);

  React.useEffect(() => {
    clearSelection();
  }, [cards, clearSelection]);

  const selectedCell = selected
    ? heat.cells.get(heatCellKey(selected.type, selected.project)) ?? null
    : null;

  const placePopover = (btn: HTMLElement) => {
    const popW = 300;
    const popH = 96;
    const gap = 6;
    const rect = btn.getBoundingClientRect();
    const roomRight = window.innerWidth - rect.right - gap;
    const roomBelow = window.innerHeight - rect.bottom - gap;
    let left: number;
    let top: number;
    if (roomRight >= popW) {
      left = rect.right + gap;
      top = Math.min(rect.top, window.innerHeight - popH - 8);
    } else if (roomBelow >= popH) {
      left = Math.min(Math.max(8, rect.left), window.innerWidth - popW - 8);
      top = rect.bottom + gap;
    } else {
      left = Math.min(Math.max(8, rect.left), window.innerWidth - popW - 8);
      top = Math.max(8, rect.top - gap - popH);
    }
    setAnchor({ top, left });
  };

  const onCellClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    cell: AttnHeatCell | undefined,
    type: string,
    project: string,
  ) => {
    if (!cell || cell.count === 0) {
      clearSelection();
      return;
    }
    if (selected?.type === type && selected?.project === project) {
      clearSelection();
      return;
    }
    placePopover(event.currentTarget);
    setSelected({ type, project });
  };

  React.useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popRef.current?.contains(target)) return;
      if ((event.target as Element | null)?.closest?.('.ai-attn-heat-cell')) return;
      clearSelection();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [selected, clearSelection]);

  return (
    <div className="ai-attn-heat-wrap">
      <div className="ai-attn-heat-scroll custom-scrollbar">
        <table className="ai-attn-heat" role="grid" aria-label="Attention exceptions by project and type">
          <thead>
            <tr>
              <th scope="col" className="ai-attn-heat-corner">Proj</th>
              {heat.types.map((type) => (
                <th key={type} scope="col" className="ai-attn-heat-col" title={type}>
                  <span className="ai-attn-heat-col-label">{type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heat.projects.map((project) => (
              <tr key={project}>
                <th scope="row" className="ai-attn-heat-row" title={project}>{project}</th>
                {heat.types.map((type) => {
                  const cell = heat.cells.get(heatCellKey(type, project));
                  const count = cell?.count ?? 0;
                  const impact = cell?.impact ?? 0;
                  const worst = cell?.worst ?? 'neutral';
                  const level = attnHeatLevel(count, heat.maxCount, impact);
                  const isOn = selected?.type === type && selected?.project === project;
                  return (
                    <td key={type} className="ai-attn-heat-td">
                      <button
                        type="button"
                        className={`ai-attn-heat-cell sev-${worst} lvl-${level}${isOn ? ' is-on' : ''}${count === 0 ? ' is-empty' : ''}`}
                        disabled={count === 0}
                        aria-pressed={isOn}
                        aria-expanded={isOn}
                        aria-label={
                          count === 0
                            ? `${project} · ${type}: none`
                            : `${project} · ${type}: ${count} issue${count === 1 ? '' : 's'}, ${worst}${impact ? `, impact ${money(impact)}` : ''}`
                        }
                        title={
                          count === 0
                            ? `${project} · ${type}: none`
                            : `${project} · ${type} · ${cell?.cards[0]?.priority || (worst === 'red' ? 'P1' : worst === 'amber' ? 'P2' : 'P3')}${impact ? ` · Impact ${money(impact)}` : ''}${cell?.cards[0]?.owner ? ` · Owner ${cell.cards[0].owner}` : ''}${cell?.cards[0]?.recommended_action ? ` · ${cell.cards[0].recommended_action}` : ''}`
                        }
                        onClick={(event) => onCellClick(event, cell, type, project)}
                      >
                        {count > 0
                          ? (impact > 0
                            ? (impact >= 1000 ? `$${Math.round(impact / 1000)}k` : money(impact))
                            : (cell?.cards[0]?.priority || (worst === 'red' ? 'P1' : 'P2')))
                          : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCell && anchor && (
        <div
          ref={popRef}
          className="ai-attn-heat-pop"
          style={{ top: anchor.top, left: anchor.left }}
          role="dialog"
          aria-label={`${selectedCell.project} · ${selectedCell.type} exceptions`}
          aria-live="polite"
        >
          <div className="ai-attn-heat-pop-head">
            <span className="ai-attn-heat-pop-label">
              {selectedCell.project} · {selectedCell.type}
              <span className="ai-attn-group-count">
                {' '}({selectedCell.count}
                {selectedCell.impact > 0 ? ` · Impact ${money(selectedCell.impact)}` : ''})
              </span>
            </span>
            <button
              type="button"
              className="ai-attn-groupby-btn"
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>
          <div className="ai-attn-heat-pop-body">
            {selectedCell.cards.map((card) => (
              <AttentionAlertLine key={card.id} card={card} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Type view — Issue Prioritization Engine (Issue · Impact · Priority · Owner · Action). */
function AttentionIssueEngine({
  cards,
  onSelect,
}: {
  cards: AIAttentionCard[];
  onSelect: (project: string) => void;
}) {
  const ranked = useMemo(() => {
    return [...cards].sort((a, b) => {
      const sev = attnSeverityRank(a.severity) - attnSeverityRank(b.severity);
      if (sev !== 0) return sev;
      const lost = (b.est_value_lost_usd || 0) - (a.est_value_lost_usd || 0);
      if (lost !== 0) return lost;
      return attnProjectKey(a).localeCompare(attnProjectKey(b));
    });
  }, [cards]);

  return (
    <div className="ai-attn-engine-wrap">
      <table className="ai-attn-engine" aria-label="Issue prioritization engine">
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Business Impact</th>
            <th scope="col">Priority</th>
            <th scope="col">Owner</th>
            <th scope="col">Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((card) => {
            const sev = card.severity === 'red' ? 'red' : card.severity === 'info' ? 'info' : 'amber';
            const priority = card.priority || (sev === 'red' ? 'P1' : sev === 'amber' ? 'P2' : 'P3');
            const action = card.recommended_action || ATTN_ACTION[card.rule] || 'Review';
            const issue = `${attnProjectKey(card)} · ${attnIssueTitle(card)}`;
            return (
              <tr key={card.id} className={`sev-${sev}`}>
                <td>
                  <button type="button" className="ai-attn-engine-issue" onClick={() => onSelect(card.project)} title={card.detail || card.title}>
                    {issue}
                  </button>
                </td>
                <td title={card.business_impact || undefined}>{attnImpactShort(card)}</td>
                <td><span className={`ai-attn-prio sev-${sev}`}>{priority}</span></td>
                <td title={card.owner || undefined}>{card.owner || 'SDM'}</td>
                <td title={action}>{action}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttentionGroupByToggle({
  viewMode,
  onChange,
}: {
  viewMode: AttnViewMode;
  onChange: (next: AttnViewMode) => void;
}) {
  return (
    <div className="ai-attn-groupby ai-sec-inline" role="group" aria-label="Issue prioritization view">
      <button
        type="button"
        className={`ai-attn-groupby-btn${viewMode === 'heatmap' ? ' is-active' : ''}`}
        aria-pressed={viewMode === 'heatmap'}
        onClick={() => onChange('heatmap')}
      >
        Project
      </button>
      <button
        type="button"
        className={`ai-attn-groupby-btn${viewMode === 'matrix' ? ' is-active' : ''}`}
        aria-pressed={viewMode === 'matrix'}
        onClick={() => onChange('matrix')}
      >
        Type
      </button>
    </div>
  );
}

function AttentionGroupedList({
  cards,
  onSelect,
  viewMode,
}: {
  cards: AIAttentionCard[];
  onSelect: (project: string) => void;
  viewMode: AttnViewMode;
}) {
  if (cards.length === 0) {
    return (
      <div className={`ai-attn-card border-l-4 ${BAND_TILE.green}`}>No leadership exceptions this release</div>
    );
  }

  return viewMode === 'heatmap' ? (
    <AttentionHeatmap cards={cards} onSelect={onSelect} />
  ) : (
    <AttentionIssueEngine cards={cards} onSelect={onSelect} />
  );
}

function filterList(value: string | string[] | undefined | null): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export const AIUtilizationDashboard: React.FC<AIUtilizationDashboardProps> = ({
  data,
  loading,
  onSelectEmployee,
  filters,
}) => {
  const [page, setPage] = React.useState<1 | 2 | 3>(1);
  const [project, setProject] = React.useState<string | null>(null);
  const [release, setRelease] = React.useState<string | null>(null);
  /** Default Project chip → heatmap (type×project); Type chip → matrix. */
  const [attnViewMode, setAttnViewMode] = React.useState<AttnViewMode>('heatmap');
  /** Portfolio health order — default worst-first (lowest health score first). */
  const [healthSortDir, setHealthSortDir] = React.useState<HealthSortDir>('worst');

  // When FilterBar Project / Release changes while drilled, drop stale page context.
  React.useEffect(() => {
    const projects = filterList(filters?.project).map((value) => value.toLowerCase());
    if (page > 1 && project && projects.length > 0 && !projects.includes(project.toLowerCase())) {
      setPage(1);
      setProject(null);
      setRelease(null);
      return;
    }
    const releases = filterList(filters?.release).map((value) => value.toLowerCase());
    if (page === 3 && release && releases.length > 0 && !releases.includes(release.toLowerCase())) {
      setPage(2);
      setRelease(null);
    }
  }, [filters?.project, filters?.release, page, project, release]);

  const health = data?.health ?? [];
  const attention = data?.attention ?? [];
  const summary = data?.summary;
  const funnel = data?.funnel ?? [];
  const quadrant = data?.quadrant ?? [];

  const tiles = useMemo(() => {
    const riskByProject = new Map<string, number>();
    for (const card of attention) {
      const key = card.project || 'Portfolio';
      riskByProject.set(key, (riskByProject.get(key) || 0) + 1);
    }
    const dir = healthSortDir === 'best' ? -1 : 1;
    return [...health]
      .map((row) => ({
        ...row,
        risk_count: row.risk_count ?? riskByProject.get(row.project) ?? 0,
        recommendation: row.recommendation || healthRecommendation(row, riskByProject.get(row.project) || 0),
      }))
      .sort((a, b) => {
        const aMissing = a.health_score == null;
        const bMissing = b.health_score == null;
        if (aMissing && bMissing) return a.project.localeCompare(b.project);
        if (aMissing) return 1;
        if (bMissing) return -1;
        return dir * ((a.health_score as number) - (b.health_score as number)) || a.project.localeCompare(b.project);
      });
  }, [health, attention, healthSortDir]);

  const effPeers = useMemo(
    () => tiles.map((row) => row.token_efficiency_usd_per_1k),
    [tiles],
  );

  const scatter = useMemo(
    () => quadrant.map((row: AIQuadrantRow) => ({
      ...row,
      quadrant: quadrantLabel(row.quadrant),
      x: row.adoption_pct ?? 0,
      y: row.value_usd ?? 0,
      trend_pts: row.trend_pts ?? health.find((h) => h.project === row.project)?.trend_pts ?? null,
    })),
    [quadrant, health],
  );

  const narrative = useMemo(
    () => (summary ? buildPortfolioNarrative(summary, health, attention, scatter) : []),
    [summary, health, attention, scatter],
  );

  const adoptSplit = summary?.targets?.Adoption_Pct ?? 80;
  const valueSplit = useMemo(() => {
    const values = scatter.map((row) => row.y).filter((value) => value > 0);
    if (!values.length) return 0;
    const mid = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return mid;
  }, [scatter]);

  React.useEffect(() => {
    if (page !== 1 || scatter.length === 0) return;
    const measure = () => {
      const root = document.querySelector('[data-dashboard="ai-utilization"]') as HTMLElement | null;
      const quadWrap = root?.querySelector('.ai-cmd-quad .recharts-wrapper') as HTMLElement | null;
      const quadPlot = root?.querySelector('.ai-cmd-quad .recharts-surface') as SVGElement | null;
      const symbols = root?.querySelectorAll('.ai-cmd-quad .recharts-scatter-symbol, .ai-cmd-quad .recharts-symbols, .ai-cmd-quad .ai-quad-dot');
      const labels = root?.querySelectorAll('.ai-cmd-quad .recharts-label-list text');
      const narr = root?.querySelector('.ai-cmd-narr') as HTMLElement | null;
      const attn = root?.querySelector('.ai-attn-list') as HTMLElement | null;
      const tile = root?.querySelector('.ai-health-tile') as HTMLElement | null;
      const tileCs = tile ? getComputedStyle(tile) : null;
      const attnCs = attn ? getComputedStyle(attn) : null;
      const labelYs = Array.from(labels || []).map((node) => Number((node as SVGTextElement).getAttribute('y') || 0));
      // #region agent log
      const healthPanel = root?.querySelector('.ai-cmd-mid > section') as HTMLElement | null;
      const healthHead = healthPanel?.querySelector('.ai-sec-head') as HTMLElement | null;
      const healthGrid = root?.querySelector('.ai-health-grid') as HTMLElement | null;
      const healthRows = Array.from(root?.querySelectorAll('.ai-health-grid .ai-health-row') || []) as HTMLElement[];
      const firstRow = healthRows[0] || null;
      const recEl = firstRow?.querySelector('.ai-health-rec') as HTMLElement | null;
      const scoreCell = firstRow?.querySelector('.ai-health-row-scorecell') as HTMLElement | null;
      const bandEl = firstRow?.querySelector('.ai-health-band') as HTMLElement | null;
      const trendCell = firstRow?.querySelector('.ai-health-row-trendcell') as HTMLElement | null;
      const deltaEl = firstRow?.querySelector('.ai-health-delta, .ai-health-delta-band') as HTMLElement | null;
      const sparkEl = firstRow?.querySelector('.ai-spark') as HTMLElement | null;
      const rowCs = firstRow ? getComputedStyle(firstRow) : null;
      const scoreCs = scoreCell ? getComputedStyle(scoreCell) : null;
      const gridCs = healthGrid ? getComputedStyle(healthGrid) : null;
      const rRect = firstRow?.getBoundingClientRect();
      const panelRect = healthPanel?.getBoundingClientRect();
      const headRect = healthHead?.getBoundingClientRect();
      const gridRect = healthGrid?.getBoundingClientRect();
      const recR = recEl?.getBoundingClientRect();
      const scoreR = scoreCell?.getBoundingClientRect();
      const bandR = bandEl?.getBoundingClientRect();
      const trendR = trendCell?.getBoundingClientRect();
      const deltaR = deltaEl?.getBoundingClientRect();
      const sparkR = sparkEl?.getBoundingClientRect();
      const rowHeights = healthRows.map((el) => el.getBoundingClientRect().height);
      const rowBottom = healthRows.length
        ? Math.max(...healthRows.map((el) => el.getBoundingClientRect().bottom))
        : null;
      const healthGeom = {
        appFullscreen: document.documentElement.classList.contains('app-fullscreen'),
        density: healthGrid?.getAttribute('data-health-density') ?? null,
        gridDisplay: gridCs?.display ?? null,
        gridOverflow: gridCs?.overflow ?? null,
        rowCount: healthRows.length,
        rowFlex: rowCs?.flex ?? null,
        rowWidth: rRect?.width ?? null,
        panelWidth: panelRect?.width ?? null,
        gridWidth: gridRect?.width ?? null,
        gridHeight: gridRect?.height ?? null,
        panelHeight: panelRect?.height ?? null,
        headHeight: headRect?.height ?? null,
        headToGrid: headRect && gridRect ? Math.round(gridRect.top - headRect.bottom) : null,
        panelEmptyBelowGrid: panelRect && gridRect ? Math.round(panelRect.bottom - gridRect.bottom) : null,
        scoreMarginLeft: scoreCs?.marginLeft ?? null,
        holeAfterRec: recR && scoreR ? Math.round(scoreR.left - recR.right) : null,
        bandToTrend: bandR && trendR ? Math.round(trendR.left - bandR.right) : null,
        bandToDelta: bandR && deltaR ? Math.round(deltaR.left - bandR.right) : null,
        sparkW: sparkR?.width ?? null,
        trailAfterDelta: rRect && deltaR ? Math.round(rRect.right - deltaR.right) : null,
        trailAfterTrend: rRect && trendR ? Math.round(rRect.right - trendR.right) : null,
        verticalEmpty: gridRect && rowBottom != null ? Math.round(gridRect.bottom - rowBottom) : null,
        rowHeights,
        projects: healthRows.map((el) => (el.querySelector('.ai-health-row-code')?.textContent || '').trim()),
      };
      // #endregion
      const dataPayload = {
        scatterLen: scatter.length,
        scatterPoints: scatter.map((row) => ({ project: row.project, x: row.x, y: row.y, quadrant: row.quadrant, band: row.band })),
        yMin: Math.min(...scatter.map((row) => row.y), 0),
        yMax: Math.max(...scatter.map((row) => row.y), 0),
        valueSplit,
        symbolCount: symbols?.length ?? 0,
        labelCount: labels?.length ?? 0,
        labelYs,
        labelClipped: labelYs.some((y) => y < 0),
        quadW: quadWrap?.clientWidth ?? null,
        quadH: quadWrap?.clientHeight ?? null,
        surfaceW: quadPlot?.clientWidth ?? quadPlot?.getBoundingClientRect().width ?? null,
        surfaceH: quadPlot?.clientHeight ?? quadPlot?.getBoundingClientRect().height ?? null,
        narrativeLen: narrative.length,
        narrH: narr?.clientHeight ?? null,
        attnCount: attention.length,
        attnScroll: attn?.scrollHeight ?? null,
        attnClient: attn?.clientHeight ?? null,
        attnOverflow: attnCs?.overflowY ?? null,
        tileH: tile?.clientHeight ?? null,
        tileScroll: tile?.scrollHeight ?? null,
        tileOverflow: tileCs?.overflow ?? null,
        tileText: (tile?.innerText || '').slice(0, 120),
      };
      // #region agent log
      const send = (hypothesisId: string, location: string, message: string, data: Record<string, unknown>) => {
        const body = JSON.stringify({ sessionId: '6a418b', runId: 'post-fix-hfill', hypothesisId, location, message, data, timestamp: Date.now() });
        fetch('http://127.0.0.1:7896/ingest/a53d98a9-e463-4e07-91cc-72a241898446', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6a418b' }, body }).catch(() => {});
        fetch('/api/ai-utilization/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
      };
      const bandCs = bandEl ? getComputedStyle(bandEl) : null;
      const metricsEl = firstRow?.querySelector('.ai-health-row-metrics') as HTMLElement | null;
      const metricsR = metricsEl?.getBoundingClientRect();
      const scoreToBand = metricsR && bandR ? Math.round(bandR.left - metricsR.right) : null;
      const scoreCellW = scoreR?.width ?? null;
      send('H1', 'AIUtilizationDashboard.tsx:health-geom', 'hole after rec (scorecell ml:auto)', { holeAfterRec: healthGeom.holeAfterRec, scoreMarginLeft: healthGeom.scoreMarginLeft, bandMarginLeft: bandCs?.marginLeft ?? null, rowWidth: healthGeom.rowWidth, expectHoleAfterRecLt: 24 });
      send('H2', 'AIUtilizationDashboard.tsx:health-geom', 'band to trend/delta gap (spark?)', { bandToTrend: healthGeom.bandToTrend, bandToDelta: healthGeom.bandToDelta, sparkW: healthGeom.sparkW });
      send('H3', 'AIUtilizationDashboard.tsx:health-geom', 'trail after delta/trend', { trailAfterDelta: healthGeom.trailAfterDelta, trailAfterTrend: healthGeom.trailAfterTrend });
      send('H4', 'AIUtilizationDashboard.tsx:health-geom', 'vertical empty under rows', { verticalEmpty: healthGeom.verticalEmpty, panelEmptyBelowGrid: healthGeom.panelEmptyBelowGrid, headToGrid: healthGeom.headToGrid, headHeight: healthGeom.headHeight, gridHeight: healthGeom.gridHeight, panelHeight: healthGeom.panelHeight, rowHeights: healthGeom.rowHeights, projects: healthGeom.projects, rowCount: healthGeom.rowCount, expectPanelEmptyBelowLt: 10, expectAvgRowHtGt: 24 });
      send('H5', 'AIUtilizationDashboard.tsx:health-geom', 'fullscreen vs windowed flex', { appFullscreen: healthGeom.appFullscreen, density: healthGeom.density, rowFlex: healthGeom.rowFlex, gridDisplay: healthGeom.gridDisplay, gridOverflow: healthGeom.gridOverflow, gridFlex: gridCs?.flex ?? null });
      send('H6', 'AIUtilizationDashboard.tsx:health-geom', 'mid-row horizontal fill (scorecell rail)', { scoreToBand, scoreCellW, bandMarginLeft: bandCs?.marginLeft ?? null, expectBandMl: '0px', expectScoreToBandFilled: true });
      send('A', 'AIUtilizationDashboard.tsx:measure', 'page1 visual sizes', dataPayload as unknown as Record<string, unknown>);
      send('B', 'AIUtilizationDashboard.tsx:scatter-dom', 'scatter symbol vs data', { scatterLen: dataPayload.scatterLen, symbolCount: dataPayload.symbolCount, labelCount: dataPayload.labelCount, labelClipped: dataPayload.labelClipped, labelYs: dataPayload.labelYs, quadH: dataPayload.quadH, surfaceH: dataPayload.surfaceH, yMax: dataPayload.yMax });
      send('C', 'AIUtilizationDashboard.tsx:quad-size', 'quadrant container size', { quadW: dataPayload.quadW, quadH: dataPayload.quadH, surfaceW: dataPayload.surfaceW, surfaceH: dataPayload.surfaceH });
      send('D', 'AIUtilizationDashboard.tsx:narr', 'portfolio narrative', { narrativeLen: dataPayload.narrativeLen, narrH: dataPayload.narrH });
      send('E', 'AIUtilizationDashboard.tsx:attn', 'attention list clip', { attnCount: dataPayload.attnCount, attnScroll: dataPayload.attnScroll, attnClient: dataPayload.attnClient, attnOverflow: dataPayload.attnOverflow });
      send('F', 'AIUtilizationDashboard.tsx:tile', 'health tile clip', { tileH: dataPayload.tileH, tileScroll: dataPayload.tileScroll, tileOverflow: dataPayload.tileOverflow, tileText: dataPayload.tileText });
      // #endregion
    };
    const id = window.setTimeout(() => window.requestAnimationFrame(measure), 400);
    return () => window.clearTimeout(id);
  }, [page, scatter, narrative, attention, valueSplit, tiles.length]);

  if (loading && !data) return <DashboardSkeleton variant="workforce" />;
  if (!data || !summary) {
    return (
      <EmptyState
        title="AI utilization not loaded"
        description="Reload the workforce workbook after the AI sheets are filled."
      />
    );
  }

  const bands = summary.kpi_bands ?? {};
  const targets = summary.targets ?? {};
  const trend = summary.trend ?? {};
  const forecast = summary.forecast ?? {};
  const missedPct = summary.missed_pct ?? (
    summary.unrealized_value_usd != null && summary.potential_value_usd
      ? (summary.unrealized_value_usd / summary.potential_value_usd) * 100
      : null
  );
  const recovery = summary.recovery_potential_usd ?? summary.unrealized_value_usd;

  const openProject = (next: string) => {
    setProject(next);
    setRelease(null);
    setPage(2);
  };
  const openRelease = (next: string) => {
    setRelease(next);
    setPage(3);
  };
  const goPortfolio = () => {
    setPage(1);
    setProject(null);
    setRelease(null);
  };
  const goProject = () => {
    setPage(2);
    setRelease(null);
  };
  const goBack = () => {
    if (page === 3) goProject();
    else if (page === 2) goPortfolio();
  };

  return (
    <div className="dash-fit ai-util-fit select-none min-h-0" data-dashboard="ai-utilization" data-page={page}>
      {page === 2 && project && (
        <AIUtilizationPage2
          data={data}
          project={project}
          onOpenRelease={openRelease}
          onSelectEmployee={onSelectEmployee}
          onBack={goPortfolio}
        />
      )}
      {page === 3 && project && release && (
        <AIUtilizationPage3
          data={data}
          project={project}
          release={release}
          onSelectEmployee={onSelectEmployee}
          onBack={goBack}
          onGoPortfolio={goPortfolio}
          onGoProject={goProject}
        />
      )}
      {page === 1 && (
        <>
          <div className="ai-kpis">
            <KpiCard
              label="AI Adoption"
              value={pct(summary.adoption_evidence_pct)}
              sub={varianceLine(summary.adoption_evidence_pct, targets.Adoption_Pct, 'pct', forecast.adoption_pct)}
              trend={execTrendChip(trend.adoption_pts, {
                vsTargetGap: summary.adoption_evidence_pct != null && targets.Adoption_Pct != null
                  ? summary.adoption_evidence_pct - targets.Adoption_Pct
                  : null,
              })}
              band={bands.adoption || 'neutral'}
              icon={<Users className="w-3 h-3 text-cyan-600 shrink-0" />}
            />
            <KpiCard
              label="Business value"
              value={money(summary.business_value_usd ?? summary.est_cost_savings_usd)}
              sub={varianceLine(summary.business_value_usd ?? summary.est_cost_savings_usd, summary.potential_value_usd ?? summary.savings_target_usd, 'money', forecast.business_value_usd)}
              trend={execTrendChip(trend.value_delta, {
                gained: trend.value_delta != null && trend.value_delta > 0 ? 'gained' : undefined,
              })}
              band={bands.business_value || bands.savings || 'neutral'}
              icon={<CircleDollarSign className="w-3 h-3 text-emerald-600 shrink-0" />}
            />
            <KpiCard
              label="Hours saved"
              value={`${fmt(summary.hours_saved, 1)} h`}
              sub={varianceLine(summary.hours_saved, summary.hours_target, 'num', forecast.hours_saved)}
              trend={execTrendChip(trend.hours_delta)}
              band={bands.hours || 'neutral'}
              icon={<Clock3 className="w-3 h-3 text-sky-600 shrink-0" />}
            />
            <KpiCard
              label="Opportunity loss"
              value={money(summary.unrealized_value_usd)}
              sub={varianceLine(summary.unrealized_value_usd, 0, 'money', forecast.opportunity_loss_usd)}
              trend={missedPct == null ? '▬ Stable' : missedPct > 10 ? '▼ Declining' : '▬ Stable'}
              band={bands.opportunity_loss || 'neutral'}
              icon={<Target className="w-3 h-3 text-amber-600 shrink-0" />}
            />
            <KpiCard
              label={summary.attention_kpi?.label || 'Value at risk'}
              value={money(summary.value_at_risk_usd ?? summary.unrealized_value_usd ?? summary.attention_kpi?.value)}
              sub={`${summary.critical_projects ?? summary.projects_requiring_attention ?? tiles.filter((row) => (row.health_score ?? 100) < 70).length} critical · ${summary.critical_risks ?? attention.filter((card) => card.severity === 'red').length} P1`}
              trend={(summary.value_at_risk_usd ?? summary.unrealized_value_usd ?? 0) > 0 ? '▼ Declining' : '▬ Stable'}
              band={bands.attention || 'neutral'}
              icon={<AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
            />
          </div>

          <div className="ai-cmd-mid">
            <section className="glass-panel rounded-xl ai-panel flex flex-col overflow-hidden min-h-0 min-w-0 h-full">
              <div className="ai-sec-head" title="Which project needs intervention first?">
                <span className="ai-sec-title">Portfolio health</span>
                <div className="ai-eff-strip ai-sec-inline" aria-label="Token efficiency by project">
                  {tiles.map((row) => {
                    const tone = effChipTone(row.token_efficiency_usd_per_1k, effPeers);
                    return (
                      <span
                        key={`eff-${row.project}`}
                        className={`ai-eff-chip tone-${tone}`}
                        title={
                          row.token_efficiency_usd_per_1k == null
                            ? `${row.project} · token efficiency n/a`
                            : `${row.project} · ${money(row.token_efficiency_usd_per_1k, 0)} generated / 1K tokens (higher is better)`
                        }
                      >
                        <b>{row.project}</b>{' '}
                        {row.token_efficiency_usd_per_1k == null
                          ? 'n/a'
                          : `${money(row.token_efficiency_usd_per_1k, 0)} / 1K tok`}
                      </span>
                    );
                  })}
                </div>
                <label className="ai-health-sort ai-sec-meta" title="Sort portfolio health by score">
                  <ArrowUpDown className="ai-health-sort-icon" aria-hidden />
                  <select
                    className="ai-health-sort-select"
                    value={healthSortDir}
                    aria-label="Sort portfolio health"
                    onChange={(event) => setHealthSortDir(event.target.value as HealthSortDir)}
                  >
                    <option value="worst">Worst first</option>
                    <option value="best">Best first</option>
                  </select>
                </label>
              </div>
              <div
                className={`ai-health-grid${tiles.length >= HEALTH_COMPACT_AT ? ' is-compact' : ''}`}
                data-health-density={tiles.length >= HEALTH_COMPACT_AT ? 'compact' : 'rich'}
              >
                {tiles.map((row) =>
                  tiles.length >= HEALTH_COMPACT_AT ? (
                    <HealthCompactRow key={row.project} row={row} onSelect={openProject} />
                  ) : (
                    <HealthTile key={row.project} row={row} onSelect={openProject} />
                  ),
                )}
                {tiles.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-1 py-2">No project has AI evidence for this release.</p>
                )}
              </div>
            </section>

            <section className="glass-panel rounded-xl ai-panel flex flex-col overflow-hidden min-h-0 min-w-0 h-full ai-attn-engine-panel">
              <div className="ai-sec-head" title="Issue Prioritization Engine — what must a VP act on this release?">
                <span className="ai-sec-title">Issue Prioritization</span>
                {attention.length > 0 && (
                  <AttentionGroupByToggle viewMode={attnViewMode} onChange={setAttnViewMode} />
                )}
                <span className="ai-sec-meta">{attention.length ? `${attention.length} issues` : 'none'}</span>
              </div>
              <div className="ai-attn-list">
                <AttentionGroupedList cards={attention} onSelect={openProject} viewMode={attnViewMode} />
              </div>
            </section>
          </div>

          <div className="ai-cmd-bottom">
            <section className="ai-cmd-opp glass-panel rounded-xl ai-panel flex flex-col overflow-hidden min-h-0 min-w-0 h-full">
              <div className="ai-sec-head" title="Where is value left on the table?">
                <span className="ai-sec-title">Opportunity loss</span>
              </div>
              <div className="ai-opp-hero" aria-label="Opportunity recovery metrics">
                <span><b>Potential</b> {money(summary.potential_value_usd)}</span>
                <span><b>Actual</b> {money(summary.business_value_usd ?? summary.est_cost_savings_usd)}</span>
                <span className="ai-opp-missed"><b>Missed</b> {money(summary.unrealized_value_usd)}</span>
                <span className="ai-opp-recovery"><b>Recovery %</b> {pct(summary.recovery_opportunity_pct ?? missedPct, 0)}</span>
                <span className="ai-opp-recovery"><b>Recovery Value</b> {money(recovery)}</span>
              </div>
              <div className="ai-opp-body ai-opp-body-funnel">
                <FunnelStrip stages={funnel} />
              </div>
            </section>

            <section className="ai-cmd-quad glass-panel rounded-xl ai-panel flex flex-col overflow-hidden min-h-0 min-w-0 h-full">
              <div className="ai-sec-head" title="Strategic Leaders · Growth Candidates · Execution Risk · Turnaround Required">
                <span className="ai-sec-title">Portfolio quadrant</span>
                <div className="ai-quad-legend ai-sec-inline" aria-label="Project quadrant labels">
                  {scatter.map((row) => (
                    <button
                      key={row.project}
                      type="button"
                      className={`ai-chip ${quadrantChipTone(row.quadrant)}`}
                      title={`${row.project} · ${row.quadrant}`}
                      onClick={() => openProject(row.project)}
                    >
                      {row.project} · {quadrantChipLabel(row.quadrant)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 ai-quad-plot">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 18, right: 14, left: 2, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" strokeOpacity={0.35} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[0, 100]}
                      tick={{ fontSize: 9, fill: 'var(--muted)' }}
                      name="Adoption"
                      unit="%"
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[0, (dataMax: number) => Math.max(dataMax * 1.22, 1)]}
                      tick={{ fontSize: 9, fill: 'var(--muted)' }}
                      name="Value"
                      tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                      width={44}
                    />
                    <ReferenceLine x={adoptSplit} stroke="#94a3b8" strokeDasharray="4 3" />
                    <ReferenceLine y={valueSplit} stroke="#94a3b8" strokeDasharray="4 3" />
                    <Tooltip
                      content={({ payload }) => {
                        const row = payload?.[0]?.payload as (typeof scatter)[number] | undefined;
                        if (!row) return null;
                        const t = trendBadge(row.trend_pts);
                        return (
                          <div className="ai-quad-tip">
                            <b>{row.project}</b>
                            <div>{row.quadrant}</div>
                            <div>Value {money(row.y)} · Adoption {pct(row.x)}</div>
                            {t && <div>Trend {t.arrow} {t.label}</div>}
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={scatter}
                      shape={(dotProps) => <QuadDot {...dotProps} onDrill={openProject} />}
                      onClick={(state: { payload?: { project?: string } }) => {
                        const next = state?.payload?.project;
                        if (next) openProject(next);
                      }}
                      isAnimationActive={false}
                    >
                      {scatter.map((row) => (
                        <Cell key={row.project} fill={quadrantDotFill(row.quadrant)} />
                      ))}
                      <LabelList dataKey="project" content={QuadScatterLabel} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="ai-cmd-narr glass-panel rounded-xl ai-panel flex flex-col overflow-hidden min-h-0 min-w-0">
            <div className="ai-sec-head" title="Situation · Opportunity · Risk · Priority · Executive Action">
              <span className="ai-sec-title">Portfolio narrative</span>
              <span className="ai-sec-meta">≤5</span>
            </div>
            <ol className="ai-narr-list ai-narr-list-5">
              {narrative.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {narrative.length === 0 && (
                <li className="opacity-70">No portfolio narrative yet — reload after AI sheets are filled.</li>
              )}
            </ol>
          </section>
        </>
      )}
    </div>
  );
};

function FunnelStrip({ stages }: { stages: AIFunnelStage[] }) {
  const max = Math.max(...stages.map((row) => row.value || 0), 1);
  return (
    <div className="ai-funnel" title="Capacity to realized savings">
      {stages.map((stage) => (
        <div key={stage.stage} className="ai-funnel-step">
          <span className="ai-funnel-label">{stage.stage}</span>
          <span className="ai-funnel-bar"><span style={{ width: `${((stage.value || 0) / max) * 100}%` }} /></span>
          <b className="ai-funnel-value">{money(stage.value)}</b>
        </div>
      ))}
    </div>
  );
}
