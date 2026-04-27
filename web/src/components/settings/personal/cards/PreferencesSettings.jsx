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

import React, { useState, useEffect, useContext } from 'react';
import { Avatar, Card, ListBox } from '@heroui/react';
import { CellSelect } from '@heroui-pro/react';
import { ChevronsUpDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess, showError } from '../../../../helpers';
import { UserContext } from '../../../../context/User';
import { normalizeLanguage } from '../../../../i18n/language';

// Only Chinese and English are surfaced as user-pickable options; other
// locales remain bundled so saved preferences keep working.
const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];

const PreferencesSettings = ({ t }) => {
  const { i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [currentLanguage, setCurrentLanguage] = useState(
    normalizeLanguage(i18n.language) || 'zh-CN',
  );
  const [loading, setLoading] = useState(false);

  // Load saved language preference from user settings
  useEffect(() => {
    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        if (settings.language) {
          const lang = normalizeLanguage(settings.language);
          setCurrentLanguage(lang);
          if (i18n.language !== lang) {
            i18n.changeLanguage(lang);
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, [userState?.user?.setting, i18n]);

  const handleLanguagePreferenceChange = async (lang) => {
    if (lang === currentLanguage) return;

    setLoading(true);

    // Apply UI change immediately and persist locally so the preference
    // always sticks on this device, even if backend persistence fails.
    setCurrentLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);

    // Mirror into cached user.setting so layout effects don't override it.
    let settings = {};
    if (userState?.user?.setting) {
      try {
        settings = JSON.parse(userState.user.setting) || {};
      } catch (e) {
        settings = {};
      }
    }
    settings.language = lang;
    if (userState?.user) {
      const nextUser = {
        ...userState.user,
        setting: JSON.stringify(settings),
      };
      userDispatch({ type: 'login', payload: nextUser });
      localStorage.setItem('user', JSON.stringify(nextUser));
    }

    try {
      const res = await API.put(
        '/api/user/self',
        { language: lang },
        { skipErrorHandler: true },
      );

      if (res.data?.success) {
        showSuccess(t('语言偏好已保存'));
      } else {
        showError(res.data?.message || t('保存失败'));
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='!rounded-2xl' shadow='none'>
      <Card.Content className='p-5'>
        {/* Card header */}
        <div className='mb-4 flex items-center gap-3'>
          <Avatar size='sm' className='shadow-md'>
            <Avatar.Fallback className='!bg-violet-100 !text-violet-600 dark:!bg-violet-900/30 dark:!text-violet-300'>
              <Languages size={16} />
            </Avatar.Fallback>
          </Avatar>
          <div className='flex flex-col'>
            <span className='text-base font-semibold text-foreground'>
              {t('偏好设置')}
            </span>
            <span className='text-xs text-muted'>
              {t('界面语言和其他个人偏好')}
            </span>
          </div>
        </div>

        {/* Language preference row */}
        <Card className='!rounded-xl' shadow='none'>
          <Card.Content className='flex flex-col gap-3 p-4'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30'>
                <Languages
                  size={20}
                  className='text-violet-600 dark:text-violet-400'
                />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='mb-1 text-sm font-semibold text-foreground'>
                  {t('语言偏好')}
                </div>
                <p className='text-xs text-muted'>
                  {t('选择您的首选界面语言，设置将自动保存并同步到所有设备')}
                </p>
              </div>
            </div>
            <CellSelect
              aria-label={t('语言偏好')}
              isDisabled={loading}
              selectedKey={currentLanguage}
              onSelectionChange={(key) => {
                if (key) handleLanguagePreferenceChange(String(key));
              }}
            >
              <CellSelect.Trigger>
                <CellSelect.Label>{t('界面语言')}</CellSelect.Label>
                <CellSelect.Value />
                <CellSelect.Indicator>
                  <ChevronsUpDown size={14} />
                </CellSelect.Indicator>
              </CellSelect.Trigger>
              <CellSelect.Popover>
                <ListBox>
                  {languageOptions.map((opt) => (
                    <ListBox.Item
                      key={opt.value}
                      id={opt.value}
                      textValue={opt.label}
                    >
                      {opt.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </CellSelect.Popover>
            </CellSelect>
          </Card.Content>
        </Card>

        {/* Helper text */}
        <div className='mt-4 text-xs text-muted'>
          {t(
            '提示：语言偏好会同步到您登录的所有设备，并影响API返回的错误消息语言。',
          )}
        </div>
      </Card.Content>
    </Card>
  );
};

export default PreferencesSettings;
