import { Link } from '@tanstack/react-router'
// import { Menu, X } from 'lucide-react'
// import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

// import { Button } from '../ui/button'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  const { status } = useStatus()
  const systemName = status?.system_name || 'AI Gateway'
  const version = status?.version || 'Unknown'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='gap-0 py-0 hover:bg-transparent active:bg-transparent'
          asChild
        >
          <div>
            <Link
              to='/'
              onClick={() => setOpenMobile(false)}
              className='grid flex-1 text-start text-sm leading-tight'
            >
              <span className='truncate font-bold'>{systemName}</span>
              <span className='truncate text-xs'>{version}</span>
            </Link>
            {/* <ToggleSidebar /> */}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// function ToggleSidebar({
//   className,
//   onClick,
//   ...props
// }: React.ComponentProps<typeof Button>) {
//   const { toggleSidebar } = useSidebar()

//   return (
//     <Button
//       data-sidebar='trigger'
//       data-slot='sidebar-trigger'
//       variant='ghost'
//       size='icon'
//       className={cn('aspect-square size-8 max-md:scale-125', className)}
//       onClick={(event) => {
//         onClick?.(event)
//         toggleSidebar()
//       }}
//       {...props}
//     >
//       <X className='md:hidden' />
//       <Menu className='max-md:hidden' />
//       <span className='sr-only'>Toggle Sidebar</span>
//     </Button>
//   )
// }
