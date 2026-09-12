import * as React from 'react';
import { NavigationMenu } from '@base-ui/react/navigation-menu';

const topTriggerStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 40,
  padding: '0 14px',
  border: 'none',
  borderRadius: 6,
  background: 'rgb(249 250 251)',
  color: 'rgb(17 24 39)',
  font: 'inherit',
};

const nestedTriggerStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  width: '100%',
  padding: '12px 14px',
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: 'rgb(17 24 39)',
  textAlign: 'left',
  font: 'inherit',
};

const triggerCardStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '12px 14px',
  border: '1px solid rgb(229 231 235)',
  borderRadius: 8,
  background: 'rgb(249 250 251)',
  color: 'rgb(17 24 39)',
  textAlign: 'left',
  font: 'inherit',
};

const linkCardStyle: React.CSSProperties = {
  display: 'block',
  padding: '10px 12px',
  borderRadius: 8,
  color: 'inherit',
  textDecoration: 'none',
};

export default function InlineSubmenuHoverHandoff() {
  return (
    <div style={{ padding: 40 }}>
      <NavigationMenu.Root>
        <NavigationMenu.List
          style={{
            display: 'flex',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            borderRadius: 8,
            background: 'rgb(249 250 251)',
            width: 'max-content',
          }}
        >
          <NavigationMenu.Item value="product">
            <NavigationMenu.Trigger data-testid="trigger-product" style={topTriggerStyle}>
              Product
            </NavigationMenu.Trigger>
            <NavigationMenu.Content
              data-testid="content-product"
              style={{ width: 720, maxWidth: 'calc(100vw - 80px)', padding: 0 }}
            >
              <NavigationMenu.Root defaultValue="developers" orientation="vertical">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '220px minmax(0, 1fr)',
                    minHeight: 280,
                    overflow: 'hidden',
                    borderRadius: 12,
                    border: '1px solid rgb(229 231 235)',
                    background: 'white',
                  }}
                >
                  <NavigationMenu.List
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      listStyle: 'none',
                      margin: 0,
                      padding: 12,
                      background: 'rgb(243 244 246)',
                      borderRight: '1px solid rgb(229 231 235)',
                    }}
                  >
                    <NavigationMenu.Item value="developers">
                      <NavigationMenu.Trigger
                        data-testid="trigger-developers"
                        style={nestedTriggerStyle}
                      >
                        <span>Developers</span>
                        <span style={{ fontSize: 14, color: 'rgb(107 114 128)' }}>
                          Go from idea to UI faster.
                        </span>
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content
                        data-testid="content-developers"
                        style={{ padding: 24, width: 500, minHeight: 280 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                          }}
                        >
                          <div>
                            <h2
                              style={{
                                margin: 0,
                                fontSize: 24,
                                lineHeight: 1.2,
                                fontWeight: 600,
                              }}
                            >
                              Build product UI without giving up control
                            </h2>
                            <p
                              style={{
                                margin: '8px 0 0',
                                fontSize: 14,
                                lineHeight: 1.5,
                                color: 'rgb(75 85 99)',
                              }}
                            >
                              Hover Composition, then move off the right edge of the trigger and
                              into the popup across the gap.
                            </p>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Link href="#quick-start">Quick start</Link>
                            <Link href="#accessibility">Accessibility</Link>

                            <NavigationMenu.Root>
                              <NavigationMenu.List
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  listStyle: 'none',
                                  margin: 0,
                                  padding: 0,
                                }}
                              >
                                <NavigationMenu.Item value="composition">
                                  <NavigationMenu.Trigger
                                    data-testid="trigger-composition"
                                    style={triggerCardStyle}
                                  >
                                    <span>Composition</span>
                                    <span aria-hidden>→</span>
                                  </NavigationMenu.Trigger>
                                  <NavigationMenu.Content
                                    data-testid="content-composition"
                                    style={{ width: 280, padding: 16 }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 12,
                                      }}
                                    >
                                      <div>
                                        <h3
                                          style={{
                                            margin: 0,
                                            fontSize: 18,
                                            lineHeight: 1.25,
                                            fontWeight: 600,
                                          }}
                                        >
                                          Composition popup
                                        </h3>
                                        <p
                                          style={{
                                            margin: '8px 0 0',
                                            fontSize: 14,
                                            lineHeight: 1.5,
                                            color: 'rgb(75 85 99)',
                                          }}
                                        >
                                          The menu should stay open while the pointer crosses the
                                          gap into this popup.
                                        </p>
                                      </div>
                                      <Link href="#composition-handbook">Composition handbook</Link>
                                      <Link href="#navigation-menu-docs">Navigation Menu docs</Link>
                                    </div>
                                  </NavigationMenu.Content>
                                </NavigationMenu.Item>
                              </NavigationMenu.List>

                              <NavigationMenu.Portal>
                                <NavigationMenu.Positioner
                                  data-testid="positioner-composition"
                                  side="right"
                                  sideOffset={10}
                                  collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
                                >
                                  <NavigationMenu.Popup
                                    style={{
                                      borderRadius: 12,
                                      background: 'white',
                                      outline: '1px solid rgb(229 231 235)',
                                      boxShadow:
                                        '0 10px 15px -3px rgb(229 231 235), 0 4px 6px -4px rgb(229 231 235)',
                                    }}
                                  >
                                    <NavigationMenu.Viewport />
                                  </NavigationMenu.Popup>
                                </NavigationMenu.Positioner>
                              </NavigationMenu.Portal>
                            </NavigationMenu.Root>
                          </div>
                        </div>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>

                    <NavigationMenu.Item value="systems">
                      <NavigationMenu.Trigger style={nestedTriggerStyle}>
                        <span>Design systems</span>
                        <span style={{ fontSize: 14, color: 'rgb(107 114 128)' }}>
                          Move here to close the branch.
                        </span>
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content style={{ padding: 24, width: 500, minHeight: 280 }}>
                        <p style={{ margin: 0 }}>Sibling panel</p>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  </NavigationMenu.List>

                  <NavigationMenu.Viewport data-testid="viewport-inline" />
                </div>
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>

        <NavigationMenu.Portal>
          <NavigationMenu.Positioner
            align="start"
            sideOffset={10}
            collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
          >
            <NavigationMenu.Popup
              style={{
                borderRadius: 12,
                background: 'white',
                outline: '1px solid rgb(229 231 235)',
                boxShadow: '0 10px 15px -3px rgb(229 231 235), 0 4px 6px -4px rgb(229 231 235)',
              }}
            >
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    </div>
  );
}

function Link(props: NavigationMenu.Link.Props) {
  return (
    <NavigationMenu.Link
      render={<a aria-label="fixture link" href={props.href} />}
      {...props}
      style={{
        ...linkCardStyle,
        ...(props.style ?? {}),
      }}
    />
  );
}
