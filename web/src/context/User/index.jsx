import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reducer, initialState } from './reducer';
import { normalizeLanguage } from '../../i18n/language';

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
        const normalizedLanguage = normalizeLanguage(settings.language);
        if (normalizedLanguage && normalizedLanguage !== i18n.language) {
          i18n.changeLanguage(normalizedLanguage);
        }
        if (normalizedLanguage) {
          localStorage.setItem('i18nextLng', normalizedLanguage);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [state.user?.setting, i18n]);

  return (
    <UserContext.Provider value={[state, dispatch]}>
      {children}
    </UserContext.Provider>
  );
};
