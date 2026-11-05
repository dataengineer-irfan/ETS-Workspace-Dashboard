import React, { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AIHealthRow,
  AILeagueRow,
  AIReleaseTrendRow,
  AIRiskCard,
  AIUtilizationKPIs,
} from '../../types/dashboard';

type Band = 'green' | 'amber' | 'red' | 'neutral';

const BAND: Record<string, string> = {
  green: 'ai-band-green',
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
/* Release intelligence (low col 2, narrower than the old mid col 3): single-line head when it fits;
   Best/Worst/Now callouts (merge when Now=Best/Worst); chart = trend only; chips = release picker
   (name + ! only); insight = action, no metric restatement. Callouts/chart/chips are denser so
   labels still fit ~0.75fr; body scrolls if the low row is shorter than the stack. */

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

/** Canonical manager scorecard components — never blank titles on the 2×2 tiles. */
const MGR_COMP_META: Record<string, { label: string; weight: number }> = {
  adoption: { label: 'Adoption', weight: 30 },
  savings: { label: 'Savings', weight: 25 },
  efficiency: { label: 'Efficiency', weight: 20 },
  quality: { label: 'Evidence', weight: 25 },
  evidence: { label: 'Evidence', weight: 25 },
};

function scoreBand(score: number | null | undefined): Band {
  if (score == null || Number.isNaN(score)) return 'neutral';
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
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

function ScoreRing({ score, band }: { score: number | null; band: string }) {
  const tone = bandOf(band);
  const color = tone === 'green' ? '#047857' : tone === 'amber' ? '#b45309' : tone === 'red' ? '#be123c' : '#64748b';
  const pctFill = Math.max(0, Math.min(100, score ?? 0));
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = (pctFill / 100) * c;
  return (
    <span className="ai-score-ring" aria-label={`Health ${score ?? 'n/a'}`}>
      <svg viewBox="0 0 36 36" width="26" height="26">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="3.5" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
        <text x="18" y="21.5" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="ui-monospace, Consolas, monospace">{score == null ? '—' : Math.round(score)}</text>
      </svg>
    </span>
  );
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
    <text x={x} y={y - 6} textAnchor="middle" fill="currentColor" fontSize={8} fontWeight={700} className="ai-p2-rel-label">
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

/** Deferred: Project Recommendation Engine bottom strip (`.ai-p2-narr`). Re-enable at end. */
const SHOW_PROJECT_REC_ENGINE = false;

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
  const [showFullLeague, setShowFullLeague] = useState(false);

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
  /** Page 2 is project-scoped — do not show portfolio league (NH/Maven/…) while drilled into AK. */
  const league = useMemo(() => {
    const cards = (data.manager_scorecard ?? []).filter((row) => sameProject(row.project, project) && String(row.manager || '').trim());
    if (cards.length > 0) {
      const byMgr = new Map<string, (typeof cards)[number]>();
      for (const card of cards) {
        const key = String(card.manager).trim();
        const prev = byMgr.get(key);
        if (!prev || (card.score ?? -1) > (prev.score ?? -1)) byMgr.set(key, card);
      }
      return [...byMgr.values()]
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || String(a.manager).localeCompare(String(b.manager)))
        .map((card, index) => ({
          rank: index + 1,
          manager: card.manager,
          score: card.score ?? null,
          grade: card.grade || '—',
          value_usd: Math.round((card.hours_saved || 0) * 40),
          hours_saved: card.hours_saved ?? 0,
          projects: [project],
        })) as AILeagueRow[];
    }
    return (data.league ?? [])
      .filter((row) => (row.projects || []).some((p) => sameProject(p, project)))
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        projects: (row.projects || []).filter((p) => sameProject(p, project)),
      }));
  }, [data.manager_scorecard, data.league, project]);
  // #region agent log
  React.useEffect(() => {
    const portfolioLen = (data.league ?? []).length;
    const foreignProjects = [...new Set(league.flatMap((r) => r.projects || []))].filter((p) => p !== project);
    const send = (hypothesisId: string, message: string, dataPayload: Record<string, unknown>) => {
      const body = JSON.stringify({
        sessionId: '6a418b',
        runId: 'post-fix-league-ui',
        hypothesisId,
        location: 'AIUtilizationPage2.tsx:league',
        message,
        data: dataPayload,
        timestamp: Date.now(),
      });
      fetch('http://127.0.0.1:7896/ingest/a53d98a9-e463-4e07-91cc-72a241898446', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6a418b' },
        body,
      }).catch(() => {});
      fetch('/api/ai-utilization/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    };
    send('L1', 'Page2 manager league scoped to drilled project', {
      pageProject: project,
      portfolioLeagueLen: portfolioLen,
      scopedLeagueLen: league.length,
      foreignProjects,
      sample: league.slice(0, 5).map((r) => ({ rank: r.rank, manager: r.manager, projects: r.projects, score: r.score })),
      expectForeignEmpty: true,
      expectScopedLtPortfolio: portfolioLen === 0 || league.length <= portfolioLen,
    });
    const id = window.requestAnimationFrame(() => {
      const root = document.querySelector('[data-ai-p2-root]') as HTMLElement | null;
      const head = document.querySelector('[data-ai-p2-head]') as HTMLElement | null;
      const panel = document.querySelector('[data-league-panel]') as HTMLElement | null;
      const scroll = document.querySelector('[data-league-scroll]') as HTMLElement | null;
      const rows = scroll?.querySelectorAll('tbody tr')?.length ?? 0;
      const genieOpen = !!document.querySelector('.genie-docked, [data-genie-open="true"], .ai-copilot-open');
      const fs = document.documentElement.classList.contains('app-fullscreen')
        || !!document.fullscreenElement;
      send('M1', 'league panel geometry (collapse check)', {
        pageProject: project,
        showFullLeague,
        leagueLen: league.length,
        visibleLen: showFullLeague ? league.length : Math.min(5, league.length),
        panelH: panel?.clientHeight ?? null,
        scrollH: scroll?.clientHeight ?? null,
        scrollScrollH: scroll?.scrollHeight ?? null,
        rowCountInDom: rows,
        expectScrollHGt: 48,
        expectRowsGt: 0,
      });
      send('H1', 'Page2 header + viewport mode', {
        pageProject: project,
        headH: head?.clientHeight ?? null,
        headLines: head ? Math.round((head.clientHeight || 0) / 22) : null,
        rootH: root?.clientHeight ?? null,
        genieOpen,
        fullscreen: fs,
        expectHeadHLt: 88,
        showTeam,
      });
      const chips = Array.from(document.querySelectorAll('.ai-cmd-quad, .ai-p2 .ai-chip')).slice(0, 0);
      void chips;
      const releaseChips = Array.from(
        document.querySelectorAll('[data-rel-panel] .ai-chip'),
      ).map((el) => (el.textContent || '').trim());
      send('R1', 'release delta chips (no inflated %)', {
        pageProject: project,
        releaseChips,
        expectNoHugePct: !releaseChips.some((t) => /\+\d{3,}%/.test(t)),
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [league, project, data.league, showFullLeague, showTeam]);
  // #endregion
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
    return [...seen.values()];
  }, [projectRisks]);

  const topContributorValue = health?.value_usd ?? contributors.reduce((sum, risk) => {
    const cost = risk.values?.cost_usd;
    return sum + (typeof cost === 'number' ? cost : 0);
  }, 0);

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

    return { rows, hasQa, conclusion, devValue, qaValue };
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

  const recommendation = projectRecommendation(health, projRec?.recommendation);
  const mgrRec = managementRecommendation(card, health);

  const execActions = useMemo(() => {
    const fromApi = (projRec?.bullets ?? []).filter(Boolean).slice(0, 4);
    if (fromApi.length) return fromApi;
    const actions: string[] = [];
    if (!battle.hasQa || battle.conclusion === 'QA GAP') {
      actions.push('Increase QA participation — close the evidence gap next release.');
    } else if (battle.conclusion === 'DEV LEADING') {
      const qaActive = domains.find((d) => d.domain === 'QA')?.users_active ?? 0;
      actions.push(`Increase QA participation from ${qaActive} toward ${Math.max(qaActive + 10, 40)} active users.`);
    }
    const topRoi = effectiveness.find((r) => r.tag === 'Highest ROI');
    if (topRoi) actions.push(`Expand ${topRoi.label} as highest ROI activity.`);
    const under = effectiveness.find((r) => r.tag === 'Underutilized');
    if (under) actions.push(`Activate underutilized ${under.label} use case.`);
    if ((health?.unrealized_value_usd || 0) > 0) {
      actions.push(`Recover remaining ${money(health?.unrealized_value_usd)} unrealized value.`);
    }
    if ((health?.risk_count ?? projectRisks.length) >= 3) {
      actions.push(`Clear ${health?.risk_count ?? projectRisks.length} open risk signals before the next release.`);
    }
    actions.push(`Advance maturity L${maturity} (${MATURITY_LABEL[maturity] || '—'}) → L${nextMaturity} (${MATURITY_LABEL[nextMaturity] || '—'}).`);
    return actions.slice(0, 4);
  }, [projRec?.bullets, battle, domains, effectiveness, health, projectRisks.length, maturity, nextMaturity]);

  const managerComponents = (() => {
    const fallback = [
      { key: 'adoption', label: 'Adoption', weight: 30, score: card?.adoption_pct != null ? Math.min(100, (card.adoption_pct / 80) * 100) : null },
      { key: 'savings', label: 'Savings', weight: 25, score: card?.hours_target ? Math.min(100, (card.hours_saved / card.hours_target) * 100) : null },
      { key: 'efficiency', label: 'Efficiency', weight: 20, score: card?.efficiency_gain_pct != null ? Math.min(100, (card.efficiency_gain_pct / 30) * 100) : null },
      { key: 'quality', label: 'Evidence', weight: 25, score: card?.release_quality_pct ?? null },
    ];
    const raw = card?.components?.length ? card.components : fallback;
    return raw.map((comp) => {
      const meta = MGR_COMP_META[String(comp.key || '').toLowerCase()];
      const label = String(comp.label || '').trim() || meta?.label || 'Component';
      const weight = Number.isFinite(comp.weight) && comp.weight > 0 ? comp.weight : meta?.weight ?? 0;
      return { ...comp, label, weight };
    });
  })();

  const leagueVisible = showFullLeague ? league : league.slice(0, 5);
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
      {/* Line 1 = identity + health · Line 2 = money/ownership + contributors summary. Maturity lives in QA panel. */}
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
            <b className="ai-p2-head-project truncate">{project}</b>
          </div>
          <span className={`ai-chip shrink-0 ${BAND[bandOf(health?.band)]}`}>{health?.band_label || health?.band || 'n/a'}</span>
          <span className={`ai-chip shrink-0 ${BAND[deltaBand]}`}>
            {delta == null ? 'Trend n/a' : `${delta > 0 ? '+' : ''}${fmt(delta, 0)} pts`}
          </span>
          <span className="ai-chip shrink-0 truncate max-w-[9rem]" title="Project recommendation">{recommendation}</span>
        </div>
        <div className="ai-p2-head-row2">
          <span className="ai-p2-head-meta truncate">
            Manager {health?.manager || card?.manager || '—'}
            {' · '}Team {health?.headcount_scope ?? '—'}
            {health?.denominator_inferred ? ' · inferred' : ''}
            {' · '}Value {money(health?.value_usd)}
            {' · '}Unrealized {money(health?.unrealized_value_usd)}
            {(health?.risk_count ?? projectRisks.length) > 0 ? (
              <>
                {' · '}
                <span className="ai-p2-head-risk">{health?.risk_count ?? projectRisks.length} risks</span>
              </>
            ) : null}
          </span>
          {contributors.length > 0 && (
            <span className="ai-p2-head-contrib shrink-0" aria-label="Top contributors summary">
              <span className="ai-p2-head-contrib-text" title="Project AI value (proxy for top contributor contribution)">
                Contributors {contributors.length} · {money(topContributorValue)}
              </span>
              <button type="button" className="ai-crumb ai-p2-head-team-toggle" onClick={() => setShowTeam((v) => !v)}>
                {showTeam ? 'Hide Team' : 'View Team →'}
              </button>
            </span>
          )}
        </div>
        {showTeam && contributors.length > 0 && (
          <div className="ai-p2-head-team" aria-label="Project team contributors">
            {contributors.slice(0, 12).map((risk) => (
              <RiskPersonChip key={`${risk.type}-${risk.person}-${risk.employee_number}`} risk={risk} onSelectEmployee={onSelectEmployee} />
            ))}
          </div>
        )}
      </section>

      <div className="ai-p2-mid">
        <section className="glass-panel rounded-xl ai-p2-card min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Dev vs QA battle</span>
            <span className={`ai-chip shrink-0 ${BAND[conclusionBand]}`} title="Battle outcome">{battle.conclusion}</span>
          </div>
          <div className="ai-battle-compare min-h-0" data-battle-compare>
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
        </section>

        <section className="glass-panel rounded-xl ai-p2-card min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Use case effectiveness</span>
          </div>
          <div className="ai-uc-strip min-h-0" data-uc-strip>
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
                  className="ai-uc-row"
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
                    <span className={`ai-chip ${BAND[recBand(row.rec)]}`}>{row.rec}</span>
                  </span>
                </span>
              );
            })}
            {ucStrip.rows.length === 0 && (
              <p className="ai-p2-empty">No use case rows for this project.</p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-xl ai-p2-card ai-p2-qa min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="ai-p2-card-head">
            <div className="ai-p2-card-titles min-w-0">
              <span className="ai-p2-card-title">QA maturity</span>
              <span className="ai-p2-card-sub">
                Current: L{maturity} {MATURITY_LABEL[maturity] || ''} → Next: L{nextMaturity}{' '}
                {MATURITY_LABEL[nextMaturity] || ''}
              </span>
            </div>
            <span className={`ai-chip shrink-0 ${BAND[maturityTrack.band]}`} title="Maturity trajectory">
              {maturityTrack.label}
            </span>
          </div>
          <div className="ai-p2-qa-body custom-scrollbar">
            <div className="ai-p2-qa-journey">
              <div className="ai-p2-qa-journey-row">
                <span className="ai-p2-qa-score">
                  {maturityScore == null ? 'n/a' : `${fmt(maturityScore, 0)} / 100`}
                </span>
                <span className="ai-p2-qa-meta" title={`Target ${maturityTarget}${maturityReadiness != null ? ` · Ready ${fmt(maturityReadiness, 0)}%` : ''}${maturityGap != null ? ` · Gap ${fmt(maturityGap, 0)}` : ''}`}>
                  Target {maturityTarget}
                  {maturityReadiness != null ? ` · Ready ${fmt(maturityReadiness, 0)}%` : ''}
                  {maturityGap != null ? ` · Gap ${fmt(maturityGap, 0)}` : ''}
                </span>
              </div>
              <div
                className="ai-p2-score-meter ai-p2-qa-progress"
                role="meter"
                aria-label={`Maturity score ${maturityScore == null ? 'n/a' : Math.round(maturityScore)} of 100 toward L${nextMaturity}`}
                aria-valuemin={0}
                aria-valuemax={100}
                {...(maturityScore != null ? { 'aria-valuenow': Math.round(maturityScore) } : {})}
              >
                <span
                  className={`ai-p2-score-meter-fill is-${scoreBand(maturityScore)}`}
                  style={{ width: `${maturityScore == null ? 0 : Math.max(0, Math.min(100, maturityScore))}%` }}
                />
              </div>
            </div>

            <div className="ai-p2-qa-bars" aria-label="Capability scorecard">
              <span className="ai-p2-eyebrow ai-p2-qa-bars-label">Capabilities · weakest first</span>
              {maturityAxes.length === 0 && (
                <p className="ai-p2-empty">No maturity axis scores for this project.</p>
              )}
              <div className="ai-p2-qa-bars-list">
                {maturityAxes.map((row) => {
                  const band = scoreBand(row.score);
                  const fill = Math.max(0, Math.min(100, row.score));
                  return (
                    <div key={row.key} className="ai-p2-qa-bar" title={`${row.axis} ${fmt(row.score, 0)} / 100`}>
                      <span className="ai-p2-qa-bar-label">{row.axis}</span>
                      <div className="ai-p2-score-meter" role="presentation">
                        <span className={`ai-p2-score-meter-fill is-${band}`} style={{ width: `${fill}%` }} />
                      </div>
                      <span className="ai-p2-qa-bar-val" data-band={band}>{fmt(row.score, 0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {weakestAxis && (
              <div className="ai-p2-qa-block">
                <span className="ai-p2-eyebrow">Biggest constraint</span>
                <p
                  className="ai-p2-qa-block-line"
                  title={`${weakestAxis.axis} · ${fmt(weakestAxis.score, 0)} → ${maturityTarget} · Gap ${fmt(Math.max(0, maturityTarget - weakestAxis.score), 0)}`}
                >
                  <strong>{weakestAxis.axis}</strong>
                  {' · '}
                  {fmt(weakestAxis.score, 0)} → {maturityTarget}
                  {' · Gap '}
                  {fmt(Math.max(0, maturityTarget - weakestAxis.score), 0)}
                </p>
                <p className="ai-p2-qa-block-impact" title={axisImpact(weakestAxis.axis)}>
                  {axisImpact(weakestAxis.axis)}
                </p>
              </div>
            )}

            <div className="ai-p2-qa-rec">
              <span className="ai-p2-eyebrow">Recommendation</span>
              <p className="ai-p2-qa-rec-text" title={maturityRec}>{maturityRec}</p>
              <div className="ai-p2-qa-rec-meta" aria-label="Recommendation meta">
                {weakestAxis && (
                  <span className="ai-p2-qa-rec-chip">
                    Expected Gain ~{fmt(Math.max(0, maturityTarget - weakestAxis.score), 0)} pts
                  </span>
                )}
                <span className="ai-p2-qa-rec-chip">Priority high</span>
                <span className="ai-p2-qa-rec-chip">Impact L{nextMaturity}</span>
              </div>
            </div>

            <p className="ai-p2-qa-summary" title={maturityInsight}>{maturityInsight}</p>
          </div>
        </section>
      </div>

      <div className="ai-p2-low ai-p2-low-3">
        <section className="glass-panel rounded-xl ai-p2-card ai-p2-mgr min-h-0 min-w-0 overflow-hidden flex flex-col">
          {/* Single-line head; weights on 2×2 tiles only. */}
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <div className="ai-p2-card-titles min-w-0">
              <span className="ai-p2-card-title truncate">Manager score · {card?.manager || health?.manager || '—'}</span>
            </div>
            <span className={`ai-chip shrink-0 ${BAND[card?.grade === 'A+' || card?.grade === 'A' ? 'green' : card?.grade === 'B' ? 'amber' : 'red']}`}>
              {card?.grade || 'n/a'}{card?.score == null ? '' : ` ${fmt(card.score, 0)}`}
            </span>
          </div>
          {card ? (
            <div className="ai-p2-mgr-body custom-scrollbar">
              <div className="ai-p2-mgr-tiles" aria-label="Manager score components">
                {managerComponents.map((comp) => (
                  <ScoreTile
                    key={comp.key}
                    label={comp.label}
                    weight={comp.weight}
                    score={comp.score}
                  />
                ))}
              </div>
              <div className="ai-p2-mgr-rec">
                <span className="ai-p2-eyebrow">Recommendation</span>
                <p className="ai-p2-mgr-rec-text" title={mgrRec}>{mgrRec}</p>
              </div>
            </div>
          ) : (
            <p className="ai-p2-empty">No manager score for this project.</p>
          )}
        </section>

        <section className="glass-panel rounded-xl ai-p2-card ai-p2-rel min-h-0 min-w-0 overflow-hidden flex flex-col" data-rel-panel>
          <div className="ai-p2-card-head ai-p2-card-head-battle">
            <span className="ai-p2-card-title">Release intelligence</span>
            <div className="ai-p2-rel-head-meta min-w-0">
              <span
                className="ai-p2-rel-meta truncate"
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
          <div className="ai-p2-rel-body">
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
            <div className="ai-p2-rel-chart flex-1 min-h-0">
              {timeline.length === 0 ? (
                <p className="ai-p2-empty">No releases for this project.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeline} margin={{ top: 10, right: 2, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis dataKey="release" tick={{ fontSize: 8 }} hide={timeline.length > 5} />
                    <YAxis yAxisId="left" hide domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" hide />
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
                    <Area yAxisId="right" type="monotone" dataKey="hours_saved" fill="#0d948828" stroke="#0d9488" strokeWidth={1.25} name="Hours" />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="adoption_pct"
                      stroke="#0284c7"
                      strokeWidth={2}
                      name="Adoption %"
                      dot={{ r: 3, onClick: (p: { payload?: AIReleaseTrendRow }) => p.payload && onOpenRelease(p.payload.release) }}
                    >
                      <LabelList dataKey="health" content={ReleaseHealthLabel} />
                    </Line>
                    <Line yAxisId="right" type="monotone" dataKey="value" stroke="#047857" strokeDasharray="4 3" strokeWidth={1.25} dot={false} name="Value $" />
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

        <section className="glass-panel rounded-xl ai-p2-card min-h-0 min-w-0 overflow-hidden flex flex-col ai-p2-league-compact" data-league-panel>
          <div className="ai-p2-league-head" title="Top managers on this project">
            <span className="ai-p2-league-title">Manager league</span>
            <span className="ai-p2-league-meta">Top {Math.min(5, league.length)}{league.length > 5 ? ` / ${league.length}` : ''}</span>
          </div>
          <div className="ai-p2-league-scroll min-h-0 overflow-auto custom-scrollbar" data-league-scroll>
            <table className="ai-exec-table ai-league-table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Manager</th>
                  <th className="num">Value</th>
                  <th className="num">Score</th>
                </tr>
              </thead>
              <tbody>
                {leagueVisible.map((row: AILeagueRow) => (
                  <tr key={`${row.rank}-${row.manager}`} className={row.rank <= 3 ? 'ai-league-top' : ''}>
                    <td className="num">{row.rank}</td>
                    <td className="truncate" title={row.manager}>{shortName(row.manager)}</td>
                    <td className="num">{money(row.value_usd)}</td>
                    <td className="num">
                      <span className={`ai-league-grade ${row.grade === 'A+' || row.grade === 'A' ? 'ai-band-green' : row.grade === 'B' ? 'ai-band-amber' : 'ai-band-red'}`}>
                        {row.grade} {fmt(row.score, 0)}
                      </span>
                    </td>
                  </tr>
                ))}
                {league.length === 0 && (
                  <tr><td colSpan={4}>No manager league rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {league.length > 5 && (
            <button type="button" className="ai-crumb ai-p2-league-more" onClick={() => setShowFullLeague((v) => !v)}>
              {showFullLeague ? 'Show Top 5' : 'View Full Ranking →'}
            </button>
          )}
        </section>
      </div>

      {/* Project Recommendation Engine (`.ai-p2-narr`) deferred — restore later.
          Flip SHOW_PROJECT_REC_ENGINE when re-adding the bottom ≤4-action strip. */}
      {SHOW_PROJECT_REC_ENGINE ? (
        <section className="ai-p2-narr glass-panel rounded-xl ai-panel flex flex-col overflow-hidden min-h-0 min-w-0 shrink-0">
          <div className="ai-sec-head" title="Situation-style project actions">
            <span className="ai-sec-title">Project recommendation engine</span>
            <span className="ai-sec-meta">≤4</span>
          </div>
          <ol className="ai-narr-list ai-narr-list-4">
            {execActions.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {execActions.length === 0 && (
              <li className="opacity-70">No project recommendations yet.</li>
            )}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function ScoreTile({
  label,
  weight,
  score,
}: {
  label: string;
  weight: number;
  score: number | null | undefined;
}) {
  const safeLabel = String(label || '').trim() || 'Component';
  const fill = score == null || Number.isNaN(score) ? 0 : Math.max(0, Math.min(100, score));
  const band = scoreBand(score);
  const valueText = score == null || Number.isNaN(score) ? 'n/a' : `${fmt(score, 0)}`;
  return (
    <div
      className="ai-p2-score-tile"
      title={`${safeLabel} ${weight}% · ${valueText} / 100`}
      data-band={band}
    >
      <div className="ai-p2-score-tile-head">
        <span className="ai-p2-score-tile-label">
          {safeLabel}
          {weight > 0 ? <span className="ai-p2-score-tile-wt">{weight}%</span> : null}
        </span>
        <span className="ai-p2-score-tile-value">
          {valueText}
          <span className="ai-p2-score-tile-max">/100</span>
        </span>
      </div>
      <div
        className="ai-p2-score-meter"
        role="meter"
        aria-label={`${safeLabel} ${valueText} of 100`}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(score != null && !Number.isNaN(score) ? { 'aria-valuenow': Math.round(fill) } : {})}
      >
        <span className={`ai-p2-score-meter-fill is-${band}`} style={{ width: `${fill}%` }} />
      </div>
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
