import type { DataView } from '@visactor/vdataset';

const getDataViewsInDataSet = (dataView?: DataView | null) => {
  const dataViewMap = dataView?.dataSet?.dataViewMap;

  return dataViewMap ? (Object.values(dataViewMap).filter(Boolean) as DataView[]) : [];
};

const detachDataViewListener = (source: DataView, target: DataView) => {
  source?.target?.removeListener('change', target.reRunAllTransform);
  source?.target?.removeListener('markRunning', target.markRunning);
};

export const detachDataViewDependencies = (dataView?: DataView | null) => {
  if (!dataView) {
    return;
  }

  const dataViews = getDataViewsInDataSet(dataView);

  dataViews.forEach(source => {
    detachDataViewListener(source, dataView);
  });

  const dependencies = (dataView as unknown as { rawData?: DataView[] })?.rawData;

  if (Array.isArray(dependencies)) {
    dependencies.forEach(dependency => {
      detachDataViewListener(dependency, dataView);
    });
  }
};

export const releaseDataViews = (dataViews: Array<DataView | null | undefined>) => {
  const releaseDataViews = Array.from(new Set(dataViews.filter(Boolean) as DataView[]));

  if (!releaseDataViews.length) {
    return;
  }

  releaseDataViews.forEach(detachDataViewDependencies);
  releaseDataViews.forEach(dataView => {
    dataView.destroy?.();
  });
};

export const releaseDataView = (dataView?: DataView | null) => {
  releaseDataViews([dataView]);
};

export const releaseDataViewWithDependencies = (
  dataView: DataView | null | undefined,
  shouldReleaseDependency: (dataView: DataView) => boolean
) => {
  if (!dataView) {
    return;
  }

  const dataViewsInDataSet = new Set(getDataViewsInDataSet(dataView));
  const releaseDependencies: DataView[] = [];
  const collectReleaseDependencies = (currentDataView: DataView) => {
    const dependencies = (currentDataView as unknown as { rawData?: DataView[] })?.rawData;

    if (!Array.isArray(dependencies)) {
      return;
    }

    dependencies.forEach(dependency => {
      if (
        dataViewsInDataSet.has(dependency) &&
        shouldReleaseDependency(dependency) &&
        !releaseDependencies.includes(dependency)
      ) {
        releaseDependencies.push(dependency);
        collectReleaseDependencies(dependency);
      }
    });
  };

  collectReleaseDependencies(dataView);
  releaseDataViews([dataView, ...releaseDependencies]);
};
