import { Factory } from './../../core/factory';
/* eslint-disable no-duplicate-imports */
import type { IPolygonMarkSpec } from '../../typings/visual';
import { BasePolygonMark } from './base-polygon';
import type { IMarkStyle, IPolygonMark } from '../interface';
import { MarkTypeEnum } from '../interface/type';
import { registerPolygonAnimation } from '../../animation/config';
import { registerPolygon } from '@visactor/vrender-kits/register/register-polygon';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';
import { createPolygon } from '@visactor/vrender-core';

export class PolygonMark extends BasePolygonMark<IPolygonMarkSpec> implements IPolygonMark {
  static readonly type = MarkTypeEnum.polygon;
  readonly type = PolygonMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IPolygonMarkSpec> = {
      ...super._getDefaultStyle(),
      lineWidth: 0
    };
    return defaultStyle;
  }
}

export const registerPolygonMark = () => {
  Factory.registerMark(PolygonMark.type, PolygonMark);
  registerShadowRoot();
  registerPolygon();
  registerPolygonAnimation();

  Factory.registerGraphicComponent(MarkTypeEnum.polygon, createPolygon);
};
