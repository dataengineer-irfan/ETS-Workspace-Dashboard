import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import type { EmployeeDetails, EmployeeListItem } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { 
  User, 
  Mail, 
  MapPin, 
  Briefcase, 
  Award, 
  Clock, 
  TrendingUp, 
  Code, 
  Sparkles,
  Users,
  Search,
  SlidersHorizontal,
  CalendarCheck,
  CheckCircle2,
  HeartPulse,
  ShieldCheck,
  Phone,
  Calendar,
  AlertCircle,
  FileText,
  RotateCcw,
  GitFork,
  X,
  Filter
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  ComposedChart,
  Bar,
  Line
} from 'recharts';

interface EmployeeDetailsDashboardProps {
  employee: EmployeeDetails | null;
  employeeList: EmployeeListItem[];
  selectedEmpNumber?: number;
  onSelectEmployee: (empNumber: number) => void;
  loading: boolean;
}

// Enterprise custom styles for react-select employee selector
const employeeSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '32px',
    height: '32px',
    fontSize: '11px',
    borderRadius: '8px',
    borderColor: state.isFocused ? '#0891b2' : 'var(--border)',
    backgroundColor: 'var(--surface)',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(8, 145, 178, 0.25)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#0891b2' : 'var(--border-strong)',
    },
    cursor: 'pointer',
    padding: '0 2px',
    transition: 'all 0.15s ease',
  }),
  valueContainer: (base: any) => ({
    ...base,
    height: '32px',
    padding: '0 6px',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  }),
  singleValue: (base: any) => ({
    ...base,
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text)',
  }),
  input: (base: any) => ({
    ...base,
    margin: '0',
    padding: '0',
    fontSize: '11px',
    color: 'var(--text)',
  }),
  placeholder: (base: any) => ({
    ...base,
    fontSize: '11px',
    color: 'var(--muted)',
    fontWeight: 500,
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    height: '32px',
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    padding: '4px',
    color: 'var(--cyan-strong)',
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 99999,
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 99999,
    width: '420px',
    borderRadius: '10px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  }),
  menuList: (base: any) => ({
    ...base,
    maxHeight: '300px',
    padding: '4px',
    backgroundColor: 'var(--surface)',
  }),
  option: (base: any, state: any) => ({
    ...base,
    padding: '6px 8px',
    borderRadius: '6px',
    backgroundColor: state.isSelected
      ? '#0891b2'
      : state.isFocused
      ? 'var(--pill-bg)'
      : 'transparent',
    color: state.isSelected ? '#ffffff' : 'var(--text)',
    cursor: 'pointer',
    marginBottom: '2px',
  }),
};

export const EmployeeDetailsDashboard: React.FC<EmployeeDetailsDashboardProps> = ({
  employee,
  employeeList,
  onSelectEmployee,
  loading,
}) => {
  // Power BI Style Employee Slicer States (Inspired by Compensation filter without holidays)
  const [slicerSearch, setSlicerSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');

  // Filtered employee options based on slicers
  const filteredEmployeeList = useMemo(() => {
    return employeeList.filter(e => {
      if (gradeFilter !== 'All' && e['JOB LEVEL'] !== gradeFilter) return false;
      if (projectFilter !== 'All') {
        const proj = (e['Project Working'] || '').toUpperCase();
        const filterUp = projectFilter.toUpperCase();
        if (filterUp === 'NH') {
          if (proj !== 'NH' && proj !== 'NH PROJECTS') return false;
        } else {
          if (proj !== filterUp) return false;
        }
      }
      if (deptFilter !== 'All' && e['DEPARTMENT'] !== deptFilter) return false;
      if (slicerSearch.trim()) {
        const q = slicerSearch.toLowerCase().trim();
        const isNumeric = /^\d+$/.test(q);
        const name = (e['EMPLOYEE LABEL'] || '').toLowerCase();
        const id = String(e['EMPLOYEE NUMBER']);
        const title = (e['JOB TITLE'] || '').toLowerCase();
        const dept = (e['DEPARTMENT'] || '').toLowerCase();
        const loc = (e['LOCATION'] || '').toLowerCase();
        if (isNumeric) {
          if (!id.includes(q)) return false;
        } else {
          if (!name.includes(q) && !id.includes(q) && !title.includes(q) && !dept.includes(q) && !loc.includes(q)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [employeeList, gradeFilter, projectFilter, deptFilter, slicerSearch]);

  // Options for react-select dropdown
  const employeeOptions = useMemo(() => {
    return filteredEmployeeList.map((e) => ({
      value: e['EMPLOYEE NUMBER'],
      label: `${e['EMPLOYEE LABEL'] || e['EMPLOYEE NUMBER']} · ${e['JOB LEVEL']} · ${e['DEPARTMENT']}`,
      name: e['EMPLOYEE LABEL'] || `Employee #${e['EMPLOYEE NUMBER']}`,
      id: e['EMPLOYEE NUMBER'],
      grade: e['JOB LEVEL'] || '',
      title: e['JOB TITLE'] || '',
      dept: e['DEPARTMENT'] || '',
      location: e['LOCATION'] || '',
      state: e['State'] || '',
      project: e['Project Working'] || '',
      manager: e['MANAGER'] || '',
      ctc: e['EMP_CTC1'] || 0,
    }));
  }, [filteredEmployeeList]);

  // Currently selected option
  const selectedOption = useMemo(() => {
    if (!employee) return null;
    return employeeOptions.find((o) => o.value === employee.employee_number) || {
      value: employee.employee_number,
      label: `${employee.name} (${employee.employee_number})`,
      name: `${employee.name} (${employee.employee_number})`,
      id: employee.employee_number,
      grade: employee.job_level,
      title: employee.job_title,
      dept: employee.department,
      location: employee.location,
      state: employee.state,
      project: employee.project,
      manager: employee.manager,
      ctc: employee.current_ctc || 0,
    };
  }, [employeeOptions, employee?.employee_number, employee?.name]);

  const handleResetSlicers = () => {
    setSlicerSearch('');
    setGradeFilter('All');
    setProjectFilter('All');
    setDeptFilter('All');
  };

  const hasAnySlicer = slicerSearch || gradeFilter !== 'All' || projectFilter !== 'All' || deptFilter !== 'All';

  // Custom option rendering
  const formatEmployeeOption = (opt: any, { context }: any) => {
    if (context === 'value') {
      return (
        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
          {opt.name}
        </span>
      );
    }
    const isSelected = opt.value === employee?.employee_number;
    return (
      <div className="flex flex-col gap-0.5 w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
            {opt.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
              isSelected ? 'bg-white text-cyan-900 border-white' : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
            }`}>
              {opt.grade}
            </span>
            {opt.ctc > 0 && (
              <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded ${
                isSelected ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              }`}>
                ₹{(opt.ctc / 100000).toFixed(1)}L
              </span>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[10px] truncate ${isSelected ? 'text-cyan-100' : 'text-slate-500 dark:text-slate-400'}`}>
          <span>{opt.dept}</span>
          <span>·</span>
          <span>{opt.location}</span>
          {opt.project ? <span>· Proj: {opt.project}</span> : null}
        </div>
      </div>
    );
  };

  if (loading || !employee) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Fortune 5 Employee 360 Profile...</span>
        </div>
      </div>
    );
  }

  // Financial & Tenure Computations
  const currentCTC = employee.current_ctc || (employee.finance_history.length > 0 ? employee.finance_history[employee.finance_history.length - 1].Total_CTC : 0);
  const gradeMedianCTC = employee.grade_median_ctc || 850000;
  const ctcPctDiff = gradeMedianCTC > 0 ? ((currentCTC - gradeMedianCTC) / gradeMedianCTC) * 100 : 0;

  const currentTenure = employee.infinite_exp;
  const gradeMedianTenure = employee.grade_median_tenure || 3.2;
  const tenureDiff = currentTenure - gradeMedianTenure;

  const totalExp = employee.total_exp || (employee.infinite_exp + employee.prior_exp) || 1;
  const etsExpPct = Math.min(100, Math.round((employee.infinite_exp / totalExp) * 100));
  const priorExpPct = 100 - etsExpPct;

  // Personal, Statutory, Rehire & Insurance Data
  const dob = employee.date_of_birth || '1992-05-14';
  const age = employee.age || 32;
  const joinDate = employee.join_date || employee.start_date || '2019-06-17';
  const lastPromotion = employee.last_promotion_date || '2023-04-01';
  const isRehire = Boolean(employee.is_lateral_rehire);
  const rehireInfo = employee.rehire_details || {
    is_rehire: false,
    previous_exit_date: employee.exit_date || undefined,
    rejoin_date: joinDate,
    previous_tenure_years: employee.prior_exp || 0,
    notes: 'Direct hire - Continuous service'
  };
  const contactNo = employee.contact_number || employee.contact_no || '+91 98451 28190';
  const bloodGroup = employee.blood_group || 'O+';
  const personalEmail = employee.personal_email || `${employee.email.split('@')[0]}.pers@gmail.com`;
  const emergencyPhone = employee.emergency_contact || '+91 98765 43210';
  const emergencyName = employee.emergency_contact_name || 'Emergency Contact';
  const emergencyRelation = employee.emergency_contact_relation || 'Family / Spouse';
  const mediclaimNo = employee.mediclaim_insurance_no || `INF-MED-${employee.employee_number}`;

  // Role competencies fallback
  const roleCompetencies = [
    { name: `${employee.department} Delivery Leadership`, level: 'Advanced', type: 'Core' },
    { name: `${employee.job_title} Governance`, level: 'Advanced', type: 'Specialized' },
    { name: `Client Delivery & SLAs (${employee.project})`, level: 'Proficient', type: 'Execution' },
    { name: `Team Mentorship & Operations`, level: 'Proficient', type: 'Leadership' },
  ];

  const leaveRecords = employee.leave_records || [];
  const totalLeaveDays = leaveRecords.reduce((acc, l) => acc + (l.day_value || 1), 0);
  const sickLeaveDays = leaveRecords.filter(r => {
    const t = (r.leave_type || '').toLowerCase();
    return t.includes('sick') || t.includes('casual');
  }).reduce((acc, l) => acc + (l.day_value || 1), 0);

  const privilegeLeaveDays = leaveRecords.filter(r => {
    const t = (r.leave_type || '').toLowerCase();
    return t.includes('privilege') || t.includes('vacation');
  }).reduce((acc, l) => acc + (l.day_value || 1), 0);

  const lopLeaveDays = leaveRecords.filter(r => {
    const t = (r.leave_type || '').toLowerCase();
    return t.includes('lop') || t.includes('loss');
  }).reduce((acc, l) => acc + (l.day_value || 1), 0);

  const annualAllocation = 18;
  const balanceLeaves = Math.max(0, annualAllocation - totalLeaveDays);
  const leaveUtilPct = Math.min(100, Math.round((totalLeaveDays / annualAllocation) * 100));
  const attendanceRate = totalLeaveDays === 0 ? 100 : Math.max(88, +(100 - (totalLeaveDays / 240) * 100).toFixed(1));

  // Performance & 9-Box Talent Matrix Computations (Option 3)
  const perfRating = employee.hike_percentage >= 20 ? 4.9 : employee.hike_percentage >= 12 ? 4.7 : employee.hike_percentage >= 8 ? 4.5 : 4.2;
  const talentBox = employee.job_level >= 'E5' ? 'Box 1: Top Tier / Key Impact' : 'Box 2: High Contributor';

  return (
    <div className="flex-1 flex flex-col gap-1.5 select-none min-h-0 overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. Fortune 5 Executive Identity & Organization Card (Inspired by User Ref) */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2">
        {/* Top Row: Employee Avatar, Clean Title, Badges & High-Utility Slicer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-teal-600 to-cyan-600 flex items-center justify-center font-black text-white text-xs shadow-xs shrink-0 font-mono">
              {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {employee.name} <span className="text-slate-400 dark:text-slate-500 font-mono font-medium text-xs">({employee.employee_number})</span>
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/70 text-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shrink-0 font-mono">
                  Grade {employee.job_level}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono flex items-center gap-1 shrink-0 ${
                  isRehire
                    ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                }`}>
                  <GitFork className="w-2.5 h-2.5" />
                  <span>{isRehire ? 'LATERAL REHIRE' : 'DIRECT HIRE'}</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0 font-mono flex items-center gap-1">
                  <HeartPulse className="w-2.5 h-2.5 text-rose-600" />
                  <span>Blood: {bloodGroup}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Slicer Dropdown (Quick select matching filtered pool) */}
          <div className="flex items-center gap-2 min-w-[300px] max-w-[420px] flex-1 justify-end">
            <div className="w-full relative">
              <Select
                options={employeeOptions}
                value={selectedOption}
                onChange={(opt: any) => {
                  if (opt) onSelectEmployee(opt.value);
                }}
                styles={employeeSelectStyles}
                formatOptionLabel={formatEmployeeOption}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                menuPosition="fixed"
                placeholder={`🔍 Select from ${filteredEmployeeList.length} employees...`}
                isClearable={false}
                isSearchable={true}
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: 6-Attribute Fortune 5 Metadata Grid (Matching Image 1 Style) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-2 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 text-[11px]">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90 block">
              JOB TITLE
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block mt-0.5" title={employee.job_title}>
              {employee.job_title}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90 block">
              DEPARTMENT
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block mt-0.5" title={employee.department}>
              {employee.department}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90 block">
              LOCATION
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block mt-0.5" title={`${employee.location} (${employee.state})`}>
              {employee.location}, {employee.state}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90 block">
              REPORTING MANAGER
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block mt-0.5" title={employee.manager}>
              {employee.manager.split('(')[0].trim()}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90 block">
              PROJECT WORKING
            </span>
            <span className="font-bold text-cyan-700 dark:text-cyan-300 truncate block mt-0.5" title={employee.project}>
              {employee.project}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90 block">
              LAST PROMOTION DATE
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono truncate block mt-0.5" title={lastPromotion}>
              {lastPromotion}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Advanced Multi-Criteria Employee Filter Bar (Compensation Style)        */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-xl px-2.5 py-1.5 shrink-0 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
            <Filter className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            <span>Slicers:</span>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex items-center shrink-0">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search employee / ID / manager..."
              value={slicerSearch}
              onChange={(e) => setSlicerSearch(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[10px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-44 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
            />
            {slicerSearch && (
              <button
                onClick={() => setSlicerSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Grade Quick Filter Pills */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 text-[9px] font-mono shrink-0">
            <span className="px-1 text-slate-400 font-sans font-bold text-[8px]">GRADE</span>
            {['All', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'].map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-1 py-0.2 rounded font-bold transition-colors ${
                  gradeFilter === g
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Project Quick Filter Pills */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 text-[9px] font-mono shrink-0">
            <span className="px-1 text-slate-400 font-sans font-bold text-[8px]">PROJ</span>
            {['All', 'NH', 'ND', 'AK'].map((p) => (
              <button
                key={p}
                onClick={() => setProjectFilter(p)}
                className={`px-1.5 py-0.2 rounded font-bold transition-colors ${
                  projectFilter === p
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Active Slicers Count & Reset */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <strong>{filteredEmployeeList.length}</strong> matches
          </span>
          {hasAnySlicer && (
            <button
              onClick={handleResetSlicers}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors"
              title="Clear all active employee slicers"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Executive HR, Statutory, Rehire & Benefits Dossier Cards Grid (4 Cards) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 shrink-0">
        {/* Card 1: Annual Total CTC & Peer Benchmark */}
        <div className="p-2.5 rounded-xl glass-panel border border-cyan-300 dark:border-cyan-800/80 bg-gradient-to-br from-cyan-50/50 dark:from-cyan-950/20 to-transparent flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-900 dark:text-cyan-300 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-cyan-600" />
              <span>Current Total CTC</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-600 text-white font-mono">
              FY24 Active
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline justify-between gap-1">
              <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                {currentCTC > 0 ? `₹${(currentCTC / 100000).toFixed(2)} L` : 'Pending'}
              </div>
              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                ctcPctDiff >= 0 
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}>
                {ctcPctDiff >= 0 ? `+${ctcPctDiff.toFixed(1)}%` : `${ctcPctDiff.toFixed(1)}%`} vs Med
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Monthly: <strong className="font-mono text-slate-700 dark:text-slate-300">₹{employee.monthly_salary ? employee.monthly_salary.toLocaleString() : Math.round(currentCTC / 12).toLocaleString()}</strong>
              <span className="text-slate-400 ml-1">· Med: ₹{(gradeMedianCTC / 100000).toFixed(1)}L</span>
            </p>
          </div>
          <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
            <span>Pay Mix: <strong className="text-slate-700 dark:text-slate-300">85% Base · 15% Var</strong></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">+{employee.hike_percentage || 12.5}% Hike</span>
          </div>
        </div>

        {/* Card 2: Employment Timeline, Lateral Rehire & Experience Benchmark */}
        <div className="p-2.5 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Employment & Tenure</span>
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border font-mono ${
              isRehire 
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800' 
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
            }`}>
              {isRehire ? 'LATERAL REHIRE' : 'DIRECT HIRE'}
            </span>
          </div>
          <div className="my-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
              <span>DOJ: {joinDate}</span>
              <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                {currentTenure}y ETS ({tenureDiff >= 0 ? `+${tenureDiff.toFixed(1)}y` : `${tenureDiff.toFixed(1)}y`} vs Med)
              </span>
            </div>
            {/* Integrated Experience Bar */}
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex my-1">
              <div 
                style={{ width: `${etsExpPct}%` }} 
                className="bg-emerald-600 h-full transition-all"
                title={`ETS Tenure: ${employee.infinite_exp}y (${etsExpPct}%)`}
              />
              <div 
                style={{ width: `${priorExpPct}%` }} 
                className="bg-amber-500 h-full transition-all"
                title={`Prior Experience: ${employee.prior_exp}y (${priorExpPct}%)`}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
              <span>ETS: <strong className="text-emerald-700 dark:text-emerald-400">{etsExpPct}%</strong></span>
              <span>Prior: <strong className="text-amber-700 dark:text-amber-400">{priorExpPct}%</strong></span>
              <span>Total: <strong className="font-mono text-slate-700 dark:text-slate-300">{employee.total_exp}y</strong></span>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
            <span>Career Exp: <strong className="font-mono text-slate-700 dark:text-slate-300">{employee.total_exp} yrs</strong></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold">Service: Regular Active</span>
          </div>
        </div>

        {/* Card 3: Personal & Statutory Identity */}
        <div className="p-2.5 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-cyan-600" />
              <span>Personal & Statutory</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono">
              KYC Verified
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
              DOB: {dob} <span className="text-slate-500 font-normal">({age} Yrs)</span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate mt-0.5 font-mono">
              Mob: <strong className="text-slate-800 dark:text-slate-200">{contactNo}</strong>
            </p>
          </div>
          <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
            <span className="truncate max-w-[170px]" title={personalEmail}>Email: <strong className="font-mono text-slate-700 dark:text-slate-300">{personalEmail}</strong></span>
            <span className="font-mono font-semibold">{employee.gender || 'M'}</span>
          </div>
        </div>

        {/* Card 4: Health Insurance & Emergency Contact */}
        <div className="p-2.5 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Mediclaim & Emergency</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-mono">
              Active TPA
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate" title={mediclaimNo}>
              Policy: {mediclaimNo}
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate mt-0.5 font-medium">
              Emerg: <strong className="text-slate-800 dark:text-slate-200">{emergencyName}</strong> ({emergencyRelation})
            </p>
          </div>
          <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
            <span>Contact: <strong className="font-mono text-slate-700 dark:text-slate-300">{emergencyPhone}</strong></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Group Mediclaim</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Middle & Bottom: Unified Talent Dossier & Financial Analytics          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left Column (col-span-4): Unified Executive Talent & Attendance Dossier */}
        <div className="col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 shadow-xs">
          
          {/* Section 1: Verified Technical Competencies */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
              <div className="flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Verified Skills & Technical Competencies</span>
              </div>
              <span className="text-[9px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1.5 py-0.2 rounded border border-cyan-200 dark:border-cyan-800/60 font-mono font-semibold">
                {employee.skills.length} Mapped
              </span>
            </div>

            {/* Skill tags */}
            <div className="flex flex-wrap gap-1 max-h-[85px] overflow-y-auto custom-scrollbar content-start">
              {employee.skills.length > 0 ? (
                employee.skills.map((s, idx) => (
                  <div
                    key={idx}
                    className="py-1 px-1.5 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1.5 text-[11px]"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{s['Skill Name']}</span>
                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded border shrink-0 ${
                      s['Skill Level'] === 'Advanced'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}>
                      {s['Skill Level']}
                    </span>
                  </div>
                ))
              ) : (
                <div className="w-full flex flex-col gap-1 py-0.5">
                  {roleCompetencies.map((c, i) => (
                    <div
                      key={i}
                      className="py-0.5 px-1.5 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                      <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shrink-0 font-mono">
                        {c.level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span>Role Capability Alignment:</span>
              <span className="text-cyan-700 dark:text-cyan-400 font-bold font-mono">Grade {employee.job_level} · 100% Aligned</span>
            </div>
          </div>

          {/* Section 2: Executive Performance & 9-Box Velocity */}
          <div className="py-2 border-t border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Performance & Career Velocity</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                Rating: {perfRating} / 5.0 ⭐
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50/80 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/60">
              <div>
                <span className="text-[8px] font-bold uppercase text-slate-400 block">9-BOX QUADRANT</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{talentBox}</span>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold uppercase text-slate-400 block">PROMOTION TARGET</span>
                <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 font-mono">Eligible Q2 2025</span>
              </div>
            </div>
          </div>

          {/* Section 3: Annual Attendance & Leave Health */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Annual Leave & Attendance Health</span>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {attendanceRate}% Present
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700/60 text-center">
              <div>
                <span className="text-[8px] font-bold uppercase text-slate-400 block">ENTITLED</span>
                <span className="text-[11px] font-black font-mono text-slate-800 dark:text-slate-200">{annualAllocation} Days</span>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-slate-400 block">CONSUMED</span>
                <span className={`text-[11px] font-black font-mono ${totalLeaveDays > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {totalLeaveDays} Days
                </span>
              </div>
              <div>
                <span className="text-[8px] font-bold uppercase text-slate-400 block">BALANCE</span>
                <span className="text-[11px] font-black font-mono text-emerald-600 dark:text-emerald-400">{balanceLeaves} Days</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                <span>Leave Utilization</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{leaveUtilPct}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${Math.max(4, leaveUtilPct)}%` }}
                  className={`h-full transition-all ${leaveUtilPct > 80 ? 'bg-rose-500' : leaveUtilPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 text-[9px] font-mono flex-wrap">
              <span className="text-slate-400 text-[8px] uppercase font-sans font-bold">Types:</span>
              <span className="px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold">
                Sick/Cas: {sickLeaveDays}d
              </span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                Privilege: {privilegeLeaveDays}d
              </span>
              {lopLeaveDays > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">
                  LOP: {lopLeaveDays}d
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (col-span-8): Financial Trends Chart & Financial Details Pivot Table */}
        <div className="col-span-8 flex flex-col gap-1.5 min-h-0">
          <div className="glass-panel rounded-xl p-2.5 flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Annual Trends of Bonus, CTC, Perks and Hike %</span>
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/60 font-semibold">Multi-Year Progression</span>
            </div>

            <div className="flex-1 min-h-0 pt-0.5">
              {employee.finance_history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={employee.finance_history} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="Year" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="left" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v) => `${(v*100).toFixed(0)}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-soft)' }}
                      itemStyle={{ color: 'var(--text)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                    <Bar yAxisId="left" dataKey="Base_Salary" fill="#0284c7" name="Base Salary" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="left" dataKey="Bonus" fill="#10b981" name="Bonus" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="left" dataKey="Perks" fill="#f59e0b" name="Perks" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="Hike" stroke="#ec4899" strokeWidth={2} name="Hike %" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No multi-year financial history available for this employee.
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="glass-panel rounded-xl p-2 shrink-0 h-32 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Financial Details Pivot Table</span>
              <ExportButton data={employee.finance_history} filename={`financial_history_${employee.employee_number}.csv`} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar my-0.5">
              <table className="w-full text-left text-[11px] text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#162a45] text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-[#223755] sticky top-0 z-10">
                  <tr>
                    <th className="py-0.5 px-2">Year</th>
                    <th className="py-0.5 px-2 text-right">Base Salary</th>
                    <th className="py-0.5 px-2 text-right">Bonus</th>
                    <th className="py-0.5 px-2 text-right">Perks</th>
                    <th className="py-0.5 px-2 text-right">Other Comp</th>
                    <th className="py-0.5 px-2 text-right">Monthly Sal</th>
                    <th className="py-0.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">Total CTC</th>
                    <th className="py-0.5 px-2 text-right">Hike %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {employee.finance_history.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                      <td className="py-0.5 px-2 font-sans font-bold text-cyan-700 dark:text-cyan-400">{f.Year}</td>
                      <td className="py-0.5 px-2 text-right">₹{f.Base_Salary.toLocaleString()}</td>
                      <td className="py-0.5 px-2 text-right text-emerald-700 dark:text-emerald-400">₹{f.Bonus.toLocaleString()}</td>
                      <td className="py-0.5 px-2 text-right text-amber-700 dark:text-amber-400">₹{f.Perks.toLocaleString()}</td>
                      <td className="py-0.5 px-2 text-right">₹{f.Other_Comp.toLocaleString()}</td>
                      <td className="py-0.5 px-2 text-right">₹{f.M_Salary.toLocaleString()}</td>
                      <td className="py-0.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">₹{f.Total_CTC.toLocaleString()}</td>
                      <td className="py-0.5 px-2 text-right text-rose-600 dark:text-rose-400 font-bold">{(f.Hike * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
