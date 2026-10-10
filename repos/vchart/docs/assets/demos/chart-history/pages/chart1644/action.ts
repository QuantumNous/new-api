import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1644Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1644ActorBgDecoration, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '300px',
            duration: 1000,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorLineLong, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '0px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorBlocks, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '465px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorTitleDecoration, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '120px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorTitle, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '160px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorName, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '235px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 1,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                width: '520px',
                top: '10px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              300
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorTextZh, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '445px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '455px',
                left: '400px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              300
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorTextEn, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
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
              200
            );
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorLineShort, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '462px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '472px',
                left: '380px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              300
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorGreenBlock, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '170px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              100
            );
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorMiddleBlock, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '315px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              200
            );
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorColorBlock, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                left: '980px',
                duration: 700,
                easing: 'easeInOutQuad'
              },
              300
            );
        }
      },
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1644ActorChart, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerChart.id,
    timeOffset: 1500,
    transitionActs: [],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 4000,
        callback: async ({ avatar }) => {
          const getCurve = (x: number) => {
            return 0.0694 * x * x - 9.3056 * x + 321.1111; // 回归方程
          };
          anime({
            targets: avatar.dom,
            opacity: 1,
            duration: 1500,
            easing: 'easeInOutQuad'
          });
          await wait(1000);
          anime({
            targets: avatar.dom,
            backgroundColor: '#ffffff',
            duration: 500,
            easing: 'easeInOutQuad'
          });
          await wait(1000);
          await avatar.vchart.updateData('data', [
            { x: 104, y: getCurve(104), type: 'A' },
            { x: 98, y: getCurve(98), type: 'A' },
            { x: 93, y: getCurve(93), type: 'A' },
            { x: 90, y: getCurve(90), type: 'A' },
            { x: 76, y: getCurve(76), type: 'A' },
            { x: 70, y: getCurve(70), type: 'A' },
            { x: 63, y: getCurve(63), type: 'A' }
          ]);
          await wait(1500);
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
