import { Link } from '@tanstack/react-router'
import { useStatus } from '@/hooks/use-status'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

type AppTitleProps = {
  defaultName?: string
  defaultVersion?: string
  logo: React.ElementType
}

export function AppTitle({
  defaultName = 'AI Gateway',
  defaultVersion = 'Unknown',
  logo: Logo,
}: AppTitleProps) {
  const { setOpenMobile } = useSidebar()
  const { status } = useStatus()

  const systemName = status?.system_name || defaultName
  const version = status?.version || defaultVersion

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          asChild
        >
          <Link to='/' onClick={() => setOpenMobile(false)}>
            <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
              <Logo className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>{systemName}</span>
              <span className='truncate text-xs'>{version}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
