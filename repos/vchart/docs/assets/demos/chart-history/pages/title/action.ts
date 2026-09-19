import anime from '../../lib/anime.es.js';
import type { IText } from '@visactor/vrender';
import { InputText } from '@visactor/vrender';
import type {
  BaseActor,
  BaseLayer,
  IActConfig,
  Page,
  PageTransitionActList,
  Player,
  VChartActor
} from '@internal/story-player';
import { chartMap } from './actor/chart';

export const pageTitleAction = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.actorBgMask, {
    name: 'bgMask',
    layer: layerMap.layerBgMask.id
  });

  player.createAction(actorMap.pageTitleActorBg, {
    name: 'bg',
    pageList: [pageMap.pageTitle.id, pageMap.pageTimeline.id, pageMap['1486'].id],
    layer: layerMap.layerBg2.id
  });

  player.createAction(actorMap.actorFooter, {
    name: 'footer',
    pageList: [pageMap.pageTitle.id, pageMap.pageTimeline.id],
    layer: layerMap.layerBgMask.id,
    transitionActs: [
      {
        transitionType: 'to',
        toPage: pageMap['1486'].id,
        duration: 500,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 200,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  const actionTitleLine1 = player.createAction(actorMap.pageTitleActorTitle1, {
    pageList: [pageMap.pageTitle.id, pageMap.pageTimeline.id],
    layer: layerMap.layerVRender.id,
    timeOffset: 2000,
    acts: [
      {
        page: pageMap.pageTitle.id,
        duration: 1000,
        callback: ({ avatar }) => {
          avatar.animate().play(new InputText({ text: '' }, { text: 'A BRIEF HISTORY' }, 1000, 'quadIn'));
        }
      }
    ],
    transitionActs: [
      {
        transitionType: 'to',
        toPage: pageMap.pageTimeline.id,
        duration: 800,
        callback: ({ avatar }) => {
          (avatar as IText).animate().to(
            {
              x: 370,
              y: 110,
              fontSize: 60
            },
            800,
            'quadInOut'
          );
        }
      },
      {
        transitionType: 'to',
        toPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          (avatar as IText).animate().to(
            {
              x: -1100,
              y: 110
            },
            700,
            'quadInOut'
          );
        }
      }
    ]
  });

  const actionTitleLine2 = player.createAction(actorMap.pageTitleActorTitle2, {
    pageList: [pageMap.pageTitle.id, pageMap.pageTimeline.id],
    layer: layerMap.layerVRender.id,
    lastAction: actionTitleLine1.id,
    acts: [
      {
        page: pageMap.pageTitle.id,
        duration: 1000,
        callback: ({ avatar }) => {
          avatar.animate().play(new InputText({ text: '' }, { text: 'OF CHARTS' }, 1000, 'quadIn'));
        }
      }
    ],
    transitionActs: [
      {
        transitionType: 'to',
        toPage: pageMap.pageTimeline.id,
        duration: 800,
        callback: ({ avatar }) => {
          (avatar as IText).animate().to(
            {
              x: 825,
              y: 110,
              fontSize: 60
            },
            800,
            'quadInOut'
          );
        }
      },
      {
        transitionType: 'to',
        toPage: pageMap['1486'].id,
        duration: 700,
        callback: ({ avatar }) => {
          (avatar as IText).animate().to(
            {
              x: -645,
              y: 110
            },
            700,
            'quadInOut'
          );
        }
      }
    ]
  });

  player.createAction(actorMap.pageTitleActorSubTitle, {
    pageList: [pageMap.pageTitle.id],
    layer: layerMap.layerDom.id,
    lastAction: actionTitleLine2.id,
    timeOffset: 500,
    transitionActs: [
      {
        transitionType: 'to',
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 0,
            duration: 700
          });
        }
      }
    ],
    acts: [
      {
        page: pageMap.pageTitle.id,
        duration: 3000,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: 1,
            duration: 3000
          });
        }
      }
    ]
  });

  const chartTransformList: PageTransitionActList = [
    {
      transitionType: 'to',
      duration: 1000,
      callback: ({ avatar }) => {
        anime({
          targets: avatar.dom,
          opacity: 0,
          duration: 1000
        });
      }
    }
  ];

  const topChartAct: IActConfig<VChartActor> = {
    duration: 3700,
    callback: ({ avatar }) => {
      anime
        .timeline({
          duration: 3700
        })
        .add({
          targets: avatar.dom,
          opacity: 1
        })
        .add(
          {
            targets: avatar.dom,
            top: '35px'
          },
          3200
        )
        .add(
          {
            targets: avatar.dom,
            top: '50px'
          },
          3700
        );
    }
  };

  const bottomChartAct: IActConfig<VChartActor> = {
    duration: 3700,
    callback: ({ avatar }) => {
      anime
        .timeline({
          duration: 3700
        })
        .add({
          targets: avatar.dom,
          opacity: 1
        })
        .add(
          {
            targets: avatar.dom,
            top: '555px'
          },
          3200
        )
        .add(
          {
            targets: avatar.dom,
            top: '570px'
          },
          3700
        );
    }
  };

  chartMap.forEach((_, i) => {
    const actorChart = actorMap[`pageTitleActorChart${i}`] as VChartActor;
    const offsetTimes = i < 5 ? i : 9 - i;
    player.createAction(actorChart, {
      pageList: [pageMap.pageTitle.id],
      layer: layerMap.layerTopChart.id,
      timeOffset: 1000 + offsetTimes * 200,
      acts: [
        {
          page: pageMap.pageTitle.id,
          ...(i < 5 ? topChartAct : bottomChartAct)
        }
      ],
      transitionActs: chartTransformList
    });
  });
};
