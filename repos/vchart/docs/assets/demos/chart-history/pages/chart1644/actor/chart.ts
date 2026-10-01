import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';
import { highlightColor } from '../../../constant';

export const pageChart1644ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1644ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      width: '495px',
      height: '112px',
      left: '213px',
      top: '310px',
      backgroundColor: 'rgba(255, 255, 255, 0)'
    },
    defaultSpec: {
      background: 'transparent',
      padding: {
        top: 20,
        bottom: 15,
        left: 0,
        right: 0
      },
      type: 'common',
      color: [highlightColor],
      series: [
        {
          type: 'scatter',
          data: {
            id: 'data',
            values: [
              { x: 104, y: 10, type: 'A' },
              { x: 98, y: 10, type: 'A' },
              { x: 93, y: 10, type: 'A' },
              { x: 90, y: 10, type: 'A' },
              { x: 76, y: 10, type: 'A' },
              { x: 70, y: 10, type: 'A' },
              { x: 63, y: 10, type: 'A' }
            ]
          },
          xField: 'x',
          yField: 'y',
          seriesField: 'type',
          point: {
            style: {
              size: 8
            }
          }
        }
      ],
      axes: [
        {
          orient: 'left',
          type: 'linear',
          label: { visible: false },
          tick: { visible: false },
          grid: { visible: false },
          min: 0,
          max: 100
        },
        {
          orient: 'bottom',
          type: 'linear',
          label: { visible: false },
          tick: { visible: false },
          grid: { visible: false },
          domainLine: {
            visible: true,
            style: { stroke: 'black', strokeWidth: 2 }
          },
          min: 0,
          max: 110
        }
      ]
    }
  });
};
