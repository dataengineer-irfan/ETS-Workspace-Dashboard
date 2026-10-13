import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, ArrowLeft, CheckCircle, BarChart3, Star, AlertCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Typewriter from '../ui/Typewriter';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'EMPLOYEE',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const uname = formData.username.trim();
    const email = formData.email.trim();

    if (!uname || !email || !formData.password) {
      setError('All fields are required.');
      return;
    }

    if (uname.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: uname,
        email: email,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        role: formData.role,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center p-4 relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="glass-panel rounded-3xl p-10 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 ring-8 ring-emerald-500/10">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Account Created!</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Your enterprise account has been successfully provisioned.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">
            <span className="w-3.5 h-3.5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <span>Redirecting to login...</span>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Branding Panel */}
        <section className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200/80 dark:border-slate-800/80 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div>
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

            <div className="mt-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                Join the Platform
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Create your enterprise account to gain role-authorized access to the ETS Workforce Intelligence Platform, skills roasters, and organizational analytics.
              </p>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-cyan-50/90 to-sky-50/90 dark:from-slate-900/90 dark:to-slate-800/90 border border-cyan-200/80 dark:border-cyan-800/40 shadow-sm relative">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-cyan-600 text-white shadow-2xs">
                  NEW ACCOUNT
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-400">Enterprise Security</span>
              </div>
              <p className="text-xs sm:text-sm font-medium italic text-slate-800 dark:text-slate-200 min-h-[36px] flex items-center">
                “<Typewriter
                  text={[
                    'Create an account. A new chapter of workforce clarity awaits.',
                    'Seamlessly connect with your team talent profiles.',
                    'Enterprise data security and RBAC governance built in.',
                  ]}
                  speed={45}
                  deleteSpeed={25}
                  delay={2200}
                  loop={true}
                />”
              </p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span>&copy; 2026 Infinite Computer Solutions</span>
            <span>Version 2.0.0 (RBAC Protected)</span>
          </div>
        </section>

        {/* Right Form Panel */}
        <section className="lg:col-span-5 flex flex-col justify-center">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl backdrop-blur-xl">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 mb-4 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>

            <div className="mb-5 text-left">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Create Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fill in your details to get started
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 shadow-2xs" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  disabled={loading}
                  autoComplete="username"
                  required
                  className="w-full px-3 py-2 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@infinite.com"
                  disabled={loading}
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min. 6 chars"
                      disabled={loading}
                      autoComplete="new-password"
                      required
                      className="w-full px-3 py-2 pr-8 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat password"
                      disabled={loading}
                      autoComplete="new-password"
                      required
                      className="w-full px-3 py-2 pr-8 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                    >
                      {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requested Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-medium bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                >
                  <option value="EMPLOYEE">Employee (Default)</option>
                  <option value="MANAGER">Delivery Manager</option>
                  <option value="HR_ANALYTICS">HR Analytics</option>
                  <option value="EXECUTIVE">Executive Leadership</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-md hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Already have an account?
              </p>
              <Link
                to="/login"
                className="mt-1.5 inline-block text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SignUp;
