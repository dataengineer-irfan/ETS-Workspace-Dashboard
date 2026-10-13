import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAccessTab, formatRole, getRoleBadgeStyle } from '../../utils/rbac';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredTab?: string;
  onNavigateHome?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredTab,
  onNavigateHome,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-3" />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight font-mono">
          Authenticating enterprise session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredTab && !canAccessTab(user?.role, requiredTab)) {
    const badge = getRoleBadgeStyle(user?.role);
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-[400px]">
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full border border-rose-200 dark:border-rose-900/50 shadow-2xl text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 ring-8 ring-rose-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-rose-600 dark:text-rose-400">
            HTTP 403 Forbidden
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Access Restricted
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            Your current assigned role does not hold authorization to inspect the{' '}
            <strong className="text-slate-800 dark:text-slate-200 uppercase">{requiredTab}</strong> analytics module.
          </p>

          <div className="mt-4 px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>
            <span className="text-slate-500 dark:text-slate-400">Current Role:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold border ${badge.bg} ${badge.text} ${badge.border}`}>
              {formatRole(user?.role)}
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateHome || (() => window.location.href = '/dashboard')}
            className="mt-6 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Workforce Overview
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
