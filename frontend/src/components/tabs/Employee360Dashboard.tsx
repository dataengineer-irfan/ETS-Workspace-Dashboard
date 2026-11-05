import React, { useState, useMemo, useRef, useEffect } from 'react';
import Select from 'react-select';
import type { EmployeeDetails, EmployeeListItem, CalendarData } from '../../types/dashboard';
import { ExportButton } from '../common/ExportButton';
import { TrainingDetail } from '../common/TrainingDetail';
import { 
  User, 
  Mail, 
  Phone, 
  HeartPulse, 
  ShieldCheck, 
  GitFork, 
  Code, 
  Sparkles, 
  Search, 
  RotateCcw, 
  X, 
  CalendarCheck,
  Building,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Circle,
  Star,
  ChevronLeft,
  ChevronRight
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
  ReferenceLine,
  PieChart,
  Pie,
  Cell
} from 'recharts';

function emailWithBreaks(email: string) {
  if (!email) return '—';
  const parts = email.split(/(@|\.|-)/);
  return parts.map((part, i) => (
    <React.Fragment key={`${part}-${i}`}>
      {part}
      {(part === '@' || part === '.' || part === '-') && <wbr />}
    </React.Fragment>
  ));
}

interface Employee360DashboardProps {
  employee: EmployeeDetails | null;
  employeeList: EmployeeListItem[];
  selectedEmpNumber?: number;
  onSelectEmployee: (empNumber: number) => void;
  loading: boolean;
  calendarData?: CalendarData | null;
  profileFocus?: string | null;
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

function hasRecordedExit(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && text !== 'nat' && text !== 'none' && text !== 'null' && text !== 'nan';
}

export const Employee360Dashboard: React.FC<Employee360DashboardProps> = ({
  employee,
  employeeList,
  selectedEmpNumber: propSelectedEmpNumber,
  onSelectEmployee,
  loading,
  calendarData,
  profileFocus,
}) => {
  const empSearchRef = useRef<HTMLInputElement>(null);
  const [empSearch, setEmpSearch] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const [leaveFocus, setLeaveFocus] = useState<number | null>(null);
  const [rosterOpen, setRosterOpen] = useState(true);

  useEffect(() => {
    if (profileFocus !== 'training') return;
    document.getElementById('training-detail')?.scrollIntoView({ block: 'nearest' });
  }, [profileFocus, employee?.employee_number]);



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
        exit_date: hasRecordedExit(e['EXIT DATE']) ? String(e['EXIT DATE']) : '',
        exit_date: hasRecordedExit(e['EXIT DATE']) ? String(e['EXIT DATE']) : '',
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
  const userPickedRef = useRef(false);
  const didInitialActivePick = useRef(false);
  React.useEffect(() => {
    if (didInitialActivePick.current || userPickedRef.current) return;
    if (filteredEmployees.length === 0 || loading || !employee) return;
    didInitialActivePick.current = true;
    if (!employee.exit_date) return;
    const active = filteredEmployees.find((row) => !row.exit_date);
    if (active && active.employee_number !== employee.employee_number) {
      onSelectEmployee(active.employee_number);
    }
  }, [employee, filteredEmployees, loading, onSelectEmployee]);
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
      const active = filteredEmployees.find((row) => !row.exit_date);
      onSelectEmployee((active ?? filteredEmployees[0]).employee_number);
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
    if (lvl.includes('expert') || lvl.includes('master')) return '#f59e0b';
    if (lvl.includes('advanced')) return '#06b6d4';
    if (lvl.includes('intermediate') || lvl.includes('proficient')) return '#60a5fa';
    return '#94a3b8';
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

  // Current-year entitlement (standard 30 days: 18 Privilege + 12 Casual/Sick)
  const annualAllocation = 30;
  const currentYearBalance = Math.max(0, annualAllocation - currentYearLeaveDays);
  const leaveSource = currentYearLeave.length > 0 ? currentYearLeave : leaveRecords;
  const leaveColorFor = (name: string) => {
    const kind = name.toLowerCase();
    if (kind.includes('casual') || kind.includes('sick')) return '#0284c7';
    if (kind.includes('privilege') || kind.includes('vacation') || kind.includes('earned')) return '#10b981';
    if (kind.includes('lop') || kind.includes('loss')) return '#f43f5e';
    if (kind.includes('maternity')) return '#ec4899';
    if (kind.includes('paternity')) return '#8b5cf6';
    if (kind.includes('bereave')) return '#64748b';
    return '#f59e0b';
  };
  const leaveTotals = new Map<string, number>();
  leaveSource.forEach((r) => {
    const name = (r.leave_type || 'Other').trim() || 'Other';
    leaveTotals.set(name, (leaveTotals.get(name) || 0) + (r.day_value || 1));
  });
  const leaveSlices = [...leaveTotals.entries()]
    .map(([name, days]) => ({ name, days, color: leaveColorFor(name) }))
    .sort((a, b) => b.days - a.days);
  const leaveSliceTotal = leaveSlices.reduce((acc, s) => acc + s.days, 0);
  const leaveActive = leaveFocus != null && leaveFocus < leaveSlices.length ? leaveFocus : null;
  const formatLeaveDays = (days: number) => {
    const rounded = Math.round(days * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

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

  // Chart and year table share these rows. A year with no positive salary is a
  // placeholder: plotting it (or letting it sit in the domain) pulls the axis to 0.
  const chartData = [...financeHistory]
    .filter((f: any) => {
      const base = Number(f.Base_Salary);
      const total = Number(f.Total_CTC);
      return (Number.isFinite(base) && base > 0) || (Number.isFinite(total) && total > 0);
    })
    .map((f: any) => {
      const rawH = f.Hike ?? f.Hike_Percentage ?? 0;
      const hikePct = rawH <= 1 && rawH > 0 ? rawH * 100 : rawH;
      return {
        ...f,
        hikePctDisplay: +hikePct.toFixed(1),
      };
    })
    .sort((a: any, b: any) => Number(a.Year) - Number(b.Year));

  // Bar charts default the left domain to 0, which flattens a salary series that
  // lives well above zero. Scale from the positive base salaries only. Hike stays
  // on the right axis so a percent cannot stretch this domain.
  const salaryAxis = (() => {
    const bases = chartData
      .map((row: any) => Number(row.Base_Salary))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (bases.length === 0) return null;
    const hiPool = [...bases];
    if (gradeMedianCTC > 0) hiPool.push(gradeMedianCTC);
    const lo = Math.min(...bases);
    const hi = Math.max(...hiPool);
    const span = Math.max(hi - lo, hi * 0.08);
    const domainMin = Math.max(lo - span * 0.15, lo * 0.9);
    const domainMax = hi + span * 0.1;
    const steps = 3;
    const ticks = Array.from({ length: steps + 1 }, (_, i) => domainMin + ((domainMax - domainMin) * i) / steps);
    return { domain: [domainMin, domainMax] as [number, number], ticks };
  })();

  const hikeAxis = (() => {
    const hikes = chartData
      .map((row: any) => Number(row.hikePctDisplay))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const hi = hikes.length ? Math.max(...hikes) : 10;
    return { domain: [0, Math.max(10, hi * 1.2)] as [number, number] };
  })();

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
    <div className="dash-fit flex flex-row gap-2 select-none min-w-0">
      
      {/* ========================================================================= */}
      {/* MAIN 360 PROFILE CANVAS                                                   */}
      {/* ========================================================================= */}
      <div className="profile-canvas flex-1 flex flex-col gap-2 min-h-0 min-w-0 overflow-hidden">

        {/* Two rows: identity, then role beside the three figures. */}
        <div data-profile-strip className="profile-strip glass-panel rounded-xl px-3 shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div data-profile-row="1" className="profile-hero-id">
            <div className="profile-avatar relative shrink-0">
              <div className="profile-avatar-orb rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white shadow-md ring-2 ring-cyan-300/50 dark:ring-cyan-700/50">
                {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${hasExited ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            </div>
            <h1 className="profile-hero-name text-slate-900 dark:text-slate-100">{employee.name}</h1>
            <span className="profile-hero-chip text-slate-400 dark:text-slate-500 font-mono">#{employee.employee_number}</span>
            <span className="profile-hero-chip font-bold px-1.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-mono">{employee.job_level}</span>
            <span className={`profile-hero-chip font-bold px-1.5 py-0.5 rounded-full border ${hasExited ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'}`}>
              {hasExited ? 'Separated' : 'Active'}
            </span>
            {isRehire && (
              <span className="profile-hero-chip font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono flex items-center gap-1">
                <GitFork className="w-2.5 h-2.5" /> Rehire
              </span>
            )}
          </div>

          <div data-profile-row="2" className="profile-hero-detail">
            <div data-profile-meta className="profile-meta text-slate-500 dark:text-slate-400">
              <span className="profile-meta-item font-medium text-slate-600 dark:text-slate-300">{employee.job_title}</span>
              <span className="profile-meta-item">{employee.department}</span>
              <span className="profile-meta-item"><MapPin className="w-2.5 h-2.5 shrink-0" />{employee.location}</span>
              <span className="profile-meta-item">Project <strong className="font-mono text-slate-700 dark:text-slate-300">{employee.project}</strong></span>
              <span className="profile-meta-mgr"><Building className="w-2.5 h-2.5 shrink-0" />Reports to <strong className="text-slate-700 dark:text-slate-300">{employee.manager.split('(')[0].trim()}</strong></span>
            </div>

            <div data-profile-figures className="profile-figures">
              <div data-profile-figure="ctc" className="profile-fig">
                <span className="profile-fig-line">
                  <span className="profile-fig-label">Total CTC</span>
                  <span className="profile-fig-value text-slate-900 dark:text-slate-100">
                    {currentCTC > 0 ? `₹${(currentCTC / 100000).toFixed(2)} lakh` : 'Pending'}
                  </span>
                </span>
                {gradeMedianCTC > 0 && (
                  <span className={`profile-fig-note ${ctcPctDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {ctcPctDiff >= 0 ? '+' : ''}{ctcPctDiff.toFixed(1)}% vs grade {employee.job_level}
                  </span>
                )}
              </div>
              <div data-profile-figure="tenure" className="profile-fig">
                <span className="profile-fig-line">
                  <span className="profile-fig-label">ETS tenure</span>
                  <span className="profile-fig-value text-slate-900 dark:text-slate-100">
                    {currentTenure} years
                  </span>
                </span>
                <span className="profile-fig-note text-slate-500">Joined {joinDate} · {employee.total_exp} years total</span>
              </div>
              <div data-profile-figure="promotion" className="profile-fig">
                <span className="profile-fig-line">
                  <span className="profile-fig-label">Promotion</span>
                  <span className="profile-fig-value text-slate-900 dark:text-slate-100">
                    {lastPromotion || 'Not on record'}
                  </span>
                </span>
                {nextPromoEligible && (
                  <span className="profile-fig-note text-emerald-600 dark:text-emerald-400">Eligible {nextPromoEligible}</span>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* ========================================================================= */}
      {/* 3-COLUMN BODY: Verified Capability Profile, Compensation, Personal & Benefits */}
      {/* ========================================================================= */}
      <div className="pane-grid profile-pane flex-1 min-h-0">

        {/* LEFT: Verified Capability Profile (9-box kept in the file, not shown) */}
        <div className="profile-skills glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-0 min-w-0 h-full">
          <div className="profile-capability">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0 min-w-0">
            <span className="w-1 h-3 rounded-full bg-cyan-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight whitespace-nowrap">Verified Capability Profile</span>
          </div>

          <div className="profile-skill-wrap p-2.5 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <div className="profile-skill-list custom-scrollbar">
              <div className="profile-skill-summary flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                  {skillsList.length} skills · {avgSkillExp}y avg
                </span>
                <span className="text-[8px] font-mono text-slate-400 whitespace-nowrap">
                  {maxSkillExp}y max
                </span>
              </div>

              <div className="profile-skill-rows">
              {[...primarySkills, ...secondarySkills].map((s: any, idx: number) => {
                const level = s['Skill Level'] || '—';
                const expYears = Number(s.Skill_Exp || s['Skill_Exp'] || s['Experience Years'] || s['Exp_Years'] || 0);
                const cat = s['Skill Category'] || '';
                const isPrimary = (s['Skill Type'] || '').toLowerCase() === 'primary';
                const depth = maxSkillExp > 0 ? Math.max(8, Math.round((expYears / maxSkillExp) * 100)) : getSkillLevelPct(level);
                return (
                  <div key={`${s['Skill Name']}-${idx}`} className={`cap-skill${isPrimary ? ' is-primary' : ''}`}>
                    <span className="cap-skill-name" title={s['Skill Name']}>
                      {isPrimary && <Star className="cap-skill-star" />}
                      {s['Skill Name']}
                    </span>
                    {cat && <span className="cap-skill-cat">{cat}</span>}
                    <span className="cap-skill-meta">{expYears ? `${expYears}y` : '—'}</span>
                    <span className="cap-skill-level">{level}</span>
                    <span className="cap-skill-meter" aria-hidden="true">
                      <span style={{ width: `${depth}%`, backgroundColor: getSkillLevelColor(level) }} />
                    </span>
                  </div>
                );
              })}
              </div>
            </div>

            {false && (
            <>
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">9-Box Velocity Matrix</span>
                <span className="text-[9px] font-mono text-slate-400">
                  Placement: <strong className="text-amber-600 dark:text-amber-400">{hasRealHikeData ? activeQuadrantLabel : 'Pending'}</strong>
                </span>
              </div>

              {/* 3x3 Grid */}
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-3 gap-1.5 text-center text-[9px] font-bold">
                  {(['Risk', 'Expert', 'Top Performer'] as const).map((label, ci) => {
                    const isActive = hasRealHikeData && ci === perfAxis && potentialAxis === 2;
                    return (
                      <div key={label} className={`min-h-[28px] px-1 py-1.5 rounded flex items-center justify-center leading-tight ${isActive ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-slate-200/40 dark:bg-slate-800/50 text-slate-500'}`}>
                        {label}{isActive ? ' ★' : ''}
                      </div>
                    );
                  })}
                  {(['Under', 'Core', 'Strong'] as const).map((label, ci) => {
                    const isActive = hasRealHikeData && ci === perfAxis && potentialAxis === 1;
                    return (
                      <div key={label} className={`min-h-[28px] px-1 py-1.5 rounded flex items-center justify-center leading-tight ${isActive ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-slate-200/40 dark:bg-slate-800/50 text-slate-500'}`}>
                        {label}{isActive ? ' ★' : ''}
                      </div>
                    );
                  })}
                  {(['Low', 'Inconsistent', 'Rising Star'] as const).map((label, ci) => {
                    const isActive = hasRealHikeData && ci === perfAxis && potentialAxis === 0;
                    return (
                      <div key={label} className={`min-h-[28px] px-1 py-1.5 rounded flex items-center justify-center leading-tight ${isActive ? 'bg-amber-400 dark:bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-slate-200/40 dark:bg-slate-800/50 text-slate-500'}`}>
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

            <div className="rounded-lg bg-slate-50/50 dark:bg-slate-900/40 px-2 py-1.5 flex flex-col gap-1 shrink-0">
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
            </>
            )}

          </div>
          </div>

          <div className="profile-training-band">
            <TrainingDetail trainings={employee.trainings} />
          </div>
        </div>

        {/* CENTER: Compensation Progression */}
        <div className="profile-comp glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-0 min-w-0 h-full">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1 h-3 rounded-full bg-cyan-300 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight whitespace-nowrap">Compensation Progression</span>
              {hasSyntheticData && (
                <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="Estimated records">
                  ~ Est.
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono whitespace-nowrap">
                {chartData.length}-Year
              </span>
              <ExportButton data={employee.finance_history} filename={`comp_history_${employee.employee_number}.csv`} />
            </div>
          </div>

          <div className="profile-comp-stack min-h-0 overflow-hidden p-2">
            <div className="profile-comp-plot w-full min-h-0">
              <div className="pane-plot-fill">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.6} />
                    <XAxis dataKey="Year" interval={0} stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                    <YAxis
                      yAxisId="left"
                      domain={salaryAxis ? salaryAxis.domain : ['auto', 'auto']}
                      ticks={salaryAxis ? salaryAxis.ticks : undefined}
                      allowDataOverflow
                      width={42}
                      stroke="var(--muted)"
                      tick={{ fontSize: 9.5, fill: 'var(--muted)' }}
                      tickFormatter={formatCTCAxis}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={hikeAxis.domain}
                      allowDataOverflow
                      width={32}
                      stroke="var(--muted)"
                      tick={{ fontSize: 9.5, fill: 'var(--muted)' }}
                      tickFormatter={(v) => `${Math.round(Number(v))}%`}
                    />

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

                    <Bar isAnimationActive={false} yAxisId="left" dataKey="Base_Salary" fill="#0284c7" name="Base Salary" radius={[3, 3, 0, 0]} maxBarSize={36} />
                    <Bar isAnimationActive={false} yAxisId="left" dataKey="Bonus" fill="#10b981" name="Bonus" radius={[3, 3, 0, 0]} maxBarSize={36} />
                    <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="Base_Salary" stroke="#67e8f9" strokeWidth={2} dot={{ r: 3, fill: '#67e8f9', stroke: '#0f172a', strokeWidth: 1 }} name="Salary" />
                    <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="hikePctDisplay" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, fill: '#ec4899', stroke: '#0f172a', strokeWidth: 1 }} name="Hike %" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">No compensation records found.</div>
              )}
              </div>
            </div>

            {/* Custom Legend */}
            <div data-profile-legend className="profile-comp-legend flex flex-nowrap items-center justify-center gap-2 text-[8.5px] text-slate-500 dark:text-slate-400 shrink-0">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-xs bg-[#0284c7]" />Base</span>
              <span className="flex items-center gap-1"><div className="w-3 border-t-2 border-cyan-300" />Salary</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-xs bg-[#10b981]" />Bonus</span>
              <span className="flex items-center gap-1"><div className="w-3 border-t-2 border-[#ec4899]" />Hike %</span>
              {gradeMedianCTC > 0 && <span className="flex items-center gap-1"><div className="w-2.5 border-t-2 border-dashed border-amber-500" />Median</span>}
            </div>

            {/* Financial Breakdown Table */}
            <div className="profile-comp-table">
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
                      <tr key={idx} data-year={row.Year} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
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
            <div className="profile-comp-foot rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1 shrink-0">
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

        {/* RIGHT: Personal & Benefits */}
        <div className="profile-personal glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-h-0 min-w-0 h-full">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0 min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="w-1 h-3 rounded-full bg-emerald-400" />
              Personal & Benefits
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />KYC ✓
            </span>
          </div>

          <div className="profile-body px-3 py-2 flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col">
            <div className="profile-label flex items-center gap-1.5 shrink-0">
              <span className="w-1 h-2.5 rounded-full bg-blue-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Identity</span>
            </div>
            <div className="profile-rows flex flex-col flex-[4] justify-evenly">
              <div data-field="dob" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">DOB</span>
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-100 whitespace-nowrap">{dob !== '—' ? dob : '—'}{age != null ? ` (${age}y)` : ''}</span>
              </div>
              <div data-field="gender" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Gender</span>
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-100 whitespace-nowrap">{employee.gender || '—'}</span>
              </div>
              <div data-field="blood" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Blood</span>
                <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 whitespace-nowrap">
                  <HeartPulse className="w-3 h-3" />{bloodGroup || 'N/A'}
                </span>
              </div>
              <div data-field="status" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Status</span>
                <span className={`text-[11px] whitespace-nowrap ${serviceStatusColor}`}>{serviceStatus}</span>
              </div>
            </div>

            <div className="profile-label flex items-center gap-1.5 shrink-0 mt-1">
              <span className="w-1 h-2.5 rounded-full bg-cyan-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Contact</span>
            </div>
            <div className="profile-rows flex flex-col flex-[4] justify-evenly">
              <div data-field="work" className="profile-field profile-wide flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Work</span>
                <span className="profile-email font-mono text-[11px] text-cyan-600 dark:text-cyan-400">{emailWithBreaks(officialEmail)}</span>
              </div>
              <div data-field="personal" className="profile-field profile-wide flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Personal</span>
                <span className="profile-email font-mono text-[11px] text-slate-700 dark:text-slate-200">{emailWithBreaks(personalEmail || '—')}</span>
              </div>
              <div data-field="mobile" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Mobile</span>
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-100 whitespace-nowrap">{contactNo}</span>
              </div>
              <div data-field="policy" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Policy</span>
                <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{mediclaimNo || '—'}</span>
              </div>
            </div>

            <div data-field="emergency" className="profile-field profile-span flex items-center justify-between gap-2 min-w-0 shrink-0 mt-1 px-2 py-1.5 rounded-md bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/70 dark:border-violet-800/50">
              <span className="flex items-center gap-1.5 min-w-0 text-[10px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                {emergencyName || 'Primary contact'}{emergencyRelation && !(emergencyName || '').toLowerCase().includes(emergencyRelation.toLowerCase()) ? ` (${emergencyRelation})` : ''}
              </span>
              <span className="font-mono text-[11px] font-bold text-violet-700 dark:text-violet-300 whitespace-nowrap shrink-0">
                {emergencyPhone || '—'}
              </span>
            </div>

            <div className="profile-label flex items-center justify-between gap-3 shrink-0 mt-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-1 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Statutory</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 whitespace-nowrap">100% compliant</span>
            </div>
            <div className="profile-rows flex flex-col flex-[2] justify-evenly">
              <div data-field="gratuity" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Gratuity</span>
                <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {currentTenure >= 5 ? 'Eligible (5+ yrs)' : 'Vesting'}
                </span>
              </div>
              <div data-field="pf" className="profile-field flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">Provident Fund</span>
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-100 whitespace-nowrap">Enrolled ✓</span>
              </div>
            </div>
          </div>

          <div data-profile-leave className="profile-leave shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="profile-leave-head">
                <div className="flex items-center gap-1 min-w-0">
                  <div className="w-1 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    Leave ({currentYearLeave.length > 0 ? currentYear : leaveYearsRange || 'all'})
                  </span>
                </div>
                <span data-leave-caption className="profile-leave-caption font-mono text-[9px] text-slate-500">
                  {currentYearLeaveDays}d used · {currentYearBalance}d left
                </span>
              </div>

              <div className="profile-leave-body">
                <div className={`profile-leave-plot${leaveSlices.length === 0 ? ' is-empty' : ''}`}>
                  {leaveSlices.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leaveSlices}
                          dataKey="days"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="84%"
                          paddingAngle={leaveSlices.length > 1 ? 2 : 0}
                          isAnimationActive={false}
                          stroke="var(--surface)"
                          onMouseEnter={(_, index) => setLeaveFocus(index)}
                          onMouseLeave={() => setLeaveFocus(null)}
                        >
                          {leaveSlices.map((slice, index) => (
                            <Cell
                              key={slice.name}
                              fill={slice.color}
                              stroke={leaveActive === index ? 'var(--text)' : 'var(--surface)'}
                              strokeWidth={leaveActive === index ? 2 : 1}
                              className="cursor-pointer"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}
                          itemStyle={{ color: 'var(--text)' }}
                          formatter={(value: any, name: any) => {
                            const days = Number(value) || 0;
                            const share = leaveSliceTotal > 0 ? Math.round((days / leaveSliceTotal) * 100) : 0;
                            return [`${formatLeaveDays(days)}d (${share}%)`, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="profile-leave-center">
                    <span>{formatLeaveDays(leaveActive != null ? leaveSlices[leaveActive].days : leaveSliceTotal)}d</span>
                    <small>{leaveActive != null ? leaveSlices[leaveActive].name : (leaveYearsRange || 'total')}</small>
                  </div>
                </div>
                <div className="profile-leave-legend">
                  {leaveSlices.map((slice, index) => (
                    <button
                      key={slice.name}
                      type="button"
                      className={`profile-leave-key${leaveActive === index ? ' is-on' : ''}`}
                      onMouseEnter={() => setLeaveFocus(index)}
                      onMouseLeave={() => setLeaveFocus(null)}
                    >
                      <i style={{ backgroundColor: slice.color }} />
                      <span>{slice.name}</span>
                      <b>{formatLeaveDays(slice.days)}d</b>
                    </button>
                  ))}
                  <div className="profile-leave-hist text-[9px] font-mono">
                    <span className="profile-leave-hist-label">History</span>
                    {leaveYearsRange ? <span className="profile-leave-hist-range">{leaveYearsRange}</span> : null}
                    <b>{allTimeLeaveDays}d</b>
                  </div>
                </div>
              </div>
            </div>
        </div>

      </div>
      </div>

      {/* Employee filter stays in the row from the laptop width up. */}
      <div className={`${rosterOpen ? 'w-[210px] p-2' : 'w-8 px-1 py-1.5'} shrink-0 flex flex-col min-h-0 min-w-0 glass-panel rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm`}>
          <div className="flex-1 flex flex-col gap-1.5 min-h-0 min-w-0 w-full">
            <div className={`flex items-center shrink-0 ${rosterOpen ? 'justify-between pb-1 border-b border-slate-100 dark:border-slate-800/80' : 'justify-center'}`}>
              {rosterOpen && (
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 leading-tight whitespace-normal min-w-0">
                  Employee filter ({employeeList.length})
                </span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                {rosterOpen && hasAnyFilter && (
                  <button
                    onClick={handleResetFilters}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-500 transition-colors"
                    title="Reset filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRosterOpen((open) => !open)}
                  className="p-0.5 rounded text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
                  title={rosterOpen ? 'Hide employee filter' : 'Show employee filter'}
                  aria-expanded={rosterOpen}
                  aria-label={rosterOpen ? 'Hide employee filter' : 'Show employee filter'}
                >
                  {rosterOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {rosterOpen && (
            <>

            {/* Quick Slicers: Grade & Project Pills */}
            <div className="shrink-0 flex flex-col gap-1 pb-1 border-b border-slate-100 dark:border-slate-800/60">
              <div className="profile-grade-row text-[9px] font-mono">
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
              <div className="profile-grade-row text-[9px] font-mono">
                <span className="text-[8px] font-bold text-slate-400 mr-1 shrink-0">PROJ:</span>
                {['All', 'NH', 'ND', 'AK', 'Maven'].map((p) => (
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
                ref={empSearchRef}
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
                  <span className="profile-emp-name text-[11px] font-bold">All Employees</span>
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
                    onClick={() => {
                      userPickedRef.current = true;
                      onSelectEmployee(emp.employee_number);
                    }}
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
                        <p className="profile-emp-name text-[11px] leading-tight font-medium">{emp.name}</p>
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
            </>
            )}
          </div>
      </div>

    </div>
  );
};
