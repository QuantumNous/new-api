import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1990sActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1990sActorChart = player.createActor<VChartActor>(ActorType.vchart, {
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
      type: 'treemap',
      background: 'transparent',
      data: [
        {
          id: 'data',
          values: []
        }
      ],
      categoryField: 'name',
      valueField: 'value',
      label: {
        visible: true,
        style: {
          fontSize: 12
        }
      },
      nodePadding: 1
    }
  });
};
