import { array } from '@visactor/vutils';
import {
  STACK_FIELD_END,
  STACK_FIELD_END_PERCENT,
  STACK_FIELD_START,
  STACK_FIELD_START_PERCENT
} from '../../../constant/data';
import { PolarSeries } from '../polar';
import type { IRoseLikeSeriesSpec } from './interface';
import type { ISeriesSpecUpdatePolicy } from '../../base/base-series';

const ROSE_LIKE_SERIES_COMPILE_ONLY_KEYS: Record<
  'radius' | 'outerRadius' | 'innerRadius' | 'startAngle' | 'endAngle' | 'centerX' | 'centerY',
  true
> = {
  radius: true,
  outerRadius: true,
  innerRadius: true,
  startAngle: true,
  endAngle: true,
  centerX: true,
  centerY: true
};

export abstract class RoseLikeSeries<T extends IRoseLikeSeriesSpec> extends PolarSeries<T> {
  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...ROSE_LIKE_SERIES_COMPILE_ONLY_KEYS
      }
    };
  }

  getStackGroupFields(): string[] {
    return this._angleField;
  }

  getStackValueField() {
    return array(this._spec.valueField)[0] || array(this._spec.radiusField)[0];
  }

  getGroupFields() {
    return this._angleField;
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    // 兼容小组件写法，因为 spec 改造前已经开放了
    this.setAngleField(this._spec.categoryField || this._spec.angleField);
    this.setRadiusField(this._spec.valueField || this._spec.radiusField);
    this._specAngleField = this._angleField.slice();
    this._specRadiusField = this._radiusField.slice();
    this.setInnerRadiusField(this._spec.valueField || this._spec.radiusField);
    if (this.getStack()) {
      this.setValueFieldToStack();
    }
    if (this.getPercent()) {
      this.setValueFieldToPercent();
    }
  }

  setValueFieldToStack(): void {
    this.setRadiusField(STACK_FIELD_END);
    this.setInnerRadiusField(STACK_FIELD_START);
  }

  setValueFieldToPercent(): void {
    this.setRadiusField(STACK_FIELD_END_PERCENT);
    this.setInnerRadiusField(STACK_FIELD_START_PERCENT);
  }

  getDimensionField(): string[] {
    return this._specAngleField;
  }
  getMeasureField(): string[] {
    return this._specRadiusField;
  }

  getDefaultShapeType(): string {
    return 'square';
  }
}
