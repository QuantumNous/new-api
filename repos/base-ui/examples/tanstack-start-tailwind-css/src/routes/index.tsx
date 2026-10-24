import { Link as RouterLink, createFileRoute } from '@tanstack/react-router';
import { Bell, Heart, Plus } from 'lucide-react';
import { Input } from '@/components/input';
import { Link } from '@/components/link';
import { Toggle } from '@/components/toggle';
import * as Dialog from '@/components/dialog';
import * as Menu from '@/components/menu';
import * as NavigationMenu from '@/components/navigation-menu';
import * as Popover from '@/components/popover';

export const Route = createFileRoute('/')({ component: App });

function App() {
  return (
    <div className="min-h-dvh flex justify-center items-center">
      <main className="grid grid-cols-2 gap-4">
        <div className="w-[320px]">
          <h2 className="my-1 text-lg font-bold text-balance">Base UI + TanStack Start</h2>
          <p className="text-sm">
            This is a{' '}
            <Link href="https://tanstack.com/start/latest/docs/framework/react/overview">
              TanStack Start
            </Link>{' '}
            app with <Link href="https://base-ui.com">Base UI components</Link> and{' '}
            <Link href="https://tailwindcss.com/">Tailwind CSS</Link>.
          </p>
        </div>
        <div className="w-[320px] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Popover.Root>
              <Popover.Trigger>
                <Bell className="size-4" />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="top" sideOffset={8}>
                  <Popover.Popup>
                    <Popover.Arrow />
                    <Popover.Title>Notifications</Popover.Title>
                    <Popover.Description>You are all caught up. Good job!</Popover.Description>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            <Toggle aria-label="Favorite">
              <Heart className="size-4" />
            </Toggle>

            <Dialog.Root>
              <Dialog.Trigger className="pl-2">
                <Plus className="size-4" /> New project
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Popup className="flex flex-col gap-4 items-start">
                  <Dialog.Title>Project name</Dialog.Title>
                  <Input placeholder="e.g. My Design System" defaultValue="" />
                  <Dialog.Close className="mt-1 self-end">Next</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
          <div className="flex gap-3">
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item>
                  <NavigationMenu.Link href="https://github.com/mui/base-ui" target="_blank">
                    GitHub
                  </NavigationMenu.Link>
                </NavigationMenu.Item>

                <NavigationMenu.Item>
                  <NavigationMenu.Trigger>More</NavigationMenu.Trigger>

                  <NavigationMenu.Content>
                    <ul className="flex max-w-[320px] flex-col justify-center items-stretch gap-1">
                      <li>
                        <NavigationMenu.Link
                          variant="card"
                          render={<RouterLink to="/combobox-server-fn" />}
                        >
                          <h3 className="mb-1 text-sm font-medium">Combobox Example</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            An example using TanStack Start Server Functions to load combobox items.
                          </p>
                        </NavigationMenu.Link>
                      </li>
                      <li>
                        <NavigationMenu.Link
                          variant="card"
                          href="https://base-ui.com/react/handbook/forms#tanstack-form"
                          target="_blank"
                        >
                          <h3 className="mb-1 text-sm font-medium">TanStack Form Example</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            A guide to integrating Base UI components and TanStack Form.
                          </p>
                        </NavigationMenu.Link>
                      </li>
                    </ul>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Portal>
                <NavigationMenu.Positioner
                  sideOffset={12}
                  collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
                  collisionAvoidance={{ side: 'none' }}
                >
                  <NavigationMenu.Popup>
                    <NavigationMenu.Arrow>X</NavigationMenu.Arrow>
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>

            <Menu.Root>
              <Menu.Trigger>Song</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner sideOffset={8}>
                  <Menu.Popup>
                    <Menu.Arrow />
                    <Menu.Item>Add to Library</Menu.Item>
                    <Menu.Item>Add to Playlist</Menu.Item>
                    <Menu.Separator />
                    <Menu.Item>Play Next</Menu.Item>
                    <Menu.Item>Play Last</Menu.Item>
                    <Menu.Separator />
                    <Menu.Item>Favorite</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner alignOffset={-4} sideOffset={-4}>
                          <Menu.Popup>
                            <Menu.Item>AirDrop</Menu.Item>
                            <Menu.Item>Email</Menu.Item>
                            <Menu.Item>Messages</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </div>
      </main>
    </div>
  );
}
