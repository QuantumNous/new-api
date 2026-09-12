import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1877Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1877ActorBg, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1856'].id,
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
                duration: 700,
                opacity: '0',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1877ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1856'].id,
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
                top: '720px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1877ActorPerson, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1856'].id,
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
                left: '750px',
                easing: 'easeInOutQuad'
              },
              0
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
                top: '720px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1877ActorTextZh, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1856'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 300,
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              700
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
                top: '720px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1877ActorTextEn, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1856'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 300,
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              700
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
                top: '720px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1877ActorTitle, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1856'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 300,
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              700
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
                top: '720px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1877ActorChart, {
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

          const mockData: any[] = [];
          const types = ['A', 'B'];

          types.forEach(type => {
            for (let i = 1; i <= 12; i++) {
              mockData.push({ month: i + '月', value: Math.random() * 100 + 10, type });
            }
          });

          const spec = {
            type: 'radar',
            background: 'transparent',
            data: [
              {
                values: mockData
              }
            ],
            categoryField: 'month',
            valueField: 'value',
            seriesField: 'type', // 声明分组字段,
            outerRadius: 0.8,
            color: ['#27711B', '#A64260'],
            area: {
              visible: true
            },
            line: {
              style: {
                lineWidth: 1
              }
            },
            axes: [
              {
                orient: 'radius', // 半径轴配置
                grid: {
                  smooth: true, // 平滑的网格线
                  style: {
                    lineDash: [0]
                  },
                  alternateColor: 'rgba(255, 255, 255, 0.2)' // 配置栅格线间的背景色
                }
              },
              {
                orient: 'angle', // 角度轴配置
                tick: {
                  visible: false
                },
                domainLine: {
                  visible: true,
                  style: {
                    stroke: '#333'
                  }
                },
                grid: {
                  style: {
                    lineDash: [0]
                  }
                },
                label: {
                  style: {
                    fill: '#ffffff'
                  }
                }
              }
            ],
            legends: {
              visible: false,
              orient: 'top'
            }
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
