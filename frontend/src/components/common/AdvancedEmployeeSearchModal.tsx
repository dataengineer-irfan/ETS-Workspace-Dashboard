import React, { useState, useMemo } from 'react';
import type { EmployeeListItem } from '../../types/dashboard';
import { 
  Search, 
  X, 
  Filter, 
  RotateCcw, 
  Check, 
  MapPin, 
  Briefcase, 
  Award, 
  ExternalLink,
  Users
} from 'lucide-react';

interface AdvancedEmployeeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeList: EmployeeListItem[];
  selectedEmpNumber?: number;
  onSelectEmployee: (empNumber: number) => void;
}

export const AdvancedEmployeeSearchModal: React.FC<AdvancedEmployeeSearchModalProps> = ({
  isOpen,
  onClose,
  employeeList,
  selectedEmpNumber,
  onSelectEmployee,
}) => {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedLoc, setSelectedLoc] = useState<string>('All');
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'ctc' | 'exp' | 'grade'>('ctc');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Derive unique options from employeeList
  const states = useMemo(() => ['All', ...Array.from(new Set(employeeList.map(e => e['State']).filter(Boolean) as string[])).sort()], [employeeList]);
  const grades = useMemo(() => ['All', ...Array.from(new Set(employeeList.map(e => e['JOB LEVEL']).filter(Boolean))).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  })], [employeeList]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(employeeList.map(e => e['DEPARTMENT']).filter(Boolean))).sort()], [employeeList]);
  const locations = useMemo(() => ['All', ...Array.from(new Set(employeeList.map(e => e['LOCATION']).filter(Boolean))).sort()], [employeeList]);
  const projects = useMemo(() => ['All', ...Array.from(new Set(employeeList.map(e => e['Project Working']).filter(Boolean) as string[])).sort()], [employeeList]);

  // Filtering
  const filteredEmployees = useMemo(() => {
    return employeeList.filter(e => {
      if (selectedState !== 'All' && e['State'] !== selectedState) return false;
      if (selectedGrade !== 'All' && e['JOB LEVEL'] !== selectedGrade) return false;
      if (selectedDept !== 'All' && e['DEPARTMENT'] !== selectedDept) return false;
      if (selectedLoc !== 'All' && e['LOCATION'] !== selectedLoc) return false;
      if (selectedProject !== 'All' && e['Project Working'] !== selectedProject) return false;

      if (search.trim()) {
        const term = search.toLowerCase().trim();
        const name = (e['EMPLOYEE LABEL'] || '').toLowerCase();
        const id = String(e['EMPLOYEE NUMBER']);
        const title = (e['JOB TITLE'] || '').toLowerCase();
        const mgr = (e['MANAGER'] || '').toLowerCase();
        const match = name.includes(term) || id.includes(term) || title.includes(term) || mgr.includes(term);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = (a['EMPLOYEE LABEL'] || '').localeCompare(b['EMPLOYEE LABEL'] || '');
      } else if (sortBy === 'ctc') {
        comp = (a['EMP_CTC1'] || 0) - (b['EMP_CTC1'] || 0);
      } else if (sortBy === 'exp') {
        comp = (a['Total_Exp'] || 0) - (b['Total_Exp'] || 0);
      } else if (sortBy === 'grade') {
        const numA = parseInt((a['JOB LEVEL'] || '').replace(/\D/g, '')) || 0;
        const numB = parseInt((b['JOB LEVEL'] || '').replace(/\D/g, '')) || 0;
        comp = numA - numB;
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [employeeList, search, selectedState, selectedGrade, selectedDept, selectedLoc, selectedProject, sortBy, sortOrder]);

  const handleReset = () => {
    setSearch('');
    setSelectedState('All');
    setSelectedGrade('All');
    setSelectedDept('All');
    setSelectedLoc('All');
    setSelectedProject('All');
  };

  const hasActiveFilters = search || selectedState !== 'All' || selectedGrade !== 'All' || selectedDept !== 'All' || selectedLoc !== 'All' || selectedProject !== 'All';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c1829] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#223755] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#223755] flex items-center justify-between bg-gradient-to-r from-slate-50 dark:from-[#0f1f35] to-cyan-50/40 dark:to-[#0f2a42]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Advanced Employee Search & Talent Finder</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-mono">
                  {employeeList.length} Total Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Multi-parameter search across performance, geography, hierarchy and compensation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Strip */}
        <div className="p-4 bg-slate-50/80 dark:bg-[#0e1c30] border-b border-slate-200 dark:border-[#223755] flex flex-col gap-3">
          {/* Main search bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Employee Name, ID (#1019272), Job Title, or Reporting Manager..."
                className="w-full bg-white dark:bg-[#13233c] border border-slate-300 dark:border-[#2a4368] rounded-xl pl-9 pr-9 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:focus:ring-cyan-900/40 shadow-xs"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-colors shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Quick Dropdown Slicers */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full bg-white dark:bg-[#13233c] border border-slate-300 dark:border-[#2a4368] rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-600"
              >
                {states.map(s => <option key={s} value={s}>{s === 'All' ? 'State (All)' : s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Job Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-white dark:bg-[#13233c] border border-slate-300 dark:border-[#2a4368] rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-600"
              >
                {grades.map(g => <option key={g} value={g}>{g === 'All' ? 'Grade (All)' : `Grade ${g}`}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-white dark:bg-[#13233c] border border-slate-300 dark:border-[#2a4368] rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-600"
              >
                {departments.map(d => <option key={d} value={d}>{d === 'All' ? 'Department (All)' : d}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Location</label>
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="w-full bg-white dark:bg-[#13233c] border border-slate-300 dark:border-[#2a4368] rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-600"
              >
                {locations.map(l => <option key={l} value={l}>{l === 'All' ? 'Location (All)' : l}</option>
                )}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full bg-white dark:bg-[#13233c] border border-slate-300 dark:border-[#2a4368] rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-cyan-600"
              >
                {projects.map(p => <option key={p} value={p}>{p === 'All' ? 'Project (All)' : p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Results Bar */}
        <div className="px-6 py-2 bg-slate-100/70 dark:bg-[#0f1f35] border-b border-slate-200 dark:border-[#223755] flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Showing {filteredEmployees.length} of {employeeList.length} employees
            </span>
            {hasActiveFilters && (
              <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 px-1.5 py-0.5 rounded font-medium">Filtered</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === 'ctc') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                else { setSortBy('ctc'); setSortOrder('desc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${sortBy === 'ctc' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-[#13233c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a4368]'}`}
            >
              <span>CTC</span>
              {sortBy === 'ctc' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
            </button>
            <button
              onClick={() => {
                if (sortBy === 'grade') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                else { setSortBy('grade'); setSortOrder('desc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${sortBy === 'grade' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-[#13233c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a4368]'}`}
            >
              <span>Grade</span>
              {sortBy === 'grade' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
            </button>
            <button
              onClick={() => {
                if (sortBy === 'exp') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                else { setSortBy('exp'); setSortOrder('desc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${sortBy === 'exp' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-[#13233c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a4368]'}`}
            >
              <span>Exp</span>
              {sortBy === 'exp' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
            </button>
            <button
              onClick={() => {
                if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                else { setSortBy('name'); setSortOrder('asc'); }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${sortBy === 'name' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-[#13233c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a4368]'}`}
            >
              <span>Name</span>
              {sortBy === 'name' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredEmployees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredEmployees.map((emp) => {
                const isSelected = emp['EMPLOYEE NUMBER'] === selectedEmpNumber;
                const initials = (emp['EMPLOYEE LABEL'] || 'E').split(' ').map((n: string) => n[0]).slice(0, 2).join('');
                return (
                  <div
                    key={emp['EMPLOYEE NUMBER']}
                    onClick={() => {
                      onSelectEmployee(emp['EMPLOYEE NUMBER']);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-cyan-50/70 dark:bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-300 shadow-sm'
                        : 'bg-white dark:bg-[#12223a] hover:bg-slate-50 dark:hover:bg-[#172b45] border-slate-200 dark:border-[#223755] hover:border-cyan-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {emp['EMPLOYEE LABEL']}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/60 text-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-mono">
                            {emp['JOB LEVEL']}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{emp['JOB TITLE']} · {emp['DEPARTMENT']}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {emp['LOCATION']}{emp['State'] ? ` (${emp['State']})` : ''}
                          </span>
                          {emp['Project Working'] && (
                            <span>· Proj: <strong className="text-slate-700 dark:text-slate-300">{emp['Project Working']}</strong></span>
                          )}
                          {emp['Total_Exp'] !== undefined && (
                            <span>· {emp['Total_Exp']}y Exp</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {emp['EMP_CTC1'] ? (
                        <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          ₹{(emp['EMP_CTC1'] / 100000).toFixed(1)}L
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">CTC N/A</span>
                      )}
                      <button
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                          isSelected
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-950/60'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <span>Select</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              <p className="font-semibold text-slate-600 dark:text-slate-300">No employees match your search criteria.</p>
              <p className="mt-1">Try clearing some filters or searching with a different term.</p>
              <button
                onClick={handleReset}
                className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-[#0c1829] border-t border-slate-200 dark:border-[#223755] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Tip: Click any employee card to immediately load their complete 360 profile.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-[#2a4368] bg-white dark:bg-[#13233c] text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
