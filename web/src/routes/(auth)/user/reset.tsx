import { createFileRoute, useSearch } from '@tanstack/react-router'
import {
  ResetPasswordConfirm,
  type ResetPasswordSearchParams,
} from '@/features/auth/reset-password-confirm'

export const Route = createFileRoute('/(auth)/user/reset')({
  component: UserResetPassword,
})

function UserResetPassword() {
  const search = useSearch({
    from: '/(auth)/user/reset',
  }) as ResetPasswordSearchParams

  return <ResetPasswordConfirm email={search?.email} token={search?.token} />
}
