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

import React, { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from './context/User';
import { StatusContext } from './context/Status';
import { API } from './helpers/api';
import { setStatusData } from './helpers/data';
import { getLogo, getSystemName, showError } from './helpers/utils';
import { normalizeLanguage } from './i18n/language';

function applyBranding() {
  const systemName = getSystemName();
  if (systemName) {
    document.title = systemName;
  }

  const logo = getLogo();
  if (logo) {
    const linkElement = document.querySelector("link[rel~='icon']");
    if (linkElement) {
      linkElement.href = logo;
    }
  }
}

const AppBootstrap = ({ children }) => {
  const [userState, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const { i18n } = useTranslation();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      userDispatch({ type: 'login', payload: JSON.parse(user) });
    }

    applyBranding();

    const loadStatus = async () => {
      try {
        const res = await API.get('/api/status');
        const { success, data } = res.data;
        if (success) {
          statusDispatch({ type: 'set', payload: data });
          setStatusData(data);
          applyBranding();
        } else {
          showError('Unable to connect to server');
        }
      } catch (error) {
        showError('Failed to load status');
      }
    };

    loadStatus().catch(console.error);
  }, [statusDispatch, userDispatch]);

  useEffect(() => {
    let preferredLang;

    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) {
        preferredLang = undefined;
      }
    }

    if (!preferredLang) {
      const savedLang = localStorage.getItem('i18nextLng');
      if (savedLang) {
        preferredLang = normalizeLanguage(savedLang);
      }
    }

    if (preferredLang) {
      localStorage.setItem('i18nextLng', preferredLang);
      if (preferredLang !== i18n.language) {
        i18n.changeLanguage(preferredLang);
      }
    }
  }, [i18n, userState?.user?.setting]);

  return children;
};

export default AppBootstrap;
