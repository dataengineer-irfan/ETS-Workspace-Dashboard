import React, { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AIBenefitWaterfall, AINarrativeBlock, AIPersonContrib, AIReleaseFlow, AIReleaseSummary, AIUtilizationKPIs } from '../../types/dashboard';

const BAND: Record<string, string> = {
  green: 'ai-band-green',
  amber: 'ai-band-amber',
  red: 'ai-band-red',
  info: 'ai-band-info',
  neutral: 'ai-band-neutral',
};

function fmt(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
}

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(0)}%`;
}

function releaseCertification(score: number | null | undefined, explicit?: string | null) {
  if (explicit) return explicit;
  if (score == null) return 'Uncertified';
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Certified';
  if (score >= 60) return 'At Risk';
  return 'Critical';
}

function certBand(cert: string): string {
  if (cert === 'Elite' || cert === 'Strong') return 'green';
  if (cert === 'Certified') return 'info';
  if (cert === 'At Risk') return 'amber';
  if (cert === 'Critical') return 'red';
  return 'neutral';
}

export function AIUtilizationPage3({
  data,
  project,
  release,
  onSelectEmployee,
  onBack,
  onGoPortfolio,
  onGoProject,
}: {
  data: AIUtilizationKPIs;
  project: string;
  release: string;
  onSelectEmployee: (empNumber: number) => void;
  onBack: () => void;
  onGoPortfolio: () => void;
  onGoProject: () => void;
}) {
  const summary = useMemo<AIReleaseSummary | undefined>(
    () => (data.release_summaries ?? []).find((row) => row.project === project && row.release === release) || data.release_summary || undefined,
    [data.release_summaries, data.release_summary, project, release],
  );
  const people = useMemo(
    () => [
      ...(data.dev_contribution ?? []).filter((row) => row.project === project && row.release === release),
      ...(data.qa_contribution ?? []).filter((row) => row.project === project && row.release === release),
    ].sort((a, b) => b.hours_saved - a.hours_saved),
    [data.dev_contribution, data.qa_contribution, project, release],
  );
  const waterfall = useMemo<AIBenefitWaterfall | undefined>(
    () => (data.benefit_waterfall ?? []).find((row) => row.project === project && row.release === release),
    [data.benefit_waterfall, project, release],
  );
  const narrative = useMemo<AINarrativeBlock | undefined>(
    () => (data.narratives ?? []).find((row) => row.project === project && row.release === release),
    [data.narratives, project, release],
  );
  const flow = useMemo<AIReleaseFlow | undefined>(
    () => (data.release_flow ?? []).find((row) => row.project === project && row.release === release),
    [data.release_flow, project, release],
  );
  const health = (data.health ?? []).find((row) => row.project === project);

  const waterRows = useMemo(() => {
    if (!waterfall) return [];
    let running = 0;
    return waterfall.steps.map((step) => {
      const isFinal = step.step.toLowerCase().includes('final') || step.step.toLowerCase().includes('baseline');
      const value = step.value ?? 0;
      if (isFinal && step.step.toLowerCase().includes('final')) {
        return { name: step.step.replace(' realized', ''), base: 0, delta: Math.abs(value), sign: 'up', captured: step.captured, raw: step.value, hours: value / 40 };
      }
      if (step.step.toLowerCase().includes('baseline')) {
        running = value;
        return { name: 'Baseline', base: 0, delta: Math.abs(value), sign: 'base', captured: step.captured, raw: step.value, hours: value / 40 };
      }
      const base = value >= 0 ? running : running + value;
      running += value;
      return {
        name: step.step.replace(' savings', '').replace(' reduction', ''),
        base: Math.max(0, base),
        delta: Math.abs(value),
        sign: value >= 0 ? 'up' : 'down',
        captured: step.captured,
        raw: step.value,
        hours: value / 40,
      };
    });
  }, [waterfall]);

  const hoursMax = Math.max(...people.map((row) => row.hours_saved), 1);
  const tokensMax = Math.max(...people.map((row) => row.tokens || 0), 1);
  const cert = releaseCertification(summary?.health_score ?? health?.health_score, summary?.certification);
  const bullets = useMemo(() => {
    const blocks: { title: string; line: string; tone: string }[] = [];
    const push = (title: string, lines: string[] | undefined, tone: string, fallback: string) => {
      blocks.push({ title, line: lines?.[0] || fallback, tone });
    };
    push('Key Successes', narrative?.key_wins, 'green', `${fmt(summary?.hours_saved, 1)} h saved · ${money(summary?.est_savings)} value this release.`);
    push('Key Risks', narrative?.low_adoption, 'red', people.some((p) => p.domain === 'QA') ? 'Monitor QA contribution variance.' : 'QA has no AI evidence this release.');
    push('Missed Opportunities', narrative?.missed_opportunities, 'amber', health?.unrealized_value_usd ? `Recover ${money(health.unrealized_value_usd)} portfolio unrealized on this project.` : 'Quantify remaining Estimated / blank activity rows.');
    push('High Performers', narrative?.high_performers, 'green', people[0] ? `${people[0].name} led with ${fmt(people[0].hours_saved, 1)} h.` : 'No quantified contributors yet.');
    push('Next Release Actions', narrative?.actions, 'info', health?.recommendation ? `Primary: ${health.recommendation}.` : 'Import Cursor export; close QA evidence gap; coach unquantified users.');
    return blocks.slice(0, 5);
  }, [narrative, summary, people, health]);

  const flowCoverage = useMemo(() => {
    const stages = flow?.stages ?? [];
    if (!stages.length) return null;
    const touched = stages.filter((s) => (s.hours || 0) > 0 || (s.touchpoints || 0) > 0).length;
    return Math.round((touched / stages.length) * 100);
  }, [flow]);

  return (
    <div className="ai-p3 h-full min-h-0 min-w-0 overflow-hidden">
      <section className="glass-panel rounded-xl px-2.5 py-1.5 ai-p3-head shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <button type="button" className="ai-crumb shrink-0" onClick={onBack} aria-label="Back to project">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <nav className="flex items-center gap-1 text-[11px] min-w-0" aria-label="AI use breadcrumb">
            <button type="button" className="ai-crumb" onClick={onGoPortfolio}>AI use</button>
            <span className="opacity-50" aria-hidden="true">›</span>
            <button type="button" className="ai-crumb" onClick={onGoProject}>{project}</button>
            <span className="opacity-50" aria-hidden="true">›</span>
            <span className="ai-crumb is-on">{release}</span>
          </nav>
          <span className={`ai-chip ${BAND[certBand(cert)]}`} title="Release certification Elite→Critical">{cert}</span>
          <span className="text-[10px] font-mono ml-1 truncate" style={{ color: 'var(--muted)' }}>
            {summary?.release_date || 'Date n/a'} · Manager {summary?.manager || summary?.owner || health?.manager || '—'} · Health {fmt(summary?.health_score ?? health?.health_score, 0)}
            {' · '}{fmt(summary?.hours_saved, 1)} h · {money(summary?.est_savings)}
            {flowCoverage != null ? ` · Flow ${flowCoverage}%` : ''}
          </span>
        </div>
      </section>

      <div className="ai-p3-mid">
        <section className="glass-panel rounded-xl p-2.5 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
            <span className="block text-xs font-bold">Contribution matrix</span>
            <span className="block text-[9px]" style={{ color: 'var(--muted)' }}>Who turned AI into delivered work? Click a name for Profile.</span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="ai-roster-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Type</th>
                  <th className="num">AI%</th>
                  <th className="num">Hrs</th>
                  <th className="num">Tokens</th>
                  <th className="num">Impact</th>
                  <th className="num">Assets</th>
                </tr>
              </thead>
              <tbody>
                {people.map((row) => (
                  <PersonRow key={`${row.domain}-${row.name}-${row.employee_number}`} row={row} hoursMax={hoursMax} tokensMax={tokensMax} onSelectEmployee={onSelectEmployee} />
                ))}
                {people.length === 0 && (
                  <tr><td colSpan={7}>No contribution rows this release.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="glass-panel rounded-xl p-2.5 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
            <span className="block text-xs font-bold">AI release flow</span>
            <span className="block text-[9px]" style={{ color: 'var(--muted)' }}>
              Hours · value · coverage {flowCoverage == null ? 'n/a' : `${flowCoverage}%`}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ReleaseFlowSvg stages={flow?.stages ?? []} />
          </div>
        </section>
      </div>

      <div className="ai-p3-low">
        <section className="glass-panel rounded-xl p-2.5 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
            <div>
              <span className="block text-xs font-bold">Benefit waterfall</span>
              <span className="block text-[9px]" style={{ color: 'var(--muted)' }}>Hours + $ path to realized value</span>
            </div>
            <span className="text-[10px] font-mono">Net {money(waterfall?.net_value)} · Prod {pct(waterfall?.productivity_pct)}</span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number, _n, item) => [
                    item.payload.raw == null ? 'n/a' : `${money(item.payload.raw)} · ${fmt(item.payload.hours, 1)} h`,
                    item.payload.name,
                  ]}
                />
                <Bar dataKey="base" stackId="w" fill="transparent" />
                <Bar dataKey="delta" stackId="w" radius={2}>
                  {waterRows.map((row) => (
                    <Cell key={row.name} fill={!row.captured ? '#94a3b8' : row.name === 'Final' || row.sign === 'base' ? '#0284c7' : row.sign === 'down' ? '#be123c' : '#047857'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="glass-panel rounded-xl p-2.5 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
            <span className="block text-xs font-bold">Executive narrative</span>
            <span className="block text-[9px]" style={{ color: 'var(--muted)' }}>Mandatory 5 bullets · Situation · Risk · Opportunity · Who · Next</span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar flex flex-col gap-1.5 pt-1">
            {bullets.map((block) => (
              <div key={block.title} className={`ai-attn-card border-l-4 ${BAND[block.tone] || BAND.neutral}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wide">{block.title}</span>
                <span className="block text-[11px] leading-snug">{block.line}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PersonRow({
  row,
  hoursMax,
  tokensMax,
  onSelectEmployee,
}: {
  row: AIPersonContrib;
  hoursMax: number;
  tokensMax: number;
  onSelectEmployee: (empNumber: number) => void;
}) {
  const canOpen = typeof row.employee_number === 'number' && row.employee_number > 0;
  const openProfile = () => {
    if (canOpen) onSelectEmployee(row.employee_number as number);
  };
  return (
    <tr
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      title={canOpen ? `Open Profile · ${row.name}` : 'Add Employee number on AI utilization'}
      aria-disabled={canOpen ? undefined : true}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (!canOpen) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProfile();
        }
      }}
    >
      <td className="font-bold">{row.name}</td>
      <td>{row.activity_type || row.domain}</td>
      <td className="num">{pct(row.usage_pct)}</td>
      <td className="num">
        <span className="ai-cell-bar"><span style={{ width: `${(row.hours_saved / hoursMax) * 100}%` }} /></span>
        {fmt(row.hours_saved, 1)}
      </td>
      <td className="num">
        <span className="ai-cell-bar"><span style={{ width: `${((row.tokens || 0) / tokensMax) * 100}%` }} /></span>
        {row.tokens ? fmt(row.tokens) : '—'}
      </td>
      <td className="num">{money(row.impact_usd)}</td>
      <td className="num">{(row.test_cases || 0) + (row.automation_assets || 0) || (row.code_generated ? 'Y' : '—')}</td>
    </tr>
  );
}

function ReleaseFlowSvg({ stages }: { stages: { stage: string; hours: number; value: number; touchpoints: number }[] }) {
  const items = stages.length ? stages : [
    { stage: 'Requirements', hours: 0, value: 0, touchpoints: 0 },
    { stage: 'Development', hours: 0, value: 0, touchpoints: 0 },
    { stage: 'Testing', hours: 0, value: 0, touchpoints: 0 },
    { stage: 'Deployment', hours: 0, value: 0, touchpoints: 0 },
  ];
  const max = Math.max(...items.map((row) => row.hours || row.touchpoints), 1);
  const width = 520;
  const height = 128;
  const boxW = 96;
  const gap = (width - boxW * items.length) / (items.length + 1);
  const boxes = items.map((row, index) => {
    const x = gap + index * (boxW + gap);
    const h = 34 + (row.hours / max) * 36;
    const y = (height - h) / 2;
    return { ...row, x, y, h };
  });
  const paths = boxes.slice(0, -1).map((left, index) => {
    const right = boxes[index + 1];
    const thickness = 4 + ((left.hours + right.hours) / (max * 2)) * 16;
    const x1 = left.x + boxW;
    const y1 = left.y + left.h / 2;
    const x2 = right.x;
    const y2 = right.y + right.h / 2;
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1 - thickness / 2} C ${mid} ${y1 - thickness / 2}, ${mid} ${y2 - thickness / 2}, ${x2} ${y2 - thickness / 2} L ${x2} ${y2 + thickness / 2} C ${mid} ${y2 + thickness / 2}, ${mid} ${y1 + thickness / 2}, ${x1} ${y1 + thickness / 2} Z`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ai-flow-svg" role="img" aria-label="Release AI flow">
      {paths.map((d) => (
        <path key={d} d={d} fill="rgba(2,132,199,0.28)" />
      ))}
      {boxes.map((box) => (
        <g key={box.stage}>
          <rect x={box.x} y={box.y} width={boxW} height={box.h} rx="6" fill="#0284c7" opacity={0.18 + (box.hours / max) * 0.55} stroke="#0284c7" />
          <text x={box.x + boxW / 2} y={box.y + box.h / 2 - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">{box.stage}</text>
          <text x={box.x + boxW / 2} y={box.y + box.h / 2 + 4} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, Consolas, monospace" fill="currentColor">{box.hours.toFixed(0)} h</text>
          <text x={box.x + boxW / 2} y={box.y + box.h / 2 + 15} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, Consolas, monospace" fill="currentColor">${Math.round(box.value || 0)}</text>
        </g>
      ))}
    </svg>
  );
}
