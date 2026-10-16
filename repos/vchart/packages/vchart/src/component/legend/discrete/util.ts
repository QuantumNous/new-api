/* eslint-disable @typescript-eslint/no-unused-vars */
import { cloneDeep, isEmpty, isFunction, isValid } from '@visactor/vutils';
import { isPercent, isValidOrient } from '../../../util/space';
import { mergeSpec } from '@visactor/vutils-extension';
import { transformComponentStyle, transformToGraphic } from '../../../util/style';
import { transformLegendTitleAttributes } from '../util';
import type { IDiscreteLegendSpec, ILegendScrollbar, IPager } from './interface';
import type { ILayoutRect } from '../../../typings/layout';
import type { IOrientType } from '../../../typings/space';

function normalizeLegendShapeTextureStyle(style: any) {
  if (!isValid(style?.texture)) {
    return style;
  }

  return {
    ...style,
    texturePadding: isValid(style.texturePadding) ? style.texturePadding : 1,
    textureSize: isValid(style.textureSize) ? style.textureSize : 4
  };
}

function normalizeLegendShapeTextureConfig(shape: any) {
  const normalizeStyle = (style: any) => normalizeLegendShapeTextureStyle(style);

  if (isFunction(shape.style)) {
    const style = shape.style;
    shape.style = (...args: any[]) => normalizeStyle(style(...args));
  } else if (!isEmpty(shape.style)) {
    shape.style = normalizeStyle(shape.style);
  }

  if (!isEmpty(shape.state)) {
    Object.keys(shape.state).forEach(key => {
      if (isFunction(shape.state[key])) {
        const stateStyle = shape.state[key];
        shape.state[key] = (...args: any[]) => normalizeStyle(stateStyle(...args));
      } else if (!isEmpty(shape.state[key])) {
        shape.state[key] = normalizeStyle(shape.state[key]);
      }
    });
  }

  return shape;
}

export function getLegendAttributes(spec: IDiscreteLegendSpec, rect: ILayoutRect, layoutOrient?: IOrientType) {
  const {
    title: titleSpec = {},
    item: itemSpec = {},
    pager: pagerSpec = {},
    background: backgroundSpec = {},
    // 以下不属于 legend 需要的属性，单独拿出来以免污染传递给组件的属性
    type,
    id,
    visible,
    orient,
    position,
    data,
    filter,
    regionId,
    regionIndex,
    seriesIndex,
    seriesId,
    padding, // vchart 布局模块已经处理了

    ...restSpec
  } = spec;

  let {
    // 需要进行样式转换的属性
    title = {},
    item = {},
    pager = {},
    background = {}
  } = spec;
  // 需要进行深拷贝，否则会影响到 spec 中的原始数据
  title = cloneDeep(title);
  item = cloneDeep(item);
  pager = cloneDeep(pager);
  background = cloneDeep(background);

  const attrs: any = restSpec;

  // `maxRow` / `maxCol` may be a callback, evaluated here during layout against the legend's
  // available `rect` so the row / column count can adapt to the space (e.g. allow more rows on
  // a tall-and-narrow legend). The callback receives the layout context and returns a number.
  // Use the layout-resolved orient (falling back to the spec orient default rule) so the callback
  // sees the orient the legend actually lays out with, not the raw `spec.orient` which is
  // `undefined` when the user omits it.
  if (isFunction(attrs.maxRow) || isFunction(attrs.maxCol)) {
    const resolvedOrient = isValidOrient(layoutOrient) ? layoutOrient : isValidOrient(orient) ? orient : 'left';
    if (isFunction(attrs.maxRow)) {
      attrs.maxRow = attrs.maxRow({ rect, orient: resolvedOrient, id });
    }
    if (isFunction(attrs.maxCol)) {
      attrs.maxCol = attrs.maxCol({ rect, orient: resolvedOrient, id });
    }
  }

  // transform title
  if (title.visible) {
    attrs.title = transformLegendTitleAttributes(title);
  } else {
    attrs.title = { visible: false };
  }

  // transform item
  if (!isEmpty(item.focusIconStyle)) {
    transformToGraphic(item.focusIconStyle);
  }
  if (item.shape) {
    item.shape = normalizeLegendShapeTextureConfig(transformComponentStyle(item.shape));
  }
  if (item.label) {
    item.label = transformComponentStyle(item.label);
  }
  if (item.value) {
    item.value = transformComponentStyle(item.value);
  }
  if (item.background) {
    item.background = transformComponentStyle(item.background);
  }

  if (isPercent(item.maxWidth)) {
    item.maxWidth = (Number(item.maxWidth.substring(0, item.maxWidth.length - 1)) * rect.width) / 100;
  }
  if (isPercent(item.width)) {
    item.width = (Number(item.width.substring(0, item.width.length - 1)) * rect.width) / 100;
  }
  if (isPercent(item.height)) {
    item.height = (Number(item.height.substring(0, item.height.length - 1)) * rect.width) / 100;
  }
  attrs.item = item;

  if ((pager as ILegendScrollbar).type === 'scrollbar') {
    if (!isEmpty((pager as ILegendScrollbar).railStyle)) {
      transformToGraphic((pager as ILegendScrollbar).railStyle);
    }
    if (!isEmpty((pager as ILegendScrollbar).sliderStyle)) {
      transformToGraphic((pager as ILegendScrollbar).sliderStyle);
    }
  } else {
    // transform pager
    if (!isEmpty((pager as IPager).textStyle)) {
      transformToGraphic((pager as IPager).textStyle);
    }

    if ((pager as IPager).handler) {
      transformComponentStyle((pager as IPager).handler);
    }
  }

  attrs.pager = pager;

  if (background.visible && !isEmpty(background.style)) {
    mergeSpec(attrs, background.style);
    if (isValid(background.padding)) {
      attrs.padding = background.padding;
    }
  }

  return attrs;
}
