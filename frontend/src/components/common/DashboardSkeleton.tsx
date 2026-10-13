import React from 'react';

interface DashboardSkeletonProps {
  variant?: 'workforce' | 'client' | 'tech' | 'compensation' | 'calendar' | 'table';
  title?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  variant = 'workforce',
  title = 'Loading Dashboard Data...',
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full animate-pulse p-4 space-y-4 overflow-hidden">
      {/* Top Banner / Breadcrumb Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="w-2 h-2 rounded-full bg-cyan-500/40 animate-ping" />
        </div>
      </div>

      {/* KPI Cards Row Skeleton (6 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="glass-panel p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col justify-between h-[82px]"
          >
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="space-y-1.5 my-1">
              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded font-mono" />
              <div className="h-2 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      {variant === 'calendar' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[360px]">
          {/* Calendar Left: Employee selector skeleton */}
          <div className="lg:col-span-1 glass-panel p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col space-y-3">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
            <div className="space-y-2 flex-1">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
              ))}
            </div>
          </div>
          {/* Calendar Right: Month Grid Skeleton */}
          <div className="lg:col-span-3 glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="grid grid-cols-7 gap-2 flex-1 pt-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-200/60 dark:bg-slate-800/50 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ) : variant === 'table' ? (
        <div className="flex-1 glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col space-y-3 min-h-[360px]">
          <div className="flex justify-between items-center">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="space-y-2 flex-1 pt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-11 bg-slate-200/70 dark:bg-slate-800/60 rounded-lg w-full flex items-center px-4 space-x-4">
                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                <div className="h-3 w-32 bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-3 w-24 bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-3 w-20 bg-slate-300 dark:bg-slate-700 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[340px]">
          {/* Chart Left (7 cols) */}
          <div className="lg:col-span-7 glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="flex-1 flex items-end justify-between gap-3 pt-6 pb-2 px-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-10 rounded-t-md bg-slate-200 dark:bg-slate-800"
                  style={{ height: `${25 + ((i * 17) % 65)}%` }}
                />
              ))}
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800/40 rounded mt-2" />
          </div>

          {/* Chart Right (5 cols) */}
          <div className="lg:col-span-5 glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="flex-1 flex items-center justify-center my-2">
              <div className="w-36 h-36 rounded-full border-8 border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-200/50 dark:bg-slate-800/50" />
              </div>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-2.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Ticker */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          {title}
        </span>
        <span className="font-mono text-[10px]">Synchronizing telemetry...</span>
      </div>
    </div>
  );
};
