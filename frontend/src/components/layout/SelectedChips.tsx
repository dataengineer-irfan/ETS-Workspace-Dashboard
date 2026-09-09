import React from 'react';
import { X } from 'lucide-react';
import type { FilterParams } from '../../types/dashboard';

interface Props {
  filters: FilterParams;
  setFilters: React.Dispatch<React.SetStateAction<FilterParams>>;
}

export const SelectedChips: React.FC<Props> = ({ filters, setFilters }) => {
  const rawEntries = Object.entries(filters || {}) as [string, any][];
  if (rawEntries.length === 0) return null;

  const preferredOrder = ['project', 'manager', 'department', 'job_level', 'location', 'state', 'skill_name', 'year', 'search'];
  const entries = rawEntries.sort((a, b) => {
    const ai = preferredOrder.indexOf(a[0]);
    const bi = preferredOrder.indexOf(b[0]);
    if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const removeValue = (key: string, val?: string) => {
    setFilters((prev) => {
      const next = { ...prev } as any;
      const cur = next[key];
      if (cur === undefined) return next;
      if (val === undefined) {
        // remove entire key
        delete next[key];
        return next;
      }
      // remove single value from array or single value
      if (Array.isArray(cur)) {
        const remaining = cur.filter((v: any) => String(v) !== String(val));
        if (remaining.length === 0) delete next[key];
        else next[key] = remaining;
      } else {
        // single value -> remove key
        if (String(cur) === String(val)) delete next[key];
      }
      return next;
    });
  };

  const clearAll = () => setFilters({});

  return (
    <div className="px-3 py-1.5 bg-transparent border-b border-slate-200/60 dark:border-[#223755] flex items-center gap-3 overflow-x-auto custom-scrollbar text-sm">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Active Filters</span>
      </div>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {entries.map(([k, v]) => {
          const vals = Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v];
          if (vals.length === 0) return null;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <div className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {k}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {vals.map((vv: any) => (
                  <button
                    key={String(vv)}
                    onClick={() => removeValue(k, vv)}
                    title={`Remove ${vv}`}
                    className="flex items-center gap-1 text-[11px] bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-colors"
                  >
                    <span className="truncate max-w-[120px]">{String(vv)}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={clearAll}
          className="text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default SelectedChips;
