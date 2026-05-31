import { type ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, initialized, init } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    if (!initialized) init()
  }, [initialized, init])

  useEffect(() => {
    if (initialized && !user) nav('/sign-in', { replace: true })
  }, [initialized, user, nav])

  if (!initialized || !user) return <div className="page-loading"><div className="spinner" /></div>
  return <>{children}</>
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, initialized, init, isAdmin } = useAuth()
  const nav = useNavigate()

  useEffect(() => { if (!initialized) init() }, [initialized, init])
  useEffect(() => {
    if (initialized && !user) nav('/sign-in', { replace: true })
    else if (initialized && user && !isAdmin()) nav('/dashboard', { replace: true })
  }, [initialized, user, isAdmin, nav])

  if (!initialized || !user) return <div className="page-loading"><div className="spinner" /></div>
  return <>{children}</>
}

export function RootGuard({ children }: { children: ReactNode }) {
  const { user, initialized, init, isRoot } = useAuth()
  const nav = useNavigate()

  useEffect(() => { if (!initialized) init() }, [initialized, init])
  useEffect(() => {
    if (initialized && !user) nav('/sign-in', { replace: true })
    else if (initialized && user && !isRoot()) nav('/dashboard', { replace: true })
  }, [initialized, user, isRoot, nav])

  if (!initialized || !user) return <div className="page-loading"><div className="spinner" /></div>
  return <>{children}</>
}
