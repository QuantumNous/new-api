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
  const languages = [
    ['zh-CN', '简体中文'],
    ['zh-TW', '繁體中文'],
    ['en', 'English'],
    ['fr', 'Français'],
    ['ja', '日本語'],
    ['ru', 'Русский'],
    ['vi', 'Tiếng Việt'],
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
        className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/[0.04] text-slate-700 transition-colors hover:bg-slate-900/[0.07] dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
      >
        <Languages size={18} />
      </button>

      {open ? (
        <div
          role='menu'
          aria-label={t('common.changeLanguage')}
          className='absolute right-0 top-full z-50 mt-2 min-w-40 rounded-2xl border border-slate-200/80 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95'
        >
          {languages.map(([key, label]) => (
            <button
              key={key}
              type='button'
              role='menuitemradio'
              aria-checked={currentLang === key}
              onClick={() => handleLanguageSelect(key)}
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/10 ${
                currentLang === key ? 'bg-primary/10 text-primary' : ''
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
