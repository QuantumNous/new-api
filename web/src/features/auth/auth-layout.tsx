import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { systemName, logo, loading } = useSystemConfig()

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
            <img
              src={logo}
              alt='Logo'
              className='h-8 w-8 rounded-full object-cover'
            />
            <h1 className='text-xl font-medium'>{systemName}</h1>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
