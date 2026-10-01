import type { ICartesianSeries } from '../../series/interface/series';

export interface IMarkerFilterOptions {
  getRelativeSeries: () => ICartesianSeries;
}

export function markerFilter(data: Array<DataView>, options: IMarkerFilterOptions) {
  if (options && options.getRelativeSeries) {
    const series = options.getRelativeSeries();

    if (series) {
      const viewData = series.getViewData();
      return viewData && viewData.latestData && viewData.latestData.length ? data : [];
    }
  }

  return data;
}
