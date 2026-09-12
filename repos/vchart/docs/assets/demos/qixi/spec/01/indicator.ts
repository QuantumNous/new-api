import { ICommonChartSpec, IIndicatorSpec } from '@visactor/vchart';
import { Page01YearDatum } from '../../data/01/interface';

export const getIndicatorSpec = (data: Page01YearDatum): ICommonChartSpec => ({
  type: 'common',
  background: 'transparent',
  region: data.dataList.map((_, i) => ({
    id: `indicator_${i}`
  })),
  layout: {
    type: 'grid',
    col: 1,
    row: data.dataList.length,
    elements: data.dataList.map((_, i) => ({
      modelId: `indicator_${i}`,
      col: 0,
      row: i
    }))
  },
  series: [],
  // @ts-ignore
  indicator: data.dataList.map(
    ({ name, value }, i) =>
      ({
        regionId: `indicator_${i}`,
        visible: true,
        title: {
          style: {
            text: name,
            fontSize: 30,
            fontWeight: 800,
            fill: '#888',
            textAlign: 'left',
            dx: -100
          }
        },
        content: {
          style: {
            text: value,
            fontSize: 60,
            lineHeight: 70,
            fontWeight: 600,
            fill: '#666',
            textAlign: 'left',
            dx: -100,
            dy: 10
          }
        }
      } as IIndicatorSpec)
  )
});
