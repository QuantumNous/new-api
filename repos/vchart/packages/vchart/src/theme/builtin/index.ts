export * from './light';
export * from './dark';

import { isString } from '@visactor/vutils';
import { mergeTheme } from '../../util/theme/merge-theme';
import type { ITheme } from '../interface';
import { lightTheme } from './light';
import { getFunnelTheme } from './common/series/funnel';
// import { darkTheme } from './dark';
// import { preprocessTheme } from '../../util/theme/preprocess';

/** 声明内置主题(含 token 未转换) */
export const builtinThemes: Record<string, ITheme> = {
  [lightTheme.name]: lightTheme
  // [darkTheme.name]: darkTheme
};
/** 默认主题名称 */
export const defaultThemeName = lightTheme.name;

/** 全局主题 map (包含用户新注册的主题)(含 token 未转换) */
export const themes: Map<string, ITheme> = new Map(Object.keys(builtinThemes).map(key => [key, builtinThemes[key]]));

/** 全局已将 token 转换的主题 map (包含用户新注册的主题) */
const transformedThemes: Map<string, ITheme> = new Map();
// Object.keys(builtinThemes).map(key => [key, preprocessTheme(builtinThemes[key])] as [string, ITheme])

/** 主题 map 中的元素是否 merge 过默认主题 (非默认主题的其他内置主题没有 merge 过默认主题) */
export const hasThemeMerged: Map<string, boolean> = new Map(
  Object.keys(builtinThemes).map(key => [key, key === defaultThemeName])
);

/** 注册主题 */
export const registerTheme = (name: string, theme: Partial<ITheme>) => {
  if (!name) {
    return;
  }
  // 所有主题基于默认主题扩展，保证基础值
  const mergedTheme = getMergedTheme(theme);
  themes.set(name, mergedTheme);

  hasThemeMerged.set(name, true);
};
/**
 * 获取注册过的主题
 * @param name 主题名称
 * @param transformed 是否获取 token 转换后的主题
 * @returns 返回主题
 */
export const getTheme = (name: string = defaultThemeName) => {
  if (hasThemeMerged.has(name) && !hasThemeMerged.get(name)) {
    // 重新 merge 默认主题
    registerTheme(name, themes.get(name));
  }

  return themes.get(name);
};

/** 删除主题 */
export const removeTheme = (name: string): boolean => {
  return themes.delete(name) && transformedThemes.delete(name) && hasThemeMerged.delete(name);
};

/** 主题是否存在 */
export const themeExist = (name: any) => {
  if (!isString(name)) {
    return false;
  }
  return themes.has(name);
};

/** 使新主题基于默认主题扩展，保证基础值 */
export const getMergedTheme = (theme: Partial<ITheme>): ITheme => {
  const baseThemeName = theme.type ?? defaultThemeName;
  const baseTheme = getTheme(baseThemeName);
  return mergeTheme({}, baseTheme, theme);
};

export { getFunnelTheme };
