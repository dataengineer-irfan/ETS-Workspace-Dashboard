import React, { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AIHealthRow,
  AIReleaseTrendRow,
  AIRiskCard,
  AIUtilizationKPIs,
} from '../../types/dashboard';

type Band = 'green' | 'amber' | 'red' | 'neutral';

const BAND: Record<string, string> = {
  green: 'ai-band-green',
  teal: 'ai-band-teal',
  amber: 'ai-band-amber',
  red: 'ai-band-red',
  neutral: 'ai-band-neutral',
};

const EFFECTIVENESS: { label: string; keys: string[] }[] = [
  { label: 'Code Generation', keys: ['Code generation'] },
  { label: 'Code Review', keys: ['Code review'] },
  { label: 'SQL Development', keys: ['SQL development'] },
  { label: 'Documentation', keys: ['Docs'] },
  { label: 'Testing', keys: ['Unit testing', 'Test design'] },
  { label: 'Automation', keys: ['Test automation'] },
  { label: 'Defect Analysis', keys: ['Defect analysis'] },
  { label: 'Knowledge Search', keys: ['Knowledge search', 'Other'] },
];

const MATURITY_LABEL: Record<number, string> = {
  1: 'Ad Hoc',
  2: 'Emerging',
  3: 'Managed',
  4: 'Optimized',
  5: 'AI Driven',
};

/* Battle: full Dev | metric | QA list always visible (no More/Less). Mid body (~230–280px) fits ~9 rows
   with slight air after reclaiming the More control; Genie uses compact row density instead of a toggle. */
/* UC effectiveness: full ranked strip always visible (# · name+tag · Usage · Hours · Trend · Value · Rec) —
   no More/Less; Genie uses compact density (drops Trend) instead of a toggle. */
/* Release journey (mid col 3, wide track): single-line head; Best/Worst/Now (merge when Now equals
   Best or Worst); chart = trend with release-name milestones; chips = picker (name + !);
   one action line, no metric echo. Point labels drop under the compact container query.
   Card stretches to the Battle row and does not grow it. */

function sameProject(a: string | null | undefined, b: string | null | undefined): boolean {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

/** Map generic maturity axes → QA-leadership labels when keys match. */
const QA_AXIS_ALIAS: Record<string, string> = {
  Adoption: 'Coverage',
  Automation: 'Automation Adoption',
  Documentation: 'Test Case Generation',
  'QA Coverage': 'QA Coverage',
  'Code Generation': 'Defect Prevention',
  'Knowledge Management': 'Evidence Quality',
  Coverage: 'Coverage',
  Evidence: 'Evidence Quality',
};

/** Capability target for next maturity band (L3 ~70; higher levels tighten). */
function maturityTargetFor(nextLevel: number): number {
  if (nextLevel >= 5) return 90;
  if (nextLevel >= 4) return 80;
  return 70;
}

const AXIS_IMPACT: Record<string, string> = {
  Coverage: 'Adoption breadth stalls before QA can scale AI.',
  'QA Coverage': 'QA evidence stays thin — release confidence lags Dev.',
  'Automation Adoption': 'Manual test effort stays high each release.',
  'Test Case Generation': 'Case design remains slow; coverage plateaus.',
  'Defect Prevention': 'Rework risk stays elevated vs peer projects.',
  'Evidence Quality': 'Leadership cannot trust AI ROI claims.',
};

function axisImpact(name: string): string {
  return AXIS_IMPACT[name] || 'Blocks progress to the next maturity level.';
}

function maturityStatus(readiness: number | null, gap: number | null): { label: string; band: Band } {
  if (readiness == null && gap == null) return { label: 'Watch', band: 'amber' };
  if ((readiness != null && readiness >= 85) || (gap != null && gap <= 8)) {
    return { label: 'On Track', band: 'green' };
  }
  if ((readiness != null && readiness >= 60) || (gap != null && gap <= 25)) {
    return { label: 'Watch', band: 'amber' };
  }
  return { label: 'At Risk', band: 'red' };
}

type BenchTone = 'green' | 'teal' | 'amber' | 'red';

/**
 * Inclusive linear percentile (Excel PERCENTILE.INC).
 * Small portfolios use the same interpolation — quartiles are not hardcoded.
 */
function percentileInc(sortedAsc: number[], p: number): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  if (n === 1) return sortedAsc[0];
  const index = (p / 100) * (n - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sortedAsc[lo];
  const weight = index - lo;
  return sortedAsc[lo] * (1 - weight) + sortedAsc[hi] * weight;
}

function projectValueUsd(row: AIHealthRow): number | null {
  return finiteNum(row.value_usd ?? row.ai_value_usd);
}

/** Value ÷ active users, or ÷ headcount when active users is 0. */
function valuePerUserOf(row: AIHealthRow): number | null {
  const value = projectValueUsd(row);
  if (value == null) return null;
  const active = finiteNum(row.active_users) ?? 0;
  const headcount = finiteNum(row.headcount_scope) ?? 0;
  const denom = active > 0 ? active : headcount > 0 ? headcount : 0;
  if (denom <= 0) return null;
  return value / denom;
}

/** Share of the ranked list at or above this place. #1 of 4 is 25%, not a forced top 10%. */
function rankSlice(rank: number, total: number): number {
  if (total <= 0) return 1;
  return rank / total;
}

function rankToneOf(rank: number, total: number): BenchTone {
  const slice = rankSlice(rank, total);
  if (slice <= 0.1) return 'green';
  if (slice <= 0.25) return 'teal';
  if (slice <= 0.5) return 'amber';
  return 'red';
}

function healthToneOf(score: number): BenchTone {
  if (score >= 90) return 'green';
  if (score >= 75) return 'teal';
  if (score >= 60) return 'amber';
  return 'red';
}

function valueToneOf(deltaPct: number | null): BenchTone | null {
  if (deltaPct == null || Number.isNaN(deltaPct)) return null;
  if (deltaPct > 25) return 'green';
  if (Math.abs(deltaPct) <= 2) return 'amber';
  if (deltaPct > 2) return 'teal';
  return 'red';
}

/** First matching rule. Health above 80 that is outside the top 25% has no label. */
function benchmarkStatus(score: number, rank: number, total: number): { label: string; tone: BenchTone } | null {
  const slice = rankSlice(rank, total);
  if (score > 90 && slice <= 0.1) return { label: 'Portfolio Leader', tone: 'green' };
  if (score > 80 && slice <= 0.25) return { label: 'High Performer', tone: 'teal' };
  if (score >= 60 && score <= 80) return { label: 'Improvement Opportunity', tone: 'amber' };
  if (score < 60) return { label: 'Executive Attention Required', tone: 'red' };
  return null;
}

function vsAverageLabel(deltaPct: number): string {
  const digits = Math.abs(deltaPct) >= 9.95 ? 0 : 1;
  const rounded = Number(deltaPct.toFixed(digits));
  const body = Math.abs(rounded).toFixed(digits);
  if (rounded > 0) return `+${body}%`;
  if (rounded < 0) return `-${body}%`;
  return '0%';
}

type PortfolioBenchmark = {
  rank: number;
  total: number;
  health: number;
  average: number;
  topQuartile: number;
  bottomQuartile: number;
  valuePerUser: number | null;
  valueDeltaPct: number | null;
  rankTone: BenchTone;
  healthTone: BenchTone;
  valueTone: BenchTone | null;
  status: { label: string; tone: BenchTone } | null;
  title: string;
  scale: { lo: number; hi: number };
};

function buildPortfolioBenchmark(rows: AIHealthRow[], project: string): PortfolioBenchmark | null {
  const scored = rows.filter((row) => finiteNum(row.health_score) != null);
  const mine = rows.find((row) => sameProject(row.project, project));
  const health = mine ? finiteNum(mine.health_score) : null;
  if (!mine || health == null || scored.length === 0) return null;

  const total = scored.length;
  const better = scored.filter((row) => (finiteNum(row.health_score) as number) > health).length;
  const rank = better + 1;
  const scores = scored.map((row) => finiteNum(row.health_score) as number).sort((a, b) => a - b);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const topQuartile = percentileInc(scores, 75) as number;
  const bottomQuartile = percentileInc(scores, 25) as number;

  const peerValues = scored.map(valuePerUserOf).filter((value): value is number => value != null);
  const valuePerUser = valuePerUserOf(mine);
  const averageValuePerUser = peerValues.length
    ? peerValues.reduce((sum, value) => sum + value, 0) / peerValues.length
    : null;
  const valueDeltaPct = valuePerUser != null && averageValuePerUser != null && averageValuePerUser !== 0
    ? ((valuePerUser - averageValuePerUser) / Math.abs(averageValuePerUser)) * 100
    : null;

  const titleParts = [
    `Rank #${rank} of ${total}`,
    `Health ${fmt(health, 1)}`,
    `Portfolio average ${fmt(average, 1)}`,
    `Top quartile ${fmt(topQuartile, 1)}`,
    `Bottom quartile ${fmt(bottomQuartile, 1)}`,
  ];
  if (valuePerUser != null) {
    const delta = valueDeltaPct == null ? '' : ` (${vsAverageLabel(valueDeltaPct)} vs average)`;
    titleParts.push(`Value per user ${money(valuePerUser)}${delta}`);
  }
  const maturity = finiteNum(mine.maturity_level);
  if (maturity != null) {
    const label = MATURITY_LABEL[maturity];
    titleParts.push(label ? `Maturity L${maturity} ${label}` : `Maturity L${maturity}`);
  }
  const trend = finiteNum(mine.trend_pts);
  if (trend != null) {
    titleParts.push(`Release trend ${trend > 0 ? '+' : ''}${fmt(trend, 1)} pts`);
  }

  const marks = [health, topQuartile, average, bottomQuartile];
  const spread = Math.max(...marks) - Math.min(...marks);
  const pad = Math.max(3, spread * 0.12);
  const lo = Math.max(0, Math.floor(Math.min(...marks) - pad));
  const hi = Math.min(100, Math.ceil(Math.max(...marks) + pad));

  return {
    rank,
    total,
    health,
    average,
    topQuartile,
    bottomQuartile,
    valuePerUser,
    valueDeltaPct,
    rankTone: rankToneOf(rank, total),
    healthTone: healthToneOf(health),
    valueTone: valueToneOf(valueDeltaPct),
    status: benchmarkStatus(health, rank, total),
    title: titleParts.join(' · '),
    scale: { lo, hi: hi > lo ? hi : lo + 1 },
  };
}

type QaStatus = { label: string; band: Band };

/** Plain status of a capability against the next-level target. Near = within 10 pts. */
function capabilityStatus(score: number, target: number): QaStatus {
  if (score >= target) return { label: 'At target', band: 'green' };
  if (score >= target - 10) return { label: 'Near target', band: 'amber' };
  return { label: 'Below target', band: 'red' };
}

/** Bar runs from 0 to the target: a full bar is at target, the line at its end is the target. */
function QaTargetBar({
  score,
  target,
  band,
  label,
}: {
  score: number;
  target: number;
  band: Band;
  label: string;
}) {
  const fill = target > 0 ? Math.max(0, Math.min(100, (score / target) * 100)) : 0;
  return (
    <span
      className="ai-p2-qa-track"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.round(score)}
    >
      <span className={`ai-p2-qa-fill is-${band}`} style={{ width: `${fill}%` }} />
    </span>
  );
}

function bandOf(value: string | undefined | null): Band {
  const key = String(value || 'neutral').toLowerCase();
  if (key === 'green' || key === 'amber' || key === 'red') return key;
  return 'neutral';
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

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Header shows one SDM, never a comma-separated roster. */
function oneManager(name: string | null | undefined) {
  const raw = String(name || '').trim();
  if (!raw) return '—';
  const first = raw.split(/[,;|]|(?:\s+and\s+)/i)[0]?.trim();
  return first || '—';
}

function finiteNum(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

type AdoptStage = { key: string; label: string; count: number | null };

/**
 * Workforce funnel for the drilled project. Counts come only from fields
 * already on the payload. Power users are omitted: nothing in health, people,
 * or contribution rows defines that stage or a threshold for it.
 * A null count is n/a (no evidence). A real zero stays 0.
 */
function adoptionStages(
  health: AIHealthRow | undefined,
  domains: { users_enabled: number | null }[],
  contributorCount: number,
): AdoptStage[] {
  const evidence = !!health && (
    (health.people_tagged ?? 0) > 0
    || (health.rows ?? 0) > 0
    || (health.active_users ?? 0) > 0
    || (health.headcount_scope ?? 0) > 0
  );
  const present = (value: number | null) => {
    if (value == null) return null;
    if (value === 0 && !evidence) return null;
    return value;
  };
  const enabledVals = domains
    .map((row) => finiteNum(row.users_enabled))
    .filter((n): n is number => n != null);
  const enabled = enabledVals.length ? enabledVals.reduce((sum, n) => sum + n, 0) : null;
  return [
    { key: 'team', label: 'Team', count: present(health ? finiteNum(health.headcount_scope) : null) },
    { key: 'enabled', label: 'Enabled', count: enabled },
    { key: 'active', label: 'Active', count: present(health ? finiteNum(health.active_users) : null) },
    { key: 'contributors', label: 'Contributors', count: contributorCount },
  ];
}

/**
 * Funnel bars are Team → Enabled → Active. Contributors is not a stage:
 * it is the count of people producing value, so it never draws a drop.
 * When Enabled's count equals Team, skip it — a second identical bar hides
 * the real Team → Active drop.
 */
function funnelBars(stages: AdoptStage[]): AdoptStage[] {
  const team = stages.find((stage) => stage.key === 'team');
  return stages.filter((stage) => {
    if (stage.key === 'contributors') return false;
    if (stage.key !== 'enabled' || !team) return true;
    return stage.count !== team.count;
  });
}

/** Drop-off % = (previous − current) / previous. Null when either side is missing or previous is 0. */
function adoptionDrop(previous: number | null, current: number | null): number | null {
  if (previous == null || current == null || previous <= 0) return null;
  return ((previous - current) / previous) * 100;
}

function fmtDrop(drop: number | null): string {
  if (drop == null) return 'n/a';
  const rounded = Math.round(drop);
  if (rounded === 0 && drop > 0) return '<1%';
  if (rounded === 0 && drop < 0) return '−<1%';
  return `${rounded}%`;
}

type ContributionShare = {
  devPct: number;
  qaPct: number;
  devRaw: number;
  qaRaw: number;
  basis: 'value' | 'hours' | 'assets';
};

function ContributionDonut({ contribution }: { contribution: ContributionShare | null }) {
  if (!contribution) {
    return (
      <div className="ai-p2-donut-row" data-ai-p2-donut>
        <span className="ai-p2-donut-na">Share n/a</span>
      </div>
    );
  }
  const slices = [
    { name: 'Dev', value: Math.max(contribution.devRaw, 0) },
    { name: 'QA', value: Math.max(contribution.qaRaw, 0) },
  ];
  return (
    <div
      className="ai-p2-donut-row"
      data-ai-p2-donut
      title={`Dev ${fmt(contribution.devPct, 0)}% · QA ${fmt(contribution.qaPct, 0)}% of ${contribution.basis}`}
    >
      <PieChart width={20} height={20}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx={10}
          cy={10}
          innerRadius={5}
          outerRadius={9.5}
          stroke="none"
          isAnimationActive={false}
        >
          <Cell fill="#0284c7" />
          <Cell fill="#0d9488" />
        </Pie>
      </PieChart>
      <span className="ai-p2-donut-share">Dev {fmt(contribution.devPct, 0)}%</span>
      <span className="ai-p2-donut-share">QA {fmt(contribution.qaPct, 0)}%</span>
      <span className="ai-p2-donut-basis">{contribution.basis}</span>
    </div>
  );
}

function ScoreRing({ score, band }: { score: number | null; band: string }) {
  const tone = bandOf(band);
  const color = tone === 'green' ? '#047857' : tone === 'amber' ? '#b45309' : tone === 'red' ? '#be123c' : '#64748b';
  const pctFill = Math.max(0, Math.min(100, score ?? 0));
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = (pctFill / 100) * c;
  return (
    <span className="ai-score-ring ai-p2-health-ring" aria-label={`Health ${score ?? 'n/a'} ${band}`}>
      <svg viewBox="0 0 36 36" width="44" height="44">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="3.5" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
        <text x="18" y="21.2" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="ui-monospace, Consolas, monospace">{score == null ? '—' : Math.round(score)}</text>
      </svg>
    </span>
  );
}

function managementRecommendation(
  card: { gap_sentence?: string; adoption_pct?: number | null; release_quality_pct?: number | null; score?: number | null; grade?: string } | undefined,
  health: AIHealthRow | undefined,
): string {
  if (!card && !health) return 'Review AI evidence';
  const gap = (card?.gap_sentence || '').toLowerCase();
  if (gap.includes('evidence')) return 'Improve Evidence Quality';
  if (gap.includes('adoption') || (card?.adoption_pct != null && card.adoption_pct < 50)) return 'Drive QA Adoption';
  if ((health?.qa_adoption_pct ?? 100) < 40) return 'Drive QA Adoption';
  if (card?.score != null && card.score >= 90) return 'Scale Best Practices';
  if (card?.score != null && card.score >= 80) return 'Maintain Momentum';
  if (card?.score != null && card.score < 70) return 'Executive Review Required';
  if (gap.includes('efficiency') || gap.includes('savings')) return 'Improve Evidence Quality';
  return 'Maintain Momentum';
}

function projectRecommendation(health: AIHealthRow | undefined, fallback?: string) {
  if (fallback) return fallback;
  if (!health) return 'Review AI evidence';
  if (health.recommendation) return health.recommendation;
  const score = health.health_score;
  if (score != null && score < 70) return 'Executive Attention';
  if ((health.adoption_pct ?? 0) < 60) return 'Drive adoption';
  if (score != null && score >= 80) return 'Scale AI';
  return 'Optimize value';
}

/** Chart point label = adopt % only (release names live on axis / chips; roles on callouts). */
function ReleaseHealthLabel(props: {
  x?: number;
  y?: number;
  value?: number | string | null;
  index?: number;
  payload?: { release?: string; health?: number | null };
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const health = props.payload?.health;
  if (health == null || Number.isNaN(Number(health))) return null;
  return (
    <text x={x} y={y - 6} textAnchor="middle" fill="currentColor" fontSize={9.5} fontWeight={700} className="ai-p2-rel-label">
      {Math.round(Number(health))}
    </text>
  );
}

type RelCalloutRole = 'best' | 'worst' | 'now';

const REL_ROLE_LABEL: Record<RelCalloutRole, string> = {
  best: 'Best',
  worst: 'Worst',
  now: 'Now',
};

export function AIUtilizationPage2({
  data,
  project,
  onOpenRelease,
  onSelectEmployee,
  onBack,
}: {
  data: AIUtilizationKPIs;
  project: string;
  onOpenRelease: (release: string) => void;
  onSelectEmployee: (empNumber: number) => void;
  onBack: () => void;
}) {
  const [showTeam, setShowTeam] = useState(false);
  const relChartRef = React.useRef<HTMLDivElement>(null);
  const [relChartW, setRelChartW] = useState(0);

  const health = (data.health ?? []).find((row) => sameProject(row.project, project)) as AIHealthRow | undefined;
  const projectRisks = useMemo(
    () => (data.risks ?? []).filter((row) => sameProject(row.project, project)),
    [data.risks, project],
  );
  // #region agent log
  React.useEffect(() => {
    const rows = projectRisks.slice(0, 12).map((r) => ({
      person: r.person ?? null,
      type: r.type,
      severity: r.severity,
      empRaw: r.employee_number ?? null,
      empType: typeof r.employee_number,
      canOpen: typeof r.employee_number === 'number' && (r.employee_number as number) > 0,
      bandClass: BAND[bandOf(r.severity)],
    }));
    const canOpenN = rows.filter((r) => r.canOpen).length;
    const sevCounts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.severity] = (acc[r.severity] || 0) + 1;
      return acc;
    }, {});
    const body = JSON.stringify({
      sessionId: '6a418b',
      runId: 'p2-risk-chips',
      hypothesisId: 'H1',
      location: 'AIUtilizationPage2.tsx:projectRisks',
      message: 'Page2 risk chip openability + severity',
      data: {
        project,
        riskCount: projectRisks.length,
        canOpenN,
        closedN: rows.length - canOpenN,
        sevCounts,
        uniqueBandClasses: [...new Set(rows.map((r) => r.bandClass))],
        rows,
      },
      timestamp: Date.now(),
    });
    fetch('http://127.0.0.1:7896/ingest/a53d98a9-e463-4e07-91cc-72a241898446', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6a418b' },
      body,
    }).catch(() => {});
  }, [project, projectRisks]);
  // #endregion
  const useCases = useMemo(
    () => (data.use_case_matrix ?? []).filter((row) => sameProject(row.project, project)),
    [data.use_case_matrix, project],
  );
  const domains = useMemo(
    () => (data.dev_vs_qa ?? []).filter((row) => sameProject(row.project, project)),
    [data.dev_vs_qa, project],
  );
  /** Page 2 Release Intelligence — drilled project only (never portfolio-wide release_trend). */
  const trend = useMemo(() => {
    const scoped = (data.release_trend ?? []).filter((row) => sameProject(row.project, project));
    if (scoped.length > 0) {
      return [...scoped].sort((a, b) => a.sequence - b.sequence);
    }
    /* Fallback: project health.release_series (already project-keyed) — never unfiltered release_trend. */
    const series = health?.release_series ?? [];
    return series
      .map((pt) => ({
        project,
        release: pt.release,
        sequence: pt.sequence,
        adoption_pct: pt.adoption_pct,
        hours_saved: pt.hours_saved,
        roi_index: null as number | null,
        tokens: pt.tokens,
        has_evidence: pt.has_evidence,
      }))
      .sort((a, b) => a.sequence - b.sequence);
  }, [data.release_trend, project, health?.release_series]);
  const benchmark = useMemo(
    () => buildPortfolioBenchmark(data.health ?? [], project),
    [data.health, project],
  );
  const scorecards = useMemo(
    () => (data.manager_scorecard ?? []).filter((row) => sameProject(row.project, project)),
    [data.manager_scorecard, project],
  );
  const maturityAxes = useMemo(() => {
    const axes = (data.maturity_radar ?? []).find((row) => sameProject(row.project, project))?.axes ?? [];
    return axes
      .map((axis) => ({
        key: axis.axis,
        axis: QA_AXIS_ALIAS[axis.axis] || axis.axis,
        score: typeof axis.score === 'number' && !Number.isNaN(axis.score) ? axis.score : 0,
      }))
      .sort((a, b) => a.score - b.score);
  }, [data.maturity_radar, project]);
  React.useEffect(() => {
    const el = relChartRef.current;
    if (!el) return;
    const measure = () => setRelChartW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);
  const projRec = useMemo(
    () => (data.project_recommendations ?? []).find((row) => sameProject(row.project, project)),
    [data.project_recommendations, project],
  );
  // #region agent log
  React.useEffect(() => {
    const portfolioLen = (data.release_trend ?? []).length;
    const foreign = (data.release_trend ?? [])
      .filter((row) => sameProject(row.project, project) === false)
      .map((row) => row.release);
    const body = JSON.stringify({
      sessionId: '6a418b',
      runId: 'p2-release-scope',
      hypothesisId: 'REL1',
      location: 'AIUtilizationPage2.tsx:trend',
      message: 'Page2 release series scoped to drilled project',
      data: {
        pageProject: project,
        portfolioTrendLen: portfolioLen,
        scopedTrendLen: trend.length,
        scopedReleases: trend.map((r) => r.release),
        foreignSample: [...new Set(foreign)].slice(0, 8),
        expectScopedLtPortfolio: portfolioLen === 0 || trend.length <= portfolioLen,
        expectNoForeignInScoped: trend.every((r) => sameProject(r.project, project)),
      },
      timestamp: Date.now(),
    });
    fetch('http://127.0.0.1:7896/ingest/a53d98a9-e463-4e07-91cc-72a241898446', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6a418b' },
      body,
    }).catch(() => {});
  }, [project, trend, data.release_trend]);
  // #endregion

  const contributors = useMemo(() => {
    const seen = new Map<string, AIRiskCard>();
    for (const risk of projectRisks) {
      const key = String(risk.employee_number || risk.person || '').trim();
      if (!key || seen.has(key)) continue;
      seen.set(key, risk);
    }
    const valueOf = (risk: AIRiskCard) => {
      const raw = risk.values?.cost_usd ?? risk.values?.value_usd ?? risk.values?.hours_saved ?? risk.values?.hours;
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : 0;
    };
    return [...seen.values()].sort((a, b) => valueOf(b) - valueOf(a) || String(a.person || '').localeCompare(String(b.person || '')));
  }, [projectRisks]);
  const topTeam = contributors.slice(0, 3);

  const battle = useMemo(() => {
    const dev = domains.find((row) => row.domain === 'Development');
    const qa = domains.find((row) => row.domain === 'QA');
    const uc = (keys: string[]) => useCases.filter((item) => keys.includes(item.use_case_canonical));
    const sumCount = (keys: string[]) => uc(keys).reduce((s, i) => s + i.count, 0);
    const sumHours = (keys: string[]) => uc(keys).reduce((s, i) => s + i.hours_saved, 0);

    const devActive = dev?.users_active ?? 0;
    const qaActive = qa?.users_active ?? 0;
    const devEnabled = dev?.users_enabled ?? null;
    const qaEnabled = qa?.users_enabled ?? null;
    const devHours = dev?.hours_saved ?? 0;
    const qaHours = qa?.hours_saved ?? 0;
    const devValue = devHours * 40;
    const qaValue = qaHours * 40;

    const adopt = (active: number, enabled: number | null) =>
      enabled != null && enabled > 0 ? (active / enabled) * 100 : null;
    const util = (hours: number, enabled: number | null) =>
      enabled != null && enabled > 0 ? Math.min(100, (hours / Math.max(enabled * 8, 1)) * 100) : null;

    const qaCoverage = health?.qa_adoption_pct ?? (qaEnabled && qaEnabled > 0 ? adopt(qaActive, qaEnabled) : null);

    /* Aligned Dev | metric | QA rows — full list always visible (effectiveness + n/a extras). */
    const rows: { key: string; tip?: string; dev: string; qa: string }[] = [
      { key: 'Active Users', dev: fmt(devActive), qa: fmt(qaActive) },
      { key: 'Hours Saved', dev: fmt(devHours, 1), qa: fmt(qaHours, 1) },
      { key: 'Value Generated', dev: money(devValue), qa: money(qaValue) },
      { key: 'Adoption %', dev: pct(adopt(devActive, devEnabled)), qa: pct(adopt(qaActive, qaEnabled)) },
      { key: 'Utilization %', dev: pct(util(devHours, devEnabled)), qa: pct(util(qaHours, qaEnabled)) },
      {
        key: 'Primary Artifacts',
        tip: 'Dev: code generated · QA: test cases / design',
        dev: fmt(dev?.artifacts ?? sumCount(['Code generation'])),
        qa: fmt(qa?.artifacts ?? sumCount(['Unit testing', 'Test design'])),
      },
      {
        key: 'Secondary Assets',
        tip: 'Dev: documentation · QA: automation assets',
        dev: fmt(sumCount(['Docs'])),
        qa: fmt(sumCount(['Test automation'])),
      },
      {
        key: 'Defect Prevention',
        tip: 'QA defect-analysis hours (Dev n/a)',
        dev: 'n/a',
        qa: `${fmt(sumHours(['Defect analysis']), 1)} h`,
      },
      { key: 'Coverage %', tip: 'QA coverage (Dev n/a)', dev: 'n/a', qa: pct(qaCoverage) },
    ];

    const hasQa = !!qa && (qaActive > 0 || qaHours > 0 || (qaEnabled ?? 0) > 0);
    let conclusion: 'DEV LEADING' | 'QA LEADING' | 'BALANCED' | 'QA GAP' = 'BALANCED';
    if (!hasQa) conclusion = 'QA GAP';
    else {
      const ratio = qaValue <= 0 ? Infinity : devValue / Math.max(qaValue, 1);
      if (devValue === 0 && qaValue === 0) conclusion = 'BALANCED';
      else if (ratio > 1.15) conclusion = 'DEV LEADING';
      else if (ratio < 1 / 1.15) conclusion = 'QA LEADING';
      else conclusion = 'BALANCED';
    }
    const devArtifacts = typeof dev?.artifacts === 'number' ? dev.artifacts : sumCount(['Code generation']);
    const qaArtifacts = typeof qa?.artifacts === 'number' ? qa.artifacts : sumCount(['Unit testing', 'Test design']);
    const shareOf = (devN: number, qaN: number) => {
      if (!(devN > 0) && !(qaN > 0)) return null;
      const total = devN + qaN;
      return { devPct: (devN / total) * 100, qaPct: (qaN / total) * 100, devRaw: devN, qaRaw: qaN };
    };
    const valueShare = shareOf(devValue, qaValue);
    const hoursShare = shareOf(devHours, qaHours);
    const assetShare = shareOf(devArtifacts, qaArtifacts);
    const contribution: ContributionShare | null = valueShare
      ? { ...valueShare, basis: 'value' }
      : hoursShare
        ? { ...hoursShare, basis: 'hours' }
        : assetShare
          ? { ...assetShare, basis: 'assets' }
          : null;
    let recommend: string | null = null;
    if (!hasQa) {
      recommend = 'Increase QA participation — no QA evidence.';
    } else if (conclusion === 'DEV LEADING') {
      if (contribution?.basis === 'value') {
        recommend = `Increase QA participation — QA is ${fmt(contribution.qaPct, 0)}% of value.`;
      } else if (devActive > 0 || qaActive > 0) {
        recommend = `Increase QA participation — ${fmt(qaActive)} QA vs ${fmt(devActive)} Dev active.`;
      } else if (contribution) {
        recommend = `Increase QA participation — QA is ${fmt(contribution.qaPct, 0)}% of ${contribution.basis}.`;
      }
    }

    return { rows, hasQa, conclusion, devValue, qaValue, contribution, recommend };
  }, [domains, useCases, health?.qa_adoption_pct]);

  const effectiveness = useMemo(() => {
    const rows = EFFECTIVENESS.map((row) => {
      const parts = useCases.filter((item) => row.keys.includes(item.use_case_canonical));
      const count = parts.reduce((sum, item) => sum + item.count, 0);
      const hours = parts.reduce((sum, item) => sum + item.hours_saved, 0);
      const value = parts.reduce((sum, item) => sum + (item.value_usd || 0), 0);
      const adopt = parts.reduce((sum, item) => sum + (item.adoption_pct || 0), 0) / (parts.length || 1);
      const gain = parts.find((item) => item.productivity_gain_pct != null)?.productivity_gain_pct ?? null;
      const impact = parts.sort((a, b) => b.hours_saved - a.hours_saved)[0]?.business_impact || (count ? 'Low' : 'n/a');
      const roi = parts.find((item) => item.roi_index != null)?.roi_index ?? (hours ? value / Math.max(hours, 1) : null);
      return { label: row.label, count, hours, gain, impact, roi, value, adopt };
    });
    const ranked = [...rows].sort((a, b) => (b.value || 0) - (a.value || 0) || b.hours - a.hours);
    const active = ranked.filter((r) => r.count > 0);
    const tagFor = new Map<string, string>();
    const pick = (list: typeof active, score: (r: (typeof active)[0]) => number, tag: string) => {
      const hit = [...list].sort((a, b) => score(b) - score(a))[0];
      if (hit && !tagFor.has(hit.label)) tagFor.set(hit.label, tag);
    };
    pick(active, (r) => r.value || 0, 'Highest ROI');
    pick(active, (r) => r.count, 'Most Adopted');
    pick(active.filter((r) => r.gain != null), (r) => r.gain ?? 0, 'Fastest Growing');
    pick(active.filter((r) => r.count > 0 && r.hours < 2), (r) => r.count, 'Underutilized');
    const lowest = [...active].sort((a, b) => (a.value || 0) - (b.value || 0))[0];
    if (lowest && !tagFor.has(lowest.label) && active.length > 1) tagFor.set(lowest.label, 'Lowest ROI');

    return ranked.map((row, index) => {
      const tag = tagFor.get(row.label) || null;
      let rec = 'Monitor';
      if (tag === 'Highest ROI' || tag === 'Fastest Growing') rec = 'Scale';
      else if (tag === 'Most Adopted') rec = 'Sustain';
      else if (tag === 'Underutilized') rec = 'Activate';
      else if (tag === 'Lowest ROI') rec = 'Review';
      else if (row.count === 0) rec = 'Pilot';
      const trend = row.gain == null ? '▬' : row.gain >= 5 ? `▲ ${fmt(row.gain, 0)}%` : row.gain <= -5 ? `▼ ${fmt(row.gain, 0)}%` : `▬ ${fmt(row.gain, 0)}%`;
      return { ...row, rank: index + 1, tag, rec, trend };
    });
  }, [useCases]);

  /* Full ranked list by Value (active first, then zero-usage); Usage · Hours · Trend always shown. */
  const ucStrip = useMemo(() => {
    const active = effectiveness.filter((r) => r.count > 0);
    const empty = effectiveness.filter((r) => r.count === 0);
    let slot = 0;
    const rows = [
      ...active.map((row) => {
        const rowSlot = slot++;
        return { ...row, displayRank: rowSlot + 1, isEmpty: false };
      }),
      ...empty.map((row) => ({ ...row, displayRank: row.rank, isEmpty: true })),
    ];
    const valueMax = Math.max(...active.map((r) => r.value || 0), 1);
    return { rows, valueMax };
  }, [effectiveness]);
  const card = scorecards.find((row) => row.manager && health?.manager && row.manager === health.manager) || scorecards[0];
  const mgrRec = managementRecommendation(card, health);
  const delta = health?.trend_pts;
  const deltaBand = delta == null ? 'neutral' : delta >= 0 ? 'green' : delta > -5 ? 'amber' : 'red';
  const maturity = health?.maturity_level ?? 1;
  const nextMaturity = projRec?.next_maturity_level ?? Math.min(5, maturity + 1);
  const maturityTarget = maturityTargetFor(nextMaturity);
  const maturityScore = maturityAxes.length
    ? maturityAxes.reduce((acc, row) => acc + row.score, 0) / maturityAxes.length
    : null;
  const maturityGap =
    maturityScore == null ? null : Math.max(0, maturityTarget - maturityScore);
  const maturityReadiness =
    maturityScore == null || maturityTarget <= 0
      ? null
      : Math.min(100, (maturityScore / maturityTarget) * 100);
  const maturityTrack = maturityStatus(maturityReadiness, maturityGap);
  const weakestAxis = maturityAxes[0] ?? null;
  const belowTarget = maturityAxes.filter((axis) => axis.score < maturityTarget);
  const topConstraints = belowTarget.slice(0, 2);
  const atTopLevel = nextMaturity <= maturity;
  const maturityGapWords = (() => {
    if (maturityGap == null) return 'Capability scores not available';
    const ready = maturityReadiness != null ? ` · ${fmt(maturityReadiness, 0)}% ready` : '';
    if (maturityGap <= 0) return `Target met${ready}`;
    return atTopLevel
      ? `${fmt(maturityGap, 0)} pts to hold the L${maturity} target${ready}`
      : `${fmt(maturityGap, 0)} pts to reach L${nextMaturity}${ready}`;
  })();
  const maturityRec = (() => {
    const bullets = (projRec?.bullets ?? []).filter(Boolean);
    const fromGap = bullets.find((b) => {
      const t = b.toLowerCase();
      return (
        t.includes('qa') ||
        t.includes('maturity') ||
        t.includes('evidence') ||
        (weakestAxis != null && t.includes(weakestAxis.axis.toLowerCase().split(' ')[0]))
      );
    });
    if (fromGap) return fromGap;
    if (weakestAxis) {
      const need = Math.max(0, Math.round(maturityTarget - weakestAxis.score));
      return `Raise ${weakestAxis.axis} by ~${need} pts to unlock L${nextMaturity} ${MATURITY_LABEL[nextMaturity] || ''}`.trim();
    }
    return projRec?.recommendation || 'Advance QA maturity next release.';
  })();
  const maturityInsight = (() => {
    const levelLabel = MATURITY_LABEL[maturity] || 'current';
    const nextLabel = MATURITY_LABEL[nextMaturity] || 'next';
    if (!weakestAxis || maturityScore == null) {
      return `Still at L${maturity} ${levelLabel} — capability scores not yet available to chart the path to L${nextMaturity}.`;
    }
    const blockers = maturityAxes
      .filter((a) => a.score < maturityTarget)
      .slice(0, 2)
      .map((a) => a.axis);
    const blockText = blockers.length ? blockers.join(' and ') : weakestAxis.axis;
    return `Still at L${maturity} ${levelLabel} because ${blockText} sit below the L${nextMaturity} bar. Closing those gaps moves the program toward ${nextLabel}.`;
  })();
  const timeline = trend.map((row, index, arr) => {
    const prev = index > 0 ? arr[index - 1] : null;
    /* Calm chips by default. Bang only true anomalies — not early low adoption
       and not healthy growth to the current release (hours rising with adoption). */
    const evidenceGap = row.has_evidence === false;
    const healthDrop =
      prev?.adoption_pct != null &&
      row.adoption_pct != null &&
      prev.adoption_pct - row.adoption_pct >= 15;
    return {
      ...row,
      value: (row.hours_saved || 0) * 40,
      health: row.adoption_pct,
      anomaly: evidenceGap || healthDrop,
    };
  });
  const bestRelease = [...timeline].sort((a, b) => (b.health ?? b.hours_saved) - (a.health ?? a.hours_saved))[0];
  const worstRelease = [...timeline].sort((a, b) => (a.health ?? a.hours_saved) - (b.health ?? b.hours_saved))[0];
  const currentRelease = timeline[timeline.length - 1];
  /** One tile per release among Best/Worst/Now — merge when Now equals Best or Worst. */
  const releaseCallouts = (() => {
    const rolesByRelease = new Map<string, Set<RelCalloutRole>>();
    const rowByRelease = new Map<string, (typeof timeline)[number]>();
    const add = (role: RelCalloutRole, row: (typeof timeline)[number] | undefined) => {
      if (!row?.release) return;
      rowByRelease.set(row.release, row);
      const set = rolesByRelease.get(row.release) ?? new Set<RelCalloutRole>();
      set.add(role);
      rolesByRelease.set(row.release, set);
    };
    add('best', bestRelease);
    add('worst', worstRelease);
    add('now', currentRelease);
    const order: string[] = [];
    for (const row of [bestRelease, worstRelease, currentRelease]) {
      if (row?.release && !order.includes(row.release)) order.push(row.release);
    }
    return order.map((key) => {
      const roles = [...(rolesByRelease.get(key) ?? [])];
      const ranked = (['best', 'worst', 'now'] as RelCalloutRole[]).filter((r) => roles.includes(r));
      return { key, row: rowByRelease.get(key)!, roles: ranked };
    });
  })();
  /** VP-safe delta: % from a tiny baseline (e.g. 14→68) becomes +386% and misleads — switch to pts. */
  const releaseDeltaLabel = (
    from: number | null | undefined,
    to: number | null | undefined,
    prefix: string,
  ): { text: string; positive: boolean } | null => {
    if (from == null || to == null || Number.isNaN(from) || Number.isNaN(to)) return null;
    const pts = to - from;
    if (Math.abs(from) < 20) {
      return { text: `${prefix} ${pts > 0 ? '+' : ''}${fmt(pts, 0)} pts`, positive: pts >= 0 };
    }
    const pctChange = (pts / Math.abs(from)) * 100;
    if (Math.abs(pctChange) > 150) {
      return { text: `${prefix} ${pts > 0 ? '+' : ''}${fmt(pts, 0)} pts`, positive: pts >= 0 };
    }
    return { text: `${prefix} ${pctChange > 0 ? '+' : ''}${fmt(pctChange, 0)}%`, positive: pctChange >= 0 };
  };
  const firstHealth = timeline[0]?.health ?? null;
  const lastHealth = currentRelease?.health ?? null;
  const worstHealth = worstRelease?.health ?? null;
  const bestHealth = bestRelease?.health ?? null;
  const trendDelta = releaseDeltaLabel(firstHealth, lastHealth, 'Trend');
  const improveDelta = releaseDeltaLabel(worstHealth, bestHealth, 'Improve');
  /** Action line only — do not restate Best/Worst/Now names or adopt already on callouts. */
  const releaseInsight = (() => {
    if (!timeline.length) return 'No release evidence for this project yet.';
    if (currentRelease && worstRelease && currentRelease.release === worstRelease.release && timeline.length > 1) {
      return 'Trough release — close the evidence gap before the next ship.';
    }
    if (currentRelease?.anomaly) {
      return currentRelease.has_evidence === false
        ? 'Flagged — missing quantified evidence vs prior.'
        : 'Flagged — adoption dropped ≥15 pts vs prior.';
    }
    if (trendDelta && !trendDelta.positive && currentRelease) {
      return 'Adoption softened — coach inactive seats before the next release.';
    }
    if (bestRelease && currentRelease && bestRelease.release === currentRelease.release && trendDelta?.positive) {
      return 'At the peak — lock in what worked and scale it next release.';
    }
    if (improveDelta && bestRelease && worstRelease && bestRelease.release !== worstRelease.release) {
      return 'Replicate the peak playbook into the trough.';
    }
    return 'Click a release for deep dive.';
  })();

  const adoption = useMemo(() => {
    const stages = adoptionStages(health, domains, contributors.length);
    const bars = funnelBars(stages);
    const contributorsStage = stages.find((stage) => stage.key === 'contributors') ?? null;
    const drops = bars.map((stage, index) => (
      index === 0 ? null : adoptionDrop(bars[index - 1].count, stage.count)
    ));
    let leakAt = -1;
    let bestDrop = 0;
    let bestAbs = 0;
    drops.forEach((drop, index) => {
      if (drop == null || drop <= 0) return;
      const prev = bars[index - 1].count ?? 0;
      const abs = prev - (bars[index].count ?? 0);
      if (drop > bestDrop + 1e-9 || (Math.abs(drop - bestDrop) < 1e-9 && abs > bestAbs)) {
        leakAt = index;
        bestDrop = drop;
        bestAbs = abs;
      }
    });
    const insight = leakAt < 0
      ? 'No adoption drop between these stages.'
      : `Biggest drop is ${bars[leakAt - 1].label} → ${bars[leakAt].label}: ${fmt(bars[leakAt - 1].count)} to ${fmt(bars[leakAt].count)}`;
    const max = Math.max(...bars.map((stage) => stage.count ?? 0), 1);
    return { bars, drops, leakAt, insight, max, contributors: contributorsStage };
  }, [health, domains, contributors.length]);
  const executiveInsight = (() => {
    const lines: { role: string; text: string }[] = [];
    if (health?.health_score != null) {
      const band = health.band_label || health.band || 'Unbanded';
      const trendBit = delta == null
        ? ''
        : delta > 0
          ? `, up ${fmt(delta, 0)} pts`
          : delta < 0
            ? `, down ${fmt(Math.abs(delta), 0)} pts`
            : ', flat vs prior';
      lines.push({ role: 'Situation', text: `${project} is ${band} at ${fmt(health.health_score, 0)}${trendBit}.` });
    }
    const valued = effectiveness.filter((row) => (row.value || 0) > 0);
    if (valued[0]) {
      const lead = `${valued[0].label} ${money(valued[0].value)}`;
      lines.push({
        role: 'Value',
        text: valued[1]
          ? `Top value: ${lead}, ${valued[1].label} ${money(valued[1].value)}.`
          : `Top value: ${lead}.`,
      });
    }
    if (weakestAxis) {
      lines.push({
        role: 'Maturity',
        text: `Blocker: ${weakestAxis.axis} at ${fmt(weakestAxis.score, 0)} vs L${nextMaturity} target ${maturityTarget}.`,
      });
    }
    if (health?.unrealized_value_usd != null && health.unrealized_value_usd > 0) {
      lines.push({ role: 'Recover', text: `Recover ${money(health.unrealized_value_usd)} unrealized value.` });
    } else if (health?.unrealized_value_usd === 0) {
      lines.push({ role: 'Recover', text: 'No unrealized value against current potential.' });
    }
    return lines.slice(0, 4);
  })();
  const relStep = (() => {
    const n = timeline.length;
    if (n <= 2) return 1;
    const slot = relChartW > 0 && relChartW < 420 ? 68 : 54;
    const width = relChartW || 360;
    const fit = Math.max(2, Math.floor(width / slot));
    if (n <= fit) return 1;
    return Math.ceil(n / fit);
  })();
  const showPointLabels = relChartW >= 560;
  /* Adoption axis stops just above the tallest point so the plot uses the card height. */
  const relAdoptCeil = (() => {
    const peak = Math.max(0, ...timeline.map((row) => row.health ?? 0));
    return Math.min(100, Math.max(20, Math.ceil((peak * 1.15) / 10) * 10));
  })();

  const conclusionBand =
    battle.conclusion === 'DEV LEADING' ? 'amber' : battle.conclusion === 'QA LEADING' ? 'green' : battle.conclusion === 'QA GAP' ? 'red' : 'neutral';

  const tagBand = (tag: string | null): Band => {
    if (!tag) return 'neutral';
    if (tag === 'Highest ROI' || tag === 'Fastest Growing') return 'green';
    if (tag === 'Most Adopted') return 'neutral';
    if (tag === 'Underutilized' || tag === 'Lowest ROI') return 'amber';
    return 'neutral';
  };
  const recBand = (rec: string): Band => {
    if (rec === 'Scale' || rec === 'Activate') return 'green';
    if (rec === 'Review' || rec === 'Pilot') return 'amber';
    return 'neutral';
  };

  return (
    <div className="ai-p2 h-full min-h-0 min-w-0 overflow-hidden" data-ai-p2-root>
      {/* Compact health command. Collapsed = two lines. View Team reveals the top 3 only. */}
      <section className="glass-panel rounded-xl ai-p2-head min-w-0 shrink-0" data-ai-p2-head>
        <div className="ai-p2-head-row1">
          <button type="button" className="ai-crumb shrink-0" onClick={onBack} aria-label="Back to portfolio">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <nav className="ai-p2-head-crumb shrink-0" aria-label="AI use breadcrumb">
            <button type="button" className="ai-crumb" onClick={onBack}>AI use</button>
            <span className="ai-p2-head-sep" aria-hidden="true">›</span>
            <span className="ai-crumb is-on">{project}</span>
          </nav>
          <ScoreRing score={health?.health_score ?? null} band={health?.band || 'neutral'} />
          <div
            className="ai-p2-head-identity min-w-0"
            title={health?.teams?.length ? health.teams.slice(0, 3).join(' · ') : undefined}
          >
            <b className="ai-p2-head-project">{project}</b>
          </div>
          <span className={`ai-chip shrink-0 ${BAND[bandOf(health?.band)]}`}>{health?.band_label || health?.band || 'n/a'}</span>
          <span className={`ai-chip shrink-0 ${BAND[deltaBand]}`}>
            {delta == null ? 'Trend n/a' : `${delta > 0 ? '+' : ''}${fmt(delta, 0)} pts`}
          </span>
          <span className="ai-p2-head-kpis" aria-label="Value, recoverable, and risk count">
            <span className="ai-p2-head-kpi">
              <span className="ai-p2-head-kpi-k">Value</span>
              <b>{money(health?.value_usd ?? health?.ai_value_usd)}</b>
            </span>
            <span className="ai-p2-head-kpi">
              <span className="ai-p2-head-kpi-k">Recoverable</span>
              <b>{money(health?.unrealized_value_usd)}</b>
            </span>
            <span className="ai-p2-head-kpi ai-p2-head-risk">
              <span className="ai-p2-head-kpi-k">Risks</span>
              <b>{health?.risk_count ?? projectRisks.length}</b>
            </span>
          </span>
        </div>
        <div className="ai-p2-head-row2">
          <span className="ai-p2-head-meta" title={health?.manager || undefined}>
            Manager {oneManager(health?.manager)}
          </span>
          <span className="ai-p2-head-contrib shrink-0" aria-label="Contributors">
            <span className="ai-p2-head-contrib-text">Contributors: {contributors.length}</span>
            {contributors.length > 0 && (
              <button type="button" className="ai-crumb ai-p2-head-team-toggle" onClick={() => setShowTeam((v) => !v)}>
                {showTeam ? 'Hide Team' : 'View Team →'}
              </button>
            )}
          </span>
        </div>
        {showTeam && topTeam.length > 0 && (
          <div className="ai-p2-head-team" aria-label="Top 3 contributors">
            {topTeam.map((risk) => (
              <RiskPersonChip key={`${risk.type}-${risk.person}-${risk.employee_number}`} risk={risk} onSelectEmployee={onSelectEmployee} />
            ))}
          </div>
        )}
      </section>

      <div className="ai-p2-mid">
        <section className="glass-panel rounded-xl ai-p2-card min-h-0 min-w-0">
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Dev vs QA battle</span>
            <span className={`ai-chip shrink-0 ${BAND[conclusionBand]}`} title="Battle outcome">{battle.conclusion}</span>
          </div>
          <div
            className="ai-battle-compare min-h-0"
            data-battle-compare
            style={{ '--p2-rows': Math.max(1, battle.rows.length) } as React.CSSProperties}
          >
            <div className="ai-battle-axis" aria-hidden="true">
              <span className="ai-battle-axis-dev">Dev</span>
              <span className="ai-battle-axis-key" />
              <span className="ai-battle-axis-qa">QA</span>
            </div>
            {battle.rows.map((row) => (
              <span key={row.key} className="ai-battle-row" title={row.tip}>
                <b className="ai-battle-val is-dev">{row.dev}</b>
                <span className="ai-battle-key">{row.key}</span>
                <b className="ai-battle-val is-qa">{row.qa}</b>
              </span>
            ))}
          </div>
          <div className="ai-battle-foot">
            <ContributionDonut contribution={battle.contribution} />
            {(battle.recommend || mgrRec) && (
              <p className="ai-battle-rec" title={battle.recommend || mgrRec}>{battle.recommend || mgrRec}</p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-xl ai-p2-card min-h-0 min-w-0">
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Use case effectiveness</span>
          </div>
          <div
            className="ai-uc-strip min-h-0"
            data-uc-strip
            style={{ '--p2-rows': Math.max(1, ucStrip.rows.length) } as React.CSSProperties}
          >
            <div className="ai-uc-axis" aria-hidden="true">
              <span className="ai-uc-axis-rank">#</span>
              <span className="ai-uc-axis-name">Use case</span>
              <span className="ai-uc-axis-num">Usage</span>
              <span className="ai-uc-axis-num">Hours</span>
              <span className="ai-uc-axis-trend">Trend</span>
              <span className="ai-uc-axis-num">Value</span>
              <span className="ai-uc-axis-rec">Rec</span>
            </div>
            {ucStrip.rows.map((row) => {
              const barPct = row.count
                ? Math.max(0, Math.min(100, Math.round(((row.value || 0) / ucStrip.valueMax) * 100)))
                : 0;
              return (
                <span
                  key={row.label}
                  className={`ai-uc-row${row.tag === 'Highest ROI' || row.tag === 'Fastest Growing' || row.rec === 'Scale' ? ' is-emphasis' : ''}`}
                  style={{ '--uc-bar': `${barPct}%` } as React.CSSProperties}
                  title={row.tag ? `${row.label} · ${row.tag}` : row.label}
                >
                  <b className="ai-uc-rank">{row.isEmpty ? '·' : row.displayRank}</b>
                  <span className="ai-uc-name">
                    <span className="ai-uc-label">{row.label}</span>
                    {row.tag && <span className={`ai-chip ${BAND[tagBand(row.tag)]}`}>{row.tag}</span>}
                  </span>
                  <span className="ai-uc-num">{row.count || '—'}</span>
                  <span className="ai-uc-num">{row.count ? fmt(row.hours, 1) : '—'}</span>
                  <span className="ai-uc-trend">{row.count ? row.trend : '—'}</span>
                  <span className="ai-uc-num ai-uc-value">{row.count ? money(row.value) : 'n/a'}</span>
                  <span className="ai-uc-rec">
                    <span className={`ai-chip ${BAND[recBand(row.rec)]}`} title={row.rec === 'Scale' ? 'Recommended Scale' : row.rec}>{row.rec}</span>
                  </span>
                </span>
              );
            })}
            {ucStrip.rows.length === 0 && (
              <p className="ai-p2-empty">No use case rows for this project.</p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-xl ai-p2-card ai-p2-rel min-h-0 min-w-0" data-rel-panel>
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Release journey</span>
            <div className="ai-p2-rel-head-meta min-w-0">
              <span
                className="ai-p2-rel-meta"
                title={`${project} · ${timeline.length} release${timeline.length === 1 ? '' : 's'} · sequence order`}
              >
                {project} · {timeline.length}
              </span>
              <div className="ai-p2-rel-deltas">
                {improveDelta && <span className="ai-chip">{improveDelta.text}</span>}
                {trendDelta && (
                  <span className={`ai-chip ${BAND[trendDelta.positive ? 'green' : 'red']}`}>
                    {trendDelta.text}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div
            className="ai-p2-rel-body"
            style={{ '--rel-chart-max': relChartW > 0 ? `${Math.round(relChartW / 1.15)}px` : undefined } as React.CSSProperties}
          >
            <div
              className="ai-p2-rel-callouts"
              aria-label="Best worst and current release"
              style={{ gridTemplateColumns: `repeat(${Math.max(releaseCallouts.length, 1)}, minmax(0, 1fr))` }}
            >
              {releaseCallouts.map((c) => {
                const eyebrow = c.roles.map((r) => REL_ROLE_LABEL[r]).join(' · ');
                const roleClass = c.roles.map((r) => `is-${r}`).join(' ');
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={`ai-p2-rel-callout ${roleClass}`}
                    onClick={() => onOpenRelease(c.row.release)}
                    title={`${eyebrow} · ${c.row.release}`}
                  >
                    <span className="ai-p2-eyebrow">{eyebrow}</span>
                    <span className="ai-p2-rel-callout-name">{c.row.release}</span>
                    <span className="ai-p2-rel-callout-meta">
                      {c.row.health != null ? `${fmt(c.row.health, 0)} adopt` : 'n/a'}
                      {` · ${fmt(c.row.hours_saved, 0)} h`}
                    </span>
                  </button>
                );
              })}
              {releaseCallouts.length === 0 && (
                <div className="ai-p2-rel-callout is-now" aria-disabled>
                  <span className="ai-p2-eyebrow">Now</span>
                  <span className="ai-p2-rel-callout-name">—</span>
                  <span className="ai-p2-rel-callout-meta">n/a</span>
                </div>
              )}
            </div>
            <div className="ai-p2-rel-chart flex-1 min-h-0" ref={relChartRef}>
              {timeline.length === 0 ? (
                <p className="ai-p2-empty">No releases for this project.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeline} margin={{ top: showPointLabels ? 12 : 6, right: 8, left: 2, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis
                      dataKey="release"
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                      height={16}
                      tick={(props) => {
                        const index = Number(props.index ?? 0);
                        const last = timeline.length - 1;
                        const show = index === 0 || index === last || (index % relStep === 0 && last - index >= relStep);
                        if (!show) return <g />;
                        const anchor = index === 0 ? 'start' : index === last ? 'end' : 'middle';
                        return (
                          <text
                            x={Number(props.x ?? 0)}
                            y={Number(props.y ?? 0) + 3}
                            textAnchor={anchor}
                            fill="currentColor"
                            fontSize={9.5}
                            fontWeight={650}
                          >
                            {String(props.payload?.value ?? '')}
                          </text>
                        );
                      }}
                    />
                    <YAxis yAxisId="left" hide domain={[0, relAdoptCeil]} />
                    <YAxis yAxisId="hours" hide domain={[0, 'dataMax']} />
                    <YAxis yAxisId="value" hide domain={[0, 'dataMax']} />
                    <Tooltip />
                    {currentRelease?.release && (
                      <ReferenceLine
                        yAxisId="left"
                        x={currentRelease.release}
                        stroke="currentColor"
                        strokeOpacity={0.35}
                        strokeDasharray="3 3"
                      />
                    )}
                    <Area yAxisId="hours" type="monotone" dataKey="hours_saved" fill="#0d948828" stroke="#0d9488" strokeWidth={1.25} name="Hours" />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="adoption_pct"
                      stroke="#0284c7"
                      strokeWidth={2}
                      name="Adoption %"
                      dot={{ r: 2.5, onClick: (state) => {
                        const payload = (state as { payload?: AIReleaseTrendRow } | undefined)?.payload;
                        if (payload?.release) onOpenRelease(payload.release);
                      } }}
                    >
                      {showPointLabels ? <LabelList dataKey="health" content={ReleaseHealthLabel} /> : null}
                    </Line>
                    <Line yAxisId="value" type="monotone" dataKey="value" stroke="#047857" strokeDasharray="4 3" strokeWidth={1.25} dot={false} name="Value $" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="ai-p2-rel-insight" title={releaseInsight}>{releaseInsight}</p>
            <div className="ai-p2-rel-chips" aria-label="Open release">
              {timeline.map((row) => (
                <button
                  key={row.release}
                  type="button"
                  className={`ai-chip ${row.anomaly ? BAND.amber : ''} ${row.release === currentRelease?.release ? 'is-current' : ''} ${row.release === bestRelease?.release ? 'is-best' : ''} ${row.release === worstRelease?.release && worstRelease?.release !== bestRelease?.release ? 'is-worst' : ''}`}
                  onClick={() => onOpenRelease(row.release)}
                  title={
                    row.anomaly
                      ? `Open ${row.release} · anomaly · ${row.health == null ? 'n/a' : `${fmt(row.health, 0)} adopt`}`
                      : `Open ${row.release}${row.health == null ? '' : ` · ${fmt(row.health, 0)} adopt`}`
                  }
                >
                  {row.release}
                  {row.anomaly ? ' !' : ''}
                </button>
              ))}
              {timeline.length === 0 && <span className="ai-p2-empty">No release chips.</span>}
            </div>
          </div>
        </section>

      </div>

      <div className="ai-p2-low ai-p2-low-3">
        <section
          className="glass-panel rounded-xl ai-p2-card ai-p2-mgr min-h-0 min-w-0"
          data-ai-p2-benchmark
          title={benchmark?.title}
          aria-label={benchmark ? `Portfolio benchmark. ${benchmark.title}` : 'Portfolio benchmark'}
        >
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Portfolio benchmark</span>
            {benchmark?.status && (
              <span
                className={`ai-chip ${BAND[benchmark.status.tone]}`}
                data-benchmark-status={benchmark.status.label}
              >
                {benchmark.status.label}
              </span>
            )}
          </div>
          {benchmark ? (
            <div className="ai-p2-mgr-body">
              <div className="ai-p2-mgr-hero">
                <p
                  className="ai-p2-mgr-rank"
                  data-tone={benchmark.rankTone}
                  data-benchmark-rank={benchmark.rank}
                  data-benchmark-total={benchmark.total}
                >
                  <b>#{benchmark.rank}</b>
                  <span>of {benchmark.total}</span>
                </p>
                <p className="ai-p2-mgr-health" data-benchmark-health={benchmark.health}>
                  <i className="ai-p2-mgr-dot" data-tone={benchmark.healthTone} aria-hidden="true" />
                  <b data-tone={benchmark.healthTone}>{fmt(benchmark.health, 1)}</b>
                  <span>Health</span>
                </p>
                <span
                  className="ai-p2-mgr-vpu"
                  data-tone={benchmark.valueTone || undefined}
                  data-benchmark-vpu={benchmark.valuePerUser ?? ''}
                  data-benchmark-vpu-delta={benchmark.valueDeltaPct ?? ''}
                >
                  {benchmark.valuePerUser == null
                    ? 'Value/user n/a'
                    : `${money(benchmark.valuePerUser)}/user${benchmark.valueDeltaPct == null ? '' : ` ${vsAverageLabel(benchmark.valueDeltaPct)}`}`}
                </span>
              </div>
              {(() => {
                const span = benchmark.scale.hi - benchmark.scale.lo;
                const at = (score: number) => `${Math.max(0, Math.min(100, ((score - benchmark.scale.lo) / span) * 100))}%`;
                const bandLeft = Math.max(0, Math.min(100, ((benchmark.bottomQuartile - benchmark.scale.lo) / span) * 100));
                const bandRight = Math.max(0, Math.min(100, ((benchmark.topQuartile - benchmark.scale.lo) / span) * 100));
                return (
                  <div
                    className="ai-p2-mgr-range"
                    role="img"
                    aria-label="This project against the portfolio: bottom quartile, average, and top quartile"
                  >
                    <span className="ai-p2-mgr-range-track">
                      <span
                        className="ai-p2-mgr-range-band"
                        style={{ left: `${bandLeft}%`, width: `${Math.max(0.5, bandRight - bandLeft)}%` }}
                      />
                      <span className="ai-p2-mgr-range-avg" style={{ left: at(benchmark.average) }} />
                      <span className="ai-p2-mgr-range-me" data-tone={benchmark.healthTone} style={{ left: at(benchmark.health) }} />
                    </span>
                  </div>
                );
              })()}
              <div className="ai-p2-mgr-metrics">
                <span>Bottom quartile <b data-benchmark-bottom={benchmark.bottomQuartile}>{fmt(benchmark.bottomQuartile, 1)}</b></span>
                <span>Portfolio avg <b data-benchmark-average={benchmark.average}>{fmt(benchmark.average, 1)}</b></span>
                <span>Top quartile <b data-benchmark-top={benchmark.topQuartile}>{fmt(benchmark.topQuartile, 1)}</b></span>
              </div>
            </div>
          ) : (
            <p className="ai-p2-empty">No health score for this project.</p>
          )}
        </section>

        <section className="glass-panel rounded-xl ai-p2-card ai-p2-qa min-h-0 min-w-0">
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <div className="ai-p2-qa-head-titles min-w-0">
              <span className="ai-p2-card-title">QA maturity</span>
              <span className="ai-p2-card-sub">
                Bar = score, line = L{nextMaturity} target ({maturityTarget})
              </span>
            </div>
            <span className={`ai-chip shrink-0 ${BAND[maturityTrack.band]}`} title="Maturity trajectory">
              {maturityTrack.label}
            </span>
          </div>
          <div className="ai-p2-qa-body">
            <div className="ai-p2-qa-journey" aria-label="Maturity level">
              <div className="ai-p2-qa-step is-current" data-qa-step="current">
                <span className="ai-p2-qa-step-name">L{maturity} {MATURITY_LABEL[maturity] || ''}</span>
                <span className="ai-p2-qa-step-tag">You are here</span>
              </div>
              <div className="ai-p2-qa-progress">
                <span className="ai-p2-qa-score-line">
                  <span className="ai-p2-qa-score">
                    {maturityScore == null ? 'n/a' : fmt(maturityScore, 0)}
                    <span> of {maturityTarget}</span>
                  </span>
                  <span className="ai-p2-qa-meta">{maturityGapWords}</span>
                </span>
                {!atTopLevel && (
                  <span className="ai-p2-qa-step-link" aria-hidden="true">
                    <i style={{ width: `${maturityReadiness == null ? 0 : Math.max(0, Math.min(100, maturityReadiness))}%` }} />
                  </span>
                )}
              </div>
              {!atTopLevel && (
                <div className="ai-p2-qa-step is-next" data-qa-step="next">
                  <span className="ai-p2-qa-step-name">L{nextMaturity} {MATURITY_LABEL[nextMaturity] || ''}</span>
                  <span className="ai-p2-qa-step-tag">Target</span>
                </div>
              )}
            </div>

            <div className="ai-p2-qa-caps" aria-label="Capabilities, weakest first">
              {maturityAxes.length === 0 && (
                <p className="ai-p2-empty">No maturity axis scores for this project.</p>
              )}
              {maturityAxes.map((row) => {
                const status = capabilityStatus(row.score, maturityTarget);
                return (
                  <div
                    key={row.key}
                    className="ai-p2-qa-cap"
                    data-band={status.band}
                    title={`${row.axis} ${fmt(row.score, 0)} of ${maturityTarget} · ${status.label}`}
                  >
                    <span className="ai-p2-qa-cap-name">{row.axis}</span>
                    <span className="ai-p2-qa-cap-score">{fmt(row.score, 0)}</span>
                    <QaTargetBar score={row.score} target={maturityTarget} band={status.band} label={`${row.axis} ${fmt(row.score, 0)} of ${maturityTarget}`} />
                    <span className="ai-p2-qa-cap-status">{status.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="ai-p2-qa-decision" data-qa-decision title={maturityInsight}>
              {maturityAxes.length > 0 && (
                <>
                  <span className="ai-p2-eyebrow">Blocker</span>
                  <div className="ai-p2-qa-constraints">
                    {topConstraints.length === 0 && (
                      <span className="ai-p2-qa-none">None — every capability is at target</span>
                    )}
                    {topConstraints.map((axis) => (
                      <span
                        key={axis.key}
                        className={`ai-chip ${BAND[capabilityStatus(axis.score, maturityTarget).band]}`}
                        title={`${axis.axis} · ${fmt(axis.score, 0)} of ${maturityTarget} · ${axisImpact(axis.axis)}`}
                      >
                        {axis.axis}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <span className="ai-p2-eyebrow">Next action</span>
              <p className="ai-p2-qa-rec-text" title={maturityRec}>{maturityRec}</p>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-xl ai-p2-card min-h-0 min-w-0 ai-p2-adopt-card" data-ai-p2-funnel>
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">AI adoption funnel</span>
          </div>
          <div className="ai-p2-adopt" aria-label="AI adoption funnel">
            {adoption.bars.map((stage, index) => {
              const drop = adoption.drops[index];
              const leak = index === adoption.leakAt;
              const width = stage.count != null && stage.count > 0
                ? Math.max(4, (stage.count / adoption.max) * 100)
                : 0;
              return (
                <div
                  key={stage.key}
                  className={`ai-p2-adopt-row${leak ? ' is-leak' : ''}`}
                  data-funnel-stage={stage.key}
                  data-funnel-count={stage.count == null ? 'n/a' : String(stage.count)}
                  data-funnel-drop={index === 0 ? '' : (drop == null ? 'n/a' : fmtDrop(drop))}
                  data-largest-drop={leak ? 'true' : 'false'}
                >
                  <span className="ai-p2-adopt-label" title={stage.key === 'enabled' ? 'AI enabled' : stage.key === 'active' ? 'Active users' : stage.label}>
                    {stage.label}
                  </span>
                  <span className="ai-p2-adopt-line">
                    <b className="ai-p2-adopt-count">{fmt(stage.count)}</b>
                    {index > 0 && <span className="ai-p2-adopt-drop">▼ {fmtDrop(drop)}</span>}
                  </span>
                  <span className="ai-p2-adopt-track" aria-hidden="true">
                    <span className="ai-p2-adopt-bar" style={{ width: `${width}%` }} />
                  </span>
                </div>
              );
            })}
            {adoption.contributors && (
              <div
                className="ai-p2-adopt-row is-people"
                data-funnel-stage="contributors"
                data-funnel-count={adoption.contributors.count == null ? 'n/a' : String(adoption.contributors.count)}
                data-funnel-drop=""
                data-largest-drop="false"
                data-funnel-role="producing-value"
                title="People producing value. Not an adoption drop."
              >
                <span className="ai-p2-adopt-label">Contributors</span>
                <span className="ai-p2-adopt-line">
                  <b className="ai-p2-adopt-count">{fmt(adoption.contributors.count)}</b>
                  <span className="ai-p2-adopt-people">producing value</span>
                </span>
                <span className="ai-p2-adopt-track" aria-hidden="true">
                  <span
                    className="ai-p2-adopt-bar"
                    style={{ width: `${adoption.contributors.count != null && adoption.contributors.count > 0 ? Math.min(100, Math.max(4, (adoption.contributors.count / adoption.max) * 100)) : 0}%` }}
                  />
                </span>
              </div>
            )}
          </div>
          <p className="ai-p2-adopt-insight" data-ai-p2-funnel-insight>{adoption.insight}</p>
        </section>
      </div>

      <section className="ai-p2-insight glass-panel rounded-xl min-h-0 min-w-0 shrink-0" aria-label="Executive insight" data-ai-p2-insight>
        <ol className="ai-narr-list ai-narr-list-4">
          {executiveInsight.map((line) => (
            <li key={line.role} title={`${line.role}: ${line.text}`}>{line.text}</li>
          ))}
          {executiveInsight.length === 0 && (
            <li className="opacity-70">No executive insight for this project yet.</li>
          )}
        </ol>
      </section>
    </div>
  );
}

function RiskPersonChip({
  risk,
  onSelectEmployee,
}: {
  risk: AIRiskCard;
  onSelectEmployee: (empNumber: number) => void;
}) {
  const label = risk.person || 'Person';
  const canOpen = typeof risk.employee_number === 'number' && risk.employee_number > 0;
  // #region agent log
  React.useEffect(() => {
    const empCoerced = Number(risk.employee_number);
    const body = JSON.stringify({
      sessionId: '6a418b',
      runId: 'p2-risk-chips',
      hypothesisId: 'H2',
      location: 'AIUtilizationPage2.tsx:RiskPersonChip',
      message: 'chip render path',
      data: {
        person: label,
        type: risk.type,
        severity: risk.severity,
        empRaw: risk.employee_number ?? null,
        empType: typeof risk.employee_number,
        empCoerced: Number.isFinite(empCoerced) ? empCoerced : null,
        canOpen,
        path: canOpen ? 'button-profile' : 'span-type',
        bandClass: BAND[bandOf(risk.severity)],
        bandOfInfoWouldBe: bandOf('info'),
      },
      timestamp: Date.now(),
    });
    fetch('http://127.0.0.1:7896/ingest/a53d98a9-e463-4e07-91cc-72a241898446', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6a418b' },
      body,
    }).catch(() => {});
  }, [label, risk.type, risk.severity, risk.employee_number, canOpen]);
  // #endregion
  if (!canOpen) {
    return (
      <span className={`ai-chip ${BAND[bandOf(risk.severity)]}`} title={risk.text || risk.type}>
        {shortName(label)} · {risk.type.replace(/_/g, ' ')}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`ai-chip ${BAND[bandOf(risk.severity)]} ai-link`}
      title={`${risk.text || risk.type} · Open Profile`}
      onClick={() => onSelectEmployee(risk.employee_number as number)}
    >
      {shortName(label)} · Profile
    </button>
  );
}
