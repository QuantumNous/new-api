import { Factory } from './../core/factory';
import type { IRippleMarkSpec } from '../typings/visual';
import type { IMarkStyle, IRippleMark } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { GlyphMark, registerGlyphMark } from './glyph';
import type { Datum } from '../typings/common';
import { createSymbol, type IGlyph, type ISymbolGraphicAttribute } from '@visactor/vrender-core';
import { clamp } from '@visactor/vutils';
import { registerSymbol } from '@visactor/vrender-kits/register/register-symbol';

export class RippleMark extends GlyphMark<IRippleMarkSpec> implements IRippleMark {
  static readonly type = MarkTypeEnum.ripple;
  readonly type = RippleMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IRippleMarkSpec> = {
      ...super._getDefaultStyle(),
      x: 0,
      y: 0,
      ripple: 0
    };
    return defaultStyle;
  }

  protected _subMarks = {
    ripple0: {
      type: 'symbol',
      defaultAttributes: {
        fillOpacity: 0.75
      }
    },
    ripple1: {
      type: 'symbol',
      defaultAttributes: {
        fillOpacity: 0.5
      }
    },
    ripple2: {
      type: 'symbol',
      defaultAttributes: {
        fillOpacity: 0.25
      }
    }
  };

  protected _positionChannels: string[] = ['ripple', 'size'];

  protected _positionEncoder = (glyphAttrs: any, datum: Datum, g: IGlyph) => {
    const { ripple = (g.attribute as any).ripple, size = (g.attribute as any).size } = glyphAttrs;
    const r = clamp(ripple, 0, 1);
    const rippleSize = size * 0.5;

    return {
      ripple0: { size: size + rippleSize * r, fillOpacity: 0.75 - r * 0.25 },
      ripple1: { size: size + rippleSize * (1 + r), fillOpacity: 0.5 - r * 0.25 },
      ripple2: { size: size + rippleSize * (2 + r), fillOpacity: 0.25 - r * 0.25 }
    };
  };
}

export const registerRippleMark = () => {
  registerGlyphMark();
  registerSymbol();
  Factory.registerMark(RippleMark.type, RippleMark);
  Factory.registerGraphicComponent('symbol', (attrs: ISymbolGraphicAttribute) => createSymbol(attrs));
};
