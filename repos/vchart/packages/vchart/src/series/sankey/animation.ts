// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../../typings/space';
import { Factory } from '../../core/factory';
import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';
import { FadeInOutAnimation } from '../../animation/config';
import type { ISankeyAnimationParams, SankeyAppearPreset } from './interface';
import type { IAnimationTypeConfig, IAnimationParameters } from '../../animation/interface';
import { ACustomAnimate, AnimateExecutor } from '@visactor/vrender-animate';
import type { IGraphic } from '@visactor/vrender-core';
import type { ILinkPathMarkSpec } from '../../typings';

export const sankeyGrowIn = (params: ISankeyAnimationParams, isOverall: boolean = true): IAnimationTypeConfig => {
  return {
    type: params.direction === Direction.horizontal ? 'growWidthIn' : 'growHeightIn',
    options: {
      overall: isOverall ? params.growFrom() : isOverall,
      orient: Direction.horizontal ? 'positive' : 'negative'
    }
  };
};

export const sankeyGrowOut = (params: ISankeyAnimationParams, isOverall: boolean = true): IAnimationTypeConfig => {
  return {
    type: params.direction === Direction.horizontal ? 'growWidthOut' : 'growHeightOut',
    options: {
      overall: isOverall ? params.growFrom() : isOverall,
      orient: Direction.horizontal ? 'positive' : 'negative'
    }
  };
};

export const sankeyNodePresetAnimation = (
  params: ISankeyAnimationParams,
  preset: SankeyAppearPreset
): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'growIn': {
      return sankeyGrowIn(params);
    }
    default: {
      return sankeyGrowIn(params);
    }
  }
};

export const sankeyLinkPresetAnimation = (preset: SankeyAppearPreset): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'growIn': {
      return { type: 'linkPathGrowIn' };
    }
    default: {
      return { type: 'linkPathGrowIn' };
    }
  }
};

type TypeAnimation<T extends IGraphic> = (
  graphic: T,
  options: any,
  animationParameters: IAnimationParameters
) => { from?: { [channel: string]: any }; to?: { [channel: string]: any } };

const linkPathGrowIn: TypeAnimation<IGraphic> = (
  graphic: IGraphic,
  options: any,
  animationParameters: IAnimationParameters
) => {
  const linkValues: ILinkPathMarkSpec = {
    x0: graphic.getFinalAttribute().x0,
    x1: graphic.getFinalAttribute().x1,
    y0: graphic.getFinalAttribute().y0,
    y1: graphic.getFinalAttribute().y1,
    thickness: graphic.getFinalAttribute().thickness
  };
  // // FIXME: undefined channel animation will cause vRender warning
  // Object.keys(linkValues).forEach(key => {
  //   if (isNil(linkValues[key])) {
  //     delete linkValues[key];
  //   }
  // });
  return {
    from: Object.assign({}, linkValues, { x1: linkValues.x0, y1: linkValues.y0 }),
    to: linkValues
  };
};

const linkPathGrowOut: TypeAnimation<IGraphic> = (
  element: IGraphic,
  options: any,
  animationParameters: IAnimationParameters
) => {
  const linkValues: ILinkPathMarkSpec = {
    x0: element.getFinalAttribute().x0,
    x1: element.getFinalAttribute().x1,
    y0: element.getFinalAttribute().y0,
    y1: element.getFinalAttribute().y1,
    thickness: element.getFinalAttribute().thickness
  };
  // // FIXME: undefined channel animation will cause vRender warning
  // Object.keys(linkValues).forEach(key => {
  //   if (isNil(linkValues[key])) {
  //     delete linkValues[key];
  //   }
  // });
  return {
    from: linkValues,
    to: Object.assign({}, linkValues, { x1: linkValues.x0, y1: linkValues.y0 })
  };
};

const linkPathUpdate: TypeAnimation<IGraphic> = (
  graphic: IGraphic,
  options: any,
  animationParameters: IAnimationParameters
) => {
  let from;
  let to;
  {
    const { x0, x1, y0, y1 } = graphic.getFinalAttribute();
    from = { x0, x1, y0, y1 };
  }
  {
    const { x0, x1, y0, y1 } = graphic.attribute as any;
    to = { x0, x1, y0, y1 };
  }

  return {
    from,
    to
  };
};

export class LinkPathGrowIn extends ACustomAnimate<Record<string, number>> {
  onBind(): void {
    super.onBind();
    if (this.params?.diffAttrs) {
      this.target.setAttributes(this.params.diffAttrs);
    }
    const { from, to } = linkPathGrowIn(this.target, this.params.options, this.params);
    const fromAttrs = this.target.context?.lastAttrs ?? from;
    const finalAttribute = this.target.getFinalAttribute();
    if (finalAttribute) {
      Object.assign(this.target.attribute, finalAttribute);
    }
    this.props = to;
    this.propKeys = Object.keys(to).filter(key => to[key] != null);
    this.animate.reSyncProps();
    this.from = fromAttrs;
    this.to = to;
    this.target.setAttributes(fromAttrs);
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export class LinkPathGrowOut extends ACustomAnimate<Record<string, number>> {
  onBind(): void {
    super.onBind();
    if (this.params?.diffAttrs) {
      this.target.setAttributes(this.params.diffAttrs);
    }
    const { from, to } = linkPathGrowOut(this.target, this.params.options, this.params);
    const fromAttrs = this.target.context?.lastAttrs ?? from;
    this.props = to;
    this.propKeys = Object.keys(to).filter(key => to[key] != null);
    this.animate.reSyncProps();
    this.from = fromAttrs;
    this.to = to;
    this.target.setAttributes(fromAttrs);
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export class LinkPathUpdate extends ACustomAnimate<Record<string, number>> {
  onBind(): void {
    if (this.params?.diffAttrs) {
      this.target.setAttributes(this.params.diffAttrs);
    }
    const { from, to } = linkPathUpdate(this.target, this.params.options, this.params);
    const fromAttrs = this.target.context?.lastAttrs ?? from;
    this.props = to;
    this.propKeys = Object.keys(to).filter(key => to[key] != null);
    this.animate.reSyncProps();
    this.from = fromAttrs;
    this.to = to;
    this.target.setAttributes(fromAttrs);
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const attribute: Record<string, any> = this.target.attribute;
    this.propKeys.forEach(key => {
      attribute[key] = this.from[key] + (this.to[key] - this.from[key]) * ratio;
    });
    this.target.setAttributes(attribute);
  }
}

export const registerSankeyAnimation = () => {
  Factory.registerAnimation('sankeyNode', (params: ISankeyAnimationParams, preset: SankeyAppearPreset) => ({
    appear: sankeyNodePresetAnimation(params, preset),
    ...FadeInOutAnimation
  }));
  Factory.registerAnimation('sankeyLinkPath', (params: unknown, preset: SankeyAppearPreset) => ({
    appear: sankeyLinkPresetAnimation(preset),
    enter: { type: 'linkPathGrowIn' },
    exit: { type: 'linkPathGrowOut' },
    disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
  }));
  AnimateExecutor.registerBuiltInAnimate('linkPathGrowOut', LinkPathGrowOut);
  AnimateExecutor.registerBuiltInAnimate('linkPathGrowIn', LinkPathGrowIn);
};
