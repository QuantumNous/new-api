import type { IAxisHelper as CartesianHelper } from '../../component/axis/cartesian/interface/common';
import { SeriesTypeEnum } from '../interface/type';
import type { Datum } from '../../typings';
import type { IOrdinalScale } from '@visactor/vscale';
import { isContinuous } from '@visactor/vscale';
import type { IPolarAxisHelper } from '../../component/axis';
import type { ICartesianSeries } from '../interface';

export function isPolarAxisSeries(type: string) {
  return ([SeriesTypeEnum.rose, SeriesTypeEnum.radar, SeriesTypeEnum.circularProgress] as string[]).includes(type);
}

export function sortDataInAxisHelper(axisHelper: CartesianHelper | IPolarAxisHelper, field: string, dataList: Datum[]) {
  const scale = axisHelper.getScale(0);
  const isRevert = 'isInverse' in axisHelper ? axisHelper.isInverse() : false;
  if (isContinuous(scale.type)) {
    dataList.sort((datumA: Datum, datumB: Datum) => {
      return (datumA[field] - datumB[field]) * (isRevert ? -1 : 1);
    });
  } else {
    dataList.sort((datumA: Datum, datumB: Datum) => {
      return (
        ((scale as IOrdinalScale).index(datumA[field]) - (scale as IOrdinalScale).index(datumB[field])) *
        (isRevert ? -1 : 1)
      );
    });
  }
}

export function getGroupAnimationParams(series: ICartesianSeries) {
  // 分组数据的 dataIndex 应该与轴顺序一致，而非 data[DEFAULT_DATA_INDEX] 顺序
  const dataIndex = (datum: any) => {
    const indexField = series.direction === 'horizontal' ? series.fieldY[0] : series.fieldX[0];
    const indexValue = datum?.[indexField];
    const scale = series.direction === 'horizontal' ? series.scaleY : series.scaleX;
    const index = (scale?.domain?.() ?? []).indexOf(indexValue);
    // 不应该出现xIndex === -1 || undefined的情况
    return index || 0;
  };
  const dataCount = () => {
    const scale = series.direction === 'horizontal' ? series.scaleY : series.scaleX;
    return (scale?.domain?.() ?? []).length ?? 0;
  };
  return { dataIndex, dataCount };
}
