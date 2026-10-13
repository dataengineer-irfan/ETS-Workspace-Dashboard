import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginCredentials, SignUpData, ForgotPasswordData, ResetPasswordData } from '../types/auth';
import authService from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  logout: () => void;
  forgotPassword: (data: ForgotPasswordData) => Promise<{ status: string; message: string; reset_token?: string }>;
  resetPassword: (data: ResetPasswordData) => Promise<{ status: string; message: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authService.getUser());
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const savedToken = authService.getToken();
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      setToken(savedToken);
    } catch (err) {
      console.warn('[Auth] Session validation failed:', err);
      authService.logout();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const res = await authService.login(credentials);
      setUser(res.user);
      setToken(res.access_token);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: SignUpData) => {
    setIsLoading(true);
    try {
      await authService.signUp(data);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const forgotPassword = async (data: ForgotPasswordData) => {
    return await authService.forgotPassword(data);
  };

  const resetPassword = async (data: ResetPasswordData) => {
    return await authService.resetPassword(data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        signUp,
        logout,
        forgotPassword,
        resetPassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
