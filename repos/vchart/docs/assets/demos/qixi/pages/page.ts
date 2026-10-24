import type { Page, Player } from '@internal/story-player';
import { getPage01YearMap } from '../data/01/util';
import { page01YearDuration, page02EventDuration, page02TitleDuration } from './constant';

export const createPages = (player: Player, pageMap: Record<string, Page>, data: any) => {
  const { page01, page02 } = data;
  const yearMap = getPage01YearMap(page01);
  pageMap.page01 = player.createPage({
    name: 'page01',
    duration: Object.keys(yearMap).length * page01YearDuration,
    transitionDuration: [
      { transitionType: 'from', duration: 1000 },
      { transitionType: 'to', duration: 1000 }
    ]
  });
  pageMap.page02 = player.createPage({
    name: 'page02',
    duration: page02TitleDuration + Object.keys(page02).length * page02EventDuration,
    transitionDuration: [
      { transitionType: 'from', duration: 1000 },
      { transitionType: 'to', duration: 1000 }
    ]
  });
  pageMap.page03 = player.createPage({
    name: 'page03',
    duration: 10000,
    transitionDuration: [
      { transitionType: 'from', duration: 1000 },
      { transitionType: 'to', duration: 1000 }
    ]
  });
  pageMap.page04 = player.createPage({
    name: 'page04',
    duration: 1000000,
    transitionDuration: [
      { transitionType: 'from', duration: 1000 },
      { transitionType: 'to', duration: 1000 }
    ]
  });
};
