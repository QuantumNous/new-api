import { Factory } from './../core/factory';
import type { BoxPlotShaftShape, IBoxPlotMarkSpec } from '../typings/visual';
import type { IBoxPlotMark, IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { createLine, createRect, type IGlyph, type ILineGraphicAttribute } from '@visactor/vrender-core';
import { GlyphMark, registerGlyphMark } from './glyph';
import type { Datum } from '../typings/common';
import { isValidNumber } from '@visactor/vutils';
import { registerLine } from '@visactor/vrender-kits/register/register-line';
import { registerRect } from '@visactor/vrender-kits/register/register-rect';

const BAR_BOX_PLOT_CHANNELS = [
  'x',
  'y',
  'minMaxWidth',
  'minMaxHeight',
  'q1q3Width',
  'q1q3Height',
  'q1',
  'q3',
  'min',
  'max',
  'median',
  'angle'
];

const BOX_PLOT_CHANNELS = [
  'x',
  'y',
  'boxWidth',
  'boxHeight',
  'ruleWidth',
  'ruleHeight',
  'q1',
  'q3',
  'min',
  'max',
  'median',
  'angle'
];

export class BoxPlotMark
  extends GlyphMark<IBoxPlotMarkSpec, { direction?: 'horizontal' | 'vertical'; shaftShape?: BoxPlotShaftShape }>
  implements IBoxPlotMark
{
  static readonly type = MarkTypeEnum.boxPlot;
  readonly type = BoxPlotMark.type;

  protected _isHorizontal() {
    return this._glyphConfig && this._glyphConfig.direction === 'horizontal';
  }

  setGlyphConfig(cfg: { direction?: 'horizontal' | 'vertical'; shaftShape?: BoxPlotShaftShape }): void {
    super.setGlyphConfig(cfg);

    if (cfg.shaftShape === 'bar') {
      this._subMarks = {
        minMaxBox: {
          type: 'rect',
          defaultAttributes: {
            lineWidth: 0
          }
        },
        q1q3Box: {
          type: 'rect',
          defaultAttributes: {
            lineWidth: 0
          }
        },
        median: {
          type: 'line',
          defaultAttributes: { x: 0, y: 0 }
        }
      };
      this._positionChannels = BAR_BOX_PLOT_CHANNELS;
      this._channelEncoder = {
        minMaxFillOpacity: (val: number) => ({ minMaxBox: { fillOpacity: val } }),
        lineWidth: (val: number) => ({ minMaxBox: { lineWidth: 0 }, q1q3Box: { lineWidth: 0 } }),
        stroke: (val: number) => ({ minMaxBox: { stroke: false }, q1q3Box: { stroke: false } })
      };

      this._positionEncoder = (glyphAttrs: any, datum: Datum, g: IGlyph) => {
        const {
          x = g.attribute.x,
          y = g.attribute.y,
          minMaxWidth = (g.attribute as any).minMaxWidth,
          minMaxHeight = (g.attribute as any).minMaxHeight,
          q1q3Width = (g.attribute as any).q1q3Width,
          q1q3Height = (g.attribute as any).q1q3Height,
          q1 = (g.attribute as any).q1,
          q3 = (g.attribute as any).q3,
          min = (g.attribute as any).min,
          max = (g.attribute as any).max,
          median = (g.attribute as any).median,
          angle
        } = glyphAttrs;
        const isH = this._isHorizontal();

        const attributes: any = {};

        if (isH) {
          attributes.minMaxBox = {
            x: min,
            x1: max,
            y: y - minMaxHeight / 2,
            y1: y + minMaxHeight / 2
          };
          attributes.q1q3Box = {
            x: q1,
            x1: q3,
            y: y - q1q3Height / 2,
            y1: y + q1q3Height / 2
          };

          attributes.median = {
            points: [
              {
                x: median,
                y: y - q1q3Height / 2
              },
              {
                x: median,
                y: y + q1q3Height / 2
              }
            ]
          };
        } else {
          attributes.minMaxBox = {
            y: min,
            y1: max,
            x: x - minMaxWidth / 2,
            x1: x + minMaxWidth / 2
          };
          attributes.q1q3Box = {
            y: q1,
            y1: q3,
            x: x - q1q3Width / 2,
            x1: x + q1q3Width / 2
          };

          attributes.median = {
            points: [
              {
                y: median,
                x: x - q1q3Width / 2
              },
              {
                y: median,
                x: x + q1q3Width / 2
              }
            ]
          };
        }

        if (isValidNumber(angle)) {
          const anchor = glyphAttrs.anchor ?? (isH ? [(min + max) / 2, y] : [x, (min + max) / 2]);
          Object.keys(attributes).forEach(key => {
            attributes[key].angle = angle;
            attributes[key].anchor = anchor;
          });
        }

        return attributes;
      };
    } else {
      this._subMarks = {
        shaft: { type: 'line', defaultAttributes: { x: 0, y: 0 } },
        box: { type: 'rect' },
        max: { type: 'line', defaultAttributes: { x: 0, y: 0 } },
        min: { type: 'line', defaultAttributes: { x: 0, y: 0 } },
        median: { type: 'line', defaultAttributes: { x: 0, y: 0 } }
      };
      this._positionChannels = BOX_PLOT_CHANNELS;
      this._channelEncoder = {
        boxStroke: (val: string) => ({ box: { stroke: val } }),
        medianStroke: (val: string) => ({ median: { stroke: val } }),
        boxCornerRadius: (val: number) => ({ box: { cornerRadius: val } })
      };
      this._positionEncoder = (glyphAttrs: any, datum: Datum, g: IGlyph) => {
        const {
          x = g.attribute.x,
          y = g.attribute.y,
          boxWidth = (g.attribute as any).boxWidth,
          boxHeight = (g.attribute as any).boxHeight,
          ruleWidth = (g.attribute as any).ruleWidth,
          ruleHeight = (g.attribute as any).ruleHeight,
          q1 = (g.attribute as any).q1,
          q3 = (g.attribute as any).q3,
          min = (g.attribute as any).min,
          max = (g.attribute as any).max,
          median = (g.attribute as any).median,
          angle
        } = glyphAttrs;
        const isH = this._isHorizontal();

        const attributes: any = {};

        if (isH) {
          attributes.box = {
            x: q1,
            x1: q3,
            y: y - boxHeight / 2,
            y1: y + boxHeight / 2
          };
          attributes.median = {
            points: [
              {
                x: median,
                y: y - boxHeight / 2
              },
              {
                x: median,
                y: y + boxHeight / 2
              }
            ]
          };
          attributes.shaft = {
            points: [
              {
                x: min,
                y: y
              },
              {
                x: max,
                y: y
              }
            ]
          };
          attributes.max = {
            points: [
              {
                x: max,
                y: y - ruleHeight / 2
              },
              {
                x: max,
                y: y + ruleHeight / 2
              }
            ]
          };
          attributes.min = {
            points: [
              {
                x: min,
                y: y - ruleHeight / 2
              },
              {
                x: min,
                y: y + ruleHeight / 2
              }
            ]
          };
        } else {
          attributes.box = {
            x: x - boxWidth / 2,
            x1: x + boxWidth / 2,
            y: q1,
            y1: q3
          };
          attributes.median = {
            points: [
              {
                x: x - boxWidth / 2,
                y: median
              },
              {
                x: x + boxWidth / 2,
                y: median
              }
            ]
          };

          attributes.max = {
            points: [
              {
                x: x - ruleWidth / 2,
                y: max
              },
              {
                x: x + ruleWidth / 2,
                y: max
              }
            ]
          };
          attributes.min = {
            points: [
              {
                x: x - ruleWidth / 2,
                y: min
              },
              {
                x: x + ruleWidth / 2,
                y: min
              }
            ]
          };
          attributes.shaft = {
            points: [
              {
                x: x,
                y: min
              },
              {
                x: x,
                y: max
              }
            ]
          };
        }

        if (isValidNumber(angle)) {
          const anchor = glyphAttrs.anchor ?? (isH ? [(min + max) / 2, y] : [x, (min + max) / 2]);
          Object.keys(attributes).forEach(key => {
            attributes[key].angle = angle;
            attributes[key].anchor = anchor;
          });
        }

        return attributes;
      };
    }
  }

  setDataLabelType() {
    return 'symbol';
  }

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IBoxPlotMarkSpec> = {
      ...super._getDefaultStyle(),
      lineWidth: 2,
      boxWidth: 30,
      shaftWidth: 20,
      shaftShape: 'line'
    };
    return defaultStyle;
  }
}

export const registerBoxPlotMark = () => {
  registerGlyphMark();
  registerLine();
  registerRect();
  Factory.registerGraphicComponent('line', (attrs: ILineGraphicAttribute) => createLine(attrs));
  Factory.registerGraphicComponent('rect', (attrs: ILineGraphicAttribute) => createRect(attrs));
  Factory.registerMark(BoxPlotMark.type, BoxPlotMark);
};
