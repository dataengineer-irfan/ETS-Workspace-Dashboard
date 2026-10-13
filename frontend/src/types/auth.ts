export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ANALYTICS' | 'EXECUTIVE' | 'ADMIN';

export interface User {
  user_id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  employee_number?: number | null;
  department?: string | null;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignUpData {
  username: string;
  email: string;
  password: string;
  confirm_password?: string;
  role?: string;
}

export interface ForgotPasswordData {
  username: string;
}

export interface ResetPasswordData {
  token: string;
  new_password: string;
  confirm_password?: string;
}
