import React from 'react';
import { FilterX, RotateCcw, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  onResetFilters?: () => void;
  resetLabel?: string;
  compact?: boolean;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'No data matches the selected filter combination. Try adjusting or clearing your filters.',
  icon: Icon = FilterX,
  onResetFilters,
  resetLabel = 'Reset Active Filters',
  compact = false,
  children,
}) => {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center my-auto">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-2">
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{title}</p>
        {description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mb-2.5">{description}</p>
        )}
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 border border-cyan-200 dark:border-cyan-800 rounded-md transition-colors shadow-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{resetLabel}</span>
          </button>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 my-2">
      <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800 flex items-center justify-center mb-3 shadow-xs">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      <div className="flex items-center gap-2">
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 rounded-lg transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{resetLabel}</span>
          </button>
        )}
        {children}
      </div>
    </div>
  );
};
