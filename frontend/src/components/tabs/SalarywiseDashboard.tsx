import React, { useState, useMemo, useEffect } from 'react';
import type { SalarywiseKPIs, Salarywise2KPIs, FilterParams } from '../../types/dashboard';
import { KPICard } from '../common/KPICard';
import { ExportButton } from '../common/ExportButton';
import { DashboardSkeleton } from '../common/DashboardSkeleton';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { Salarywise2Dashboard } from './Salarywise2Dashboard';
import { 
  BadgeIndianRupee, 
  TrendingUp, 
  Award, 
  ArrowUpRight, 
  Grid, 
  Search, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight,
  Check,
  Filter,
  Shield
} from 'lucide-react';

interface SalarywiseDashboardProps {
  data: SalarywiseKPIs | null;
  trendsData?: Salarywise2KPIs | null;
  loading: boolean;
  subTab?: 'overview' | 'trends';
  onSubTabChange?: (mode: 'overview' | 'trends') => void;
  onSelectEmployee: (empNumber: number) => void;
  onOpenEmployeeProfile?: (empNumber: number) => void;
  filters?: FilterParams;
  setFilters?: React.Dispatch<React.SetStateAction<FilterParams>>;
}

export const SalarywiseDashboard: React.FC<SalarywiseDashboardProps> = ({ 
  data, 
  trendsData, 
  loading, 
  subTab, 
  onSubTabChange, 
  onSelectEmployee, 
  onOpenEmployeeProfile,
  filters,
  setFilters,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'overview' | 'trends'>('overview');
  const currentSubTab = subTab !== undefined ? subTab : internalSubTab;

  const [topLimit, setTopLimit] = useState<number | 'all'>(20);
  const [earnerPage, setEarnerPage] = useState(1);
  const [earnerSearch, setEarnerSearch] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [managerSortField, setManagerSortField] = useState<string>('total');
  const [managerSortDir, setManagerSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<string | null>(null);
  const [selectedBandFilter, setSelectedBandFilter] = useState<string | null>(null);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);
  const [managerPage, setManagerPage] = useState(1);
  const [managersPerPage, setManagersPerPage] = useState<number | 'all'>('all');

  // Synchronize with global FilterBar reset
  useEffect(() => {
    if (!filters || Object.keys(filters).length === 0) {
      setSelectedBandFilter(null);
      setSelectedManagerFilter(null);
      setSelectedGradeFilter(null);
      setEarnerSearch('');
      setManagerSearch('');
      setEarnerPage(1);
      setManagerPage(1);
    }
  }, [filters]);

  const toggleManagerSort = (field: string) => {
    if (managerSortField === field) {
      setManagerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setManagerSortField(field);
      setManagerSortDir('desc');
    }
    setManagerPage(1);
  };

  const ManagerSortIcon = ({ field }: { field: string }) => {
    if (managerSortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 inline ml-1 opacity-70" />;
    return managerSortDir === 'asc' ? (
      <ArrowUp className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-cyan-600 inline ml-1" />
    );
  };

  // Dynamic manager x grade matrix reacting to active salary band filter
  const activeMatrix = useMemo(() => {
    if (!data) return { managers: [], manager_totals: {}, grades: [], matrix: {} };

    // When a salary band is active, reconstruct manager matrix specifically for that band
    if (selectedBandFilter) {
      const bandEarners = (data.top_n_earners || []).filter(
        (e) => (e.salary_bin || '') === selectedBandFilter
      );
      const matrix: Record<string, Record<string, number>> = {};
      const mgrTotals: Record<string, number> = {};
      const activeGrades = new Set<string>();

      bandEarners.forEach((e) => {
        const mgr = e.manager || 'Unassigned';
        const grade = e.job_level || 'Unknown';
        activeGrades.add(grade);
        if (!matrix[mgr]) matrix[mgr] = {};
        matrix[mgr][grade] = (matrix[mgr][grade] || 0) + (e.total_ctc || 0);
        mgrTotals[mgr] = (mgrTotals[mgr] || 0) + (e.total_ctc || 0);
      });

      const managers = Object.keys(matrix).sort((a, b) => (mgrTotals[b] || 0) - (mgrTotals[a] || 0));
      const baseGrades = data.manager_grade_ctc_matrix?.grades || [];
      const grades = baseGrades.filter((g) => activeGrades.has(g));

      return {
        managers,
        manager_totals: mgrTotals,
        grades: grades.length > 0 ? grades : baseGrades,
        matrix,
      };
    }

    return data.manager_grade_ctc_matrix || { managers: [], manager_totals: {}, grades: [], matrix: {} };
  }, [data, selectedBandFilter]);

  const { user } = useAuth();
  const isManagerRole = user?.role === 'MANAGER';

  // Automatically lock manager view if logged in as a MANAGER
  const lockedManagerName = useMemo(() => {
    if (!isManagerRole || !user || !activeMatrix.managers?.length) return null;
    const managersList = activeMatrix.managers;
    const uName = (user.username || '').toLowerCase().trim();
    let matched = managersList.find((m) => m.toLowerCase().trim() === uName);
    if (!matched) {
      const cleanUName = uName.replace(/[._-]/g, ' ');
      matched = managersList.find((m) => {
        const cleanM = m.toLowerCase();
        return cleanM.includes(cleanUName) || cleanUName.includes(cleanM);
      });
    }
    return matched || managersList[0] || null;
  }, [isManagerRole, user, activeMatrix.managers]);

  const allFilteredManagers = useMemo(() => {
    let list = activeMatrix.managers || [];
    if (isManagerRole && lockedManagerName) {
      list = list.filter((mgr) => mgr === lockedManagerName);
    } else if (managerSearch.trim()) {
      list = list.filter((mgr) => mgr.toLowerCase().includes(managerSearch.toLowerCase().trim()));
    }
    return list.sort((a, b) => {
      if (managerSortField === 'manager') {
        return managerSortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }
      if (managerSortField === 'total') {
        const aTotal = Object.values(activeMatrix.matrix?.[a] || {}).reduce((x, y) => x + y, 0);
        const bTotal = Object.values(activeMatrix.matrix?.[b] || {}).reduce((x, y) => x + y, 0);
        return managerSortDir === 'asc' ? aTotal - bTotal : bTotal - aTotal;
      }
      const aVal = (activeMatrix.matrix?.[a] || {})[managerSortField] || 0;
      const bVal = (activeMatrix.matrix?.[b] || {})[managerSortField] || 0;
      return managerSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [activeMatrix, isManagerRole, lockedManagerName, managerSearch, managerSortField, managerSortDir]);

  const managerExportData = useMemo(() => {
    return allFilteredManagers.map((mgr) => {
      const row: Record<string, any> = { Manager: mgr };
      let total = 0;
      activeMatrix.grades.forEach((g) => {
        const val = (activeMatrix.matrix?.[mgr] || {})[g] || 0;
        row[g] = val;
        total += val;
      });
      row['Total CTC'] = total;
      return row;
    });
  }, [allFilteredManagers, activeMatrix]);

  const totalManagerPages = managersPerPage === 'all' ? 1 : Math.ceil(allFilteredManagers.length / managersPerPage) || 1;
  const paginatedManagers = managersPerPage === 'all'
    ? allFilteredManagers
    : allFilteredManagers.slice(
        (managerPage - 1) * managersPerPage,
        managerPage * managersPerPage
      );

  // Effective manager filter: either explicitly clicked, locked by RBAC, or automatically matched when manager search has 1 match
  const effectiveManagerFilter = useMemo(() => {
    if (isManagerRole && lockedManagerName) return lockedManagerName;
    if (selectedManagerFilter) return selectedManagerFilter;
    if (managerSearch.trim() && allFilteredManagers.length === 1) {
      return allFilteredManagers[0];
    }
    return null;
  }, [isManagerRole, lockedManagerName, selectedManagerFilter, managerSearch, allFilteredManagers]);

  // All matching earners matching cross-filters (before pagination)
  const allMatchingEarners = useMemo(() => {
    let list = data?.top_n_earners || [];
    if (effectiveManagerFilter) {
      list = list.filter((e) => e.manager === effectiveManagerFilter);
    }
    if (selectedBandFilter) {
      list = list.filter((e) => (e.salary_bin || '') === selectedBandFilter);
    }
    if (selectedGradeFilter) {
      list = list.filter((e) => e.job_level === selectedGradeFilter);
    }
    if (earnerSearch.trim()) {
      const q = earnerSearch.toLowerCase().trim();
      list = list.filter((e) => 
        e.name.toLowerCase().includes(q) || 
        String(e.employee_number).includes(q) ||
        (e.job_title && e.job_title.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data?.top_n_earners, effectiveManagerFilter, selectedBandFilter, selectedGradeFilter, earnerSearch]);

  const totalMatchingEarners = allMatchingEarners.length;
  const totalEarnerPages = topLimit === 'all' ? 1 : Math.ceil(totalMatchingEarners / Number(topLimit)) || 1;

  // Paginated displayed earners
  const displayedTopEarners = useMemo(() => {
    if (topLimit === 'all') {
      return allMatchingEarners;
    }
    const lim = Number(topLimit);
    const start = (earnerPage - 1) * lim;
    return allMatchingEarners.slice(start, start + lim);
  }, [allMatchingEarners, topLimit, earnerPage]);

  const hasAnyFilter = Boolean(effectiveManagerFilter || selectedBandFilter || selectedGradeFilter || earnerSearch.trim());

  const clearAllFilters = () => {
    setSelectedManagerFilter(null);
    setManagerSearch('');
    setSelectedBandFilter(null);
    setSelectedGradeFilter(null);
    setEarnerSearch('');
    setEarnerPage(1);
    setManagerPage(1);
  };

  // Cell click handler for 2-dimensional manager x grade drilldown
  const handleCellClick = (mgr: string, grade?: string) => {
    if (grade) {
      if (selectedManagerFilter === mgr && selectedGradeFilter === grade) {
        setSelectedGradeFilter(null);
      } else {
        setSelectedManagerFilter(mgr);
        setSelectedGradeFilter(grade);
      }
    } else {
      setSelectedManagerFilter(selectedManagerFilter === mgr ? null : mgr);
    }
    setEarnerPage(1);
  };

  // Dynamic in-scope KPIs reflecting active cohort selections
  const activeKpis = useMemo(() => {
    if (!data) return null;
    if (hasAnyFilter) {
      const count = allMatchingEarners.length;
      const totalCtc = allMatchingEarners.reduce((s, e) => s + (e.total_ctc || 0), 0);
      const avgCtc = count > 0 ? totalCtc / count : 0;
      const monthlyPayroll = allMatchingEarners.reduce((s, e) => s + (e.m_salary || (e.total_ctc / 12)), 0);
      const maxCtc = count > 0 ? Math.max(...allMatchingEarners.map((e) => e.total_ctc || 0)) : 0;
      const minCtc = count > 0 ? Math.min(...allMatchingEarners.map((e) => e.total_ctc || 0)) : 0;
      const pctOfTotal = data.total_ctc > 0 ? ((totalCtc / data.total_ctc) * 100).toFixed(1) : '100';

      return {
        totalCtc,
        avgCtc,
        monthlyPayroll,
        maxCtc,
        minCtc,
        count,
        pctOfTotal,
        isFiltered: true,
      };
    }

    return {
      totalCtc: data.total_ctc,
      avgCtc: data.avg_ctc,
      monthlyPayroll: data.monthly_payroll ?? (data.total_salary / 12),
      maxCtc: data.max_ctc,
      minCtc: data.min_ctc,
      count: data.matched_records || 590,
      pctOfTotal: '100',
      isFiltered: false,
    };
  }, [data, hasAnyFilter, allMatchingEarners]);

  // Dynamic salary band histogram reflecting active manager or cross-filters
  const histogram = useMemo(() => {
    if (effectiveManagerFilter || selectedGradeFilter || earnerSearch.trim()) {
      let pool = data?.top_n_earners || [];
      if (effectiveManagerFilter) {
        pool = pool.filter((e) => e.manager === effectiveManagerFilter);
      }
      if (selectedGradeFilter) {
        pool = pool.filter((e) => e.job_level === selectedGradeFilter);
      }
      if (earnerSearch.trim()) {
        const q = earnerSearch.toLowerCase().trim();
        pool = pool.filter((e) => 
          e.name.toLowerCase().includes(q) || 
          String(e.employee_number).includes(q) ||
          (e.job_title && e.job_title.toLowerCase().includes(q)) ||
          (e.department && e.department.toLowerCase().includes(q))
        );
      }
      const totalCount = pool.length || 1;
      const bins = [
        { band: '< 5L', color: '#0284c7' },
        { band: '5-10L', color: '#10b981' },
        { band: '10-15L', color: '#d97706' },
        { band: '15-20L', color: '#8b5cf6' },
        { band: '20L+', color: '#ec4899' },
      ];
      return bins.map((b) => {
        const matching = pool.filter((e) => (e.salary_bin || '') === b.band);
        const count = matching.length;
        const totalOutlay = matching.reduce((sum, e) => sum + (e.total_ctc || 0), 0);
        const avgCtc = count > 0 ? totalOutlay / count : 0;
        return {
          band: b.band,
          bin: b.band,
          count,
          percentage: (count / totalCount) * 100,
          color: b.color,
          total_outlay: totalOutlay,
          avg_ctc: avgCtc,
        };
      });
    }
    return data?.salary_histogram || [
      { band: '< 5L', count: 165, percentage: 28.0, color: '#0284c7' },
      { band: '5-10L', count: 250, percentage: 42.4, color: '#10b981' },
      { band: '10-15L', count: 115, percentage: 19.5, color: '#d97706' },
      { band: '15-20L', count: 42, percentage: 7.1, color: '#8b5cf6' },
      { band: '20L+', count: 18, percentage: 3.0, color: '#ec4899' },
    ];
  }, [data?.salary_histogram, data?.top_n_earners, effectiveManagerFilter, selectedGradeFilter, earnerSearch]);

  if (currentSubTab === 'trends') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar">
        <Salarywise2Dashboard
          data={trendsData ?? null}
          loading={loading && !trendsData}
          onSelectEmployee={onSelectEmployee}
          onOpenEmployeeProfile={onOpenEmployeeProfile}
        />
      </div>
    );
  }

  if (!data || loading) {
    return <DashboardSkeleton variant="compensation" title="Loading Compensation Overview..." />;
  }

  if (data.total_salary === 0 && (!data.top_n_earners || data.top_n_earners.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[400px]">
        <EmptyState
          title="No Compensation Records Match Active Filters"
          description="None of the salary records or payroll lines match the active filter criteria. Reset filters to restore view."
          onResetFilters={() => setFilters?.({})}
          resetLabel="Clear All Filters"
        />
      </div>
    );
  }

  const monthlyPayroll = data.monthly_payroll ?? (data.total_salary / 12);
  const avgMonthlySalary = data.avg_monthly_salary ?? (data.avg_salary / 12);
  const managerCount = data.manager_grade_ctc_matrix?.managers?.length || 54;

  return (
    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden select-none min-h-0">
      {/* Top 4 Compact KPI Cards (Dynamically reacting to in-scope cohort) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
        <KPICard
          compact={true}
          dominant={true}
          title={activeKpis?.isFiltered ? 'In-Scope Workforce CTC' : 'Total Workforce CTC'}
          value={`₹${((activeKpis?.totalCtc ?? data.total_ctc) / 10000000).toFixed(2)} Cr`}
          subtitle={
            activeKpis?.isFiltered
              ? `${activeKpis.count} Staff · ${activeKpis.pctOfTotal}% of Total Outlay`
              : `Annualized Outlay · ${managerCount} Delivery Managers`
          }
          icon={TrendingUp}
          badge={activeKpis?.isFiltered ? `${activeKpis.count} Staff` : '100% Roster'}
          badgeColor="emerald"
        />
        <KPICard
          compact={true}
          title={activeKpis?.isFiltered ? 'In-Scope Avg CTC' : 'Average Employee CTC'}
          value={`₹${((activeKpis?.avgCtc ?? data.avg_ctc) / 100000).toFixed(2)} L`}
          subtitle={
            activeKpis?.isFiltered
              ? `Filtered Mean · ${selectedBandFilter ? `Band: ${selectedBandFilter}` : selectedGradeFilter ? `Grade: ${selectedGradeFilter}` : effectiveManagerFilter ? `Team: ${effectiveManagerFilter}` : 'Active Cohort'}`
              : 'Cohort Mean · Median band concentration'
          }
          icon={BadgeIndianRupee}
          badge={activeKpis?.isFiltered ? 'In-Scope' : 'Cohort Mean'}
          badgeColor="cyan"
        />
        <KPICard
          compact={true}
          title={activeKpis?.isFiltered ? 'In-Scope Monthly Payroll' : 'Monthly Payroll Outlay'}
          value={
            (activeKpis?.monthlyPayroll ?? monthlyPayroll) >= 10000000
              ? `₹${((activeKpis?.monthlyPayroll ?? monthlyPayroll) / 10000000).toFixed(2)} Cr`
              : `₹${((activeKpis?.monthlyPayroll ?? monthlyPayroll) / 100000).toFixed(2)} L`
          }
          subtitle={
            activeKpis?.isFiltered
              ? `₹${(((activeKpis.monthlyPayroll) / (activeKpis.count || 1)) / 1000).toFixed(0)}k/mo In-Scope Cash/FTE`
              : `₹${(avgMonthlySalary / 1000).toFixed(0)}k/mo Average Cash per FTE`
          }
          icon={ArrowUpRight}
          badge={activeKpis?.isFiltered ? 'In-Scope' : 'Monthly Cash'}
          badgeColor="amber"
        />
        <KPICard
          compact={true}
          title={activeKpis?.isFiltered ? 'Cohort CTC Ceiling' : 'Executive CTC Ceiling'}
          value={`₹${((activeKpis?.maxCtc ?? data.max_ctc) / 100000).toFixed(2)} L`}
          subtitle={
            activeKpis?.isFiltered
              ? `Floor: ₹${((activeKpis.minCtc) / 100000).toFixed(2)}L · Highest In-Scope`
              : `Floor: ₹${(data.min_ctc / 100000).toFixed(2)}L · Highest Compensation`
          }
          icon={Award}
          badge={activeKpis?.isFiltered ? 'Max In-Scope' : 'Max CTC'}
          badgeColor="purple"
        />
      </div>

      {/* Middle Visuals: 12-col grid */}
      <div className="grid grid-cols-12 gap-1.5 flex-1 min-h-0">
        {/* Left: 54 Managers x Grade CTC Matrix (8 Cols) */}
        <div className="col-span-12 xl:col-span-8 glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">Manager Compensation Outlay</span>
              {isManagerRole && lockedManagerName ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Team Restricted: {lockedManagerName}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Click row to filter earners</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <ExportButton data={managerExportData} filename="manager_compensation_outlay.csv" label="Export Matrix" />
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search manager..."
                  value={managerSearch}
                  onChange={(e) => {
                    setManagerSearch(e.target.value);
                    setManagerPage(1);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-36 hover:border-slate-300 dark:hover:border-slate-600 transition-colors leading-none"
                />
                {managerSearch && (
                  <button
                    onClick={() => {
                      setManagerSearch('');
                      setManagerPage(1);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                  </button>
                )}
              </div>

              {/* View selector & Pagination controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[9px] font-mono">
                  <span className="text-slate-400">View:</span>
                  {[20, 35, 'All'].map((cnt) => {
                    const active = managersPerPage === (cnt === 'All' ? 'all' : cnt);
                    return (
                      <button
                        key={String(cnt)}
                        onClick={() => {
                          setManagersPerPage(cnt === 'All' ? 'all' : cnt as number);
                          setManagerPage(1);
                        }}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          active
                            ? 'bg-cyan-600 text-white font-bold shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cnt}
                      </button>
                    );
                  })}
                </div>

                {managersPerPage !== 'all' ? (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>Page {managerPage} of {totalManagerPages}</span>
                    <button
                      disabled={managerPage === 1}
                      onClick={() => setManagerPage((p) => Math.max(1, p - 1))}
                      className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer flex items-center justify-center transition-colors"
                      title="Previous managers page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={managerPage >= totalManagerPages}
                      onClick={() => setManagerPage((p) => Math.min(totalManagerPages, p + 1))}
                      className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer flex items-center justify-center transition-colors"
                      title="Next managers page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    All {allFilteredManagers.length} loaded
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar my-1">
            <table className="w-full min-w-[700px] text-left text-[10px] text-slate-700 dark:text-slate-300">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-1 px-2 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none sticky left-0 z-20 bg-slate-50 dark:bg-[#12223a] border-r border-slate-200 dark:border-slate-700" onClick={() => toggleManagerSort('manager')}>
                    <div className="flex items-center gap-0.5">Reporting Manager ({allFilteredManagers.length}) <ManagerSortIcon field="manager" /></div>
                  </th>
                  {activeMatrix.grades.map((g) => {
                    const isGradeActive = selectedGradeFilter === g;
                    return (
                      <th 
                        key={g} 
                        className={`py-1 px-1.5 text-center cursor-pointer transition-colors select-none min-w-[55px] ${
                          isGradeActive 
                            ? 'text-purple-600 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/70 font-bold' 
                            : 'hover:text-cyan-700 dark:hover:text-cyan-400'
                        }`} 
                        onClick={() => {
                          setSelectedGradeFilter(isGradeActive ? null : g);
                          setEarnerPage(1);
                        }}
                        title={`Click to filter workforce by Grade ${g}`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          {g}
                          {isGradeActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                          ) : (
                            <ManagerSortIcon field={g} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-cyan-700 dark:hover:text-cyan-400 select-none" onClick={() => toggleManagerSort('total')}>
                    <div className="flex items-center justify-end gap-0.5">Total CTC <ManagerSortIcon field="total" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {paginatedManagers.length > 0 ? (
                  paginatedManagers.map((mgr) => {
                    const row = activeMatrix.matrix[mgr] || {};
                    const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                    const isSelected = effectiveManagerFilter === mgr;
                    return (
                      <tr 
                        key={mgr} 
                        className={`transition-colors ${isSelected ? 'bg-cyan-100/70 dark:bg-cyan-950/60' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'}`}
                      >
                        <td 
                          onClick={() => handleCellClick(mgr)}
                          className="py-1 px-2 font-sans text-slate-900 dark:text-slate-100 font-medium truncate max-w-[140px] cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 sticky left-0 z-10 bg-white dark:bg-[#0c1829] border-r border-slate-200 dark:border-slate-800"
                          title={`Click to isolate ${mgr}'s team`}
                        >
                          {mgr}
                        </td>
                        {activeMatrix.grades.map((g) => {
                          const val = row[g] || 0;
                          const isCellSelected = isSelected && selectedGradeFilter === g;
                          return (
                            <td 
                              key={g} 
                              onClick={() => {
                                if (val > 0) handleCellClick(mgr, g);
                              }}
                              className={`py-1 px-1.5 text-center font-medium transition-colors ${
                                val > 0 
                                  ? isCellSelected
                                    ? 'bg-purple-200/80 dark:bg-purple-900/80 text-purple-900 dark:text-purple-100 font-bold cursor-pointer ring-1 ring-purple-500'
                                    : 'cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300'
                                  : 'text-slate-400 dark:text-slate-600'
                              }`}
                              title={val > 0 ? `Click to filter ${mgr} · Grade ${g} (₹${(val / 100000).toFixed(1)}L)` : undefined}
                            >
                              {val > 0 ? `₹${(val / 100000).toFixed(1)}L` : '-'}
                            </td>
                          );
                        })}
                        <td 
                          onClick={() => handleCellClick(mgr)}
                          className="py-1 px-2 text-right font-bold text-cyan-700 dark:text-cyan-400 cursor-pointer hover:underline"
                          title={`Click to isolate ${mgr}'s team`}
                        >
                          ₹{(rowTotal / 100000).toFixed(1)}L
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={activeMatrix.grades.length + 2} className="py-4">
                      <EmptyState
                        compact
                        title="No matching managers found"
                        description={managerSearch ? `No managers found for "${managerSearch}".` : 'No manager records match the current filters.'}
                        onResetFilters={managerSearch ? () => { setManagerSearch(''); setManagerPage(1); } : undefined}
                        resetLabel="Clear Search"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Earners Table (4 Cols) */}
        <div className="col-span-12 xl:col-span-4 glass-panel rounded-xl p-2.5 flex flex-col overflow-hidden min-h-0">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0 gap-1.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight whitespace-nowrap">
                {effectiveManagerFilter ? 'Team Earners' : (hasAnyFilter ? 'Earners' : 'Top Earners')}
              </span>
              <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono font-bold">
                ({totalMatchingEarners})
              </span>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
                  title="Clear all active cross-filters"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {/* Employee search input */}
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={earnerSearch}
                  onChange={(e) => {
                    setEarnerSearch(e.target.value);
                    setEarnerPage(1);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[10px] pl-5 pr-5 py-0.5 rounded-md focus:outline-none focus:border-cyan-500 w-22 sm:w-26 focus:w-32 hover:border-slate-300 dark:hover:border-slate-600 transition-all leading-none"
                />
                {earnerSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEarnerSearch('');
                      setEarnerPage(1);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Pagination controls for earners */}
              {topLimit !== 'all' && totalEarnerPages > 1 && (
                <div className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{earnerPage}/{totalEarnerPages}</span>
                  <button
                    type="button"
                    disabled={earnerPage === 1}
                    onClick={() => setEarnerPage((p) => Math.max(1, p - 1))}
                    className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer flex items-center justify-center transition-colors"
                    title="Previous earners page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={earnerPage >= totalEarnerPages}
                    onClick={() => setEarnerPage((p) => Math.min(totalEarnerPages, p + 1))}
                    className="min-w-[28px] min-h-[28px] p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer flex items-center justify-center transition-colors"
                    title="Next earners page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 text-[9px] font-mono">
                {[10, 20, 50, 'all'].map((lim) => (
                  <button
                    key={String(lim)}
                    type="button"
                    onClick={() => {
                      setTopLimit(lim as any);
                      setEarnerPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                      topLimit === lim ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {lim === 'all' ? 'All' : lim}
                  </button>
                ))}
              </div>
              <ExportButton data={allMatchingEarners} filename="compensation_earners.csv" />
            </div>
          </div>

          {/* Active Filter Chips Bar (Dismissible) */}
          {hasAnyFilter && (
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-1 shrink-0 border-b border-slate-100 dark:border-slate-800/60">
              {earnerSearch && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex items-center gap-1">
                  Employee: "{earnerSearch}"
                  <button type="button" onClick={() => { setEarnerSearch(''); setEarnerPage(1); }} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {selectedBandFilter && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  Band: {selectedBandFilter}
                  <button type="button" onClick={() => { setSelectedBandFilter(null); setEarnerPage(1); }} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {effectiveManagerFilter && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex items-center gap-1">
                  Manager: "{effectiveManagerFilter}"
                  <button 
                    type="button" 
                    onClick={() => {
                      setSelectedManagerFilter(null);
                      setManagerSearch('');
                      setEarnerPage(1);
                    }} 
                    className="hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {selectedGradeFilter && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  Grade: {selectedGradeFilter}
                  <button type="button" onClick={() => { setSelectedGradeFilter(null); setEarnerPage(1); }} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto custom-scrollbar my-1 min-h-0">
            <table className="w-full text-left text-[11px] text-slate-700 dark:text-slate-300">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-1 px-1.5 text-slate-400" title="Filtered position rank">#</th>
                  <th className="py-1 px-1.5">Employee</th>
                  <th className="py-1 px-1 text-center">Grade</th>
                  <th className="py-1 px-1 text-center">Band</th>
                  <th className="py-1 px-1.5 text-right font-bold text-slate-900 dark:text-slate-100">Total CTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {displayedTopEarners.length > 0 ? (
                  displayedTopEarners.map((e, idx) => (
                    <tr 
                      key={e.employee_number}
                      onClick={() => {
                        if (onOpenEmployeeProfile) {
                          onOpenEmployeeProfile(e.employee_number);
                        } else {
                          onSelectEmployee(e.employee_number);
                        }
                      }}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      title="Click to view 360 Employee Profile modal"
                    >
                      <td className="py-1 px-1.5 text-slate-400 dark:text-slate-500 font-sans text-[10px]" title="Position in filtered list">
                        {topLimit === 'all' ? idx + 1 : (earnerPage - 1) * Number(topLimit) + idx + 1}
                      </td>
                      <td className="py-1 px-1.5 font-sans font-medium text-slate-900 dark:text-slate-100 truncate max-w-[110px] group-hover:text-cyan-700 dark:group-hover:text-cyan-400" title={e.name}>
                        {e.name}
                      </td>
                      <td className="py-1 px-1 text-center font-sans">
                        <button
                          type="button"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedGradeFilter(selectedGradeFilter === e.job_level ? null : e.job_level);
                            setEarnerPage(1);
                            setManagerPage(1);
                          }}
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                            selectedGradeFilter === e.job_level
                              ? 'bg-purple-600 text-white border-purple-700'
                              : 'bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                          }`}
                          title={`Filter by grade ${e.job_level}`}
                        >
                          {e.job_level}
                        </button>
                      </td>
                      <td className="py-1 px-1 text-center font-sans">
                        <button
                          type="button"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            const bin = e.salary_bin || '';
                            setSelectedBandFilter(selectedBandFilter === bin ? null : bin);
                            setEarnerPage(1);
                            setManagerPage(1);
                          }}
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                            selectedBandFilter === e.salary_bin
                              ? 'bg-cyan-600 text-white border-cyan-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                          title={`Filter by salary band ${e.salary_bin}`}
                        >
                          {e.salary_bin || '-'}
                        </button>
                      </td>
                      <td className="py-1 px-1.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        ₹{(e.total_ctc / 100000).toFixed(2)}L
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4">
                      <EmptyState
                        compact
                        title="No matching earners found"
                        description={earnerSearch ? `No employees found matching "${earnerSearch}".` : 'No earners match the current filter combination.'}
                        onResetFilters={earnerSearch ? () => setEarnerSearch('') : (effectiveManagerFilter || selectedBandFilter || selectedGradeFilter ? () => { setSelectedBandFilter(null); setSelectedManagerFilter(null); setSelectedGradeFilter(null); } : undefined)}
                        resetLabel={earnerSearch ? 'Clear Search' : 'Clear Cross-Filters'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lower Row: CTC Distribution Band Histogram (Interactive Cross-Filter) */}
      <div className="glass-panel rounded-xl p-2.5 shrink-0 min-h-[140px] h-auto flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wider font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              Workforce Compensation Distribution by Salary Band
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            {selectedBandFilter && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBandFilter(null);
                  setEarnerPage(1);
                  setManagerPage(1);
                }}
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 flex items-center gap-1 hover:bg-rose-100 hover:text-rose-700 cursor-pointer transition-colors shadow-2xs"
              >
                Filtered: {selectedBandFilter} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 pt-1.5 flex-1 items-stretch">
          {histogram.map((band, idx) => {
            const bandName = band.band || (band as any).bin;
            const isSelected = selectedBandFilter === bandName;
            const bandColor = band.color || ['#0284c7', '#10b981', '#d97706', '#8b5cf6', '#ec4899'][idx % 5];
            const outlayCr = band.total_outlay ? (band.total_outlay / 10000000).toFixed(2) : null;
            const avgL = band.avg_ctc ? (band.avg_ctc / 100000).toFixed(1) : null;
            
            return (
              <div 
                key={idx} 
                onClick={() => {
                  setSelectedBandFilter(isSelected ? null : bandName);
                  setEarnerPage(1);
                  setManagerPage(1);
                }}
                className={`p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-150 relative overflow-hidden group ${
                  isSelected 
                    ? 'border-cyan-500 ring-2 ring-cyan-500/50 bg-cyan-50/90 dark:bg-cyan-950/80 shadow-md scale-[1.01]' 
                    : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:border-cyan-400 hover:bg-cyan-50/30 dark:hover:bg-slate-800/90 hover:scale-[1.005] hover:shadow-xs'
                }`}
                title={`Click to isolate ${bandName} compensation cohort (${band.count} employees)`}
              >
                {/* Top Row: Band Title & Active Indicator */}
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5">
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: bandColor }} 
                    />
                    <span className={isSelected ? 'text-cyan-800 dark:text-cyan-200' : 'text-slate-800 dark:text-slate-100'}>
                      {bandName}
                    </span>
                  </span>
                  {isSelected ? (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-cyan-600 text-white flex items-center gap-0.5 shadow-2xs">
                      ACTIVE <Check className="w-2.5 h-2.5" />
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      {band.count} <span className="text-[9px] text-slate-400 font-normal">staff</span>
                    </span>
                  )}
                </div>

                {/* Middle: Financial Outlay & Avg CTC */}
                <div className="flex items-baseline justify-between text-[10px] my-0.5 font-mono">
                  <span className="text-slate-500 dark:text-slate-400 text-[9px]">
                    {outlayCr ? `₹${outlayCr} Cr Outlay` : '—'}
                  </span>
                  <span className="text-cyan-700 dark:text-cyan-400 font-semibold text-[10px]">
                    {avgL ? `Avg ₹${avgL}L` : '—'}
                  </span>
                </div>

                {/* Bottom: Progress bar & Concentration */}
                <div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${Math.max(band.percentage, 1)}%`, 
                        backgroundColor: bandColor,
                        boxShadow: isSelected ? `0 0 8px ${bandColor}` : 'none'
                      }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                    <span className="text-[8px] uppercase tracking-wider font-semibold">{isSelected ? 'Active Filter' : 'Share'}</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{band.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

