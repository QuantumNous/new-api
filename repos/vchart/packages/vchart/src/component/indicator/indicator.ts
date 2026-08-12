import { DataView } from '@visactor/vdataset';
import { LayoutLevel, LayoutZIndex } from '../../constant/layout';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../interface/type';
import { BaseComponent } from '../base/base-component';
import type { IRegion } from '../../region/interface';
import type { IIndicator, IIndicatorItemSpec, IIndicatorSpec } from './interface';
import type { Datum, Maybe } from '../../typings';
import { mergeSpec } from '@visactor/vutils-extension';
import { transformIndicatorStyle } from '../../util/style';
import { getActualNumValue } from '../../util/space';
import { isEqual, isValid, isFunction, array, pickWithout } from '@visactor/vutils';
import { indicatorMapper } from './util';
import type { IModelSpecInfo } from '../../model/interface';
import { registerDataSetInstanceTransform } from '../../data/register';
import { CompilableData } from '../../compile/data/compilable-data';
import { Indicator as IndicatorComponents } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import type { IndicatorAttributes } from '@visactor/vrender-components';
import type { IGraphic, INode, IGroup } from '@visactor/vrender-core';
import type { FunctionType } from '../../typings/visual';
import { Factory } from '../../core/factory';
// eslint-disable-next-line no-duplicate-imports
import type { IRichTextCharacter } from '@visactor/vrender-core';
import { getSpecInfo } from '../util';
import { getDatumOfGraphic } from '../../util/mark';
import type { IMarkGraphic } from '../../mark/interface';
import { indicator } from '../../theme/builtin/common/component/indicator';

export class Indicator<T extends IIndicatorSpec> extends BaseComponent<T> implements IIndicator {
  static type = ComponentTypeEnum.indicator;
  type = ComponentTypeEnum.indicator;
  name: string = ComponentTypeEnum.indicator;

  static readonly builtInTheme = {
    indicator
  };
  static specKey = 'indicator';
  specKey = 'indicator';

  layoutType: 'none' = 'none';
  layoutZIndex: number = LayoutZIndex.Indicator;
  layoutLevel: number = LayoutLevel.Indicator;

  private _gap: number = 0;

  private _activeDatum: any = null;
  private _displayData!: CompilableData;

  private _title: IIndicatorItemSpec;
  private _content: IIndicatorItemSpec[];

  private _indicatorComponent: IndicatorComponents;
  private _cacheAttrs: IndicatorAttributes;

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    return getSpecInfo<IIndicatorSpec>(chartSpec, this.specKey, this.type, (s: IIndicatorSpec) => {
      return s && s.visible !== false;
    });
  }

  created() {
    super.created();
    // data
    this.initData();
    // event
    this.initEvent();
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this._gap = this._spec.gap || 0;
    this._title = this._spec.title;
    this._content = array(this._spec.content);
    this._regions = this._option.getRegionsInUserIdOrIndex(array(this._spec.regionId), array(this._spec.regionIndex));
  }

  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    const specChanged = !isEqual(prevSpec, spec);

    if (specChanged && !result.reMake && !result.reCompile) {
      result.change = true;
      result.reRender = true;
      result.effects = {
        ...result.effects,
        component: true,
        layout: true,
        render: true
      };
    }

    return result;
  }

  // event
  protected initEvent() {
    if (this._option.disableTriggerEvent) {
      return;
    }
    const trigger = this._spec.trigger;
    if (trigger === 'none') {
      return;
    }

    if (this._spec.trigger === 'hover') {
      this.event.on('element-highlight:start', (params: any) => {
        const g = params.graphics[0];

        if (this.isRelativeModel(g)) {
          this.updateDatum(getDatumOfGraphic(g) as Datum[]);
        }
      });
      this.event.on('element-highlight:reset', (params: any) => {
        if (this._activeDatum) {
          this.updateDatum(null);
        }
      });
    } else {
      this.event.on('element-select:start', (params: any) => {
        const g = params.graphics[0];

        if (this.isRelativeModel(g)) {
          this.updateDatum(getDatumOfGraphic(g) as Datum[]);
        }
      });
      this.event.on('element-select:reset', (params: any) => {
        if (this._activeDatum) {
          this.updateDatum(null);
        }
      });
    }
  }

  updateDatum(datum: any) {
    this._activeDatum = datum;
    this._displayData.updateData();
    const attrs = this._getIndicatorAttrs();
    this._createOrUpdateIndicatorComponent(attrs);
  }

  // data
  private initData() {
    registerDataSetInstanceTransform(this._option.dataSet, 'indicatorFilter', indicatorMapper);
    const displayData = new DataView(this._option.dataSet, { name: `${this.type}_${this.id}_data` });
    displayData.transform({
      type: 'indicatorFilter',
      options: () => ({
        title: this._title,
        content: this._content,
        datum: () => this._activeDatum
      })
    });

    displayData.target.addListener('change', this.updateDatum.bind(this));

    this._displayData = new CompilableData(this._option, displayData);
  }

  updateLayoutAttribute(): void {
    const attrs = this._getIndicatorAttrs();
    this._createOrUpdateIndicatorComponent(attrs);

    super.updateLayoutAttribute();
  }

  private _getIndicatorAttrs() {
    if (this._spec.visible === false || (this._spec.fixed === false && this._activeDatum === null)) {
      return {
        visible: false
      } as IndicatorAttributes;
    }

    const region = this._regions[0];
    const { width, height } = region.getLayoutRect();
    const { x, y } = region.getLayoutStartPoint();
    const { content, offsetX, offsetY, limitRatio, title, ...restSpec } = this._spec;

    const contentComponentSpec: IIndicatorItemSpec[] = [];
    array(content).forEach((eachItem: IIndicatorItemSpec) => {
      const contentSpec = mergeSpec({}, this._theme.content, eachItem);
      contentComponentSpec.push({
        visible: contentSpec.visible !== false && (contentSpec.field ? this._activeDatum !== null : true),
        space: contentSpec.space || this._gap,
        autoLimit: contentSpec.autoLimit,
        autoFit: contentSpec.autoFit,
        fitPercent: contentSpec.fitPercent,
        fitStrategy: contentSpec.fitStrategy,
        style: {
          ...transformIndicatorStyle(pickWithout(contentSpec.style, ['text']), this._activeDatum),
          text: this._createText(contentSpec.field, contentSpec.style.text)
        }
      });
    });

    return {
      visible: true,
      size: {
        width: width,
        height: height
      },
      zIndex: this.layoutZIndex,
      x: x,
      y: y,
      dx: offsetX ? getActualNumValue(offsetX, this._computeLayoutRadius()) : 0,
      dy: offsetY ? getActualNumValue(offsetY, this._computeLayoutRadius()) : 0,
      limitRatio: limitRatio || Infinity,
      title: {
        visible: title.visible !== false && (!isValid(title.field) || this._activeDatum !== null),
        space: title.space || this._gap,
        autoLimit: title.autoLimit,
        autoFit: title.autoFit,
        fitPercent: title.fitPercent,
        fitStrategy: title.fitStrategy,
        style: {
          ...transformIndicatorStyle(pickWithout(title.style, ['text']), this._activeDatum),
          text: this._createText(title.field, title.style.text as any) // FIXME: type
        }
      },
      content: contentComponentSpec,
      ...(restSpec as unknown as IndicatorAttributes)
    } as IndicatorAttributes;
  }

  private _createOrUpdateIndicatorComponent(attrs: IndicatorAttributes) {
    if (attrs.visible === false) {
      // 按照vrender-component 的设置，只切换visible: false，并不会更新组件，所以强制删掉节点
      if (this._indicatorComponent && this._indicatorComponent.parent) {
        this._indicatorComponent.parent.removeChild(this._indicatorComponent);
      }
      this._indicatorComponent = null;
      return;
    }

    if (this._indicatorComponent) {
      if (!isEqual(attrs, this._cacheAttrs)) {
        this._indicatorComponent.setAttributes(attrs);
      }
    } else {
      const container = this.getContainer();
      //FIXME:类型“IndicatorAttributes”的参数不能赋给类型“Required<IndicatorAttributes>”的参数
      const indicator = new IndicatorComponents(attrs as any);
      indicator.name = 'indicator';
      container.add(indicator as unknown as INode);
      this._indicatorComponent = indicator;
      this._indicatorComponent.on('*', (event: any, type: string) =>
        this._delegateEvent(this._indicatorComponent as unknown as IGraphic, event, type)
      );
    }
    this._cacheAttrs = attrs;
  }

  private _createText(
    field: string | undefined,
    text:
      | string
      | number
      | string[]
      | number[]
      | IRichTextCharacter[]
      | FunctionType<number | number[] | string | string[] | IRichTextCharacter[]>
  ) {
    if (field) {
      return this._activeDatum ? this._activeDatum[field] : '';
    }
    if (isFunction(text)) {
      return text(this._activeDatum, undefined) ?? '';
    }
    return text ?? '';
  }

  private _computeLayoutRadius() {
    const region = this._regions[0];
    const { width, height } = region.getLayoutRect();
    return Math.min(width / 2, height / 2);
  }

  private isRelativeModel(g: IMarkGraphic) {
    return this._regions.some(region => !!region.getSeriesInId(g.context.modelId));
  }

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._indicatorComponent] as unknown as IGroup[];
  }

  clear(): void {
    this._cacheAttrs = null;
    super.clear();
  }

  getIndicatorComponent(): IndicatorComponents {
    return this._indicatorComponent;
  }
}

export const registerIndicator = () => {
  Factory.registerComponent(Indicator.type, Indicator);
};
