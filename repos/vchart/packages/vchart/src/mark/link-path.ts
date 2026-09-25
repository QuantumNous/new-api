import { Factory } from './../core/factory';
import type { ILinkPathMarkSpec } from '../typings/visual';
import type { ILinkPathConfig, ILinkPathMark, IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { GlyphMark, registerGlyphMark } from './glyph';
import type { IGlyph, IPathGraphicAttribute } from '@visactor/vrender-core';
import { createPath, registerPath } from '../vrender-bridge';
import type { Datum } from '../typings/common';

export const getHorizontalPath = (options: ILinkPathMarkSpec, ratio?: number) => {
  const curvature = options.curvature ?? 0.5;
  const hasThickness = true;
  const thickness = typeof ratio === 'number' ? options.thickness * ratio : options.thickness;

  let x0 = options.x0;
  let x1 = options.x1;
  let y00 = options.y0;
  let y10 = options.y1;
  let cpx0 = x0 + curvature * (x1 - x0);
  let cpx1 = x1 + curvature * (x0 - x1);
  let formatter = (v: number) => v;

  if (options.round !== false) {
    x0 = Math.round(x0);
    x1 = Math.round(x1);
    y00 = Math.round(y00);
    y10 = Math.round(y10);
    cpx0 = Math.round(cpx0);
    cpx1 = Math.round(cpx1);
    formatter = Math.round;
  }
  const topPath =
    options.pathType === 'line'
      ? `M${x0},${y00}L${x1},${y10}`
      : options.pathType === 'polyline'
      ? `M${x0},${y00}L${cpx0},${y00}L${cpx0},${y10}L${x1},${y10}`
      : `M${x0},${y00}C${cpx0},${y00},${cpx1},${y10},${x1},${y10}`;

  if (!hasThickness) {
    // simplified to a single path
    return topPath;
  }

  if (options.align === 'center') {
    y00 = formatter(options.y0 - thickness / 2);
    y10 = formatter(options.y1 - thickness / 2);
  } else if (options.align === 'end') {
    y00 = formatter(options.y0 + options.thickness / 2 - thickness);
    y10 = formatter(options.y1 + options.thickness / 2 - thickness);
  } else {
    y00 = formatter(options.y0 - options.thickness / 2);
    y10 = formatter(options.y1 - options.thickness / 2);
  }

  const y01 = formatter(y00 + thickness);
  const y11 = formatter(y10 + thickness);

  const hasLength = Math.abs(x1 - x0) > 1e-6;
  const endArrowPath =
    options.endArrow && hasLength
      ? `L${x1},${formatter(y10 - thickness / 2)}L${formatter(x1 + thickness)},${formatter(
          (y10 + y11) / 2
        )}L${x1},${formatter(y11 + thickness / 2)}`
      : '';
  const startArrowPath =
    options.startArrow && hasLength
      ? `L${x0},${formatter(y01 + thickness / 2)}L${formatter(x0 - thickness)},${formatter(
          (y00 + y01) / 2
        )}L${x0},${formatter(y00 - thickness / 2)}`
      : '';

  if (options.pathType === 'line') {
    return `M${x0},${y00}L${x1},${y10}${endArrowPath}L${x1},${y11}L${x0},${y01}${startArrowPath}Z`;
  } else if (options.pathType === 'polyline') {
    return `M${x0},${y00}L${cpx0},${y00}L${cpx0},${y10}L${x1},${y10}
    ${endArrowPath}L${x1},${y11}L${cpx0},${y11}L${cpx0},${y01}L${x0},${y01}${startArrowPath}Z`;
  }

  return `M${x0},${y00}C${cpx0},${y00},${cpx1},${y10},${x1},${y10}
  ${endArrowPath}L${x1},${y11}C${cpx1},${y11},${cpx0},${y01},${x0},${y01}${startArrowPath}Z`;
};

export const getVerticalPath = (options: ILinkPathMarkSpec, ratio?: number) => {
  const curvature = options.curvature ?? 0.5;
  const hasThickness = true;
  const thickness = typeof ratio === 'number' ? options.thickness * ratio : options.thickness;
  let y0 = options.y0;
  let y1 = options.y1;
  let x00 = options.x0;
  let x10 = options.x1;
  let cpy0 = y0 + curvature * (y1 - y0);
  let cpy1 = y1 + curvature * (y0 - y1);
  let formatter = (v: number) => v;

  if (options.round !== false) {
    formatter = Math.round;
    y0 = Math.round(y0);
    y1 = Math.round(y1);
    x00 = Math.round(x00);
    x10 = Math.round(x10);
    cpy0 = Math.round(cpy0);
    cpy1 = Math.round(cpy1);
  }
  const leftpath =
    options.pathType === 'line'
      ? `M${x00},${y0}L${x10},${y1}`
      : options.pathType === 'polyline'
      ? `M${x00},${y0}L${x00},${cpy0}L${x10},${cpy0}L${x10},${y1}`
      : `M${x00},${y0}C${x00},${cpy0},${x10},${cpy1},${x10},${y1}`;
  if (!hasThickness) {
    // simplified to a single path
    return leftpath;
  }

  if (options.align === 'center') {
    x00 = formatter(options.x0 - thickness / 2);
    x10 = formatter(options.x1 - thickness / 2);
  } else if (options.align === 'end') {
    x00 = formatter(options.x0 + options.thickness / 2 - thickness);
    x10 = formatter(options.x1 + options.thickness / 2 - thickness);
  } else {
    x00 = formatter(options.x0 - options.thickness / 2);
    x10 = formatter(options.x1 - options.thickness / 2);
  }

  const x01 = formatter(x00 + thickness);
  const x11 = formatter(x10 + thickness);

  const hasLength = Math.abs(y1 - y0) > 1e-6;
  const endArrowPath =
    options.endArrow && hasLength
      ? `L${formatter(x10 - thickness / 2)},${y1}L${formatter((x10 + x11) / 2)},${formatter(
          y1 + thickness
        )}L${formatter(x11 + thickness / 2)},${y1}`
      : '';
  const startArrowPath =
    options.startArrow && hasLength
      ? `L${formatter(x01 + thickness / 2)},${y0}L${formatter((x01 + x00) / 2)},${formatter(
          y0 - thickness
        )}L${formatter(x00 - thickness / 2)},${y0}`
      : '';

  if (options.pathType === 'line') {
    return `M${x00},${y0}L${x10},${y1}${endArrowPath}L${x11},${y1}L${x01},${y0}${startArrowPath}Z`;
  } else if (options.pathType === 'polyline') {
    return `M${x00},${y0}L${x00},${cpy0}L${x10},${cpy0}L${x10},${y1}
    ${endArrowPath}L${x11},${y1}L${x11},${cpy0}L${x01},${cpy0}L${x01},${y0}${startArrowPath}Z`;
  }

  return `M${x00},${y0}C${x00},${cpy0},${x10},${cpy1},${x10},${y1}
  ${endArrowPath}L${x11},${y1}C${x11},${cpy1},${x01},${cpy0},${x01},${y0}${startArrowPath}Z`;
};

export class LinkPathMark extends GlyphMark<ILinkPathMarkSpec, ILinkPathConfig> implements ILinkPathMark {
  static readonly type = MarkTypeEnum.linkPath;
  readonly type = LinkPathMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<ILinkPathMarkSpec> = {
      ...super._getDefaultStyle(),
      x: 0,
      y: 0,
      x0: 0,
      y0: 0,
      x1: 100,
      y1: 100,
      thickness: 1,
      round: true
    };
    return defaultStyle;
  }

  protected _subMarks = {
    back: {
      type: 'path',
      defaultAttributes: {
        zIndex: 0
      }
    },
    front: {
      type: 'path',
      defaultAttributes: {
        zIndex: 1
      }
    }
  };

  protected _positionChannels: string[] = [
    'x0',
    'y0',
    'x1',
    'y1',
    'thickness',
    'round',
    'curvature',
    'ratio',
    'pathType',
    'align',
    'endArrow',
    'startArrow',
    'ratio'
  ];

  protected _channelEncoder = {
    backgroundStyle: (val: any) => {
      return {
        back: val
      };
    }
  };

  protected _positionEncoder = (glyphAttrs: any, datum: Datum, g: IGlyph) => {
    const newAttrs = {
      ...g.attribute,
      ...glyphAttrs
    };

    const direction = newAttrs.direction ?? this._glyphConfig?.direction;
    const parsePath = ['vertical', 'TB', 'BT'].includes(direction) ? getVerticalPath : getHorizontalPath;
    const isRatioShow = typeof newAttrs.ratio === 'number' && newAttrs.ratio >= 0 && newAttrs.ratio <= 1;

    return {
      back: {
        path: isRatioShow ? parsePath(newAttrs, 1) : ''
      },
      front: {
        path: parsePath(newAttrs, isRatioShow ? newAttrs.ratio : 1)
      }
    };
  };
}

export const registerLinkPathMark = () => {
  registerGlyphMark();
  registerPath();
  Factory.registerGraphicComponent('path', (attrs: IPathGraphicAttribute) => createPath(attrs));
  Factory.registerMark(LinkPathMark.type, LinkPathMark as any);
};
