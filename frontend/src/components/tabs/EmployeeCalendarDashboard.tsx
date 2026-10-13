import React, { useState, useMemo, useEffect } from 'react';
import type { CalendarData, FilterParams } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
import { ExportButton } from '../common/ExportButton';
import { 
  CalendarDays, 
  Users, 
  Clock,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RotateCcw,
  CheckCircle2,
  Circle,
  Calendar,
  CalendarCheck,
  Layers,
  Sparkles,
  TrendingUp,
  Building2,
  MapPin,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface EmployeeCalendarDashboardProps {
  data: CalendarData | null;
  loading: boolean;
  filters?: FilterParams;
  setFilters?: React.Dispatch<React.SetStateAction<FilterParams>>;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LEAVE_CONFIG: { key: string; label: string; bg: string; activeBg: string; dot: string }[] = [
  { key: 'Casual / Sick', label: 'Casual / Sick', bg: 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/60', activeBg: 'bg-teal-600 text-white border-teal-600 ring-1 ring-teal-400 font-bold', dot: 'bg-teal-500' },
  { key: 'Privilege', label: 'Vacation / Priv', bg: 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60', activeBg: 'bg-indigo-600 text-white border-indigo-600 ring-1 ring-indigo-400 font-bold', dot: 'bg-indigo-500' },
  { key: 'LOP', label: 'Loss of Pay', bg: 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60', activeBg: 'bg-rose-600 text-white border-rose-600 ring-1 ring-rose-400 font-bold', dot: 'bg-rose-500' },
  { key: 'Maternity', label: 'Maternity', bg: 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/60', activeBg: 'bg-purple-600 text-white border-purple-600 ring-1 ring-purple-400 font-bold', dot: 'bg-purple-500' },
  { key: 'Paternity', label: 'Paternity', bg: 'bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60', activeBg: 'bg-cyan-600 text-white border-cyan-600 ring-1 ring-cyan-400 font-bold', dot: 'bg-cyan-500' },
  { key: 'Bereavement', label: 'Bereavement', bg: 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60', activeBg: 'bg-amber-600 text-white border-amber-600 ring-1 ring-amber-400 font-bold', dot: 'bg-amber-500' },
];

const LEAVE_COLORS: { [key: string]: string } = {
  'Casual / Sick': '#0284c7',
  'Privilege': '#10b981',
  'LOP': '#f43f5e',
  'Maternity': '#ec4899',
  'Paternity': '#8b5cf6',
  'Bereavement': '#64748b',
};

const PROJECT_NAMES: Record<string, string> = {
  NH: 'New Hampshire (NH)',
  ND: 'North Dakota (ND)',
  AK: 'Alaska (AK)',
  Other: 'Special Projects',
};

const PROJECT_COLORS = ['#0284c7', '#0d9488', '#d97706', '#8b5cf6'];

export const EmployeeCalendarDashboard: React.FC<EmployeeCalendarDashboardProps> = ({
  data,
  loading,
  filters,
  setFilters,
  onSelectEmployee,
  onOpenEmployeeProfile,
}) => {
  // Slicer local states
  const [empSearch, setEmpSearch] = useState('');
  const [matrixSearch, setMatrixSearch] = useState<string>('');
  const [matrixSortField, setMatrixSortField] = useState<string>('location');
  const [matrixSortDir, setMatrixSortDir] = useState<'asc' | 'desc'>('asc');
  const [bottomTab, setBottomTab] = useState<'seasonality' | 'geography'>('seasonality');
  const [slicersExpanded, setSlicersExpanded] = useState(true);
  const [rosterViewMode, setRosterViewMode] = useState<'date' | 'cohort'>('date');

  // Track the leave type breakdown for the current non-leave-type scope (e.g. Project = NH)
  const [cachedBreakdown, setCachedBreakdown] = useState<Record<string, { records: number; days: number }>>({});

  useEffect(() => {
    // When no leave_type filter is active, update the cached breakdown for this filter context
    if (!filters?.leave_type && data?.leave_type_breakdown && data.leave_type_breakdown.length > 0) {
      const map: Record<string, { records: number; days: number }> = {};
      data.leave_type_breakdown.forEach((item) => {
        map[item.leave_type] = {
          records: item.records_count,
          days: item.total_days,
        };
      });
      setCachedBreakdown(map);
    }
  }, [filters?.leave_type, data?.leave_type_breakdown]);

  // Dynamic leave buttons reflecting active filters (e.g., Project: NH)
  const dynamicLeaveButtons = useMemo(() => {
    const activeMap = (!filters?.leave_type || Object.keys(cachedBreakdown).length === 0)
      ? (data?.leave_type_breakdown || []).reduce((acc, item) => {
          acc[item.leave_type] = { records: item.records_count, days: item.total_days };
          return acc;
        }, {} as Record<string, { records: number; days: number }>)
      : cachedBreakdown;

    return LEAVE_CONFIG.map((cfg) => {
      const stats = activeMap[cfg.key] || { records: 0, days: 0 };
      return {
        ...cfg,
        count: stats.records,
        days: stats.days,
      };
    });
  }, [data?.leave_type_breakdown, cachedBreakdown, filters?.leave_type]);

  // Active Year resolution: default to selected_year from backend (or available year, or 2023)
  const activeYear = useMemo(() => {
    if (filters?.year) {
      const yVal = Array.isArray(filters.year) ? filters.year[0] : filters.year;
      if (yVal && !isNaN(Number(yVal))) return Number(yVal);
    }
    if (filters?.date) {
      const parsed = new Date(filters.date);
      if (!isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return data?.selected_year ?? data?.available_years?.[0] ?? 2023;
  }, [filters?.year, filters?.date, data?.selected_year, data?.available_years]);

  // Active Month resolution: default to January (or month of date filter)
  const activeMonthIdx = useMemo(() => {
    if (filters?.month) {
      const mVal = Array.isArray(filters.month) ? filters.month[0] : filters.month;
      const mIdx = MONTH_SHORT.findIndex(m => m.toLowerCase() === String(mVal).toLowerCase().slice(0, 3));
      if (mIdx !== -1) return mIdx;
    }
    if (filters?.date) {
      const parsed = new Date(filters.date);
      if (!isNaN(parsed.getTime())) return parsed.getMonth();
    }
    return 0; // January
  }, [filters?.month, filters?.date]);

  // Selected Date for calendar roster cross-filtering
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (filters?.date) return filters.date;
    const yr = data?.selected_year ?? data?.available_years?.[0] ?? 2023;
    return `${yr}-01-16`;
  });

  React.useEffect(() => {
    if (filters?.date) {
      setSelectedDate(filters.date);
    } else {
      const prefix = `${activeYear}-${String(activeMonthIdx + 1).padStart(2, '0')}`;
      if (!selectedDate.startsWith(prefix)) {
        setSelectedDate(`${prefix}-16`);
      }
    }
  }, [filters?.date, activeYear, activeMonthIdx]);

  // Active selected employee from filters
  const selectedEmpNumber = useMemo(() => {
    if (!filters?.employee_number) return null;
    return Number(filters.employee_number);
  }, [filters?.employee_number]);

  // Active selected leave type from filters
  const selectedLeaveType = useMemo(() => {
    if (!filters?.leave_type) return 'All';
    return Array.isArray(filters.leave_type) ? filters.leave_type[0] : filters.leave_type;
  }, [filters?.leave_type]);

  // Slicer Year options
  const yearOptions = useMemo(() => {
    return data?.available_years || [2024, 2023, 2022, 2021, 2020];
  }, [data?.available_years]);

  // Filtered employees list for left slicer
  const filteredEmployees = useMemo(() => {
    const list = data?.available_employees || [];
    if (!empSearch.trim()) return list;
    const q = empSearch.toLowerCase().trim();
    return list.filter(e => 
      e.name.toLowerCase().includes(q) || 
      String(e.employee_number).includes(q)
    );
  }, [data?.available_employees, empSearch]);

  // 1. Leave Category Distribution for Right Panel Breakdown
  const formattedLeaveCategories = useMemo(() => {
    const list = data?.leave_type_breakdown || [];
    const totalDays = data?.total_leave_days || 1;
    return list
      .map((item) => ({
        name: item.leave_type,
        days: item.total_days,
        records: item.records_count,
        percentage: Math.round((item.total_days / totalDays) * 100),
        color: LEAVE_COLORS[item.leave_type] || '#0284c7',
      }))
      .sort((a, b) => b.days - a.days);
  }, [data?.leave_type_breakdown, data?.total_leave_days]);

  // 2. 12-Month Leave Seasonality & Burn Rate for Bottom Panel
  const monthlySeasonality = useMemo(() => {
    const months = MONTH_SHORT.map((m, idx) => ({
      month: m,
      monthIdx: idx,
      days: 0,
      records: 0,
    }));

    (data?.events || []).forEach((ev) => {
      const start = new Date(ev.start);
      if (!isNaN(start.getTime())) {
        const m = start.getMonth();
        if (m >= 0 && m < 12) {
          months[m].days += (ev.days || 1);
          months[m].records += 1;
        }
      }
    });

    return months.map((m) => ({
      ...m,
      days: Math.round(m.days * 10) / 10,
    }));
  }, [data?.events]);

  // 3. Departmental Absenteeism & Impact
  const departmentLeaveStats = useMemo(() => {
    const deptMap: Record<string, { days: number; records: number; employees: Set<number> }> = {};
    (data?.events || []).forEach((ev) => {
      const d = ev.department || 'Other';
      if (!deptMap[d]) {
        deptMap[d] = { days: 0, records: 0, employees: new Set() };
      }
      deptMap[d].days += (ev.days || 1);
      deptMap[d].records += 1;
      deptMap[d].employees.add(ev.employee_number);
    });

    const totalDays = data?.total_leave_days || 1;
    return Object.entries(deptMap)
      .map(([department, stats]) => ({
        department,
        days: Math.round(stats.days * 10) / 10,
        records: stats.records,
        uniqueStaff: stats.employees.size,
        percentage: Math.round((stats.days / totalDays) * 100),
      }))
      .sort((a, b) => b.days - a.days);
  }, [data?.events, data?.total_leave_days]);

  const handleSelectYear = (year: number | 'all') => {
    if (setFilters) {
      setFilters(prev => ({
        ...prev,
        year: year === 'all' ? undefined : year,
      }));
    }
  };

  const handleSelectMonth = (mIdx: number) => {
    if (setFilters) {
      setFilters(prev => ({
        ...prev,
        month: MONTH_SHORT[mIdx],
        date: undefined,
      }));
    }
    const prefix = `${activeYear}-${String(mIdx + 1).padStart(2, '0')}`;
    setSelectedDate(`${prefix}-16`);
  };

  const handleSelectDateInput = (dStr: string) => {
    setSelectedDate(dStr);
    if (setFilters) {
      setFilters(prev => ({
        ...prev,
        date: dStr || undefined,
      }));
    }
  };

  const handleSelectEmployeeSlicer = (empNumber: number | null) => {
    if (setFilters) {
      setFilters(prev => ({
        ...prev,
        employee_number: empNumber !== null ? empNumber : undefined,
      }));
    }
  };

  const handleSelectLeaveType = (typeKey: string) => {
    if (setFilters) {
      setFilters(prev => ({
        ...prev,
        leave_type: typeKey === 'All' || typeKey === selectedLeaveType ? undefined : typeKey,
      }));
    }
  };

  const handleResetFilters = () => {
    if (setFilters) {
      setFilters(prev => {
        const next = { ...prev };
        delete next.employee_number;
        delete next.leave_type;
        delete next.year;
        delete next.month;
        delete next.date;
        return next;
      });
    }
    setEmpSearch('');
    const defaultYr = data?.selected_year ?? data?.available_years?.[0] ?? 2023;
    setSelectedDate(`${defaultYr}-01-16`);
  };

  if (loading || !data) {
    return <DashboardSkeleton variant="calendar" title="Loading Attendance & Leave Schedules..." />;
  }

  if (data.total_leave_days === 0 && (!data.events || data.events.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[400px]">
        <EmptyState
          title="No Attendance or Leave Records Match Active Filters"
          description="None of the attendance events or leave schedules match the active filter criteria. Reset filters to restore view."
          onResetFilters={() => setFilters?.({})}
          resetLabel="Clear All Filters"
        />
      </div>
    );
  }

  const toggleMatrixSort = (field: string) => {
    if (matrixSortField === field) {
      setMatrixSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setMatrixSortField(field);
      setMatrixSortDir('asc');
    }
  };

  const MatrixSortIcon = ({ field }: { field: string }) => {
    if (matrixSortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return matrixSortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  const geoMatrix = data.geography_grade_matrix;
  const sortedLocations = (geoMatrix?.locations || [])
    .filter((loc) => !matrixSearch.trim() || loc.toLowerCase().includes(matrixSearch.toLowerCase().trim()))
    .sort((a, b) => {
      if (matrixSortField === 'location') {
        return matrixSortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }
      if (matrixSortField === 'total') {
        const aTotal = Object.values(geoMatrix?.matrix?.[a] || {}).reduce((x, y) => x + y, 0);
        const bTotal = Object.values(geoMatrix?.matrix?.[b] || {}).reduce((x, y) => x + y, 0);
        return matrixSortDir === 'asc' ? aTotal - bTotal : bTotal - aTotal;
      }
      const aVal = (geoMatrix?.matrix?.[a] || {})[matrixSortField] || 0;
      const bVal = (geoMatrix?.matrix?.[b] || {})[matrixSortField] || 0;
      return matrixSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const eventsOnSelectedDate = (data.events || []).filter((ev) => {
    const s = (ev.start || '').substring(0, 10);
    const e = (ev.end || '').substring(0, 10);
    return s <= selectedDate && e >= selectedDate;
  });

  const daysInMonthCount = new Date(activeYear, activeMonthIdx + 1, 0).getDate();
  const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
  const firstDayWeekday = (new Date(activeYear, activeMonthIdx, 1).getDay() + 6) % 7;

  const handleSelectDay = (d: number) => {
    const dateStr = `${activeYear}-${String(activeMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  const formattedProjects = (data.project_distribution || []).map((p) => ({
    ...p,
    fullName: PROJECT_NAMES[p.project] || p.project,
  }));

  const sortedLeaveBreakdown = [...(data.leave_type_breakdown || [])].sort((a, b) => b.total_days - a.total_days);
  const primaryLeaveType = sortedLeaveBreakdown[0]?.leave_type || 'Casual / Sick';
  const primaryLeaveDays = sortedLeaveBreakdown[0]?.total_days || 0;
  const primaryLeavePct = data.total_leave_days > 0 ? Math.round((primaryLeaveDays / data.total_leave_days) * 100) : 0;
  const avgDurationStr = data.unique_employees_on_leave > 0 ? (data.total_leave_days / data.unique_employees_on_leave).toFixed(1) : '0.0';
  const cohortList = data.cohort_employees || [];



  const isFiltered = Boolean(
    selectedEmpNumber || 
    selectedLeaveType !== 'All' || 
    activeYear !== (data?.selected_year ?? 2023) || 
    activeMonthIdx !== 0 || 
    filters?.date || 
    empSearch
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 select-none min-h-full">
      {/* ========================================================================= */}
      {/* Right Main Dashboard Workspace (Attendance Health, Heatmap, Roster, Matrix) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-full">
        {/* Top Executive Attendance Banner */}
        <div 
          className="rounded-xl border p-1.5 shrink-0" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(14,116,144,0.08), rgba(168,85,247,0.04), var(--panel), var(--surface))', 
            borderColor: 'var(--border)', 
            boxShadow: 'var(--shadow-soft)' 
          }}
        >
          <div className="grid grid-cols-[1.8fr_0.8fr] gap-3 items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold text-cyan-900 dark:text-cyan-300 flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-cyan-600" />
                  Attendance Health
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {selectedEmpNumber ? `Filtered: Employee #${selectedEmpNumber}` : `Year: ${activeYear} · ${MONTH_NAMES[activeMonthIdx]}`}
                </span>
                {selectedLeaveType !== 'All' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Type: {selectedLeaveType}
                  </span>
                )}
              </div>

              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <div className="p-1 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <span className="font-bold text-cyan-900 dark:text-cyan-300 block truncate text-[11px]">Monthly Leave Rate</span>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{MONTH_NAMES[activeMonthIdx]} rate: {data.leave_rate_pct}%</p>
                </div>
                <div className="p-1 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <span className="font-bold text-purple-900 dark:text-purple-300 block truncate text-[11px]">Volume Concentration</span>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{primaryLeaveType} ({primaryLeavePct}%)</p>
                </div>
                <div className="p-1 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <span className="font-bold text-rose-900 dark:text-rose-300 block truncate text-[11px]">Workforce Impact</span>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{data.unique_employees_on_leave} staff · {data.total_leave_days}d total</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Leave Metric Ratio</span>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">Leave Rate</span>
                  <span className="text-sm font-black text-cyan-800 dark:text-cyan-300 font-mono">{data.leave_rate_pct}%</span>
                </div>
                <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">Total Days</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{data.total_leave_days}d</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards (Compact Height to Maximize Heatmap Space) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
          <div className="p-1.5 rounded-xl glass-panel border border-cyan-300 dark:border-cyan-800/80 bg-gradient-to-br from-cyan-50/50 dark:from-cyan-950/20 to-transparent flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Employees On Leave</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{data.unique_employees_on_leave}</span>
                <span className="text-[9px] text-slate-400 font-mono">({data.leave_rate_pct}%)</span>
              </div>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-mono">
              Active
            </span>
          </div>

          <div className="p-1.5 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Total Leave Days</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{data.total_leave_days}d</span>
                <span className="text-[9px] text-slate-400 font-mono">Logged</span>
              </div>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
              Utilization
            </span>
          </div>

          <div className="p-1.5 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Primary Leave Type</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 truncate max-w-[130px]">{primaryLeaveType}</span>
                <span className="text-[9px] text-slate-400 font-mono">({primaryLeavePct}%)</span>
              </div>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
              Main
            </span>
          </div>

          <div className="p-1.5 rounded-xl glass-panel border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Average Duration</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{avgDurationStr} Days</span>
                <span className="text-[9px] text-slate-400 font-mono">/ employee</span>
              </div>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
              Avg
            </span>
          </div>
        </div>

        {/* Middle Grid: Heatmap Calendar + Daily Roster + Leave Category Share (Balanced 4:4:4) */}
        <div className="grid grid-cols-12 gap-1.5 flex-[1.15] min-h-0">
          {/* Heatmap Calendar (4 cols) */}
          <div className="col-span-12 xl:col-span-4 glass-panel rounded-xl px-2.5 py-2 flex flex-col justify-between overflow-hidden shadow-2xs min-h-0">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  Leave Heatmap ({MONTH_SHORT[activeMonthIdx]} {activeYear})
                </span>
              </div>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Intensity: Heat Colored</span>
            </div>

            <div className="flex-1 flex flex-col justify-center min-h-0 py-0.5">
              <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-0.5 shrink-0">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span className="text-slate-400 dark:text-slate-500">Sat</span>
                <span className="text-slate-400 dark:text-slate-500">Sun</span>
              </div>

              <div className="grid grid-cols-7 gap-0.5 flex-1 py-0.5 items-center">
                {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="h-[21px] sm:h-[22px] rounded opacity-0 pointer-events-none" />
                ))}
                {daysInMonth.map((d) => {
                  const dateStr = `${activeYear}-${String(activeMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const count = data.daily_leave_counts?.[dateStr] || 0;
                  const isSelected = selectedDate === dateStr;

                  let heatStyle = 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700';
                  if (count >= 10) {
                    heatStyle = 'bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-bold hover:bg-rose-200 dark:hover:bg-rose-900';
                  } else if (count >= 5) {
                    heatStyle = 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-200 dark:hover:bg-amber-900';
                  } else if (count > 0) {
                    heatStyle = 'bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 font-semibold hover:bg-cyan-100 dark:hover:bg-cyan-900';
                  }

                  if (isSelected) {
                    heatStyle = 'bg-cyan-600 text-white font-bold ring-2 ring-cyan-500 shadow-xs';
                  }

                  return (
                    <button
                      key={d}
                      onClick={() => handleSelectDay(d)}
                      className={`h-[21px] sm:h-[22px] rounded flex flex-col items-center justify-center relative text-[9.5px] font-mono transition-all ${heatStyle}`}
                      title={`${dateStr}: ${count} on leave`}
                    >
                      <span>{d}</span>
                      {count > 0 && !isSelected && (
                        <span className={`w-1 h-1 rounded-full absolute bottom-0.5 ${count >= 5 ? 'bg-rose-600' : 'bg-cyan-600'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0 font-medium">
              <span>Selected: <strong className="text-slate-900 dark:text-slate-100 font-mono">{selectedDate}</strong></span>
              <span><b>{eventsOnSelectedDate.length}</b> staff on leave</span>
            </div>
          </div>

          {/* Center 4 cols: Daily Roster / Filtered Leave Cohort */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-0">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRosterViewMode('date')}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    rosterViewMode === 'date'
                      ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="View leaves active on selected date"
                >
                  On Date ({eventsOnSelectedDate.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterViewMode('cohort')}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    rosterViewMode === 'cohort'
                      ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="View all employees in filtered leave scope"
                >
                  All Staff ({cohortList.length})
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {(rosterViewMode === 'date' ? eventsOnSelectedDate.length : cohortList.length) > 0 && (
                  <ExportButton
                    data={rosterViewMode === 'date' ? eventsOnSelectedDate : cohortList}
                    filename={`leave_${rosterViewMode}_${selectedDate}.csv`}
                    label="CSV"
                  />
                )}
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 font-mono font-semibold">
                  {rosterViewMode === 'date' ? `${eventsOnSelectedDate.length} Active` : `${cohortList.length} Total`}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar my-1 flex flex-col gap-1.5">
              {rosterViewMode === 'date' ? (
                eventsOnSelectedDate.length > 0 ? (
                  eventsOnSelectedDate.map((ev) => (
                    <div
                      key={ev.id}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onOpenEmployeeProfile) {
                            onOpenEmployeeProfile(ev.employee_number);
                          } else {
                            onSelectEmployee(ev.employee_number);
                          }
                        }
                      }}
                      onClick={() => {
                        if (onOpenEmployeeProfile) {
                          onOpenEmployeeProfile(ev.employee_number);
                        } else {
                          onSelectEmployee(ev.employee_number);
                        }
                      }}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs group focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-cyan-700 dark:group-hover:text-cyan-400">{ev.employee_name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">#{ev.employee_number} · {ev.department} · {ev.location}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span 
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                          style={{ 
                            color: LEAVE_COLORS[ev.leave_type] || '#0284c7',
                            borderColor: `${LEAVE_COLORS[ev.leave_type] || '#0284c7'}50`,
                            backgroundColor: `${LEAVE_COLORS[ev.leave_type] || '#0284c7'}15`
                          }}
                        >
                          {ev.leave_type}
                        </span>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{ev.days} Day(s)</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                    <EmptyState
                      compact
                      title="No leaves on this specific date"
                      description={`Full workforce active on ${selectedDate}.`}
                    />
                    {cohortList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRosterViewMode('cohort')}
                        className="mt-2 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-2 py-1 rounded border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900 transition-colors cursor-pointer"
                      >
                        View all {cohortList.length} staff on {selectedLeaveType !== 'All' ? selectedLeaveType : 'leave'} ({data.total_leave_days}d total)
                      </button>
                    )}
                  </div>
                )
              ) : (
                cohortList.length > 0 ? (
                  cohortList.map((emp) => (
                    <div
                      key={`cohort-${emp.employee_number}`}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onOpenEmployeeProfile) {
                            onOpenEmployeeProfile(emp.employee_number);
                          } else {
                            onSelectEmployee(emp.employee_number);
                          }
                        }
                      }}
                      onClick={() => {
                        if (onOpenEmployeeProfile) {
                          onOpenEmployeeProfile(emp.employee_number);
                        } else {
                          onSelectEmployee(emp.employee_number);
                        }
                      }}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs group focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-cyan-700 dark:group-hover:text-cyan-400">{emp.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">#{emp.employee_number} · {emp.department} · {emp.location}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{emp.start} → {emp.end}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span 
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                          style={{ 
                            color: LEAVE_COLORS[emp.leave_type] || '#0284c7',
                            borderColor: `${LEAVE_COLORS[emp.leave_type] || '#0284c7'}50`,
                            backgroundColor: `${LEAVE_COLORS[emp.leave_type] || '#0284c7'}15`
                          }}
                        >
                          {emp.leave_type}
                        </span>
                        <p className="text-[10px] text-slate-700 dark:text-slate-300 font-mono font-bold mt-0.5">{emp.days} Day(s)</p>
                        <p className="text-[8.5px] text-slate-400 font-mono">{emp.records_count} record(s)</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    compact
                    title="No employees found"
                    description="No employees match the active filter criteria."
                  />
                )
              )}
            </div>
          </div>

          {/* Right 4 cols: Leave Category Share (Rebalanced 4:4:4 Grid with Side-by-Side Donut & Ranked Legend) */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-2xs min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  Leave Category Share
                </span>
              </div>
              <div className="flex items-center gap-1">
                {selectedLeaveType !== 'All' ? (
                  <button
                    onClick={() => handleSelectLeaveType('All')}
                    className="text-[9.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-1 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors cursor-pointer"
                    title="Clear leave category filter"
                  >
                    <span>Clear Filter</span>
                    <X className="w-2.5 h-2.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-200 dark:border-cyan-800 font-semibold font-mono">
                    Absence Mix
                  </span>
                )}
              </div>
            </div>

            {/* Side-by-Side: Donut on Left (40%), Interactive Ranked Legend on Right (60%) */}
            <div className="flex-1 min-h-0 flex items-center gap-2 py-0.5">
              {/* Left: Donut Chart with Center Metric */}
              <div className="w-[40%] h-full relative flex items-center justify-center shrink-0 min-h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formattedLeaveCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="80%"
                      paddingAngle={3}
                      dataKey="days"
                      nameKey="name"
                      isAnimationActive={false}
                      onClick={(entry: any) => {
                        if (entry && entry.name) {
                          handleSelectLeaveType(entry.name);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {formattedLeaveCategories.map((entry) => {
                        const isSelected = selectedLeaveType === entry.name;
                        const isAnySelected = selectedLeaveType !== 'All';
                        return (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={entry.color}
                            fillOpacity={isAnySelected && !isSelected ? 0.35 : 1}
                            stroke={isSelected ? '#06b6d4' : 'transparent'}
                            strokeWidth={isSelected ? 2.5 : 1}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const item = payload[0].payload;
                        return (
                          <div className="p-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-md text-[11px] min-w-[130px] z-50">
                            <p className="font-bold flex items-center gap-1.5" style={{ color: item.color }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              {item.name}
                            </p>
                            <div className="text-slate-600 dark:text-slate-300 space-y-0.5 mt-1 font-mono text-[10px]">
                              <div className="flex justify-between">
                                <span>Volume:</span>
                                <span className="font-bold">{item.days}d</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Share:</span>
                                <span className="font-bold">{item.percentage}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Incidents:</span>
                                <span className="font-bold">{item.records}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Callout Metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 font-mono leading-none">
                    {data.total_leave_days}d
                  </span>
                  <span className="text-[7.5px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5 leading-none">
                    Total
                  </span>
                </div>
              </div>

              {/* Right: Interactive Ranked Category Legend (All 6 categories fit cleanly) */}
              <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar flex flex-col justify-start gap-1 py-0.5 pr-0.5">
                {formattedLeaveCategories.map((cat) => {
                  const isSelected = selectedLeaveType === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => handleSelectLeaveType(cat.name)}
                      className={`w-full text-left px-2 py-0.5 rounded-md border transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-cyan-50/90 dark:bg-cyan-950/70 border-cyan-500 ring-1 ring-cyan-500 shadow-2xs font-bold'
                          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      title={`Click to filter by ${cat.name}`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className={`truncate text-[10px] ${
                            isSelected ? 'text-cyan-900 dark:text-cyan-200 font-bold' : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[9.5px]">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {cat.days}d
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            ({cat.percentage}%)
                          </span>
                        </div>
                      </div>

                      {/* Mini Bar Underneath */}
                      <div className="w-full bg-slate-200/60 dark:bg-slate-700/60 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(cat.percentage, 1))}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Summary */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              <span>Categories: <b className="text-slate-800 dark:text-slate-200">{formattedLeaveCategories.length}</b></span>
              <span>Total Volume: <b className="text-cyan-600 dark:text-cyan-400 font-bold">{data.total_leave_days}d</b></span>
            </div>
          </div>
        </div>

        {/* Bottom Section: Executive Attendance Intelligence with Master/Details Toggle */}
        <div className="glass-panel rounded-xl p-2 shrink-0 min-h-[170px] h-auto flex-1 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setBottomTab('seasonality')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    bottomTab === 'seasonality'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  <span>Leave Analytics & Seasonality</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab('geography')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    bottomTab === 'geography'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>Workforce Geography & Projects</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden md:inline">
                {bottomTab === 'seasonality' ? '12-Month Burn Rate & Department Telemetry' : 'Location vs Job Level Matrix'}
              </span>
            </div>

            {bottomTab === 'geography' && (
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search location..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-40 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
                />
                {matrixSearch && (
                  <button
                    onClick={() => setMatrixSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                )}
              </div>
            )}
          </div>

          {bottomTab === 'seasonality' ? (
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 pt-1 items-center">
              {/* Left 7 cols: 12-Month Leave Seasonality Bar Chart */}
              <div className="col-span-7 flex flex-col h-full justify-between overflow-hidden">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 shrink-0">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-cyan-600" />
                    Annual Leave Seasonality (Days Consumed by Start Date)
                  </span>
                  <span className="font-mono text-[9px] text-cyan-700 dark:text-cyan-400">
                    Click bar to switch month
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySeasonality} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" vertical={false} opacity={0.5} />
                      <XAxis dataKey="month" stroke="var(--muted)" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                      <YAxis stroke="var(--muted)" tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const item = payload[0].payload;
                          return (
                            <div className="p-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-md text-[10px]">
                              <p className="font-bold text-cyan-600">{item.month} {activeYear}</p>
                              <p className="font-mono text-slate-700 dark:text-slate-200">Leave Days: <b>{item.days}d</b></p>
                              <p className="font-mono text-slate-500">Leave Events: <b>{item.records}</b></p>
                            </div>
                          );
                        }}
                      />
                      <Bar 
                        dataKey="days" 
                        radius={[3, 3, 0, 0]}
                        onClick={(entry: any) => {
                          if (entry && entry.monthIdx !== undefined) {
                            handleSelectMonth(entry.monthIdx);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {monthlySeasonality.map((entry) => (
                          <Cell 
                            key={`month-${entry.month}`} 
                            fill={entry.monthIdx === activeMonthIdx ? '#4f46e5' : '#0891b2'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right 5 cols: Departmental Absenteeism & Coverage Health */}
              <div className="col-span-5 flex flex-col h-full justify-between border-l border-slate-100 dark:border-slate-800 pl-3 overflow-hidden">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1 shrink-0">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    Department Absence Volume
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">Total Days · % Share</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                  {departmentLeaveStats.map((dept) => (
                    <div key={dept.department} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{dept.department}</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{dept.days}d</span>
                          <span className="text-[9px] text-slate-500">({dept.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" 
                          style={{ width: `${Math.min(dept.percentage, 100)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar my-0.5">
              <table className="w-full text-left text-[11px] text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#162a45] text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-[#223755] sticky top-0 z-10">
                  <tr>
                    <th 
                      className="py-1 px-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => toggleMatrixSort('location')}
                    >
                      Location <MatrixSortIcon field="location" />
                    </th>
                    {(data.geography_grade_matrix?.grades || []).map((grade) => (
                      <th 
                        key={grade} 
                        className="py-1 px-2 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => toggleMatrixSort(grade)}
                      >
                        {grade} <MatrixSortIcon field={grade} />
                      </th>
                    ))}
                    <th 
                      className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => toggleMatrixSort('total')}
                    >
                      Total <MatrixSortIcon field="total" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {sortedLocations.map((loc) => {
                    const locRow = data.geography_grade_matrix.matrix[loc] || {};
                    const locTotal = Object.values(locRow).reduce((acc, count) => acc + count, 0);

                    return (
                      <tr key={loc} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                        <td className="py-1 px-2 font-sans font-medium text-slate-800 dark:text-slate-200">{loc}</td>
                        {(data.geography_grade_matrix.grades || []).map((grade) => {
                          const count = locRow[grade] || 0;
                          return (
                            <td 
                              key={grade} 
                              className={`py-1 px-2 text-right ${count > 0 ? 'text-cyan-700 dark:text-cyan-300 font-semibold' : 'text-slate-400 dark:text-slate-600'}`}
                            >
                              {count}
                            </td>
                          );
                        })}
                        <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{locTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Dedicated Right Slicer Sidebar (Power BI Style Docked Filter Pane) */}
      {/* ========================================================================= */}
      {slicersExpanded ? (
        <div className="w-64 xl:w-72 shrink-0 flex flex-col glass-panel rounded-xl p-2.5 gap-1.5 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Slicer Title & Always Accessible Reset Option */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Filters & Slicers
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleResetFilters}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                isFiltered
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-900/60 shadow-2xs'
                  : 'text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Reset all slicers and filters to default view"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => setSlicersExpanded(false)}
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-0.5"
              title="Collapse filters & slicers"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 1. POWER BI STYLE DATE SLICER: YEAR + MONTH + DAY */}
        <div className="shrink-0 flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
          {/* Year Selector */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Year
              </span>
              <span className="text-[9px] font-bold font-mono text-cyan-700 dark:text-cyan-300">
                {activeYear}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {yearOptions.map((yr) => {
                const isActive = activeYear === yr;
                return (
                  <button
                    key={yr}
                    onClick={() => handleSelectYear(yr)}
                    className={`py-0.5 rounded text-center text-[10px] font-bold font-mono transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs ring-1 ring-cyan-400'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-400 dark:hover:border-cyan-600'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month Slicer (Power BI 6x2 grid) */}
          <div className="flex flex-col gap-0.5 mt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Month
              </span>
              <span className="text-[9px] font-bold font-mono text-cyan-700 dark:text-cyan-300">
                {MONTH_NAMES[activeMonthIdx]}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-0.5">
              {MONTH_SHORT.map((m, idx) => {
                const isActive = activeMonthIdx === idx;
                return (
                  <button
                    key={m}
                    onClick={() => handleSelectMonth(idx)}
                    className={`py-0.5 rounded text-center text-[9px] font-mono transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-400 font-bold'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific Date Quick Selector */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Specific Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleSelectDateInput(e.target.value)}
              className="h-5 bg-white dark:bg-[#12223a] border border-slate-200 dark:border-[#223755] text-slate-800 dark:text-slate-100 text-[10px] px-1 rounded focus:outline-none focus:border-cyan-500 font-mono transition-colors cursor-pointer"
              title="Select specific date to inspect employee attendance roster"
            />
          </div>
        </div>

        {/* 2. EMPLOYEE Slicer with Radio List (Matching User Image) */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Employee Filter
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
              {filteredEmployees.length} Found
            </span>
          </div>

          {/* Employee Search Input */}
          <div className="relative shrink-0">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search employee or ID..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-1 rounded-lg focus:outline-none focus:border-cyan-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
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

          {/* Scrollable Radio List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5 border border-slate-100 dark:border-slate-800/80 rounded-lg p-1 bg-slate-50/50 dark:bg-slate-900/30">
            {/* All Employees Radio */}
            <div
              onClick={() => handleSelectEmployeeSlicer(null)}
              className={`px-2 py-1.5 rounded-md cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors ${
                selectedEmpNumber === null
                  ? 'bg-cyan-100/90 dark:bg-cyan-950/80 text-cyan-950 dark:text-cyan-200 font-bold border border-cyan-300 dark:border-cyan-800'
                  : 'hover:bg-white dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedEmpNumber === null ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
                <span className="truncate text-[11px]">All Employees</span>
              </div>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                Cohort
              </span>
            </div>

            {/* Individual Employees */}
            {filteredEmployees.map((emp) => {
              const isSelected = selectedEmpNumber === emp.employee_number;
              return (
                <div
                  key={emp.employee_number}
                  onClick={() => handleSelectEmployeeSlicer(emp.employee_number)}
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
                      <p className="truncate text-[11px] leading-tight">{emp.name}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">#{emp.employee_number}</p>
                    </div>
                  </div>
                  {emp.leave_count > 0 && (
                    <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded shrink-0 ${
                      isSelected
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {emp.leave_count}d
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. LEAVE TYPE Slicer (Compact 2-Column Application-Aligned Grid) */}
        <div className="shrink-0 flex flex-col gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Leave Type
            </span>
            {selectedLeaveType !== 'All' && (
              <button
                onClick={() => handleSelectLeaveType('All')}
                className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1">
            {dynamicLeaveButtons.map((btn) => {
              const isSelected = selectedLeaveType === btn.key;
              return (
                <button
                  key={btn.key}
                  onClick={() => handleSelectLeaveType(btn.key)}
                  className={`py-1 px-1.5 rounded-md text-left text-[10px] font-bold transition-all flex items-center justify-between border shadow-2xs ${
                    isSelected ? btn.activeBg : `${btn.bg} opacity-95 hover:opacity-100`
                  }`}
                  title={`${btn.label}: ${btn.count} records (${btn.days}d)`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : btn.dot} shrink-0`} />
                    <span className="truncate font-sans">{btn.label}</span>
                  </div>
                  <span className={`text-[9px] font-mono font-black ml-1 px-1 py-0.2 rounded shrink-0 ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      ) : (
        <div
          onClick={() => setSlicersExpanded(true)}
          className="w-8 shrink-0 flex flex-col items-center py-3 glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm gap-3 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all cursor-pointer group bg-slate-50/50 dark:bg-slate-900/40"
          title="Expand filters & slicers (Power BI panel)"
        >
          <ChevronLeft className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:scale-125 transition-transform" />
          <Filter className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 [writing-mode:vertical-lr] group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors select-none">
            Filters & Slicers
          </span>
          {isFiltered && (
            <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-400/40 animate-pulse mt-auto mb-1" title="Filters active" />
          )}
        </div>
      )}
    </div>
  );
};
