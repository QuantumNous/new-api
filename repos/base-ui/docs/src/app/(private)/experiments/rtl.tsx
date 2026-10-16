'use client';
import clsx from 'clsx';
import { DirectionProvider, useDirection } from '@base-ui/react/direction-provider';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { PreviewCard } from '@base-ui/react/preview-card';
import c from './rtl.module.css';

const dir = 'rtl';

export default function RtlNestedMenu() {
  const createHandleMenuClick = (menuItem: string) => {
    return () => {
      console.log(`Clicked on ${menuItem}`);
    };
  };

  return (
    <div className={c.rtl} dir={dir}>
      <DirectionProvider direction={dir}>
        <Menu.Root>
          <Menu.Trigger className={c.trigger}>Menu.Trigger</Menu.Trigger>
          <Menu.Portal>
            <MenuPositioner side="bottom" align="start">
              <Menu.Popup className={c.popup}>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={c.submenutrigger}>Text color</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <MenuPositioner align="start" side="inline-end">
                      <Menu.Popup className={c.popup}>
                        <Menu.Item
                          className={c.item}
                          onClick={createHandleMenuClick('Text color/Black')}
                        >
                          Black
                        </Menu.Item>
                        <Menu.Item
                          className={c.item}
                          onClick={createHandleMenuClick('Text color/Dark grey')}
                        >
                          Dark grey
                        </Menu.Item>
                        <Menu.Item
                          className={c.item}
                          onClick={createHandleMenuClick('Text color/Accent')}
                        >
                          Accent
                        </Menu.Item>
                      </Menu.Popup>
                    </MenuPositioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={c.submenutrigger}>Style</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <MenuPositioner align="start" side="inline-end">
                      <Menu.Popup className={c.popup}>
                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger className={c.submenutrigger}>
                            Heading
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <MenuPositioner align="start" side="inline-end">
                              <Menu.Popup className={c.popup}>
                                <Menu.Item
                                  className={c.item}
                                  onClick={createHandleMenuClick('Style/Heading/Level 1')}
                                >
                                  Level 1
                                </Menu.Item>
                                <Menu.Item
                                  className={c.item}
                                  onClick={createHandleMenuClick('Style/Heading/Level 2')}
                                >
                                  Level 2
                                </Menu.Item>
                                <Menu.Item
                                  className={c.item}
                                  onClick={createHandleMenuClick('Style/Heading/Level 3')}
                                >
                                  Level 3
                                </Menu.Item>
                              </Menu.Popup>
                            </MenuPositioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                        <Menu.Item
                          className={c.item}
                          onClick={createHandleMenuClick('Style/Paragraph')}
                        >
                          Paragraph
                        </Menu.Item>
                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger className={c.submenutrigger}>
                            List
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <MenuPositioner align="start" side="inline-end">
                              <Menu.Popup className={c.popup}>
                                <Menu.Item
                                  className={c.item}
                                  onClick={createHandleMenuClick('Style/List/Ordered')}
                                >
                                  Ordered
                                </Menu.Item>
                                <Menu.Item
                                  className={c.item}
                                  onClick={createHandleMenuClick('Style/List/Unordered')}
                                >
                                  Unordered
                                </Menu.Item>
                              </Menu.Popup>
                            </MenuPositioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.Popup>
                    </MenuPositioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>

                <Menu.Item className={c.item} onClick={createHandleMenuClick('Clear formatting')}>
                  Clear formatting
                </Menu.Item>
              </Menu.Popup>
            </MenuPositioner>
          </Menu.Portal>
        </Menu.Root>

        <PreviewCard.Root>
          <PreviewCard.Trigger href="#" className={c.trigger}>
            PreviewCard.Trigger
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCardPositioner sideOffset={8} side="inline-end" align="center">
              <PreviewCard.Popup className={c.popup}>
                <img
                  src="https://pbs.twimg.com/profile_images/1798056009291997184/B-prVmUP_400x400.jpg"
                  alt="Base UI Logo"
                  width={80}
                  height={80}
                  style={{ borderRadius: '50%' }}
                />
                <h2 style={{ fontSize: 20, margin: 0 }}>Base UI</h2>
                <p>Unstyled React components and hooks (@base-ui/react), by @MUI_hq.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span>
                    <strong>1</strong> Following
                  </span>
                  <span>
                    <strong>1,000</strong> Followers
                  </span>
                </div>
                <PreviewCard.Arrow className={c.arrow} />
              </PreviewCard.Popup>
            </PreviewCardPositioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>

        <Popover.Root>
          <Popover.Trigger className={c.trigger}>Popover.Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} side="inline-end">
              <Popover.Popup className={c.popup}>
                <Popover.Title>Popover Title</Popover.Title>
                <Popover.Description>Popover Description</Popover.Description>
                <Popover.Arrow className={c.arrow} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </DirectionProvider>
    </div>
  );
}

function MenuPositioner({ className, ...props }: Menu.Positioner.Props) {
  const direction = useDirection();
  return <Menu.Positioner className={clsx('bui-ol-n', className)} dir={direction} {...props} />;
}

function PreviewCardPositioner({ className, ...props }: PreviewCard.Positioner.Props) {
  const direction = useDirection();
  return (
    <PreviewCard.Positioner className={clsx('bui-ol-n', className)} dir={direction} {...props} />
  );
}
