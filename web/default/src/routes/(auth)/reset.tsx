import { createFileRoute, useSearch } from '@tanstack/react-router'
import {
  ResetPasswordConfirm,
  type ResetPasswordSearchParams,
} from '@/features/auth/reset-password-confirm'

export const Route = createFileRoute('/(auth)/reset')({
  component: ResetPassword,
})

function ResetPassword() {
  const search = useSearch({
    from: '/(auth)/reset',
  }) as ResetPasswordSearchParams
  return <ResetPasswordConfirm email={search?.email} token={search?.token} />
}
