import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type {
  IActConfig,
  DomDivActor,
  ConfigWithPageTransitionFilter,
  Player,
  BaseLayer,
  BaseActor,
  Page
} from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { getPixelNumber, getTransformPointFunc, wait } from '@internal/story-player';

export const pageChart1765Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  const scaleX = 4;
  const scaleY = 4;
  const transformPointFunc = getTransformPointFunc(-450, -180, scaleX, scaleY);
  const getTransitionOut: () => ConfigWithPageTransitionFilter<IActConfig<DomDivActor>> = () => ({
    transitionType: 'to',
    duration: 700,
    callback: ({ avatar }) => {
      const newPoint = transformPointFunc(getPixelNumber(avatar.style.left), getPixelNumber(avatar.style.top));
      const newWidth = getPixelNumber(avatar.style.width) * scaleX + 'px';
      const newHeight = getPixelNumber(avatar.style.height) * scaleY + 'px';
      const wait = Math.random() * 300;
      const duration = 700; //1000 - wait;
      anime
        .timeline({
          duration: 1000
        })
        .add(
          {
            targets: avatar,
            top: newPoint.y + 'px',
            left: newPoint.x + 'px',
            width: newWidth,
            height: newHeight,
            opacity: '0',
            duration,
            easing: 'easeInOutQuad'
          },
          wait
        );
    }
  });

  player.createAction(actorMap.pageChart1765ActorBg1, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '0px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1765ActorBg2, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '540px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1765ActorTitleImage as DomDivActor, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '60px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              100
            );
        }
      },
      getTransitionOut()
    ]
  });

  player.createAction(actorMap.pageChart1765ActorTextZh as DomDivActor, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '370px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              200
            );
        }
      },
      getTransitionOut()
    ]
  });

  player.createAction(actorMap.pageChart1765ActorChartFigure as DomDivActor, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '80px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              300
            );
        }
      },
      getTransitionOut()
    ]
  });

  player.createAction(actorMap.pageChart1765ActorAtom as DomDivActor, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '530px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              100
            );
        }
      },
      getTransitionOut()
    ]
  });

  player.createAction(actorMap.pageChart1765ActorTextEn as DomDivActor, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1644'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '528px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              200
            );
        }
      },
      getTransitionOut()
    ]
  });

  player.createAction(actorMap.pageChart1765ActorChart, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerChart.id,
    timeOffset: 1500,
    transitionActs: [],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 4000,
        callback: async ({ avatar }) => {
          anime({
            targets: avatar.dom,
            opacity: 1,
            duration: 500,
            easing: 'easeInOutQuad'
          });
          await wait(3000);
          anime({
            targets: avatar.dom,
            opacity: 0,
            duration: 500,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });
};
