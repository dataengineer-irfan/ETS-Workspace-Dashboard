import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 select-none">
          <div 
            className="max-w-md w-full p-6 rounded-2xl border bg-white/90 dark:bg-slate-900/90 shadow-xl backdrop-blur-md text-center flex flex-col items-center"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-wide uppercase">
              {this.props.fallbackTitle || 'Component Render Interrupted'}
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              An unexpected render anomaly occurred in this dashboard module. You can attempt an in-memory reset or refresh the workspace session.
            </p>

            {this.state.error && (
              <div className="w-full mt-3 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left overflow-x-auto text-[10px] font-mono text-rose-700 dark:text-rose-300 max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-sm hover:brightness-105 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
