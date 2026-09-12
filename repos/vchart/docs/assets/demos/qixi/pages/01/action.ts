import { wait, type BaseActor, type BaseLayer, type Page, type Player } from '@internal/story-player';
import { OriginalData } from '../../data/interface';
import anime from '../../lib/anime.es';
import { getPage01YearMap } from '../../data/01/util';
import { isValid } from '@visactor/vutils';
import { Page01OriginalData } from '../../data/01/interface';
import { getBarData } from '../../spec/01/bar';
import { page01YearDuration } from '../constant';

export const page01Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>,
  data: OriginalData
) => {
  player.createAction(actorMap.actorBg, {
    name: 'bg',
    pageList: [pageMap.page01.id, pageMap.page02.id, pageMap.page03.id],
    layer: layerMap.layerBg2.id
  });
  player.createAction(actorMap.actorBgMask, {
    name: 'bgMask',
    pageList: [pageMap.page01.id, pageMap.page02.id],
    layer: layerMap.layerBgMask.id,
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

  const { page01 } = data;
  const map = getPage01YearMap(page01);
  const years = Object.keys(map);

  years.forEach((year, i) => {
    (['boy', 'girl'] as (keyof Page01OriginalData)[]).forEach(sex => {
      const datum = map[year as any][sex];
      if (!isValid(datum)) {
        return;
      }
      const name = `page01ActorPhoto_${sex}_${year}`;
      player.createAction(actorMap[name], {
        name,
        pageList: [pageMap.page01.id],
        layer: layerMap.layerDom.id,
        timeOffset: i * page01YearDuration,
        acts: [
          {
            duration: page01YearDuration,
            callback: ({ avatar }) => {
              anime
                .timeline({
                  duration: page01YearDuration
                })
                .add(
                  {
                    targets: avatar.dom,
                    opacity: 1,
                    easing: 'easeInOutQuad',
                    duration: 500
                  },
                  0
                )
                .add(
                  {
                    targets: avatar.dom,
                    easing: 'easeInOutQuad',
                    ...(sex === 'girl' ? { top: '50px' } : { bottom: '50px' }),
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
  });

  player.createAction(actorMap.page01ActorBar, {
    name: 'page01ActorBar',
    pageList: [pageMap.page01.id],
    layer: layerMap.layerDom.id,
    acts: [
      {
        duration: page01YearDuration * years.length,
        callback: async ({ avatar }) => {
          const { vchart } = avatar;
          for (const year of years) {
            const data = getBarData(map[year as any]);
            vchart.updateFullData(data);
            await wait(page01YearDuration);
          }
        }
      }
    ],
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
