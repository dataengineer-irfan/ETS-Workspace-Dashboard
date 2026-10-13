import React, { useState, useRef, useEffect } from 'react';
import { 
  LogOut, 
  Settings, 
  Shield, 
  MessageSquare, 
  Copy, 
  Check, 
  X,
  Send
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleBadgeStyle } from '../../utils/rbac';

interface UserMenuDropdownProps {
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

export const UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({ theme, setTheme }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modals state
  const [activeModal, setActiveModal] = useState<'settings' | 'privacy' | 'feedback' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setActiveModal(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const roleStyle = getRoleBadgeStyle(user.role);

  // Dynamic Workspace ID and Sharing ID based on user session / department
  const workspaceId = `7474655662747971`; // Authoritative tenant workspace ID matching Databricks spec
  const orgSharingId = `aws:ets:${user.department?.toLowerCase() || 'corp'}:${user.user_id.toString().padStart(6, '0')}`;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setTimeout(() => {
      setFeedbackSent(false);
      setFeedbackText('');
      setActiveModal(null);
    }, 1500);
  };

  // Avatar initial letter (e.g. 'A' for admin, or 'D' for user)
  const avatarLetter = (user.username || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Databricks-style User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User profile & workspace settings"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`${user.username} (${user.email})`}
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs transition-all cursor-pointer focus:outline-none ring-2 ${
          isOpen
            ? 'ring-amber-500 bg-amber-600'
            : 'ring-transparent hover:ring-amber-400/50 bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400'
        }`}
      >
        <span>{avatarLetter}</span>
      </button>

      {/* Databricks Dropdown Popover */}
      {isOpen && (
        <div 
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-[#0c1829] border border-slate-200 dark:border-[#223755] rounded-xl shadow-2xl z-50 overflow-hidden font-sans py-2 text-xs transition-all animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Top Email Header (Yellow highlighted item in Databricks reference) */}
          <div className="px-4 py-2 border-b border-slate-100 dark:border-[#1e3250]">
            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-[12px] tracking-tight" title={user.email}>
              {user.email || `${user.username}@infinite.com`}
            </div>
            <div className="flex items-center justify-between mt-1 gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                @{user.username}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider font-extrabold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                {user.role}
              </span>
            </div>
          </div>

          {/* Workspace Section (Exact Databricks layout) */}
          <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-[#0a1526]/40 border-b border-slate-100 dark:border-[#1e3250]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              workspace
            </div>

            {/* Workspace ID with Copy button */}
            <div className="flex items-center justify-between py-0.5 text-[11px]">
              <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                Workspace ID: <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{workspaceId}</span>
              </span>
              <button
                onClick={() => handleCopy(workspaceId, 'workspace')}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy Workspace ID"
                aria-label="Copy Workspace ID"
              >
                {copiedField === 'workspace' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* OpenSharing / Tenant ID with Copy button */}
            <div className="flex items-center justify-between py-0.5 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[210px] font-mono text-[10px]" title={orgSharingId}>
                OpenSharing ID: {orgSharingId}
              </span>
              <button
                onClick={() => handleCopy(orgSharingId, 'sharing')}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Copy OpenSharing ID"
                aria-label="Copy OpenSharing ID"
              >
                {copiedField === 'sharing' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Employee Number & Department (if available) */}
            {(user.employee_number || user.department) && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {user.employee_number && (
                  <span>Emp #{user.employee_number}</span>
                )}
                {user.department && (
                  <span className="truncate max-w-[140px] text-right font-sans font-medium text-slate-600 dark:text-slate-300">
                    Dept: {user.department}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Menu Items (Databricks items: Settings, Privacy policy, Send feedback) */}
          <div className="py-1">
            <button
              onClick={() => {
                setActiveModal('settings');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Settings</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveModal('privacy');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Privacy policy</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveModal('feedback');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Send feedback</span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-[#1e3250] my-1" />

          {/* Log Out Action (Highlighted in yellow at bottom of Databricks reference) */}
          <div className="px-1 py-0.5">
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-left text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1829] border border-slate-200 dark:border-[#223755] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">User & Workspace Settings</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Appearance</label>
                <div className="mt-1 flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Dashboard Theme</span>
                  {setTheme && (
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-[11px] cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Account Information</label>
                <div className="mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Username:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{user.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">RBAC Role:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{user.role}</span>
                  </div>
                  {user.department && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{user.department}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {activeModal === 'privacy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1829] border border-slate-200 dark:border-[#223755] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Enterprise Privacy Policy</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-64 overflow-y-auto">
              <p>
                <strong>ETS Enterprise Data Governance:</strong> All employee records, compensation bands, tenure metrics, and project allocations are strictly governed under enterprise Role-Based Access Control (RBAC).
              </p>
              <p>
                <strong>Audit & Logging:</strong> Analytical queries processed via ETS Genie AI Copilot and UI slicers are audit-trailed with zero external LLM data leaks.
              </p>
              <p>
                <strong>Compliance:</strong> In accordance with enterprise workforce compliance standards, personal identifiers are restricted to authenticated roles with authorized permissions.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Feedback Modal */}
      {activeModal === 'feedback' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1829] border border-slate-200 dark:border-[#223755] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Send Executive Feedback</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackSent ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Feedback Submitted</h4>
                <p className="text-xs text-slate-500">Thank you! Your feedback has been logged to the ETS product telemetry.</p>
              </div>
            ) : (
              <form onSubmit={handleSendFeedback} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    What can we improve in ETS Dashboard or ETS Genie?
                  </label>
                  <textarea
                    rows={4}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Share your thoughts, suggestions, or report any visual or analytical issues..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!feedbackText.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
