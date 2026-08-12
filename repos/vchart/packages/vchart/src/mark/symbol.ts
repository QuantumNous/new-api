import { Factory } from './../core/factory';
import type { ISymbolMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkGraphic, IMarkStyle, ISymbolMark } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import type { ISymbolGraphicAttribute } from '@visactor/vrender-core';
import { createSymbol, registerShadowRoot, registerSymbol } from '../vrender-bridge';
import { registerSymbolDataLabel } from '@visactor/vrender-components/label/symbol';
import { isNil } from '@visactor/vutils';

export class SymbolMark extends BaseMark<ISymbolMarkSpec> implements ISymbolMark {
  static readonly type = MarkTypeEnum.symbol;
  readonly type = SymbolMark.type;
  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<ISymbolMarkSpec> = {
      ...super._getDefaultStyle(),
      size: 1,
      symbolType: 'circle',
      fill: undefined,
      lineWidth: 0
    };
    return defaultStyle as IMarkStyle<ISymbolMarkSpec>;
  }

  protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any) {
    const symbolAttrs = super._transformGraphicAttributes(g, attrs, groupAttrs);
    const symbolType =
      symbolAttrs.shape ?? symbolAttrs.symbolType ?? (g.attribute as ISymbolGraphicAttribute)?.symbolType;

    if (isNil(symbolType)) {
      symbolAttrs.symbolType = 'circle';
    } else {
      symbolAttrs.symbolType = symbolType;
    }
    return symbolAttrs;
  }
}

export const registerSymbolMark = () => {
  Factory.registerMark(SymbolMark.type, SymbolMark);
  registerShadowRoot();
  registerSymbol();
  registerSymbolDataLabel();

  Factory.registerGraphicComponent(MarkTypeEnum.symbol, createSymbol);
};
