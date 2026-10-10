import { type BaseActor, type BaseLayer, type Page, type Player } from '@internal/story-player';
import { OriginalData } from '../../data/interface';
import anime from '../../lib/anime.es';

export const page04Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>,
  data: OriginalData
) => {
  player.createAction(actorMap.page04ActorBg, {
    name: 'page04ActorBg',
    pageList: [pageMap.page04.id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        duration: 1000,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 1,
            duration: 1000,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 1000,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });
};
