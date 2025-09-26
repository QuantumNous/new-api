import {
  Construction,
  LayoutDashboard,
  Monitor,
  Bug,
  ListTodo,
  FileX,
  HelpCircle,
  Lock,
  Bell,
  Package,
  Palette,
  ServerOff,
  Settings,
  Wrench,
  UserCog,
  UserX,
  Users,
  MessagesSquare,
  ShieldCheck,
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
} from 'lucide-react'
import { ClerkLogo } from '@/assets/clerk-logo'
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
      title: 'sidebar.general',
      items: [
        {
          title: 'sidebar.dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'sidebar.tasks',
          url: '/tasks',
          icon: ListTodo,
        },
        {
          title: 'sidebar.apps',
          url: '/apps',
          icon: Package,
        },
        {
          title: 'sidebar.chats',
          url: '/chats',
          badge: '3',
          icon: MessagesSquare,
        },
        {
          title: 'sidebar.users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'sidebar.secured_by_clerk',
          icon: ClerkLogo,
          items: [
            {
              title: 'sidebar.sign_in',
              url: '/clerk/sign-in',
            },
            {
              title: 'sidebar.sign_up',
              url: '/clerk/sign-up',
            },
            {
              title: 'sidebar.user_management',
              url: '/clerk/user-management',
            },
          ],
        },
      ],
    },
    {
      title: 'sidebar.pages',
      items: [
        {
          title: 'sidebar.auth',
          icon: ShieldCheck,
          items: [
            {
              title: 'sidebar.sign_in',
              url: '/sign-in',
            },
            {
              title: 'sidebar.sign_in_2col',
              url: '/sign-in-2',
            },
            {
              title: 'sidebar.sign_up',
              url: '/sign-up',
            },
            {
              title: 'sidebar.forgot_password',
              url: '/forgot-password',
            },
            {
              title: 'sidebar.otp',
              url: '/otp',
            },
          ],
        },
        {
          title: 'sidebar.errors',
          icon: Bug,
          items: [
            {
              title: 'sidebar.unauthorized',
              url: '/errors/unauthorized',
              icon: Lock,
            },
            {
              title: 'sidebar.forbidden',
              url: '/errors/forbidden',
              icon: UserX,
            },
            {
              title: 'sidebar.not_found',
              url: '/errors/not-found',
              icon: FileX,
            },
            {
              title: 'sidebar.internal_server_error',
              url: '/errors/internal-server-error',
              icon: ServerOff,
            },
            {
              title: 'sidebar.maintenance_error',
              url: '/errors/maintenance-error',
              icon: Construction,
            },
          ],
        },
      ],
    },
    {
      title: 'sidebar.other',
      items: [
        {
          title: 'sidebar.settings',
          icon: Settings,
          items: [
            {
              title: 'sidebar.profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'sidebar.account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'sidebar.appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'sidebar.notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'sidebar.display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'sidebar.help_center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
