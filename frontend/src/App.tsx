import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { canAccessTab } from './utils/rbac';
import { Header } from './components/layout/Header';
import { FilterBar, TechwiseMode, CompensationMode } from './components/layout/FilterBar';
import { AICopilotDrawer } from './components/copilot/AICopilotDrawer';
import { EmployeeProfileDrawer } from './components/common/EmployeeProfileDrawer';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DashboardSkeleton } from './components/common/DashboardSkeleton';
import { DatasetOperationsModal } from './components/dataset/DatasetOperationsModal';

// Code-split Auth views
const Login = lazy(() => import('./components/auth/Login').then((m) => ({ default: m.Login })));
const SignUp = lazy(() => import('./components/auth/SignUp').then((m) => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));

// Code-split Dashboard Tab views
const HomeDashboard = lazy(() => import('./components/tabs/HomeDashboard').then((m) => ({ default: m.HomeDashboard })));
const StatewiseDashboard = lazy(() => import('./components/tabs/StatewiseDashboard').then((m) => ({ default: m.StatewiseDashboard })));
const EmployeeDetailsDashboard = lazy(() => import('./components/tabs/EmployeeDetailsDashboard').then((m) => ({ default: m.EmployeeDetailsDashboard })));
const Employee360Dashboard = lazy(() => import('./components/tabs/Employee360Dashboard').then((m) => ({ default: m.Employee360Dashboard })));
const TechwiseDashboard = lazy(() => import('./components/tabs/TechwiseDashboard').then((m) => ({ default: m.TechwiseDashboard })));
const SalarywiseDashboard = lazy(() => import('./components/tabs/SalarywiseDashboard').then((m) => ({ default: m.SalarywiseDashboard })));
const EmployeeCalendarDashboard = lazy(() => import('./components/tabs/EmployeeCalendarDashboard').then((m) => ({ default: m.EmployeeCalendarDashboard })));
import type {
  FilterParams,
  FilterOptions,
  HomeKPIs,
  StatewiseKPIs,
  EmployeeListItem,
  EmployeeDetails,
  TechwiseKPIs,
  SalarywiseKPIs,
  Salarywise2KPIs,
  CalendarData,
  CopilotResponse,
} from './types/dashboard';
import {
  fetchFilterOptions,
  fetchHomeKPIs,
  fetchStatewiseKPIs,
  fetchEmployeeList,
  fetchEmployeeDetails,
  fetchTechwiseKPIs,
  fetchSalarywiseKPIs,
  fetchSalarywise2KPIs,
  fetchCalendarData,
  reloadDataset,
} from './api/client';

const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'home';
  const [activeTab, setActiveTabState] = useState<string>(initialTab);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== activeTab) {
      setActiveTabState(t);
    }
  }, [searchParams, activeTab]);

  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ets_dashboard_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  // Synchronize theme with document.documentElement (for Tailwind dark: utilities) and localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ets_dashboard_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    } catch (e) {
      console.warn('Unable to persist theme:', e);
    }
  }, [theme]);

  const [filters, setFilters] = useState<FilterParams>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Universal Slide-Over Drawer state
  const [drawerEmpNumber, setDrawerEmpNumber] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const handleOpenEmployeeProfile = (empNumber: number) => {
    setDrawerEmpNumber(empNumber);
    setDrawerOpen(true);
  };

  // Tab Data States
  const [homeData, setHomeData] = useState<HomeKPIs | null>(null);
  const [statewiseData, setStatewiseData] = useState<StatewiseKPIs | null>(null);
  const [employeeList, setEmployeeList] = useState<EmployeeListItem[]>([]);
  const [selectedEmpNumber, setSelectedEmpNumber] = useState<number>(1019272);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);
  const [techwiseData, setTechwiseData] = useState<TechwiseKPIs | null>(null);
  const [salarywiseData, setSalarywiseData] = useState<SalarywiseKPIs | null>(null);
  const [salarywise2Data, setSalarywise2Data] = useState<Salarywise2KPIs | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [techwiseMode, setTechwiseMode] = useState<TechwiseMode>('depth');
  const [compensationMode, setCompensationMode] = useState<CompensationMode>('overview');
  const [profileViewMode, setProfileViewMode] = useState<'360' | 'classic'>('360');

  // Test & automation telemetry synchronization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__activeTab = activeTab;
      (window as any).__dashboardFilters = filters;
      (window as any).__selectedEmpNumber = selectedEmpNumber;
    }
  }, [activeTab, filters, selectedEmpNumber]);

  // Re-fetch Filter Options when filters change for dynamic sequential cascading
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const opts = await fetchFilterOptions(filters);
        setFilterOptions(opts);
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };
    loadOptions();
  }, [filters]);

  // Re-fetch employee list when filters change
  useEffect(() => {
    const loadEmployeeList = async () => {
      try {
        const emps = await fetchEmployeeList(filters);
        setEmployeeList(emps);
        if (emps.length > 0 && !emps.find(e => e['EMPLOYEE NUMBER'] === selectedEmpNumber)) {
          setSelectedEmpNumber(emps[0]['EMPLOYEE NUMBER']);
        }
      } catch (err) {
        console.error('Error loading employee list:', err);
      }
    };
    loadEmployeeList();
  }, [filters]);

  // Fetch Tab Specific Data based on activeTab and filters (only if authorized)
  const loadActiveTabData = useCallback(async () => {
    if (!canAccessTab(user?.role, activeTab)) {
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'home') {
        const res = await fetchHomeKPIs(filters);
        setHomeData(res);
      } else if (activeTab === 'statewise') {
        const res = await fetchStatewiseKPIs(filters);
        setStatewiseData(res);
      } else if (activeTab === 'employee_details') {
        const [emp, cal] = await Promise.all([
          fetchEmployeeDetails(selectedEmpNumber),
          fetchCalendarData(filters).catch(() => null),
        ]);
        setEmployeeDetails(emp);
        if (cal) setCalendarData(cal);
      } else if (activeTab === 'techwise') {
        const res = await fetchTechwiseKPIs(filters);
        setTechwiseData(res);
      } else if (activeTab === 'salarywise' || activeTab === 'salarywise2') {
        const [res1, res2] = await Promise.all([
          fetchSalarywiseKPIs(filters),
          fetchSalarywise2KPIs(filters),
        ]);
        setSalarywiseData(res1);
        setSalarywise2Data(res2);
      } else if (activeTab === 'calendar') {
        const res = await fetchCalendarData(filters);
        setCalendarData(res);
      }
    } catch (err) {
      console.error('Error fetching tab data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, selectedEmpNumber, user?.role]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Refresh dataset and active tab
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await reloadDataset();
    } catch (e) {
      console.warn('Dataset reload error:', e);
    }
    await loadActiveTabData();
  };

  // Navigate to Employee 360 view for a specific employee
  const handleSelectEmployee = (empNumber: number) => {
    setSelectedEmpNumber(empNumber);
    setActiveTab('employee_details');
  };

  // Synchronize Copilot query result and filters into the visual dashboard
  const handleShowInVisualView = (response?: CopilotResponse) => {
    if (!response) return;

    // 1. Employee lookup (Contract Gate 1.3 / 1.4: Entity Selection)
    if (response.visual_target === 'employee_details' || response.selected_entity?.employee_number) {
      const empNum = Number(response.selected_entity?.employee_number || response.filters?.employee_number);
      if (!isNaN(empNum) && empNum > 0) {
        setSelectedEmpNumber(empNum);
        setActiveTab('employee_details');
        return;
      }
    }

    // 2. Authoritative Visual Target from Backend Contract (Contract Gate 1.2 / 1.3)
    const targetTab = response.visual_target || 'home';

    // 3. Extract and synchronize filters into FilterBar (Fresh state prevents filter leakage - Test 6)
    const visualFilters = response.visual_filters || response.filters || {};
    const nextFilters: FilterParams = {};

    if (visualFilters.department) {
      nextFilters.department = visualFilters.department;
    }
    if (visualFilters.location) {
      nextFilters.location = visualFilters.location;
    } else if (visualFilters.locations && Array.isArray(visualFilters.locations)) {
      nextFilters.location = visualFilters.locations;
    }
    if (visualFilters.state) {
      nextFilters.state = visualFilters.state;
    } else if (visualFilters.states && Array.isArray(visualFilters.states)) {
      nextFilters.state = visualFilters.states;
    }
    if (visualFilters.job_level) {
      nextFilters.job_level = visualFilters.job_level;
    }
    if (visualFilters.project) {
      nextFilters.project = visualFilters.project;
    }
    if (visualFilters.manager) {
      nextFilters.manager = visualFilters.manager;
    }
    if (visualFilters.skill_name) {
      nextFilters.skill_name = visualFilters.skill_name;
    }
    if (visualFilters.salary_bin) {
      nextFilters.salary_bin = visualFilters.salary_bin;
    }

    setFilters(nextFilters);
    setActiveTab(targetTab);
  };

  const activeFilterCount = Object.keys(filters).filter((k) => {
    const v = (filters as any)[k];
    if (k === 'search') return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;

  return (
    <div className={`theme-${theme} ${theme} h-screen min-h-[560px] w-full overflow-hidden flex flex-col select-none`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Executive Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        copilotOpen={copilotOpen}
        setCopilotOpen={setCopilotOpen}
        onRefresh={handleRefresh}
        loading={loading}
        totalEmployees={
          activeTab === 'techwise'
            ? (techwiseData?.total_headcount ?? employeeList.length ?? 590)
            : activeTab === 'home'
            ? (homeData?.total_employees ?? employeeList.length ?? 590)
            : (employeeList.length || 590)
        }
        theme={theme}
        setTheme={setTheme}
        activeFilterCount={activeFilterCount}
        onResetFilters={() => setFilters({})}
        onOpenDatasetModal={() => setDatasetModalOpen(true)}
      />

      {/* Inline Slicer / Filter Bar */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        options={filterOptions}
        activeTab={activeTab}
        techwiseMode={techwiseMode}
        setTechwiseMode={setTechwiseMode}
        compensationMode={compensationMode}
        setCompensationMode={setCompensationMode}
      />

      {/* Main Viewport Container & Docked Copilot (Push Layout) */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0 relative" style={{ background: 'var(--bg-soft)' }}>
        <main className="flex-1 min-w-0 p-2 flex flex-col overflow-y-auto custom-scrollbar min-h-0 relative">
          <ErrorBoundary fallbackTitle="Dashboard Module Interrupted">
            {!canAccessTab(user?.role, activeTab) ? (
              <ProtectedRoute requiredTab={activeTab} onNavigateHome={() => setActiveTab('home')}>
                <div />
              </ProtectedRoute>
            ) : (
              <Suspense
                fallback={
                  <DashboardSkeleton
                    variant={
                      activeTab === 'calendar'
                        ? 'calendar'
                        : activeTab === 'techwise'
                        ? 'tech'
                        : activeTab === 'salarywise' || activeTab === 'salarywise2'
                        ? 'compensation'
                        : activeTab === 'statewise'
                        ? 'client'
                        : 'workforce'
                    }
                  />
                }
              >
                {activeTab === 'home' && (
                  <HomeDashboard
                    data={homeData}
                    loading={loading && !homeData}
                    onNavigateTab={setActiveTab}
                    onOpenEmployeeProfile={handleOpenEmployeeProfile}
                    employeeList={employeeList}
                    filters={filters}
                    setFilters={setFilters}
                    onOpenDatasetModal={() => setDatasetModalOpen(true)}
                  />
                )}

                {activeTab === 'statewise' && (
                  <StatewiseDashboard
                    data={statewiseData}
                    loading={loading && !statewiseData}
                    onSelectEmployee={handleSelectEmployee}
                    onOpenEmployeeProfile={handleOpenEmployeeProfile}
                    filters={filters}
                    setFilters={setFilters}
                  />
                )}

                {activeTab === 'employee_details' && (
                  profileViewMode === '360' ? (
                    <Employee360Dashboard
                      employee={employeeDetails}
                      employeeList={employeeList}
                      selectedEmpNumber={selectedEmpNumber}
                      onSelectEmployee={setSelectedEmpNumber}
                      loading={loading && !employeeDetails}
                      onSwitchView={() => setProfileViewMode('classic')}
                      calendarData={calendarData}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 gap-1">
                      <div className="flex justify-end shrink-0">
                        <button
                          onClick={() => setProfileViewMode('360')}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition-colors cursor-pointer"
                        >
                          ✨ Switch to 360 Executive View (2026)
                        </button>
                      </div>
                      <EmployeeDetailsDashboard
                        employee={employeeDetails}
                        employeeList={employeeList}
                        selectedEmpNumber={selectedEmpNumber}
                        onSelectEmployee={setSelectedEmpNumber}
                        loading={loading && !employeeDetails}
                      />
                    </div>
                  )
                )}

                {activeTab === 'techwise' && (
                  <TechwiseDashboard
                    data={techwiseData}
                    loading={loading && !techwiseData}
                    filters={filters}
                    setFilters={setFilters}
                    onSelectEmployee={handleSelectEmployee}
                    onOpenEmployeeProfile={handleOpenEmployeeProfile}
                    techwiseMode={techwiseMode}
                    setTechwiseMode={setTechwiseMode}
                  />
                )}

                {(activeTab === 'salarywise' || activeTab === 'salarywise2') && (
                  <SalarywiseDashboard
                    data={salarywiseData}
                    trendsData={salarywise2Data}
                    loading={loading && (!salarywiseData || !salarywise2Data)}
                    subTab={compensationMode}
                    onSubTabChange={setCompensationMode}
                    onSelectEmployee={handleSelectEmployee}
                    onOpenEmployeeProfile={handleOpenEmployeeProfile}
                    filters={filters}
                    setFilters={setFilters}
                  />
                )}

                {activeTab === 'calendar' && (
                  <EmployeeCalendarDashboard
                    data={calendarData}
                    loading={loading && !calendarData}
                    filters={filters}
                    setFilters={setFilters}
                    onSelectEmployee={handleSelectEmployee}
                    onOpenEmployeeProfile={handleOpenEmployeeProfile}
                  />
                )}
              </Suspense>
            )}
          </ErrorBoundary>
        </main>

        {/* Docked AI Copilot Drawer (Side-by-side Push Layout) */}
        <AICopilotDrawer
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          activeTab={activeTab}
          onNavigateTab={setActiveTab}
          onShowInVisualView={handleShowInVisualView}
          filters={activeTab === 'employee_details' ? { ...filters, employee_number: selectedEmpNumber } : filters}
        />
      </div>

      {/* Universal Slide-over Employee Profile Drawer with Peer Benchmarking */}
      <EmployeeProfileDrawer
        empNumber={drawerEmpNumber}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenFullProfile={(empNum) => {
          setDrawerOpen(false);
          handleSelectEmployee(empNum);
        }}
      />

      {/* Dataset Operations & Cloud Ingestion Modal */}
      <DatasetOperationsModal
        isOpen={datasetModalOpen}
        onClose={() => setDatasetModalOpen(false)}
        onDatasetReloaded={handleRefresh}
        theme={theme}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="w-8 h-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ForgotPassword />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardView />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
