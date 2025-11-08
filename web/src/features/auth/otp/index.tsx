import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { OtpForm } from './components/otp-form'

export function Otp() {
  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-3'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            Two-factor Authentication
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            Please enter the authentication code. We have sent the
            authentication code to your email.
          </p>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            Session expired?{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary font-medium underline underline-offset-4'
            >
              Re-login
            </Link>
            .
          </p>
        </div>

        <OtpForm />
      </div>
    </AuthLayout>
  )
}
