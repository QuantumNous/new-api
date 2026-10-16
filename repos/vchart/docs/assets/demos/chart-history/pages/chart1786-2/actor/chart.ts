import type { BaseActor, Player, VChartActor } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { ActorType } from '@internal/story-player';

export const pageChart1786_2ActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  actorMap.pageChart1786_2ActorChart = player.createActor<VChartActor>(ActorType.vchart, {
    name: 'chart',
    defaultStyle: {
      opacity: '0',
      left: '90px',
      top: '262px',
      width: '500px',
      height: '322px',
      backgroundColor: '#ffffff'
    },
    defaultSpec: {
      type: 'area',
      data: {
        values: []
      },
      stack: false,
      xField: 'type',
      yField: 'value',
      seriesField: 'country',
      legends: [{ visible: false, position: 'middle', orient: 'bottom' }]
    }
  });
};
