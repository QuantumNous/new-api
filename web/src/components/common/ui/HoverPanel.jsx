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
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-0 mr-2',
  right: 'left-full top-0 ml-2',
  bottomLeft: 'top-full left-0 mt-1.5',
  bottomRight: 'top-full right-0 mt-1.5',
  topLeft: 'bottom-full left-0 mb-1.5',
  topRight: 'bottom-full right-0 mb-1.5',
};

/**
 * HoverPanel — drop-in replacement for Semi UI's Popover with hover trigger.
 * - Renders inline next to children (relative wrapper).
 * - Opens on mouseenter/focusin, closes 100ms after mouseleave/focusout.
 * - `placement` accepts top/bottom/left/right + their corner variants.
 * - `panelClassName` is appended to the panel wrapper for sizing/styling.
 */
const HoverPanel = ({
  children,
  content,
  placement = 'top',
  panelClassName = '',
  delay = 100,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  const show = () => {
    if (disabled) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(true);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const place = PLACEMENT_CLASSES[placement] || PLACEMENT_CLASSES.top;

  return (
    <span
      ref={ref}
      className='relative inline-flex'
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {open ? (
        <div
          role='tooltip'
          className={`absolute z-30 rounded-lg border border-[color:var(--app-border)] bg-white p-3 text-xs shadow-lg dark:bg-slate-900 ${place} ${panelClassName}`}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
};

export default HoverPanel;
