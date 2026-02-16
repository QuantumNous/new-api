/**
 * 与官网一致：点击直接切换语言（无下拉），显示目标语言名称。
 */

import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { Globe } from 'lucide-react';

const localeNames = { en: 'English', zh: '中文' };

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  const nextLang = currentLang === 'zh' ? 'en' : 'zh';
  return (
    <Button
      icon={<Globe size={15} />}
      aria-label={t('common.changeLanguage')}
      theme='borderless'
      type='tertiary'
      onClick={() => onLanguageChange(nextLang)}
      className='!flex !items-center !gap-1.5 !px-2.5 !py-1.5 !text-sm !rounded-lg !bg-transparent hover:!bg-semi-color-fill-1 focus:!bg-semi-color-fill-1'
    >
      <span className='!text-semi-color-text-1'>{localeNames[nextLang]}</span>
    </Button>
  );
};

export default LanguageSelector;
