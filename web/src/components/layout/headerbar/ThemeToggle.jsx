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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useActualTheme } from '../../../context/Theme';

const ThemeToggle = ({ theme, onThemeToggle, t }) => {
  const actualTheme = useActualTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const themeOptions = useMemo(
    () => [
      {
        key: 'light',
        icon: <Sun size={18} />,
        buttonIcon: <Sun size={18} />,
        label: t('浅色模式'),
        description: t('始终使用浅色主题'),
      },
      {
        key: 'dark',
        icon: <Moon size={18} />,
        buttonIcon: <Moon size={18} />,
        label: t('深色模式'),
        description: t('始终使用深色主题'),
      },
      {
        key: 'auto',
        icon: <Monitor size={18} />,
        buttonIcon: <Monitor size={18} />,
        label: t('自动模式'),
        description: t('跟随系统主题设置'),
      },
    ],
    [t],
  );

  const currentButtonIcon = useMemo(() => {
    const currentOption = themeOptions.find((option) => option.key === theme);
    return currentOption?.buttonIcon || themeOptions[2].buttonIcon;
  }, [theme, themeOptions]);

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

  const handleThemeSelect = (key) => {
    onThemeToggle(key);
    setOpen(false);
  };

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        type='button'
        aria-label={t('切换主题')}
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className='inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-surface-secondary text-foreground transition-colors hover:bg-surface-secondary/70'
      >
        {currentButtonIcon}
      </button>

      {open ? (
        // Font-size lives on the wrapper, not the buttons: `@heroui/styles`
        // resets `button { font-size: inherit }` outside any @layer, which
        // beats every Tailwind utility per CSS Cascade Layers, so the
        // buttons would otherwise inherit body's 16px. Set 14px here and
        // let the menu items inherit it; nested spans (description / auto
        // hint) keep their own `text-xs` since spans aren't reset-targeted.
        <div
          role='menu'
          aria-label={t('切换主题')}
          className='absolute right-0 top-full z-50 mt-2 min-w-52 rounded-2xl border border-border bg-background/95 p-1 text-[14px] leading-5 shadow-xl backdrop-blur'
        >
          {themeOptions.map((option) => (
            <button
              key={option.key}
              type='button'
              role='menuitemradio'
              aria-checked={theme === option.key}
              onClick={() => handleThemeSelect(option.key)}
              className={`flex w-full cursor-pointer items-start gap-2 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-surface-secondary ${
                theme === option.key ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <span className='mt-0.5 text-muted'>{option.icon}</span>
              <span className='flex flex-col'>
                <span>{option.label}</span>
                <span className='text-xs text-muted'>
                  {option.description}
                </span>
              </span>
            </button>
          ))}

          {theme === 'auto' ? (
            <div className='px-3 py-2 text-xs text-muted'>
              {t('当前跟随系统')}：
              {actualTheme === 'dark' ? t('深色') : t('浅色')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ThemeToggle;
