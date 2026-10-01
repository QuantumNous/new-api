import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1990s_2ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1990s_2ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '676px',
      top: '206px',
      width: '290px',
      height: '209px',
      backgroundColor: 'rgb(224, 81, 81)'
    },
    defaultSpec: {
      type: 'sunburst',
      offsetX: 0,
      offsetY: 0,
      padding: 0,
      categoryField: 'name',
      valueField: 'value',
      outerRadius: 1,
      innerRadius: 0,
      gap: 5,
      drill: true,
      labelAutoVisible: {
        enable: true,
        circumference: 5
      },
      labelLayout: {
        align: 'center',
        rotate: 'radial'
      },
      sunburst: {
        visible: true
      },
      label: {
        visible: true
      },
      data: [
        {
          id: 'data',
          values: []
        }
      ]
    }
  });
};
