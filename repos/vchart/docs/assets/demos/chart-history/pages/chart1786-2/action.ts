import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1786_2Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1786_2ActorBg1, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786'].id,
        duration: 500,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            duration: 500,
            left: '0px',
            easing: 'easeInOutQuad'
          });
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

  player.createAction(actorMap.pageChart1786_2ActorBg2, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786'].id,
        duration: 500,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            duration: 500,
            left: '1202px',
            easing: 'easeInOutQuad'
          });
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

  player.createAction(actorMap.pageChart1786_2ActorMainImage, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786'].id,
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

  player.createAction(actorMap.pageChart1786_2ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786'].id,
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
                top: '190px',
                opacity: '1',
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
                duration: 1000,
                top: '-500px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1786_2ActorText, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1786'].id,
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
                top: '270px',
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

  player.createAction(actorMap.pageChart1786_2ActorChart, {
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

          const spec = {
            type: 'common',
            data: [
              {
                id: 'areaData',
                values: [
                  { year: 1700, exports: 35, imports: 70 },
                  { year: 1710, exports: 59, imports: 81 },
                  { year: 1720, exports: 76, imports: 96 },
                  { year: 1730, exports: 65, imports: 97 },
                  { year: 1740, exports: 67, imports: 93 },
                  { year: 1750, exports: 79, imports: 90 },
                  { year: 1753, exports: 87, imports: 87 },
                  { year: 1760, exports: 115, imports: 79 },
                  { year: 1770, exports: 163, imports: 85 },
                  { year: 1780, exports: 185, imports: 93 }
                ]
              }
            ],
            series: [
              {
                type: 'rangeArea',
                xField: 'year',
                yField: ['exports', 'imports'],
                area: {
                  style: {
                    curveType: 'monotone',
                    fill: (data: any) => {
                      if (data.year <= 1755) {
                        return '#F5222D';
                      }
                      return '#FAAD14';
                    }
                  }
                }
              },
              {
                type: 'line',
                xField: 'year',
                yField: 'exports',
                point: {
                  style: {
                    size: 0
                  }
                },
                line: {
                  style: {
                    curveType: 'monotone',
                    stroke: '#F5222D',
                    lineWidth: 3
                  }
                }
              },
              {
                type: 'line',
                xField: 'year',
                yField: 'imports',
                point: {
                  style: {
                    size: 0
                  }
                },
                line: {
                  style: {
                    curveType: 'monotone',
                    stroke: '#FAAD14',
                    lineWidth: 3
                  }
                }
              }
            ],
            markPoint: [
              {
                coordinate: {
                  year: 1730
                },
                itemContent: {
                  offsetY: -180,
                  type: 'text',
                  autoRotate: false,
                  text: {
                    text: 'BALANCE AGAINST',
                    style: {
                      fontSize: 14,
                      fontWeight: 'bold',
                      fill: 'rgba(0,0,0,0.45)',
                      textAlign: 'center',
                      textBaseline: 'middle'
                    }
                  }
                },
                itemLine: {
                  visible: false
                }
              },
              {
                coordinate: {
                  year: 1765
                },
                itemContent: {
                  offsetY: -240,
                  offsetX: -40,
                  type: 'text',
                  autoRotate: false,
                  text: {
                    text: ['BALANCE in', 'FAVOUR of ENGLAND'],
                    style: {
                      fontSize: 14,
                      fontWeight: 'bold',
                      fill: 'rgba(0,0,0,0.45)',
                      textAlign: 'left',
                      textBaseline: 'middle'
                    }
                  }
                },
                itemLine: {
                  visible: false
                }
              }
            ],
            axes: [
              {
                orient: 'right',
                label: {
                  visible: true,
                  style: {
                    fontSize: 12
                  }
                },
                type: 'linear'
              },
              { orient: 'bottom', type: 'linear', min: '1700', max: '1780' }
            ],
            crosshair: {
              xField: {
                line: {
                  type: 'line'
                },
                label: {
                  visible: true
                }
              }
            }
          };
          /*
          {
            type: 'area',
            data: {
              values: [
                { type: 'Nail polish', country: 'Africa', value: 4229 },
                { type: 'Nail polish', country: 'EU', value: 4376 },
                { type: 'Nail polish', country: 'China', value: 3054 },
                { type: 'Nail polish', country: 'USA', value: 12814 },
                { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
                { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
                { type: 'Eyebrow pencil', country: 'China', value: 5067 },
                { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
                { type: 'Rouge', country: 'Africa', value: 5221 },
                { type: 'Rouge', country: 'EU', value: 3574 },
                { type: 'Rouge', country: 'China', value: 7004 },
                { type: 'Rouge', country: 'USA', value: 11624 },
                { type: 'Lipstick', country: 'Africa', value: 9256 },
                { type: 'Lipstick', country: 'EU', value: 4376 },
                { type: 'Lipstick', country: 'China', value: 9054 },
                { type: 'Lipstick', country: 'USA', value: 8814 },
                { type: 'Eyeshadows', country: 'Africa', value: 3308 },
                { type: 'Eyeshadows', country: 'EU', value: 4572 },
                { type: 'Eyeshadows', country: 'China', value: 12043 },
                { type: 'Eyeshadows', country: 'USA', value: 12998 },
                { type: 'Eyeliner', country: 'Africa', value: 5432 },
                { type: 'Eyeliner', country: 'EU', value: 3417 },
                { type: 'Eyeliner', country: 'China', value: 15067 },
                { type: 'Eyeliner', country: 'USA', value: 12321 },
                { type: 'Foundation', country: 'Africa', value: 13701 },
                { type: 'Foundation', country: 'EU', value: 5231 },
                { type: 'Foundation', country: 'China', value: 10119 },
                { type: 'Foundation', country: 'USA', value: 10342 },
                { type: 'Lip gloss', country: 'Africa', value: 4008 },
                { type: 'Lip gloss', country: 'EU', value: 4572 },
                { type: 'Lip gloss', country: 'China', value: 12043 },
                { type: 'Lip gloss', country: 'USA', value: 22998 },
                { type: 'Mascara', country: 'Africa', value: 18712 },
                { type: 'Mascara', country: 'EU', value: 6134 },
                { type: 'Mascara', country: 'China', value: 10419 },
                { type: 'Mascara', country: 'USA', value: 11261 },
              ],
            },
            stack: false,
            xField: 'type',
            yField: 'value',
            seriesField: 'country',
            legends: [{ visible: true, position: 'middle', orient: 'bottom', padding: 10 }],
          };
          */
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
