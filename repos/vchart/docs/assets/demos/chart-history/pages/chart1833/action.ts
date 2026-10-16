import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1833Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1833ActorBg, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1801'].id,
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
                top: '0px',
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
                easing: 'easeInOutQuad'
              },
              500
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1833ActorImage1, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1801'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 800,
                bottom: '0px',
                left: '490px',
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1833ActorImage2, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1801'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 800,
                top: '460px',
                left: '933px',
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1833ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1801'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 800,
                top: '170px',
                left: '750px',
                easing: 'easeInOutQuad'
              },
              100
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

  player.createAction(actorMap.pageChart1833ActorTitle, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1801'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 800,
                opacity: '1',
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1833ActorText, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1801'].id,
        duration: 1000,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 800,
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
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1833ActorChart, {
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

          const yearData: any = {};
          const firstYear = 1950;
          const lastYear = 1960;

          for (let year = firstYear; year <= lastYear; year++) {
            const data: any[] = [];
            yearData[year] = data;

            for (let i = 0; i < 50; i++) {
              if (year === firstYear) {
                data.push({
                  x: Math.round(Math.random() * 100 - 90),
                  y: Math.round(Math.random() * 100 - 90),
                  value: Math.round(Math.random() * 1000),
                  index: i
                });
              } else {
                const previous = yearData[year - 1][i];
                data.push({
                  x: previous.x + Math.round(Math.random() * 5 - 2 + i / 50),
                  y: previous.y + Math.round(Math.random() * 5 - 2 + i / 50),
                  value: Math.abs(previous.value + Math.round(Math.random() * 100 - 45)),
                  index: i
                });
              }
            }
          }

          const specs = Object.values(yearData).map((data, index) => {
            return {
              data: [
                {
                  id: 'id',
                  values: data
                },
                {
                  id: 'year',
                  values: [{ year: Object.keys(yearData)[index] }]
                }
              ]
            };
          });

          const DURATION = 300;

          // 配置项
          const spec = {
            type: 'common',
            player: {
              orient: 'bottom',
              padding: 0,
              auto: true,
              interval: DURATION,
              dy: 10,
              specs,
              slider: {
                space: 10,
                trackStyle: {
                  fill: '#888888'
                },
                railStyle: {
                  fill: '#cccccc'
                },
                handlerStyle: {
                  size: 15,
                  stroke: '#FFFFFF',
                  lineWidth: 2,
                  fill: '#888888'
                }
              },
              controller: {
                start: {
                  order: 0,
                  space: 0,
                  style: {
                    size: 25,
                    fill: '#cccccc'
                  }
                },
                pause: {
                  order: 0,
                  space: 0,
                  style: {
                    size: 25,
                    fill: '#cccccc'
                  }
                },
                backward: {
                  order: 0,
                  space: 10,
                  position: 'start',
                  style: {
                    size: 12,
                    fill: '#cccccc'
                  }
                },
                forward: {
                  order: 0,
                  space: 10,
                  position: 'end',
                  style: {
                    size: 12,
                    fill: '#cccccc'
                  }
                }
              }
            },
            data: specs[0].data,
            axes: [
              {
                orient: 'left',
                nice: true,
                zero: false,
                type: 'linear',
                range: { min: -100, max: 100 },
                tick: {
                  tickCount: 10
                },
                grid: {
                  visible: true,
                  style: {
                    lineDash: [0]
                  }
                }
              },
              {
                orient: 'bottom',
                nice: true,
                label: { visible: true },
                type: 'linear',
                range: { min: -100, max: 100 },
                tick: {
                  tickCount: 10
                },
                grid: {
                  visible: true,
                  style: {
                    lineDash: [0]
                  }
                }
              }
            ],
            series: [
              {
                type: 'scatter',
                // 通过数据中的 index 进行数据匹配
                dataKey: 'index',
                // 声明点半径大小
                sizeField: 'value',
                size: {
                  type: 'linear',
                  range: [2, 10]
                },
                xField: 'x',
                yField: 'y',
                point: {
                  style: {
                    fill: '#000000',
                    fillOpacity: 0.6
                  }
                },
                animationAppear: {
                  duration: DURATION,
                  easing: 'linear'
                },
                animationUpdate: {
                  duration: DURATION,
                  easing: 'linear'
                }
              }
            ]
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
