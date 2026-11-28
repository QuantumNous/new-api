import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1801ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1801ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '478px',
      top: '186px',
      width: '485px',
      height: '244px',
      backgroundColor: '#F0EBDF'
    },
    defaultSpec: {
      type: 'common',
      background: 'transparent',
      data: [
        {
          id: 'id0',
          values: []
        },
        {
          id: 'id1',
          values: []
        }
      ],
      series: [
        {
          type: 'pie',
          dataIndex: 0,
          outerRadius: 0.65,
          innerRadius: 0,
          valueField: 'value',
          categoryField: 'type',
          label: {
            position: 'inside',
            visible: true,
            style: {
              fill: 'white'
            }
          },
          pie: {
            style: {
              stroke: '#ffffff',
              lineWidth: 2
            }
          }
        },
        {
          type: 'pie',
          dataIndex: 1,
          outerRadius: 0.8,
          innerRadius: 0.67,
          valueField: 'value',
          categoryField: 'type',
          label: {
            visible: true
          },
          pie: {
            style: {
              stroke: '#ffffff',
              lineWidth: 2
            }
          }
        }
      ],
      color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
      legends: {
        visible: false,
        orient: 'left'
      }
    }
  });
};
