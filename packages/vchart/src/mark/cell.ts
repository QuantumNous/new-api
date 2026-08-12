import { Factory } from './../core/factory';
import type { ICellMarkSpec } from '../typings';
import type { ICellMark, IMarkGraphic, IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';
import { registerSymbol } from '@visactor/vrender-kits/register/register-symbol';
import { registerSymbolDataLabel } from '@visactor/vrender-components';
import type { IGraphic, ISymbolGraphicAttribute } from '@visactor/vrender-core';
import { createSymbol } from '@visactor/vrender-core';
import { isNil } from '@visactor/vutils';
import { BaseMark } from './base';

export class CellMark extends BaseMark<ICellMarkSpec> implements ICellMark {
  static readonly type = MarkTypeEnum.cell;
  readonly type = CellMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<ICellMarkSpec> = {
      ...super._getDefaultStyle(),
      fill: undefined,
      lineWidth: 0,
      padding: 0
    };
    return defaultStyle;
  }

  protected _createGraphic(attrs: any = {}): IGraphic {
    return createSymbol(attrs);
  }

  protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any) {
    const symbolAttrs = super._transformGraphicAttributes(g, attrs, groupAttrs);
    const symbolType =
      symbolAttrs.shape ?? symbolAttrs.symbolType ?? (g.attribute as ISymbolGraphicAttribute)?.symbolType;

    if (isNil(symbolType)) {
      symbolAttrs.symbolType = 'rect';
    } else {
      symbolAttrs.symbolType = symbolType;
    }
    return symbolAttrs;
  }
}

export const registerCellMark = () => {
  Factory.registerMark(CellMark.type, CellMark);

  Factory.registerGraphicComponent(MarkTypeEnum.symbol, createSymbol);

  registerShadowRoot();
  registerSymbol();
  registerSymbolDataLabel();
};
