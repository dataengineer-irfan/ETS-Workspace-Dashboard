import React from 'react';
import type { TrainingRecord } from '../../types/dashboard';
import { GraduationCap } from 'lucide-react';

const STATUS_ORDER = [
  { key: 'Planned', label: 'Planned' },
  { key: 'In progress', label: 'In progress' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
] as const;

function countStatus(rows: TrainingRecord[], status: string) {
  return rows.filter((row) => row.status.toLowerCase() === status.toLowerCase()).length;
}

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key === 'completed') return 'is-completed';
  if (key === 'in progress') return 'is-progress';
  if (key === 'planned') return 'is-planned';
  if (key === 'cancelled') return 'is-cancelled';
  return '';
}

export const TrainingDetail: React.FC<{ trainings?: TrainingRecord[] | null }> = ({ trainings }) => {
  const rows = trainings || [];

  if (rows.length === 0) {
    return (
      <div id="training-detail" className="profile-training border-t border-slate-100 dark:border-slate-800 px-2.5 py-1 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-2 min-w-0 min-h-0 h-full">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1 min-w-0">
          <GraduationCap className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">Training</span>
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Not recorded yet</span>
      </div>
    );
  }

  return (
    <div id="training-detail" className="profile-training border-t border-slate-100 dark:border-slate-800 px-2.5 py-1 bg-slate-50/70 dark:bg-slate-900/40 min-w-0 min-h-0 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1 min-w-0">
          <GraduationCap className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">Training</span>
        </span>
        <span className="text-[10px] font-mono text-slate-500 shrink-0">{rows.length} records</span>
      </div>
      <div className="profile-train-counts">
        {STATUS_ORDER.map((status) => (
          <div key={status.key} className={`profile-train-count ${statusTone(status.key)}`}>
            <b>{countStatus(rows, status.key)}</b>
            <span>{status.label}</span>
          </div>
        ))}
      </div>
      <div className="profile-train-list flex-1 min-h-0 overflow-auto custom-scrollbar mt-1">
        {rows.map((row, index) => {
          const when = row.start_date || 'Date not set';
          const hours = row.hours != null ? `${row.hours}h` : 'Hours not set';
          return (
            <div key={`${row.name}-${index}`} className="profile-train-row">
              <span className={`profile-train-mark ${statusTone(row.status)}`} aria-hidden="true" />
              <div className="profile-train-copy">
                <span className="profile-train-name">{row.name}</span>
                <span className="profile-train-meta">
                  <span className={`profile-train-status ${statusTone(row.status)}`}>{row.status || 'Status not set'}</span>
                  <span>{hours}</span>
                  <span className="font-mono">{when}</span>
                  {row.provider ? <span>{row.provider}</span> : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
