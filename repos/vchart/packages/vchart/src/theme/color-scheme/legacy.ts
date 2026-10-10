// FIXME: token 兼容策略，照目前的设计不应该硬编码。
// 后续需要二选一：
// - 主题模块指定唯一一套支持的 token（可以保留这段硬编码）
// - 在默认主题中做声明式的兼容（需要删除这段硬编码，并在 IColorKey 中支持新属性）

import type { BuiltinColorPalette } from './builtin';
import type { ColorSchemeItem, IColorSchemeStruct } from './interface';

export const newTokenToLegacyToken: Record<keyof BuiltinColorPalette, string> = {
  primaryFontColor: 'titleFontColor',
  tertiaryFontColor: 'labelFontColor',
  axisLabelFontColor: 'axisFontColor',
  axisMarkerFontColor: 'labelReverseFontColor',
  dataZoomHandleStrokeColor: 'dataZoomHandlerStrokeColor',
  sliderHandleColor: 'dataZoomHandlerFillColor',
  sliderRailColor: 'dataZoomBackgroundColor',
  sliderTrackColor: 'dataZoomSelectedColor',
  playerControllerColor: 'dataZoomSelectedColor',
  popupBackgroundColor: 'tooltipBackgroundColor',
  hoverBackgroundColor: 'axisGridColor'
  // 以下两个新 token 不做兼容策略，因为其对应的 legacy token 仍在使用
  // axisMarkerBackgroundColor: 'primaryFontColor',
  // markLineStrokeColor: 'primaryFontColor',
};

export const legacyTokenToNewToken: Record<string, keyof BuiltinColorPalette> = {
  titleFontColor: 'primaryFontColor',
  labelFontColor: 'tertiaryFontColor',
  axisFontColor: 'axisLabelFontColor',
  labelReverseFontColor: 'axisMarkerFontColor',
  dataZoomHandlerStrokeColor: 'dataZoomHandleStrokeColor',
  dataZoomHandlerFillColor: 'sliderHandleColor',
  dataZoomBackgroundColor: 'sliderRailColor',
  dataZoomSelectedColor: 'sliderTrackColor',
  tooltipBackgroundColor: 'popupBackgroundColor'
};

export function getUpgradedTokenValue(palette: IColorSchemeStruct['palette'], key: string): ColorSchemeItem {
  // 情况一：用户定义了包含旧 token 的新色板
  const legacyKey = newTokenToLegacyToken[key];
  if (legacyKey && palette[legacyKey]) {
    return palette[legacyKey];
  }
  // 情况二：默认情况，用户尝试取色（大部分情况下在此退出）
  if (palette[key]) {
    return palette[key];
  }
  // 情况三：用户没有取到颜色，判断用户是否在尝试用旧 token 取色
  const newKey = legacyTokenToNewToken[key];
  if (newKey) {
    return palette[newKey];
  }
  // 情况四：真的取不到颜色
  return undefined;
}
