import axios from 'axios';
import {
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
  CopilotResponse
} from '../types/dashboard';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  paramsSerializer: (params) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v !== undefined && v !== null && v !== '') {
            searchParams.append(key, String(v));
          }
        });
      } else {
        searchParams.append(key, String(value));
      }
    });
    return searchParams.toString();
  },
});

// Attach bearer token to all outgoing API requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ets_auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Catch 401 Unauthorized responses and redirect to /login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ets_auth_token');
      localStorage.removeItem('ets_auth_user');
      const publicPaths = ['/login', '/signup', '/forgot-password'];
      if (!publicPaths.some((p) => window.location.pathname.startsWith(p))) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const fetchFilterOptions = async (filters?: FilterParams): Promise<FilterOptions> => {
  const res = await api.get('/home/filters', { params: filters });
  return res.data;
};

export const fetchHomeKPIs = async (filters: FilterParams): Promise<HomeKPIs> => {
  const res = await api.get('/home/kpis', { params: filters });
  return res.data;
};

export const fetchStatewiseKPIs = async (filters: FilterParams): Promise<StatewiseKPIs> => {
  const res = await api.get('/statewise/kpis', { params: filters });
  return res.data;
};

export const fetchEmployeeList = async (filters?: FilterParams): Promise<EmployeeListItem[]> => {
  const res = await api.get('/employee/list', { params: filters });
  return res.data;
};

export const fetchEmployeeDetails = async (empNumber: number): Promise<EmployeeDetails> => {
  const res = await api.get(`/employee/${empNumber}`);
  return res.data;
};

export const fetchTechwiseKPIs = async (filters: FilterParams): Promise<TechwiseKPIs> => {
  const res = await api.get('/techwise/kpis', { params: filters });
  return res.data;
};

export const fetchSalarywiseKPIs = async (filters: FilterParams): Promise<SalarywiseKPIs> => {
  const res = await api.get('/salarywise/kpis', { params: filters });
  return res.data;
};

export const fetchSalarywise2KPIs = async (filters: FilterParams): Promise<Salarywise2KPIs> => {
  const res = await api.get('/salarywise2/kpis', { params: filters });
  return res.data;
};

export const fetchCalendarData = async (filters: FilterParams): Promise<CalendarData> => {
  const res = await api.get('/calendar/data', { params: filters });
  return res.data;
};

export const askCopilot = async (question: string, contextTab?: string, history?: any[], filters?: FilterParams): Promise<CopilotResponse> => {
  let userRole: string | undefined = undefined;
  let userDept: string | undefined = undefined;
  try {
    const rawUser = localStorage.getItem('ets_auth_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      userRole = u.role;
      userDept = u.department;
    }
  } catch (err) {
    console.warn('[Copilot] Could not read user context from localStorage', err);
  }
  const res = await api.post(
    '/copilot/query',
    {
      question,
      context_tab: contextTab,
      history: history || [],
      filters: filters || {},
      user_role: userRole,
      department: userDept,
    },
    { timeout: 240000 }
  );
  return res.data;
};

export const reloadDataset = async (): Promise<{ status: string; total_employees: number }> => {
  const res = await api.post('/reload');
  return res.data;
};

export interface DatasetStatus {
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  file_size_formatted: string;
  last_modified: string | null;
  source_type: 'LOCAL_EXCEL' | 'SHAREPOINT_URL' | string;
  cloud_url: string | null;
  last_synced: string | null;
  auto_sync_enabled: boolean;
  total_employees: number;
  total_skills: number;
  total_leaves: number;
  total_finance_records: number;
  backup_count: number;
  recent_backups: string[];
}

export interface DatasetValidationReport {
  valid: boolean;
  sheets_found?: string[];
  counts?: Record<string, number>;
  errors?: string[];
  warnings?: string[];
  size_bytes?: number;
}

export interface CloudUrlTestResult {
  reachable: boolean;
  status_code?: number;
  is_valid_excel_header?: boolean;
  content_type?: string;
  size_bytes_hint?: number | null;
  transformed_url?: string;
  error?: string;
  message?: string;
}

export const fetchDatasetStatus = async (): Promise<DatasetStatus> => {
  const res = await api.get('/dataset/status');
  return res.data;
};

export const downloadMasterDataset = async () => {
  const res = await api.get('/dataset/download', { responseType: 'blob' });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.download = `ETS_Dasboard_DS_export_${todayStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const validateDatasetFile = async (file: File): Promise<DatasetValidationReport> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/dataset/validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const uploadMasterDataset = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/dataset/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const testCloudUrl = async (url: string): Promise<CloudUrlTestResult> => {
  const res = await api.post('/dataset/test-url', { url });
  return res.data;
};

export const syncDatasetFromCloud = async (url: string): Promise<any> => {
  const res = await api.post('/dataset/sync-cloud', { url });
  return res.data;
};

