import { Link } from '@tanstack/react-router'
import { SKELETON_DEFAULTS } from '@/lib/constants'
import { useSystemConfig } from '@/hooks/use-system-config'
import { SkeletonWrapper } from '@/components/skeleton-wrapper'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='container grid h-svh max-w-none items-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'>
        <Link
          to='/'
          className='mb-4 flex items-center justify-center gap-2 transition-opacity hover:opacity-80'
        >
          <div className='relative h-8 w-8'>
            <SkeletonWrapper loading={loading} type='image' />
            <img
              src={logo}
              alt='Logo'
              className='h-8 w-8 rounded-full object-cover'
            />
          </div>
          <SkeletonWrapper
            loading={loading}
            type='title'
            width={SKELETON_DEFAULTS.TITLE_WIDTH}
          >
            <h1 className='text-xl font-medium'>{systemName}</h1>
          </SkeletonWrapper>
        </Link>
        {children}
      </div>
    </div>
  )
}
