'use client';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { ScrollArea } from '@base-ui/react/scroll-area';
import styles from './index.module.css';

export default function ExampleAutocompleteCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const shortcutsDescriptionId = React.useId();

  function handleItemClick() {
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={styles.Button}>Open command palette</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.Backdrop} />
        <Dialog.Viewport className={styles.Viewport}>
          <Dialog.Popup className={styles.Popup} aria-label="Command palette">
            <Autocomplete.Root
              open
              inline
              items={groupedItems}
              autoHighlight="always"
              keepHighlight
            >
              <Autocomplete.Input
                className={styles.Input}
                aria-label="Search commands"
                aria-describedby={shortcutsDescriptionId}
                placeholder="Search for apps and commands…"
              />
              <Dialog.Close className={styles.VisuallyHidden}>Close command palette</Dialog.Close>

              <ScrollArea.Root className={styles.ListArea}>
                <ScrollArea.Viewport className={styles.ListViewport}>
                  <ScrollArea.Content className={styles.ListContent}>
                    <Autocomplete.Empty>
                      <div className={styles.Empty}>No results found.</div>
                    </Autocomplete.Empty>

                    <Autocomplete.List className={styles.List}>
                      {(group: Group) => (
                        <Autocomplete.Group
                          key={group.value}
                          items={group.items}
                          className={styles.Group}
                        >
                          <Autocomplete.GroupLabel className={styles.GroupLabel}>
                            {group.value}
                          </Autocomplete.GroupLabel>
                          <Autocomplete.Collection>
                            {(item: Item) => (
                              <Autocomplete.Item
                                key={item.value}
                                value={item}
                                className={styles.Item}
                                onClick={handleItemClick}
                              >
                                <span className={styles.ItemLabel}>{item.label}</span>
                                <span className={styles.ItemType}>
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
                <ScrollArea.Scrollbar className={styles.Scrollbar}>
                  <ScrollArea.Thumb className={styles.ScrollbarThumb} />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>

              <div className={styles.Footer}>
                <span id={shortcutsDescriptionId} className={styles.VisuallyHidden}>
                  Use Enter to activate the highlighted item.
                </span>
                <div className={styles.FooterLeft}>
                  <span>Activate</span>
                  <kbd className={styles.Kbd}>Enter</kbd>
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
