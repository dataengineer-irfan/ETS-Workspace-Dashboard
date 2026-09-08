import React, { useEffect, useState } from 'react';
import { X, ExternalLink, User, Building2, MapPin, Briefcase, Award, TrendingUp, Calendar, Mail } from 'lucide-react';
import { fetchEmployeeDetails } from '../../api/client';
import type { EmployeeDetails } from '../../types/dashboard';

interface EmployeeProfileDrawerProps {
  empNumber: number | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullProfile: (empNumber: number) => void;
}

export const EmployeeProfileDrawer: React.FC<EmployeeProfileDrawerProps> = ({
  empNumber,
  isOpen,
  onClose,
  onOpenFullProfile,
}) => {
  const [details, setDetails] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && empNumber) {
      setLoading(true);
      fetchEmployeeDetails(empNumber)
        .then((data) => {
          setDetails(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load profile drawer details:', err);
          setLoading(false);
        });
    } else {
      setDetails(null);
    }
  }, [isOpen, empNumber]);

  if (!isOpen || !empNumber) return null;

  const formatLakhs = (val?: number) => {
    if (!val || val === 0) return '₹0.00L';
    return `₹${(val / 100000).toFixed(2)}L`;
  };

  // Peer comparison delta
  const ctc = details?.finance_history?.[0]?.Total_CTC || 0;
  const medianCtc = details?.grade_median_ctc || 0;
  const ctcDelta = medianCtc > 0 ? ((ctc - medianCtc) / medianCtc) * 100 : 0;

  const tenure = details?.infinite_exp || 0;
  const medianTenure = details?.grade_median_tenure || 0;
  const tenureDelta = medianTenure > 0 ? tenure - medianTenure : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200 select-none overflow-hidden"
        style={{ background: 'var(--surface)' }}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {details?.name ? details.name.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">{details?.name || `Employee #${empNumber}`}</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                  {details?.job_level || 'Grade'}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">{details?.job_title || 'Workforce Member'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading employee intelligence...</span>
          </div>
        ) : details ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
            {/* Meta Tags */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Department</span>
                  <span className="font-semibold text-slate-800">{details.department || 'Delivery'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                  <span className="font-semibold text-slate-800">{details.location || 'HQ'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Project</span>
                  <span className="font-semibold text-slate-800">{details.project || 'General'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Manager</span>
                  <span className="font-semibold text-slate-800">{details.manager || 'Executive'}</span>
                </div>
              </div>
            </div>

            {/* Peer Comparison Benchmark Strip */}
            <div className="rounded-xl p-3 bg-gradient-to-br from-slate-50 to-cyan-50/40 border border-cyan-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-600" /> Peer Benchmarking ({details.job_level})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Grade Cohort</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Annual CTC</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{formatLakhs(ctc)}</span>
                  {medianCtc > 0 && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${ctcDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {ctcDelta >= 0 ? `+${ctcDelta.toFixed(1)}%` : `${ctcDelta.toFixed(1)}%`} vs median ({formatLakhs(medianCtc)})
                    </span>
                  )}
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Company Tenure</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{tenure.toFixed(1)} yrs</span>
                  {medianTenure > 0 && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${tenureDelta >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {tenureDelta >= 0 ? `+${tenureDelta.toFixed(1)} yrs` : `${tenureDelta.toFixed(1)} yrs`} vs median ({medianTenure.toFixed(1)}y)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Experience Breakdown */}
            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Total Experience
                </span>
                <span className="font-mono text-cyan-800 font-bold">{details.total_exp.toFixed(1)} Years</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 flex overflow-hidden">
                <div 
                  className="bg-cyan-600 h-full" 
                  style={{ width: `${details.total_exp > 0 ? (details.infinite_exp / details.total_exp) * 100 : 50}%` }}
                  title={`Infinite Exp: ${details.infinite_exp.toFixed(1)} yrs`}
                />
                <div 
                  className="bg-amber-500 h-full" 
                  style={{ width: `${details.total_exp > 0 ? (details.prior_exp / details.total_exp) * 100 : 50}%` }}
                  title={`Prior Exp: ${details.prior_exp.toFixed(1)} yrs`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-600 inline-block" /> Infinite: {details.infinite_exp.toFixed(1)}y
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Prior: {details.prior_exp.toFixed(1)}y
                </span>
              </div>
            </div>

            {/* Verified Skills */}
            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-purple-600" /> Verified Technical Skills
                </span>
                <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                  {details.skills?.length || 0} skills
                </span>
              </div>

              {details.skills && details.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {details.skills.map((s, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      {s['Skill Name']} 
                      {s['Skill Level'] && <span className="text-slate-400 font-normal">({s['Skill Level']})</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No formal skills verified in registry. General skill inventory audit pending.</p>
              )}
            </div>

            {/* Direct Contact */}
            <div className="text-xs text-slate-500 flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono text-[11px] text-slate-700 truncate">{details.email || `emp_${details.employee_number}@company.com`}</span>
            </div>
          </div>
        ) : null}

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
          <button
            onClick={() => {
              onOpenFullProfile(empNumber);
              onClose();
            }}
            className="flex-1 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <span>Open Full Profile (Tab 360)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
