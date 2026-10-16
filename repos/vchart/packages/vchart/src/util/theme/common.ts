import type { ITheme } from '../../theme';
// eslint-disable-next-line no-duplicate-imports
import { ThemeManager } from '../../theme';
import { isObject, isString } from '@visactor/vutils';

export function getThemeObject(theme?: string | ITheme): ITheme {
  if (isString(theme)) {
    if (ThemeManager.themeExist(theme)) {
      return ThemeManager.getTheme(theme);
    }
    return {};
  } else if (isObject(theme)) {
    return theme;
  }
  return {};
}
