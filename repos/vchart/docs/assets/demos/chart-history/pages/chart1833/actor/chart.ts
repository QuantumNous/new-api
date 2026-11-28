import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1833ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1833ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '790px',
      top: '176px',
      width: '322px',
      height: '268px',
      backgroundColor: '#ffffff'
    },
    defaultSpec: {
      type: 'common',
      data: [],
      axes: [
        {
          orient: 'left',
          nice: true,
          zero: false,
          type: 'linear',
          range: { min: -100, max: 100 },
          tick: {
            tickCount: 10
          },
          grid: {
            visible: true,
            style: {
              lineDash: [0]
            }
          }
        },
        {
          orient: 'bottom',
          nice: true,
          label: { visible: true },
          type: 'linear',
          range: { min: -100, max: 100 },
          tick: {
            tickCount: 10
          },
          grid: {
            visible: true,
            style: {
              lineDash: [0]
            }
          }
        }
      ],
      series: [
        {
          type: 'scatter',
          // 通过数据中的 index 进行数据匹配
          dataKey: 'index',
          // 声明点半径大小
          sizeField: 'value',
          size: {
            type: 'linear',
            range: [5, 30]
          },
          xField: 'x',
          yField: 'y',
          point: {
            style: {
              fill: '#000000',
              fillOpacity: 0.6
            }
          }
        }
      ]
    }
  });
};
