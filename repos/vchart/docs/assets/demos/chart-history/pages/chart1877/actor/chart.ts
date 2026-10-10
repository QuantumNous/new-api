import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1877ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1877ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '470px',
      top: '440px',
      width: '280px',
      height: '280px',
      backgroundColor: '#C6B0B7'
    },
    defaultSpec: {
      type: 'radar',
      background: 'transparent',
      data: [
        {
          values: []
        }
      ],
      categoryField: 'month',
      valueField: 'value',
      seriesField: 'type', // 声明分组字段,
      outerRadius: 0.8,
      area: {
        visible: true
      },
      axes: [
        {
          orient: 'radius', // 半径轴配置
          grid: {
            smooth: true, // 平滑的网格线
            style: {
              lineDash: [0]
            },
            alternateColor: '#f5f5f5' // 配置栅格线间的背景色
          }
        },
        {
          orient: 'angle', // 角度轴配置
          tick: {
            visible: false
          },
          domainLine: {
            visible: true,
            style: {
              stroke: '#333'
            }
          },
          grid: {
            style: {
              lineDash: [0]
            }
          }
        }
      ],
      legends: {
        visible: false,
        orient: 'top'
      }
    }
  });
};
