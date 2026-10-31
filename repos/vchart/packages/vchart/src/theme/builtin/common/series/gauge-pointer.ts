import type { IGaugePointerSeriesTheme } from '../../../../series/gauge';

const pointerPath =
  // eslint-disable-next-line max-len
  'M-0.020059 -0.978425 C-0.018029 -0.9888053 -0.013378 -1 0 -1 C0.01342 -1 0.01812 -0.989146 0.0201 -0.978425 C0.02161 -0.9702819 0.0692 -0.459505 0.09486 -0.184807 C0.10298 -0.097849 0.1089 -0.034548 0.11047 -0.018339 C0.11698 0.04908 0.07373 0.11111 0.00002 0.11111 C-0.07369 0.11111 -0.117184 0.04991 -0.110423 -0.018339 C-0.103662 -0.086591 -0.022089 -0.9680447 -0.020059 -0.978425Z';
const circlePath =
  // eslint-disable-next-line max-len
  'M1 0 C1 0.55228 0.55228 1 0 1 C-0.552285 1 -1 0.55228 -1 0 C-1 -0.552285 -0.552285 -1 0 -1 C0.55228 -1 1 -0.552285 1 0Z';

export const gaugePointer: IGaugePointerSeriesTheme = {
  pointer: {
    type: 'path',
    width: 0.4,
    height: 0.4,
    style: {
      path: pointerPath
    }
  },
  pin: {
    width: 0.025,
    height: 0.025,
    style: {
      path: circlePath,
      fill: '#888'
    }
  },
  pinBackground: {
    width: 0.06,
    height: 0.06,
    style: {
      path: circlePath,
      fill: '#ddd'
    }
  }
};
