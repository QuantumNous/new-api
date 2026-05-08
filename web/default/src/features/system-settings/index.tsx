import { Outlet } from '@tanstack/react-router'
import { Main } from '@/components/layout'

export function SystemSettings() {
  return (
    <Main>
      <div className='min-h-0 flex-1 px-4 pt-6 pb-4'>
        <Outlet />
      </div>
    </Main>
  )
}
