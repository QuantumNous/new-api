import { ACustomAnimate } from '@visactor/vrender-animate';
import type { IVennCircle, IVennOverlapArc, VennCircleName } from '@visactor/vlayouts';
import { getArcsFromCircles, getCirclesFromArcs, getPathFromArcs } from '@visactor/vlayouts';

import type { VennAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
// import { ACustomAnimate } from '@visactor/vrender-animate';
import { Factory } from '../../core/factory';
import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';

export const vennCirclePresetAnimation = (preset: VennAppearPreset): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'growIn': {
      return {
        type: 'growRadiusIn'
      };
    }
    case 'scaleIn': {
      return {
        type: 'scaleIn'
      };
    }
    default: {
      return {
        type: 'fadeIn'
      };
    }
  }
};

export const vennOverlapPresetAnimation = (preset: VennAppearPreset): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'scaleIn': {
      return {
        type: 'scaleIn'
      };
    }
    default: {
      return {
        type: 'fadeIn'
      };
    }
  }
};

export class VennOverlapAnimation extends ACustomAnimate<{ path: string; arcs: IVennOverlapArc[] }> {
  protected fromCircles: Record<VennCircleName, IVennCircle>;
  protected toCircles: Record<VennCircleName, IVennCircle>;

  onBind(): void {
    this.fromCircles = {};
    getCirclesFromArcs((this.target.attribute as any).arcs)?.forEach((c: IVennCircle) => {
      this.fromCircles[c.setId] = c;
    });
    this.toCircles = {};
    getCirclesFromArcs(this.target.getFinalAttribute().arcs)?.forEach((c: IVennCircle) => {
      this.toCircles[c.setId] = c;
    });
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const circles: IVennCircle[] = [];
    Object.keys(this.fromCircles).forEach(key => {
      const fromC = this.fromCircles[key];
      const toC = this.toCircles[key];
      if (fromC && toC) {
        circles.push({
          radius: fromC.radius + (toC.radius - fromC.radius) * ratio,
          x: fromC.x + (toC.x - fromC.x) * ratio,
          y: fromC.y + (toC.y - fromC.y) * ratio,
          setId: key
        } as IVennCircle);
      }
    });
    const arcs = getArcsFromCircles(circles);

    this.target.setAttributes({
      arcs,
      path: getPathFromArcs(arcs)
    } as any);
  }
}

export const registerVennAnimation = () => {
  Factory.registerAnimation('vennCircle', (params: unknown, preset: VennAppearPreset) => {
    return {
      appear: vennCirclePresetAnimation(preset),
      enter: { type: 'growRadiusIn' },
      exit: { type: 'growRadiusOut' },
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    };
  });
  Factory.registerAnimation('vennOverlap', (params: unknown, preset: VennAppearPreset) => {
    return {
      appear: vennOverlapPresetAnimation(preset),
      update: { custom: VennOverlapAnimation },
      enter: { type: 'fadeIn' },
      exit: { type: 'fadeOut' },
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    };
  });
};
