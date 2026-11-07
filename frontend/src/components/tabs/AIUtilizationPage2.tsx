import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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

/** Where this project sits among the scored projects. Position only: the band stays in the header. */
function benchmarkPosition(
  health: number,
  average: number,
  topQuartile: number,
  bottomQuartile: number,
  total: number,
): string | null {
  if (total < 2) return null;
  if (health >= topQuartile && health > average) return 'Top quartile';
  if (health <= bottomQuartile && health < average) return 'Bottom quartile';
  if (health > average) return 'Above average';
  if (health < average) return 'Below average';
  return 'At average';
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
  position: string | null;
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
    position: benchmarkPosition(health, average, topQuartile, bottomQuartile, total),
    title: titleParts.join(' · '),
    scale: { lo, hi: hi > lo ? hi : lo + 1 },
  };
}

type QaStatus = { label: string; band: Band };

/**
 * Plain status of a capability against the next-level target. Near = within 10 pts.
 * Red is kept for the one blocker (the weakest capability that is still well below target);
 * the other below-target capabilities stay neutral and carry no status word, so the bar
 * against the target line says it.
 */
function capabilityStatus(score: number, target: number, isBlocker = false): QaStatus {
  if (score >= target) return { label: 'At target', band: 'green' };
  if (score >= target - 10) return { label: 'Near target', band: 'amber' };
  return isBlocker ? { label: 'Blocker', band: 'red' } : { label: '', band: 'neutral' };
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
      <span className="ai-p2-donut-basis">of {contribution.basis}</span>
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
    <span
      className={`ai-score-ring ai-p2-health-ring${score != null && Math.round(score) >= 100 ? ' is-wide' : ''}`}
      aria-label={`Health ${score ?? 'n/a'} ${band}`}
    >
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

let headlineCanvas: CanvasRenderingContext2D | null = null;

/** Width of a text run in the element's own font, so the headline can pick the longest variant that fits one line. */
function textWidthIn(el: HTMLElement, text: string): number {
  if (!headlineCanvas) headlineCanvas = document.createElement('canvas').getContext('2d');
  if (!headlineCanvas) return text.length * 6.4;
  const cs = getComputedStyle(el);
  headlineCanvas.font = `800 ${cs.fontSize} ${cs.fontFamily}`;
  return headlineCanvas.measureText(text).width;
}

/** Hover definitions. Wording follows the backend calculation (analytics.py) and the design doc. */
const DEFINITIONS = {
  activeUsers: 'People in this domain with at least one activity row with hours saved or tokens in the current release.',
  hoursSaved: 'Hours saved on the domain\'s activity rows in the current release.',
  value: 'Hours saved × the $40/h loaded rate.',
  adoption: 'Active users ÷ users enabled in this domain (headcount on the release outcome rows).',
  utilization: 'Hours saved ÷ (enabled users × 8 h), capped at 100%.',
  primaryArtifacts: 'Dev: code generated · QA: test cases / test design.',
  secondaryAssets: 'Dev: documentation · QA: automation assets.',
  defectPrevention: 'QA defect-analysis hours saved. Dev has no equivalent (n/a).',
  coverage: 'QA adoption: share of QA headcount actively using AI, the same rule as Adoption % for QA. Dev has no equivalent (n/a).',
  gain: 'Hours saved ÷ baseline effort for the use case (the productivity gain on its rows). It is not a release-over-release trend.',
  funnelTeam: 'Headcount in scope for this project.',
  funnelEnabled: 'Users with AI enabled (release outcome headcount).',
  funnelActive: 'Active users: at least one activity row with hours saved or tokens in the current release.',
  funnelContributors: 'People on this project\'s risk and opportunity cards (the View Team list). Not an adoption stage, so it never draws a drop.',
} as const;

const REC_DEFINITIONS: Record<string, string> = {
  Scale: 'Scale: highest ROI or fastest-growing use case. Expand it to more people.',
  Sustain: 'Sustain: the most adopted use case. Keep it going.',
  Activate: 'Activate: in use but under 2 hours saved. Get more people using it.',
  Review: 'Review: lowest value of the active use cases. Check whether to keep investing.',
  Pilot: 'Pilot: no usage yet. Try it with one team.',
  Monitor: 'Monitor: steady, no change needed.',
};

const BATTLE_DEFINITIONS: Record<string, string> = {
  'Active Users': DEFINITIONS.activeUsers,
  'Hours Saved': DEFINITIONS.hoursSaved,
  'Value Generated': DEFINITIONS.value,
  'Adoption %': DEFINITIONS.adoption,
  'Utilization %': DEFINITIONS.utilization,
  'Primary Artifacts': DEFINITIONS.primaryArtifacts,
  'Secondary Assets': DEFINITIONS.secondaryAssets,
  'Defect Prevention': DEFINITIONS.defectPrevention,
  'Coverage %': DEFINITIONS.coverage,
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
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const [headlineW, setHeadlineW] = useState(0);
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const [verdictW, setVerdictW] = useState(0);

  const health = (data.health ?? []).find((row) => sameProject(row.project, project)) as AIHealthRow | undefined;
  const projectRisks = useMemo(
    () => (data.risks ?? []).filter((row) => sameProject(row.project, project)),
    [data.risks, project],
  );
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
      .map((axis, index) => ({
        key: `${axis.axis}-${index}`,
        axis: QA_AXIS_ALIAS[axis.axis] || axis.axis,
        score: typeof axis.score === 'number' && !Number.isNaN(axis.score) ? axis.score : 0,
      }))
      .sort((a, b) => a.score - b.score);
  }, [data.maturity_radar, project]);
  useLayoutEffect(() => {
    const el = headlineRef.current;
    if (!el) return;
    const measure = () => setHeadlineW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);
  useLayoutEffect(() => {
    const el = verdictRef.current;
    if (!el) return;
    const measure = () => setVerdictW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);
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

    /* Metric | Dev | lead | QA rows. A null number is n/a (no evidence on that side). */
    const devAdopt = adopt(devActive, devEnabled);
    const qaAdopt = adopt(qaActive, qaEnabled);
    const devUtil = util(devHours, devEnabled);
    const qaUtil = util(qaHours, qaEnabled);
    const devPrimary = dev?.artifacts ?? sumCount(['Code generation']);
    const qaPrimary = qa?.artifacts ?? sumCount(['Unit testing', 'Test design']);
    const devSecondary = sumCount(['Docs']);
    const qaSecondary = sumCount(['Test automation']);
    const defectHours = sumHours(['Defect analysis']);
    const allRows: { key: string; tip?: string; dev: string; qa: string; devN: number | null; qaN: number | null }[] = [
      { key: 'Active Users', dev: fmt(devActive), qa: fmt(qaActive), devN: devActive, qaN: qaActive },
      { key: 'Hours Saved', dev: fmt(devHours, 1), qa: fmt(qaHours, 1), devN: devHours, qaN: qaHours },
      { key: 'Value Generated', dev: money(devValue), qa: money(qaValue), devN: devValue, qaN: qaValue },
      { key: 'Adoption %', dev: pct(devAdopt), qa: pct(qaAdopt), devN: devAdopt, qaN: qaAdopt },
      { key: 'Utilization %', dev: pct(devUtil), qa: pct(qaUtil), devN: devUtil, qaN: qaUtil },
      { key: 'Primary Artifacts', dev: fmt(devPrimary), qa: fmt(qaPrimary), devN: devPrimary, qaN: qaPrimary },
      { key: 'Secondary Assets', dev: fmt(devSecondary), qa: fmt(qaSecondary), devN: devSecondary, qaN: qaSecondary },
      { key: 'Defect Prevention', dev: 'n/a', qa: `${fmt(defectHours, 1)} h`, devN: null, qaN: defectHours },
      { key: 'Coverage %', dev: 'n/a', qa: pct(qaCoverage), devN: null, qaN: qaCoverage ?? null },
    ];
    const rows = allRows
      .filter((row) => row.devN != null || row.qaN != null)
      .map((row) => ({
        ...row,
        tip: BATTLE_DEFINITIONS[row.key],
        lead: (row.devN != null && row.qaN != null && row.devN !== row.qaN
          ? (row.devN > row.qaN ? 'dev' : 'qa')
          : 'none') as 'dev' | 'qa' | 'none',
      }));
    const noData = allRows.filter((row) => row.devN == null && row.qaN == null).map((row) => row.key);

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
      if (contribution || devActive > 0 || qaActive > 0) {
        recommend = 'Increase QA participation.';
      }
    }

    return { rows, noData, hasQa, conclusion, devValue, qaValue, contribution, recommend };
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
    /* Repeating one gain on every row says nothing: show the column only when the rows differ. */
    const gains = active.map((r) => r.gain).filter((g): g is number => g != null);
    const spread = gains.length ? Math.max(...gains) - Math.min(...gains) : 0;
    const showTrend = gains.length > 1 && spread > 5;
    let common: string | null = null;
    if (!showTrend && gains.length) {
      const sorted = [...gains].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)];
      common = mid >= 5 ? `▲${fmt(mid, 0)}%` : mid <= -5 ? `▼${fmt(Math.abs(mid), 0)}%` : `▬${fmt(mid, 0)}%`;
    }
    return { rows, valueMax, showTrend, common };
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
  const blockerAxis = weakestAxis != null && weakestAxis.score < maturityTarget - 10 ? weakestAxis : null;
  const atTopLevel = nextMaturity <= maturity;
  const problemKind: 'none' | 'blocker' | 'near' | 'ok' = !weakestAxis
    ? 'none'
    : blockerAxis
      ? 'blocker'
      : weakestAxis.score < maturityTarget
        ? 'near'
        : 'ok';
  const problemBand: Band = problemKind === 'blocker' ? 'red' : problemKind === 'near' ? 'amber' : problemKind === 'ok' ? 'green' : 'neutral';
  const problemLabel = problemKind === 'blocker' ? 'Problem' : problemKind === 'near' ? 'Watch' : problemKind === 'ok' ? 'On target' : 'Capabilities';
  const otherAxes = weakestAxis ? maturityAxes.slice(1) : [];
  const verdictVariants = (() => {
    const levelName = `L${maturity} ${MATURITY_LABEL[maturity] || ''}`.trim();
    const nextName = `L${nextMaturity} ${MATURITY_LABEL[nextMaturity] || ''}`.trim();
    const head = `${levelName}.`;
    if (maturityScore == null || maturityGap == null) return [{ head, rest: 'Capability scores not available.' }];
    const score = fmt(maturityScore, 0);
    const short = maturityGap <= 0 ? 'Target met.' : `${Math.max(1, Math.round(maturityGap))} pts short.`;
    if (atTopLevel) {
      return [
        { head, rest: `${score} of ${maturityTarget} to hold the target. ${short}` },
        { head, rest: `${score} of ${maturityTarget}. ${short}` },
      ];
    }
    return [
      { head, rest: `${score} of ${maturityTarget} to reach ${nextName}. ${short}` },
      { head, rest: `${score} of ${maturityTarget} to reach L${nextMaturity}. ${short}` },
      { head, rest: `${score} of ${maturityTarget}. ${short}` },
    ];
  })();
  const verdictPick = (() => {
    const el = verdictRef.current;
    if (!el || verdictW <= 0) return verdictVariants[0];
    return verdictVariants.find((v) => textWidthIn(el, `${v.head} ${v.rest}`) <= verdictW - 2)
      ?? verdictVariants[verdictVariants.length - 1];
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
  /** Real best / worst release data only, no advice and nothing about the points between releases. */
  const releaseInsight = (() => {
    if (!timeline.length) return 'No release evidence for this project yet.';
    const describe = (row: (typeof timeline)[number]) =>
      `${row.health != null ? `${fmt(row.health, 0)}% adoption, ` : ''}${fmt(row.hours_saved, 0)} h`;
    if (timeline.length === 1 && currentRelease) {
      return `${currentRelease.release} is the only release: ${describe(currentRelease)}.`;
    }
    if (!bestRelease || !worstRelease) return 'Click a release for deep dive.';
    if (bestRelease.release === worstRelease.release) {
      return `All ${timeline.length} releases are level: ${describe(bestRelease)}.`;
    }
    return `${worstRelease.release} is the weakest release: ${describe(worstRelease)}. ${bestRelease.release} is the best: ${describe(bestRelease)}.`;
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
  /* The headline under the header carries the situation, QA level and recoverable $, and the cards carry
     the rest, so the bottom strip keeps the one fact nothing else states: how concentrated the value is. */
  const executiveInsight = (() => {
    const lines: { role: string; text: string }[] = [];
    const valued = effectiveness.filter((row) => (row.value || 0) > 0);
    if (valued[0]) {
      const total = valued.reduce((sum, row) => sum + (row.value || 0), 0);
      const top = valued.slice(0, 2);
      const share = total > 0 ? Math.round((top.reduce((sum, row) => sum + (row.value || 0), 0) / total) * 100) : null;
      const names = top.map((row) => `${row.label} ${money(row.value)}`).join(', ');
      lines.push({
        role: 'Value',
        text: `Top value: ${names}${share != null && valued.length > top.length ? ` (${share}% of use-case value)` : ''}.`,
      });
    }
    return lines;
  })();
  /* One deterministic sentence from real fields. Variants run longest to shortest; the longest that fits
     the strip on one line is shown, so there is never an ellipsis or a second line. */
  const headlineVariants = (() => {
    const score = health?.health_score ?? null;
    const bandText = health?.band_label || health?.band || null;
    const adoptWord = score == null ? null : score >= 90 ? 'leads on' : score >= 80 ? 'is strong on' : score >= 70 ? 'is average on' : 'needs attention on';
    const head = score == null
      ? ' has no AI adoption health score yet'
      : ` ${adoptWord} AI adoption (${fmt(score, 0)}${bandText ? `, ${bandText}` : ''})`;
    const levelName = `L${maturity} ${MATURITY_LABEL[maturity] || ''}`.trim();
    const hasQaScores = maturityAxes.length > 0;
    const behind = hasQaScores && !atTopLevel && maturityGap != null && maturityGap > 0;
    const conj = score != null && score >= 80 && behind ? ' while ' : ' and ';
    const qaLong = !hasQaScores
      ? 'no QA capability scores are available yet'
      : atTopLevel
        ? `QA practice holds ${levelName}`
        : `QA practice sits at ${levelName}`;
    const qaShort = !hasQaScores ? 'no QA scores yet' : atTopLevel ? `QA holds L${maturity}` : `QA sits at L${maturity} of L${nextMaturity}`;
    const gapBit = behind ? `, ${fmt(maturityGap, 0)} pts short of L${nextMaturity}` : '';
    const focus = blockerAxis ?? belowTarget[0] ?? null;
    const tailParts: string[] = [];
    if ((health?.unrealized_value_usd ?? 0) > 0) tailParts.push(`${money(health?.unrealized_value_usd)} recoverable`);
    if (focus) tailParts.push(`start with ${focus.axis}`);
    const tail = tailParts.length ? ` — ${tailParts.join(', ')}` : '';
    const out = [
      `${head}${conj}${qaLong}${gapBit}${tail}.`,
      `${head}${conj}${qaLong}${gapBit}.`,
      `${head}${conj}${qaShort}.`,
      score == null ? ` — ${qaShort}.` : `: ${fmt(score, 0)}${bandText ? ` (${bandText})` : ''}, ${qaShort}.`,
    ];
    return out.filter((text, index) => out.indexOf(text) === index);
  })();
  const headlineRest = (() => {
    const el = headlineRef.current;
    if (!el || headlineW <= 0) return headlineVariants[0];
    return headlineVariants.find((text) => textWidthIn(el, `${project}${text}`) <= headlineW - 2)
      ?? headlineVariants[headlineVariants.length - 1];
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
          <span className="ai-p2-head-health shrink-0">
            {project.length <= 18 && <span className="ai-p2-head-scope" title="Health score: adoption, business value, release coverage, QA adoption and documentation use">AI adoption health</span>}
            <span className={`ai-chip shrink-0 ${BAND[bandOf(health?.band)]}`}>{health?.band_label || health?.band || 'n/a'}</span>
            <span className={`ai-chip shrink-0 ${BAND[deltaBand]}`} title={health?.previous_release ? `Adoption points vs ${health.previous_release}` : undefined}>
              {delta == null ? 'Trend n/a' : `${delta > 0 ? '+' : ''}${fmt(delta, 0)} pts`}
            </span>
          </span>
          <span className="ai-p2-head-kpis" aria-label="Value, recoverable, and risk count">
            <span className="ai-p2-head-kpi is-hero" title="Hours saved × the $40/h loaded rate">
              <span className="ai-p2-head-kpi-k">Value</span>
              <b>{money(health?.value_usd ?? health?.ai_value_usd)}</b>
            </span>
            <span className="ai-p2-head-kpi is-hero" title="Potential value (headcount × target hours × rate) minus value generated">
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

      <section className="ai-p2-headline glass-panel rounded-xl" aria-label="Headline" data-ai-p2-headline>
        <p className="ai-p2-headline-text" ref={headlineRef} data-headline-variants={headlineVariants.length}>
          <b>{project}</b>{headlineRest}
        </p>
        {health?.current_release && (
          <span
            className="ai-p2-headline-asof"
            title={health.previous_release ? `Current release in scope. The trend chip compares adoption with ${health.previous_release}.` : 'Current release in scope.'}
          >
            Release {health.current_release}
          </span>
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
            style={{ '--p2-rows': Math.max(1, battle.rows.length + (battle.noData.length ? 1 : 0)) } as React.CSSProperties}
          >
            <div className="ai-battle-axis" aria-hidden="true">
              <span className="ai-battle-axis-key">Metric</span>
              <span className="ai-battle-axis-dev">Dev</span>
              <span className="ai-battle-axis-lead" />
              <span className="ai-battle-axis-qa">QA</span>
            </div>
            {battle.rows.map((row) => (
              <span key={row.key} className="ai-battle-row" title={row.tip} data-lead={row.lead}>
                <span className="ai-battle-key" data-tip={row.tip ? 'true' : undefined}>{row.key}</span>
                <b className={`ai-battle-val is-dev${row.devN == null ? ' is-na' : ''}`}>{row.dev}</b>
                <i
                  className={`ai-battle-lead is-${row.lead}`}
                  aria-label={row.lead === 'dev' ? 'Dev leads' : row.lead === 'qa' ? 'QA leads' : 'No lead'}
                  title={row.lead === 'dev' ? 'Dev leads' : row.lead === 'qa' ? 'QA leads' : 'No lead (equal or n/a)'}
                >
                </i>
                <b className={`ai-battle-val is-qa${row.qaN == null ? ' is-na' : ''}`}>{row.qa}</b>
              </span>
            ))}
            {battle.noData.length > 0 && (
              <span className="ai-battle-nodata" data-battle-nodata>
                No data: {battle.noData.join(', ')}
              </span>
            )}
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
            {!ucStrip.showTrend && ucStrip.common && (
              <span className="ai-p2-card-sub" data-uc-common-gain title={DEFINITIONS.gain}>
                All rows {ucStrip.common} gain vs baseline
              </span>
            )}
          </div>
          <div
            className={`ai-uc-strip min-h-0${ucStrip.showTrend ? '' : ' is-no-trend'}`}
            data-uc-strip
            style={{ '--p2-rows': Math.max(1, ucStrip.rows.length) } as React.CSSProperties}
          >
            <div className="ai-uc-axis" aria-hidden="true">
              <span className="ai-uc-axis-rank">#</span>
              <span className="ai-uc-axis-name">Use case</span>
              <span className="ai-uc-axis-num" title="Number of activity rows logged for the use case in the current release.">Usage</span>
              <span className="ai-uc-axis-num" title={DEFINITIONS.hoursSaved}>Hours</span>
              {ucStrip.showTrend && <span className="ai-uc-axis-trend" title={DEFINITIONS.gain}>Gain</span>}
              <span className="ai-uc-axis-num" title={DEFINITIONS.value}>Value</span>
              <span className="ai-uc-axis-rec" title="Recommendation per use case. Hover a chip for its rule.">Rec</span>
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
                  {ucStrip.showTrend && <span className="ai-uc-trend">{row.count ? row.trend : '—'}</span>}
                  <span className="ai-uc-num ai-uc-value">{row.count ? money(row.value) : 'n/a'}</span>
                  <span className="ai-uc-rec">
                    <span className={`ai-chip ${BAND[recBand(row.rec)]}`} title={REC_DEFINITIONS[row.rec] || row.rec}>{row.rec}</span>
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
                      {c.row.health != null ? `${fmt(c.row.health, 0)}% adoption` : 'n/a'}
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
            <div className="ai-p2-rel-legend" data-rel-legend aria-label="Chart legend">
              <span className="ai-p2-rel-key is-adoption" title="Adoption % of the project for each release (left scale)">Adoption %</span>
              <span className="ai-p2-rel-key is-hours" title="Hours saved in each release (own scale, area under the line)">Hours saved</span>
              <span className="ai-p2-rel-key is-dot" title="Each dot is one real release. Lines only join the dots.">Dot = release</span>
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
                    <Tooltip
                      formatter={(value, name) => {
                        const n = typeof value === 'number' ? value : Number(value);
                        if (name === 'Adoption %') return [Number.isFinite(n) ? `${fmt(n, 0)}%` : 'n/a', name];
                        if (name === 'Hours saved') return [Number.isFinite(n) ? `${fmt(n, 1)} h` : 'n/a', name];
                        return [Number.isFinite(n) ? money(n) : 'n/a', name];
                      }}
                    />
                    {currentRelease?.release && (
                      <ReferenceLine
                        yAxisId="left"
                        x={currentRelease.release}
                        stroke="currentColor"
                        strokeOpacity={0.35}
                        strokeDasharray="3 3"
                      />
                    )}
                    <Area
                      yAxisId="hours"
                      type="linear"
                      dataKey="hours_saved"
                      fill="#0d948828"
                      stroke="#0d9488"
                      strokeWidth={1.5}
                      name="Hours saved"
                      dot={{ r: 2.5, fill: '#0d9488', stroke: '#0d9488' }}
                      activeDot={false}
                    />
                    <Line
                      yAxisId="left"
                      type="linear"
                      dataKey="adoption_pct"
                      stroke="#0284c7"
                      strokeWidth={2}
                      name="Adoption %"
                      dot={{ r: 3.5, fill: '#0284c7', stroke: '#0284c7', onClick: (state) => {
                        const payload = (state as { payload?: AIReleaseTrendRow } | undefined)?.payload;
                        if (payload?.release) onOpenRelease(payload.release);
                      } }}
                    >
                      {showPointLabels ? <LabelList dataKey="health" content={ReleaseHealthLabel} /> : null}
                    </Line>
                    <Line yAxisId="value" type="linear" dataKey="value" stroke="none" dot={false} activeDot={false} legendType="none" name="Value $" />
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
            <div className="ai-p2-qa-head-titles min-w-0">
              <span className="ai-p2-card-title">Portfolio benchmark</span>
              <span className="ai-p2-card-sub">AI adoption health</span>
            </div>
            {benchmark?.position && (
              <span
                className="ai-chip ai-band-neutral shrink-0"
                data-benchmark-status={benchmark.position}
                title="Position among the scored projects. The band (Elite, Strong, ...) is in the header."
              >
                {benchmark.position}
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
                  <span>of {benchmark.total} projects</span>
                </p>
                <span
                  className="ai-p2-mgr-vpu"
                  data-tone={benchmark.valueTone || undefined}
                  data-benchmark-vpu={benchmark.valuePerUser ?? ''}
                  data-benchmark-vpu-delta={benchmark.valueDeltaPct ?? ''}
                  title="Value generated ÷ active users (headcount when nobody is active), vs the average of the scored projects"
                >
                  {benchmark.valuePerUser == null
                    ? 'Value/user n/a'
                    : `${money(benchmark.valuePerUser)}/user${benchmark.valueDeltaPct == null ? '' : ` ${vsAverageLabel(benchmark.valueDeltaPct)}`}`}
                </span>
              </div>
              {(() => {
                const span = benchmark.scale.hi - benchmark.scale.lo;
                const pos = (score: number) => Math.max(0, Math.min(100, ((score - benchmark.scale.lo) / span) * 100));
                const bandLeft = pos(benchmark.bottomQuartile);
                const bandRight = pos(benchmark.topQuartile);
                const quartilesApart = bandRight - bandLeft >= 30;
                const label = (key: string, text: React.ReactNode, at: number, half: string, row: 'top' | 'low1' | 'low2', tip?: string) => (
                  <span
                    key={key}
                    className={`ai-p2-mgr-tag is-${row} is-${key}`}
                    style={{ '--at': `${at}%`, '--half': half } as React.CSSProperties}
                    title={tip}
                  >
                    {text}
                  </span>
                );
                return (
                  <div
                    className="ai-p2-mgr-range"
                    role="img"
                    aria-label={`This project ${fmt(benchmark.health, 1)} against the portfolio: average ${fmt(benchmark.average, 1)}, middle half ${fmt(benchmark.bottomQuartile, 1)} to ${fmt(benchmark.topQuartile, 1)}`}
                  >
                    {label('me', <b data-benchmark-health={benchmark.health} data-tone={benchmark.healthTone}>{fmt(benchmark.health, 1)}</b>, pos(benchmark.health), '1.1rem', 'top', `${project} health ${fmt(benchmark.health, 1)}`)}
                    <span className="ai-p2-mgr-range-track">
                      <span
                        className="ai-p2-mgr-range-band"
                        style={{ left: `${bandLeft}%`, width: `${Math.max(0.5, bandRight - bandLeft)}%` }}
                      />
                      <span className="ai-p2-mgr-range-avg" style={{ left: `${pos(benchmark.average)}%` }} />
                      <span className="ai-p2-mgr-range-me" data-tone={benchmark.healthTone} style={{ left: `${pos(benchmark.health)}%` }} />
                    </span>
                    {label('avg', <>Avg <b data-benchmark-average={benchmark.average}>{fmt(benchmark.average, 1)}</b></>, pos(benchmark.average), '1.5rem', 'low1', 'Average health of the scored projects')}
                    {quartilesApart ? (
                      <>
                        {label('q1', <>Q1 <b data-benchmark-bottom={benchmark.bottomQuartile}>{fmt(benchmark.bottomQuartile, 1)}</b></>, bandLeft, '1.35rem', 'low2', 'Bottom quartile: a quarter of the projects score below this')}
                        {label('q3', <>Q3 <b data-benchmark-top={benchmark.topQuartile}>{fmt(benchmark.topQuartile, 1)}</b></>, bandRight, '1.35rem', 'low2', 'Top quartile: a quarter of the projects score above this')}
                      </>
                    ) : (
                      label('q13', <>Middle half <b data-benchmark-bottom={benchmark.bottomQuartile} data-benchmark-top={benchmark.topQuartile}>{fmt(benchmark.bottomQuartile, 1)}–{fmt(benchmark.topQuartile, 1)}</b></>, (bandLeft + bandRight) / 2, '3.4rem', 'low2', 'Middle half of the scored projects (Q1 to Q3)')
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="ai-p2-empty">No health score for this project.</p>
          )}
        </section>

        <section className="glass-panel rounded-xl ai-p2-card ai-p2-qa min-h-0 min-w-0">
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <div className="ai-p2-qa-head-titles min-w-0">
              <span className="ai-p2-card-title">QA maturity</span>
              <span className="ai-p2-card-sub" data-qa-sub>QA practice vs L{nextMaturity} target</span>
            </div>
            <span className={`ai-chip shrink-0 ${BAND[maturityTrack.band]}`} title="Maturity trajectory">
              {maturityTrack.label}
            </span>
          </div>
          <div className="ai-p2-qa-body">
            <p className="ai-p2-qa-verdict" ref={verdictRef} data-qa-verdict data-qa-level={maturity} data-qa-next={atTopLevel ? undefined : nextMaturity}>
              <b>{verdictPick.head}</b> {verdictPick.rest}
            </p>

            <div
              className="ai-p2-qa-problem"
              data-qa-problem
              data-kind={problemKind}
              data-band={problemBand}
              title={maturityInsight}
            >
              <span className="ai-p2-eyebrow ai-p2-qa-problem-label">{problemLabel}</span>
              <p className="ai-p2-qa-problem-text" title={weakestAxis ? axisImpact(weakestAxis.axis) : undefined}>
                {weakestAxis ? (
                  problemKind === 'ok' ? (
                    <>Every capability is at target. Lowest: <b>{weakestAxis.axis}</b> <b className="ai-p2-qa-problem-num">{fmt(weakestAxis.score, 0)}</b></>
                  ) : (
                    <><b>{weakestAxis.axis}</b> is <b className="ai-p2-qa-problem-num">{fmt(weakestAxis.score, 0)}</b>, target {maturityTarget}</>
                  )
                ) : (
                  'No capability scores for this project.'
                )}
              </p>
              <span className="ai-p2-eyebrow ai-p2-qa-do-label">Do this</span>
              <p className="ai-p2-qa-rec-text" title={maturityRec}>{maturityRec}</p>
            </div>

            {otherAxes.length > 0 && (
              <div className="ai-p2-qa-others" data-qa-others aria-label="Other capabilities, weakest first">
                <span className="ai-p2-eyebrow">Others</span>
                {otherAxes.map((row) => {
                  const status = capabilityStatus(row.score, maturityTarget);
                  return (
                    <span
                      key={row.key}
                      className="ai-p2-qa-other"
                      data-band={status.band}
                      title={`${row.axis} ${fmt(row.score, 0)}, target ${maturityTarget}`}
                    >
                      <span className="ai-p2-qa-other-name">{row.axis}</span>
                      <b className="ai-p2-qa-other-score">{fmt(row.score, 0)}</b>
                    </span>
                  );
                })}
              </div>
            )}
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
                  <span className="ai-p2-adopt-label" title={stage.key === 'enabled' ? DEFINITIONS.funnelEnabled : stage.key === 'active' ? DEFINITIONS.funnelActive : DEFINITIONS.funnelTeam}>
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
                title={DEFINITIONS.funnelContributors}
              >
                <span className="ai-p2-adopt-label" title={DEFINITIONS.funnelContributors}>Contributors</span>
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
