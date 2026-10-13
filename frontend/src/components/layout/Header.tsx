import React from 'react';
import { 
  BarChart3, 
  Sparkles, 
  RefreshCw, 
  Maximize2, 
  Users, 
  MapPin, 
  UserCheck, 
  Cpu, 
  BadgeIndianRupee, 
  TrendingUp, 
  CalendarDays,
  ShieldCheck,
  Moon,
  Sun,
  Briefcase,
  RotateCcw,
  Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAccessTab } from '../../utils/rbac';
import { UserMenuDropdown } from './UserMenuDropdown';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  totalEmployees: number;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  onOpenDatasetModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  copilotOpen,
  setCopilotOpen,
  onRefresh,
  loading,
  totalEmployees,
  theme,
  setTheme,
  activeFilterCount,
  onResetFilters,
  onOpenDatasetModal,
}) => {
  const { user } = useAuth();

  const tabs = [
    { id: 'home', label: 'Workforce', fullLabel: 'Workforce Overview', icon: Users },
    { id: 'techwise', label: 'Skills', fullLabel: 'Skills & Capability', icon: Cpu },
    { id: 'statewise', label: 'Client Delivery', fullLabel: 'Client Program Delivery', icon: Briefcase },
    { id: 'salarywise', label: 'Compensation', fullLabel: 'Compensation Analytics', icon: BadgeIndianRupee },
    { id: 'calendar', label: 'Leave', fullLabel: 'Leave & Attendance', icon: CalendarDays },
    { id: 'employee_details', label: 'Profile', fullLabel: 'Employee Profile', icon: UserCheck, isDrillthrough: true },
  ];

  const visibleTabs = tabs.filter((tab) => canAccessTab(user?.role, tab.id));

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header
      className="min-h-[48px] h-auto py-1 border-b px-3 flex items-center justify-between shrink-0 select-none z-30 gap-2"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(180deg, rgba(14,27,45,0.98), rgba(10,18,28,0.98))'
          : 'linear-gradient(180deg, rgba(15,23,42,0.02), rgba(255,255,255,0.78), var(--surface)), var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: theme === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 12px 30px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Brand & Title */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-teal-500 flex items-center justify-center shadow-sm shrink-0 ring-1 ring-white/20">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xs sm:text-sm font-bold tracking-[0.08em]" style={{ color: 'var(--text)' }}>ETS WORKFORCE</h1>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav role="tablist" aria-label="Executive Dashboards" className="flex items-center gap-1 p-0.5 rounded-xl mx-1 shrink min-w-0 overflow-x-auto no-scrollbar" style={{ background: theme === 'dark' ? 'rgba(18, 34, 58, 0.6)' : 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border)' }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <React.Fragment key={tab.id}>
              {tab.isDrillthrough && (
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700/80 mx-0.5 hidden sm:block" />
              )}
              <button
                role="tab"
                aria-selected={isActive}
                aria-label={tab.fullLabel}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                  isActive ? 'shadow-sm border font-semibold' : ''
                }`}
                style={
                  isActive
                    ? {
                        background: theme === 'dark'
                          ? 'linear-gradient(180deg, rgba(14,165,233,0.25), rgba(15,27,45,0.9))'
                          : 'linear-gradient(180deg, rgba(14,165,233,0.12), rgba(255,255,255,0.75))',
                        color: 'var(--cyan-strong)',
                        border: '1px solid var(--border-strong)',
                        boxShadow: theme === 'dark' ? '0 4px 14px rgba(14,165,233,0.25)' : '0 8px 20px rgba(14,165,233,0.12)',
                      }
                    : {
                        color: 'var(--muted)',
                        background: 'transparent',
                      }
                }
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? 'var(--cyan-strong)' : 'var(--muted)' }} />
                <span className="whitespace-nowrap hidden 2xl:inline">{tab.fullLabel}</span>
                <span className="whitespace-nowrap hidden sm:inline 2xl:hidden">{tab.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-2 shrink-0">
        {activeFilterCount && activeFilterCount > 0 && onResetFilters ? (
          <button
            onClick={onResetFilters}
            title="Click to reset all active filters"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 transition-all shadow-xs cursor-pointer text-xs group"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:rotate-[-45deg] transition-transform" />
            <span className="font-bold text-[11px]">Reset All ({activeFilterCount})</span>
            <span className="text-[10px] opacity-75 font-mono">· {totalEmployees}</span>
          </button>
        ) : (
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--success)' }} />
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Roster:</span>
            <span className="font-bold font-mono text-[11px]" style={{ color: 'var(--text)' }}>{totalEmployees}</span>
          </div>
        )}

        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title="Toggle theme"
          aria-label="Toggle dark and light theme"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400 cursor-pointer"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onOpenDatasetModal}
          title="Dataset Operations: Download, Upload & Cloud Sync"
          aria-label="Dataset operations and cloud sync"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400 cursor-pointer text-slate-300 hover:text-cyan-400"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
        >
          <Database className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onRefresh}
          title="Refresh Dataset Analytics"
          aria-label="Refresh dataset analytics"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400 cursor-pointer"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: loading ? 'var(--cyan-strong)' : 'var(--muted)' }} />
        </button>

        <button
          onClick={handleFullscreen}
          title="Toggle Fullscreen (Zero Scroll)"
          aria-label="Toggle fullscreen view"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400 cursor-pointer"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--text)' }} />
        </button>

        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          aria-label="Toggle ETS Genie assistant"
          aria-expanded={copilotOpen}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
          style={
            copilotOpen
              ? { background: 'var(--purple-strong)', color: '#fff', boxShadow: 'var(--shadow-soft)' }
              : { background: 'var(--purple-soft)', border: '1px solid var(--purple-border)', color: 'var(--purple-strong)' }
          }
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap font-bold hidden sm:inline">ETS Genie</span>
        </button>

        {/* Databricks-style User Profile & Workspace Dropdown */}
        <div className="pl-1 border-l border-slate-200 dark:border-slate-800 flex items-center">
          <UserMenuDropdown theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </header>
  );

};
