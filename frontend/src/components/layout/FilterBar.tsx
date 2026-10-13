import React from 'react';
import Select, { components } from 'react-select';
import type { FilterParams, FilterOptions } from '../../types/dashboard';
import { Filter, Search, X, CalendarDays, BadgeIndianRupee, TrendingUp } from 'lucide-react';

export type TechwiseMode = 'depth' | 'modules' | 'matrix' | 'gaps';
export type CompensationMode = 'overview' | 'trends';

interface FilterBarProps {
  filters: FilterParams;
  setFilters: React.Dispatch<React.SetStateAction<FilterParams>>;
  options: FilterOptions | null;
  activeTab: string;
  techwiseMode?: TechwiseMode;
  setTechwiseMode?: (mode: TechwiseMode) => void;
  compensationMode?: CompensationMode;
  setCompensationMode?: (mode: CompensationMode) => void;
}

const FIELD_LABELS: Record<string, string> = {
  project: 'Project',
  manager: 'Manager',
  department: 'Dept',
  module: 'Module',
  emp_type: 'Emp Type',
  tenure_band: 'Tenure',
  skill_name: 'Skill',
  job_level: 'Grade',
  location: 'Location',
  year: 'Year',
  month: 'Month',
  date: 'Date',
  state: 'State',
  search: 'Search',
};

// Compact custom styles for react-select using CSS variables to flawlessly adapt to light and dark themes
const compactSelectStyles: any = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '28px',
    height: '28px',
    fontSize: '11px',
    borderRadius: '6px',
    borderColor: state.isFocused ? '#0891b2' : 'var(--border)',
    backgroundColor: 'var(--surface)',
    boxShadow: state.isFocused ? '0 0 0 1px #0891b2' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#0891b2' : 'var(--border-strong)',
    },
    cursor: 'pointer',
    padding: '0 2px',
    transition: 'all 0.15s ease',
  }),
  valueContainer: (base: any) => ({
    ...base,
    height: '28px',
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    flexWrap: 'nowrap',
  }),
  input: (base: any) => ({
    ...base,
    margin: '0',
    padding: '0',
    fontSize: '11px',
    color: 'var(--text)',
  }),
  singleValue: (base: any) => ({
    ...base,
    color: 'var(--text)',
    fontSize: '11px',
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    height: '28px',
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    padding: '2px',
    color: 'var(--muted)',
    '&:hover': {
      color: 'var(--text)',
    },
  }),
  clearIndicator: (base: any) => ({
    ...base,
    padding: '2px',
    color: 'var(--muted)',
    '&:hover': {
      color: '#ef4444',
    },
  }),
  menu: (base: any) => ({
    ...base,
    fontSize: '11px',
    minWidth: '160px',
    width: 'max-content',
    maxWidth: '280px',
    zIndex: 9999,
    backgroundColor: 'var(--surface)',
    boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  }),
  menuList: (base: any) => ({
    ...base,
    maxHeight: '220px',
    padding: '4px',
    backgroundColor: 'var(--surface)',
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 9999,
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: state.isSelected
      ? '#0891b2'
      : state.isFocused
      ? 'var(--pill-bg)'
      : 'transparent',
    color: state.isSelected ? '#ffffff' : 'var(--text)',
    fontWeight: state.isSelected ? 600 : 400,
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#0e7490',
      color: '#ffffff',
    },
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: 'var(--pill-bg)',
    borderRadius: '4px',
    margin: '1px 2px 1px 0',
    maxWidth: '85px',
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: 'var(--cyan-strong)',
    fontSize: '10px',
    fontWeight: '600',
    padding: '0 3px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: 'var(--cyan-strong)',
    padding: '0 2px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'rgba(34, 211, 238, 0.2)',
      color: 'var(--cyan-strong)',
    },
  }),
  placeholder: (base: any) => ({
    ...base,
    fontSize: '11px',
    color: 'var(--muted)',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  }),
};

// Custom ValueContainer that summarizes multiple selections so the slicer width stays fixed
const CompactValueContainer = ({ children, getValue, ...props }: any) => {
  const values = getValue ? getValue() : [];
  const count = values ? values.length : 0;

  if (count > 1) {
    const childArray = React.Children.toArray(children);
    const input = childArray[childArray.length - 1];

    return (
      <components.ValueContainer {...props}>
        <div className="flex items-center gap-1 w-full overflow-hidden select-none pr-1">
          <span className="bg-cyan-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono shrink-0 leading-none">
            {count}
          </span>
          <span
            className="text-slate-800 dark:text-slate-200 font-medium text-[11px] truncate"
            title={values.map((v: any) => v.label).join(', ')}
          >
            {values.map((v: any) => v.label).join(', ')}
          </span>
        </div>
        {input}
      </components.ValueContainer>
    );
  }

  return <components.ValueContainer {...props}>{children}</components.ValueContainer>;
};

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  options,
  activeTab,
  techwiseMode = 'depth',
  setTechwiseMode,
  compensationMode = 'overview',
  setCompensationMode,
}) => {
  const [localSearch, setLocalSearch] = React.useState<string>(filters.search || '');
  const searchTimeout = React.useRef<number | null>(null);

  const handleChange = (key: keyof FilterParams, value: string | string[] | number | number[]) => {
    setFilters((prev) => {
      const next: Record<string, any> = { ...prev };
      if (Array.isArray(value)) {
        if (value.length === 0) {
          delete next[key];
        } else {
          next[key] = value;
        }
      } else {
        if (value === '' || value === null || value === undefined) {
          delete next[key];
        } else {
          next[key] = value;
        }
      }
      return next as FilterParams;
    });
  };

  // Helpers for react-select multi-select handling
  const mapOptions = (items?: string[], cleanId = false) =>
    (items || []).map((v) => ({
      value: v,
      label: cleanId ? v.replace(/\s*\(\d+\)\s*$/, '').trim() || v : v,
    }));

  const managerSelectOptions = React.useMemo(() => {
    if (options?.manager_options && options.manager_options.length > 0) {
      return options.manager_options.map((m) => ({
        value: m.value,
        label: m.label,
        name: m.name,
      }));
    }
    return (options?.managers || []).map((v) => {
      const clean = v.replace(/\s*\(\d+\)\s*$/, '').trim() || v;
      return {
        value: v,
        label: clean,
        name: clean,
      };
    });
  }, [options]);

  const getManagerMultiValue = () => {
    const val = filters.manager as any;
    if (!val) return [];
    const vals = Array.isArray(val) ? val : [val];
    return vals.map((v) => {
      const match = managerSelectOptions.find(
        (o: any) => o.value === v || o.name === v || o.label.includes(String(v))
      );
      if (match) {
        return {
          value: match.value,
          label: match.name || match.label,
        };
      }
      const s = String(v);
      return { value: s, label: s.replace(/\s*\(\d+\)\s*$/, '').trim() || s };
    });
  };

  const getMultiValue = (key: keyof FilterParams, cleanId = false) => {
    const val = filters[key] as any;
    if (Array.isArray(val)) return mapOptions(val as string[], cleanId);
    if (val) {
      const s = String(val);
      return [{ value: s, label: cleanId ? s.replace(/\s*\(\d+\)\s*$/, '').trim() || s : s }];
    }
    return [] as { value: string; label: string }[];
  };

  const onMultiChange = (key: keyof FilterParams) => (selected: any) => {
    const vals = (selected || []).map((s: any) => s.value);
    handleChange(key, vals);
  };

  // Auto-prune child filter selections that are no longer valid in the newly fetched options
  React.useEffect(() => {
    if (!options) return;
    setFilters((prev) => {
      let changed = false;
      const next = { ...prev };

      // Prune Manager if not in available managers
      if (next.manager && options.managers && options.managers.length > 0) {
        const currentMgrs = Array.isArray(next.manager) ? next.manager : [next.manager];
        const validMgrs = currentMgrs.filter((m) =>
          options.managers.some(
            (opt) => opt === m || opt.toLowerCase().includes(String(m).toLowerCase())
          )
        );
        if (validMgrs.length !== currentMgrs.length) {
          changed = true;
          if (validMgrs.length === 0) delete next.manager;
          else next.manager = validMgrs;
        }
      }

      // Prune MMIS Module if not in available modules
      if (next.module && options.modules && options.modules.length > 0) {
        const currentMods = Array.isArray(next.module) ? next.module : [next.module];
        const validMods = currentMods.filter((m) =>
          options.modules?.some(
            (opt) => opt.toLowerCase() === String(m).toLowerCase()
          )
        );
        if (validMods.length !== currentMods.length) {
          changed = true;
          if (validMods.length === 0) delete next.module;
          else next.module = validMods;
        }
      }

      // Prune Department if not in available departments
      if (next.department && options.departments && options.departments.length > 0) {
        const currentDepts = Array.isArray(next.department) ? next.department : [next.department];
        const validDepts = currentDepts.filter((d) =>
          options.departments.some(
            (opt) => opt.toLowerCase() === String(d).toLowerCase()
          )
        );
        if (validDepts.length !== currentDepts.length) {
          changed = true;
          if (validDepts.length === 0) delete next.department;
          else next.department = validDepts;
        }
      }

      return changed ? (next as FilterParams) : prev;
    });
  }, [options, setFilters]);

  React.useEffect(() => {
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = window.setTimeout(() => {
      handleChange('search', localSearch);
    }, 350);
    return () => {
      if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    };
  }, [localSearch]);

  const handleReset = () => {
    setLocalSearch('');
    setFilters({});
  };

  const removeFilterValue = (key: string, val?: any) => {
    setFilters((prev) => {
      const next = { ...prev } as any;
      const cur = next[key];
      if (cur === undefined) return next;
      if (val === undefined) {
        delete next[key];
        return next;
      }
      if (Array.isArray(cur)) {
        const remaining = cur.filter((v: any) => String(v) !== String(val));
        if (remaining.length === 0) delete next[key];
        else next[key] = remaining;
      } else {
        if (String(cur) === String(val)) delete next[key];
      }
      return next;
    });
  };

  const rawEntries = Object.entries(filters || {}) as [string, any][];
  const activeEntries = rawEntries.filter(([k, v]) => {
    if (k === 'search') return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });

  const activeFilterCount = Object.keys(filters).filter((k) => {
    const v = (filters as any)[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;

  return (
    <div className="flex flex-col shrink-0 select-none text-xs border-b border-slate-200 dark:border-[#223755] bg-white dark:bg-[#0a1526]">
      {/* Tier 1: Primary Slicers Bar */}
      <div className="min-h-[40px] h-auto px-3 py-1 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <div 
            className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0 font-medium pr-1"
            title="Filters"
            aria-label="Filters"
          >
            <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            {activeFilterCount > 0 && (
              <span 
                className="w-4 h-4 rounded-full bg-cyan-600 dark:bg-cyan-500 text-white font-bold text-[9px] flex items-center justify-center font-mono"
                title={`${activeFilterCount} active filters`}
              >
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* 1. Project Slicer */}
          <div className="w-28 min-w-[110px] shrink-0">
            <Select
              isMulti
              options={mapOptions(options?.projects)}
              value={getMultiValue('project')}
              onChange={onMultiChange('project')}
              placeholder="Project (All)"
              styles={compactSelectStyles}
              components={{ ValueContainer: CompactValueContainer }}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              isClearable={false}
            />
          </div>

          {/* 2. Reporting Manager Slicer */}
          <div className="w-40 min-w-[150px] shrink-0">
            <Select
              isMulti
              options={managerSelectOptions}
              value={getManagerMultiValue()}
              onChange={onMultiChange('manager')}
              placeholder="Manager (All)"
              styles={compactSelectStyles}
              components={{ ValueContainer: CompactValueContainer }}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              isClearable={false}
            />
          </div>

          {/* 3. Department Slicer */}
          <div className="w-28 min-w-[105px] shrink-0">
            <Select
              isMulti
              options={mapOptions(options?.departments)}
              value={getMultiValue('department')}
              onChange={onMultiChange('department')}
              placeholder="Dept (All)"
              styles={compactSelectStyles}
              components={{ ValueContainer: CompactValueContainer }}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              isClearable={false}
            />
          </div>

          {/* 4. MMIS Module Slicer */}
          {options?.modules && options.modules.length > 0 && (
            <div className="w-32 min-w-[120px] shrink-0">
              <Select
                isMulti
                options={mapOptions(options?.modules)}
                value={getMultiValue('module')}
                onChange={onMultiChange('module')}
                placeholder="Module (All)"
                styles={compactSelectStyles}
                components={{ ValueContainer: CompactValueContainer }}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                isClearable={false}
              />
            </div>
          )}

          {/* Page 3 (Techwise / Skills): Skill Slicer placed between Module and Grade */}
          {activeTab === 'techwise' && (
            <div className="w-32 min-w-[120px] shrink-0">
              <Select
                isMulti
                options={mapOptions(options?.skills)}
                value={getMultiValue('skill_name')}
                onChange={onMultiChange('skill_name')}
                placeholder="Skill (All)"
                styles={compactSelectStyles}
                components={{ ValueContainer: CompactValueContainer }}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                isClearable={false}
              />
            </div>
          )}

          {/* 5. Job Level / Grade Slicer */}
          <div className="w-24 min-w-[96px] shrink-0">
            <Select
              isMulti
              options={mapOptions(options?.job_levels)}
              value={getMultiValue('job_level')}
              onChange={onMultiChange('job_level')}
              placeholder="Grade (All)"
              styles={compactSelectStyles}
              components={{ ValueContainer: CompactValueContainer }}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              isClearable={false}
            />
          </div>

          {/* 6. Location Slicer */}
          <div className="w-28 min-w-[105px] shrink-0">
            <Select
              isMulti
              options={mapOptions(options?.locations)}
              value={getMultiValue('location')}
              onChange={onMultiChange('location')}
              placeholder="Location (All)"
              styles={compactSelectStyles}
              components={{ ValueContainer: CompactValueContainer }}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              isClearable={false}
            />
          </div>

          {/* Pages 4 & 5 (Salarywise & Salarywise2): Year Slicer */}
          {(activeTab === 'salarywise' || activeTab === 'salarywise2') && (
            <div className="w-24 min-w-[90px] shrink-0">
              <Select
                isMulti
                options={mapOptions(options?.years?.map(String))}
                value={getMultiValue('year')}
                onChange={onMultiChange('year')}
                placeholder="Year (All)"
                styles={compactSelectStyles}
                components={{ ValueContainer: CompactValueContainer }}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                isClearable={false}
              />
            </div>
          )}
        </div>

        {/* Right side of Tier 1: View Switchers (Techwise or Compensation) & Reset button */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {activeTab === 'techwise' && setTechwiseMode && (
            <div className="flex items-center bg-slate-100 dark:bg-[#12223a] p-0.5 rounded-lg border border-slate-200 dark:border-[#223755] shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => setTechwiseMode('depth')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  techwiseMode === 'depth'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
                title="View Seniority & Experience Depth Breakdown"
              >
                Experience Depth
              </button>
              <button
                type="button"
                onClick={() => setTechwiseMode('modules')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  techwiseMode === 'modules'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
                title="View MMIS Enterprise Module Allocation"
              >
                MMIS Modules
              </button>
              <button
                type="button"
                onClick={() => setTechwiseMode('matrix')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  techwiseMode === 'matrix'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
                title="View Manager x Skill Cross-Tab Matrix"
              >
                Manager Matrix
              </button>
              <button
                type="button"
                onClick={() => setTechwiseMode('gaps')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  techwiseMode === 'gaps'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
                title="View Bench Targets & Skill Deficits"
              >
                Bench Targets
              </button>
            </div>
          )}

          {(activeTab === 'salarywise' || activeTab === 'salarywise2') && setCompensationMode && (
            <div className="flex items-center bg-slate-100 dark:bg-[#12223a] p-0.5 rounded-lg border border-slate-200 dark:border-[#223755] shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => setCompensationMode('overview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  compensationMode === 'overview'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
                title="View Comprehensive Base CTC & Manager Outlay Matrix"
              >
                <BadgeIndianRupee className="w-3 h-3" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setCompensationMode('trends')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  compensationMode === 'trends'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
                title="View Longitudinal Trends, 5-Year History & Hike Telemetry"
              >
                <TrendingUp className="w-3 h-3" />
                <span>Longitudinal Trends</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
