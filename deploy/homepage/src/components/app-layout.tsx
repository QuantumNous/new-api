import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import {
  LayoutDashboard, Key, Wallet, FileText, User, MessageSquare,
  Server, Users, Cpu, Gift, CreditCard, Settings, LogOut, Menu, X, ChevronDown, Languages, BookOpen,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../i18n'

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/keys', icon: Key, labelKey: 'nav.keys' },
  { path: '/playground', icon: MessageSquare, labelKey: 'nav.playground' },
  { path: '/wallet', icon: Wallet, labelKey: 'nav.wallet' },
  { path: '/usage-logs', icon: FileText, labelKey: 'nav.usageLogs' },
  { path: '/subscriptions', icon: CreditCard, labelKey: 'nav.subscriptions' },
  { path: '/profile', icon: User, labelKey: 'nav.profile' },
]

const ADMIN_ITEMS = [
  { path: '/channels', icon: Server, labelKey: 'nav.channels' },
  { path: '/users', icon: Users, labelKey: 'nav.users' },
  { path: '/models', icon: Cpu, labelKey: 'nav.models' },
  { path: '/redemption-codes', icon: Gift, labelKey: 'nav.redemptions' },
]

const ROOT_ITEMS = [
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const { user, logout, isAdmin, isRoot } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const { t, toggle, label } = useI18n()

  const isActive = (path: string) => loc.pathname === path || loc.pathname.startsWith(path + '/')

  const handleLogout = async () => {
    await logout()
    nav('/sign-in')
  }

  const showAdmin = isAdmin()
  const showRoot = isRoot()

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark-sm">V</span>
          <span className="sidebar-title">Vynex API</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">{t('nav.userSection')}</div>
          {NAV_ITEMS.map(item => (
            <a key={item.path} href={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); nav(item.path); setSidebarOpen(false) }}>
              <item.icon size={16} />
              <span>{t(item.labelKey)}</span>
            </a>
          ))}

          {showAdmin && <>
            <div className="nav-section" onClick={() => setAdminOpen(!adminOpen)} style={{ cursor: 'pointer' }}>
              {t('nav.adminSection')} <ChevronDown size={12} className={adminOpen ? 'rotate' : ''} />
            </div>
            {(adminOpen || showAdmin) && ADMIN_ITEMS.map(item => (
              <a key={item.path} href={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); nav(item.path); setSidebarOpen(false) }}>
                <item.icon size={16} />
                <span>{t(item.labelKey)}</span>
              </a>
            ))}
          </>}

          {showRoot && <>
            <div className="nav-section">{t('nav.rootSection')}</div>
            {ROOT_ITEMS.map(item => (
              <a key={item.path} href={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); nav(item.path); setSidebarOpen(false) }}>
                <item.icon size={16} />
                <span>{t(item.labelKey)}</span>
              </a>
            ))}
          </>}
        </nav>

        <div className="sidebar-footer">
          <a href="/docs/" className="nav-item"><BookOpen size={16} /><span>{t('nav.docs')}</span></a>
          <button onClick={handleLogout} className="nav-item logout">
            <LogOut size={16} /><span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="top-bar">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="top-bar-spacer" />
          <button onClick={toggle} className="btn-ghost-sm">
            <Languages size={14} /> {label}
          </button>
          <div className="top-bar-user">
            <span className="user-name">{user?.display_name || user?.username}</span>
            <span className="user-role-badge">{user?.role === 100 ? 'ROOT' : user?.role === 10 ? 'ADMIN' : 'USER'}</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
