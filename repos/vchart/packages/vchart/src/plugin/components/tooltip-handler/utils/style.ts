import { isArray, isNil, isValid, isValidNumber, normalizePadding } from '@visactor/vutils';
import type { ITooltipSpec, ITooltipTextTheme, ITooltipTheme } from '../../../../component/tooltip';
import { calcLayoutNumber } from '../../../../util/space';
import type { ILayoutNumber } from '../../../../typings/layout';
const DEFAULT_SHAPE_SPACING = 8;
const DEFAULT_KEY_SPACING = 26;
const DEFAULT_VALUE_SPACING = 0;

export const getPixelPropertyStr = (num?: number | number[], defaultStr?: string) => {
  if (isValid(num)) {
    if (isArray(num)) {
      return num.map(n => `${n}px`).join(' ');
    }
    return `${num}px`;
  }
  return defaultStr ?? 'initial';
};

export const getTextStyle = (style: ITooltipTextTheme = {}, textStyle: Partial<CSSStyleDeclaration> = {}) => {
  if (isValid(style.fontFamily)) {
    textStyle.fontFamily = style.fontFamily;
  }
  const color = style.fill ?? style.fontColor;

  if (isValid(color)) {
    textStyle.color = color;
  }
  if (isValid(style.fontWeight)) {
    textStyle.fontWeight = style.fontWeight as string;
  }
  if (isValid(style.textAlign)) {
    textStyle.textAlign = style.textAlign as string;
  }
  if (isValid(style.fontSize)) {
    textStyle.fontSize = getPixelPropertyStr(style.fontSize as number);
  }

  if (isValid(style.maxWidth)) {
    textStyle.maxWidth = getPixelPropertyStr(style.maxWidth as number);
  }

  if (style.multiLine || (isValid(style.maxWidth) && style.multiLine !== false)) {
    textStyle.whiteSpace = 'initial';
    textStyle.wordBreak = style.wordBreak ?? 'break-word';
  } else {
    textStyle.wordBreak = 'normal';
    textStyle.whiteSpace = 'nowrap';
  }

  return textStyle;
};

export const getLineHeight = (style: ITooltipTextTheme = {}) => {
  const { lineHeight } = style;

  if (style.fontSize) {
    return calcLayoutNumber(lineHeight as ILayoutNumber, style.fontSize as number);
  }

  return 0;
};

export const getDomStyle = (spec: ITooltipSpec = {}) => {
  const { style = {}, enterable, transitionDuration } = spec;
  const { panel = {}, titleLabel, shape, keyLabel, valueLabel, spaceRow: commonSpaceRow, align } = style;
  const { panelStyle, panelPadding } = getPanelStyle(panel);
  const rowStyle: Partial<CSSStyleDeclaration> = {
    marginTop: '0px',
    marginBottom: '0px'
  };

  panelStyle.pointerEvents = enterable ? 'auto' : 'none';
  if (transitionDuration) {
    panelStyle.transitionDuration = transitionDuration ? `${transitionDuration}ms` : 'initial';
    panelStyle.transitionProperty = transitionDuration ? 'transform' : 'initial';
    panelStyle.transitionTimingFunction = transitionDuration ? 'ease-out' : 'initial';
  }

  if (isValidNumber(commonSpaceRow)) {
    rowStyle.marginBottom = `${commonSpaceRow}px`;
  }

  const shapeStyle: Partial<CSSStyleDeclaration> = {
    // TODO 默认值优化
    width: getPixelPropertyStr(shape?.size ?? 8)
  };
  const titleStyle = getTextStyle(titleLabel);
  const keyStyle = getTextStyle(keyLabel);
  const valueStyle = getTextStyle(valueLabel);
  const marginKey = align === 'right' ? 'marginLeft' : 'marginRight';

  if (align === 'right') {
    // rtl
    panelStyle.direction = 'rtl';
  }
  if (isNil(titleStyle.textAlign)) {
    titleStyle.textAlign = align === 'right' ? 'right' : 'left';
  }
  if (isNil(keyStyle.textAlign)) {
    keyStyle.textAlign = align === 'right' ? 'right' : 'left';
  }
  if (isNil(valueStyle.textAlign)) {
    valueStyle.textAlign = align === 'right' ? 'left' : 'right';
  }
  shapeStyle[marginKey] = getPixelPropertyStr(shape.spacing ?? DEFAULT_SHAPE_SPACING);
  keyStyle[marginKey] = getPixelPropertyStr(keyLabel.spacing ?? DEFAULT_KEY_SPACING);
  valueStyle[marginKey] = getPixelPropertyStr(valueLabel.spacing ?? DEFAULT_VALUE_SPACING);
  const lineHeight = Math.max(getLineHeight(valueLabel), getLineHeight(keyLabel));

  // 如果不设置lineHeight，会导致横向不对齐的问题
  rowStyle.lineHeight = lineHeight > 0 ? `${lineHeight}px` : '20px';

  return {
    panelPadding,
    row: rowStyle,
    panel: panelStyle,
    title: titleStyle,
    shape: shapeStyle,
    key: keyStyle,
    value: valueStyle
  };
};

export const getPanelStyle = (
  style: ITooltipTheme['panel']
): { panelStyle: Partial<CSSStyleDeclaration>; panelPadding?: number[] } => {
  const { backgroundColor, border, shadow, padding } = style;
  const panelStyle: Partial<CSSStyleDeclaration> = {
    borderWidth: `${border?.width ?? 0}px`
  };
  let panelPadding: number[] = null;

  if (border?.color) {
    panelStyle.borderColor = border.color as string;
  }
  if (backgroundColor) {
    panelStyle.backgroundColor = backgroundColor as string;
  }
  panelStyle.boxShadow = shadow
    ? `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`
    : 'initial';
  const { radius } = border ?? {};

  if (isValid(radius)) {
    panelStyle.borderRadius = isValidNumber(radius) ? `${radius}px` : `${radius}`;
  }

  if (isValid(padding)) {
    panelPadding = normalizePadding(padding);
    panelStyle.padding = getPixelPropertyStr(panelPadding);
  }

  return { panelStyle, panelPadding };
};

export function setStyleToDom(dom: HTMLElement, style: Partial<CSSStyleDeclaration>) {
  if (!dom || !dom.style || !style) {
    return;
  }

  Object.keys(style).forEach(key => {
    (dom.style as any)[key] = (style as any)[key];
  });
}
