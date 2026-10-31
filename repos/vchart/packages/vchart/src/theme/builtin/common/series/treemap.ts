import type { ITreemapSeriesTheme } from '../../../../series/treemap/interface';

export const treemap: ITreemapSeriesTheme = {
  gapWidth: 1,
  nodePadding: [5],
  nonLeaf: {
    visible: false,
    style: {
      fillOpacity: 0.5
    }
  },
  label: {
    style: {
      fill: 'white',
      textBaseline: 'middle',
      textAlign: 'center',
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' }
    }
  },
  nonLeafLabel: {
    padding: 24,
    style: {
      fill: 'black',
      stroke: { type: 'palette', key: 'backgroundColor' },
      lineWidth: 2,
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' },
      textBaseline: 'middle',
      textAlign: 'center'
    }
  }
};
