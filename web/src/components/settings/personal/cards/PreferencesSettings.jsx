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
import { Card, Select } from '@douyinfe/semi-ui';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess, showError } from '../../../../helpers';
import { UserContext } from '../../../../context/User';
import { normalizeLanguage } from '../../../../i18n/language';

// Language options with native names
const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ru', label: 'Русский' },
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
];

const PreferencesSettings = ({ t }) => {
  const { i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [currentLanguage, setCurrentLanguage] = useState(
    normalizeLanguage(i18n.language) || 'zh-CN',
  );
  const [loading, setLoading] = useState(false);

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
        // Ignore parse errors
      }
    }
  }, [userState?.user?.setting, i18n]);

  const handleLanguagePreferenceChange = async (lang) => {
    if (lang === currentLanguage) return;

    setLoading(true);
    const previousLang = currentLanguage;

    try {
      setCurrentLanguage(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem('i18nextLng', lang);

      const res = await API.put('/api/user/self', {
        language: lang,
      });

      if (res.data.success) {
        showSuccess(t('语言偏好已保存'));
        let settings = {};
        if (userState?.user?.setting) {
          try {
            settings = JSON.parse(userState.user.setting) || {};
          } catch (e) {
            settings = {};
          }
        }
        settings.language = lang;
        const nextUser = {
          ...userState.user,
          setting: JSON.stringify(settings),
        };
        userDispatch({
          type: 'login',
          payload: nextUser,
        });
        localStorage.setItem('user', JSON.stringify(nextUser));
      } else {
        showError(res.data.message || t('保存失败'));
        setCurrentLanguage(previousLang);
        i18n.changeLanguage(previousLang);
        localStorage.setItem('i18nextLng', previousLang);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
      setCurrentLanguage(previousLang);
      i18n.changeLanguage(previousLang);
      localStorage.setItem('i18nextLng', previousLang);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='personal-settings-surface personal-settings-section-card'>
      <div className='personal-settings-card-head'>
        <div className='personal-settings-card-title-row'>
          <span className='personal-settings-card-icon'>
            <Languages size={16} strokeWidth={2.1} />
          </span>
          <div>
            <h2 className='personal-settings-card-title'>{t('偏好设置')}</h2>
            <p className='personal-settings-card-subtitle'>
              {t('管理界面语言和账户使用偏好')}
            </p>
          </div>
        </div>
      </div>

      <div className='personal-settings-item-card personal-settings-form-row'>
        <div className='personal-settings-form-copy'>
          <div className='personal-settings-item-title'>{t('语言偏好')}</div>
          <p className='personal-settings-item-text'>
            {t('选择首选界面语言，设置会同步到当前账户使用的设备')}
          </p>
        </div>
        <Select
          value={currentLanguage}
          onChange={handleLanguagePreferenceChange}
          style={{ width: 200 }}
          loading={loading}
          className='personal-settings-select'
          optionList={languageOptions.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
        />
      </div>

      <p className='personal-settings-note'>
        {t(
          '提示：语言偏好会同步到你登录的设备，并影响前端界面与部分提示信息。',
        )}
      </p>
    </Card>
  );
};

export default PreferencesSettings;
