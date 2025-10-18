import { Outlet } from '@tanstack/react-router'
import { Main } from '@/components/layout'
import { AppHeader } from '@/components/layout/components/app-header'

export function SystemSettings() {
  return (
    <>
      <AppHeader fixed />

      <Main>
        <Outlet />
      </Main>
    </>
  )
}
