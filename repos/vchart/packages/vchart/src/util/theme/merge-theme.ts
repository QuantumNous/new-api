import type { Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { array } from '@visactor/vutils';
import type { IGlobalMarkThemeByName, IGlobalMarkThemeByType, ITheme } from '../../theme';
import { transformColorSchemeToStandardStruct } from '../../theme/color-scheme/util';
import type { IThemeColorScheme } from '../../theme/color-scheme/interface';
// eslint-disable-next-line no-duplicate-imports
import type { ISeriesMarkInfo } from '../../series/interface/common';
import { mergeSpec } from '@visactor/vutils-extension';
import { Factory } from '../../core/factory';

export function mergeTheme(target: Maybe<ITheme>, ...sources: Maybe<ITheme>[]): Maybe<ITheme> {
  return mergeSpec(transformThemeToMerge(target), ...sources.map(transformThemeToMerge));
}

function transformThemeToMerge(theme?: Maybe<ITheme>): Maybe<ITheme> {
  if (!theme) {
    return theme;
  }

  // 将色板转化为标准形式
  const colorScheme = transformColorSchemeToMerge(theme.colorScheme);

  return Object.assign({}, theme, {
    colorScheme,
    token: theme.token ?? {},
    series: Object.assign({}, theme.series)
  } as Partial<ITheme>);
}

/** 将色板转化为标准形式 */
export function transformColorSchemeToMerge(colorScheme?: Maybe<IThemeColorScheme>): Maybe<IThemeColorScheme> {
  if (colorScheme) {
    colorScheme = Object.keys(colorScheme).reduce<IThemeColorScheme>((scheme, key) => {
      const value = colorScheme[key];
      scheme[key] = transformColorSchemeToStandardStruct(value);
      return scheme;
    }, {} as IThemeColorScheme);
  }
  return colorScheme;
}

/** 将全局 mark 主题 merge 进系列主题 */
export function transformSeriesThemeToMerge(
  seriesTheme: any,
  seriesType: string,
  getTheme: (...keys: string[]) => any
): any {
  const seriesMarkInfoMap = Factory.getSeriesMarkMap(seriesType);

  if (!seriesMarkInfoMap) {
    return seriesTheme;
  }
  const newTheme: any = {};
  Object.values<ISeriesMarkInfo>(seriesMarkInfoMap).forEach(({ type, name }) => {
    newTheme[name] = mergeSpec({}, getTheme('mark', array(type)[0]), getTheme('markByName', name), seriesTheme?.[name]);
  });
  return {
    ...seriesTheme,
    ...newTheme
  };
}
