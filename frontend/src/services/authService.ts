import axios from 'axios';
import { User, AuthResponse, LoginCredentials, SignUpData, ForgotPasswordData, ResetPasswordData } from '../types/auth';

const TOKEN_KEY = 'ets_auth_token';
const USER_KEY = 'ets_auth_user';

const authApi = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach bearer token if present
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await authApi.post<AuthResponse>('/login', credentials);
    if (res.data.access_token) {
      localStorage.setItem(TOKEN_KEY, res.data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    }
    return res.data;
  },

  async signUp(data: SignUpData): Promise<User> {
    const res = await authApi.post<User>('/signup', data);
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await authApi.get<User>('/me');
    localStorage.setItem(USER_KEY, JSON.stringify(res.data));
    return res.data;
  },

  async forgotPassword(data: ForgotPasswordData): Promise<{ status: string; message: string; reset_token?: string }> {
    const res = await authApi.post<{ status: string; message: string; reset_token?: string }>('/forgot-password', data);
    return res.data;
  },

  async resetPassword(data: ResetPasswordData): Promise<{ status: string; message: string }> {
    const res = await authApi.post<{ status: string; message: string }>('/reset-password', data);
    return res.data;
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }
};

export default authService;
