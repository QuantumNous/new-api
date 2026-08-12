import { Factory } from './../core/factory';
import type { IMark } from './interface/common';
import { MarkTypeEnum } from './interface/type';
import { registerTextMark, TextMark } from './text';
import type { IComponentMark, ILabelMark } from './interface/mark';

export class LabelMark extends TextMark implements ILabelMark {
  static readonly type = MarkTypeEnum.text;
  static readonly constructorType = MarkTypeEnum.label;

  skipEncode = false;

  private _rule: string;
  getRule() {
    return this._rule;
  }
  setRule(rule: string) {
    this._rule = rule;
  }

  private _target: IMark;
  getTarget() {
    return this._target;
  }
  setTarget(target: IMark) {
    this._target = target;
    if (!this._rule) {
      this.setRule(target.type);
    }
  }

  private _component: IComponentMark;
  getComponent() {
    return this._component;
  }
  setComponent(component: IComponentMark) {
    this._component = component;
  }

  render(): void {
    // no need to render
  }
}

export const registerLabelMark = () => {
  registerTextMark();
  Factory.registerMark(LabelMark.constructorType, LabelMark);
};
