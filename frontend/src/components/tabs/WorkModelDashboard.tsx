import React, { useMemo, useState } from 'react';
import type { WorkModelKPIs, WorkModelSlice } from '../../types/dashboard';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
import { ExportButton } from '../common/ExportButton';
import { Users } from 'lucide-react';

const MODEL_ORDER = ['Office', 'Hybrid', 'Remote', 'Client site', 'Not recorded yet'] as const;
const GRADE_AXIS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'] as const;

const MODEL_COLORS: Record<string, string> = {
  Office: '#0284c7',
  Hybrid: '#0d9488',
  Remote: '#7c3aed',
  'Client site': '#d97706',
  'Not recorded yet': '#94a3b8',
};

interface WorkModelDashboardProps {
  data: WorkModelKPIs | null;
  loading: boolean;
  onSelectEmployee: (empNumber: number) => void;
}

type RosterRow = WorkModelKPIs['roster'][number];
type SliceRow = WorkModelSlice & Record<string, string | number>;
type LocalFilters = {
  model: string | null;
  city: string | null;
  account: string | null;
  grade: string | null;
  department: string | null;
  office: string | null;
};

function modelCount(row: SliceRow, model: string) {
  const value = row[model];
  return typeof value === 'number' ? value : Number(value) || 0;
}

function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function inkOn(model: string) {
  return model === 'Client site' || model === 'Not recorded yet' ? '#0f172a' : '#f8fafc';
}

function leaders(row: SliceRow) {
  let max = 0;
  for (const model of MODEL_ORDER) max = Math.max(max, modelCount(row, model));
  const models = MODEL_ORDER.filter((model) => modelCount(row, model) === max && max > 0);
  return { models, count: max };
}

function leadText(row: SliceRow) {
  const lead = leaders(row);
  if (lead.models.length === 0) return 'None';
  if (lead.models.length > 1) return `Tied ${lead.count}`;
  return `${lead.models[0]} ${lead.count}`;
}

function byHeadcount(rows: SliceRow[]) {
  return [...rows].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
}

function plain(value: unknown, blank: string) {
  const text = String(value ?? '').trim();
  const token = text.toLowerCase();
  if (!text || token === 'nan' || token === 'none' || token === 'nat') return blank;
  return text;
}

function modelOf(row: RosterRow) {
  return plain(row.Work_Model, 'Not recorded yet');
}

function cityOf(row: RosterRow) {
  return plain(row.LOCATION, 'Not recorded');
}

function accountOf(row: RosterRow) {
  return plain(row.State, 'Not recorded');
}

function gradeOf(row: RosterRow) {
  return plain(row['JOB LEVEL'], 'Not recorded');
}

function departmentOf(row: RosterRow) {
  return plain(row.DEPARTMENT, 'Not recorded');
}

function officeOf(row: RosterRow) {
  return plain(row.Office, '');
}

function officeLabel(office: string) {
  const name = office.split('—').at(-1)?.trim() || office;
  if (name.startsWith('Whitefield')) return 'Whitefield';
  return name.split(',')[0].replace(/\s*\([^)]*\)/g, '').trim();
}

function round1(value: number) {
  const sign = value < 0 ? -1 : 1;
  const scaled = Math.abs(value) * 10;
  const base = Math.floor(scaled + 1e-10);
  const frac = scaled - base;
  const rounded = frac > 0.5 + 1e-10 ? base + 1 : frac >= 0.5 - 1e-10 ? (base % 2 === 0 ? base : base + 1) : base;
  return (sign * rounded) / 10;
}

function emptySlice(label: string, name: string): SliceRow {
  return {
    [label]: name,
    total: 0,
    Office: 0,
    Hybrid: 0,
    Remote: 0,
    'Client site': 0,
    'Not recorded yet': 0,
  };
}

function emptyGrade(jobLevel: string): SliceRow {
  return emptySlice('job_level', jobLevel);
}

function people(rows: RosterRow[], filters: LocalFilters, skip: keyof LocalFilters | null) {
  return rows.filter((row) => {
    if (skip !== 'model' && filters.model && modelOf(row) !== filters.model) return false;
    if (skip !== 'city' && filters.city && cityOf(row) !== filters.city) return false;
    if (skip !== 'account' && filters.account && accountOf(row) !== filters.account) return false;
    if (skip !== 'grade' && filters.grade && gradeOf(row) !== filters.grade) return false;
    if (skip !== 'department' && filters.department && departmentOf(row) !== filters.department) return false;
    if (skip !== 'office' && filters.office && officeOf(row) !== filters.office) return false;
    return true;
  });
}

function breakdown(rows: RosterRow[], keyFn: (row: RosterRow) => string, label: string, skipBlank = false) {
  const map = new Map<string, SliceRow>();
  for (const row of rows) {
    const name = keyFn(row);
    if (skipBlank && !name) continue;
    let entry = map.get(name);
    if (!entry) {
      entry = emptySlice(label, name);
      map.set(name, entry);
    }
    const model = modelOf(row);
    entry.total = Number(entry.total) + 1;
    if ((MODEL_ORDER as readonly string[]).includes(model)) {
      entry[model] = modelCount(entry, model) + 1;
    }
  }
  return [...map.values()];
}

function withSelected(rows: SliceRow[], label: string, selected: string | null) {
  if (!selected || rows.some((row) => String(row[label]) === selected)) return rows;
  return byHeadcount([...rows, emptySlice(label, selected)]);
}

function mixFrom(rows: RosterRow[]) {
  const total = rows.length;
  const counts = new Map<string, number>();
  for (const model of MODEL_ORDER) counts.set(model, 0);
  for (const row of rows) {
    const model = modelOf(row);
    counts.set(model, (counts.get(model) || 0) + 1);
  }
  const mix: { model: string; count: number; percentage: number }[] = MODEL_ORDER.map((model) => {
    const count = counts.get(model) || 0;
    return { model, count, percentage: total ? round1((count / total) * 100) : 0 };
  });
  for (const [model, count] of counts) {
    if (!(MODEL_ORDER as readonly string[]).includes(model)) {
      mix.push({ model, count, percentage: total ? round1((count / total) * 100) : 0 });
    }
  }
  return mix;
}

function gradeMatrix(rows: SliceRow[], selected: string | null) {
  const byLevel = new Map(rows.map((row) => [String(row.job_level), row]));
  const axis = GRADE_AXIS.map((level) => byLevel.get(level) || emptyGrade(level));
  const extra = rows.filter((row) => !(GRADE_AXIS as readonly string[]).includes(String(row.job_level)));
  if (
    selected
    && !(GRADE_AXIS as readonly string[]).includes(selected)
    && !extra.some((row) => String(row.job_level) === selected)
  ) {
    extra.push(emptyGrade(selected));
  }
  return [...axis, ...extra];
}

function CardFrame({
  title,
  hint,
  card,
  children,
}: {
  title: string;
  hint: string;
  card: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden shadow-2xs min-h-0 min-w-0 h-full" data-card={card}>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0 gap-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight truncate">{title}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">{hint}</span>
      </div>
      <div className="flex-1 min-h-0 min-w-0 pt-1 flex flex-col">{children}</div>
    </section>
  );
}

function NoneInFilter() {
  return <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 py-2">None in this filter.</p>;
}

function shortModel(model: string) {
  if (model === 'Client site') return 'Client';
  if (model === 'Not recorded yet') return 'Unrecorded';
  return model;
}

export const WorkModelDashboard: React.FC<WorkModelDashboardProps> = ({ data, loading, onSelectEmployee }) => {
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [officeFilter, setOfficeFilter] = useState<string | null>(null);

  const filters = useMemo<LocalFilters>(() => ({
    model: modelFilter,
    city: cityFilter,
    account: accountFilter,
    grade: gradeFilter,
    department: departmentFilter,
    office: officeFilter,
  }), [modelFilter, cityFilter, accountFilter, gradeFilter, departmentFilter, officeFilter]);

  const view = useMemo(() => {
    const all = data?.roster || [];
    const mixRows = people(all, filters, 'model');
    const roster = people(all, filters, null);
    const recorded = (rows: RosterRow[]) => rows.filter((row) => modelOf(row) !== 'Not recorded yet').length;
    return {
      mix: mixFrom(mixRows),
      headcount: mixRows.length,
      recorded: recorded(mixRows),
      cities: withSelected(byHeadcount(breakdown(people(all, filters, 'city'), cityOf, 'location')), 'location', filters.city),
      accounts: withSelected(byHeadcount(breakdown(people(all, filters, 'account'), accountOf, 'account')), 'account', filters.account),
      grades: gradeMatrix(breakdown(people(all, filters, 'grade'), gradeOf, 'job_level'), filters.grade),
      departments: withSelected(byHeadcount(breakdown(people(all, filters, 'department'), departmentOf, 'department')), 'department', filters.department),
      offices: withSelected(byHeadcount(breakdown(people(all, filters, 'office'), officeOf, 'office', true)), 'office', filters.office),
      anyOffice: all.some((row) => officeOf(row)),
      roster,
      rosterRecorded: recorded(roster),
    };
  }, [data, filters]);

  const toggleModel = (model: string) => {
    setModelFilter((current) => (current === model ? null : model));
  };

  const toggleValue = (current: string | null, next: string, set: (value: string | null) => void) => {
    set(current === next ? null : next);
  };

  const toggleCell = (level: string, model: string) => {
    if (gradeFilter === level && modelFilter === model) {
      setGradeFilter(null);
      setModelFilter(null);
      return;
    }
    setGradeFilter(level);
    setModelFilter(model);
  };

  const clearFilters = () => {
    setModelFilter(null);
    setCityFilter(null);
    setAccountFilter(null);
    setGradeFilter(null);
    setDepartmentFilter(null);
    setOfficeFilter(null);
  };

  if (loading || !data) {
    return <DashboardSkeleton variant="workforce" />;
  }

  if (data.headcount === 0) {
    return (
      <EmptyState
        title="No people in this filter"
        description="Work model follows the same account, city, grade, and department filters as the rest of the dashboard."
      />
    );
  }

  const mix = view.mix;
  const roster = view.roster;
  const filtersClear = !modelFilter && !cityFilter && !accountFilter && !gradeFilter && !departmentFilter && !officeFilter;
  const allUnrecorded = view.headcount > 0 && view.recorded === 0;
  const openProfile = (empNumber: number) => onSelectEmployee(empNumber);
  const cities = view.cities;
  const accounts = view.accounts;
  const grades = view.grades;
  const departments = view.departments;
  const offices = view.offices;
  const cityMax = Math.max(...cities.map((item) => Number(item.total) || 0), 1);
  const heatMax = grades.reduce((max, row) => {
    return MODEL_ORDER.reduce((inner, model) => Math.max(inner, modelCount(row, model)), max);
  }, 0);
  const filterBits = [cityFilter, accountFilter, gradeFilter, departmentFilter, officeFilter, modelFilter].filter(
    (item): item is string => Boolean(item),
  );
  const rosterChip = `${roster.length} people${filterBits.length ? ` · ${filterBits.join(' · ')}` : ''}`;
  const otherFilters = Boolean(cityFilter || accountFilter || gradeFilter || departmentFilter || officeFilter);
  const emptyRoster = modelFilter && !otherFilters
    ? `No one is recorded as ${modelFilter}.`
    : 'None in this filter.';

  return (
    <div className="dash-fit work-model-fit flex flex-col gap-2 select-none min-h-0" data-dashboard="work-model">
      <div className="wm-kpis shrink-0">
        <button
          type="button"
          onClick={clearFilters}
          className={`glass-panel rounded-xl px-2.5 py-1.5 text-left min-w-0 cursor-pointer border-l-4 border-l-cyan-600 ${filtersClear ? 'ring-1 ring-cyan-600/50' : ''}`}
          aria-pressed={filtersClear}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <Users className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span className="text-[9.5px] font-bold tracking-[0.06em] uppercase truncate text-cyan-900 dark:text-cyan-300">Headcount</span>
          </span>
          <span className="mt-0.5 flex items-baseline justify-between gap-1 min-w-0">
            <span className="text-base font-black font-mono tracking-tight text-cyan-950 dark:text-cyan-200">{view.headcount}</span>
            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 shrink-0">In scope</span>
          </span>
        </button>
        {mix.map((item) => {
          const active = modelFilter === item.model;
          const color = MODEL_COLORS[item.model] || '#64748b';
          return (
            <button
              key={item.model}
              type="button"
              onClick={() => toggleModel(item.model)}
              aria-pressed={active}
              className="glass-panel rounded-xl px-2.5 py-1.5 text-left min-w-0 cursor-pointer"
              style={{
                borderTop: `2px solid ${color}`,
                boxShadow: active ? `inset 0 0 0 1px ${color}` : undefined,
              }}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[9.5px] font-bold tracking-[0.06em] uppercase truncate" style={{ color: 'var(--muted)' }}>{item.model}</span>
              </span>
              <span className="mt-0.5 flex items-baseline justify-between gap-1 min-w-0">
                <span className="text-base font-black font-mono tracking-tight" style={{ color: 'var(--text)' }}>{item.count}</span>
                <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--muted)' }}>{item.percentage}%</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="pane-charts work-model-charts gap-2 min-h-0">
        <section className="glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden shadow-2xs min-h-0 min-w-0 h-full" data-card="mix">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0 gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight truncate">Work model mix</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
              {allUnrecorded ? 'Not recorded yet' : `${data.history_rows} history rows`}
            </span>
          </div>
          {allUnrecorded && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 shrink-0">
              Not recorded yet covers this cohort. It is a real category on the People sheet.
            </p>
          )}
          {view.headcount === 0 ? <NoneInFilter /> : (
            <div className="wm-mix flex-1 min-h-0" data-visual="composition">
              <div className="wm-mix-bar" role="group" aria-label="Work model composition">
                {mix.map((item) => {
                  if (item.count <= 0) return null;
                  const active = modelFilter === item.model;
                  const color = MODEL_COLORS[item.model] || '#64748b';
                  return (
                    <button
                      key={item.model}
                      type="button"
                      className={`wm-mix-seg${active ? ' is-on' : ''}`}
                      style={{ flexGrow: item.count, backgroundColor: color, color: inkOn(item.model) }}
                      onClick={() => toggleModel(item.model)}
                      aria-pressed={active}
                      aria-label={`${item.model}: ${item.count}, ${item.percentage}%`}
                    >
                      <span className="wm-mix-in">
                        <b>{item.count}</b>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="wm-mix-key">
                {mix.map((item) => {
                  const active = modelFilter === item.model;
                  const color = MODEL_COLORS[item.model] || '#64748b';
                  return (
                    <button
                      key={item.model}
                      type="button"
                      className={`wm-mix-key-item${active ? ' is-on' : ''}`}
                      onClick={() => toggleModel(item.model)}
                      aria-pressed={active}
                    >
                      <span className="wm-swatch" style={{ backgroundColor: color }} />
                      <span className="wm-mix-name" title={item.model}>
                        <span className="wm-mix-long">{item.model}</span>
                        <span className="wm-mix-short">{shortModel(item.model)}</span>
                      </span>
                      <span className="wm-mix-fig">{item.count} · {item.percentage}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <CardFrame title="By city" hint="People · City" card="city">
          {cities.length === 0 ? <NoneInFilter /> : (
            <div className="wm-cities wm-scroll custom-scrollbar" data-visual="ranks">
              {cities.map((row) => {
                const name = String(row.location ?? '');
                const lead = leaders(row);
                const tied = lead.models.length !== 1;
                const color = MODEL_COLORS[lead.models[0]] || '#64748b';
                const share = (Number(row.total) / cityMax) * 100;
                const leadLabel = leadText(row);
                const active = cityFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`wm-city${active ? ' is-on' : ''}`}
                    data-city={name}
                    aria-pressed={active}
                    onClick={() => toggleValue(cityFilter, name, setCityFilter)}
                  >
                    <span className="wm-city-name" title={name}>{name}</span>
                    <b className="wm-city-count">{row.total}</b>
                    <span className="wm-city-track" aria-hidden>
                      <span style={{ width: `${share}%`, backgroundColor: tied ? 'var(--muted)' : color }} />
                    </span>
                    <span className="wm-city-lead" style={{ color: tied ? 'var(--text)' : color }} title={leadLabel}>{leadLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardFrame>

        <CardFrame title="By account" hint="People · Account" card="account">
          {accounts.length === 0 ? <NoneInFilter /> : (
            <div className="wm-accounts wm-scroll custom-scrollbar" data-visual="accounts">
              {accounts.map((row) => {
                const name = String(row.account ?? '');
                const lead = leaders(row);
                const tied = lead.models.length !== 1;
                const color = MODEL_COLORS[lead.models[0]] || '#64748b';
                const leadLabel = leadText(row);
                const active = accountFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`wm-account${active ? ' is-on' : ''}`}
                    data-account={name}
                    aria-pressed={active}
                    onClick={() => toggleValue(accountFilter, name, setAccountFilter)}
                  >
                    <span className="wm-account-head">
                      <span className="wm-account-code" title={name}>{name}</span>
                      <b className="wm-account-count">{row.total}</b>
                    </span>
                    <div className="wm-account-strip" aria-hidden="true">
                      {MODEL_ORDER.map((model) => {
                        const count = modelCount(row, model);
                        if (count <= 0) return null;
                        return (
                          <span
                            key={model}
                            style={{ flexGrow: count, backgroundColor: MODEL_COLORS[model] }}
                          />
                        );
                      })}
                    </div>
                    <span className="wm-account-models">
                      {MODEL_ORDER.map((model) => {
                        const count = modelCount(row, model);
                        if (count <= 0) return null;
                        return (
                          <span key={model} className="wm-account-model" title={`${model}: ${count}`}>
                            <i style={{ backgroundColor: MODEL_COLORS[model] }} />
                            <span>{shortModel(model)}</span>
                            <b>{count}</b>
                          </span>
                        );
                      })}
                    </span>
                    <span className="wm-account-lead" style={{ color: tied ? 'var(--text)' : color }} title={leadLabel}>{leadLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardFrame>

        <section className="glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden shadow-2xs min-h-0 min-w-0 h-full" data-card="grade">
          <div className="wm-heat-scroll custom-scrollbar">
            <div
              className="wm-grade-grid"
              style={{ gridTemplateColumns: `minmax(0, max-content) repeat(${grades.length}, minmax(0, 1fr))` }}
            >
              <div className="wm-grade-head border-b border-slate-100 pb-1 dark:border-slate-800">
                <span className="wm-heat-title text-xs font-bold tracking-tight text-slate-800 truncate dark:text-slate-200">By grade</span>
                {grades.map((row) => {
                  const level = String(row.job_level);
                  const active = gradeFilter === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`wm-heat-grade${active ? ' is-on' : ''}`}
                      title={level}
                      data-grade={level}
                      aria-pressed={active}
                      onClick={() => toggleValue(gradeFilter, level, setGradeFilter)}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <div
                className="wm-heat"
                data-visual="heatmap"
                role="grid"
                aria-label="Work model counts by grade"
              >
              {MODEL_ORDER.map((model) => (
                <React.Fragment key={model}>
                  <span className="wm-heat-model" title={model} aria-label={model}>
                    <span className="wm-heat-long">{model}</span>
                    <span className="wm-heat-short">{shortModel(model)}</span>
                  </span>
                  {grades.map((row) => {
                    const level = String(row.job_level);
                    const count = modelCount(row, model);
                    const active = gradeFilter === level && modelFilter === model;
                    const t = heatMax > 0 ? count / heatMax : 0;
                    const background = count <= 0
                      ? 'var(--panel-alt)'
                      : hexAlpha(MODEL_COLORS[model], 0.18 + t * 0.72);
                    const color = count > 0 && t > 0.55 && model !== 'Client site' && model !== 'Not recorded yet'
                      ? '#f8fafc'
                      : 'var(--text)';
                    return (
                      <button
                        key={`${level}-${model}`}
                        type="button"
                        className={`wm-heat-cell${active ? ' is-on' : ''}`}
                        data-grade={level}
                        data-model={model}
                        title={`${level} ${model}: ${count}`}
                        aria-label={`${level} ${model} ${count}`}
                        aria-pressed={active}
                        style={{ background, color }}
                        onClick={() => toggleCell(level, model)}
                      >
                        {count > 0 ? <b>{count}</b> : null}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
              </div>
            </div>
          </div>
        </section>

        <CardFrame title="By department" hint="People · Department" card="department">
          {departments.length === 0 ? <NoneInFilter /> : (
            <div className="wm-ranks wm-scroll custom-scrollbar" data-visual="ranks">
              {departments.map((row) => {
                const name = String(row.department ?? '');
                const lead = leaders(row);
                const color = MODEL_COLORS[lead.models[0]] || '#64748b';
                const tied = lead.models.length !== 1;
                const leadLabel = leadText(row);
                const active = departmentFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`wm-rank${active ? ' is-on' : ''}`}
                    data-department={name}
                    aria-pressed={active}
                    onClick={() => toggleValue(departmentFilter, name, setDepartmentFilter)}
                  >
                    <span className="wm-rank-name" title={name}>{name}</span>
                    <span
                      className="wm-rank-lead"
                      style={{ color: tied ? 'var(--text)' : color }}
                      title={leadLabel}
                    >
                      {leadLabel}
                    </span>
                    <b className="wm-rank-total">{row.total}</b>
                  </button>
                );
              })}
            </div>
          )}
        </CardFrame>

        <section className="glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden shadow-2xs min-h-0 min-w-0 h-full" data-card="office">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0 gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Office / building</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">People · Office</span>
          </div>
          {!view.anyOffice ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Not recorded yet</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-[16rem]">
                The Office column is on the People sheet. No building is filled for this cohort.
              </p>
            </div>
          ) : offices.length === 0 ? <NoneInFilter /> : (
            <div className="wm-offices wm-scroll custom-scrollbar" data-visual="ranks">
              {offices.map((row) => {
                const name = String(row.office ?? '');
                const active = officeFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`wm-office${active ? ' is-on' : ''}`}
                    data-office={name}
                    aria-pressed={active}
                    onClick={() => toggleValue(officeFilter, name, setOfficeFilter)}
                  >
                    <span className="wm-office-name" title={`${name}: ${row.total}`}>{officeLabel(name)}</span>
                    <b className="wm-office-count">{row.total}</b>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="pane-roster glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden shadow-2xs min-h-0" data-roster>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Roster</span>
            <span
              className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700 font-semibold truncate min-w-0"
              title={rosterChip}
              data-roster-chip
            >
              {rosterChip}
            </span>
          </div>
          <ExportButton data={roster} filename="work_model_roster.csv" />
        </div>
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <table className="w-full min-w-[760px] text-left text-[11px] text-slate-700 dark:text-slate-300">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10">
              <tr>
                {['Name', 'City', 'Account', 'Grade', 'Department', 'Work model', 'Office', 'Employment'].map((label) => (
                  <th key={label} className="text-left py-1 px-2 font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">{emptyRoster}</td>
                </tr>
              ) : roster.map((row) => {
                const color = MODEL_COLORS[row.Work_Model] || '#64748b';
                const empNumber = row['EMPLOYEE NUMBER'];
                return (
                  <tr
                    key={empNumber}
                    data-emp={empNumber}
                    tabIndex={0}
                    role="button"
                    className="hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 cursor-pointer focus:outline-hidden focus:bg-cyan-50/40"
                    onClick={() => openProfile(empNumber)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openProfile(empNumber);
                      }
                    }}
                  >
                    <td className="py-1 px-2 font-medium text-slate-800 dark:text-slate-100">{row['EMPLOYEE LABEL'].replace(/\s*\(\d+\)\s*$/, '')}</td>
                    <td className="py-1 px-2">{row.LOCATION}</td>
                    <td className="py-1 px-2 font-mono">{row.State}</td>
                    <td className="py-1 px-2 font-mono">{row['JOB LEVEL']}</td>
                    <td className="py-1 px-2">{row.DEPARTMENT}</td>
                    <td className="py-1 px-2">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate">{row.Work_Model}</span>
                      </span>
                    </td>
                    <td className="py-1 px-2 text-slate-500">{row.Office || '—'}</td>
                    <td className="py-1 px-2">{row.Employment_Type || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 shrink-0">
          <span>Click a row to open the profile</span>
          <span className="font-mono">{view.rosterRecorded} recorded · {roster.length - view.rosterRecorded} not recorded yet</span>
        </div>
      </section>
    </div>
  );
};
