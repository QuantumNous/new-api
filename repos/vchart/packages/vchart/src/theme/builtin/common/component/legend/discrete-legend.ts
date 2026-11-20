import type { IDiscreteLegendTheme } from '../../../../../component/legend';

export const discreteLegend: IDiscreteLegendTheme = {
  orient: 'bottom',
  position: 'middle',
  padding: [16, 24],
  title: {
    visible: false,
    padding: 0,
    textStyle: {
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' },

      fill: { type: 'palette', key: 'primaryFontColor' },
      fontWeight: 'normal'
    },
    space: 12
  },
  pager: {
    textStyle: {
      fill: { type: 'palette', key: 'discreteLegendPagerTextColor' }
    },
    handler: {
      style: {
        fill: { type: 'palette', key: 'discreteLegendPagerHandlerColor' }
      },
      state: {
        disable: {
          fill: { type: 'palette', key: 'discreteLegendPagerHandlerDisableColor' }
        }
      }
    }
  },
  item: {
    visible: true,
    spaceCol: 10,
    spaceRow: 6,
    padding: 2,
    background: {
      state: {
        selectedHover: {
          fill: { type: 'palette', key: 'hoverBackgroundColor' }
        },
        unSelectedHover: {
          fill: { type: 'palette', key: 'hoverBackgroundColor' }
        }
      }
    },
    shape: {
      space: 6,
      style: {
        lineWidth: 0,
        fillOpacity: 1,
        opacity: 1 // 覆盖 vrender-components 里的默认值
      },
      state: {
        unSelected: {
          fillOpacity: 0.2,
          opacity: 1 // 覆盖 vrender-components 里的默认值
        }
      }
    },
    label: {
      space: 6,
      style: {
        fill: { type: 'palette', key: 'secondaryFontColor', default: '#89909d' },
        fontSize: { type: 'token', key: 'l5FontSize' },
        lineHeight: { type: 'token', key: 'l5LineHeight' },

        opacity: 1 // 覆盖 vrender-components 里的默认值
      },
      state: {
        unSelected: {
          fill: { type: 'palette', key: 'disableFontColor' },
          opacity: 1 // 覆盖 vrender-components 里的默认值
        }
      }
    }
  },
  allowAllCanceled: false
};
