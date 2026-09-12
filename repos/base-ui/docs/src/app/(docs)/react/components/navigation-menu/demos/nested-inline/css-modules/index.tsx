'use client';
import * as React from 'react';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { useMediaQuery } from '@base-ui/react/unstable-use-media-query';
import { audienceMenus, guideLinks, guidesPanel } from '../data';
import styles from './index.module.css';

export default function ExampleNavigationMenu() {
  const isDesktop = useMediaQuery('(min-width: 700px)', { defaultMatches: true });

  return (
    <NavigationMenu.Root className={styles.Root}>
      <NavigationMenu.List className={styles.List}>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={styles.Trigger}>
            Product
            <NavigationMenu.Icon className={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className={`${styles.Content} ${styles.ProductContent}`}>
            <NavigationMenu.Root
              className={styles.SubmenuRoot}
              orientation={isDesktop ? 'vertical' : 'horizontal'}
              defaultValue="developers"
            >
              <div className={styles.SubmenuLayout}>
                <NavigationMenu.List className={styles.SubmenuList}>
                  {audienceMenus.map((menu) => (
                    <NavigationMenu.Item key={menu.value} value={menu.value}>
                      <NavigationMenu.Trigger className={styles.SubmenuTrigger}>
                        <span className={styles.SubmenuLabel}>{menu.label}</span>
                        <span className={styles.SubmenuHint}>{menu.hint}</span>
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content className={styles.SubmenuContent}>
                        <div>
                          <h4 className={styles.SubmenuTitle}>{menu.title}</h4>
                          <p className={styles.SubmenuDescription}>{menu.description}</p>
                        </div>
                        <ul className={styles.LinkList}>
                          {menu.links.map((link) => (
                            <li key={link.href}>
                              <Link className={styles.LinkCard} href={link.href}>
                                <h5 className={styles.LinkTitle}>{link.title}</h5>
                                <p className={styles.LinkDescription}>{link.description}</p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  ))}
                </NavigationMenu.List>

                <NavigationMenu.Viewport className={styles.SubmenuViewport} />
              </div>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Trigger className={styles.Trigger}>
            Learn
            <NavigationMenu.Icon className={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className={`${styles.Content} ${styles.GuidesContent}`}>
            <div className={styles.GuidesPanel}>
              <div>
                <h4 className={styles.SubmenuTitle}>{guidesPanel.title}</h4>
                <p className={styles.SubmenuDescription}>{guidesPanel.description}</p>
              </div>
              <ul className={styles.LinkList}>
                {guideLinks.map((link) => (
                  <li key={link.href}>
                    <Link className={styles.LinkCard} href={link.href}>
                      <h5 className={styles.LinkTitle}>{link.title}</h5>
                      <p className={styles.LinkDescription}>{link.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <Link className={styles.Trigger} href="/react/overview/releases">
            Releases
          </Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <Link className={styles.Trigger} href="https://github.com/mui/base-ui">
            GitHub
          </Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          className={styles.Positioner}
          sideOffset={10}
          collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
          collisionAvoidance={{ side: 'none' }}
        >
          <NavigationMenu.Popup className={styles.Popup}>
            <NavigationMenu.Arrow className={styles.Arrow} />
            <NavigationMenu.Viewport className={styles.Viewport} />
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
