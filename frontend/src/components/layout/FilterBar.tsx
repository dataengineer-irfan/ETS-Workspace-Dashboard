import React from 'react';
import Select, { components } from 'react-select';
import type { FilterParams, FilterOptions } from '../../types/dashboard';
import { Filter, RotateCcw, Search, X } from 'lucide-react';

interface FilterBarProps {
  filters: FilterParams;
  setFilters: React.Dispatch<React.SetStateAction<FilterParams>>;
  options: FilterOptions | null;
  activeTab: string;
}

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
  const mapOptions = (items?: string[]) => (items || []).map((v) => ({ value: v, label: v }));

  const getMultiValue = (key: keyof FilterParams) => {
    const val = filters[key] as any;
    if (Array.isArray(val)) return mapOptions(val as string[]);
    if (val) return [{ value: String(val), label: String(val) }];
    return [] as { value: string; label: string }[];
  };

  const onMultiChange = (key: keyof FilterParams) => (selected: any) => {
    const vals = (selected || []).map((s: any) => s.value);
    handleChange(key, vals);
  };

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

  const activeFilterCount = Object.keys(filters).filter((k) => {
    const v = (filters as any)[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;

  return (
    <div className="h-10 bg-white dark:bg-[#0a1526] border-b border-slate-200 dark:border-[#223755] px-3 flex items-center justify-between gap-2 shrink-0 select-none text-xs">
      {/* Left Slicer Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0 font-medium pr-1">
          <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-cyan-600 dark:bg-cyan-500 text-white font-bold text-[9px] flex items-center justify-center font-mono">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* State Slicer */}
        <div className="w-24 min-w-[96px] shrink-0">
          <Select
            isMulti
            options={mapOptions(options?.states)}
            value={getMultiValue('state')}
            onChange={onMultiChange('state')}
            placeholder="State (All)"
            styles={compactSelectStyles}
            components={{ ValueContainer: CompactValueContainer }}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            isClearable={false}
          />
        </div>

        {/* Project Slicer */}
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

        {/* Job Level / Grade Slicer */}
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

        {/* Department Slicer */}
        <div className="w-28 min-w-[110px] shrink-0">
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

        {/* Location Slicer */}
        <div className="w-28 min-w-[110px] shrink-0">
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

        {/* Reporting Manager Slicer */}
        <div className="w-36 min-w-[140px] shrink-0">
          <Select
            isMulti
            options={mapOptions(options?.managers)}
            value={getMultiValue('manager')}
            onChange={onMultiChange('manager')}
            placeholder="Manager (All)"
            styles={compactSelectStyles}
            components={{ ValueContainer: CompactValueContainer }}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            isClearable={false}
          />
        </div>

        {/* Year Slicer (Salarywise tabs) */}
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

        {/* Skill Slicer (Techwise tab) */}
        {activeTab === 'techwise' && (
          <div className="w-28 min-w-[110px] shrink-0">
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
      </div>

      {/* Right Search Input & Clear Filters */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search employee / ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="bg-slate-50 dark:bg-[#12223a] border border-slate-200 dark:border-[#223755] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] pl-6 pr-6 py-1 rounded-md focus:outline-none focus:border-cyan-500 w-36 hover:border-slate-300 dark:hover:border-[#385780] leading-none transition-colors"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 px-2 py-1 rounded-md transition-colors shrink-0"
            title="Reset all active filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset ({activeFilterCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
