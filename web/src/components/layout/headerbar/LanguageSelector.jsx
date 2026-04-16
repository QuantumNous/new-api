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

import React from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { Languages } from 'lucide-react';
import { useActualTheme } from '../../../context/Theme';

const languageOptions = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'zh-TW', label: '繁體中文' },
  { key: 'en', label: 'English' },
];

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  const actualTheme = useActualTheme();
  const isDark = actualTheme === 'dark';

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu
          className={`!shadow-lg !rounded-lg ${
            isDark
              ? '!bg-semi-color-bg-overlay !border-semi-color-border dark:!bg-gray-700 dark:!border-gray-600'
              : '!bg-white !border-gray-200'
          }`}
        >
          {/* Language sorting: Order by English name (Chinese, English, French, Japanese, Russian) */}
          {languageOptions.map((option) => (
            <Dropdown.Item
              key={option.key}
              onClick={() => onLanguageChange(option.key)}
              className={`!px-3 !py-1.5 !text-sm ${
                isDark
                  ? `dark:!text-gray-200 ${
                      currentLang === option.key
                        ? '!bg-semi-color-primary-light-default dark:!bg-blue-600 !font-semibold'
                        : '!text-semi-color-text-0 hover:!bg-semi-color-fill-1 dark:hover:!bg-gray-600'
                    }`
                  : `${
                      currentLang === option.key
                        ? '!bg-semi-color-primary-light-default !font-semibold'
                        : '!text-semi-color-text-0 hover:!bg-semi-color-fill-1'
                    }`
              }`}
            >
              {option.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      }
    >
      <Button
        icon={<Languages size={18} />}
        aria-label={t('common.changeLanguage')}
        theme='borderless'
        type='tertiary'
        className='!p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 !rounded-full !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2'
      />
    </Dropdown>
  );
};

export default LanguageSelector;
