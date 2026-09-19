import type { ISeriesTooltipSpec, ITooltipSpec, TooltipHandlerParams } from '../../component/tooltip/interface';
import type {
  Datum,
  ITooltipActual,
  ITooltipLineActual,
  ITooltipLinePattern,
  ITooltipPattern,
  MaybeArray,
  ShapeType,
  TooltipActiveType,
  TooltipContentProperty,
  TooltipData,
  TooltipPatternCallback,
  TooltipPatternProperty
} from '../../typings';
import { array, isFunction, isValid } from '@visactor/vutils';
import type { ISeries, ISeriesTooltipHelper } from '../interface';
import type { IMark } from '../../mark/interface/common';
import { getTimeString, isActiveTypeVisible, parseContent } from '../../component/tooltip/utils/common';
import { getFirstDatumFromTooltipData, getTooltipContentValue } from '../../component/tooltip/utils/get-value';
import { isNil } from '../../util';

interface ISeriesCacheInfo {
  seriesFields: string[];
  dimensionFields: string[];
  measureFields: string[];
  type: string;
}

export class BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  series: ISeries;

  spec: ISeriesTooltipSpec | undefined;
  activeType: TooltipActiveType[];

  activeTriggerSet = {
    mark: new Set<IMark>(),
    group: new Set<IMark>()
  };
  ignoreTriggerSet = {
    mark: new Set<IMark>()
  };
  protected _seriesCacheInfo: ISeriesCacheInfo;

  constructor(series: ISeries) {
    this.series = series;
    this.updateTooltipSpec();
  }

  updateTooltipSpec() {
    const seriesTooltipSpec = this.series.getSpec()?.tooltip;

    this.spec = seriesTooltipSpec;
    this._seriesCacheInfo = this._getSeriesCacheInfo();
  }

  protected _getSeriesCacheInfo = (): ISeriesCacheInfo => {
    const { series } = this;
    const _seriesField = series.getSeriesField();
    const seriesFields = isValid(_seriesField) ? array(_seriesField) : series.getSeriesKeys() ?? [];
    return {
      seriesFields,
      dimensionFields: series.getDimensionField() ?? [],
      measureFields: series.getMeasureField() ?? [],
      type: series.type
    };
  };

  protected _getDimensionData = (datum: any) => {
    const { dimensionFields } = this._seriesCacheInfo;
    return dimensionFields[0] && datum?.[dimensionFields[0]];
  };

  protected _getMeasureData = (datum: any) => {
    const { measureFields } = this._seriesCacheInfo;
    return measureFields[0] && datum?.[measureFields[0]];
  };

  protected _getSeriesFieldData = (datum: any) => {
    const { dimensionFields, seriesFields } = this._seriesCacheInfo;

    if (isValid(seriesFields[0]) && datum?.[seriesFields[0]]) {
      return datum?.[seriesFields[0]];
    }

    const subDimensionField = dimensionFields[dimensionFields.length - 1];
    if (dimensionFields.length > 1 && (seriesFields.length === 0 || this.series.getSeriesKeys().length <= 1)) {
      return datum?.[subDimensionField];
    }

    return datum?.[subDimensionField];
  };

  protected _getSeriesStyle = (datum: any, styleKey: string | string[], defaultValue?: any) => {
    for (const key of array(styleKey)) {
      const value = this.series.getSeriesStyle(datum)?.(key);
      if (isValid(value)) {
        return value;
      }
    }
    return defaultValue;
  };

  markTooltipKeyCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    return this._getSeriesFieldData(datum);
  };

  markTooltipValueCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    return this._getMeasureData(datum);
  };

  shapeTypeCallback = (datum: Datum, params?: TooltipHandlerParams): ShapeType | undefined => {
    return (
      this._getSeriesStyle(datum, 'shape', null) ??
      this._getSeriesStyle(datum, 'symbolType', this.series.getDefaultShapeType())
    );
  };

  shapeColorCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    return this._getSeriesStyle(datum, ['fill', 'stroke']);
  };

  shapeStrokeCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    return this._getSeriesStyle(datum, ['stroke', 'fill']);
  };

  dimensionTooltipTitleCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    return this._getDimensionData(datum);
  };

  groupTooltipTitleCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    return this._getSeriesFieldData(datum);
  };

  groupTooltipKeyCallback = (datum: Datum, params?: TooltipHandlerParams): string | undefined => {
    const { seriesFields } = this._seriesCacheInfo;
    let dimensionFields = this._seriesCacheInfo.dimensionFields;
    if (seriesFields[0]) {
      dimensionFields = dimensionFields.filter(field => field !== seriesFields[0]);
    }
    return dimensionFields.map(field => datum?.[field]).join('-');
  };

  getHasShape = (isContent: boolean) => {
    return !!isContent;
  };

  protected getShapeAttrs(activeType: TooltipActiveType, isContent: boolean, chartTooltipSpec?: ITooltipSpec) {
    const key = isContent ? 'content' : 'title';
    const shapeAttrs: ITooltipPattern = {
      ...chartTooltipSpec?.style?.shape,
      ...chartTooltipSpec?.[activeType],
      ...(chartTooltipSpec as any)?.[activeType]?.[key],
      ...this.spec?.[activeType],
      ...(this.spec as any)?.[activeType]?.[key]
    };

    const res = {
      shapeType: shapeAttrs.shapeType ?? this.shapeTypeCallback,
      shapeFill: shapeAttrs.shapeFill ?? shapeAttrs.shapeColor ?? this.shapeColorCallback,
      shapeStroke: shapeAttrs.shapeStroke ?? this.shapeStrokeCallback,
      shapeHollow: shapeAttrs.shapeHollow ?? false,
      shapeLineWidth: shapeAttrs.shapeLineWidth,
      shapeSize: shapeAttrs.shapeSize ?? (shapeAttrs as any).size,
      hasShape: shapeAttrs.hasShape ?? this.getHasShape(isContent)
    };

    return res;
  }

  protected enableByType(activeType: TooltipActiveType) {
    return true;
  }

  protected getDefaultContentList(
    activeType: TooltipActiveType
  ): MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>> {
    return [this.getDefaultContentPattern(activeType)];
  }

  protected getContentList(
    activeType: TooltipActiveType,
    spec: ITooltipPattern,
    shapeAttrs: Record<string, TooltipContentProperty<any>>,
    data?: TooltipData,
    datum?: Datum[],
    params?: TooltipHandlerParams
  ): ITooltipLineActual[] {
    return parseContent(
      spec?.content ?? this.getDefaultContentList(activeType),
      this.getDefaultContentPattern(activeType),
      shapeAttrs,
      data,
      datum,
      params
    );
  }

  protected getTitleResult(
    activeType: TooltipActiveType,
    titleSpec: TooltipPatternProperty<ITooltipLinePattern>,
    shapeAttrs: Record<string, TooltipContentProperty<any>>,
    data?: TooltipData,
    params?: TooltipHandlerParams
  ) {
    let titlePattern = isFunction(titleSpec)
      ? ((titleSpec as TooltipPatternCallback<ITooltipLinePattern>)(data, params) as ITooltipLinePattern)
      : (titleSpec as ITooltipLinePattern);

    if (!titlePattern) {
      titlePattern = this.getDefaultTitlePattern(activeType);
    } else if (isNil(titlePattern.value)) {
      titlePattern = {
        ...this.getDefaultTitlePattern(activeType),
        ...titlePattern
      };
    }

    if (titlePattern && titlePattern.visible !== false) {
      const datum = getFirstDatumFromTooltipData(data);
      const res = {
        visible: getTooltipContentValue(titlePattern.visible, datum, params),
        value: getTimeString(
          getTooltipContentValue(titlePattern.value, datum, params, titlePattern.valueFormatter),
          titlePattern.valueTimeFormat,
          titlePattern.valueTimeFormatMode
        ),
        valueStyle: getTooltipContentValue(titlePattern.valueStyle, datum, params),
        hasShape: titlePattern.hasShape
      } as ITooltipActual['title'];
      Object.keys(shapeAttrs).forEach(key => {
        (res as any)[key] = getTooltipContentValue(shapeAttrs[key], datum, params);
      });

      return res;
    }

    return {
      hasShape: false,
      visible: false
    } as ITooltipActual['title'];
  }

  getTooltipData(
    activeType: TooltipActiveType,
    chartTooltipSpec?: ITooltipSpec,
    data?: TooltipData,
    datum?: Datum[],
    params?: TooltipHandlerParams
  ): ITooltipActual | null {
    if (
      !this.enableByType(activeType) ||
      !isActiveTypeVisible(activeType, this.spec) ||
      (activeType === 'dimension' && (!datum || !datum.length))
    ) {
      return null;
    }
    const patternSpec = this.spec?.[activeType] ?? chartTooltipSpec?.[activeType];
    const contentShapeAttrs = this.getShapeAttrs(activeType, true, chartTooltipSpec);
    const titleShapeAttrs = this.getShapeAttrs(activeType, false, chartTooltipSpec);
    let content: ITooltipLineActual[];

    if (activeType === 'dimension') {
      content = [];
      const userContents = this.getContentList(activeType, patternSpec, contentShapeAttrs, data, datum, params);

      userContents.forEach(entry => {
        content.push(entry);
      });
    } else {
      content = this.getContentList(activeType, patternSpec, contentShapeAttrs, data, datum, params);
    }

    return {
      visible: true,
      activeType,
      data,
      title: this.getTitleResult(activeType, patternSpec?.title, titleShapeAttrs, data, params),
      content
    };
  }

  protected getDefaultTitlePattern(activeType: TooltipActiveType): ITooltipLinePattern {
    return {
      key: undefined,
      value: activeType === 'group' ? this.groupTooltipTitleCallback : this.dimensionTooltipTitleCallback
    };
  }

  protected getDefaultContentPattern(activeType: TooltipActiveType): ITooltipLinePattern {
    return {
      seriesId: this.series.id,
      key: activeType === 'group' ? this.groupTooltipKeyCallback : this.markTooltipKeyCallback,
      value: this.markTooltipValueCallback
    };
  }
}
