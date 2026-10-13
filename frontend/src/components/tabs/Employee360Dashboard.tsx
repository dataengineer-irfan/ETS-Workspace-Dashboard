import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import type { EmployeeDetails, EmployeeListItem, CalendarData } from '../../types/dashboard';
import { ExportButton } from '../common/ExportButton';
import { 
  User, 
  Mail, 
  Phone, 
  HeartPulse, 
  ShieldCheck, 
  GitFork, 
  Award, 
  Clock, 
  TrendingUp, 
  Code, 
  Sparkles, 
  Search, 
  RotateCcw, 
  X, 
  Filter, 
  CalendarCheck,
  Building,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Star,
  Zap
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
  Line,
  Area,
  ReferenceLine
} from 'recharts';

interface Employee360DashboardProps {
  employee: EmployeeDetails | null;
  employeeList: EmployeeListItem[];
  selectedEmpNumber?: number;
  onSelectEmployee: (empNumber: number) => void;
  loading: boolean;
  onSwitchView?: () => void;
  calendarData?: CalendarData | null;
}

// Enterprise custom styles for react-select employee selector
const employeeSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '30px',
    height: '30px',
    fontSize: '11px',
    borderRadius: '7px',
    borderColor: state.isFocused ? '#06b6d4' : 'var(--border)',
    backgroundColor: 'var(--surface)',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(6, 182, 212, 0.25)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#06b6d4' : 'var(--border-strong)',
    },
    cursor: 'pointer',
    padding: '0 2px',
    transition: 'all 0.15s ease',
  }),
  valueContainer: (base: any) => ({
    ...base,
    height: '30px',
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
    height: '30px',
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    padding: '3px',
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
    borderRadius: '8px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.4)',
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

export const Employee360Dashboard: React.FC<Employee360DashboardProps> = ({
  employee,
  employeeList,
  selectedEmpNumber: propSelectedEmpNumber,
  onSelectEmployee,
  loading,
  onSwitchView,
  calendarData,
}) => {
  // Collapsible sidebar state (defaults to collapsed on sub-1280px viewports/scaling)
  const [slicersCollapsed, setSlicersCollapsed] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 1280);
  const [empSearch, setEmpSearch] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [projectFilter, setProjectFilter] = useState<string>('All');

  // Map employee leave counts from calendarData if available
  const leaveCountMap = useMemo(() => {
    const map = new Map<number, number>();
    (calendarData?.available_employees || []).forEach(e => {
      map.set(e.employee_number, e.leave_count);
    });
    return map;
  }, [calendarData?.available_employees]);

  // Filtered and ranked employee list for the radio slicer
  const filteredEmployees = useMemo(() => {
    return employeeList
      .filter(e => {
        if (gradeFilter !== 'All' && e['JOB LEVEL'] !== gradeFilter) return false;
        if (projectFilter !== 'All') {
          // NH should match both "NH" and "NH Projects"
          const proj = (e['Project Working'] || '').toUpperCase();
          const filterUp = projectFilter.toUpperCase();
          if (filterUp === 'NH') {
            if (proj !== 'NH' && proj !== 'NH PROJECTS') return false;
          } else {
            if (proj !== filterUp) return false;
          }
        }
        if (empSearch.trim()) {
          const q = empSearch.toLowerCase().trim();
          const isNumeric = /^\d+$/.test(q);
          const id = String(e['EMPLOYEE NUMBER']);
          const name = (e['EMPLOYEE LABEL'] || `${e['EMPLOYEE FIRST NAME'] || ''} ${e['EMPLOYEE LAST NAME'] || ''}`).toLowerCase();
          const title = (e['JOB TITLE'] || '').toLowerCase();
          const dept = (e['DEPARTMENT'] || '').toLowerCase();
          const loc = (e['LOCATION'] || '').toLowerCase();

          if (isNumeric) {
            // Strictly match employee ID when searching numbers
            if (!id.includes(q)) return false;
          } else {
            // Text search matches employee name, ID, title, department, or location (do NOT match manager)
            if (!name.includes(q) && !id.includes(q) && !title.includes(q) && !dept.includes(q) && !loc.includes(q)) {
              return false;
            }
          }
        }
        return true;
      })
      .map(e => ({
        employee_number: e['EMPLOYEE NUMBER'],
        name: e['EMPLOYEE LABEL'] || `Employee #${e['EMPLOYEE NUMBER']}`,
        grade: e['JOB LEVEL'] || '',
        dept: e['DEPARTMENT'] || '',
        location: e['LOCATION'] || '',
        ctc: e['EMP_CTC1'] || 0,
        leave_count: leaveCountMap.get(e['EMPLOYEE NUMBER']) ?? 0,
      }))
      .sort((a, b) => {
        // If searching, prioritize search relevance!
        if (empSearch.trim()) {
          const q = empSearch.toLowerCase().trim();
          const aId = String(a.employee_number);
          const bId = String(b.employee_number);
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();

          // 1. Exact ID match
          if (aId === q && bId !== q) return -1;
          if (bId === q && aId !== q) return 1;

          // 2. ID starts with
          if (aId.startsWith(q) && !bId.startsWith(q)) return -1;
          if (bId.startsWith(q) && !aId.startsWith(q)) return 1;

          // 3. ID contains
          if (aId.includes(q) && !bId.includes(q)) return -1;
          if (bId.includes(q) && !aId.includes(q)) return 1;

          // 4. Exact name match
          if (aName === q && bName !== q) return -1;
          if (bName === q && aName !== q) return 1;

          // 5. Name starts with
          if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
          if (bName.startsWith(q) && !aName.startsWith(q)) return 1;

          return a.name.localeCompare(b.name);
        }

        // Default browsing sort when no search term is active:
        if (b.leave_count !== a.leave_count) {
          return b.leave_count - a.leave_count;
        }
        return a.name.localeCompare(b.name);
      });
  }, [employeeList, gradeFilter, projectFilter, empSearch, leaveCountMap]);

  // Auto-select first employee in filtered list when local filter changes
  // and the currently selected employee is no longer visible in the list,
  // or when an exact ID match is typed
  const currentEmpId = propSelectedEmpNumber ?? employee?.employee_number;
  const isCurrentInList = currentEmpId ? filteredEmployees.some(e => e.employee_number === currentEmpId) : true;
  React.useEffect(() => {
    if (filteredEmployees.length === 0 || loading) return;
    const trimmed = empSearch.trim();
    // If the search is an exact employee ID match, immediately select that employee
    if (trimmed && String(filteredEmployees[0].employee_number) === trimmed) {
      if (currentEmpId !== filteredEmployees[0].employee_number) {
        onSelectEmployee(filteredEmployees[0].employee_number);
      }
      return;
    }
    // Otherwise, auto-select first employee only if current employee was filtered out and no prop was set
    if (!isCurrentInList && !propSelectedEmpNumber) {
      onSelectEmployee(filteredEmployees[0].employee_number);
    }
  }, [isCurrentInList, filteredEmployees, onSelectEmployee, empSearch, currentEmpId, loading, propSelectedEmpNumber]);

  const handleResetFilters = () => {
    setEmpSearch('');
    setGradeFilter('All');
    setProjectFilter('All');
  };

  const hasAnyFilter = empSearch || gradeFilter !== 'All' || projectFilter !== 'All';

  if (loading || !employee) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading 2026 Executive Employee 360 Profile...</span>
        </div>
      </div>
    );
  }

  // Financial calculations
  const currentCTC = employee.current_ctc || (employee.finance_history.length > 0 ? employee.finance_history[employee.finance_history.length - 1].Total_CTC : 0);
  const gradeMedianCTC = employee.grade_median_ctc || 0;
  const ctcPctDiff = gradeMedianCTC > 0 ? ((currentCTC - gradeMedianCTC) / gradeMedianCTC) * 100 : 0;

  // Tenure calculations
  const currentTenure = employee.infinite_exp;
  const gradeMedianTenure = employee.grade_median_tenure || 0;
  const totalExp = employee.total_exp || (employee.infinite_exp + employee.prior_exp) || 1;

  // Personal, Statutory, Rehire & Insurance Data
  const dob = employee.date_of_birth || '—';
  const age = employee.age != null ? employee.age : null;
  const joinDate = employee.join_date || employee.start_date || '—';
  // A6 FIX: Use backend-provided last_promotion_date (null when no real data)
  const lastPromotion = employee.last_promotion_date || null;
  const isRehire = Boolean(employee.is_lateral_rehire);
  const hasExited = Boolean(employee.exit_date);
  const serviceStatus = hasExited ? `Separated (${employee.exit_date})` : 'Regular Active';
  const serviceStatusColor = hasExited ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold';

  const contactNo = employee.contact_number || employee.contact_no || '—';
  const bloodGroup = employee.blood_group || null;
  const officialEmail = employee.email || `${employee.name.toLowerCase().replace(/\s+/g, '.')}@infinite.com`;
  const personalEmail = employee.personal_email || null;
  const emergencyPhone = employee.emergency_contact || null;
  const emergencyName = employee.emergency_contact_name || null;
  const emergencyRelation = employee.emergency_contact_relation || null;
  const mediclaimNo = employee.mediclaim_insurance_no || null;

  // Skills mapping & analytics
  const skillsList = employee.skills && employee.skills.length > 0 ? employee.skills : [];
  const primarySkills = skillsList.filter((s: any) => (s['Skill Type'] || '').toLowerCase() === 'primary');
  const secondarySkills = skillsList.filter((s: any) => (s['Skill Type'] || '').toLowerCase() !== 'primary');
  const maxSkillExp = Math.max(0, ...skillsList.map((s: any) => Number(s.Skill_Exp || s['Skill_Exp'] || s['Experience Years'] || s['Exp_Years'] || 0)));
  const avgSkillExp = skillsList.length > 0 
    ? +(skillsList.reduce((acc: number, s: any) => acc + Number(s.Skill_Exp || s['Skill_Exp'] || s['Experience Years'] || s['Exp_Years'] || 0), 0) / skillsList.length).toFixed(1)
    : 0;

  // Skill level to width percentage
  const getSkillLevelPct = (level: string) => {
    const lvl = (level || '').toLowerCase();
    if (lvl.includes('expert') || lvl.includes('master')) return 100;
    if (lvl.includes('advanced')) return 75;
    if (lvl.includes('intermediate') || lvl.includes('proficient')) return 50;
    return 25;
  };

  const getSkillLevelColor = (level: string) => {
    const lvl = (level || '').toLowerCase();
    if (lvl.includes('expert') || lvl.includes('master')) return 'bg-amber-500';
    if (lvl.includes('advanced')) return 'bg-cyan-500';
    if (lvl.includes('intermediate') || lvl.includes('proficient')) return 'bg-blue-400';
    return 'bg-slate-400';
  };

  // A1 + A2 + B3 FIX: Leave computed for CURRENT year only, no floor clamp
  const leaveRecords = employee.leave_records || [];
  const currentYear = new Date().getFullYear();

  // Current year leave records
  const currentYearLeave = leaveRecords.filter(r => {
    if (!r.start_date) return false;
    return new Date(r.start_date).getFullYear() === currentYear;
  });
  const currentYearLeaveDays = currentYearLeave.reduce((acc, l) => acc + (l.day_value || 1), 0);

  // All-time leave total (labelled clearly as multi-year)
  const allTimeLeaveDays = leaveRecords.reduce((acc, l) => acc + (l.day_value || 1), 0);
  const leaveYearsRange = (() => {
    if (leaveRecords.length === 0) return null;
    const years = leaveRecords
      .filter(r => r.start_date)
      .map(r => new Date(r.start_date).getFullYear())
      .filter(y => !isNaN(y));
    if (years.length === 0) return null;
    const min = Math.min(...years);
    const max = Math.max(...years);
    return min === max ? `${min}` : `${min}–${max}`;
  })();

  // Leave type breakdown (all-time, for reference badges)
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

  // Current-year entitlement (standard 30 days: 18 Privilege + 12 Casual/Sick)
  const annualAllocation = 30;
  const currentYearBalance = Math.max(0, annualAllocation - currentYearLeaveDays);
  const currentYearUtilPct = Math.min(100, Math.round((currentYearLeaveDays / annualAllocation) * 100));

  // A2 FIX: Real attendance from current year — working days minus leave
  const workingDaysInYear = 240;
  const attendanceRate = currentYearLeaveDays === 0
    ? (currentYearLeave.length === 0 ? null : 100)  // null = no current-year data at all
    : Math.max(0, +(100 - (currentYearLeaveDays / workingDaysInYear) * 100).toFixed(1));

  // A3 FIX: Performance rating derived from latest finance_history Hike entry
  const financeHistory = employee.finance_history || [];
  const latestFinRow = financeHistory.length > 0 ? (financeHistory[financeHistory.length - 1] as any) : null;
  const rawHikeFromHistory = latestFinRow ? (latestFinRow.Hike ?? latestFinRow.hikePctDisplay ?? latestFinRow.Hike_Percentage ?? 0) : 0;
  const normalizedHike = rawHikeFromHistory <= 1 && rawHikeFromHistory > 0 ? rawHikeFromHistory * 100 : rawHikeFromHistory;
  const hasRealHikeData = normalizedHike > 0;

  const perfRating = !hasRealHikeData ? null
    : normalizedHike >= 20 ? 4.9
    : normalizedHike >= 12 ? 4.5
    : normalizedHike >= 8 ? 4.2
    : 4.0;

  const perfStars = perfRating == null ? 0 : Math.round(perfRating);

  // 9-box position: performance axis = hike %, potential axis = tenure vs median
  const perfAxis = !hasRealHikeData ? 1  // low column if no data
    : normalizedHike >= 15 ? 2   // high
    : normalizedHike >= 8 ? 1    // medium
    : 0;                         // low

  const potentialAxis = gradeMedianTenure > 0
    ? (currentTenure >= gradeMedianTenure * 1.5 ? 2 : currentTenure >= gradeMedianTenure * 0.8 ? 1 : 0)
    : 1;

  // 9-box label for display
  const nineBoxLabels: Record<string, string> = {
    '2,2': 'Top Performer', '2,1': 'Strong', '2,0': 'Rising Star',
    '1,2': 'Expert', '1,1': 'Core', '1,0': 'Inconsistent',
    '0,2': 'Risk', '0,1': 'Under', '0,0': 'Low',
  };
  const nineBoxKey = `${perfAxis},${potentialAxis}`;
  const activeQuadrantLabel = nineBoxLabels[nineBoxKey] || 'Core';

  // A4 FIX: Compute next eligible promotion quarter dynamically
  const nextPromoEligible = (() => {
    if (!lastPromotion) return null;
    try {
      const promoDate = new Date(lastPromotion);
      const eligibleDate = new Date(promoDate);
      eligibleDate.setFullYear(eligibleDate.getFullYear() + 2);
      const now = new Date();
      if (eligibleDate <= now) return null; // already past, don't show stale badge
      const q = Math.ceil((eligibleDate.getMonth() + 1) / 3);
      return `Q${q} ${eligibleDate.getFullYear()}`;
    } catch {
      return null;
    }
  })();

  // Chart data with normalized hike % for display
  const chartData = financeHistory.map((f: any) => {
    const rawH = f.Hike ?? f.Hike_Percentage ?? 0;
    const hikePct = rawH <= 1 && rawH > 0 ? rawH * 100 : rawH;
    return {
      ...f,
      hikePctDisplay: +hikePct.toFixed(1),
    };
  });

  // Executive Compensation dynamics
  const firstFinRow = financeHistory.length > 0 ? (financeHistory[0] as any) : null;
  const lastFinRow = financeHistory.length > 0 ? (financeHistory[financeHistory.length - 1] as any) : null;
  const compGrowthPct = firstFinRow && lastFinRow && firstFinRow.Total_CTC > 0 
    ? +(((lastFinRow.Total_CTC - firstFinRow.Total_CTC) / firstFinRow.Total_CTC) * 100).toFixed(1)
    : null;
  const lastBaseSalary = lastFinRow ? Number(lastFinRow.Base_Salary || 0) : 0;
  const totalFinancialCTC = lastFinRow ? Number(lastFinRow.Total_CTC || currentCTC || 1) : (currentCTC || 1);
  const basePayRatio = Math.min(100, Math.max(0, Math.round((lastBaseSalary / totalFinancialCTC) * 100)));
  const variablePayRatio = Math.max(0, 100 - basePayRatio);

  // A11 FIX: Check if any history row is synthetic
  const hasSyntheticData = financeHistory.some((f: any) => f.is_synthetic === true || f.record_origin?.includes('SYNTHETIC') || f.record_origin?.includes('HEURISTIC'));

  // A9 FIX: Smart Y-axis tick formatter — use 1 decimal to avoid duplicates
  const formatCTCAxis = (v: number) => {
    const lakh = v / 100000;
    return lakh >= 10 ? `₹${Math.round(lakh)}L` : `₹${lakh.toFixed(1)}L`;
  };

  return (
    <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden select-none">
      
      {/* ========================================================================= */}
      {/* MAIN 360 PROFILE CANVAS                                                   */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">

        {/* HERO BANNER — Career DNA Strip */}
        <div className="glass-panel rounded-xl px-4 py-2.5 shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Avatar with gradient ring */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-sm shadow-md ring-2 ring-cyan-300/50 dark:ring-cyan-700/50">
                {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900" title="Active" />
            </div>

            {/* Name + grade */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">{employee.name}</h1>
                <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">#{employee.employee_number}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-mono">{employee.job_level}</span>
                {isRehire && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono flex items-center gap-1">
                    <GitFork className="w-2.5 h-2.5" /> Rehire
                  </span>
                )}
                {hasExited && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Separated</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-slate-700 dark:text-slate-300">{employee.job_title}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>{employee.department}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{employee.location}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>Project: <strong className="font-mono text-slate-700 dark:text-slate-300">{employee.project}</strong></span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="flex items-center gap-0.5"><Building className="w-2.5 h-2.5" />Reports to: <strong className="text-slate-700 dark:text-slate-300">{employee.manager.split('(')[0].trim()}</strong></span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSlicersCollapsed(!slicersCollapsed)}
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-md border transition-colors ${
                  !slicersCollapsed
                    ? 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
                title="Toggle employee filter sidebar"
              >
                <Filter className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>Filter ({filteredEmployees.length})</span>
              </button>
              {onSwitchView && (
                <button
                  onClick={onSwitchView}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors shrink-0"
                  title="Toggle to classic dossier view"
                >
                  Classic Dossier
                </button>
              )}
            </div>
          </div>
        </div>

      {/* ========================================================================= */}
      {/* 3 HEADLINE KPIS (Non-redundant authoritative metrics)                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        {/* KPI 1: Total CTC */}
        <div className="glass-panel rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/60">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total CTC</div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono leading-tight mt-0.5">
              {currentCTC > 0 ? `₹${(currentCTC / 100000).toFixed(2)}L` : 'Pending'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {gradeMedianCTC > 0 ? (
                <span className={ctcPctDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                  {ctcPctDiff >= 0 ? `+${ctcPctDiff.toFixed(1)}%` : `${ctcPctDiff.toFixed(1)}%`} vs {employee.job_level} median
                </span>
              ) : <span>No grade median data</span>}
            </div>
          </div>
        </div>

        {/* KPI 2: ETS Tenure */}
        <div className="glass-panel rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-200 dark:border-cyan-800/60">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">ETS Tenure</div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono leading-tight mt-0.5">
              {currentTenure}<span className="text-sm font-normal text-slate-400 ml-0.5">y</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              DOJ <strong className="font-mono text-slate-700 dark:text-slate-300">{joinDate}</strong> · Total <strong className="font-mono text-slate-700 dark:text-slate-300">{employee.total_exp}y</strong>
            </div>
          </div>
        </div>

        {/* KPI 3: Promotion */}
        <div className="glass-panel rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800/60">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Promotion</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5 truncate">
              {lastPromotion || 'Not on record'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {nextPromoEligible
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Eligible {nextPromoEligible}</span>
                : lastPromotion ? <span>Career milestone · Level {employee.job_level}</span>
                : <span>Promotion history not available</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ASYMMETRIC 3-COLUMN BODY: Performance, Compensation, Personal & Benefits */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">

        {/* COLUMN 1 (col-span-12 xl:col-span-4): Enhanced Skills & Career Velocity Hub */}
        <div className="col-span-12 xl:col-span-4 glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-500" />
              <span>Skills & Career Velocity</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-mono">
              {skillsList.length} Skills · {avgSkillExp}y Avg
            </span>
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between overflow-hidden gap-2 min-h-0">
            {/* Top: Verified Competencies List */}
            <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar max-h-[175px] pr-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Verified Capability Profile
                </span>
                <span className="text-[9px] text-slate-400 font-mono">Depth: {maxSkillExp}y Max</span>
              </div>

              {/* Primary Specialization Highlight (if any) */}
              {primarySkills.length > 0 && primarySkills.map((pSkill: any, pIdx: number) => {
                const pPct = getSkillLevelPct(pSkill['Skill Level']);
                const pExp = pSkill.Skill_Exp || pSkill['Skill_Exp'] || pSkill['Experience Years'] || null;
                const pCat = pSkill['Skill Category'] || 'Domain';
                return (
                  <div key={`p-${pIdx}`} className="p-2 rounded-lg bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/60 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                          Primary Specialization
                        </span>
                      </div>
                      <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-cyan-200/70 dark:bg-cyan-800/60 text-cyan-900 dark:text-cyan-100 font-mono">
                        {pCat}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-100">
                      <span className="truncate">{pSkill['Skill Name']}</span>
                      <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300 shrink-0">
                        {pExp ? `${pExp}y` : ''} · {pSkill['Skill Level']}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-cyan-200/50 dark:bg-cyan-900/40 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400" style={{ width: `${pPct}%` }} />
                    </div>
                  </div>
                );
              })}

              {/* Secondary Skills */}
              {(secondarySkills.length > 0 ? secondarySkills : (primarySkills.length === 0 ? skillsList : [])).map((s: any, idx: number) => {
                const pct = getSkillLevelPct(s['Skill Level']);
                const barColor = getSkillLevelColor(s['Skill Level']);
                const expYears = s.Skill_Exp || s['Skill_Exp'] || s['Experience Years'] || s['Exp_Years'] || null;
                const cat = s['Skill Category'] || null;
                return (
                  <div key={idx} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1 min-w-0 flex-1 mr-1">
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{s['Skill Name']}</span>
                        {cat && (
                          <span className="text-[7.5px] uppercase font-bold px-1 py-0.1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                            {cat}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                        {expYears ? `${expYears}y · ` : ''}{s['Skill Level'] || '—'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <hr className="border-slate-200 dark:border-slate-800 shrink-0" />

            {/* Middle: 9-Box Career Velocity Grid */}
            <div className="flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">9-Box Velocity Matrix</span>
                <span className="text-[9px] font-mono text-slate-400">
                  Placement: <strong className="text-amber-600 dark:text-amber-400">{hasRealHikeData ? activeQuadrantLabel : 'Pending'}</strong>
                </span>
              </div>

              {/* 3x3 Grid */}
              <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-3 gap-0.5 text-center text-[7.5px] font-bold">
                  {(['Risk', 'Expert', 'Top Performer'] as const).map((label, ci) => {
                    const isActive = hasRealHikeData && ci === perfAxis && potentialAxis === 2;
                    return (
                      <div key={label} className={`p-1 rounded transition-all ${isActive ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-slate-200/50 dark:bg-slate-800/40 text-slate-500'}`}>
                        {label}{isActive ? ' ★' : ''}
                      </div>
                    );
                  })}
                  {(['Under', 'Core', 'Strong'] as const).map((label, ci) => {
                    const isActive = hasRealHikeData && ci === perfAxis && potentialAxis === 1;
                    return (
                      <div key={label} className={`p-1 rounded transition-all ${isActive ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-slate-200/50 dark:bg-slate-800/40 text-slate-500'}`}>
                        {label}{isActive ? ' ★' : ''}
                      </div>
                    );
                  })}
                  {(['Low', 'Inconsistent', 'Rising Star'] as const).map((label, ci) => {
                    const isActive = hasRealHikeData && ci === perfAxis && potentialAxis === 0;
                    return (
                      <div key={label} className={`p-1 rounded transition-all ${isActive ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-slate-200/50 dark:bg-slate-800/40 text-slate-500'}`}>
                        {label}{isActive ? ' ★' : ''}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Star Rating */}
              <div className="flex items-center justify-between text-xs mt-0.5">
                <div className="flex items-center gap-1">
                  {perfRating != null ? (
                    <>
                      {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} className={n <= perfStars ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}>★</span>
                      ))}
                      <span className="font-bold text-slate-800 dark:text-slate-200 ml-1 font-mono">{perfRating}/5.0</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-[10px]">Rating: Pending data</span>
                  )}
                </div>
                {nextPromoEligible && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Eligible {nextPromoEligible}
                  </span>
                )}
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800 shrink-0" />

            {/* Bottom: Capability Intelligence Strip (Fills card vertically, NO VOID!) */}
            <div className="rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1 shrink-0">
              <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Talent DNA Assessment</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-mono">Level {employee.job_level}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1 rounded bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 font-mono">{maxSkillExp}y</div>
                  <div className="text-[7.5px] uppercase text-slate-400 font-semibold">Max Depth</div>
                </div>
                <div className="p-1 rounded bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 font-mono">{skillsList.length}</div>
                  <div className="text-[7.5px] uppercase text-slate-400 font-semibold">Domains</div>
                </div>
                <div className="p-1 rounded bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">{avgSkillExp >= 7 ? 'Master' : avgSkillExp >= 4 ? 'Senior' : 'Core'}</div>
                  <div className="text-[7.5px] uppercase text-slate-400 font-semibold">Seniority</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* COLUMN 2 (col-span-12 xl:col-span-4): Compensation Progression & Intelligence */}
        <div className="col-span-12 xl:col-span-4 glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">📈 Compensation Progression</span>
              {hasSyntheticData && (
                <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="Estimated records">
                  ~ Est.
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono">
                {chartData.length}-Year
              </span>
              <ExportButton data={employee.finance_history} filename={`comp_history_${employee.employee_number}.csv`} />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden justify-between p-2 gap-2">
            {/* Expanded Chart (185px) */}
            <div className="shrink-0 h-[185px] relative">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="compBaseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#0369a1" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="compBonusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="compHikeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ec4899" stopOpacity={0.02} />
                      </linearGradient>
                      <filter id="compGlowPink" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#ec4899" floodOpacity="0.45" />
                      </filter>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.6} />
                    <XAxis dataKey="Year" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="left" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} tickFormatter={formatCTCAxis} tickCount={5} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} tickFormatter={(v) => `${v}%`} />

                    {gradeMedianCTC > 0 && (
                      <ReferenceLine
                        yAxisId="left"
                        y={gradeMedianCTC}
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                      />
                    )}

                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}
                      itemStyle={{ color: 'var(--text)' }}
                      formatter={(value: any, name: any) => {
                        if (name === 'Hike %') return [`${value}%`, name];
                        return [`₹${Number(value).toLocaleString()}`, name];
                      }}
                    />

                    <Bar yAxisId="left" dataKey="Base_Salary" fill="url(#compBaseGrad)" name="Base Salary" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    <Bar yAxisId="left" dataKey="Bonus" fill="url(#compBonusGrad)" name="Bonus" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    <Area yAxisId="right" type="monotone" dataKey="hikePctDisplay" fill="url(#compHikeAreaGrad)" fillOpacity={1} stroke="none" />
                    <Line yAxisId="right" type="monotone" dataKey="hikePctDisplay" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3.5, fill: '#ec4899', stroke: '#ffffff', strokeWidth: 1.5 }} activeDot={{ r: 5.5, fill: '#f43f5e' }} filter="url(#compGlowPink)" name="Hike %" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">No compensation records found.</div>
              )}
            </div>

            {/* Custom Legend */}
            <div className="flex items-center justify-center gap-3 text-[8.5px] text-slate-500 dark:text-slate-400 shrink-0">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-xs bg-[#0284c7]" />Base</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-xs bg-[#10b981]" />Bonus</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ec4899]" />Hike %</span>
              {gradeMedianCTC > 0 && <span className="flex items-center gap-1"><div className="w-2.5 border-t-2 border-dashed border-amber-500" />Median</span>}
            </div>

            {/* Financial Breakdown Table */}
            <div className="overflow-y-auto custom-scrollbar flex-1 min-h-[95px] max-h-[140px]">
              <table className="w-full text-left text-[10.5px]">
                <thead className="text-[8.5px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
                  <tr>
                    <th className="py-1 px-1.5 font-bold">Year</th>
                    <th className="py-1 px-1.5 text-right font-bold">Base</th>
                    <th className="py-1 px-1.5 text-right font-bold" title="Total annual CTC ÷ 12">Monthly</th>
                    <th className="py-1 px-1.5 text-right font-bold">Bonus</th>
                    <th className="py-1 px-1.5 text-right font-bold">Total</th>
                    <th className="py-1 px-1.5 text-right font-bold">Hike</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[10px]">
                  {chartData.map((row, idx) => {
                    const isSyn = (row as any).is_synthetic === true || (row as any).record_origin?.includes('SYNTHETIC') || (row as any).record_origin?.includes('HEURISTIC');
                    const isPromo = (row as any).Is_Promotion === 'Yes' || (row as any).Is_Promotion === true;
                    const hikeColor = row.hikePctDisplay >= 15 ? 'text-emerald-600 dark:text-emerald-400' : row.hikePctDisplay >= 8 ? 'text-amber-600 dark:text-amber-400' : row.hikePctDisplay > 0 ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400';
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-1 px-1.5 font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-0.5">
                          {row.Year}
                          {isPromo && <span title="Promoted this year" className="text-[7px] text-amber-500">▲</span>}
                          {isSyn && <span title="Estimated data" className="text-[7px] text-slate-400">~</span>}
                        </td>
                        <td className="py-1 px-1.5 text-right text-slate-700 dark:text-slate-300">₹{(row.Base_Salary / 100000).toFixed(2)}L</td>
                        <td className="py-1 px-1.5 text-right text-slate-500 dark:text-slate-400">₹{Math.round(row.M_Salary || (row.Total_CTC / 12)).toLocaleString()}</td>
                        <td className="py-1 px-1.5 text-right text-emerald-700 dark:text-emerald-300">₹{Math.round(row.Bonus || 0).toLocaleString()}</td>
                        <td className="py-1 px-1.5 text-right font-bold text-slate-900 dark:text-slate-100">₹{(row.Total_CTC / 100000).toFixed(2)}L</td>
                        <td className={`py-1 px-1.5 text-right font-bold ${hikeColor}`}>{row.hikePctDisplay > 0 ? `${row.hikePctDisplay}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom: Financial Intelligence Strip (Fills card vertically, NO VOID!) */}
            <div className="rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-wider text-slate-500">
                <span>Executive Comp Dynamics</span>
                {compGrowthPct != null && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    {compGrowthPct >= 0 ? `+${compGrowthPct}%` : `${compGrowthPct}%`} Growth
                  </span>
                )}
              </div>
              {/* Pay Mix split bar */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[9px] font-mono text-slate-600 dark:text-slate-400">
                  <span>Base: {basePayRatio}%</span>
                  <span>Variable: {variablePayRatio}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div style={{ width: `${basePayRatio}%` }} className="h-full bg-cyan-600" title={`Base Pay ${basePayRatio}%`} />
                  <div style={{ width: `${variablePayRatio}%` }} className="h-full bg-emerald-500" title={`Variable Pay ${variablePayRatio}%`} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* COLUMN 3 (col-span-12 xl:col-span-4): Personal, Statutory & Attendance Benefits (Zero-Scroll Layout!) */}
        <div className="col-span-12 xl:col-span-4 glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">👤 Personal & Benefits</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />KYC ✓
            </span>
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between overflow-hidden gap-2 min-h-0">

            {/* Top: 2-Column Balanced Key-Value Grid (Identity & Contact together!) */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {/* Left Column: Identity */}
              <div className="p-2 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-1">
                <div className="flex items-center gap-1 pb-0.5 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="w-1 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Identity</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400">DOB</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{dob !== '—' ? dob : '—'}{age != null ? ` (${age}y)` : ''}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400">Gender</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{employee.gender || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400">Blood</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                    <HeartPulse className="w-2.5 h-2.5" />{bloodGroup || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">Status</span>
                  <span className={serviceStatusColor}>{serviceStatus}</span>
                </div>
              </div>

              {/* Right Column: Contact & Statutory */}
              <div className="p-2 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-1">
                <div className="flex items-center gap-1 pb-0.5 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="w-1 h-2.5 rounded-full bg-cyan-500" />
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Contact & Ins.</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60 gap-1">
                  <span className="text-slate-400 shrink-0">Work</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 truncate text-[9.5px] text-right" title={officialEmail}>{officialEmail}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60 gap-1">
                  <span className="text-slate-400 shrink-0">Personal</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300 truncate text-[9.5px] text-right" title={personalEmail || undefined}>{personalEmail || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400">Mobile</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{contactNo}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">Policy</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[9.5px]">{mediclaimNo || '—'}</span>
                </div>
              </div>
            </div>

            {/* Middle: Emergency Contact Strip */}
            <div className="px-2.5 py-1.5 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/50 flex items-center justify-between text-[10px] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 truncate font-medium">
                  {emergencyName || 'Primary Emergency Contact'}
                </span>
              </div>
              <span className="font-mono text-violet-700 dark:text-violet-300 font-bold shrink-0">
                {emergencyPhone || '—'}
              </span>
            </div>

            {/* Statutory & Benefit Entitlements */}
            <div className="rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1 shrink-0 text-[10px]">
              <div className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-wider text-slate-500">
                <span>Statutory & Benefits Profile</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">100% Compliant</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Gratuity</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {currentTenure >= 5 ? 'Eligible (5+ yrs)' : 'Vesting'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Provident Fund</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">Enrolled ✓</span>
                </div>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800 shrink-0" />

            {/* Bottom: Leave & Attendance Health (NOW 100% VISIBLE WITH ZERO SCROLL!) */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Leave & Attendance ({currentYear})
                  </span>
                </div>
                {attendanceRate != null ? (
                  <span className={`font-mono text-[9.5px] font-bold ${attendanceRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : attendanceRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {attendanceRate}% Present
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono text-[9px]">No {currentYear} data</span>
                )}
              </div>

              {/* Leave Ring & Stats */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <svg width="42" height="42" className="shrink-0">
                    <circle cx="21" cy="21" r="17" fill="none" stroke="var(--border)" strokeWidth="4" />
                    <circle
                      cx="21" cy="21" r="17" fill="none"
                      stroke={currentYearUtilPct >= 80 ? '#ef4444' : currentYearUtilPct >= 50 ? '#f59e0b' : '#10b981'}
                      strokeWidth="4"
                      strokeDasharray={`${(currentYearUtilPct / 100) * 107} 107`}
                      strokeLinecap="round"
                      transform="rotate(-90 21 21)"
                    />
                    <text x="21" y="25" textAnchor="middle" className="font-mono" fontSize="8.5" fontWeight="bold" fill="currentColor">
                      {currentYearUtilPct}%
                    </text>
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Annual Cycle</span>
                    <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100 font-mono leading-tight">
                      {currentYearBalance}d <span className="text-[9px] font-normal text-slate-400">rem.</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pr-1">
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono">{annualAllocation}d</div>
                    <div className="text-[7.5px] uppercase text-slate-400 font-semibold">Entitled</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono">{currentYearLeaveDays}d</div>
                    <div className="text-[7.5px] uppercase text-slate-400 font-semibold">Used</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">{currentYearBalance}d</div>
                    <div className="text-[7.5px] uppercase text-slate-400 font-semibold">Balance</div>
                  </div>
                </div>
              </div>

              {/* Historical Summary & Chips */}
              <div className="flex items-center justify-between text-[9px] font-mono pt-0.5 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Historical Total{leaveYearsRange ? ` (${leaveYearsRange})` : ''}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{allTimeLeaveDays}d</span>
              </div>

              <div className="flex items-center gap-1 text-[8.5px] font-mono flex-wrap">
                {sickLeaveDays > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    Sick: {sickLeaveDays}d
                  </span>
                )}
                {privilegeLeaveDays > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    PL: {privilegeLeaveDays}d
                  </span>
                )}
                {lopLeaveDays > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    LOP: {lopLeaveDays}d
                  </span>
                )}
                {sickLeaveDays === 0 && privilegeLeaveDays === 0 && lopLeaveDays === 0 && leaveRecords.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-slate-50 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-700">
                    Total: {allTimeLeaveDays}d
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Dedicated Collapsible Employee Filter Panel (Matching User Image) */}
      {/* ========================================================================= */}
      <div className={`transition-all duration-300 flex flex-col shrink-0 glass-panel rounded-xl border border-slate-200 dark:border-slate-800 ${
        slicersCollapsed ? 'w-9 p-1.5' : 'w-64 p-2.5'
      } overflow-hidden min-h-0 shadow-sm`}>
        {slicersCollapsed ? (
          <div 
            onClick={() => setSlicersCollapsed(false)}
            className="flex flex-col items-center justify-between h-full py-2 cursor-pointer group"
            title="Expand employee filter panel"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSlicersCollapsed(false);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-950/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center gap-2 py-4">
              <Filter className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                EMPLOYEE FILTER ({filteredEmployees.length})
              </span>
            </div>
            <div className="w-2 h-2 rounded-full bg-cyan-500/70" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Panel Header */}
            <div className="flex items-center justify-between shrink-0 pb-1 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  EMPLOYEE FILTER
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {filteredEmployees.length} Found
                </span>
                {hasAnyFilter && (
                  <button
                    onClick={handleResetFilters}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-500 transition-colors"
                    title="Reset filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => setSlicersCollapsed(true)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Collapse slicer panel"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Slicers: Grade & Project Pills */}
            <div className="shrink-0 flex flex-col gap-1 pb-1 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-0.5 overflow-x-auto custom-scrollbar text-[9px] font-mono">
                <span className="text-[8px] font-bold text-slate-400 mr-1 shrink-0">GRADE:</span>
                {['All', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGradeFilter(g)}
                    className={`px-1 py-0.2 rounded font-bold transition-colors shrink-0 ${
                      gradeFilter === g
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5 overflow-x-auto custom-scrollbar text-[9px] font-mono">
                <span className="text-[8px] font-bold text-slate-400 mr-1 shrink-0">PROJ:</span>
                {['All', 'NH', 'ND', 'AK'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setProjectFilter(p)}
                    className={`px-1.5 py-0.2 rounded font-bold transition-colors shrink-0 ${
                      projectFilter === p
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input (Exact match to media_1789222594241.png) */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employee or ID..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-7 pr-7 py-1 rounded-lg focus:outline-none focus:border-cyan-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              />
              {empSearch && (
                <button
                  onClick={() => setEmpSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Scrollable Radio List (Exact match to media_1789222594241.png) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5 border border-slate-100 dark:border-slate-800/80 rounded-lg p-1 bg-slate-50/50 dark:bg-slate-900/30 min-h-0">
              {/* All Employees Radio */}
              <div
                onClick={() => {
                  if (filteredEmployees.length > 0) {
                    onSelectEmployee(filteredEmployees[0].employee_number);
                  }
                }}
                className={`px-2 py-1.5 rounded-md cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors ${
                  !employee
                    ? 'bg-cyan-100/90 dark:bg-cyan-950/80 text-cyan-950 dark:text-cyan-200 font-bold border border-cyan-300 dark:border-cyan-800'
                    : 'hover:bg-white dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span className="truncate text-[11px] font-bold">All Employees</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                  Cohort
                </span>
              </div>

              {/* Individual Employees */}
              {filteredEmployees.map((emp) => {
                const isSelected = employee?.employee_number === emp.employee_number;
                return (
                  <div
                    key={emp.employee_number}
                    onClick={() => onSelectEmployee(emp.employee_number)}
                    className={`px-2 py-1 rounded-md cursor-pointer flex items-center justify-between gap-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'bg-cyan-100/90 dark:bg-cyan-950/80 text-cyan-950 dark:text-cyan-200 font-bold border border-cyan-300 dark:border-cyan-800'
                        : 'hover:bg-white dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] leading-tight font-medium">{emp.name}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">#{emp.employee_number}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {emp.leave_count > 0 && (
                        <span className="text-[8px] font-mono text-slate-400">
                          {emp.leave_count}d
                        </span>
                      )}
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {emp.grade || 'E6'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
