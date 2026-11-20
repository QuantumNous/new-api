import { Factory } from './../core/factory';
import type { IAreaMarkSpec } from '../typings/visual';
import { BaseLineMark, LINE_SEGMENT_ATTRIBUTES } from './base/base-line';
import type { IAreaMark, IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { registerLineOrAreaAnimation } from '../animation/config';
import { registerLineDataLabel } from '@visactor/vrender-components/label/line';
import { registerSymbolDataLabel } from '@visactor/vrender-components/label/symbol';
import { createArea, registerArea, registerShadowRoot } from '../vrender-bridge';

const AREA_SEGMENT_ATTRIBUTES = [
  ...LINE_SEGMENT_ATTRIBUTES,
  'fill',
  'fillOpacity',
  'background',
  'texture',
  'texturePadding',
  'textureSize',
  'textureColor'
];

export class AreaMark extends BaseLineMark<IAreaMarkSpec> implements IAreaMark {
  static readonly type = MarkTypeEnum.area;
  readonly type = AreaMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IAreaMarkSpec> = {
      ...super._getDefaultStyle(),
      lineWidth: 0
    };
    return defaultStyle;
  }

  protected _getSegmentAttributes() {
    return AREA_SEGMENT_ATTRIBUTES;
  }

  protected _getIgnoreAttributes(): string[] {
    return [];
  }

  _isValidPointChannel = (channel: string) => {
    return ['x', 'y', 'x1', 'y1', 'defined'].includes(channel);
  };
}

export const registerAreaMark = () => {
  Factory.registerMark(AreaMark.type, AreaMark);
  registerShadowRoot();
  registerArea();
  registerLineDataLabel();
  registerSymbolDataLabel();
  registerLineOrAreaAnimation();
  Factory.registerGraphicComponent(MarkTypeEnum.area, createArea);
};
