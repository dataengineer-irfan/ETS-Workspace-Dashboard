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
} from 'lucide-react';

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
}) => {
  const tabs = [
    { id: 'home', label: 'Workforce Overview', icon: Users },
    { id: 'statewise', label: 'State Performance', icon: MapPin },
    { id: 'techwise', label: 'Skills & Capability', icon: Cpu },
    { id: 'salarywise', label: 'Compensation Analytics', icon: BadgeIndianRupee },
    { id: 'salarywise2', label: 'Compensation Trends', icon: TrendingUp },
    { id: 'calendar', label: 'Leave & Attendance', icon: CalendarDays },
    { id: 'employee_details', label: 'Employee Profile', icon: UserCheck },
  ];

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header
      className="h-12 border-b px-3 flex items-center justify-between shrink-0 select-none z-30"
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.02), rgba(255,255,255,0.78), var(--surface)), var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Brand & Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-teal-500 flex items-center justify-center shadow-sm shrink-0 ring-1 ring-white/20">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-[0.08em]" style={{ color: 'var(--text)' }}>ETS ENTERPRISE</h1>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ background: 'var(--pill-bg)', color: 'var(--cyan-strong)', borderColor: 'var(--border-strong)' }}>
              v2.0
            </span>
          </div>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase" style={{ color: 'var(--muted)' }}>Executive command center</p>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className="flex items-center gap-1 p-1 rounded-xl mx-3 overflow-x-auto custom-scrollbar" style={{ background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                isActive ? 'shadow-sm border font-semibold' : ''
              }`}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(180deg, rgba(14,165,233,0.12), rgba(255,255,255,0.75))',
                      color: 'var(--cyan-strong)',
                      border: '1px solid var(--border-strong)',
                      boxShadow: '0 8px 20px rgba(14,165,233,0.12)',
                    }
                  : {
                      color: 'var(--muted)',
                      background: 'transparent',
                    }
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? 'var(--cyan-strong)' : 'var(--muted)' }} />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--success)' }} />
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Roster:</span>
          <span className="font-bold font-mono text-[11px]" style={{ color: 'var(--text)' }}>{totalEmployees}</span>
        </div>

        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title="Toggle theme"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onRefresh}
          title="Refresh Dataset Analytics"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: loading ? 'var(--cyan-strong)' : 'var(--muted)' }} />
        </button>

        <button
          onClick={handleFullscreen}
          title="Toggle Fullscreen (Zero Scroll)"
          className="p-1.5 rounded-lg border transition-colors flex items-center justify-center hover:border-cyan-400"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--text)' }} />
        </button>

        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={
            copilotOpen
              ? { background: 'var(--purple-strong)', color: '#fff', boxShadow: 'var(--shadow-soft)' }
              : { background: 'var(--purple-soft)', border: '1px solid var(--purple-border)', color: 'var(--purple-strong)' }
          }
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">AI Copilot</span>
        </button>
      </div>
    </header>
  );

};
