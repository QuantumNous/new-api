'use client';
import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';

export default function ExampleEmojiPicker() {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');
  const [searchValue, setSearchValue] = React.useState('');

  const textInputRef = React.useRef<HTMLInputElement | null>(null);

  function handleInsertEmoji(value: string | null) {
    if (!value || !textInputRef.current) {
      return;
    }

    const emoji = value;
    const start = textInputRef.current.selectionStart ?? textInputRef.current.value.length ?? 0;
    const end = textInputRef.current.selectionEnd ?? textInputRef.current.value.length ?? 0;

    setTextValue((prev) => prev.slice(0, start) + emoji + prev.slice(end));
    setPickerOpen(false);

    const input = textInputRef.current;
    if (input) {
      input.focus();
      const caretPos = start + emoji.length;
      input.setSelectionRange(caretPos, caretPos);
    }
  }

  return (
    <div className="mx-auto w-[16rem]">
      <div className="relative flex w-full">
        <input
          ref={textInputRef}
          type="text"
          className="-mr-px h-8 flex-1 border border-r-0 border-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 bg-white dark:bg-neutral-950 focus:relative focus:outline-2 focus:-outline-offset-1 focus:outline-solid focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
          placeholder="iMessage"
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
        />

        <Autocomplete.Root
          items={emojiGroups}
          grid
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onOpenChangeComplete={() => setSearchValue('')}
          value={searchValue}
          onValueChange={(value, details) => {
            if (details.reason !== 'item-press') {
              setSearchValue(value);
            }
          }}
        >
          <Autocomplete.Trigger
            className="flex size-8 items-center justify-center border border-neutral-950 bg-transparent text-xl leading-none text-neutral-950 outline-none hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-solid focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-popup-open:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-popup-open:bg-neutral-800"
            aria-label="Choose emoji"
          >
            😀
          </Autocomplete.Trigger>
          <Autocomplete.Portal>
            <Autocomplete.Positioner className="outline-0" sideOffset={4} align="end">
              <Autocomplete.Popup
                className="[--input-container-height:2rem] max-h-[20.5rem] max-w-[var(--available-width)] origin-[var(--transform-origin)] bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[transform,scale,opacity] data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0 dark:bg-neutral-950 dark:text-white dark:shadow-none"
                aria-label="Select emoji"
              >
                <Autocomplete.Input
                  placeholder="Search emojis…"
                  className="h-8 w-64 max-w-full border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-2 focus:outline-solid focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white"
                />
                <div className="border border-t-0 border-neutral-950 dark:border-white">
                  <Autocomplete.Empty>
                    <div className="px-2 py-3 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                      No emojis found
                    </div>
                  </Autocomplete.Empty>
                  <Autocomplete.List className="max-h-[min(calc(20.5rem-var(--input-container-height)-2px),calc(var(--available-height)-var(--input-container-height)-2px))] overflow-auto scroll-pt-1 scroll-pb-[0.35rem] overscroll-contain py-2 empty:p-0">
                    {(group: EmojiGroup) => (
                      <Autocomplete.Group key={group.value} items={group.items} className="block">
                        <Autocomplete.GroupLabel className="p-2 text-sm leading-4 text-neutral-500 select-none dark:text-neutral-400">
                          {group.label}
                        </Autocomplete.GroupLabel>
                        <div className="px-2 pb-1 pt-0" role="presentation">
                          {chunkArray(group.items, COLUMNS).map((row, rowIdx) => (
                            <Autocomplete.Row key={rowIdx} className="grid grid-cols-5">
                              {row.map((rowItem) => (
                                <Autocomplete.Item
                                  key={rowItem.emoji}
                                  value={rowItem}
                                  className="group flex h-10 min-w-[var(--anchor-width)] cursor-default flex-col items-center justify-center bg-transparent px-0.5 py-2 text-neutral-950 outline-0 select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-100 dark:text-white dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-neutral-800"
                                  onClick={() => {
                                    handleInsertEmoji(rowItem.emoji);
                                    setPickerOpen(false);
                                  }}
                                >
                                  <span className="text-2xl leading-none">{rowItem.emoji}</span>
                                </Autocomplete.Item>
                              ))}
                            </Autocomplete.Row>
                          ))}
                        </div>
                      </Autocomplete.Group>
                    )}
                  </Autocomplete.List>
                </div>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </div>
    </div>
  );
}

const COLUMNS = 5;

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

interface EmojiItem {
  emoji: string;
  value: string;
  name: string;
}

interface EmojiGroup {
  value: string;
  label: string;
  items: EmojiItem[];
}

export const emojiCategories = [
  {
    label: 'Smileys & Emotion',
    emojis: [
      { emoji: '😀', name: 'grinning face' },
      { emoji: '😃', name: 'grinning face with big eyes' },
      { emoji: '😄', name: 'grinning face with smiling eyes' },
      { emoji: '😁', name: 'beaming face with smiling eyes' },
      { emoji: '😆', name: 'grinning squinting face' },
      { emoji: '😅', name: 'grinning face with sweat' },
      { emoji: '🤣', name: 'rolling on the floor laughing' },
      { emoji: '😂', name: 'face with tears of joy' },
      { emoji: '🙂', name: 'slightly smiling face' },
      { emoji: '🙃', name: 'upside-down face' },
      { emoji: '😉', name: 'winking face' },
      { emoji: '😊', name: 'smiling face with smiling eyes' },
      { emoji: '😇', name: 'smiling face with halo' },
      { emoji: '🥰', name: 'smiling face with hearts' },
      { emoji: '😍', name: 'smiling face with heart-eyes' },
      { emoji: '🤩', name: 'star-struck' },
      { emoji: '😘', name: 'face blowing a kiss' },
      { emoji: '😗', name: 'kissing face' },
      { emoji: '☺️', name: 'smiling face' },
      { emoji: '😚', name: 'kissing face with closed eyes' },
      { emoji: '😙', name: 'kissing face with smiling eyes' },
      { emoji: '🥲', name: 'smiling face with tear' },
      { emoji: '😋', name: 'face savoring food' },
      { emoji: '😛', name: 'face with tongue' },
      { emoji: '😜', name: 'winking face with tongue' },
      { emoji: '🤪', name: 'zany face' },
      { emoji: '😝', name: 'squinting face with tongue' },
      { emoji: '🤑', name: 'money-mouth face' },
      { emoji: '🤗', name: 'hugging face' },
      { emoji: '🤭', name: 'face with hand over mouth' },
    ],
  },
  {
    label: 'Animals & Nature',
    emojis: [
      { emoji: '🐶', name: 'dog face' },
      { emoji: '🐱', name: 'cat face' },
      { emoji: '🐭', name: 'mouse face' },
      { emoji: '🐹', name: 'hamster' },
      { emoji: '🐰', name: 'rabbit face' },
      { emoji: '🦊', name: 'fox' },
      { emoji: '🐻', name: 'bear' },
      { emoji: '🐼', name: 'panda' },
      { emoji: '🐨', name: 'koala' },
      { emoji: '🐯', name: 'tiger face' },
      { emoji: '🦁', name: 'lion' },
      { emoji: '🐮', name: 'cow face' },
      { emoji: '🐷', name: 'pig face' },
      { emoji: '🐽', name: 'pig nose' },
      { emoji: '🐸', name: 'frog' },
      { emoji: '🐵', name: 'monkey face' },
      { emoji: '🙈', name: 'see-no-evil monkey' },
      { emoji: '🙉', name: 'hear-no-evil monkey' },
      { emoji: '🙊', name: 'speak-no-evil monkey' },
      { emoji: '🐒', name: 'monkey' },
      { emoji: '🐔', name: 'chicken' },
      { emoji: '🐧', name: 'penguin' },
      { emoji: '🐦', name: 'bird' },
      { emoji: '🐤', name: 'baby chick' },
      { emoji: '🐣', name: 'hatching chick' },
      { emoji: '🐥', name: 'front-facing baby chick' },
      { emoji: '🦆', name: 'duck' },
      { emoji: '🦅', name: 'eagle' },
      { emoji: '🦉', name: 'owl' },
      { emoji: '🦇', name: 'bat' },
    ],
  },
  {
    label: 'Food & Drink',
    emojis: [
      { emoji: '🍎', name: 'red apple' },
      { emoji: '🍏', name: 'green apple' },
      { emoji: '🍊', name: 'tangerine' },
      { emoji: '🍋', name: 'lemon' },
      { emoji: '🍌', name: 'banana' },
      { emoji: '🍉', name: 'watermelon' },
      { emoji: '🍇', name: 'grapes' },
      { emoji: '🍓', name: 'strawberry' },
      { emoji: '🫐', name: 'blueberries' },
      { emoji: '🍈', name: 'melon' },
      { emoji: '🍒', name: 'cherries' },
      { emoji: '🍑', name: 'peach' },
      { emoji: '🥭', name: 'mango' },
      { emoji: '🍍', name: 'pineapple' },
      { emoji: '🥥', name: 'coconut' },
      { emoji: '🥝', name: 'kiwi fruit' },
      { emoji: '🍅', name: 'tomato' },
      { emoji: '🍆', name: 'eggplant' },
      { emoji: '🥑', name: 'avocado' },
      { emoji: '🥦', name: 'broccoli' },
      { emoji: '🥬', name: 'leafy greens' },
      { emoji: '🥒', name: 'cucumber' },
      { emoji: '🌶️', name: 'hot pepper' },
      { emoji: '🫑', name: 'bell pepper' },
      { emoji: '🌽', name: 'ear of corn' },
      { emoji: '🥕', name: 'carrot' },
      { emoji: '🫒', name: 'olive' },
      { emoji: '🧄', name: 'garlic' },
      { emoji: '🧅', name: 'onion' },
      { emoji: '🥔', name: 'potato' },
    ],
  },
];

const emojiGroups: EmojiGroup[] = emojiCategories.map((category) => ({
  value: category.label,
  label: category.label,
  items: category.emojis.map((emoji) => ({
    ...emoji,
    value: emoji.name.toLowerCase(),
  })),
}));
