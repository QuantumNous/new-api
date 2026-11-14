'use client';
import * as React from 'react';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { Collapsible } from '@base-ui/react/collapsible';
import styles from './navigation-menu.module.css';

export default function ExampleNavigationMenu() {
  const [renderExtraItem, setRenderExtraItem] = React.useState(false);
  const [hoveredLink, setHoveredLink] = React.useState<string | null>(null);

  return (
    <div>
      <NavigationMenu.Root className={styles.Root}>
        <NavigationMenu.List className={styles.List}>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Overview
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <div style={{ display: 'flex', gap: 20 }}>
                {/* Left side - Links */}
                <div style={{ flex: 1 }}>
                  <ul className={styles.GridLinkList}>
                    {overviewLinks.map((item) => (
                      <li key={item.href}>
                        <Link
                          className={styles.LinkCard}
                          href={item.href}
                          onMouseEnter={() => {
                            setHoveredLink(item.href);
                          }}
                        >
                          <h3 className={styles.LinkTitle}>{item.title}</h3>
                          <p className={styles.LinkDescription}>{item.description}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right side - Dynamic content */}
                <div style={{ flex: 1 }}>
                  {hoveredLink && (
                    <div
                      style={{
                        backgroundColor: 'black',
                        color: 'white',
                        padding: 20,
                        borderRadius: 8,
                        minHeight: 200,
                        width: hoveredLink === '/react/overview/quick-start' ? 200 : 400,
                        height: hoveredLink === '/react/overview/accessibility' ? 150 : 300,
                      }}
                    >
                      {hoveredLink === '/react/overview/quick-start' && (
                        <div>
                          <h4 style={{ marginBottom: 10 }}>Quick Start Guide</h4>
                          <p>
                            All components are included in a single package. Base UI is
                            tree-shakeable, so your app bundle will contain only the components that
                            you actually use.
                          </p>
                        </div>
                      )}
                      {hoveredLink === '/react/overview/accessibility' && (
                        <div>
                          <h4 style={{ marginBottom: 10 }}>Accessibility Features</h4>
                          <p>
                            ARIA attributes built-in, keyboard navigation, screen reader support,
                            and focus management.
                          </p>
                        </div>
                      )}
                      {hoveredLink === '/react/overview/releases' && (
                        <div>
                          <h4 style={{ marginBottom: 10 }}>Latest Releases</h4>
                          <p>
                            v1.0.0 - Major release with new components, performance improvements,
                            and bug fixes.
                          </p>
                        </div>
                      )}
                      {hoveredLink === '/react/overview/about' && (
                        <div>
                          <h4 style={{ marginBottom: 10 }}>About Base UI</h4>
                          <p>
                            Unstyled components that are fully customizable, and built by the MUI
                            team.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Handbook
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <Collapsible.Root className={styles.CollapsibleRoot}>
                <Collapsible.Trigger className={styles.CollapsibleTrigger}>
                  Recovery keys
                </Collapsible.Trigger>
                <Collapsible.Panel className={styles.CollapsiblePanel}>
                  <div className={styles.RecoveryList}>
                    <div>alien-bean-pasta</div>
                    <div>wild-irish-burrito</div>
                    <div>horse-battery-staple</div>
                  </div>
                </Collapsible.Panel>
              </Collapsible.Root>

              <button type="button" onClick={() => setRenderExtraItem(!renderExtraItem)}>
                Render extra item
              </button>

              <ul className={styles.FlexLinkList}>
                {handbookLinks.map((item) => (
                  <li key={item.href}>
                    <Link className={styles.LinkCard} href={item.href}>
                      <h3 className={styles.LinkTitle}>{item.title}</h3>
                      <p className={styles.LinkDescription}>{item.description}</p>
                    </Link>
                  </li>
                ))}
                {renderExtraItem && (
                  <li>
                    <Link className={styles.LinkCard} href="/react/overview/quick-start">
                      <h3 className={styles.LinkTitle}>Quick Start</h3>
                      <p className={styles.LinkDescription}>
                        Install and assemble your first component.
                      </p>
                    </Link>
                  </li>
                )}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Product
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <MixedNestedNavigationMenuContent />
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Long List
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <ul className={styles.LongList}>
                {Array.from({ length: 50 }, (_, index) => (
                  <li key={index}>
                    <Link className={styles.LinkCard} href={`/item-${index}`}>
                      <h3 className={styles.LinkTitle}>Item {index + 1}</h3>
                      <p className={styles.LinkDescription}>
                        This is item number {index + 1} in the long list for testing scrollable
                        menus.
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <Link className={styles.Trigger} href="https://github.com/mui/base-ui">
              GitHub
            </Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>

        <NavigationMenu.Portal>
          <NavigationMenu.Positioner
            align="start"
            className={styles.Positioner}
            sideOffset={10}
            alignOffset={-100}
            collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
          >
            <NavigationMenu.Popup className={styles.Popup}>
              <NavigationMenu.Arrow className={styles.Arrow}>
                <ArrowSvg />
              </NavigationMenu.Arrow>
              <NavigationMenu.Viewport className={styles.Viewport} />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>

      <NavigationMenu.Root className={styles.Root} style={{ marginTop: '2rem' }}>
        <NavigationMenu.List className={styles.List}>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Overview
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <table role="presentation">
                <tbody>
                  <tr>
                    <td>
                      <ul className={styles.GridLinkList}>
                        {overviewLinks.map((item) => (
                          <li key={item.href}>
                            <Link className={styles.LinkCard} href={item.href}>
                              <h3 className={styles.LinkTitle}>{item.title}</h3>
                              <p className={styles.LinkDescription}>{item.description}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul className={styles.FlexLinkList}>
                        <li>
                          <Link className={styles.LinkCard} href="/react/components">
                            <h3 className={styles.LinkTitle}>Components</h3>
                            <p className={styles.LinkDescription}>
                              Browse primitives for building product UI.
                            </p>
                          </Link>
                        </li>
                        <li>
                          <Link className={styles.LinkCard} href="/react/hooks">
                            <h3 className={styles.LinkTitle}>Hooks</h3>
                            <p className={styles.LinkDescription}>
                              Use shared behavior without adopting styles.
                            </p>
                          </Link>
                        </li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <Link className={styles.Trigger} href="https://github.com/mui/base-ui">
              GitHub
            </Link>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Handbook
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <ul className={styles.FlexLinkList}>
                {handbookLinks.map((item) => (
                  <li key={item.href}>
                    <Link className={styles.LinkCard} href={item.href}>
                      <h3 className={styles.LinkTitle}>{item.title}</h3>
                      <p className={styles.LinkDescription}>{item.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>

        <NavigationMenu.Portal>
          <NavigationMenu.Positioner
            className={styles.Positioner}
            sideOffset={10}
            collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
            style={{
              ['--duration' as string]: '1.25s',
              ['--easing' as string]: 'linear',
            }}
          >
            <NavigationMenu.Popup className={styles.Popup}>
              <NavigationMenu.Arrow className={styles.Arrow}>
                <ArrowSvg />
              </NavigationMenu.Arrow>
              <NavigationMenu.Viewport className={styles.Viewport} />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>

      <NavigationMenu.Root className={styles.Root} style={{ position: 'absolute', bottom: 100 }}>
        <NavigationMenu.List className={styles.List}>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Overview
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <ul className={styles.GridLinkList}>
                {overviewLinks.map((item) => (
                  <li key={item.href}>
                    <Link className={styles.LinkCard} href={item.href}>
                      <h3 className={styles.LinkTitle}>{item.title}</h3>
                      <p className={styles.LinkDescription}>{item.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item>
            <NavigationMenu.Trigger className={styles.Trigger}>
              Handbook
              <NavigationMenu.Icon className={styles.Icon}>
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.Content}>
              <button type="button" onClick={() => setRenderExtraItem(!renderExtraItem)}>
                Render extra item
              </button>

              <ul className={styles.FlexLinkList}>
                {handbookLinks.map((item) => (
                  <li key={item.href}>
                    <Link className={styles.LinkCard} href={item.href}>
                      <h3 className={styles.LinkTitle}>{item.title}</h3>
                      <p className={styles.LinkDescription}>{item.description}</p>
                    </Link>
                  </li>
                ))}
                {renderExtraItem && (
                  <li>
                    <Link className={styles.LinkCard} href="/react/overview/quick-start">
                      <h3 className={styles.LinkTitle}>Quick Start</h3>
                      <p className={styles.LinkDescription}>
                        Install and assemble your first component.
                      </p>
                    </Link>
                  </li>
                )}
              </ul>
            </NavigationMenu.Content>
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
          >
            <NavigationMenu.Popup className={styles.Popup}>
              <NavigationMenu.Arrow className={styles.Arrow}>
                <ArrowSvg />
              </NavigationMenu.Arrow>
              <NavigationMenu.Viewport className={styles.Viewport} />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    </div>
  );
}

function MixedNestedNavigationMenuContent() {
  return (
    <NavigationMenu.Root orientation="vertical" defaultValue="developers">
      <div className={styles.InlineNestedShell}>
        <NavigationMenu.List className={styles.InlineNestedList}>
          <NavigationMenu.Item value="developers">
            <NavigationMenu.Trigger className={styles.InlineNestedTrigger}>
              <span>Developers</span>
              <span className={styles.InlineNestedHint}>Go from idea to UI faster.</span>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.InlineNestedContent}>
              <div className={styles.SubmenuStack}>
                <div>
                  <h3 className={styles.SectionTitle}>
                    Build product UI without giving up control
                  </h3>
                  <p className={styles.SectionDescription}>
                    Hover Composition and move into the popup across the gap to test the handoff.
                  </p>
                </div>

                <ul className={styles.FlexLinkList}>
                  <li>
                    <Link className={styles.LinkCard} href="/react/overview/quick-start">
                      <h3 className={styles.LinkTitle}>Quick start</h3>
                      <p className={styles.LinkDescription}>
                        Install Base UI and get your first interactive primitive on screen fast.
                      </p>
                    </Link>
                  </li>
                  <li>
                    <Link className={styles.LinkCard} href="/react/overview/accessibility">
                      <h3 className={styles.LinkTitle}>Accessibility</h3>
                      <p className={styles.LinkDescription}>
                        Review keyboard support and semantic defaults before anything ships.
                      </p>
                    </Link>
                  </li>
                  <li>
                    <NavigationMenu.Root>
                      <NavigationMenu.List className={styles.DeepSubmenuList}>
                        <NavigationMenu.Item value="composition">
                          <NavigationMenu.Trigger className={styles.DeepSubmenuTrigger}>
                            Composition
                            <span className={styles.DeepSubmenuArrow}>→</span>
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content className={styles.DeepSubmenuContent}>
                            <div className={styles.SubmenuStack}>
                              <div>
                                <h4 className={styles.SectionTitle}>Composition popup</h4>
                                <p className={styles.SectionDescription}>
                                  This positioned submenu reproduces the inline-to-popup cursor path
                                  from the bug report.
                                </p>
                              </div>
                              <ul className={styles.FlexLinkList}>
                                {deepLinks.map((item) => (
                                  <li key={item.href}>
                                    <Link className={styles.LinkCard} href={item.href}>
                                      <h3 className={styles.LinkTitle}>{item.title}</h3>
                                      <p className={styles.LinkDescription}>{item.description}</p>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>

                      <NavigationMenu.Portal>
                        <NavigationMenu.Positioner
                          className={styles.Positioner}
                          side="right"
                          sideOffset={10}
                          collisionPadding={{
                            top: 5,
                            bottom: 5,
                            left: 20,
                            right: 20,
                          }}
                        >
                          <NavigationMenu.Popup className={styles.Popup}>
                            <NavigationMenu.Viewport className={styles.Viewport} />
                          </NavigationMenu.Popup>
                        </NavigationMenu.Positioner>
                      </NavigationMenu.Portal>
                    </NavigationMenu.Root>
                  </li>
                </ul>
              </div>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <NavigationMenu.Item value="systems">
            <NavigationMenu.Trigger className={styles.InlineNestedTrigger}>
              <span>Design systems</span>
              <span className={styles.InlineNestedHint}>
                Move here to close the current branch.
              </span>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={styles.InlineNestedContent}>
              <div className={styles.SubmenuStack}>
                <h3 className={styles.SectionTitle}>
                  Turn shared standards into working components
                </h3>
                <p className={styles.SectionDescription}>
                  A sibling panel for quickly switching the active inline branch while you test
                  hover transitions.
                </p>
              </div>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>

        <NavigationMenu.Viewport className={styles.InlineNestedViewport} />
      </div>
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

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className={styles.ArrowFill}
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className={styles.ArrowOuterStroke}
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className={styles.ArrowInnerStroke}
      />
    </svg>
  );
}

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
    description: 'Learn more about Base UI and our mission.',
  },
] as const;

const handbookLinks = [
  {
    href: '/react/handbook/styling',
    title: 'Styling',
    description:
      'Base UI components can be styled with plain CSS, Tailwind CSS, CSS-in-JS, or CSS Modules.',
  },
  {
    href: '/react/handbook/animation',
    title: 'Animation',
    description:
      'Base UI components can be animated with CSS transitions, CSS animations, or JavaScript libraries.',
  },
  {
    href: '/react/handbook/composition',
    title: 'Composition',
    description:
      'Base UI components can be replaced and composed with your own existing components.',
  },
] as const;

const deepLinks = [
  {
    href: '/react/handbook/composition',
    title: 'Composition handbook',
    description: 'Follow the hover path into this popup and confirm the entire chain stays open.',
  },
  {
    href: '/react/components/navigation-menu',
    title: 'Navigation Menu docs',
    description: 'Compare the experiment against the shipped component guidance and examples.',
  },
] as const;
