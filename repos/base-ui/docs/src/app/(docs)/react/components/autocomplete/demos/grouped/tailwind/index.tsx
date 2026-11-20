'use client';
import { Autocomplete } from '@base-ui/react/autocomplete';

export default function ExampleGroupAutocomplete() {
  return (
    <Autocomplete.Root items={groupedTags}>
      <label className="flex flex-col gap-1 text-sm font-bold text-neutral-950 dark:text-white">
        Select a tag
        <Autocomplete.Input
          placeholder="e.g. feature"
          className="h-8 w-[16rem] border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
        />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner className="outline-hidden" sideOffset={4}>
          <Autocomplete.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <Autocomplete.Empty>
              <div className="py-4 pr-4 pl-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                No tags found.
              </div>
            </Autocomplete.Empty>
            <Autocomplete.List className="outline-0 overflow-y-auto py-1 scroll-py-1 overscroll-contain max-h-[min(22.5rem,var(--available-height))] data-empty:p-0">
              {(group: TagGroup) => (
                <Autocomplete.Group
                  key={group.value}
                  items={group.items}
                  className="block pb-2 last:pb-0"
                >
                  <Autocomplete.GroupLabel className="p-2 text-sm leading-4 text-neutral-500 select-none dark:text-neutral-400">
                    {group.value}
                  </Autocomplete.GroupLabel>
                  <Autocomplete.Collection>
                    {(tag: Tag) => (
                      <Autocomplete.Item
                        key={tag.id}
                        className="flex cursor-default items-center gap-2 py-2 pr-2 pl-2 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-0 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                        value={tag}
                      >
                        {tag.label}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

interface Tag {
  id: string;
  label: string;
  group: 'Type' | 'Component';
}

interface TagGroup {
  value: string;
  items: Tag[];
}

const tagsData: Tag[] = [
  { id: 't1', label: 'feature', group: 'Type' },
  { id: 't2', label: 'fix', group: 'Type' },
  { id: 't3', label: 'bug', group: 'Type' },
  { id: 't4', label: 'docs', group: 'Type' },
  { id: 't5', label: 'internal', group: 'Type' },
  { id: 't6', label: 'mobile', group: 'Type' },
  { id: 'c-accordion', label: 'component: accordion', group: 'Component' },
  { id: 'c-alert-dialog', label: 'component: alert dialog', group: 'Component' },
  { id: 'c-autocomplete', label: 'component: autocomplete', group: 'Component' },
  { id: 'c-avatar', label: 'component: avatar', group: 'Component' },
  { id: 'c-checkbox', label: 'component: checkbox', group: 'Component' },
  { id: 'c-checkbox-group', label: 'component: checkbox group', group: 'Component' },
  { id: 'c-collapsible', label: 'component: collapsible', group: 'Component' },
  { id: 'c-combobox', label: 'component: combobox', group: 'Component' },
  { id: 'c-context-menu', label: 'component: context menu', group: 'Component' },
  { id: 'c-dialog', label: 'component: dialog', group: 'Component' },
  { id: 'c-field', label: 'component: field', group: 'Component' },
  { id: 'c-fieldset', label: 'component: fieldset', group: 'Component' },
  { id: 'c-filterable-menu', label: 'component: filterable menu', group: 'Component' },
  { id: 'c-form', label: 'component: form', group: 'Component' },
  { id: 'c-input', label: 'component: input', group: 'Component' },
  { id: 'c-menu', label: 'component: menu', group: 'Component' },
  { id: 'c-menubar', label: 'component: menubar', group: 'Component' },
  { id: 'c-meter', label: 'component: meter', group: 'Component' },
  { id: 'c-navigation-menu', label: 'component: navigation menu', group: 'Component' },
  { id: 'c-number-field', label: 'component: number field', group: 'Component' },
  { id: 'c-popover', label: 'component: popover', group: 'Component' },
  { id: 'c-preview-card', label: 'component: preview card', group: 'Component' },
  { id: 'c-progress', label: 'component: progress', group: 'Component' },
  { id: 'c-radio', label: 'component: radio', group: 'Component' },
  { id: 'c-scroll-area', label: 'component: scroll area', group: 'Component' },
  { id: 'c-select', label: 'component: select', group: 'Component' },
  { id: 'c-separator', label: 'component: separator', group: 'Component' },
  { id: 'c-slider', label: 'component: slider', group: 'Component' },
  { id: 'c-switch', label: 'component: switch', group: 'Component' },
  { id: 'c-tabs', label: 'component: tabs', group: 'Component' },
  { id: 'c-toast', label: 'component: toast', group: 'Component' },
  { id: 'c-toggle', label: 'component: toggle', group: 'Component' },
  { id: 'c-toggle-group', label: 'component: toggle group', group: 'Component' },
  { id: 'c-toolbar', label: 'component: toolbar', group: 'Component' },
  { id: 'c-tooltip', label: 'component: tooltip', group: 'Component' },
];

function groupTags(tags: Tag[]): TagGroup[] {
  const groups: { [key: string]: Tag[] } = {};
  tags.forEach((t) => {
    (groups[t.group] ??= []).push(t);
  });
  const order = ['Type', 'Component'];
  return order.map((value) => ({ value, items: groups[value] ?? [] }));
}

const groupedTags: TagGroup[] = groupTags(tagsData);
