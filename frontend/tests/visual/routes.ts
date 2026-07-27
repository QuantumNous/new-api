export interface VisualRoute {
  name: string
  path: string
  guestOnly?: boolean
}

export const VISUAL_ROUTES: VisualRoute[] = [
  { name: 'home', path: '/' },
  { name: 'sign-in', path: '/auth/sign-in', guestOnly: true },
  { name: 'sign-up', path: '/auth/sign-up', guestOnly: true },
  { name: 'reset', path: '/auth/reset', guestOnly: true },
  { name: 'not-found', path: '/visual-regression-not-found' },
  { name: 'dashboard', path: '/console/dashboard' },
  { name: 'activity', path: '/console/activity' },
  { name: 'models', path: '/console/models' },
  { name: 'market', path: '/console/market' },
  { name: 'keys', path: '/console/keys' },
  { name: 'logs', path: '/console/logs' },
  { name: 'channels', path: '/console/channels' },
  { name: 'users', path: '/console/users' },
  { name: 'redemption', path: '/console/redemption' },
  { name: 'orders', path: '/console/orders' },
  { name: 'tickets', path: '/console/tickets' },
  { name: 'ticket-detail', path: '/console/tickets/1' },
  { name: 'wallet', path: '/console/wallet' },
  { name: 'invite', path: '/console/invite' },
  { name: 'invoice', path: '/console/invoice' },
  { name: 'settings', path: '/console/settings' },
  { name: 'profile', path: '/console/profile' },
  { name: 'farm', path: '/console/farm' },
  { name: 'bigame', path: '/console/bigame' },
  { name: 'lab-chat', path: '/lab/chat' },
  { name: 'lab-chat-session', path: '/lab/chat/c-1' },
  { name: 'lab-studio', path: '/lab/studio' },
  { name: 'lab-assets', path: '/lab/assets' },
  { name: 'lab-notes', path: '/lab/notes' },
  { name: 'lab-plugins', path: '/lab/plugins' },
]
