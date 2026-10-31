import type { IVennSeriesTheme } from '../../../../series/venn/interface';

export const venn: IVennSeriesTheme = {
  circle: {
    style: {
      opacity: 0.8
    },
    state: {
      hover: {
        opacity: 1
      }
    }
  },
  overlap: {
    style: {
      opacity: 0.8
    },
    state: {
      hover: {
        opacity: 1,
        stroke: 'white',
        lineWidth: 2
      }
    }
  },
  label: {
    visible: true,
    style: {
      fill: 'white',
      textBaseline: 'middle',
      textAlign: 'center',
      fontSize: { type: 'token', key: 'l4FontSize' },
      lineHeight: { type: 'token', key: 'l4LineHeight' }
    }
  },
  overlapLabel: {
    visible: true,
    style: {
      textBaseline: 'middle',
      textAlign: 'center',
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' }
    }
  }
};
