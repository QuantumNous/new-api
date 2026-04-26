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
import { Languages } from 'lucide-react';

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  // Only Chinese and English are surfaced in the navbar switcher; other
  // locales remain in the underlying i18n bundle (so saved preferences keep
  // working) but are intentionally hidden from the chooser.
  const languages = [
    ['zh-CN', '简体中文'],
    ['en', 'English'],
  ];

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

  const handleLanguageSelect = (lang) => {
    onLanguageChange(lang);
    setOpen(false);
  };

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        type='button'
        aria-label={t('common.changeLanguage')}
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-foreground transition-colors hover:bg-surface-tertiary'
      >
        <Languages size={18} />
      </button>

      {open ? (
        <div
          role='menu'
          aria-label={t('common.changeLanguage')}
          className='absolute right-0 top-full z-50 mt-2 min-w-36 rounded-xl border border-border bg-background p-1 shadow-lg'
        >
          {languages.map(([key, label]) => (
            <button
              key={key}
              type='button'
              role='menuitemradio'
              aria-checked={currentLang === key}
              onClick={() => handleLanguageSelect(key)}
              className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-[14px] leading-5 transition-colors hover:bg-surface-secondary ${
                currentLang === key
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default LanguageSelector;
