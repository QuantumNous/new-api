/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';

const PLACEMENT_CLASSES = {
  bottomLeft: 'top-full left-0 mt-1',
  bottomRight: 'top-full right-0 mt-1',
  topLeft: 'bottom-full left-0 mb-1',
  topRight: 'bottom-full right-0 mb-1',
};

/**
 * ClickMenu — click-triggered dropdown menu.
 * - Items: `[{ label, onClick, danger?, disabled?, divider? }]`
 * - `trigger` is the clickable element (rendered inline).
 * - Closes on outside click and after item selection.
 */
const ClickMenu = ({
  trigger,
  items = [],
  placement = 'bottomRight',
  menuClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const place = PLACEMENT_CLASSES[placement] || PLACEMENT_CLASSES.bottomRight;

  return (
    <span ref={ref} className='relative inline-flex'>
      <span
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        {trigger}
      </span>
      {open ? (
        <div
          role='menu'
          className={`absolute z-30 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-background shadow-lg ${place} ${menuClassName}`}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${idx}`}
                  className='my-1 h-px bg-[color:var(--app-border)]'
                />
              );
            }
            return (
              <button
                key={`item-${idx}`}
                type='button'
                role='menuitem'
                disabled={item.disabled}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                    : 'text-foreground hover:bg-[color:var(--app-background)]'
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.icon}
                <span className='min-w-0 flex-1'>{item.label}</span>
                {item.suffix}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
};

export default ClickMenu;
