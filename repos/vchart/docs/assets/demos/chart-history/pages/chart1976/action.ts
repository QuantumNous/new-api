import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1976Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1976ActorBg, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1877'].id,
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

  player.createAction(actorMap.pageChart1976ActorChartFigure, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1877'].id,
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
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              200 + 300 * Math.random()
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
                opacity: '0',
                left: '826px',
                top: '413px',
                width: '2px',
                height: '2px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1976ActorTextZh, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1877'].id,
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
                bottom: '78px',
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              200 + 300 * Math.random()
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
                opacity: '0',
                left: '826px',
                top: '413px',
                width: '2px',
                height: '2px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1976ActorTextEn, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1877'].id,
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
                bottom: '230px',
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              200 + 300 * Math.random()
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
                opacity: '0',
                left: '826px',
                top: '413px',
                width: '2px',
                height: '2px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1976ActorTitle, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1877'].id,
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
                top: '140px',
                opacity: '1',
                easing: 'easeInOutQuad'
              },
              200 + 300 * Math.random()
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
                opacity: '0',
                left: '826px',
                top: '413px',
                width: '2px',
                height: '2px',
                easing: 'easeInOutQuad'
              },
              0
            );
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1976ActorChart, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerChart.id,
    timeOffset: 1000,
    transitionActs: [],
    acts: [
      {
        page: pageMap[pageKey].id,
        duration: 4500,
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
              mockData.push({
                month: i + '月',
                value: Math.random() * 100 + 10,
                type
              });
            }
          });

          const spec = {
            background: 'transparent',
            type: 'wordCloud3d',
            // 待申请新外网可访问的存储空间后更换
            maskShape: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/log.jpeg',
            nameField: 'challenge_name',
            valueField: 'sum_count',
            seriesField: 'challenge_name',
            padding: 0,
            data: [
              {
                name: 'data',
                values: [
                  {
                    challenge_name: '刘浩存',
                    sum_count: 957
                  },
                  {
                    challenge_name: '刘昊然',
                    sum_count: 942
                  },
                  {
                    challenge_name: '喜欢',
                    sum_count: 842
                  },
                  {
                    challenge_name: '真的',
                    sum_count: 828
                  },
                  {
                    challenge_name: '四海',
                    sum_count: 665
                  },
                  {
                    challenge_name: '好看',
                    sum_count: 627
                  },
                  {
                    challenge_name: '评论',
                    sum_count: 574
                  },
                  {
                    challenge_name: '好像',
                    sum_count: 564
                  },
                  {
                    challenge_name: '沈腾',
                    sum_count: 554
                  },
                  {
                    challenge_name: '不像',
                    sum_count: 540
                  },
                  {
                    challenge_name: '多少钱',
                    sum_count: 513
                  },
                  {
                    challenge_name: '韩寒',
                    sum_count: 513
                  },
                  {
                    challenge_name: '不知道',
                    sum_count: 499
                  },
                  {
                    challenge_name: '感觉',
                    sum_count: 499
                  },
                  {
                    challenge_name: '尹正',
                    sum_count: 495
                  },
                  {
                    challenge_name: '不看',
                    sum_count: 487
                  },
                  {
                    challenge_name: '奥特之父',
                    sum_count: 484
                  },
                  {
                    challenge_name: '阿姨',
                    sum_count: 482
                  },
                  {
                    challenge_name: '支持',
                    sum_count: 482
                  },
                  {
                    challenge_name: '父母',
                    sum_count: 479
                  },
                  {
                    challenge_name: '一条',
                    sum_count: 462
                  },
                  {
                    challenge_name: '女主',
                    sum_count: 456
                  },
                  {
                    challenge_name: '确实',
                    sum_count: 456
                  },
                  {
                    challenge_name: '票房',
                    sum_count: 456
                  },
                  {
                    challenge_name: '无语',
                    sum_count: 443
                  },
                  {
                    challenge_name: '干干净净',
                    sum_count: 443
                  },
                  {
                    challenge_name: '为啥',
                    sum_count: 426
                  },
                  {
                    challenge_name: '爱情',
                    sum_count: 425
                  },
                  {
                    challenge_name: '喜剧',
                    sum_count: 422
                  },
                  {
                    challenge_name: '春节',
                    sum_count: 414
                  },
                  {
                    challenge_name: '剧情',
                    sum_count: 414
                  },
                  {
                    challenge_name: '人生',
                    sum_count: 409
                  },
                  {
                    challenge_name: '风格',
                    sum_count: 408
                  },
                  {
                    challenge_name: '演员',
                    sum_count: 403
                  },
                  {
                    challenge_name: '成长',
                    sum_count: 403
                  },
                  {
                    challenge_name: '玩意',
                    sum_count: 402
                  },
                  {
                    challenge_name: '文学',
                    sum_count: 397
                  }
                ]
              }
            ],
            word: {
              style: {
                keepDirIn3d: false
              }
            },
            fillingWord: {
              style: {
                keepDirIn3d: false
              }
            },
            depth_3d: 200,
            colorList: ['#325AB4'],
            wordCloudShapeConfig: {
              fillingColorList: ['#5BB5BF', '#92C8C6']
            }
          };

          avatar.vchart.updateSpec(spec);
          await wait(3500);
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
