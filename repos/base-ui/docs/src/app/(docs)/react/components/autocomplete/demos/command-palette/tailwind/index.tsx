'use client';
import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { Dialog } from '@base-ui/react/dialog';
import { ScrollArea } from '@base-ui/react/scroll-area';

export default function ExampleAutocompleteCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const shortcutsDescriptionId = React.useId();

  function handleItemClick() {
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="flex h-8 cursor-default items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700">
        Open command palette
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black opacity-20 transition-opacity duration-150 ease-[cubic-bezier(0.45,1.005,0,1.005)] data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-70 supports-[-webkit-touch-callout:none]:absolute" />
        <Dialog.Viewport className="fixed inset-0 flex items-start justify-center overflow-hidden px-2 pt-18 pb-2">
          <Dialog.Popup
            className="relative flex max-h-[min(36rem,calc(100dvh-5rem))] w-[calc(100vw-1rem)] max-w-md flex-col border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[translate,scale,opacity] duration-150 data-ending-style:-translate-y-4 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:-translate-y-4 data-starting-style:scale-95 data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            aria-label="Command palette"
          >
            <Autocomplete.Root
              open
              inline
              items={groupedItems}
              autoHighlight="always"
              keepHighlight
            >
              <Autocomplete.Input
                className="relative z-1 h-10 w-full border-0 bg-white px-3 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:outline-solid focus:outline-neutral-950 dark:focus:outline-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400"
                aria-label="Search commands"
                aria-describedby={shortcutsDescriptionId}
                placeholder="Search for apps and commands…"
              />
              <Dialog.Close className="sr-only">Close command palette</Dialog.Close>

              <ScrollArea.Root className="relative flex max-h-[min(60dvh,24rem)] min-h-0 flex-[0_1_auto] overflow-hidden border-t border-neutral-950 dark:border-t-white">
                <ScrollArea.Viewport className="min-h-0 flex-1 overscroll-contain [scroll-padding-block:0.25rem] focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                  <ScrollArea.Content style={{ minWidth: '100%' }}>
                    <Autocomplete.Empty>
                      <div className="flex min-h-32 items-center justify-start py-4 pr-4 pl-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                        No results found.
                      </div>
                    </Autocomplete.Empty>

                    <Autocomplete.List className="py-1">
                      {(group: Group) => (
                        <Autocomplete.Group
                          key={group.value}
                          items={group.items}
                          className="not-last:mb-1"
                        >
                          <Autocomplete.GroupLabel className="flex min-h-8 items-center pr-6 pl-3 text-sm leading-none font-normal text-neutral-500 select-none outline-none dark:text-neutral-400">
                            {group.value}
                          </Autocomplete.GroupLabel>
                          <Autocomplete.Collection>
                            {(item: Item) => (
                              <Autocomplete.Item
                                key={item.value}
                                value={item}
                                onClick={handleItemClick}
                                className="group grid min-h-8 cursor-default grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-6 text-sm font-normal leading-[1.25] outline-none select-none [scroll-margin-block:0.25rem] data-highlighted:bg-neutral-200 dark:data-highlighted:bg-neutral-700"
                              >
                                <span className="min-w-0 truncate font-normal">{item.label}</span>
                                <span className="shrink-0 whitespace-nowrap text-sm text-neutral-500 group-data-highlighted:text-neutral-700 dark:text-neutral-400 dark:group-data-highlighted:text-neutral-300">
                                  {group.value === 'Suggestions' ? 'Application' : 'Command'}
                                </span>
                              </Autocomplete.Item>
                            )}
                          </Autocomplete.Collection>
                        </Autocomplete.Group>
                      )}
                    </Autocomplete.List>
                  </ScrollArea.Content>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar className="flex w-4 justify-center bg-black/12 dark:bg-white/12">
                  <ScrollArea.Thumb className="w-full bg-neutral-950 dark:bg-white" />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>

              <div className="flex items-center justify-between border-t border-neutral-950 bg-white px-3 py-2.5 text-xs text-neutral-600 dark:border-white dark:bg-neutral-950 dark:text-neutral-400">
                <span id={shortcutsDescriptionId} className="sr-only">
                  Use Enter to activate the highlighted item.
                </span>
                <div className="flex items-center gap-1">
                  <span>Activate</span>
                  <kbd className="inline-flex h-5 min-w-5 items-center justify-center border border-neutral-400 bg-neutral-100 px-1 font-mono text-[0.625rem] leading-none font-normal text-neutral-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                    Enter
                  </kbd>
                </div>
              </div>
            </Autocomplete.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface Item {
  value: string;
  label: string;
}

interface Group {
  value: string;
  items: Item[];
}

const suggestions: Item[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'figma', label: 'Figma' },
  { value: 'slack', label: 'Slack' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'raycast', label: 'Raycast' },
  { value: 'notion', label: 'Notion' },
  { value: 'github', label: 'GitHub' },
  { value: 'jira', label: 'Jira' },
  { value: 'calendar', label: 'Google Calendar' },
  { value: 'chrome', label: 'Google Chrome' },
  { value: 'mail', label: 'Apple Mail' },
  { value: 'terminal', label: 'Terminal' },
];

const commands: Item[] = [
  { value: 'clipboard-history', label: 'Clipboard History' },
  { value: 'import-extension', label: 'Import Extension' },
  { value: 'create-snippet', label: 'Create Snippet' },
  { value: 'system-preferences', label: 'System Preferences' },
  { value: 'window-management', label: 'Window Management' },
  { value: 'toggle-dark-mode', label: 'Toggle Dark Mode' },
  { value: 'new-window', label: 'New Window' },
  { value: 'new-tab', label: 'New Tab' },
  { value: 'search-docs', label: 'Search Documentation' },
  { value: 'capture-screen', label: 'Capture Screenshot' },
  { value: 'close-sidebar', label: 'Toggle Sidebar' },
  { value: 'toggle-terminal', label: 'Toggle Integrated Terminal' },
  { value: 'run-script', label: 'Run Script' },
];

const groupedItems: Group[] = [
  { value: 'Suggestions', items: suggestions },
  { value: 'Commands', items: commands },
];
