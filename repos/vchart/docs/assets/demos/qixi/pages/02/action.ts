import { type BaseActor, type BaseLayer, type Page, type Player } from '@internal/story-player';
import { OriginalData } from '../../data/interface';
import anime from '../../lib/anime.es';
import { page02EventDuration, page02TitleDuration } from '../constant';

export const page02Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>,
  data: OriginalData
) => {
  const { page02 } = data;

  player.createAction(actorMap.page02ActorTitle, {
    name: 'page02ActorTitle',
    pageList: [pageMap.page02.id],
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
      }
    ],
    acts: [
      {
        duration: page02TitleDuration,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: page02TitleDuration
            })
            .add(
              {
                targets: avatar,
                opacity: 0,
                easing: 'easeInOutQuad',
                duration: 1000
              },
              page02TitleDuration - 1000
            );
        }
      }
    ]
  });

  const dates = Object.keys(page02);

  dates.forEach((date, i) => {
    const name = `page02ActorPhoto_${date}`;
    player.createAction(actorMap[name], {
      name,
      pageList: [pageMap.page02.id],
      layer: layerMap.layerChart.id,
      timeOffset: page02TitleDuration + i * page02EventDuration,
      acts: [
        {
          duration: page02EventDuration,
          callback: ({ avatar }) => {
            anime
              .timeline({
                duration: page02EventDuration
              })
              .add(
                {
                  targets: avatar,
                  opacity: 1,
                  easing: 'easeInOutQuad',
                  duration: 500
                },
                0
              )
              .add(
                {
                  targets: avatar,
                  easing: 'easeInOutQuad',
                  top: '50px',
                  rotate: (Math.random() - 0.5) * 5,
                  duration: 1000
                },
                0
              );
          }
        }
      ],
      transitionActs: [
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
  });

  player.createAction(actorMap.page02ActorBar, {
    name: 'page02ActorBar',
    pageList: [pageMap.page02.id],
    layer: layerMap.layerChart.id,
    timeOffset: page02TitleDuration,
    acts: [
      {
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar.dom,
                opacity: 1,
                easing: 'easeInOutQuad',
                duration: 1000
              },
              0
            );
        }
      }
    ],
    transitionActs: [
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
