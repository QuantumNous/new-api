import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1486Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1486ActorBg, {
    pageList: [pageMap[pageKey].id, pageMap['1644'].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 500,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            left: '180px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'from',
        fromPage: pageMap[pageKey].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            left: '0px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorBgDecoration, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            left: '320px',
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

  player.createAction(actorMap.pageChart1486ActorTitleImage, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            left: '200px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      },
      {
        transitionType: 'to',
        toPage: pageMap['1644'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            top: '720px',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorTextZh, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '-150px',
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

  player.createAction(actorMap.pageChart1486ActorChartFigure1, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '260px',
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
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1500,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1500
            })
            .add(
              {
                targets: avatar,
                width: '133px',
                duration: 1000,
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorChartFigure2, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '260px',
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
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1500,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1500
            })
            .add(
              {
                targets: avatar,
                width: '133px',
                left: '788px',
                duration: 1000,
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorChartFigure3, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '417px',
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
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1500,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1500
            })
            .add(
              {
                targets: avatar,
                width: '133px',
                duration: 1000,
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorChartFigure4, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '417px',
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
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1500,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1500
            })
            .add(
              {
                targets: avatar,
                width: '133px',
                left: '788px',
                duration: 1000,
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorChartFigure5, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: async ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '260px',
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
    ],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 1500,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1500
            })
            .add(
              {
                targets: avatar,
                width: '233px',
                left: '936px',
                duration: 1000,
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1486ActorTextEn, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap.pageTimeline.id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                top: '250px',
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

  player.createAction(actorMap.pageChart1486ActorChart, {
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
            duration: 1500,
            easing: 'easeInOutQuad'
          });
          await wait(2000);
          await avatar.vchart.updateData('data', [
            { x: '1', y: 75, type: 'A' },
            { x: '2', y: 75, type: 'A' },
            { x: '3', y: 75, type: 'A' },
            { x: '4', y: 75, type: 'A' },
            { x: '1', y: 50, type: 'B' },
            { x: '2', y: 50, type: 'B' },
            { x: '3', y: 50, type: 'B' },
            { x: '4', y: 50, type: 'B' }
          ]);
          await wait(500);
          await avatar.vchart.updateData('data', [
            { x: '1', y: 50, type: 'A' },
            { x: '2', y: 50, type: 'A' },
            { x: '3', y: 50, type: 'A' },
            { x: '4', y: 50, type: 'A' },
            { x: '1', y: 75, type: 'B' },
            { x: '2', y: 75, type: 'B' },
            { x: '3', y: 75, type: 'B' },
            { x: '4', y: 75, type: 'B' }
          ]);
          await wait(500);
          await avatar.vchart.updateData('data', [
            { x: '1', y: 100, type: 'A' },
            { x: '2', y: 100, type: 'A' },
            { x: '3', y: 100, type: 'A' },
            { x: '4', y: 100, type: 'A' },
            { x: '1', y: 100, type: 'B' },
            { x: '2', y: 100, type: 'B' },
            { x: '3', y: 100, type: 'B' },
            { x: '4', y: 100, type: 'B' }
          ]);
          await wait(500);
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
