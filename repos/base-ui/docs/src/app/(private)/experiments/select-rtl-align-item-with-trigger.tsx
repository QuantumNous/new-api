'use client';
import * as React from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Select } from '@base-ui/react/select';

const OPTIONS = [
  { value: 'arabic', label: 'العربية الفصحى' },
  { value: 'levantine', label: 'العربية الشامية' },
  { value: 'maghrebi', label: 'العربية المغاربية' },
  { value: 'sudanese', label: 'العربية السودانية' },
  { value: 'gulf', label: 'العربية الخليجية' },
];

const ARABIC_FONT_FAMILY = '"Noto Naskh Arabic", "Amiri", "Scheherazade New", Georgia, serif';
const CSS = `
  .selectHeroExperiment_Page {
    min-height: 100vh;
    padding: 40px;
    background: var(--color-gray-50);
    color: var(--color-gray-900);
    font-family: ${ARABIC_FONT_FAMILY};
  }

  .selectHeroExperiment_Container {
    max-width: 480px;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .selectHeroExperiment_Title {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
  }

  .selectHeroExperiment_Description {
    margin: 0;
    line-height: 1.6;
  }

  .selectHeroExperiment_Field {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 0.25rem;
    margin-top: 12px;
  }

  .selectHeroExperiment_Label {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 700;
    color: var(--color-gray-900);
    cursor: default;
  }

  .selectHeroExperiment_Value[data-placeholder] {
    opacity: 0.6;
  }

  .selectHeroExperiment_Select {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    height: 2.5rem;
    padding-left: 0.875rem;
    padding-right: 0.75rem;
    margin: 0;
    outline: 0;
    border: 1px solid var(--color-gray-200);
    border-radius: 0.375rem;
    background-color: canvas;
    font-family: ${ARABIC_FONT_FAMILY};
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: 400;
    color: var(--color-gray-900);
    -webkit-user-select: none;
    user-select: none;
    min-width: 10rem;
    direction: rtl;
  }

  @media (hover: hover) {
    .selectHeroExperiment_Select:hover {
      background-color: var(--color-gray-100);
    }
  }

  .selectHeroExperiment_Select[data-popup-open] {
    background-color: var(--color-gray-100);
  }

  .selectHeroExperiment_Select:focus-visible {
    outline: 2px solid var(--color-blue);
    outline-offset: -1px;
  }

  .selectHeroExperiment_SelectIcon {
    display: flex;
  }

  .selectHeroExperiment_Positioner {
    outline: none;
    z-index: 1;
    -webkit-user-select: none;
    user-select: none;
    direction: rtl;
  }

  .selectHeroExperiment_Popup {
    box-sizing: border-box;
    border-radius: 0.375rem;
    background-color: canvas;
    background-clip: padding-box;
    color: var(--color-gray-900);
    min-width: var(--anchor-width);
    transform-origin: var(--transform-origin);
    transition:
      transform 150ms,
      opacity 150ms;
    font-family: ${ARABIC_FONT_FAMILY};
    direction: rtl;
  }

  .selectHeroExperiment_Popup[data-starting-style],
  .selectHeroExperiment_Popup[data-ending-style] {
    opacity: 0;
    transform: scale(0.9);
  }

  .selectHeroExperiment_Popup[data-side='none'] {
    transition: none;
    transform: none;
    opacity: 1;
    min-width: calc(var(--anchor-width) + 1rem);
  }

  @media (prefers-color-scheme: light) {
    .selectHeroExperiment_Popup {
      outline: 1px solid var(--color-gray-200);
      box-shadow:
        0 10px 15px -3px var(--color-gray-200),
        0 4px 6px -4px var(--color-gray-200);
    }
  }

  @media (prefers-color-scheme: dark) {
    .selectHeroExperiment_Popup {
      outline: 1px solid var(--color-gray-300);
    }
  }

  .selectHeroExperiment_List {
    box-sizing: border-box;
    position: relative;
    padding-block: 0.25rem;
    overflow-y: auto;
    max-height: var(--available-height);
    scroll-padding-block: 1.5rem;
  }

  .selectHeroExperiment_Item {
    box-sizing: border-box;
    outline: 0;
    font-size: 0.875rem;
    line-height: 1rem;
    padding-block: 0.5rem;
    padding-left: 1rem;
    padding-right: 0.625rem;
    display: grid;
    gap: 0.5rem;
    align-items: center;
    grid-template-columns: 0.75rem 1fr;
    cursor: default;
    -webkit-user-select: none;
    user-select: none;
    direction: rtl;
  }

  @media (pointer: coarse) {
    .selectHeroExperiment_Item {
      padding-block: 0.625rem;
      font-size: 0.925rem;
    }
  }

  [data-side='none'] .selectHeroExperiment_Item {
    font-size: 1rem;
    padding-left: 3rem;
    padding-right: 0.625rem;
  }

  .selectHeroExperiment_Item[data-highlighted] {
    z-index: 0;
    position: relative;
    color: var(--color-gray-50);
  }

  .selectHeroExperiment_Item[data-highlighted]::before {
    content: '';
    z-index: -1;
    position: absolute;
    inset-block: 0;
    inset-inline: 0.25rem;
    border-radius: 0.25rem;
    background-color: var(--color-gray-900);
  }

  .selectHeroExperiment_ItemIndicator {
    grid-column-start: 1;
  }

  .selectHeroExperiment_ItemIndicatorIcon {
    display: block;
    width: 0.75rem;
    height: 0.75rem;
  }

  .selectHeroExperiment_ItemText {
    grid-column-start: 2;
  }
`;

export default function SelectRtlAlignItemWithTriggerExperiment() {
  const [open, setOpen] = React.useState(false);

  return (
    <div dir="rtl" className="selectHeroExperiment_Page">
      <style>{CSS}</style>
      <DirectionProvider direction="rtl">
        <div className="selectHeroExperiment_Container">
          <h1 className="selectHeroExperiment_Title">RTL Select alignment</h1>
          <p className="selectHeroExperiment_Description">
            تجربة بسيطة لاختبار محاذاة <code>Select</code> في الاتجاه من اليمين إلى اليسار.
          </p>

          <div className="selectHeroExperiment_Field">
            <Select.Root defaultValue="arabic" open={open} onOpenChange={setOpen}>
              <Select.Label className="selectHeroExperiment_Label">اللهجة</Select.Label>
              <Select.Trigger className="selectHeroExperiment_Select">
                <Select.Value className="selectHeroExperiment_Value">
                  {(value) =>
                    OPTIONS.find((option) => option.value === value)?.label ?? 'اختر لهجة'
                  }
                </Select.Value>
                <Select.Icon className="selectHeroExperiment_SelectIcon">
                  <ChevronUpDownIcon />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Positioner
                  className="selectHeroExperiment_Positioner"
                  dir="rtl"
                  sideOffset={8}
                >
                  <Select.Popup className="selectHeroExperiment_Popup" dir="rtl">
                    <Select.List className="selectHeroExperiment_List">
                      {OPTIONS.map(({ label, value }) => (
                        <Select.Item
                          key={value}
                          value={value}
                          className="selectHeroExperiment_Item"
                        >
                          <Select.ItemIndicator className="selectHeroExperiment_ItemIndicator">
                            <CheckIcon className="selectHeroExperiment_ItemIndicatorIcon" />
                          </Select.ItemIndicator>
                          <Select.ItemText className="selectHeroExperiment_ItemText">
                            {label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        </div>
      </DirectionProvider>
    </div>
  );
}

function ChevronUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M0.5 4.5L4 1.5L7.5 4.5" />
      <path d="M0.5 7.5L4 10.5L7.5 7.5" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}
