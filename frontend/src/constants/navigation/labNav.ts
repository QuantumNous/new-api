/**
 * Single source of truth for the Alchemy Lab sidebar navigation.
 * Consumed by LabSidebar (desktop rail) and the topbar dropdown / mobile strip.
 */

export interface LabNavItem {
  name: string
  labelKey: string
  route: string
  icon: string // lucide 24x24 path
}

export const labNavItems: LabNavItem[] = [
  {
    name: 'lab-chat',
    labelKey: 'lab.nav.chat',
    route: 'lab-chat',
    icon: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  },
  {
    name: 'lab-studio',
    labelKey: 'lab.nav.studio',
    route: 'lab-studio',
    // sparkles — image + video creation
    icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 3v4M21 5h-4',
  },
  {
    name: 'lab-assets',
    labelKey: 'lab.nav.assets',
    route: 'lab-assets',
    icon: 'M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  },
  {
    name: 'lab-notes',
    labelKey: 'lab.nav.notes',
    route: 'lab-notes',
    icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2ZM9 13h6M9 17h4',
  },
  {
    name: 'lab-plugins',
    labelKey: 'lab.nav.plugins',
    route: 'lab-plugins',
    // puzzle-piece icon
    icon: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 3.5V8h4.5M9 13h6M9 17h3',
  },
]

/** Route names that belong to the lab section (topbar "炼金室" pill stays lit). */
export const labRouteNames: Set<string> = new Set([
  ...labNavItems.map((i) => i.route),
  'lab-chat-session',
])

/** Landing route when the topbar "炼金室" group or mobile strip is clicked. */
export const labEntryRoute = 'lab-chat'
