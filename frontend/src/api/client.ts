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

export const fetchFilterOptions = async (): Promise<FilterOptions> => {
  const res = await api.get('/home/filters');
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

export const askCopilot = async (question: string, contextTab?: string): Promise<CopilotResponse> => {
  const res = await api.post('/copilot/query', { question, context_tab: contextTab });
  return res.data;
};
