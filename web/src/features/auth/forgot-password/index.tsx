import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-3'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            Forgot password
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            Enter your registered email and we will send you a link to reset
            your password.
          </p>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            Don't have an account?{' '}
            <Link
              to='/sign-up'
              className='hover:text-primary font-medium underline underline-offset-4'
            >
              Sign up
            </Link>
            .
          </p>
        </div>

        <ForgotPasswordForm className='space-y-0' />
      </div>
    </AuthLayout>
  )
}
