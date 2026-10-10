import * as React from 'react';
import { NavigationMenu } from '@base-ui/react/navigation-menu';

export default function ExampleNavigationMenu() {
  return (
    <NavigationMenu.Root className="min-w-max text-neutral-950 dark:text-white">
      <NavigationMenu.List className="relative flex gap-px">
        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={triggerClassName}>
            Overview
            <NavigationMenu.Icon className="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180">
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>

          <NavigationMenu.Content className={contentClassName}>
            <ul className="m-0 grid list-none grid-cols-2 p-0 max-[500px]:grid-cols-1">
              {overviewLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkCardClassName}>
                    <h3 className="m-0 mb-1 text-sm leading-4 font-normal">{item.title}</h3>
                    <p className="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={triggerClassName}>
            Handbook
            <NavigationMenu.Icon className="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180">
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>

          <NavigationMenu.Content className={contentClassName}>
            <ul className="m-0 flex max-w-[400px] list-none flex-col justify-center p-0">
              {handbookLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkCardClassName}>
                    <h3 className="m-0 mb-1 text-sm leading-4 font-normal">{item.title}</h3>
                    <p className="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </NavigationMenu.Content>
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
          <NavigationMenu.Popup className="relative h-[var(--popup-height)] w-[var(--popup-width)] origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[opacity,transform,width,height,scale] duration-[var(--duration)] ease-[var(--easing)] data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-[ease] data-starting-style:scale-90 data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
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

const contentClassName =
  'h-full w-[calc(100vw-40px)] p-2 min-[500px]:w-max min-[500px]:max-w-[400px] ' +
  'transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] ' +
  'data-starting-style:opacity-0 data-ending-style:opacity-0 ' +
  'data-starting-style:data-[activation-direction=left]:translate-x-[-50%] ' +
  'data-starting-style:data-[activation-direction=right]:translate-x-[50%] ' +
  'data-ending-style:data-[activation-direction=left]:translate-x-[50%] ' +
  'data-ending-style:data-[activation-direction=right]:translate-x-[-50%]';

const linkCardClassName =
  'relative block h-full w-full border-0 bg-transparent p-2 text-left text-inherit no-underline hover:bg-neutral-100 data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:hover:bg-neutral-800 dark:data-popup-open:bg-neutral-800';

const overviewLinks = [
  {
    href: '/react/overview/quick-start',
    title: 'Quick Start',
    description: 'Install and assemble your first component.',
  },
  {
    href: '/react/overview/accessibility',
    title: 'Accessibility',
    description: 'Learn how we build accessible components.',
  },
  {
    href: '/react/overview/releases',
    title: 'Releases',
    description: 'See what’s new in the latest Base UI versions.',
  },
  {
    href: '/react/overview/about',
    title: 'About',
    description: 'Learn more about Base UI and our mission.',
  },
] as const;

const handbookLinks = [
  {
    href: '/react/handbook/styling',
    title: 'Styling',
    description:
      'Base UI components can be styled with plain CSS, Tailwind CSS, CSS-in-JS, or CSS Modules.',
  },
  {
    href: '/react/handbook/animation',
    title: 'Animation',
    description:
      'Base UI components can be animated with CSS transitions, CSS animations, or JavaScript libraries.',
  },
  {
    href: '/react/handbook/composition',
    title: 'Composition',
    description:
      'Base UI components can be replaced and composed with your own existing components.',
  },
] as const;
