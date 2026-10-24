import type { IDataZoomTheme } from '../../../../component/data-zoom';

// eslint-disable-next-line max-len
const DataZoomHandlerSymbolType = `M-0.5-2.4h0.9c0.4,0,0.7,0.3,0.7,0.7v3.3c0,0.4-0.3,0.7-0.7,0.7h-0.9c-0.4,0-0.7-0.3-0.7-0.7v-3.3
C-1.2-2-0.9-2.4-0.5-2.4z M-0.4-1.4L-0.4-1.4c0,0,0,0.1,0,0.1v2.6c0,0.1,0,0.1,0,0.1l0,0c0,0,0-0.1,0-0.1v-2.6
C-0.4-1.4-0.4-1.4-0.4-1.4z M0.3-1.4L0.3-1.4c0,0,0,0.1,0,0.1v2.6c0,0.1,0,0.1,0,0.1l0,0c0,0,0-0.1,0-0.1v-2.6
C0.3-1.4,0.3-1.4,0.3-1.4z;`;

const getHandlerTheme = (): IDataZoomTheme['startHandler'] => {
  return {
    style: {
      symbolType: DataZoomHandlerSymbolType,
      fill: { type: 'palette', key: 'sliderHandleColor' },
      scaleX: 1.2,
      scaleY: 1.2,
      stroke: { type: 'palette', key: 'dataZoomHandleStrokeColor' },
      lineWidth: 1
    }
  };
};

const getTextTheme = () => {
  return {
    padding: 8,
    style: {
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' },

      fill: { type: 'palette', key: 'secondaryFontColor', default: '#89909d' }
    }
  };
};

const getBackgroundChartTheme = (visible: boolean) => {
  return {
    area: {
      style: {
        visible,
        stroke: false,
        fill: { type: 'palette', key: 'dataZoomChartColor' }
      }
    },
    line: {
      style: {
        visible,
        stroke: { type: 'palette', key: 'dataZoomChartColor' },
        lineWidth: 1
      }
    }
  };
};

export const dataZoom: IDataZoomTheme = {
  padding: [12, 0],
  showDetail: 'auto',
  brushSelect: false,
  middleHandler: {
    visible: false,
    background: {
      size: 6,
      style: {
        stroke: { type: 'palette', key: 'dataZoomHandleStrokeColor' },
        cornerRadius: 2
      }
    },
    icon: {
      style: {
        size: 4,
        fill: { type: 'palette', key: 'sliderHandleColor' },
        stroke: { type: 'palette', key: 'dataZoomHandleStrokeColor' },
        symbolType:
          // eslint-disable-next-line max-len
          'M 0.3 -0.5 C 0.41 -0.5 0.5 -0.41 0.5 -0.3 C 0.5 -0.3 0.5 0.3 0.5 0.3 C 0.5 0.41 0.41 0.5 0.3 0.5 C 0.3 0.5 -0.3 0.5 -0.3 0.5 C -0.41 0.5 -0.5 0.41 -0.5 0.3 C -0.5 0.3 -0.5 -0.3 -0.5 -0.3 C -0.5 -0.41 -0.41 -0.5 -0.3 -0.5 C -0.3 -0.5 0.3 -0.5 0.3 -0.5 Z',
        lineWidth: 0.5
      }
    }
  },
  background: {
    size: 20,
    style: {
      fill: { type: 'palette', key: 'sliderRailColor' },
      lineWidth: 0
    }
  },
  selectedBackground: {
    style: {
      fill: { type: 'palette', key: 'sliderTrackColor' },
      fillOpacity: 0.1,
      outerBorder: {
        stroke: { type: 'palette', key: 'sliderTrackColor' },
        strokeOpacity: 0.2,
        distance: -0.5,
        lineWidth: 1
      }
    }
  },
  selectedBackgroundChart: getBackgroundChartTheme(false),
  startHandler: getHandlerTheme(),
  endHandler: getHandlerTheme(),
  startText: getTextTheme(),
  endText: getTextTheme(),
  backgroundChart: getBackgroundChartTheme(true)
};
