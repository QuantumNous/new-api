import { isFunction } from '@visactor/vutils';
import type { IAttrs, IMarkStateStyle } from '../../mark/interface';
import { STATE_VALUE_ENUM } from './interface';

export function isAttrChangeable<T>(key: string, stateStyle: IMarkStateStyle<T>) {
  for (const state in stateStyle) {
    if (state === STATE_VALUE_ENUM.STATE_NORMAL) {
      const style = stateStyle[state][key]?.style;
      const isGradient = isGradientAttribute(key, style);
      if (isGradient) {
        return true;
      }
      const isFunctionStyle = isFunction(style);
      if (isFunctionStyle) {
        return true;
      }
      const isScale = !!style?.scale;
      if (isScale) {
        return true;
      }
      continue;
    }
    if (key in stateStyle[state]) {
      return true;
    }
  }
  return false;
}

export function isStateAttrChangeable<T>(key: string, stateStyle: Partial<IAttrs<T>>, facetField: string) {
  const style = stateStyle[key]?.style;
  const isGradient = isGradientAttribute(key, style);
  if (isGradient) {
    return true;
  }
  const isFunctionStyle = isFunction(style);
  if (isFunctionStyle) {
    return true;
  }
  const isScale = !!style?.scale;
  if (isScale) {
    if (style.field !== facetField) {
      return true;
    }
  }
  return false;
}

function isGradientAttribute(key: string, style: any) {
  return (key === 'fill' || key === 'stroke') && style?.gradient && style?.stops;
}

const DEFAULT_STATE_VALUE_ENUM: Record<string, boolean> = {};
Object.values(STATE_VALUE_ENUM).forEach(v => {
  DEFAULT_STATE_VALUE_ENUM[v] = true;
});

export function stateInDefaultEnum(state: string) {
  return !!DEFAULT_STATE_VALUE_ENUM[state];
}

const DEFAULT_STATE_VALUE_TO_REVERSE: Record<string, string> = {
  [STATE_VALUE_ENUM.STATE_HOVER]: STATE_VALUE_ENUM.STATE_HOVER_REVERSE,
  [STATE_VALUE_ENUM.STATE_SELECTED]: STATE_VALUE_ENUM.STATE_SELECTED_REVERSE,
  [STATE_VALUE_ENUM.STATE_DIMENSION_HOVER]: STATE_VALUE_ENUM.STATE_DIMENSION_HOVER_REVERSE
};

export function stateToReverse(state: string) {
  return DEFAULT_STATE_VALUE_TO_REVERSE[state];
}
