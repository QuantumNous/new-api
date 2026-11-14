import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1856ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1856ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '440px',
      top: '328px',
      width: '235px',
      height: '225px',
      backgroundColor: '#C7B9AF',
      borderRadius: '10px'
    },
    defaultSpec: {
      type: 'rose',
      background: 'transparent',
      data: [
        {
          id: 'id0',
          values: []
        }
      ],
      padding: {
        top: 30
      },
      radius: 0.8,
      innerRadius: 0,
      categoryField: 'month',
      valueField: 'value',
      seriesField: 'type',
      stack: true,
      rose: {
        style: {
          stroke: 'white',
          lineWidth: 1
        }
      },
      axes: [
        {
          orient: 'radius',
          visible: true,
          tick: { tickCount: 3 },
          grid: { visible: true, style: { lineDash: [0] } },
          max: 150
        },
        {
          orient: 'angle',
          visible: true,
          domainLine: { visible: true, smooth: false },
          grid: { visible: true, smooth: false },
          label: {
            visible: true,
            style: {
              fill: '#000'
            }
          }
        }
      ]
    }
  });
};
