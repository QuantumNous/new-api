'use client';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import styles from './combobox-composition.module.css';

export default function ComboboxComposition() {
  const id = React.useId();
  const [inputValue, setInputValue] = React.useState('');
  return (
    <div className={styles.Root}>
      <Combobox.Root items={fruitsKo} inputValue={inputValue} onInputValueChange={setInputValue}>
        <div className={styles.Field}>
          <label htmlFor={id}>과일을 선택하세요</label>
          <Combobox.Input placeholder="예: 사과" id={id} className={styles.Input} />
          <div className={styles.Actions}>
            <Combobox.Clear className={styles.ActionButton} aria-label="선택 지우기">
              <ClearIcon className={styles.ActionIcon} />
            </Combobox.Clear>
            <Combobox.Trigger className={styles.ActionButton} aria-label="팝업 열기">
              <ChevronDownIcon className={styles.ActionIcon} />
            </Combobox.Trigger>
          </div>
        </div>

        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <Combobox.Empty className={styles.Empty}>해당하는 과일이 없습니다.</Combobox.Empty>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item} className={styles.Item}>
                    <Combobox.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Combobox.ItemIndicator>
                    <div className={styles.ItemText}>{item}</div>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function ClearIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const fruitsKo = [
  '사과',
  '바나나',
  '오렌지',
  '파인애플',
  '포도',
  '망고',
  '딸기',
  '블루베리',
  '라즈베리',
  '블랙베리',
  '체리',
  '복숭아',
  '배',
  '자두',
  '키위',
  '수박',
  '칸탈루프',
  '허니듀',
  '파파야',
  '구아바',
  '리치',
  '석류',
  '살구',
  '자몽',
  '패션프루트',
];
