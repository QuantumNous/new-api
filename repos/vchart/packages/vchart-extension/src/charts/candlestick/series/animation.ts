import type { EasingType, IGlyph } from '@visactor/vchart';
import type { IAnimationParameters } from '@visactor/vchart';
import { isValidNumber } from '@visactor/vchart';
import { ACustomAnimate, AnimateExecutor } from '@visactor/vchart';

export interface ICandlestickScaleAnimationOptions {
  center?: number;
}

type TypeAnimation = (
  graphic: IGlyph,
  options: ICandlestickScaleAnimationOptions,
  animationParameters: IAnimationParameters
) => { from?: { [channel: string]: any }; to?: { [channel: string]: any } };

const scaleIn = (): TypeAnimation => {
  return (graphic: IGlyph) => {
    const finalAttribute = graphic.getFinalAttribute();
    const { x, y, open, high, low, close } = finalAttribute;
    const animateAttributes: any = { from: { x, y }, to: { x, y } };
    if (isValidNumber(open) && isValidNumber(close)) {
      if (open > close) {
        animateAttributes.from.open = low;
        animateAttributes.to.open = open;
        animateAttributes.from.close = low;
        animateAttributes.to.close = close;
        if (isValidNumber(high)) {
          animateAttributes.from.high = low;
          animateAttributes.to.high = high;
        }
      } else {
        animateAttributes.from.open = high;
        animateAttributes.to.open = open;
        animateAttributes.from.close = high;
        animateAttributes.to.close = close;
        if (isValidNumber(low)) {
          animateAttributes.from.low = high;
          animateAttributes.to.low = low;
        }
      }
    }
    return animateAttributes;
  };
};

const scaleOut = (): TypeAnimation => {
  return (graphic: IGlyph) => {
    const finalAttribute = graphic.getFinalAttribute();
    const { x, y, open, high, low, close } = finalAttribute;

    const animateAttributes: any = { from: { x, y }, to: { x, y } };
    if (isValidNumber(open) && isValidNumber(close)) {
      if (open > close) {
        animateAttributes.from.open = open;
        animateAttributes.to.open = low;
        animateAttributes.from.close = close;
        animateAttributes.to.close = low;
        if (isValidNumber(high)) {
          animateAttributes.from.high = high;
          animateAttributes.to.high = low;
        }
      } else {
        animateAttributes.from.open = open;
        animateAttributes.to.open = high;
        animateAttributes.from.close = close;
        animateAttributes.to.close = high;
        if (isValidNumber(low)) {
          animateAttributes.from.low = low;
          animateAttributes.to.low = high;
        }
      }
    }
    return animateAttributes;
  };
};

export class CandlestickScaleIn extends ACustomAnimate<Record<string, number>> {
  constructor(from: null, to: null, duration: number, easing: EasingType, params?: ICandlestickScaleAnimationOptions) {
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
    const attr = scaleIn()(this.target as IGlyph, this.params, this.params.options);
    return attr;
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export class CandlestickScaleOut extends ACustomAnimate<Record<string, number>> {
  constructor(from: null, to: null, duration: number, easing: EasingType, params?: ICandlestickScaleAnimationOptions) {
    super(from, to, duration, easing, params);
  }

  onBind(): void {
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
    const attr = scaleOut()(this.target as IGlyph, this.params, this.params.options);
    return attr;
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export const registerCandlestickScaleAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('candlestickScaleIn', CandlestickScaleIn);
  AnimateExecutor.registerBuiltInAnimate('candlestickScaleOut', CandlestickScaleOut);
};
