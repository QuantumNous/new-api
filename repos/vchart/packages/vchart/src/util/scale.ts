/**
 * @description Scale 相关的工具函数
 */
import { isString, isValid } from '@visactor/vutils';
import type { IGlobalScale } from '../scale/interface';
import type { IBaseScale } from '@visactor/vscale';
// eslint-disable-next-line no-duplicate-imports
import { BandScale, LinearScale, OrdinalScale, PointScale, ThresholdScale } from '@visactor/vscale';
import type { IVisual, IVisualSpecBase } from '../typings/visual';
import { ColorOrdinalScale } from '../scale/color-ordinal-scale';

const defaultScaleMap = {
  linear: LinearScale,
  band: BandScale,
  point: PointScale,
  ordinal: OrdinalScale,
  threshold: ThresholdScale,
  colorOrdinal: ColorOrdinalScale
};

export function createScale(type: keyof typeof defaultScaleMap): IBaseScale | null {
  const scaleConstructor = defaultScaleMap[type];
  if (scaleConstructor) {
    return new scaleConstructor();
  }

  return null;
}

export function createScaleWithSpec(
  spec: IVisual<any>,
  context: {
    globalScale: IGlobalScale;
    seriesId: number;
  }
): IBaseScale | null {
  if ('scale' in spec && spec.scale) {
    if (isString(spec.scale) && context?.globalScale) {
      return context.globalScale.registerMarkAttributeScale(spec, context.seriesId);
    }
    return spec.scale as unknown as IBaseScale;
  }
  const scale = createScale((spec as IVisualSpecBase<any, any>).type);
  if (scale) {
    initScaleWithSpec(scale, spec as IVisualSpecBase<any, any>);
  }
  return scale;
}

// 需要一个通用的从spec初始化scale的方法，避免在scale属性更新后需要维护多组逻辑
function initScaleWithSpec(scale: IBaseScale, spec: IVisualSpecBase<any, any>) {
  if (!scale || !spec) {
    return;
  }

  if (spec.domain) {
    scale.domain(spec.domain);
  }

  if (spec.range) {
    scale.range(spec.range);
  }

  if (spec.specified && (<OrdinalScale>scale).specified) {
    (<OrdinalScale>scale).specified(spec.specified);
  }

  if (spec.clamp && (<LinearScale>scale).clamp) {
    (<LinearScale>scale).clamp(spec.clamp);
  }
}

/**
 * value限制在scale range内
 * 对于指标轴: 限制在scale可视范围(scale.range)内, 通常发生在自定义domain的场景中, 防止图元绘制超出画布
 * 对于维度轴: 限制在scale数据范围(scale.wholeRange)内, 通常发生在缩略轴等组件扩大scale区域的场景中, 允许图元超出画布
 * 已知图表范围: 柱状图、条形进度图
 */
export function valueInScaleRange(v: number, s?: IBaseScale, useWholeRange?: boolean) {
  if (!s) {
    return v;
  }
  const scaleRange = s.range();
  const range =
    useWholeRange && (s as any)._calculateWholeRange ? (s as any)._calculateWholeRange(scaleRange) : s.range();
  const min = Math.min(range[0], range[range.length - 1]);
  const max = Math.max(range[0], range[range.length - 1]);
  return Math.min(Math.max(min, v), max);
}

export function isValueInScaleDomain(v: number | number[], s?: IBaseScale, useWholeRange?: boolean) {
  if (!s) {
    return true;
  }
  const scaleRange = s.range();
  const range =
    useWholeRange && (s as any)._calculateWholeRange ? (s as any)._calculateWholeRange(scaleRange) : s.range();
  const domain = range.map((v: number) => s.invert(v));
  const min = Math.min(domain[0], domain[domain.length - 1]);
  const max = Math.max(domain[0], domain[domain.length - 1]);
  if (Array.isArray(v)) {
    return v.every(v => v >= min && v <= max);
  }
  return v >= min && v <= max;
}

export function isSpecValueWithScale(specValue: any) {
  return isValid(specValue?.field) && isValid(specValue?.scale);
}
