import { degreeToRadian, isEmpty, isFunction } from '@visactor/vutils';
import type { Datum } from '../typings';
import type { LegendItemDatum } from '@visactor/vrender-components';

function getComponentStyleCallbackItem(item: LegendItemDatum) {
  const rawDatum = (item as any)?.datum;
  return rawDatum && typeof rawDatum === 'object' ? { ...rawDatum, ...item } : item;
}

function hasFunctionStyleValue(style: any) {
  return !isFunction(style) && !isEmpty(style) && Object.keys(style).some(key => isFunction(style[key]));
}

function transformComponentStyleValue(
  style: any,
  item: LegendItemDatum,
  isSelected: boolean,
  index: number,
  allItems: LegendItemDatum[]
) {
  const callbackItem = getComponentStyleCallbackItem(item);
  if (isFunction(style)) {
    return transformToGraphic(style(callbackItem, isSelected, index, allItems));
  }
  if (hasFunctionStyleValue(style)) {
    const nextStyle = { ...style };
    Object.keys(nextStyle).forEach(key => {
      if (isFunction(nextStyle[key])) {
        nextStyle[key] = nextStyle[key](callbackItem, isSelected, index, allItems);
      }
    });
    return transformToGraphic(nextStyle);
  }
  return transformToGraphic(style);
}

/**
 * 针对一些可以配置状态样式的属性的转换函数，结构如下：
 * { style: {}, state: { hover: {} } }
 * @param cfg
 * @returns
 */
export function transformComponentStyle(cfg: any = {}) {
  const newConfig = {
    ...cfg
  };

  if (isFunction(cfg.style)) {
    newConfig.style = (item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) =>
      transformComponentStyleValue(cfg.style, item, isSelected, index, allItems);
  } else if (hasFunctionStyleValue(cfg.style)) {
    newConfig.style = (item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) =>
      transformComponentStyleValue(cfg.style, item, isSelected, index, allItems);
  } else if (!isEmpty(cfg.style)) {
    newConfig.style = transformToGraphic(cfg.style);
  }

  if (!isEmpty(cfg.state)) {
    const newStateStyle = {};
    Object.keys(cfg.state).forEach(key => {
      if (isFunction(cfg.state[key])) {
        newStateStyle[key] = (item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) =>
          transformComponentStyleValue(cfg.state[key], item, isSelected, index, allItems);
      } else if (hasFunctionStyleValue(cfg.state[key])) {
        newStateStyle[key] = (item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) =>
          transformComponentStyleValue(cfg.state[key], item, isSelected, index, allItems);
      } else if (!isEmpty(cfg.state[key])) {
        newStateStyle[key] = transformToGraphic(cfg.state[key]);
      }
    });
    newConfig.state = newStateStyle;
  }

  return newConfig;
}

export function transformStateStyle(stateStyle: any) {
  if (isEmpty(stateStyle)) {
    return null;
  }
  const newStateStyle = {};
  Object.keys(stateStyle).forEach(key => {
    if (isFunction(stateStyle[key])) {
      newStateStyle[key] = (value: any, index: number, datum: Datum, data: Datum[]) =>
        transformToGraphic(stateStyle[key](value, index, datum, data));
    } else if (!isEmpty(stateStyle[key])) {
      newStateStyle[key] = transformToGraphic(stateStyle[key]);
    }
  });

  return newStateStyle;
}

export function transformAxisLabelStateStyle(stateStyle: any) {
  if (isEmpty(stateStyle)) {
    return null;
  }
  const newStateStyle = {};
  Object.keys(stateStyle).forEach(key => {
    if (isFunction(stateStyle[key])) {
      newStateStyle[key] = (datum: Datum, index: number, data: Datum[], layer?: number) => {
        return transformToGraphic(stateStyle[key](datum.rawValue, index, datum, data, layer));
      };
    } else if (!isEmpty(stateStyle[key])) {
      newStateStyle[key] = transformToGraphic(stateStyle[key]);
    }
  });

  return newStateStyle;
}

export function transformIndicatorStyle(style: any, datum: any) {
  if (isEmpty(style)) {
    return null;
  }
  const newStateStyle = {};
  Object.keys(style).forEach(key => {
    if (isFunction(style[key])) {
      newStateStyle[key] = style[key](datum);
    } else {
      newStateStyle[key] = style[key];
    }
  });
  return transformToGraphic(newStateStyle);
}

export function transformToGraphic(style: any) {
  if (style?.angle) {
    return {
      ...style,
      angle: degreeToRadian(style.angle)
    };
  }

  return style;
}
