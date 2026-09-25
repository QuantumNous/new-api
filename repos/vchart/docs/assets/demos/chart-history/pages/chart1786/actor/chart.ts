import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1786ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1786ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      width: '452px',
      height: '303px',
      left: '647px',
      top: '223px',
      backgroundColor: '#ffffff'
    },
    defaultSpec: {
      type: 'bar',
      padding: 0,
      data: [
        {
          id: 'data0',
          values: []
        }
      ],
      direction: 'horizontal',
      yField: 'country',
      xField: 'max',
      axes: [
        {
          animation: true,
          orient: 'bottom',
          type: 'linear',
          visible: true,
          grid: {
            visible: true
          }
        },
        {
          animation: true,
          id: 'axis-left',
          orient: 'left',
          tick: { visible: false },
          label: { visible: true },
          type: 'band',
          grid: {
            visible: true
          }
        }
      ],
      bar: {
        style: {
          texture: 'circle',
          texturePadding: 1,
          textureSize: 5,
          textureColor: 'red'
        }
      }
    }
  });
};
