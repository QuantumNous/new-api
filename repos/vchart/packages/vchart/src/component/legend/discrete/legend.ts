import type { Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isFunction, isNil, isValidNumber, get } from '@visactor/vutils';
import { DataView } from '@visactor/vdataset';
import type { IDiscreteLegendSpec } from './interface';
// eslint-disable-next-line no-duplicate-imports
import type { ISeries } from '../../../series/interface';
import type { IModelInitOption, IModelSpecInfo } from '../../../model/interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../../interface/type';
// eslint-disable-next-line no-duplicate-imports
import { getLegendAttributes } from './util';
import { registerDataSetInstanceTransform } from '../../../data/register';
import { eachSeries } from '../../../util/model';
import { getFieldAlias } from '../../../util/data';
import { isDataDomainSpec } from '../../../util/type';
// eslint-disable-next-line no-duplicate-imports
import type { LegendItemDatum } from '@visactor/vrender-components/legend/discrete/type';
// eslint-disable-next-line no-duplicate-imports
import { LegendEvent } from '@visactor/vrender-components/legend/constant';
// eslint-disable-next-line no-duplicate-imports
import { DiscreteLegend as LegendComponent } from '@visactor/vrender-components/legend/discrete';
import { discreteLegendDataMake, discreteLegendFilter } from '../../../data/transforms/legend-data/discrete/discrete';
import { BaseLegend } from '../base-legend';
import { ChartEvent } from '../../../constant/event';
import { Factory } from '../../../core/factory';
import { TransformLevel } from '../../../data/initialize';
import type { ILayoutRect } from '../../../typings/layout';
import type { StringOrNumber } from '../../../typings';
import { getFormatFunction, getSpecInfo } from '../../util';
import type { IDiscreteLegendData } from '../../../data/transforms/legend-data/discrete';
import { discreteLegend } from '../../../theme/builtin/common/component/legend/discrete-legend';

export class DiscreteLegend extends BaseLegend<IDiscreteLegendSpec> {
  static specKey = 'legends';

  static readonly builtInTheme = {
    discreteLegend
  };
  static type = ComponentTypeEnum.discreteLegend;
  type = ComponentTypeEnum.discreteLegend;
  name: string = ComponentTypeEnum.discreteLegend;

  protected _unselectedData: StringOrNumber[];

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    return getSpecInfo<IDiscreteLegendSpec>(chartSpec, this.specKey, this.type, (s: IDiscreteLegendSpec) => {
      return !s.type || s.type === 'discrete';
    });
  }

  init(option: IModelInitOption): void {
    super.init(option);
    eachSeries(
      this._regions,
      s => {
        s.addViewDataFilter({
          type: 'discreteLegendFilter',
          options: {
            series: s,
            selected: () => this._selectedData,
            field: () => this._getSeriesLegendField(s),
            data: () => this.getLegendDefaultData(),
            customFilter: this._spec.customFilter
          },
          level: TransformLevel.legendFilter
        });
      },
      {
        userId: this._seriesUserId,
        specIndex: this._seriesIndex
      }
    );
  }

  protected _initLegendData(): DataView {
    registerDataSetInstanceTransform(this._option.dataSet, 'discreteLegendFilter', discreteLegendFilter);
    registerDataSetInstanceTransform(this._option.dataSet, 'discreteLegendDataMake', discreteLegendDataMake);
    const legendData = new DataView(this._option.dataSet, { name: `${this.type}_${this.id}_data` });
    legendData.transform({
      type: 'discreteLegendDataMake',
      options: {
        series: () => {
          const result: ISeries[] = [];
          eachSeries(
            this._regions,
            s => {
              result.push(s);
            },
            {
              specIndex: this._spec.seriesIndex,
              userId: this._spec.seriesId
            }
          );
          return result;
        },
        seriesField: (s: ISeries) => this._getSeriesLegendField(s)
      }
    });

    return legendData;
  }

  protected _getSeriesLegendField(s: ISeries) {
    const defaultField = s.getSeriesField();
    const specifyScaleId = this._spec.scaleName ?? this._spec.scale;

    if (isNil(specifyScaleId)) {
      return defaultField;
    }
    if (!s.getRawData()) {
      return defaultField;
    }
    const scaleSpec = this._option.globalScale.getScaleSpec(specifyScaleId);
    if (!scaleSpec) {
      return defaultField;
    }

    // field是只在图例指定了scale的情况下生效
    if (this._spec.field) {
      return this._spec.field;
    }

    if (!isDataDomainSpec(scaleSpec.domain)) {
      return defaultField;
    }
    const seriesData = scaleSpec.domain.find(d => d.dataId === s.getRawData().name);
    if (!seriesData) {
      return defaultField;
    }
    return seriesData.fields?.[0] ?? defaultField;
  }

  protected _initSelectedData(): void {
    const fullSelectedData = this.getLegendDefaultData();

    if (this._unselectedData) {
      const selected: StringOrNumber[] = [];
      const unselected: StringOrNumber[] = [];

      fullSelectedData.forEach((entry: StringOrNumber) => {
        if (this._unselectedData.includes(entry)) {
          unselected.push(entry);
        } else {
          selected.push(entry);
        }
      });
      this._selectedData = selected;
      this._unselectedData = unselected;
    } else if (this._spec.defaultSelected) {
      this._selectedData = [...this._spec.defaultSelected];
    } else {
      this._selectedData = fullSelectedData;
    }
  }

  getLegendDefaultData(originalData?: boolean) {
    if (isFunction(this._spec.data)) {
      return this._getLegendItems().map((obj: LegendItemDatum) => obj.label);
    }

    return this._legendData
      .getLatestData()
      .map(originalData ? (obj: IDiscreteLegendData) => obj.originalKey : (obj: IDiscreteLegendData) => obj.key);
  }

  private _addDefaultTitleText(attrs: any) {
    if (attrs.title?.visible && isNil(attrs.title.text) && isNil(attrs.title.style?.text)) {
      // 默认使用第0个系列的 seriesField 别名
      const series = this._regions?.[0]?.getSeries()[0];
      if (!series) {
        return;
      }
      // 如果没有别名继续保持 空字符串
      attrs.title.text = getFieldAlias(series.getRawData(), series.getSeriesField());
    }
  }

  protected _getLegendAttributes(rect: ILayoutRect) {
    const layout = this.layoutOrient === 'bottom' || this.layoutOrient === 'top' ? 'horizontal' : 'vertical';
    const attrs = {
      layout,
      items: this._getLegendItems(),
      zIndex: this.layoutZIndex,
      ...getLegendAttributes(this._spec, rect, this.layoutOrient),
      // maxWidth 和 maxHeight 已经在布局模块处理了，所以 rect 的优先级最高
      maxWidth: rect.width,
      maxHeight: rect.height
    };
    this._addDefaultTitleText(attrs);
    this._addLegendItemFormatMethods(attrs);
    return attrs;
  }

  protected _getLegendConstructor() {
    return LegendComponent;
  }

  setSelectedData(selectedData: StringOrNumber[]) {
    if (selectedData) {
      this._unselectedData = this.getLegendDefaultData().filter(
        (entry: StringOrNumber) => !selectedData.includes(entry)
      );
    }

    super.setSelectedData(selectedData);
  }

  protected _initEvent() {
    if (this._legendComponent) {
      const doFilter = this._spec.filter !== false;
      this._legendComponent.addEventListener(LegendEvent.legendItemClick, (e: any) => {
        const selectedData = get(e, 'detail.currentSelected');
        doFilter && this.setSelectedData(selectedData);
        this.event.emit(ChartEvent.legendItemClick, { model: this, value: selectedData, event: e });
      });

      this._legendComponent.addEventListener(LegendEvent.legendItemHover, (e: any) => {
        const detail = get(e, 'detail');
        this.event.emit(ChartEvent.legendItemHover, { model: this, value: detail, event: e });
      });

      this._legendComponent.addEventListener(LegendEvent.legendItemUnHover, (e: any) => {
        const detail = get(e, 'detail');
        this.event.emit(ChartEvent.legendItemUnHover, { model: this, value: detail, event: e });
      });
    }
  }

  private _getLegendItems() {
    const originData = (this._legendData.getLatestData() || []).map((datum: any) => {
      const fillOpacity = datum.style('fillOpacity');
      const strokeOpacity = datum.style('strokeOpacity');
      const opacity = datum.style('opacity');
      const texture = datum.style('texture');

      return {
        label: datum.key,
        datum: datum.datum,
        shape: {
          symbolType: datum.style('symbolType') ?? datum.shapeType ?? 'circle',
          fillOpacity: isValidNumber(fillOpacity) ? fillOpacity : 1,
          strokeOpacity: isValidNumber(strokeOpacity) ? strokeOpacity : 1,
          opacity: isValidNumber(opacity) ? opacity : 1,
          texturePadding: texture ? 1 : null,
          textureSize: texture ? 4 : null,
          texture,
          fill: datum.style('fill'),
          stroke: datum.style('stroke'),
          textureColor: datum.style('textureColor'),
          innerBorder: datum.style('innerBorder'),
          outerBorder: datum.style('outerBorder'),
          lineDash: datum.style('lineDash'),
          lineDashOffset: datum.style('lineDashOffset'),
          lineWidth: datum.style('lineWidth')
        }
      };
    });
    const legendItems = isFunction(this._spec.data)
      ? this._spec.data(originData, this._option.globalScale.getScale('color'), this._option.globalScale)
      : originData;
    return legendItems;
  }

  private _addLegendItemFormatMethods(attrs: any) {
    const { formatMethod: labelFormatMethod, formatter: labelFormatter } = this._spec.item?.label ?? {};
    const { formatMethod: valueFormatMethod, formatter: valueFormatter } = this._spec.item?.value ?? {};

    const { formatFunc: labelFormatFunc } = getFormatFunction(labelFormatMethod, labelFormatter);
    if (labelFormatter && !labelFormatMethod && labelFormatFunc) {
      attrs.item.label.formatMethod = (value: string, datum: any) => {
        return labelFormatFunc(value, datum, labelFormatter);
      };
    }
    const { formatFunc: valueFormatFunc } = getFormatFunction(valueFormatMethod, valueFormatter);
    if (valueFormatter && !valueFormatMethod && valueFormatFunc) {
      attrs.item.value.formatMethod = (value: string, datum: any) => {
        return valueFormatFunc(valueFormatter, value, datum, labelFormatter);
      };
    }
  }
}

export const registerDiscreteLegend = () => {
  Factory.registerComponent(DiscreteLegend.type, DiscreteLegend);
};
