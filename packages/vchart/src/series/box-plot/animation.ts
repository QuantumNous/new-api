import type { EasingType, ILineAttribute, IRectAttribute } from '@visactor/vrender-core';
import type { IGlyph } from '@visactor/vrender-core';
import type { IAnimationParameters } from '../../animation/interface';
import { isValidNumber } from '@visactor/vutils';
import { ACustomAnimate, AnimateExecutor } from '@visactor/vrender-animate';
export interface IBoxplotScaleAnimationOptions {
  center?: number;
}

type TypeAnimation = (
  graphic: IGlyph,
  options: IBoxplotScaleAnimationOptions,
  animationParameters: IAnimationParameters
) => { from?: { [channel: string]: any }; to?: { [channel: string]: any } };

const scaleIn = (
  computeCenter: (
    graphic: IGlyph,
    direction: 'vertical' | 'horizontal',
    options: IBoxplotScaleAnimationOptions
  ) => number
): TypeAnimation => {
  return (graphic: IGlyph, options: IBoxplotScaleAnimationOptions, animationParameters: IAnimationParameters) => {
    const finalAttribute = graphic.getFinalAttribute();
    const direction = finalAttribute.direction ?? 'vertical';
    const center = computeCenter(graphic, direction, options);
    if (!isValidNumber(center)) {
      return {};
    }
    const { x, y, min, max, q1, q3, median } = finalAttribute;
    const animateAttributes: any = { from: { x, y }, to: { x, y } };
    if (isValidNumber(min)) {
      animateAttributes.from.min = center;
      animateAttributes.to.min = min;
    }
    if (isValidNumber(max)) {
      animateAttributes.from.max = center;
      animateAttributes.to.max = max;
    }
    if (isValidNumber(q1)) {
      animateAttributes.from.q1 = center;
      animateAttributes.to.q1 = q1;
    }
    if (isValidNumber(q3)) {
      animateAttributes.from.q3 = center;
      animateAttributes.to.q3 = q3;
    }
    if (isValidNumber(median)) {
      animateAttributes.from.median = center;
      animateAttributes.to.median = median;
    }
    return animateAttributes;
  };
};

const scaleOut = (
  computeCenter: (mark: IGlyph, direction: 'vertical' | 'horizontal', options: IBoxplotScaleAnimationOptions) => number
): TypeAnimation => {
  return (graphic: IGlyph, options: IBoxplotScaleAnimationOptions, animationParameters: IAnimationParameters) => {
    const finalAttribute = graphic.getFinalAttribute();
    const direction = finalAttribute.direction ?? 'vertical';
    const center = computeCenter(graphic, direction, options);
    if (!isValidNumber(center)) {
      return {};
    }
    const { x, y, min, max, q1, q3, median } = finalAttribute;

    const animateAttributes: any = { from: { x, y }, to: { x, y } };
    if (isValidNumber(min)) {
      animateAttributes.to.min = center;
      animateAttributes.from.min = min;
    }
    if (isValidNumber(max)) {
      animateAttributes.to.max = center;
      animateAttributes.from.max = max;
    }
    if (isValidNumber(q1)) {
      animateAttributes.to.q1 = center;
      animateAttributes.from.q1 = q1;
    }
    if (isValidNumber(q3)) {
      animateAttributes.to.q3 = center;
      animateAttributes.from.q3 = q3;
    }
    if (isValidNumber(median)) {
      animateAttributes.to.median = center;
      animateAttributes.from.median = median;
    }
    return animateAttributes;
  };
};
const getGlyphChildByName = (mark: IGlyph, name: string) => {
  return mark.getSubGraphic().find(child => child.name === name);
};

const computeBoxplotCenter = (
  glyphMark: IGlyph,
  direction: 'vertical' | 'horizontal',
  options: IBoxplotScaleAnimationOptions
) => {
  if (options && isValidNumber(options.center)) {
    return options.center;
  }
  let median: number;
  let max: number;
  let min: number;
  let q1: number;
  let q3: number;
  if (direction === 'horizontal') {
    median = (getGlyphChildByName(glyphMark, 'median')?.attribute as ILineAttribute).points?.[0]?.x;
    max = (getGlyphChildByName(glyphMark, 'max')?.attribute as ILineAttribute)?.points?.[0]?.x;
    min = (getGlyphChildByName(glyphMark, 'min')?.attribute as ILineAttribute)?.points?.[0]?.x;

    const boxWidth = (getGlyphChildByName(glyphMark, 'box').attribute as IRectAttribute).width;
    const boxX = getGlyphChildByName(glyphMark, 'box').attribute.x;
    q1 = boxX;
    q3 = boxX + boxWidth;
  } else {
    median = (getGlyphChildByName(glyphMark, 'median')?.attribute as ILineAttribute).points?.[0]?.y;
    max = (getGlyphChildByName(glyphMark, 'max')?.attribute as ILineAttribute)?.points?.[0]?.y;
    min = (getGlyphChildByName(glyphMark, 'min')?.attribute as ILineAttribute)?.points?.[0]?.y;

    const boxHeight = (getGlyphChildByName(glyphMark, 'box').attribute as IRectAttribute).height;
    const boxY = getGlyphChildByName(glyphMark, 'box').attribute.y;
    q1 = boxY;
    q3 = boxY + boxHeight;
  }

  if (isValidNumber(median)) {
    return median;
  }
  if (isValidNumber(q1) && isValidNumber(q3)) {
    return (q1 + q3) / 2;
  }
  if (isValidNumber(max) && isValidNumber(min)) {
    return (max + min) / 2;
  }
  if (isValidNumber(min)) {
    return min;
  }
  if (isValidNumber(max)) {
    return max;
  }
  return NaN;
};

const computeBarBoxplotCenter = (
  glyphMark: IGlyph,
  direction: 'vertical' | 'horizontal',
  options: IBoxplotScaleAnimationOptions
) => {
  if (isValidNumber(options?.center)) {
    return options.center;
  }
  let median: number;
  let max: number;
  let min: number;
  let q1: number;
  let q3: number;
  if (direction === 'horizontal') {
    median = (getGlyphChildByName(glyphMark, 'median')?.attribute as ILineAttribute).points?.[0]?.x;
    const minMaxBoxWidth = (getGlyphChildByName(glyphMark, 'minMaxBox')?.attribute as IRectAttribute).width;
    const minMaxBoxBoxX = getGlyphChildByName(glyphMark, 'minMaxBox')?.attribute.x;
    min = minMaxBoxBoxX;
    max = minMaxBoxBoxX + minMaxBoxWidth;

    const q1q3BoxWidth = (getGlyphChildByName(glyphMark, 'q1q3Box')?.attribute as IRectAttribute).width;
    const q1q3BoxX = getGlyphChildByName(glyphMark, 'q1q3Box')?.attribute.x;
    q1 = q1q3BoxX;
    q3 = q1q3BoxX + q1q3BoxWidth;
  } else {
    median = (getGlyphChildByName(glyphMark, 'median')?.attribute as ILineAttribute).points?.[0]?.y;

    const minMaxBoxHeight = (getGlyphChildByName(glyphMark, 'minMaxBox')?.attribute as IRectAttribute).height;
    const minMaxBoxBoxY = getGlyphChildByName(glyphMark, 'minMaxBox')?.attribute.y;
    min = minMaxBoxBoxY;
    max = minMaxBoxBoxY + minMaxBoxHeight;

    const q1q3BoxHeight = (getGlyphChildByName(glyphMark, 'q1q3Box')?.attribute as IRectAttribute).height;
    const q1q3BoxY = getGlyphChildByName(glyphMark, 'q1q3Box')?.attribute.y;
    q1 = q1q3BoxY;
    q3 = q1q3BoxY + q1q3BoxHeight;
  }

  if (isValidNumber(median)) {
    return median;
  }
  if (isValidNumber(q1) && isValidNumber(q3)) {
    return (q1 + q3) / 2;
  }
  if (isValidNumber(max) && isValidNumber(min)) {
    return (max + min) / 2;
  }
  if (isValidNumber(min)) {
    return min;
  }
  if (isValidNumber(max)) {
    return max;
  }
  return NaN;
};

export class BoxplotScaleIn extends ACustomAnimate<Record<string, number>> {
  constructor(from: null, to: null, duration: number, easing: EasingType, params?: IBoxplotScaleAnimationOptions) {
    super(from, to, duration, easing, params);
  }

  onBind(): void {
    super.onBind();
    const finalAttribute = this.target.getFinalAttribute();
    if (finalAttribute) {
      this.target.setAttributes(finalAttribute);
    }
    const { from, to } = this.computeAttribute();
    this.propKeys = Object.keys(to).filter(key => to[key] != null);
    this.animate.reSyncProps();
    this.from = from;
    this.to = to;
    this.target.setAttributes(this.from);
  }

  computeAttribute() {
    return scaleIn(computeBoxplotCenter)(this.target as IGlyph, this.params, this.params.options);
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export class BoxplotScaleOut extends ACustomAnimate<Record<string, number>> {
  constructor(from: null, to: null, duration: number, easing: EasingType, params?: IBoxplotScaleAnimationOptions) {
    super(from, to, duration, easing, params);
  }

  onBind(): void {
    // 用于入场的时候设置属性（因为有动画的时候VChart不会再设置属性了）
    if (this.params?.diffAttrs) {
      this.target.setAttributes(this.params.diffAttrs);
    }
    const { from, to } = this.computeAttribute();
    this.propKeys = Object.keys(to).filter(key => to[key] != null);
    this.animate.reSyncProps();
    this.from = from;
    this.to = to;
    this.target.setAttributes(this.from);
  }

  computeAttribute() {
    return scaleOut(computeBoxplotCenter)(this.target as IGlyph, this.params, this.params.options);
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export class BarBoxplotScaleIn extends BoxplotScaleIn {
  computeAttribute() {
    return scaleIn(computeBarBoxplotCenter)(this.target as IGlyph, this.params, this.params.options);
  }
}

export class BarBoxplotScaleOut extends BoxplotScaleOut {
  computeAttribute() {
    return scaleOut(computeBarBoxplotCenter)(this.target as IGlyph, this.params, this.params.options);
  }
}

export const registeBoxPlotScaleAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('boxplotScaleIn', BoxplotScaleIn);
  AnimateExecutor.registerBuiltInAnimate('boxplotScaleOut', BoxplotScaleOut);
  AnimateExecutor.registerBuiltInAnimate('barBoxplotScaleIn', BarBoxplotScaleIn);
  AnimateExecutor.registerBuiltInAnimate('barBoxplotScaleOut', BarBoxplotScaleOut);
};
