import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { getStatus } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const [status, setStatus] = useState<any>(null)

  if (!status) {
    getStatus()
      .then((s) => setStatus(s))
      .catch(() => {})
  }

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            Enter your username or email and password below to <br />
            log into your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter className='flex flex-col gap-4'>
          {!status?.self_use_mode_enabled && (
            <p className='text-muted-foreground text-center text-sm'>
              Don't have an account?{' '}
              <Link
                to='/sign-up'
                className='hover:text-primary font-medium underline underline-offset-4'
              >
                Sign up
              </Link>
            </p>
          )}
          <p className='text-muted-foreground px-8 text-center text-xs'>
            By clicking sign in, you agree to our{' '}
            <a
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
