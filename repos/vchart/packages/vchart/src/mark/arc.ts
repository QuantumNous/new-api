import { Factory } from './../core/factory';
import { ARC_MIDDLE_ANGLE } from '../constant/polar';
import type { IArcMarkSpec, Datum, StateValueType } from '../typings';
import type { ExChannelCall } from './base/base-mark';
// eslint-disable-next-line no-duplicate-imports
import { BaseMark } from './base/base-mark';
import type { IArcMark, IMarkOption, IMarkRaw, IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface/type';
import { registerArcAnimation } from '../animation/config';
import { polarToCartesian } from '@visactor/vutils';
import { createArc } from '@visactor/vrender-core';
import { registerArcDataLabel } from '@visactor/vrender-components/label';
import { registerArc } from '@visactor/vrender-kits/register/register-arc';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';

export class BaseArcMark<T extends IArcMarkSpec> extends BaseMark<T> implements IMarkRaw<T> {
  readonly type: string = ArcMark.type;

  _unCompileChannel = { centerOffset: true, radiusOffset: true };

  constructor(name: string, option: IMarkOption) {
    super(name, option);

    // because of set object.function, this setting should be write after object init
    this._computeExChannel.x = this.computeCenter as ExChannelCall;
    this._computeExChannel.y = this.computeCenter as ExChannelCall;
    this._computeExChannel.outerRadius = this.computeOuterRadius as ExChannelCall;

    this._extensionChannel.centerOffset = ['x', 'y'];
    this._extensionChannel.radiusOffset = ['outerRadius'];
  }

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<T> = {
      ...super._getDefaultStyle(),
      startAngle: 0,
      endAngle: 0,
      outerRadius: 0,
      innerRadius: 0,
      cornerRadius: 0,
      lineWidth: 0,
      innerPadding: 0,
      outerPadding: 0
    };
    return defaultStyle;
  }

  protected computeOuterRadius = (
    key: string,
    datum: Datum,
    states: StateValueType = 'normal',
    superValue: number
  ): number => {
    const offset = (this.getAttribute('radiusOffset', datum, states) as number) ?? 0;
    return superValue + offset;
  };

  protected computeCenter = (key: 'x' | 'y', datum: Datum, states: StateValueType = 'normal', center: number) => {
    return (
      polarToCartesian(
        { x: 0, y: 0 },
        this.getAttribute('centerOffset', datum, states) as number,
        datum[ARC_MIDDLE_ANGLE]
      )[key] + center
    );
  };
}

export class ArcMark extends BaseArcMark<IArcMarkSpec> implements IArcMark {
  static readonly type = MarkTypeEnum.arc;
  readonly type: MarkTypeEnum = ArcMark.type;
}

export const registerArcMark = () => {
  registerShadowRoot();
  registerArc();
  registerArcDataLabel();
  registerArcAnimation();
  Factory.registerGraphicComponent(MarkTypeEnum.arc, createArc);
  Factory.registerMark(ArcMark.type, ArcMark);
};
