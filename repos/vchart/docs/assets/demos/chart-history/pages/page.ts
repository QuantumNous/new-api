import { array } from '@visactor/vutils';
import type { Page, Player } from '@internal/story-player';
import { chartPageKeys } from '../constant';

export const createPages = (player: Player, pageMap: Record<string, Page>) => {
  pageMap.pageTitle = player.createPage({
    name: 'title',
    duration: 6500
  });

  pageMap.pageTimeline = player.createPage({
    name: 'timeline',
    duration: 3000,
    transitionDuration: [
      { transitionType: 'from', duration: 700 },
      { transitionType: 'to', duration: 700 }
    ]
  });

  chartPageKeys.forEach(keys => {
    array(keys).forEach(key => {
      const page = player.createPage({
        name: 'chart' + key,
        duration: 6000,
        transitionDuration: [
          { transitionType: 'from', duration: 1000 },
          { transitionType: 'to', duration: 1000 }
        ]
      });
      pageMap[key] = page;
    });
  });

  pageMap.pageVisActor = player.createPage({});
};
