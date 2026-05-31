import { Outlet } from 'react-router'
import { PublicNav } from './public-nav'
import { Footer } from './footer'

export function PublicLayout() {
  return (
    <>
      <PublicNav />
      <Outlet />
      <Footer />
    </>
  )
}
