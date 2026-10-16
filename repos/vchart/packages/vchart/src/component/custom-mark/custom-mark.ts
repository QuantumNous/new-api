import { BaseComponent } from '../base/base-component';
import { ComponentTypeEnum } from '../interface/type';
// eslint-disable-next-line no-duplicate-imports
import { LayoutLevel, LayoutZIndex } from '../../constant/layout';
import { PREFIX } from '../../constant/base';
import type { EnableMarkType, ICustomMarkGroupSpec, ICustomMarkSpec, ILayoutRect } from '../../typings';
import type { IComponentMark, IMark } from '../../mark/interface';
import { MarkTypeEnum, type IGroupMark } from '../../mark/interface';
// eslint-disable-next-line no-duplicate-imports
import { Bounds, isEqual, isNil, isValid, isValidNumber } from '@visactor/vutils';
import { Factory } from '../../core/factory';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import type { IModelMarkAttributeContext } from '../../compile/mark/interface';

const CUSTOM_MARK_COMPONENT_ONLY_CHANGE_KEYS: Record<string, boolean> = {
  style: true,
  state: true
};

// TODO: 规范范型
export class CustomMark extends BaseComponent<ICustomMarkSpec<EnableMarkType>> {
  static type = ComponentTypeEnum.customMark;
  type = ComponentTypeEnum.customMark;

  static specKey = 'customMark';
  specKey = 'customMark';

  layoutType: 'none' = 'none';
  layoutZIndex: number = LayoutZIndex.CustomMark;
  layoutLevel: number = LayoutLevel.CustomMark;

  protected declare _spec: ICustomMarkSpec<Exclude<EnableMarkType, 'group'>> | ICustomMarkGroupSpec;

  created() {
    super.created();
    this.initMarks();
    this.initEvent();
  }

  protected _markAttributeContext: IModelMarkAttributeContext;
  getMarkAttributeContext() {
    return this._markAttributeContext;
  }

  protected _buildMarkAttributeContext() {
    this._markAttributeContext = {
      vchart: this._option.globalInstance,
      globalScale: (key: string, value: string | number) => {
        return this._option.globalScale.getScale(key)?.scale(value);
      }
    };
  }

  protected initMarks() {
    if (!this._spec) {
      return;
    }

    let parentMark: IGroupMark | null = null;
    if (this._spec.parent) {
      const mark = this.getChart()
        .getAllMarks()
        .find(m => m.getUserId() === this._spec.parent) as IGroupMark;
      if (mark.type === 'group') {
        parentMark = mark;
      }
    }
    this._createExtensionMark(this._spec, parentMark, `${PREFIX}_series_${this.id}_extensionMark`, 0);
  }

  private _createExtensionMark(
    spec: ICustomMarkSpec<Exclude<EnableMarkType, 'group'>> | ICustomMarkGroupSpec,
    parentMark: null | IGroupMark,
    namePrefix: string,
    index: number = 0
  ) {
    const mark = this._createMark(
      {
        type: spec.type,
        name: isValid(spec.name) ? `${spec.name}` : `${namePrefix}_${index}`
      },
      {
        // 避免二次dataflow
        skipBeforeLayouted: true,
        attributeContext: this._getMarkAttributeContext(),
        componentType: spec.componentType,
        key: spec.dataKey
      }
    ) as IGroupMark;
    if (!mark) {
      return;
    }

    if (isValid(spec.id)) {
      mark.setUserId(spec.id);
    }

    if (this._option.globalInstance?.isAnimationEnable() && spec.animation) {
      // 自定义图元默认不添加动画
      const config = animationConfig({}, userAnimationConfig(spec.type, spec as any, this._markAttributeContext));
      mark.setAnimationConfig(config);
    }

    if (isNil(parentMark)) {
      this._marks.addMark(mark);
    } else if (parentMark) {
      parentMark.addMark(mark);
    }
    // set style
    this.initMarkStyleWithSpec(mark, spec);
    if (spec.type === 'group') {
      namePrefix = `${namePrefix}_${index}`;
      spec.children?.forEach((s, i) => {
        this._createExtensionMark(s as any, mark, namePrefix, i);
      });
    }

    if (isValid(spec.dataId) || isValidNumber(spec.dataIndex)) {
      const dataview = this.getChart().getSeriesData(spec.dataId, spec.dataIndex);

      if (dataview) {
        mark.setDataView(dataview);
        dataview.target.addListener('change', () => {
          mark.getData().updateData();
        });
      }
    }
  }

  initEvent() {
    // do nothing
  }

  /**
   * updateSpec
   */
  _compareSpec(spec: ICustomMarkSpec<EnableMarkType>, prevSpec: ICustomMarkSpec<EnableMarkType>) {
    const result = super._compareSpec(spec, prevSpec);
    if (!isEqual(prevSpec, spec)) {
      if (!result.reMake && !result.reCompile && this._isComponentOnlySpecChange(spec, prevSpec)) {
        result.effects = {
          ...result.effects,
          component: true,
          render: true
        };
      } else {
        result.reMake = true;
      }
    }

    result.change = true;
    result.reRender = true;
    return result;
  }

  protected _isComponentOnlySpecChange(
    spec: ICustomMarkSpec<EnableMarkType>,
    prevSpec: ICustomMarkSpec<EnableMarkType>
  ) {
    const keys = Object.keys({
      ...prevSpec,
      ...spec
    });

    return keys.every(key => {
      return isEqual(prevSpec?.[key], spec?.[key]) || CUSTOM_MARK_COMPONENT_ONLY_CHANGE_KEYS[key];
    });
  }

  reInit(spec?: ICustomMarkSpec<EnableMarkType>) {
    super.reInit(spec);
    this._updateMarkStyleWithSpec(this._spec, this.getMarks()[0]);
    this.getMarks().forEach(mark => {
      mark.commit(false, true);
    });
  }

  private _updateMarkStyleWithSpec(
    spec: ICustomMarkSpec<EnableMarkType> | ICustomMarkGroupSpec,
    mark: IMark
  ) {
    if (!spec || !mark) {
      return;
    }

    this.initMarkStyleWithSpec(mark, spec);
    if (spec.type === 'group') {
      const children = (mark as IGroupMark).getMarks?.() ?? [];
      (spec as ICustomMarkGroupSpec).children?.forEach((childSpec, index) => {
        this._updateMarkStyleWithSpec(childSpec, children[index]);
      });
    }
  }

  private _getMarkAttributeContext() {
    return {
      vchart: this._option.globalInstance,
      chart: this.getChart(),
      globalScale: (key: string, value: string | number) => {
        return this._option.globalScale.getScale(key)?.scale(value);
      },
      getLayoutBounds: () => {
        const { x, y } = this.getLayoutStartPoint();
        const { width, height } = this.getLayoutRect();
        return new Bounds().set(x, y, x + width, y + height);
      }
    };
  }

  private _getLayoutRect() {
    const bounds = new Bounds();

    this.getMarks().forEach(mark => {
      const product = mark.getProduct();

      if (product) {
        bounds.union(product.AABBBounds);
      }
    });

    if (bounds.empty()) {
      return {
        width: 0,
        height: 0
      };
    }

    return {
      width: bounds.width(),
      height: bounds.height()
    };
  }

  getBoundsInRect(rect: ILayoutRect) {
    this.setLayoutRect(rect);

    const result = this._getLayoutRect();
    const { x, y } = this.getLayoutStartPoint();
    return {
      x1: x,
      y1: y,
      x2: x + result.width,
      y2: y + result.height
    };
  }

  getVRenderComponents() {
    const comps: any[] = [];
    const checkFunc = (m: IComponentMark) => {
      if (m && m.type === MarkTypeEnum.group) {
        m.getMarks().forEach(child => {
          checkFunc(child as IComponentMark);
        });
      } else if (m.type === MarkTypeEnum.component) {
        const comp = m?.getComponent();

        if (comp) {
          comps.push(comp);
        }
      }
    };

    this.getMarks().forEach(m => {
      checkFunc(m as IComponentMark);
    });

    return comps;
  }
}

export const registerCustomMark = () => {
  Factory.registerComponent(CustomMark.type, CustomMark);
};
