import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1801Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1801ActorBg, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: []
  });

  player.createAction(actorMap.pageChart1801ActorBgTop, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              0
            )
            .add(
              {
                targets: avatar,
                duration: 500,
                left: '0px',
                width: '1280px',
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorBgBottom, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              0
            )
            .add(
              {
                targets: avatar,
                duration: 500,
                left: '0px',
                width: '1280px',
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorTitle, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              200
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                top: '-200px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                top: '160px',
                easing: 'easeInOutQuad'
              },
              300
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                top: '-200px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorTextEn, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                top: '160px',
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                top: '-200px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorTextZh, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                left: '150px',
                easing: 'easeInOutQuad'
              },
              400
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                top: '-200px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorPie, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786-2'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '1',
                //rotate: '1turn',
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      },
      {
        transitionType: 'to',
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 500,
                opacity: '0',
                top: '-200px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1801ActorChart, {
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

          const spec: any = {
            type: 'common',
            background: 'transparent',
            data: [
              {
                id: 'id0',
                values: [
                  { type: '0~29', value: '126.04' },
                  { type: '30~59', value: '128.77' },
                  { type: '60 and over', value: '77.09' }
                ]
              },
              {
                id: 'id1',
                values: [
                  { type: '0~9', value: '39.12' },
                  { type: '10~19', value: '43.01' },
                  { type: '20~29', value: '43.91' },
                  { type: '30~39', value: '45.4' },
                  { type: '40~49', value: '40.89' },
                  { type: '50~59', value: '42.48' },
                  { type: '60~69', value: '39.63' },
                  { type: '70~79', value: '25.17' },
                  { type: '80 and over', value: '12.29' }
                ]
              }
            ],
            series: [
              {
                type: 'pie',
                dataIndex: 0,
                outerRadius: 0.65,
                innerRadius: 0,
                valueField: 'value',
                categoryField: 'type',
                label: {
                  position: 'inside',
                  visible: true,
                  style: {
                    fill: 'white'
                  }
                },
                pie: {
                  style: {
                    stroke: '#DED5C9',
                    lineWidth: 2
                  }
                }
              },
              {
                type: 'pie',
                dataIndex: 1,
                outerRadius: 0.8,
                innerRadius: 0.67,
                valueField: 'value',
                categoryField: 'type',
                label: {
                  visible: true
                },
                pie: {
                  style: {
                    stroke: '#DED5C9',
                    lineWidth: 2
                  }
                }
              }
            ],
            color: ['#56826C', '#BF6970', '#CDA871', '#B4948F', '#a05d56', '#CC6691', '#EBA4C2']
          };
          avatar.vchart.updateSpec(spec);
          await wait(3000);
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
