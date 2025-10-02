import {
  Shield,
  UserCheck,
  Users,
  CreditCard,
  CircleCheck,
  CircleSlash,
  Mail,
  Ban,
} from 'lucide-react'
import { type StatusBadgeProps } from '@/components/status-badge'
import { type UserStatus } from './schema'

// 旧的样式映射（保留用于兼容性）
export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
  [
    'suspended',
    'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  ],
])

// 新的状态配置，支持图标和更多属性
export const userStatuses: Record<
  UserStatus,
  Pick<StatusBadgeProps, 'variant' | 'icon' | 'showDot'>
> = {
  active: {
    variant: 'success',
    icon: CircleCheck,
    showDot: true,
  },
  inactive: {
    variant: 'neutral',
    icon: CircleSlash,
    showDot: true,
  },
  invited: {
    variant: 'info',
    icon: Mail,
    showDot: true,
  },
  suspended: {
    variant: 'danger',
    icon: Ban,
    showDot: true,
  },
}

export const roles = [
  {
    label: 'Superadmin',
    value: 'superadmin',
    icon: Shield,
  },
  {
    label: 'Admin',
    value: 'admin',
    icon: UserCheck,
  },
  {
    label: 'Manager',
    value: 'manager',
    icon: Users,
  },
  {
    label: 'Cashier',
    value: 'cashier',
    icon: CreditCard,
  },
] as const
