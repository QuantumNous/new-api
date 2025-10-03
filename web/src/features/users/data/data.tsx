import { Shield, User, Users } from 'lucide-react'

// ============================================================================
// User Status Configuration
// ============================================================================

export const userStatuses = {
  1: {
    label: 'Enabled',
    variant: 'success' as const,
    value: 1,
    showDot: true,
  },
  2: {
    label: 'Disabled',
    variant: 'neutral' as const,
    value: 2,
    showDot: true,
  },
} as const

export const userStatusOptions = [
  { label: 'Enabled', value: '1' },
  { label: 'Disabled', value: '2' },
]

// ============================================================================
// User Role Configuration
// ============================================================================

export const userRoles = {
  1: {
    label: 'User',
    value: 1,
    icon: User,
  },
  10: {
    label: 'Admin',
    value: 10,
    icon: Users,
  },
  100: {
    label: 'Root',
    value: 100,
    icon: Shield,
  },
} as const

export const userRoleOptions = [
  { label: 'User', value: '1', icon: User },
  { label: 'Admin', value: '10', icon: Users },
  { label: 'Root', value: '100', icon: Shield },
]

// Alias for compatibility with route file
export const roles = userRoleOptions
