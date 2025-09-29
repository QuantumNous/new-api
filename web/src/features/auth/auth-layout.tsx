import { Logo } from '@/assets/logo'
import { useStatus } from '@/hooks/use-status'
import { Skeleton } from '@/components/ui/skeleton'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { status, loading } = useStatus()
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
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
        {children}
      </div>
    </div>
  )
}
