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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react';

const ThemeContext = createContext('light');
export const useTheme = () => useContext(ThemeContext);

const ActualThemeContext = createContext('light');
export const useActualTheme = () => useContext(ActualThemeContext);

const SetThemeContext = createContext(() => {});
export const useSetTheme = () => useContext(SetThemeContext);

export const ThemeProvider = ({ children }) => {
  const theme = 'light';
  const actualTheme = 'light';

  useEffect(() => {
    const body = document.body;
    body.removeAttribute('theme-mode');
    document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem('theme-mode', 'light');
    } catch {
      // ignore storage errors
    }
  }, []);

  const setTheme = useCallback(() => {
    try {
      localStorage.setItem('theme-mode', 'light');
    } catch {
      // ignore storage errors
    }
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ActualThemeContext.Provider value={actualTheme}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </ActualThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};
