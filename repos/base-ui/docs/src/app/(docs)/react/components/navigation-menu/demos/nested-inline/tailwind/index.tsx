'use client';
import * as React from 'react';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { useMediaQuery } from '@base-ui/react/unstable-use-media-query';
import { audienceMenus, guideLinks, guidesPanel } from '../data';

export default function ExampleNavigationMenu() {
  const isDesktop = useMediaQuery('(min-width: 700px)', { defaultMatches: true });

  return (
    <NavigationMenu.Root className="min-w-max text-neutral-950 dark:text-white">
      <NavigationMenu.List className="relative flex gap-px">
        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={triggerClassName}>
            Product
            <NavigationMenu.Icon className="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180">
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>

          <NavigationMenu.Content className={productContentClassName}>
            <NavigationMenu.Root
              className="overflow-hidden overflow-clip text-neutral-950 dark:text-white"
              orientation={isDesktop ? 'vertical' : 'horizontal'}
              defaultValue="developers"
            >
              <div className="grid grid-cols-1 overflow-hidden overflow-clip min-[700px]:grid-cols-[13rem_minmax(0,1fr)]">
                <NavigationMenu.List className="m-0 flex list-none flex-row gap-1 overflow-x-auto p-2 min-[700px]:h-[var(--popup-height)] min-[700px]:flex-col min-[700px]:gap-px min-[700px]:overflow-x-visible min-[700px]:overflow-y-clip min-[700px]:border-r min-[700px]:border-r-neutral-950 min-[700px]:transition-[height] min-[700px]:duration-[var(--duration)] min-[700px]:ease-[var(--easing)] dark:min-[700px]:border-r-white">
                  {audienceMenus.map((menu) => (
                    <NavigationMenu.Item key={menu.value} value={menu.value}>
                      <NavigationMenu.Trigger className={submenuTriggerClassName}>
                        <span className="text-sm leading-4 font-normal text-neutral-950 dark:text-white">
                          {menu.label}
                        </span>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          {menu.hint}
                        </span>
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content className={submenuContentClassName}>
                        <div>
                          <h4 className="m-0 text-base leading-5 font-normal">{menu.title}</h4>
                          <p className="m-0 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                            {menu.description}
                          </p>
                        </div>
                        <ul className="-mx-2 m-0 flex list-none flex-col gap-0 p-0">
                          {menu.links.map((link) => (
                            <li key={link.href}>
                              <Link className={linkCardClassName} href={link.href}>
                                <h5 className="m-0 text-sm leading-4 font-normal">{link.title}</h5>
                                <p className="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                                  {link.description}
                                </p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  ))}
                </NavigationMenu.List>
                <NavigationMenu.Viewport className="relative min-h-[16.5rem] overflow-hidden border-t border-neutral-950 min-[700px]:border-t-0 dark:border-white" />
              </div>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={triggerClassName}>
            Learn
            <NavigationMenu.Icon className="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180">
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>

          <NavigationMenu.Content className={guidesContentClassName}>
            <div className="flex flex-col gap-4 p-4 text-neutral-950 dark:text-white">
              <div>
                <h4 className="m-0 text-base leading-5 font-normal">{guidesPanel.title}</h4>
                <p className="m-0 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {guidesPanel.description}
                </p>
              </div>
              <ul className="-mx-2 m-0 flex list-none flex-col gap-0 p-0">
                {guideLinks.map((link) => (
                  <li key={link.href}>
                    <Link className={linkCardClassName} href={link.href}>
                      <h5 className="m-0 text-sm leading-4 font-normal">{link.title}</h5>
                      <p className="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                        {link.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <Link className={triggerClassName} href="/react/overview/releases">
            Releases
          </Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <Link className={triggerClassName} href="https://github.com/mui/base-ui">
            GitHub
          </Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          sideOffset={10}
          collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
          collisionAvoidance={{ side: 'none' }}
          className="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:content-[''] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5"
          style={{
            ['--duration' as string]: '0.35s',
            ['--easing' as string]: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <NavigationMenu.Popup className="relative h-[var(--popup-height)] w-[var(--popup-width)] origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[opacity,transform,width,height,scale] duration-[var(--duration)] ease-[var(--easing)] data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-[ease] data-ending-style:transition-[opacity,scale] data-starting-style:scale-90 data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <NavigationMenu.Arrow className="relative block h-1.5 w-3 overflow-clip transition-[left,right] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:bottom-0 before:left-1/2 before:block before:h-[calc(6px*sqrt(2))] before:w-[calc(6px*sqrt(2))] before:-translate-x-1/2 before:translate-y-1/2 before:rotate-45 before:border before:border-neutral-950 before:bg-white before:content-[''] data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 dark:before:border-white dark:before:bg-neutral-950" />
            <NavigationMenu.Viewport className="relative h-full w-full overflow-hidden" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function Link(props: NavigationMenu.Link.Props) {
  return (
    <NavigationMenu.Link
      render={
        // Use the `render` prop to render your framework's Link component
        // for client-side routing.
        // e.g. `<NextLink href={props.href} />` instead of `<a />`.
        <a />
      }
      {...props}
    />
  );
}

function CaretDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}

const triggerClassName =
  'flex h-8 items-center justify-center gap-1.5 bg-transparent px-2 text-sm font-normal text-neutral-950 no-underline select-none min-[501px]:px-3 hover:bg-neutral-100 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:text-white dark:hover:bg-neutral-800 dark:data-popup-open:bg-neutral-800';

const sharedContentClassName =
  'h-full w-[calc(100vw_-_40px)] ' +
  'transition-[opacity,translate] duration-[calc(var(--duration)*0.5),var(--duration)] ease-[ease,cubic-bezier(0.4,0,0.2,1)] ' +
  'data-starting-style:data-[activation-direction=left]:opacity-0 data-starting-style:data-[activation-direction=right]:opacity-0 data-ending-style:opacity-0 ' +
  'data-ending-style:duration-[calc(var(--duration)*0.5)] data-ending-style:ease-[ease] ' +
  'data-starting-style:data-[activation-direction=left]:translate-x-[-2rem] ' +
  'data-starting-style:data-[activation-direction=right]:translate-x-[2rem] ' +
  'data-ending-style:data-[activation-direction=left]:translate-x-[2rem] ' +
  'data-ending-style:data-[activation-direction=right]:translate-x-[-2rem]';

const productContentClassName = `${sharedContentClassName} p-0 min-[700px]:[width:min(675px,calc(100vw-40px))]`;

const guidesContentClassName = `${sharedContentClassName} p-0 min-[700px]:[width:min(500px,calc(100vw-40px))]`;

const submenuTriggerClassName =
  'm-0 flex w-full min-w-[10rem] flex-col items-start gap-1 border-0 bg-transparent p-2 text-left text-inherit hover:bg-neutral-100 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:hover:bg-neutral-800 dark:data-popup-open:bg-neutral-800';

const submenuContentClassName =
  'flex h-full translate-x-0 flex-col gap-4 p-4 min-[700px]:blur-0 transition-[opacity,translate,filter] duration-[var(--duration)] ease-[var(--easing)] min-[700px]:duration-[calc(var(--duration)*1.35)] min-[700px]:ease-[cubic-bezier(0.16,1,0.3,1)] ' +
  'data-starting-style:data-[activation-direction=left]:opacity-0 data-starting-style:data-[activation-direction=right]:opacity-0 data-starting-style:data-[activation-direction=left]:translate-x-[-50%] data-starting-style:data-[activation-direction=right]:translate-x-[50%] ' +
  'data-ending-style:opacity-0 data-ending-style:data-[activation-direction=left]:translate-x-[50%] data-ending-style:data-[activation-direction=right]:translate-x-[-50%] ' +
  'min-[700px]:data-starting-style:data-[activation-direction=up]:opacity-0 min-[700px]:data-starting-style:data-[activation-direction=down]:opacity-0 min-[700px]:data-starting-style:data-[activation-direction=up]:translate-y-[-72px] min-[700px]:data-starting-style:data-[activation-direction=down]:translate-y-[72px] min-[700px]:data-starting-style:blur-[2px] ' +
  'min-[700px]:data-ending-style:data-[activation-direction=up]:translate-y-[72px] min-[700px]:data-ending-style:data-[activation-direction=down]:translate-y-[-72px] min-[700px]:data-ending-style:blur-[2px]';

const linkCardClassName =
  'relative block h-full w-full border-0 bg-transparent p-2 text-left text-inherit no-underline hover:bg-neutral-100 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:hover:bg-neutral-800 dark:data-popup-open:bg-neutral-800';
