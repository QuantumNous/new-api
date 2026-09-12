import type { EasingType } from '@visactor/vchart';
import { ACustomAnimate } from '@visactor/vchart';
import { isValidNumber } from '@visactor/vchart';
import type { IAnimationConfig } from '@visactor/vchart';
import { DEFAULT_ANIMATION_CONFIG, Factory } from '@visactor/vchart';

export class AxialRotateAnimation extends ACustomAnimate<{}> {
  declare valid: boolean;

  private _rotations: number;
  private _scaleX: number;

  constructor(from: any, to: any, duration: number, easing: EasingType, params: { rotation?: number }) {
    super(from, to, duration, easing, params);
    this._rotations = params?.rotation ?? 1;
  }

  onBind(): void {
    this._scaleX = this.target.attribute.scaleX;
    if (!isValidNumber(this._rotations)) {
      this.valid = false;
    }
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>) {
    if (this.valid === false) {
      return;
    }

    if (end) {
      out.scaleX = this._scaleX;
      return;
    }

    // 计算当前的旋转角度
    const currentAngle = this._rotations * 360 * ratio;
    const currentAngleInRadians = (currentAngle * Math.PI) / 180;
    const scaleX = Math.abs(Math.cos(currentAngleInRadians)) * (this._scaleX ?? 1);
    this.target.attribute.scaleX = scaleX;
    this.target.addUpdatePositionTag();
    this.target.addUpdateShapeAndBoundsTag();
  }
}

export interface IImageCloudAnimationParams {
  height: () => number;
  center: () => { x: number; y: number };
}
export type ImageCloudAppearPresetType = 'fadeIn' | 'scaleIn' | 'growIn' | 'axialRotate';

export function imageCloudPresetAnimation(
  params: IImageCloudAnimationParams,
  preset: ImageCloudAppearPresetType
): IAnimationConfig | IAnimationConfig[] {
  switch (preset) {
    case 'axialRotate':
      return [
        {
          custom: AxialRotateAnimation,
          customParameters: {
            rotation: 1
          },
          duration: DEFAULT_ANIMATION_CONFIG.appear.duration
        },
        {
          channel: {
            y: {
              from: (datum: any, element: any) => {
                return params.height() + element.getFinalAttribute().y;
              }
            },
            fillOpacity: {
              from: 0,
              to: 1
            }
          },
          easing: 'sineInOut'
        }
      ];
    case 'growIn':
      return {
        channel: {
          scaleX: {
            from: 0,
            to: 1
          },
          scaleY: {
            from: 0,
            to: 1
          },
          x: { from: () => params.center().x },
          y: { from: () => params.center().y }
        },
        duration: DEFAULT_ANIMATION_CONFIG.appear.duration
      };
    case 'scaleIn':
      return { type: 'scaleIn', duration: DEFAULT_ANIMATION_CONFIG.appear.duration };
    case 'fadeIn':
    default:
      return { type: 'fadeIn', easing: 'linear', duration: DEFAULT_ANIMATION_CONFIG.appear.duration };
  }
}

export const registerImageCloudAnimation = () => {
  Factory.registerAnimation('imageCloud', (params: IImageCloudAnimationParams, preset: ImageCloudAppearPresetType) => ({
    appear: imageCloudPresetAnimation(params, preset),
    enter: imageCloudPresetAnimation(params, preset),
    exit: { type: 'fadeOut' },
    disappear: { type: 'fadeOut' }
  }));
};
