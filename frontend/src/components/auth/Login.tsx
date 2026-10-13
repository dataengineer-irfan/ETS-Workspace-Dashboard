import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Star, ShieldCheck, Sparkles, AlertCircle, BarChart3, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Typewriter from '../ui/Typewriter';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Theme state toggle
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('ets_dashboard_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('ets_dashboard_theme', 'dark');
      setIsDark(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      await login({ username: username.trim(), password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Invalid username or password. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen relative flex items-center justify-center overflow-hidden p-4 sm:p-6" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Ambient Lighting & Grid Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div 
          className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full filter blur-[100px] opacity-30 dark:opacity-20 animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(15, 118, 110, 0.2) 60%, transparent 80%)' }}
        />
        <div 
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full filter blur-[100px] opacity-30 dark:opacity-20 animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, rgba(14, 165, 233, 0.15) 60%, transparent 80%)' }}
        />
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold"
          title="Toggle Dark / Light Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Main Container: 2-Column Split */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Branding Panel (7 cols on lg) */}
        <section className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200/80 dark:border-slate-800/80 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div>
            {/* Brand Header */}
            <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center shadow-md ring-2 ring-white/20">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-sm font-black tracking-wider uppercase bg-gradient-to-r from-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                    Infinite Computer Solutions
                  </span>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    ETS Workforce Intelligence Platform
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold tracking-tight shadow-2xs">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Great Place To Work Certified</span>
              </div>
            </div>

            {/* Headline & Subtitle */}
            <div className="mt-8">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/80 text-cyan-800 dark:text-cyan-300 text-xs font-bold mb-4">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                Enterprise Role-Based Access Control
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                Workforce Intelligence & Talent Governance
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                An executive-level platform providing multi-dimensional talent analytics, project delivery allocation, compensation benchmarking, and AI-assisted workforce insights.
              </p>
            </div>

            {/* AI Insight Quote Card */}
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-cyan-50/90 to-sky-50/90 dark:from-slate-900/90 dark:to-slate-800/90 border border-cyan-200/80 dark:border-cyan-800/40 shadow-sm relative">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-cyan-600 text-white shadow-2xs">
                  <Sparkles className="w-3 h-3" /> AI INSIGHT
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-400">Infinite Intelligence</span>
              </div>
              <p className="text-xs sm:text-sm font-medium italic text-slate-800 dark:text-slate-200 min-h-[36px] flex items-center">
                “<Typewriter
                  text={[
                    'Welcome Back! Access 590 workforce profiles and real-time skill matrices.',
                    'Executive compensation governance across 54 reporting managers.',
                    'Seamless client program allocation across 12 delivery hubs.',
                    'AI Copilot natural language intelligence powered by Genie.',
                  ]}
                  speed={45}
                  deleteSpeed={25}
                  delay={2200}
                  loop={true}
                />”
              </p>
            </div>

            {/* Feature Checklist */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                <span>Real-time cross-filtering across 590 employees</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                <span>Executive compensation governance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                <span>Skills matrix & proficiency inventory</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                <span>Strict RBAC authorization protocol</span>
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="mt-8 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span>&copy; 2026 Infinite Computer Solutions</span>
            <span>Version 2.0.0 (RBAC Protected)</span>
          </div>
        </section>

        {/* Right Form Panel (5 cols on lg) */}
        <section className="lg:col-span-5 flex flex-col justify-center">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 text-left">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Welcome Back
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your credentials to access your dashboard
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 shadow-2xs" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 tracking-tight">
                  Username or Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or employee@infinite.com"
                    disabled={loading}
                    autoComplete="username"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 tracking-tight">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    disabled={loading}
                    autoComplete="current-password"
                    required
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-md hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Don't have an enterprise account?
              </p>
              <Link
                to="/signup"
                className="mt-2 inline-flex items-center justify-center w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
              >
                Create Account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
