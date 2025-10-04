import { Logo } from '@/assets/logo'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { Skeleton } from '@/components/ui/skeleton'
import { TermsFooter } from '../components/terms-footer'
import dashboardDark from './assets/dashboard-dark.png'
import dashboardLight from './assets/dashboard-light.png'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn2() {
  const { status, loading } = useStatus()
  return (
    <div className='relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
          {loading ? (
            <div className='mb-4 flex items-center justify-center gap-2'>
              <Skeleton className='h-8 w-8 rounded-full' />
              <Skeleton className='h-6 w-30' />
            </div>
          ) : (
            <div className='mb-4 flex items-center justify-center gap-2'>
              {status?.logo ? (
                <img
                  src={status.logo}
                  alt='Logo'
                  className='h-8 w-8 rounded-full object-cover'
                />
              ) : (
                <Logo className='me-2' />
              )}
              <h1 className='text-xl font-medium'>{status?.system_name}</h1>
            </div>
          )}
        </div>
        <div className='mx-auto flex w-full max-w-sm flex-col justify-center space-y-2'>
          <div className='flex flex-col space-y-2 text-start'>
            <h2 className='text-lg font-semibold tracking-tight'>Sign in</h2>
            <p className='text-muted-foreground text-sm'>
              Enter your username or email and password below <br />
              to log into your account
            </p>
          </div>
          <UserAuthForm />
          <TermsFooter variant='sign-in' />
        </div>
      </div>

      <div
        className={cn(
          'bg-muted relative h-full overflow-hidden max-lg:hidden',
          '[&>img]:absolute [&>img]:top-[15%] [&>img]:left-20 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:object-top-left [&>img]:select-none'
        )}
      >
        <img
          src={dashboardLight}
          className='dark:hidden'
          width={1024}
          height={1151}
          alt='Shadcn-Admin'
        />
        <img
          src={dashboardDark}
          className='hidden dark:block'
          width={1024}
          height={1138}
          alt='Shadcn-Admin'
        />
      </div>
    </div>
  )
}
