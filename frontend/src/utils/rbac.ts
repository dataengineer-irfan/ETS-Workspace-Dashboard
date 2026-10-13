import { UserRole } from '../types/auth';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  HR_ANALYTICS: 3,
  EXECUTIVE: 4,
  ADMIN: 5,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Delivery Manager',
  HR_ANALYTICS: 'HR Analytics',
  EXECUTIVE: 'Executive Leadership',
  ADMIN: 'System Admin',
};

// Tabs allowed by role
export const TAB_PERMISSIONS: Record<string, UserRole[]> = {
  home: ['EMPLOYEE', 'MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  techwise: ['EMPLOYEE', 'MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  statewise: ['EMPLOYEE', 'MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  calendar: ['EMPLOYEE', 'MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  employee_details: ['EMPLOYEE', 'MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  salarywise: ['MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  salarywise2: ['MANAGER', 'HR_ANALYTICS', 'EXECUTIVE', 'ADMIN'],
  reload: ['HR_ANALYTICS', 'ADMIN'],
};

export function canAccessTab(role: string | undefined | null, tabId: string): boolean {
  if (!role) return false;
  const userRole = role.toUpperCase() as UserRole;
  const allowed = TAB_PERMISSIONS[tabId];
  if (!allowed) return true;
  return allowed.includes(userRole);
}

export function formatRole(role: string | undefined | null): string {
  if (!role) return 'Employee';
  const r = role.toUpperCase() as UserRole;
  return ROLE_LABELS[r] || role;
}

export function getRoleBadgeStyle(role: string | undefined | null): {
  bg: string;
  text: string;
  border: string;
  glow: string;
} {
  const r = (role || 'EMPLOYEE').toUpperCase();
  switch (r) {
    case 'ADMIN':
      return {
        bg: 'bg-rose-500/15 dark:bg-rose-500/20',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-300 dark:border-rose-800',
        glow: 'shadow-rose-500/20',
      };
    case 'EXECUTIVE':
      return {
        bg: 'bg-amber-500/15 dark:bg-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-300 dark:border-amber-800',
        glow: 'shadow-amber-500/20',
      };
    case 'HR_ANALYTICS':
      return {
        bg: 'bg-purple-500/15 dark:bg-purple-500/20',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-300 dark:border-purple-800',
        glow: 'shadow-purple-500/20',
      };
    case 'MANAGER':
      return {
        bg: 'bg-cyan-500/15 dark:bg-cyan-500/20',
        text: 'text-cyan-700 dark:text-cyan-300',
        border: 'border-cyan-300 dark:border-cyan-800',
        glow: 'shadow-cyan-500/20',
      };
    case 'EMPLOYEE':
    default:
      return {
        bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-800',
        glow: 'shadow-emerald-500/20',
      };
  }
}
