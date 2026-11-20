import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1856Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1856ActorBg, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1833'].id,
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1856ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1833'].id,
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1856ActorPerson, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1833'].id,
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
                left: '-400px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1856ActorTextZh, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1833'].id,
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1856ActorTextEn, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1833'].id,
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1856ActorTitle, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1833'].id,
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1856ActorChart, {
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

          const monthData: Record<string, any[]> = {
            Jan: [
              { type: 'rail', value: 31.8, month: 'Jan' },
              { type: 'highway', value: 39.2, month: 'Jan' },
              { type: 'civil aviation', value: 24.1, month: 'Jan' }
            ],
            Feb: [
              { type: 'rail', value: 46.4, month: 'Feb' },
              { type: 'highway', value: 38, month: 'Feb' },
              { type: 'civil aviation', value: 22.3, month: 'Feb' }
            ],
            Mar: [
              { type: 'rail', value: 30.3, month: 'Mar' },
              { type: 'highway', value: 30.9, month: 'Mar' },
              { type: 'civil aviation', value: 23.4, month: 'Mar' }
            ],
            Apr: [
              { type: 'rail', value: 60.8, month: 'Apr' },
              { type: 'highway', value: 26.8, month: 'Apr' },
              { type: 'civil aviation', value: 24.5, month: 'Apr' }
            ],
            May: [
              { type: 'rail', value: 31.7, month: 'May' },
              { type: 'highway', value: 26.4, month: 'May' },
              { type: 'civil aviation', value: 27, month: 'May' }
            ],
            Jun: [
              { type: 'rail', value: 38.7, month: 'Jun' },
              { type: 'highway', value: 36.7, month: 'Jun' },
              { type: 'civil aviation', value: 33.4, month: 'Jun' }
            ],
            Jul: [
              { type: 'rail', value: 25.3, month: 'Jul' },
              { type: 'highway', value: 34.7, month: 'Jul' },
              { type: 'civil aviation', value: 28.2, month: 'Jul' }
            ],
            Aug: [
              { type: 'rail', value: 45.3, month: 'Aug' },
              { type: 'highway', value: 25.3, month: 'Aug' },
              { type: 'civil aviation', value: 30.8, month: 'Aug' }
            ],
            Sep: [
              { type: 'rail', value: 26.8, month: 'Sep' },
              { type: 'highway', value: 29.4, month: 'Sep' },
              { type: 'civil aviation', value: 20.9, month: 'Sep' }
            ],
            Oct: [
              { type: 'rail', value: 39.8, month: 'Oct' },
              { type: 'highway', value: 38.5, month: 'Oct' },
              { type: 'civil aviation', value: 39, month: 'Oct' }
            ],
            Nov: [
              { type: 'rail', value: 38.3, month: 'Nov' },
              { type: 'highway', value: 23.8, month: 'Nov' },
              { type: 'civil aviation', value: 29.4, month: 'Nov' }
            ],
            Dec: [
              { type: 'rail', value: 62.8, month: 'Dec' },
              { type: 'highway', value: 35.8, month: 'Dec' },
              { type: 'civil aviation', value: 35.2, month: 'Dec' }
            ]
          };
          let curIndex = 0;
          const month = Object.keys(monthData);
          const data = monthData[month[curIndex]];
          const spec = {
            type: 'rose',
            data: [
              {
                id: 'id0',
                values: data,
                fields: {
                  month: {
                    lockStatisticsByDomain: true,
                    domain: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  }
                }
              }
            ],
            color: ['#595959', '#94786A', '#709394'],
            padding: 5,
            radius: 0.7,
            innerRadius: 0,
            categoryField: 'month',
            valueField: 'value',
            seriesField: 'type',
            stack: true,
            rose: {
              style: {
                stroke: 'white',
                lineWidth: 1
              }
            },
            animationAppear: {
              rose: {
                duration: 500,
                easing: 'easeOut'
              }
            },
            animationEnter: {
              rose: {
                type: 'growRadiusIn',
                options: { overall: true },
                duration: 500,
                easing: 'easeOut'
              }
            },
            legends: {
              visible: false,
              orient: 'top',
              interactive: false
            },
            axes: [
              {
                orient: 'radius',
                visible: true,
                tick: { tickCount: 3 },
                grid: { visible: true, style: { lineDash: [0] } },
                max: 150
              },
              {
                orient: 'angle',
                visible: true,
                domainLine: { visible: true, smooth: false },
                grid: { visible: true, smooth: false },
                label: {
                  visible: true,
                  style: {
                    fill: '#000'
                  }
                }
              }
            ]
          };

          avatar.vchart.updateSpec(spec).then(() => {
            const updateChart = () => {
              curIndex++;
              const newData = monthData[month[curIndex]];
              data.push(...newData);
              avatar.vchart.updateData('id0', data);
            };
            for (let i = 1; i < month.length; i++) {
              // eslint-disable-next-line no-loop-func
              setTimeout(updateChart, i * 200);
            }
          });

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
