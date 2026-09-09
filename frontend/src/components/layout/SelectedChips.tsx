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
    <div className="px-3 py-1 bg-transparent border-b border-slate-200/60 dark:border-[#223755] flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs shrink-0 min-h-[26px]">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Filters</span>
      </div>

      <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
        {entries.map(([k, v]) => {
          const vals = Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v];
          if (vals.length === 0) return null;
          return (
            <div key={k} className="flex items-center gap-1">
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                {k}
              </span>
              <div className="flex items-center gap-1">
                {vals.map((vv: any) => (
                  <button
                    key={String(vv)}
                    onClick={() => removeValue(k, vv)}
                    title={`Remove ${vv}`}
                    className="flex items-center gap-1 text-[10px] bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                  >
                    <span className="truncate max-w-[120px] font-medium">{String(vv)}</span>
                    <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={clearAll}
          className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline px-1.5 py-0.2"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default SelectedChips;
