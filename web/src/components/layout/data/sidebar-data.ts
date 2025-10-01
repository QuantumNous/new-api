import {
  LayoutDashboard,
  Key,
  FileText,
  Wallet,
  Box,
  Server,
  Users,
  Ticket,
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'API Key',
          url: '/api-key',
          icon: Key,
        },
        {
          title: 'Logs',
          url: '/logs',
          icon: FileText,
        },
        {
          title: 'Wallet',
          url: '/wallet',
          icon: Wallet,
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          title: 'Models',
          url: '/models',
          icon: Box,
        },
        {
          title: 'Providers',
          url: '/providers',
          icon: Server,
        },
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Redemption Codes',
          url: '/redemption-codes',
          icon: Ticket,
        },
      ],
    },
  ],
}
