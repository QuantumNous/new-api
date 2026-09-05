import { Factory } from './../core/factory';
import type { IRectMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkStyle, IRectMark } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { registerRectAnimation } from '../animation/config';
import { registerRectDataLabel } from '@visactor/vrender-components/label';
import { createRect, registerRect, registerShadowRoot } from '../vrender-bridge';

export class RectMark extends BaseMark<IRectMarkSpec> implements IRectMark {
  static readonly type = MarkTypeEnum.rect;
  readonly type = RectMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IRectMarkSpec> = {
      ...super._getDefaultStyle(),
      width: undefined,
      height: undefined,
      lineWidth: 0
    };
    return defaultStyle;
  }
}

export const registerRectMark = () => {
  registerShadowRoot();
  registerRect();
  registerRectDataLabel();
  Factory.registerMark(RectMark.type, RectMark);
  registerRectAnimation();

  Factory.registerGraphicComponent(MarkTypeEnum.rect, createRect);
};
