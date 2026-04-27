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
import fireworks from 'react-fireworks';

const NewYearButton = ({ isNewYear }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!isNewYear) {
    return null;
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setOpen(false);
    setTimeout(() => {
      fireworks.stop();
    }, 3000);
  };

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        type='button'
        aria-label='New Year'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className='inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary'
      >
        <span className='text-xl'>🎉</span>
      </button>

      {open ? (
        <div
          role='menu'
          aria-label='New Year'
          className='absolute right-0 top-full z-50 mt-2 min-w-44 rounded-2xl border border-border bg-background/95 p-1 shadow-xl backdrop-blur'
        >
          <button
            type='button'
            role='menuitem'
            onClick={handleNewYearClick}
            className='flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary'
          >
            Happy New Year!!! 🎉
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default NewYearButton;
