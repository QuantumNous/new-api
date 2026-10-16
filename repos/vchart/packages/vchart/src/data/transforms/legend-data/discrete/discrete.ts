import { isValid, isArray } from '@visactor/vutils';
import type { ISeries } from '../../../../series/interface';
import type { IDiscreteLegendData, IDiscreteLegendDataMakeOption, IDiscreteLegendFilterOption } from './interface';
import { DEFAULT_DATA_SERIES_FIELD } from '../../../../constant/data';

export const discreteLegendDataMake = (data: Array<ISeries>, op: IDiscreteLegendDataMakeOption) => {
  const result: IDiscreteLegendData[] = [];
  const tempKey: { [key in string]: boolean } = {};
  const { series, seriesField } = op;
  series().forEach(s => {
    const field = seriesField(s);
    let infoList;
    if (field === s.getSeriesField()) {
      infoList = s.getSeriesInfoList();
    } else {
      infoList = s.getSeriesInfoInField(field);
    }
    infoList.forEach(info => {
      if (tempKey[info.key]) {
        return;
      }
      tempKey[info.key] = true;
      result.push(info);
    });
  });
  return result;
};

export const discreteLegendFilter = (data: Array<any>, op: IDiscreteLegendFilterOption) => {
  const { series, selected, field, data: legendData, customFilter } = op;
  const selectedData = selected();
  const legendKeys = legendData(); // 全量的图例项
  if (selectedData.length === 0 && legendKeys.length) {
    return [];
  }

  if (selectedData.length === legendKeys.length) {
    return data;
  }

  const selectedFilter = {};
  selectedData.forEach(s => {
    selectedFilter[s] = true;
  });

  const datumField = field() ?? DEFAULT_DATA_SERIES_FIELD;

  if (customFilter) {
    return customFilter(data, selectedData, datumField);
  } else if (isArray(data) && data[0]?.nodes) {
    // data silter for sankey chart
    data[0].nodes = data[0].nodes.filter((d: any) => selectedFilter[d.key] === true);
    if (data[0]?.links) {
      data[0].links = data[0].links.filter(
        (d: any) => selectedFilter[d.source] === true && selectedFilter[d.target] === true
      );
    }
  } else {
    if (isValid(datumField)) {
      data = data.filter(d => selectedFilter[series.getSeriesFieldValue(d, datumField)] === true);
    }
  }

  return data;
};
