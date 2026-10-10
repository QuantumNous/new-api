import type { ContinuousPlayerAttributes, DiscretePlayerAttributes, Datum } from '@visactor/vrender-components';
import type { IPlayer } from '../interface';
import type { IRectGraphicAttribute, ISymbolGraphicAttribute } from '@visactor/vrender-core';
import type { IRectMarkSpec, ISymbolMarkSpec } from '../../../typings';
import { transformToGraphic } from '../../../util/style';
import type { BaseGraphicAttributes } from '@visactor/vrender-components';

/**
 * IRectMarkSpec => IRectGraphicAttribute
 */
const rectToAttribute = (markSpec: IRectMarkSpec): IRectGraphicAttribute => {
  const result: IRectGraphicAttribute = {
    ...(markSpec as unknown as IRectGraphicAttribute)
  };

  return transformToGraphic(result) as IRectGraphicAttribute;
};

/**
 * ISymbolMarkSpec => ISymbolGraphicAttribute
 */
const symbolToAttribute = (markSpec: ISymbolMarkSpec): ISymbolGraphicAttribute => {
  const result: ISymbolGraphicAttribute = {
    ...(markSpec as unknown as ISymbolGraphicAttribute)
  };

  return transformToGraphic(result) as ISymbolGraphicAttribute;
};

const baseToAttribute = <T>(spec: BaseGraphicAttributes<T>) => {
  const result: BaseGraphicAttributes<T> = {
    ...spec,
    style: {
      ...transformToGraphic(spec.style)
    }
  };
  return result;
};

const transformToAttrs = (spec: IPlayer) => {
  // slider
  const trackStyle = rectToAttribute(spec?.slider?.trackStyle ?? {});
  const railStyle = rectToAttribute(spec?.slider?.railStyle ?? {});
  const handlerStyle = symbolToAttribute(spec?.slider?.handlerStyle ?? {});

  // controllers
  const start = baseToAttribute<ISymbolMarkSpec>(spec?.controller?.start ?? {});
  const pause = baseToAttribute<ISymbolMarkSpec>(spec?.controller?.pause ?? {});
  const backward = baseToAttribute<ISymbolMarkSpec>(spec?.controller?.backward ?? {});
  const forward = baseToAttribute<ISymbolMarkSpec>(spec?.controller?.forward ?? {});

  const attrs = {
    ...spec,
    direction: spec.direction,
    interval: spec.interval,
    visible: spec.visible,
    // 不配置默认值的话, set attr时会将undefined代入配置, 导致vrender默认配置失效
    orient: spec.orient ?? 'bottom',
    slider: {
      ...spec.slider,
      trackStyle: trackStyle,
      railStyle: railStyle,
      handlerStyle: handlerStyle
    },
    controller: {
      ...spec.controller,
      start: start,
      pause: pause,
      backward: backward,
      forward: forward
    }
  };

  // player hidden after set player.visible: 'false'
  if (!spec.visible) {
    attrs.controller.visible = false;
    attrs.slider.visible = false;
  }

  return attrs;
};

/**
 * 连续型播放器spec转换为Attrs
 */
export const transformContinuousSpecToAttrs = (spec: IPlayer, data: Datum[]): ContinuousPlayerAttributes => ({
  ...(transformToAttrs(spec) as any),
  data,
  type: 'continuous'
});

export const transformDiscreteSpecToAttrs = (spec: IPlayer, data: Datum[]): DiscretePlayerAttributes => ({
  ...(transformToAttrs(spec) as any),
  data,
  type: 'discrete'
});
