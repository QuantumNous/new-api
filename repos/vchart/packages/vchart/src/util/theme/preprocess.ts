import { isPlainObject } from '@visactor/vutils';
import type { IThemeColorScheme } from '../../theme/color-scheme/interface';
import { getActualColor, isColorKey } from '../../theme/color-scheme/util';
import type { TokenMap } from '../../theme/token';
// eslint-disable-next-line no-duplicate-imports
import { isTokenKey, queryToken } from '../../theme/token';
import type { ITheme } from '../../theme';

const IGNORE_KEYS = ['animationThreshold', 'colorScheme', 'name', 'padding'];

export function preprocessTheme(obj: any, colorScheme?: IThemeColorScheme, tokenMap?: TokenMap): any {
  if (!obj) {
    return obj;
  }
  if (!colorScheme) {
    colorScheme = (obj as ITheme).colorScheme;
  }
  if (!tokenMap) {
    tokenMap = (obj as ITheme).token;
  }
  const newObj = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (IGNORE_KEYS.includes(key)) {
      (newObj as any)[key] = value;
    } else if (isPlainObject(value)) {
      if (isColorKey(value)) {
        // 查询、替换语义化颜色
        (newObj as any)[key] = getActualColor(value, colorScheme);
      } else if (isTokenKey(value)) {
        // 查询、替换语义化 token
        (newObj as any)[key] = queryToken(tokenMap, value);
      } else {
        (newObj as any)[key] = preprocessTheme(value, colorScheme, tokenMap);
      }
    } else {
      (newObj as any)[key] = value;
    }
  });

  return newObj;
}
