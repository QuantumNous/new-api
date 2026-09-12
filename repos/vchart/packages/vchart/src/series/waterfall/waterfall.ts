/* eslint-disable no-duplicate-imports */
import { isNil, precisionSub } from '@visactor/vutils';
import { STACK_FIELD_END, STACK_FIELD_START } from '../../constant/data';
import { waterfall, waterfallFillTotal } from '../../data/transforms/waterfall';
import { BarSeries } from '../bar/bar';
import { isValueInScaleDomain, valueInScaleRange } from '../../util/scale';
import { registerWaterfallAnimation } from './animation';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import type { IWaterfallSeriesSpec, WaterfallAppearPreset } from './interface';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import { registerFadeInOutAnimation } from '../../animation/config';
import type { ITransformOptions, DataView } from '@visactor/vdataset';
import { registerDataSetInstanceTransform } from '../../data/register';
import { dataViewFromDataView } from '../../data/initialize';
import type { IStateAnimateSpec } from '../../animation/spec';
import type { IModelEvaluateOption } from '../../model/interface';
import type { Datum } from '../../typings';
import { Direction } from '../../typings/space';
import { registerRuleMark } from '../../mark/rule';
import { waterfallSeriesMark } from './constant';
import { Group } from '../base/group';
import { Factory } from '../../core/factory';
import { registerRectMark } from '../../mark/rect';
import { getGroupAnimationParams } from '../util/utils';
import { WaterfallSeriesSpecTransformer } from './waterfall-transformer';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import { stackLabel } from '../../component/label/util';
import { WaterfallDefaultSeriesField } from '../../constant/waterfall';
import { PREFIX } from '../../constant/base';
import { AttributeLevel } from '../../constant/attribute';
import type { ILabelMark, IRuleMark, ITextMark } from '../../mark/interface';
import type { IBarAnimationParams } from '../bar/interface';
import type { ILabelInfo } from '../../component/label/interface';
import { CompilableData, type ICompilableData } from '../../compile/data';
import { waterfall as waterfallTheme } from '../../theme/builtin/common/series/waterfall';
import type { IStackCacheNode } from '../../util';
import { getRegionStackGroup, stackTotal } from '../../util';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';

export const DefaultBandWidth = 6; // 默认的bandWidth，避免连续轴没有bandWidth

const WATERFALL_SERIES_DATA_RELATED_KEYS: Record<'calculationMode', true> = {
  calculationMode: true
};

export class WaterfallSeries<T extends IWaterfallSeriesSpec = IWaterfallSeriesSpec> extends BarSeries<any> {
  static readonly type: string = SeriesTypeEnum.waterfall;
  type = SeriesTypeEnum.waterfall;

  static readonly mark: SeriesMarkMap = waterfallSeriesMark;
  static readonly builtInTheme = { waterfall: waterfallTheme };
  static readonly transformerConstructor = WaterfallSeriesSpecTransformer as any;
  readonly transformerConstructor = WaterfallSeriesSpecTransformer as any;

  protected _totalData?: ICompilableData;
  getTotalData() {
    return this._totalData?.getLatestData();
  }

  declare protected _spec: T;

  protected _leaderLineMark: IRuleMark = null;
  protected _stackLabelMark: ITextMark = null;
  protected _labelMark: ITextMark = null;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      dataRelatedKeys: {
        ...policy.dataRelatedKeys,
        ...WATERFALL_SERIES_DATA_RELATED_KEYS
      }
    };
  }

  protected initGroups() {
    const groupFields = this.getGroupFields();
    if (groupFields && groupFields.length) {
      this._groups = new Group(groupFields);
      this._data && this._groups.initData(this._data.getDataView(), this._dataSet);
    }
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    // waterfall data stack data
    this.setValueFieldToStack();
    // 不支持多维度;
    this._fieldX = [this._fieldX[0]];
    this._fieldY = [this._fieldY[0]];
    if (isNil(this._seriesField)) {
      this._seriesField = WaterfallDefaultSeriesField;
    }
  }

  getSeriesKeys(): string[] {
    if (this._seriesField === WaterfallDefaultSeriesField) {
      return [
        this._theme.seriesFieldName.increase,
        this._theme.seriesFieldName.decrease,
        this._theme.seriesFieldName.total
      ];
    }
    return super.getSeriesKeys();
  }

  protected initData(): void {
    super.initData();
    registerDataSetInstanceTransform(this._dataSet, 'waterfallFillTotal', waterfallFillTotal);
    registerDataSetInstanceTransform(this._dataSet, 'waterfall', waterfall);
    // 如果要在最后添加总计
    if (isNil(this._spec.total) || this._spec.total.type === 'end') {
      this._rawData?.transform(
        {
          type: 'waterfallFillTotal',
          options: () => ({
            indexField: this.getGroupFields()[0],
            valueField: this.getStackValueField(),
            seriesField: this.getSeriesField(),
            seriesFieldName: this._theme.seriesFieldName,
            total: this._spec.total,
            calculationMode: this._spec.calculationMode ?? 'increase',
            stackInverse: this.getRegion().getStackInverse()
          })
        },
        false
      );
    }
    // 总计数据
    const totalData = dataViewFromDataView(this.getViewData(), this._dataSet, {
      name: `${PREFIX}_series_${this.id}_totalData`
    });
    this.getViewData().target.removeListener('change', totalData.reRunAllTransform);
    this._totalData = new CompilableData(this._option, totalData);
    totalData.transform(
      {
        type: 'waterfall',
        options: () => ({
          indexField: this.getGroupFields()[0],
          valueField: this.getStackValueField(),
          seriesField: this.getSeriesField(),
          seriesFieldName: this._theme.seriesFieldName,
          startAs: STACK_FIELD_START,
          endAs: STACK_FIELD_END,
          total: this._spec.total,
          calculationMode: this._spec.calculationMode ?? 'increase',
          groupData: () => this.getGroups().groupData,
          stackInverse: this.getRegion().getStackInverse()
        })
      },
      false
    );
    totalData.target.addListener('change', this._reStackTotal);
  }

  protected _reStackTotal = () => {
    const stackData = this.getStackData();
    const stackValueField = this.getStackValueField();
    if (stackData) {
      stackTotal(stackData as IStackCacheNode, stackValueField);
    }
  };

  compileData() {
    super.compileData();
    this._totalData?.compile();
  }

  initAnimation() {
    // 这个数据在这个时候拿不到，因为组件还没创建结束，统计和筛选也还没添加。
    // 而且这个值理论上是动态的，建议 监听 viewDataStatisticsUpdate 消息动态更新
    const waterfallAnimationParams: IBarAnimationParams = {
      yField: this.direction === 'horizontal' ? this._fieldY[0] : this.getStackValueField(),
      xField: this.direction === 'horizontal' ? this.getStackValueField() : this._fieldX[0],
      direction: this.direction,
      growFrom: () =>
        this.direction === 'horizontal'
          ? this._xAxisHelper?.getScale(0).scale(0)
          : this._yAxisHelper?.getScale(0).scale(0)
    };
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<WaterfallAppearPreset>)?.preset;
    const animationParams = getGroupAnimationParams(this);

    this._barMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('waterfall')?.(waterfallAnimationParams, appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.bar, this._spec, this._markAttributeContext),
        animationParams
      )
    );

    if (this._leaderLineMark) {
      this._leaderLineMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('fadeInOut')?.(),
          userAnimationConfig(SeriesMarkNameEnum.leaderLine, this._spec, this._markAttributeContext)
        )
      );
    }
  }

  viewDataUpdate(d: DataView): void {
    this._totalData.getDataView().reRunAllTransform();
    this._totalData.updateData();
    super.viewDataUpdate(d);
  }
  /**
   * data
   */
  // waterfall 不支持任何的 data filter
  addViewDataFilter(_option: ITransformOptions) {
    // do nothing
  }
  reFilterViewData() {
    // do nothing
  }

  onEvaluateEnd(ctx: IModelEvaluateOption): void {
    super.onEvaluateEnd(ctx);
    this._totalData.updateData();
  }

  initMark(): void {
    super.initMark();
    const leaderLine = this._createMark(WaterfallSeries.mark.leaderLine, {
      key: 'index'
    }) as IRuleMark;
    if (leaderLine) {
      this._leaderLineMark = leaderLine;
      leaderLine.setData(this._totalData);
    }
  }

  initLabelMarkStyle(labelMark: ILabelMark): void {
    if (!labelMark) {
      return;
    }

    if (!this._labelMark && this._spec.label?.visible) {
      super.initLabelMarkStyle(labelMark);
      this._labelMark = labelMark;
      return;
    }
  }

  initStackLabelMarkStyle(labelMark: ILabelMark): void {
    if (!labelMark) {
      return;
    }
    this._stackLabelMark = labelMark;
    // 瀑布图标签 encode 在自定义布局中计算
    labelMark.skipEncode = true;
    labelMark.setRule('stackLabel');
    labelMark.setData(this._totalData);

    this.setMarkStyle(labelMark, {
      text: (datum: Datum) => {
        return this._spec.stackLabel?.valueType === 'absolute' ? datum.end : precisionSub(datum.end, datum.start);
      }
    });
  }

  // 样式设置在这里的原因是执行顺序的问题
  // 首先执行这里的 mark.style
  // 然后执行用户的 formatMethod
  // 最后执行下方的 getTotalLabelComponentStyle 。如果在下方实现值函数，就会导致用户format无法生效
  initTotalLabelMarkStyle(labelMark: ILabelMark) {
    this.setMarkStyle(labelMark, {
      text: (datum: Datum) => {
        if (!('end' in datum)) {
          return this.direction === Direction.horizontal ? datum[this._fieldX[0]] : datum[this._fieldY[0]];
        }
        return this._spec.totalLabel?.valueType === 'absolute' ? datum.end : precisionSub(datum.end, datum.start);
      }
    });
  }

  getTotalLabelComponentStyle(info: Pick<ILabelInfo, 'baseMark' | 'labelMark'>) {
    return stackLabel(
      {
        ...info,
        series: this,
        // @ts-ignore
        labelSpec: this._spec.totalLabel
      },
      d => {
        const index = this.direction === Direction.vertical ? d[this._fieldX[0]] : d[this._fieldY[0]];
        return this._totalData.getLatestData().find((_d: Datum) => _d.index === index);
      }
    );
  }

  totalPositionX(datum: Datum, field: string, pos: number = 0.5) {
    const { dataToPosition, getBandwidth } = this._xAxisHelper;
    if (this._direction === Direction.horizontal) {
      return valueInScaleRange(
        dataToPosition([datum[field]], {
          bandPosition: this._bandPosition
        })
      );
    }
    return (
      dataToPosition([datum[field]], {
        bandPosition: this._bandPosition
      }) +
      getBandwidth(0) * 0.5 -
      (this._barMark.getAttribute('width', datum) as number) * (0.5 - pos)
    );
  }

  totalPositionY(datum: Datum, field: string, pos: number = 0.5) {
    const { dataToPosition, getBandwidth } = this._yAxisHelper;
    if (this._direction === Direction.horizontal) {
      return (
        dataToPosition([datum[field]], {
          bandPosition: this._bandPosition
        }) +
        getBandwidth(0) * 0.5 -
        (this._barMark.getAttribute('height', datum) as number) * (0.5 - pos)
      );
    }
    return valueInScaleRange(
      dataToPosition([datum[field]], {
        bandPosition: this._bandPosition
      })
    );
  }

  protected _isCategoryAxisInverse() {
    return this._direction === Direction.horizontal
      ? this._yAxisHelper?.isInverse?.()
      : this._xAxisHelper?.isInverse?.();
  }

  protected _getLeaderLineCategoryPos(isStart: boolean, isDecrease: boolean) {
    const inverse = !!this._isCategoryAxisInverse();
    const normalPos = isStart ? (isDecrease ? 0 : 1) : isDecrease ? 1 : 0;
    return inverse ? 1 - normalPos : normalPos;
  }

  initMarkStyle(): void {
    super.initMarkStyle();
    const isDecrease = this._spec.calculationMode === 'decrease';
    if (this._leaderLineMark) {
      if (this._direction === Direction.horizontal) {
        this.setMarkStyle(
          this._leaderLineMark,
          {
            visible: (datum: Datum) => this.isVisibleLeaderLine(datum),
            x: (datum: Datum) => this.totalPositionX(datum, 'lastEnd', 0),
            x1: (datum: Datum) => this.totalPositionX(datum, datum.isTotal ? 'end' : 'start', 0),
            y: (datum: Datum) => {
              if (!datum.lastIndex) {
                return 0;
              }
              return this.totalPositionY(datum, 'lastIndex', this._getLeaderLineCategoryPos(true, isDecrease));
            },
            y1: (datum: Datum) => this.totalPositionY(datum, 'index', this._getLeaderLineCategoryPos(false, isDecrease))
          },
          'normal',
          AttributeLevel.Series
        );
      } else {
        this.setMarkStyle(
          this._leaderLineMark,
          {
            visible: (datum: Datum) => this.isVisibleLeaderLine(datum),
            x: (datum: Datum) => {
              if (!datum.lastIndex) {
                return 0;
              }
              return this.totalPositionX(datum, 'lastIndex', this._getLeaderLineCategoryPos(true, isDecrease));
            },
            x1: (datum: Datum) =>
              this.totalPositionX(datum, 'index', this._getLeaderLineCategoryPos(false, isDecrease)),
            y: (datum: Datum) => this.totalPositionY(datum, 'lastEnd', 0),
            y1: (datum: Datum) => this.totalPositionY(datum, datum.isTotal ? 'end' : 'start', 0)
          },
          'normal',
          AttributeLevel.Series
        );
      }
    }
  }

  protected isVisibleLeaderLine(datum: Datum): boolean {
    if (isNil(datum.lastIndex)) {
      return false;
    }
    return isValueInScaleDomain(
      [datum.lastEnd, datum[datum.isTotal ? 'end' : 'start']],
      this.direction === Direction.horizontal ? this._xAxisHelper.getScale(0) : this._yAxisHelper.getScale(0)
    );
  }
}

export const registerWaterfallSeries = () => {
  registerRuleMark();
  registerRectMark();
  registerWaterfallAnimation();
  registerFadeInOutAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(WaterfallSeries.type, WaterfallSeries);
};
