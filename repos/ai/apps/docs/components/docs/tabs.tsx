'use client';

import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';

/**
 * Positional tabs matching the legacy ai-sdk.dev API:
 * `<Tabs items={['a', 'b']}><Tab>…</Tab><Tab>…</Tab></Tabs>`
 */
export const Tabs = ({
  items,
  children,
  label = 'Options',
}: {
  items: string[];
  children: ReactNode;
  label?: string;
}) => {
  const [active, setActive] = useState(0);
  const panels = Array.isArray(children) ? children : [children];
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectTab = (index: number) => {
    const nextIndex = (index + items.length) % items.length;
    setActive(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectTab(active + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectTab(active - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectTab(items.length - 1);
    }
  };

  return (
    <div className="not-prose my-4 rounded-md border border-gray-alpha-400">
      <div
        className="flex flex-row gap-1 border-gray-alpha-400 border-b px-2 pt-2"
        aria-label={label}
        aria-orientation="horizontal"
        role="tablist"
      >
        {items.map((item, index) => (
          <button
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            className={`rounded-t-md px-3 py-1.5 text-sm ${
              index === active
                ? 'font-medium text-gray-1000 shadow-[inset_0_-2px_0_0_var(--ds-gray-1000)]'
                : 'text-gray-900 hover:text-gray-1000'
            }`}
            id={`${id}-tab-${index}`}
            key={item}
            onClick={() => setActive(index)}
            onKeyDown={handleKeyDown}
            ref={element => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            tabIndex={index === active ? 0 : -1}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          aria-labelledby={`${id}-tab-${index}`}
          className="p-4 outline-none [&_figure]:my-0 [&_pre]:my-0"
          hidden={index !== active}
          id={`${id}-panel-${index}`}
          key={`${id}-panel-${index}`}
          role="tabpanel"
          tabIndex={index === active ? 0 : -1}
        >
          {panel}
        </div>
      ))}
    </div>
  );
};

export const Tab = ({ children }: { children: ReactNode }) => <>{children}</>;
