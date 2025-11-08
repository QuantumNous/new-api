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
    <div className='relative grid h-svh max-w-none'>
      <Link
        to='/'
        className='absolute top-4 left-4 z-10 flex items-center gap-2 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
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
      <div className='container flex items-center pt-16 sm:pt-0'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'>
          {children}
        </div>
      </div>
    </div>
  )
}
