import { isArray, isFunction, isObject, isString, isValid, Color, isNil, rgbToHsl, hslToRgb } from '@visactor/vutils';
import type {
  ColorScheme,
  ColorSchemeItem,
  IColorKey,
  IColorSchemeStruct,
  IProgressiveDataSchemeCase,
  IThemeColorScheme,
  ProgressiveDataScheme
} from './interface';
import type { ISeriesSpec } from '../../typings';
import { getDirectionFromSeriesSpec } from '../../series/util/spec';
import { getUpgradedTokenValue } from './legacy';

/**
 * 从色板中获取数据色板（在此步骤中替换语义色值）
 * @param colorScheme
 * @param seriesType
 * @returns
 */
export function getDataScheme(
  colorScheme?: IThemeColorScheme,
  seriesSpec?: ISeriesSpec
): Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem> {
  if (!colorScheme) {
    return [];
  }
  const scheme = getColorSchemeBySeries(colorScheme, seriesSpec);
  if (!scheme || isArray(scheme)) {
    // 不带语义色板，直接输出
    return (scheme as Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem>) ?? [];
  } else if (isObject(scheme)) {
    // 带语义色板，转换颜色后输出
    const { dataScheme } = scheme as IColorSchemeStruct;
    if (!dataScheme) {
      return [];
    }
    // 渐进式色板的情况
    if (isProgressiveDataColorScheme(dataScheme)) {
      return dataScheme.map(item => ({
        ...item,
        scheme: item.scheme
          .map(color => {
            if (isColorKey(color)) {
              return queryColorFromColorScheme(colorScheme, color, seriesSpec);
            }
            return color;
          })
          .filter(isValid)
      }));
    }
    // 普通色板的情况
    return dataScheme
      .map(color => {
        if (isColorKey(color)) {
          return queryColorFromColorScheme(colorScheme, color, seriesSpec);
        }
        return color;
      })
      .filter(isValid);
  }
  return [];
}

/**
 * 计算最终数据色板（在此步骤中获得渐进式色板的最终色板）
 * @param colorScheme
 * @param seriesType
 * @returns
 */
export function computeActualDataScheme(
  dataScheme: Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem>,
  colorDomain: any[]
): Array<ColorSchemeItem> {
  if (isProgressiveDataColorScheme(dataScheme)) {
    return (
      dataScheme.find(item => {
        if (isValid(item.isAvailable)) {
          if (isFunction(item.isAvailable)) {
            return item.isAvailable(colorDomain);
          }
          return !!item.isAvailable;
        } else if (isValid(item.maxDomainLength)) {
          return colorDomain?.length <= item.maxDomainLength;
        }
        return true;
      })?.scheme ?? dataScheme[dataScheme.length - 1].scheme
    );
  }
  return dataScheme;
}

/**
 * 根据色板和色值索引生成颜色
 * @param colorScheme
 * @param colorKey
 * @param seriesType
 * @returns
 */
export function queryColorFromColorScheme(
  colorScheme: IThemeColorScheme,
  colorKey: IColorKey,
  seriesSpec?: ISeriesSpec
): ColorSchemeItem | undefined {
  const scheme = getColorSchemeBySeries(colorScheme, seriesSpec);
  if (!scheme) {
    return undefined;
  }
  let color;
  const { palette } = scheme as IColorSchemeStruct;
  if (isObject(palette)) {
    color = getUpgradedTokenValue(palette, colorKey.key) ?? colorKey.default;
  }
  if (!color) {
    return undefined;
  }
  if ((isNil(colorKey.a) && isNil(colorKey.l)) || !isString(color)) {
    return color;
  }
  let c = new Color(color);
  if (isValid(colorKey.l)) {
    const { r, g, b } = c.color;
    const { h, s } = rgbToHsl(r, g, b);
    const rgb = hslToRgb(h, s, colorKey.l);
    const newColor = new Color(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    newColor.setOpacity(c.color.opacity);
    c = newColor;
  }
  if (isValid(colorKey.a)) {
    c.setOpacity(colorKey.a);
  }
  return c.toRGBA();
}

/** 查询语义化颜色 */
export const getActualColor = (value: any, colorScheme?: IThemeColorScheme) => {
  if (colorScheme && isColorKey(value)) {
    const color = queryColorFromColorScheme(colorScheme, value);
    if (color) {
      return color;
    }
  }
  return value;
};

export function isColorKey(obj: any): obj is IColorKey {
  return obj && (obj as IColorKey).type === 'palette' && !!(obj as IColorKey).key;
}

export function isProgressiveDataColorScheme<T>(obj: any): obj is ProgressiveDataScheme<T> {
  if (!isArray(obj) || obj.length === 0) {
    return false;
  }
  return obj.every(item => {
    return isValid((item as IProgressiveDataSchemeCase<T>).scheme);
  });
}

/** 将色板转化为标准形式 */
export function transformColorSchemeToStandardStruct(colorScheme: ColorScheme): IColorSchemeStruct {
  if (isArray(colorScheme)) {
    return {
      dataScheme: colorScheme
    };
  }
  return colorScheme;
}

export function getColorSchemeBySeries(
  colorScheme?: IThemeColorScheme,
  seriesSpec?: ISeriesSpec
): ColorScheme | undefined {
  const { type: seriesType } = seriesSpec ?? {};
  let scheme: ColorScheme | undefined;
  if (!seriesSpec || isNil(seriesType)) {
    scheme = colorScheme?.default;
  } else {
    const direction = getDirectionFromSeriesSpec(seriesSpec);
    scheme = colorScheme?.[`${seriesType}_${direction}`] ?? colorScheme?.[seriesType] ?? colorScheme?.default;
  }
  return scheme;
}
