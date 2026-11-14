import { type Datum, type IPoint, type IShowTooltipOption, type TooltipActiveType } from '../../../typings';
import type { ICartesianSeries, IPolarSeries, ISeries } from '../../../series/interface';
import { SeriesTypeEnum } from '../../../series/interface/type';
import type { PieSeries } from '../../../series/pie/pie';
import { Event_Source_Type } from '../../../constant/event';
import { getElementAbsolutePosition, isArray, isValid, isNil } from '@visactor/vutils';
import type { IDimensionData, IDimensionInfo } from '../../../event/events/dimension/interface';
import { VChart } from '../../../core/vchart';
import type { IRegion } from '../../../region';
import type { Tooltip } from '../tooltip';
import type { IComponentOption } from '../../interface';
import { isDiscrete } from '@visactor/vscale';
import type { TooltipHandlerParams } from '../interface/common';

const getDataArrayFromFieldArray = (fields: string[], datum?: Datum) =>
  isValid(datum) ? fields.map(f => datum[f]) : undefined;

const datumContainsArray = (fields: string[], data?: Datum[]) => (datum: Datum) =>
  fields.every((key, i) => datum[key] === data?.[i]);

const hasData = (data?: any[] | Datum) => {
  if (isNil(data)) {
    return false;
  }
  if (isArray(data)) {
    return data.length > 0 && data.every(isValid);
  }
  return Object.keys(data).length > 0;
};

type MarkInfo = {
  pos: IPoint;
  data: {
    dimensionFields: string[];
    measureFields: string[];
    dimensionData?: any[];
    measureData?: any[];
    hasMeasureData?: boolean;
    groupField?: string;
    groupData?: any;
    originDatum?: Datum;
  };
  series: ISeries;
  dimType?: string;
};

export function showTooltip(datum: Datum, options: IShowTooltipOption, component: Tooltip): TooltipActiveType | 'none' {
  const opt: IShowTooltipOption = {
    regionIndex: 0,
    ...options
  };
  const componentOptions = component.getOption() as IComponentOption;

  // 确认region
  const region = componentOptions.getRegionsInUserIdOrIndex(
    isValid(opt.regionId) ? [opt.regionId] : undefined,
    isValid(opt.regionIndex) ? [opt.regionIndex] : undefined
  )[0];
  if (!region) {
    return 'none';
  }

  // 查询图元信息
  const markInfoList = getMarkInfoList(datum, region);

  // 组织数据
  const activeType = opt.activeType ?? (markInfoList.length > 1 ? 'dimension' : 'mark');
  const regionPos = region.getLayoutStartPoint();
  const regionRect = region.getLayoutRect();
  const container = componentOptions.globalInstance.getContainer();
  const containerPos = {
    x: 0,
    y: 0,
    ...(container ? getElementAbsolutePosition(container) : {})
  };
  const bound = (pos: IPoint): IPoint => ({
    x: Math.min(Math.max(pos.x, 0), regionRect.width),
    y: Math.min(Math.max(pos.y, 0), regionRect.height)
  });
  const getOriginDatum = (info: MarkInfo) => {
    const { dimensionFields, dimensionData, measureFields, measureData, groupField, groupData } = info.data;
    return info.series.getViewData()?.latestData.find((datum: any) => {
      return (
        datumContainsArray(dimensionFields, dimensionData)(datum) &&
        datumContainsArray(measureFields, measureData)(datum) &&
        (isNil(groupField) || datumContainsArray([groupField], [groupData])(datum))
      );
    });
  };
  const transform = region.getOption().globalInstance.getStage().window.getViewBoxTransform().getInverse();

  const getMockEvent = (originPos: IPoint): any => {
    const pos = bound(originPos);
    const tempX = opt.x ?? regionPos.x + pos.x;
    const tempY = opt.y ?? regionPos.y + pos.y;

    const canvasPoint = { x: 0, y: 0 };
    transform.transformPoint({ x: tempX, y: tempY }, canvasPoint);
    const { x: canvasX, y: canvasY } = canvasPoint;
    return {
      canvasX,
      canvasY,
      clientX: containerPos.x + canvasX,
      clientY: containerPos.y + canvasY
    };
  };

  // 显示tooltip
  if (activeType === 'dimension') {
    const firstInfo = markInfoList[0];
    if (!firstInfo) {
      return 'none';
    }

    // 将markInfoList按系列分组
    const markInfoSeriesMap = new Map<ISeries, MarkInfo[]>();
    markInfoList.forEach(info => {
      if (!markInfoSeriesMap.has(info.series)) {
        markInfoSeriesMap.set(info.series, []);
      }
      markInfoSeriesMap.get(info.series)?.push(info);
    });

    const mockDimensionInfo: IDimensionInfo[] = [
      {
        value: datum[firstInfo.data.dimensionFields[0]],
        data: [...markInfoSeriesMap.keys()].map(series => {
          return {
            series,
            datum: markInfoSeriesMap.get(series)?.map(info => getOriginDatum(info)) ?? []
          };
        })
      }
    ];

    if (isValid(firstInfo.dimType)) {
      mockDimensionInfo[0].position = firstInfo.pos[firstInfo.dimType];
      mockDimensionInfo[0].dimType = firstInfo.dimType;
    }

    const mockParams: TooltipHandlerParams = {
      changePositionOnly: false,
      action: 'enter',
      tooltip: null,
      dimensionInfo: mockDimensionInfo,
      chart: componentOptions.globalInstance.getChart() ?? undefined,
      datum: undefined,
      model: undefined,
      source: Event_Source_Type.chart,
      event: getMockEvent({
        x: markInfoList.reduce((sum, info) => sum + info.pos.x, 0) / markInfoList.length,
        y: markInfoList.reduce((sum, info) => sum + info.pos.y, 0) / markInfoList.length // 位置求平均
      }),
      item: undefined
    };

    component.processor?.dimension?.showTooltip?.(mockDimensionInfo, mockParams, false);

    // 全局唯一 tooltip
    const vchart = componentOptions.globalInstance;
    if (VChart.globalConfig.uniqueTooltip) {
      VChart.hideTooltip(vchart.id);
    }

    return activeType;
  } else if (activeType === 'mark') {
    const info = markInfoList[0];
    if (!info) {
      return 'none';
    }
    const mockDatum = info.data.originDatum ?? {
      ...getOriginDatum(info),
      ...datum
    };
    const mockDimensionData: IDimensionData[] = [
      {
        datum: [mockDatum],
        series: info.series
      }
    ];
    const mockDimensionInfo: IDimensionInfo[] = [
      {
        value: mockDatum[info.data.dimensionFields[0]],
        data: mockDimensionData
      }
    ];
    const mockParams: TooltipHandlerParams = {
      // FIXME: 补充 action、dimensionInfo
      changePositionOnly: false,
      tooltip: null,
      dimensionInfo: mockDimensionInfo,
      chart: componentOptions.globalInstance.getChart() ?? undefined,
      datum: mockDatum,
      model: info.series,
      source: Event_Source_Type.chart,
      event: getMockEvent(info.pos),
      item: undefined
    } as any;

    component.processor.mark.showTooltip(
      {
        datum: mockDatum,
        mark: null,
        series: info.series
      },
      mockParams,
      false
    );

    // 全局唯一 tooltip
    const vchart = componentOptions.globalInstance;
    if (VChart.globalConfig.uniqueTooltip) {
      VChart.hideTooltip(vchart.id);
    }
    return activeType;
  }
  return 'none';
}

export const getMarkInfoList = (datum: Datum, region: IRegion) => {
  const seriesList = region.getSeries();
  const markInfoList: MarkInfo[] = [];

  seriesList.forEach(series => {
    /** 维度field */
    const dimensionFields = series.getDimensionField();
    /** 指标原始field（用于显示tooltip） */
    const measureFields = series.getMeasureField();

    const groupField = series.getSeriesField();
    const groupData = isValid(groupField) ? datum[groupField] : undefined;
    const groupDomain = isValid(groupField)
      ? series.getViewDataStatistics?.()?.latestData[groupField]?.values ?? []
      : [];

    const dimensionData = getDataArrayFromFieldArray(dimensionFields, datum);
    let measureData = getDataArrayFromFieldArray(measureFields, datum);
    const hasMeasureData = hasData(measureData);

    const isMultiGroups = !hasMeasureData && isValid(groupField) && isNil(groupData) && groupDomain.length > 0; // 是否需要考虑多个数据组

    const parseMarkInfoOfSimpleSeries = () => {
      const originDatum = series.getViewData()?.latestData.find(datumContainsArray(dimensionFields, dimensionData));
      if (!hasMeasureData) {
        // 如果只有单个数据组且用户没有给y轴数据，则补全y轴数据
        measureData = getDataArrayFromFieldArray(measureFields, originDatum);
        if (!hasData(measureData)) {
          return;
        }
      }

      const pos =
        series.type === SeriesTypeEnum.pie
          ? (series as PieSeries).dataToCentralPosition(originDatum)
          : series.dataToPosition(originDatum);
      if (isNil(pos) || isNaN(pos.x) || isNaN(pos.y)) {
        return;
      }

      markInfoList.push({
        pos,
        data: {
          dimensionFields,
          dimensionData,
          measureFields,
          measureData,
          hasMeasureData,
          groupField,
          groupData
        },
        series
      });
    };

    const parseMarkInfoOfGeoSeries = () => {
      console.log('parseMarkInfoOfGeoSeries');
      let originDatum = series.getViewData()?.latestData.find(datumContainsArray(dimensionFields, dimensionData));
      // 地图需要特殊处理，需要根据properties属性来匹配数据
      // @ts-ignore
      const nameMap = series.getNameMap();

      const originMapDatum = series
        // @ts-ignore
        .getMapViewData?.()
        ?.latestData.find((datum: Datum) =>
          dimensionFields.every((key, i) => {
            if (key === 'name') {
              return nameMap[datum.properties[key]] === dimensionData?.[i];
            }
            return datum.properties[key] === dimensionData?.[i];
          })
        );
      if (!originMapDatum) {
        return;
      }
      let markInfoMeasureData = measureData;
      if (originMapDatum && !originDatum) {
        originDatum = { ...datum };
      }
      if (!hasMeasureData) {
        // 如果只有地图数据，则补全
        measureData = getDataArrayFromFieldArray(measureFields, originDatum);
        markInfoMeasureData = measureData;
        if (!hasData(measureData) && !originDatum) {
          return;
        }
        if (!hasData(measureData)) {
          measureData = [null];
        }
      }

      const pos = series.dataToPosition(originDatum);
      if (isNil(pos) || isNaN(pos.x) || isNaN(pos.y)) {
        return;
      }

      markInfoList.push({
        pos,
        data: {
          dimensionFields,
          dimensionData,
          measureFields,
          measureData: markInfoMeasureData,
          hasMeasureData,
          groupField,
          groupData,
          originDatum
        },
        series
      });
    };

    if (series.coordinate === 'cartesian') {
      const cartesianSeries = series as ICartesianSeries;
      const dimType = isDiscrete((series as ICartesianSeries).getYAxisHelper()?.getScale(0)?.type) ? 'y' : 'x';

      // 补全维度轴数据
      const invalidDimensionFields = dimensionFields
        .map((field, i) => [field, i] as [string, number])
        .filter(([, i]) => isNil(dimensionData?.[i]));
      let dimensionDataList: any[][] = [dimensionData ?? []];
      if (invalidDimensionFields.length > 0) {
        invalidDimensionFields.forEach(([field, i]) => {
          const domain = series.getViewDataStatistics?.()?.latestData[field]?.values ?? [];
          const nextList: any[][] = [];
          dimensionDataList.forEach(dimensionData => {
            domain.forEach((value: any) => {
              const newData = dimensionData?.slice() ?? [];
              newData[i] = value;
              nextList.push(newData);
            });
          });
          dimensionDataList = nextList;
        });
      }
      dimensionDataList.forEach(dimensionData => {
        if (isMultiGroups) {
          const measureDataList = cartesianSeries
            .getViewData()
            ?.latestData.filter(datumContainsArray(dimensionFields, dimensionData));
          groupDomain.forEach((groupData: any) => {
            const originDatum = measureDataList.find((d: Datum) => d[groupField] === groupData);
            // 补全指标轴数据
            measureData = getDataArrayFromFieldArray(measureFields, originDatum);
            if (!hasData(measureData)) {
              return;
            }

            const pos = cartesianSeries.dataToPosition(originDatum);
            if (isNil(pos) || isNaN(pos.x) || isNaN(pos.y)) {
              return;
            }

            markInfoList.push({
              pos,
              data: {
                dimensionFields,
                dimensionData,
                measureFields,
                measureData,
                hasMeasureData,
                groupField,
                groupData
              },
              series,
              dimType
            });
          });
        } else {
          const originDatum = cartesianSeries
            .getViewData()
            ?.latestData.find(datumContainsArray(dimensionFields, dimensionData));
          if (!hasMeasureData) {
            // 如果只有单个数据组且用户没有给y轴数据，则补全y轴数据
            measureData = getDataArrayFromFieldArray(measureFields, originDatum);
            if (!hasData(measureData)) {
              return;
            }
          }

          const pos = cartesianSeries.dataToPosition(originDatum);
          if (isNil(pos) || isNaN(pos.x) || isNaN(pos.y)) {
            return;
          }

          markInfoList.push({
            pos,
            data: {
              dimensionFields,
              dimensionData,
              measureFields,
              measureData,
              hasMeasureData,
              groupField,
              groupData
            },
            dimType,
            series
          });
        }
      });
    } else if (series.coordinate === 'polar') {
      if (series.type === SeriesTypeEnum.pie) {
        parseMarkInfoOfSimpleSeries();
      } else {
        // 处理玫瑰图、雷达图
        const polarSeries = series as IPolarSeries;

        if (isMultiGroups) {
          const measureDataList = polarSeries
            .getViewData()
            ?.latestData.filter(datumContainsArray(dimensionFields, dimensionData));
          const originDatum = measureDataList.find((d: Datum) => d[groupField] === groupData);
          groupDomain.forEach((groupData: any) => {
            // 补全指标轴数据
            measureData = getDataArrayFromFieldArray(measureFields, originDatum);
            if (!hasData(measureData)) {
              return;
            }

            const pos = polarSeries.dataToPosition(originDatum);
            if (isNil(pos) || isNaN(pos.x) || isNaN(pos.y)) {
              return;
            }

            markInfoList.push({
              pos,
              data: {
                dimensionFields,
                dimensionData,
                measureFields,
                measureData,
                hasMeasureData,
                groupField,
                groupData
              },
              series
            });
          });
        } else {
          parseMarkInfoOfSimpleSeries();
        }
      }
    } else if (series.coordinate === 'geo') {
      parseMarkInfoOfGeoSeries();
    }
  });

  return markInfoList;
};
