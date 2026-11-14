import { createPyramid3d } from './graphic-creator';
import { registerPolygonAnimation } from '@visactor/vchart/esm/animation/config';
import { Factory } from '@visactor/vchart/esm/core/factory';
import { BasePolygonMark } from '@visactor/vchart/esm/mark/polygon/base-polygon';
import { registerPyramid3d, registerShadowRoot } from '@visactor/vchart/esm/vrender-bridge';
import type { IPyramid3dMark, IPyramid3dMarkSpec } from './interface';
import { MarkType3dEnum } from './enum';

export class Pyramid3dMark extends BasePolygonMark<IPyramid3dMarkSpec> implements IPyramid3dMark {
  static readonly type = MarkType3dEnum.pyramid3d;
  readonly type = Pyramid3dMark.type;

  protected _getDefaultStyle() {
    const defaultStyle = super._getDefaultStyle();

    defaultStyle.stroke = false;

    return defaultStyle;
  }

  constructor(name: string, option: any) {
    super(name, option);

    this._markConfig.support3d = true;
  }

  setMarkConfig(config: any) {
    super.setMarkConfig(config);

    this._markConfig.support3d = true;
  }
}

export const registerPyramid3dMark = () => {
  Factory.registerMark(Pyramid3dMark.type, Pyramid3dMark);
  registerShadowRoot();
  registerPyramid3d();
  registerPolygonAnimation();

  Factory.registerGraphicComponent(MarkType3dEnum.pyramid3d, createPyramid3d);
};
