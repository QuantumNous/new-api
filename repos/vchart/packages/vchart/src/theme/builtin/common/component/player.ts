import type { IPlayerTheme } from '../../../../component/player';

const getDirectionTheme = (position: 'start' | 'end'): IPlayerTheme['controller']['forward'] => {
  return {
    order: 0,
    space: 10,
    position: 'start',
    style: {
      size: 12,
      fill: { type: 'palette', key: 'playerControllerColor' },
      fillOpacity: 0.8
    }
  };
};

const getPlayTheme = (): IPlayerTheme['controller']['pause'] => {
  return {
    order: 0,
    space: 10,
    position: 'start',
    style: {
      size: 12,
      fill: { type: 'palette', key: 'playerControllerColor' },
      fillOpacity: 0.8
    }
  };
};

export const player: IPlayerTheme = {
  visible: true,
  position: 'start',
  padding: {
    top: 20,
    bottom: 20
  },
  slider: {
    space: 10,
    trackStyle: {
      fill: { type: 'palette', key: 'sliderTrackColor' },
      fillOpacity: 0.8
    },
    railStyle: {
      fill: { type: 'palette', key: 'sliderRailColor' }
    },
    handlerStyle: {
      size: 15,
      stroke: { type: 'palette', key: 'backgroundColor' },
      lineWidth: 2,
      fill: { type: 'palette', key: 'playerControllerColor' }
    }
  },
  controller: {
    start: getPlayTheme(),
    pause: getPlayTheme(),
    backward: getDirectionTheme('start'),
    forward: getDirectionTheme('end')
  }
};
