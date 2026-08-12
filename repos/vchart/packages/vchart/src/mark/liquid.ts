import { Factory } from './../core/factory';
import type { IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import type { ILiquidMark } from '../series/liquid/liquid';
import { GlyphMark, registerGlyphMark } from './glyph';
import { createArea, type IAreaGraphicAttribute, type IGlyph } from '@visactor/vrender-core';
import type { IPointLike } from '@visactor/vutils';
import { registerArea } from '@visactor/vrender-kits/register/register-area';
import type { ILiquidMarkSpec } from '../typings/visual';
import type { Datum } from '../typings/common';

export class LiquidMark extends GlyphMark<ILiquidMarkSpec> implements ILiquidMark {
  static readonly type = MarkTypeEnum.liquid;
  readonly type = LiquidMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<ILiquidMarkSpec> = {
      ...super._getDefaultStyle(),
      wave: 0
    };
    return defaultStyle;
  }

  protected _subMarks = {
    wave0: {
      type: 'area',
      defaultAttributes: {
        curveType: 'monotoneX',
        fillOpacity: 1
      }
    },
    wave1: {
      type: 'area',
      defaultAttributes: {
        curveType: 'monotoneX',
        fillOpacity: 0.66
      }
    },
    wave2: {
      type: 'area',
      defaultAttributes: {
        curveType: 'monotoneX',
        fillOpacity: 0.33
      }
    }
  };

  protected _positionChannels: string[] = ['wave', 'y', 'height'];

  protected _positionEncoder = (glyphAttrs: any, datum: Datum, g: IGlyph) => {
    const {
      wave = (g.attribute as any).wave,
      y = (g.attribute as any).y,
      height = (g.attribute as any).height
    } = glyphAttrs;
    const points0: IPointLike[] = [];
    const points1: IPointLike[] = [];
    const points2: IPointLike[] = [];

    for (let i = 0; i < 21; i++) {
      const waveHeight = i % 2 === 0 ? 20 : 0;
      const x = -500 + 50 * i;
      const wy = y + waveHeight;
      const wy1 = y + height;

      points0.push({ x: x + wave * 100, y: wy, y1: wy1 });
      points1.push({ x: x + wave * 200 - 40, y: wy, y1: wy1 });
      points2.push({ x: x + wave * 300 - 20, y: wy, y1: wy1 });
    }

    return {
      wave0: {
        x: 0,
        y: 0,
        points: points0
      },
      wave1: {
        x: 0,
        y: 0,
        points: points1
      },
      wave2: {
        x: 0,
        y: 0,
        points: points2
      }
    };
  };
}

export const registerLiquidMark = () => {
  registerGlyphMark();
  registerArea();
  Factory.registerMark(LiquidMark.type, LiquidMark);
  Factory.registerGraphicComponent('area', (attrs: IAreaGraphicAttribute) => createArea(attrs));
};
