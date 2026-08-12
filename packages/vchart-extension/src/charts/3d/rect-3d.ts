import { createRect3d } from '@visactor/vrender-core';
import { registerRect3d } from '@visactor/vrender-kits/register/register-rect3d';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';
import { registerRectAnimation } from '@visactor/vchart/esm/animation/config';
import { Factory } from '@visactor/vchart/esm/core/factory';
import { BaseMark } from '@visactor/vchart/esm/mark/base/base-mark';
import type { IMarkStyle } from '@visactor/vchart/esm/mark/interface/common';
import type { IRect3dMark, IRect3dMarkSpec } from './interface';
import { MarkType3dEnum } from './enum';

export class Rect3dMark extends BaseMark<IRect3dMarkSpec> implements IRect3dMark {
  static readonly type = MarkType3dEnum.rect3d;
  readonly type = Rect3dMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IRect3dMarkSpec> = {
      ...super._getDefaultStyle(),
      width: undefined,
      height: undefined,
      length: 3
    };
    return defaultStyle;
  }

  setDataLabelType() {
    return 'rect';
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

export const registerRect3dMark = () => {
  Factory.registerMark(Rect3dMark.type, Rect3dMark);
  registerShadowRoot();
  registerRect3d();
  registerRectAnimation();

  Factory.registerGraphicComponent(MarkType3dEnum.rect3d, createRect3d);
};
