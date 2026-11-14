import { isNil, isEqual, isValid, array, isValidNumber } from '@visactor/vutils';
import type { DataView } from '@visactor/vdataset';
import type { IRegion } from '../../region/interface';
import { BaseComponent } from '../base/base-component';
import type { IEffect } from '../../model/interface';
// eslint-disable-next-line no-duplicate-imports
import type { ILayoutRect, ILayoutType, IOrientType, IPoint, StringOrNumber } from '../../typings';
import { LayoutLevel, LayoutZIndex } from '../../constant/layout';
import { ChartEvent } from '../../constant/event';
import { eachSeries } from '../../util/model';
import { isValidOrient } from '../../util/space';
import { mergeSpec } from '@visactor/vutils-extension';
import { CompilableData } from '../../compile/data/compilable-data';
// eslint-disable-next-line no-duplicate-imports
import type { ILegend, ILegendCommonSpec } from './interface';
import type { IGraphic, IGroup } from '@visactor/vrender-core';

const LEGEND_COMPONENT_ONLY_CHANGE_KEYS: Record<string, true> = {
  position: true,
  item: true,
  title: true,
  pager: true,
  background: true
};

export abstract class BaseLegend<T extends ILegendCommonSpec> extends BaseComponent<T> implements ILegend {
  layoutType: ILayoutType = 'normal';
  layoutZIndex: number = LayoutZIndex.Legend;
  layoutLevel: number = LayoutLevel.Legend;

  static specKey = 'legends';
  specKey = 'legends';

  protected _orient: IOrientType = 'left';
  get orient() {
    return this._orient;
  }

  protected _visible: boolean = true;
  get visible() {
    return this._visible;
  }

  protected _position: 'start' | 'middle' | 'end' = 'middle';
  get position() {
    return this._position;
  }

  protected _legendData!: CompilableData;
  /**
   * 获取图例数据
   * @returns 图例的数据
   */
  getLegendData() {
    return this._legendData.getLatestData();
  }

  private _preSelectedData: StringOrNumber[] = [];
  protected _selectedData: StringOrNumber[] = [];
  /**
   * getSelectedData
   */
  getSelectedData() {
    return this._selectedData;
  }

  protected _legendComponent: IGroup;
  private _cacheAttrs: any;

  effect: IEffect = {
    onSelectedDataChange: () => {
      eachSeries(
        this._regions,
        s => {
          s.getViewData()?.markRunning();
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
      eachSeries(
        this._regions,
        s => {
          s.reFilterViewData();
        },
        {
          userId: this._seriesUserId,
          specIndex: this._seriesIndex
        }
      );
    }
  };
  // 与系列的关联关系
  // 优先级：id > index
  // 最终结果：series & region取交集
  protected _seriesUserId?: StringOrNumber[];
  protected _seriesIndex?: number[];
  protected _regionUserId?: StringOrNumber[];
  protected _regionUserIndex?: number[];

  setAttrFromSpec() {
    super.setAttrFromSpec();

    this._orient = isValidOrient(this._spec.orient) ? this._spec.orient : 'left';
    this._position = this._spec.position ?? 'middle';
    this._visible = this._spec.visible !== false;

    const { regionId, regionIndex, seriesId, seriesIndex } = this._spec;

    isValid(seriesId) && (this._seriesUserId = array(seriesId));
    isValid(regionId) && (this._regionUserId = array(regionId));
    isValid(seriesIndex) && (this._seriesIndex = array(seriesIndex));
    isValid(regionIndex) && (this._regionUserIndex = array(regionIndex));
    this._regions = this._option.getRegionsInUserIdOrIndex(this._regionUserId, this._regionUserIndex);
  }

  created() {
    super.created();
    // data
    this.initData();
  }

  /** Update API **/
  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    result.reRender = true;
    const specChanged = !isEqual(prevSpec, spec);

    if (result.reMake) {
      return result;
    }
    if (spec?.orient !== prevSpec?.orient) {
      result.reMake = true;
      return result;
    }
    if (specChanged && !result.reCompile && this._isComponentOnlySpecChange(spec, prevSpec)) {
      result.effects = {
        ...result.effects,
        component: true,
        layout: true,
        render: true
      };
      return result;
    }
    if (specChanged) {
      result.reCompile = true;
    }
    return result;
  }

  private _isComponentOnlySpecChange(spec: T, prevSpec: T) {
    const prevSpecRecord = prevSpec as unknown as Record<string, unknown>;
    const specRecord = spec as unknown as Record<string, unknown>;
    const keys = Object.keys({
      ...prevSpec,
      ...spec
    });

    return keys.every(key => {
      return isEqual(prevSpecRecord?.[key], specRecord?.[key]) || LEGEND_COMPONENT_ONLY_CHANGE_KEYS[key];
    });
  }

  protected abstract _initLegendData(): DataView;
  protected abstract _initSelectedData(): void;
  protected abstract _getLegendAttributes(rect: ILayoutRect): any;
  protected abstract _getLegendConstructor(): any;
  protected abstract _initEvent(): void;

  private _bindLegendDataChange() {
    this._preSelectedData = this._selectedData.slice();
    this._initSelectedData();
    this._forceLayout();
  }

  protected initData() {
    const legendData = this._initLegendData();
    legendData.target.addListener('change', this._bindLegendDataChange.bind(this));
    this._legendData = new CompilableData(this._option, legendData);

    this._initSelectedData();
    eachSeries(
      this._regions,
      s => {
        s.event.on(ChartEvent.rawDataUpdate, { filter: ({ model }) => model?.id === s.id }, () => {
          this._legendData.getDataView().reRunAllTransform({
            skipEqual: true
          });
        });
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
  }

  setSelectedData(selectedData: StringOrNumber[]) {
    const lastData = this._selectedData;
    if (isNil(selectedData) || JSON.stringify(lastData) === JSON.stringify(selectedData)) {
      return;
    }

    // 更新图例筛选
    eachSeries(
      this._regions,
      s => {
        if (s.legendSelectedFilter) {
          selectedData = s.legendSelectedFilter(this, selectedData);
        }
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );

    this._selectedData = [...selectedData];
    // 更新数据
    this.effect.onSelectedDataChange?.();
    this.event.emit(ChartEvent.legendSelectedDataChange, { model: this });

    // 更新图例样式
    (this._legendComponent as unknown as any)?.setSelected(this._selectedData);
  }

  afterSetLayoutStartPoint(pos: IPoint): void {
    super.afterSetLayoutStartPoint(pos);

    if (this._legendComponent) {
      const { x, y } = pos;
      if (isValidNumber(x * y)) {
        this._legendComponent.setAttributes({ x, y });
      }
    }
  }

  getBoundsInRect(rect: ILayoutRect, fullSpace: ILayoutRect) {
    if (!this._visible) {
      if (this._legendComponent && this._legendComponent.parent) {
        this._legendComponent.parent.removeChild(this._legendComponent);
        this._legendComponent = null;
      }
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
    const result = { x1: this.getLayoutStartPoint().x, y1: this.getLayoutStartPoint().y, x2: 0, y2: 0 };
    const attrs = this._getLegendAttributes(rect);
    attrs.disableTriggerEvent = this._option.disableTriggerEvent;
    if (this._legendComponent) {
      if (!isEqual(attrs, this._cacheAttrs)) {
        this._legendComponent.setAttributes(
          mergeSpec({}, attrs, {
            defaultSelected: this._selectedData // 图表 resize 之后应该保留上次筛选的结果
          })
        );
      }
    } else {
      const legendConstructor = this._getLegendConstructor();
      const legend = new legendConstructor(
        mergeSpec({}, attrs, {
          defaultSelected: this._selectedData
        })
      );
      legend.name = 'legend';
      this._legendComponent = legend;
      const container = this.getContainer();
      container.add(legend);

      // 绑定事件
      if (!this._option.disableTriggerEvent) {
        this._initEvent();
      }

      // 代理 legend 上的事件
      legend.on('*', (event: any, type: string) => this._delegateEvent(this._legendComponent, event, type));
    }
    this._cacheAttrs = attrs;

    const width = isFinite(this._legendComponent.AABBBounds.width()) ? this._legendComponent.AABBBounds.width() : 0;
    const height = isFinite(this._legendComponent.AABBBounds.height()) ? this._legendComponent.AABBBounds.height() : 0;

    if (this.layoutType !== 'normal-inline') {
      // 调整位置
      const layout = this.layoutOrient === 'bottom' || this.layoutOrient === 'top' ? 'horizontal' : 'vertical';
      const position = this._position;
      const { width: rectWidth, height: rectHeight } = fullSpace;
      let offsetX = 0;
      let offsetY = 0;
      if (layout === 'horizontal') {
        if (position === 'middle') {
          offsetX = (rectWidth - width) / 2;
        } else if (position === 'end') {
          offsetX = rectWidth - width;
        }
      } else {
        if (position === 'middle') {
          offsetY = (rectHeight - height) / 2;
        } else if (position === 'end') {
          offsetY = rectHeight - height;
        }
      }

      this._legendComponent.setAttributes({
        dx: offsetX,
        dy: offsetY
      });
    }

    result.x2 = result.x1 + width;
    result.y2 = result.y1 + height;
    return result;
  }

  onDataUpdate(): void {
    if (JSON.stringify(this._preSelectedData) === JSON.stringify(this._selectedData)) {
      return;
    }

    if (this._legendComponent) {
      // 更新组件
      const attrs = this._getLegendAttributes(this.getLayoutRect());
      if (!isEqual(attrs, this._cacheAttrs)) {
        this._legendComponent.setAttributes(
          mergeSpec({}, attrs, {
            defaultSelected: this._selectedData // 图表 resize 之后应该保留上次筛选的结果
          })
        );
      }
    }
    // 更新数据流
    this.effect.onSelectedDataChange?.();
    this.event.emit(ChartEvent.legendSelectedDataChange, { model: this });
  }

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._legendComponent] as unknown as IGroup[];
  }

  clear(): void {
    super.clear();
    this._legendComponent = null;
    this._cacheAttrs = null;
    this._preSelectedData = null;
  }
}
