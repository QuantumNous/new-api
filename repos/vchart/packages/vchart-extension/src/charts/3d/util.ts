import { ChartType3dEnum } from './enum';

export const is3DChartType = (type: string) => {
  return (
    type === ChartType3dEnum.bar3d ||
    type === ChartType3dEnum.funnel3d ||
    type === ChartType3dEnum.histogram3d ||
    type === ChartType3dEnum.pie3d ||
    type === ChartType3dEnum.rangeColumn3d ||
    type === ChartType3dEnum.wordCloud3d
  );
};

export const is3DAxisChart = (spec: any) => {
  return (spec as any).zField || (spec.series && spec.series.some((s: any) => s.zField));
};

export const is3DChart = (spec: any) => {
  if (!spec) {
    return false;
  }

  if (is3DChartType(spec.type)) {
    return true;
  }

  if (is3DAxisChart(spec)) {
    return true;
  }

  return true;
};
