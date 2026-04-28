import { Outlet } from '@tanstack/react-router'
import { Main } from '@/components/layout'
import { AppHeader } from '@/components/layout/components/app-header'

export function SystemSettings() {
  return (
    <>
      <AppHeader />

      <Main>
        <div className='min-h-0 flex-1 px-4 pt-6 pb-4'>
          <Outlet />
        </div>
      </Main>
    </>
  )
}
