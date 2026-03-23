import React from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { Languages } from 'lucide-react';

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu className='header-dropdown-menu'>
          {/* Language sorting: Order by English name (Chinese, English, French, Japanese, Russian) */}
          <Dropdown.Item
            onClick={() => onLanguageChange('zh-CN')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'zh-CN' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            简体中文
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('zh-TW')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'zh-TW' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            繁體中文
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('en')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'en' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            English
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('fr')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'fr' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            Français
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('ja')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'ja' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            日本語
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('ru')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'ru' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            Русский
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('vi')}
            className={`header-dropdown-item !px-3 !py-1.5 !text-sm ${currentLang === 'vi' ? 'header-dropdown-item--active !font-semibold' : ''}`}
          >
            Tiếng Việt
          </Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <Button
        icon={<Languages size={18} />}
        aria-label={t('common.changeLanguage')}
        theme='borderless'
        type='tertiary'
        className='header-icon-button !text-current !rounded-full'
      />
    </Dropdown>
  );
};

export default LanguageSelector;
