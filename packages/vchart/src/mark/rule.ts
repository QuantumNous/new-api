import { Factory } from './../core/factory';
import type { IRuleMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkGraphic, IMarkStyle, IRuleMark } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { registerLine } from '@visactor/vrender-kits/register/register-line';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';
import type { IGraphic, ILineGraphicAttribute } from '@visactor/vrender-core';
import { createLine } from '@visactor/vrender-core';

export class RuleMark extends BaseMark<IRuleMarkSpec> implements IRuleMark {
  static readonly type = MarkTypeEnum.rule;
  readonly type = RuleMark.type;
  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IRuleMarkSpec> = {
      ...super._getDefaultStyle(),
      x1: 0,
      y1: 0
    };
    return defaultStyle;
  }

  protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any) {
    const finalAttrs = super._transformGraphicAttributes(g, attrs, groupAttrs);
    const { x, x1, y, y1, ...rest } = finalAttrs;

    return {
      ...rest,
      points: [
        { x, y },
        { x: x1, y: y1 }
      ]
    };
  }

  protected _createGraphic(attrs: ILineGraphicAttribute = {}): IGraphic {
    return createLine(attrs);
  }
}

export const registerRuleMark = () => {
  Factory.registerMark(RuleMark.type, RuleMark);
  registerShadowRoot();
  registerLine();

  Factory.registerGraphicComponent(MarkTypeEnum.line, createLine);
};
