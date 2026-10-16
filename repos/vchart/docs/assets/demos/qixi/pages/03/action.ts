import { type BaseActor, type BaseLayer, type Page, type Player } from '@internal/story-player';
import { OriginalData } from '../../data/interface';
import anime from '../../lib/anime.es';

export const page03Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>,
  data: OriginalData
) => {
  player.createAction(actorMap.page03ActorBg, {
    name: 'page03ActorBg',
    pageList: [pageMap.page03.id],
    layer: layerMap.layerVideo.id,
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

  player.createAction(actorMap.page03ActorTitle, {
    name: 'page03ActorTitle',
    pageList: [pageMap.page03.id],
    layer: layerMap.layerText.id,
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

  player.createAction(actorMap.page03ActorWordCloud, {
    name: 'page03ActorWordCloud',
    pageList: [pageMap.page03.id],
    layer: layerMap.layerText.id,
    transitionActs: [
      {
        transitionType: 'from',
        duration: 1000,
        callback: ({ avatar }) => {
          anime({
            targets: avatar.dom,
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
            targets: avatar.dom,
            opacity: 0,
            duration: 1000,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });
};
