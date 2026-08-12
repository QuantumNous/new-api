import { Factory } from './../core/factory';
import type { IPathMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkStyle, IPathMark } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { registerPath } from '@visactor/vrender-kits/register/register-path';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';
import { createPath } from '@visactor/vrender-core';

export class PathMark extends BaseMark<IPathMarkSpec> implements IPathMark {
  static readonly type = MarkTypeEnum.path;
  readonly type = PathMark.type;

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IPathMarkSpec> = {
      ...super._getDefaultStyle(),
      lineWidth: 0,
      path: ''
    };
    return defaultStyle;
  }
}

export const registerPathMark = () => {
  Factory.registerMark(PathMark.type, PathMark);
  registerShadowRoot();
  registerPath();

  Factory.registerGraphicComponent(MarkTypeEnum.path, createPath);
};
