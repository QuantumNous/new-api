import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1486ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1486ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '1000px',
      top: '378px',
      width: '105px',
      height: '92px',
      backgroundColor: '#ffffff'
    },
    defaultSpec: {
      background: 'transparent',
      padding: 0,
      type: 'bar',
      width: 105,
      height: 92,
      data: [
        {
          id: 'data',
          values: [
            {
              x: '1',
              y: 100,
              type: 'A'
            },
            {
              x: '2',
              y: 100,
              type: 'A'
            },
            {
              x: '3',
              y: 100,
              type: 'A'
            },
            {
              x: '4',
              y: 100,
              type: 'A'
            },
            {
              x: '1',
              y: 100,
              type: 'B'
            },
            {
              x: '2',
              y: 100,
              type: 'B'
            },
            {
              x: '3',
              y: 100,
              type: 'B'
            },
            {
              x: '4',
              y: 100,
              type: 'B'
            }
          ]
        }
      ],
      xField: ['x', 'type'],
      yField: 'y',
      seriesField: 'type',
      bar: {
        style: {
          fill: {
            gradient: 'linear',
            stops: [
              {
                offset: 1
              },
              {
                offset: 0,
                opacity: 0.6
              }
            ]
          }
        }
      },
      label: {
        visible: false,
        style: {
          fontSize: 10
        }
      },
      color: ['#4CC9E4', '#4954E6'],
      axes: [
        {
          orient: 'bottom',
          domainLine: {
            visible: true
          },
          tick: {
            visible: false
          },
          label: { visible: false },
          grid: { visible: false },
          bandPadding: 0.05
        },
        {
          orient: 'left',
          domainLine: {
            visible: true
          },
          grid: {
            visible: false
          },
          tick: {
            visible: false
          },
          label: { visible: false }
        }
      ]
    }
  });
};
