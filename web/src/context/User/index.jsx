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

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reducer, initialState } from './reducer';
import { setCookie } from '../../helpers/cookie';

export const UserContext = React.createContext({
  state: initialState,
  dispatch: () => null,
});

export const UserProvider = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const { i18n } = useTranslation();

  // Sync language preference when user data is loaded
  useEffect(() => {
    if (state.user?.setting) {
      try {
        const settings = JSON.parse(state.user.setting);
        if (settings.language && settings.language !== i18n.language) {
          i18n.changeLanguage(settings.language);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [state.user?.setting, i18n]);

  // Sync oc_logged_in cookie so the frontend (openclawapi.ai) can detect login state
  useEffect(() => {
    try {
      if (state.user) {
        setCookie('oc_logged_in', '1');
      } else {
        // Clear the cookie on logout by setting max-age=0
        document.cookie = 'oc_logged_in=; path=/; max-age=0; domain=.openclawapi.ai';
        document.cookie = 'oc_logged_in=; path=/; max-age=0';
      }
    } catch (e) {
      // ignore
    }
  }, [state.user]);

  return (
    <UserContext.Provider value={[state, dispatch]}>
      {children}
    </UserContext.Provider>
  );
};
