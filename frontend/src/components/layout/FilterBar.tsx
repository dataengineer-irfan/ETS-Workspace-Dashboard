import React from 'react';
import Select from 'react-select';
import type { FilterParams, FilterOptions } from '../../types/dashboard';
import { Filter, RotateCcw, Search } from 'lucide-react';

interface FilterBarProps {
  filters: FilterParams;
  setFilters: React.Dispatch<React.SetStateAction<FilterParams>>;
  options: FilterOptions | null;
  activeTab: string;
}

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

  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="h-9 bg-white border-b border-slate-200 px-3 flex items-center justify-between gap-2 shrink-0 select-none text-xs">
      {/* Left Slicer Controls */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5">
        <div className="flex items-center gap-1 text-slate-500 shrink-0 font-medium">
          <Filter className="w-3.5 h-3.5 text-cyan-600" />
          <span className="text-[11px] font-semibold text-slate-700">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-cyan-600 text-white font-bold text-[9px] flex items-center justify-center font-mono">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Project Slicer */}
        <div className="min-w-[160px]">
          <Select
            isMulti
            options={mapOptions(options?.projects)}
            value={getMultiValue('project')}
            onChange={onMultiChange('project')}
            placeholder="Project (All)"
            classNamePrefix="react-select"
          />
        </div>

        {/* Reporting Manager Slicer */}
        <div className="min-w-[160px] max-w-[150px]">
          <Select
            isMulti
            options={mapOptions(options?.managers)}
            value={getMultiValue('manager')}
            onChange={onMultiChange('manager')}
            placeholder="Manager (All)"
            classNamePrefix="react-select"
          />
        </div>

        {/* Department Slicer */}
        <div className="min-w-[140px]">
          <Select
            isMulti
            options={mapOptions(options?.departments)}
            value={getMultiValue('department')}
            onChange={onMultiChange('department')}
            placeholder="Department (All)"
            classNamePrefix="react-select"
          />
        </div>

        {/* Job Level / Grade Slicer */}
        <div className="min-w-[140px]">
          <Select
            isMulti
            options={mapOptions(options?.job_levels)}
            value={getMultiValue('job_level')}
            onChange={onMultiChange('job_level')}
            placeholder="Grade (All)"
            classNamePrefix="react-select"
          />
        </div>

        {/* Location Slicer */}
        <div className="min-w-[140px]">
          <Select
            isMulti
            options={mapOptions(options?.locations)}
            value={getMultiValue('location')}
            onChange={onMultiChange('location')}
            placeholder="Location (All)"
            classNamePrefix="react-select"
          />
        </div>

        {/* Year Slicer */}
        {(activeTab === 'salarywise' || activeTab === 'salarywise2') && (
          <div className="min-w-[120px]">
            <Select
              options={mapOptions(options?.years?.map(String))}
              value={getMultiValue('year')}
              onChange={(s: any) => handleChange('year', s ? Number(s.value) : undefined)}
              placeholder="Year (All)"
              classNamePrefix="react-select"
            />
          </div>
        )}

        {/* Skill Slicer */}
        {activeTab === 'techwise' && (
          <div className="min-w-[160px]">
            <Select
              options={mapOptions(options?.skills)}
              value={getMultiValue('skill_name')}
              onChange={(s: any) => handleChange('skill_name', s ? s.value : undefined)}
              placeholder="Skill (All)"
              classNamePrefix="react-select"
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
            className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-[11px] pl-6 pr-2 py-1 rounded-md focus:outline-none focus:border-cyan-500 w-40 hover:border-slate-300 leading-none"
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[10px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.8 rounded-md transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};
