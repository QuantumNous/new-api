import anime from '../../lib/anime.es.js';
import { pageKey } from './constant';
import type { BaseActor, BaseLayer, Page, Player } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { wait } from '@internal/story-player';

export const pageChart1786Action = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageChart1786ActorBg, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg2.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1765'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: '1',
            duration: 700,
            easing: 'easeInOutQuad'
          });
        }
      }
    ]
  });

  player.createAction(actorMap.pageChart1786ActorBgDecoration, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerBg1.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1765'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime({
            targets: avatar,
            opacity: '1',
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

  player.createAction(actorMap.pageChart1786ActorMainImage, {
    pageList: [pageMap[pageKey].id],
    layer: layerMap.layerDom.id,
    transitionActs: [
      {
        transitionType: 'from',
        fromPage: pageMap['1765'].id,
        duration: 700,
        callback: ({ avatar }) => {
          anime
            .timeline({
              duration: 1000
            })
            .add(
              {
                targets: avatar,
                duration: 700,
                width: '920px',
                height: '500px',
                top: '120px',
                left: '180px',
                opacity: '1',
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

  player.createAction(actorMap.pageChart1786ActorChart, {
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

          const asiaData: Record<
            string,
            {
              max: number;
              min: number;
              country: string;
              continent: string;
              type?: string;
            }[]
          > = {
            1973: [
              {
                max: 239.27,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 22.96,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 7.87,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 17.24,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 10.98,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 23.76,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 4.13,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 5.66,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 2.78,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 114.75,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 107.57,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 55.99,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 36.41,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 33.92,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 9.93,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 23.02,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 22.28,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 14.54,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            1978: [
              {
                max: 278.39,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 29.22,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 13.12,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 22.62,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 15.39,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 30.08,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 6,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 7.48,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 3.9,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 121.14,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 126.03,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 64.08,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 41.42,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 32.36,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 10.8,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 24.65,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 24.97,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 18.16,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            1983: [
              {
                max: 336.52,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 34.79,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 18.48,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 25,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 20.87,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 24.13,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 7.84,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 9.07,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 5.51,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 129.86,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 141.5,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 67.43,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 42.83,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 35,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 13.13,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 26.98,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 26.86,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 20.98,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            1988: [
              {
                max: 427.65,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 45.4,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 30.96,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 33.34,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 26.89,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 25.64,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 11.35,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 8.97,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 6.88,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 158.98,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 166.06,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 80.43,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 49.07,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 39.95,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 15.72,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 31.27,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 30.52,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 24.8,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            1993: [
              {
                max: 488.02,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 56.68,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 45.79,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 41.6,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 37.57,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 34.67,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 17.99,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 10,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 10.72,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 167.18,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 177.75,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 89.63,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 56.32,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 42.74,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 15.04,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 30.95,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 33.35,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 28.05,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            1998: [
              {
                max: 521.74,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 77.27,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 59.6,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 50.56,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 42.88,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 37.31,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 19.93,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 12.09,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 14.07,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 196.37,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 196.13,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 104.8,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 67.57,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 46.09,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 18.94,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 36.51,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 37.79,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 34.83,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            2003: [
              {
                max: 545.92,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 102.5,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 84.42,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 55.06,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 51.46,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 40.5,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 25.62,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 14.62,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 18.21,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 228.64,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 211.73,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 126.72,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 75.95,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 49.45,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 22.26,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 42.29,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 42.16,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 38.32,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            2008: [
              {
                max: 578.41,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 143.18,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 106.28,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 74.66,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 67.94,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 51.34,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 31.95,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 19.14,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 24.1,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 253.56,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 221.5,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 147.39,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 86.71,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 57.96,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 26.27,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 48.92,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 47.72,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 43.33,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            2013: [
              {
                max: 589.42,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 197.84,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 125.32,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 97.51,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 89.73,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 62.9,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 37.88,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 24.7,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 29.65,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 260.51,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 204.67,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 134.78,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 84.97,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 61.07,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 24.97,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 51.47,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 49.5,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 44.93,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ],
            2018: [
              {
                max: 617.03,
                min: 0,
                country: '日本',
                continent: '亚洲'
              },
              {
                max: 282.22,
                min: 0,
                country: '印度',
                continent: '亚洲'
              },
              {
                max: 144.97,
                min: 0,
                country: '韩国',
                continent: '亚洲'
              },
              {
                max: 124.05,
                min: 0,
                country: '土耳其',
                continent: '亚洲'
              },
              {
                max: 114.69,
                min: 0,
                country: '印尼',
                continent: '亚洲'
              },
              {
                max: 70.16,
                min: 0,
                country: '沙特',
                continent: '亚洲'
              },
              {
                max: 44.23,
                min: 0,
                country: '泰国',
                continent: '亚洲'
              },
              {
                max: 34.03,
                min: 0,
                country: '菲律宾',
                continent: '亚洲'
              },
              {
                max: 38.21,
                min: 0,
                country: '马来',
                continent: '亚洲'
              },
              {
                max: 287.93,
                min: 0,
                country: '英国',
                continent: '欧洲'
              },
              {
                max: 214.1,
                min: 0,
                country: '意大利',
                continent: '欧洲'
              },
              {
                max: 153.95,
                min: 0,
                country: '西班牙',
                continent: '欧洲'
              },
              {
                max: 94.81,
                min: 0,
                country: '荷兰',
                continent: '欧洲'
              },
              {
                max: 67.46,
                min: 0,
                country: '瑞士',
                continent: '欧洲'
              },
              {
                max: 26.92,
                min: 0,
                country: '芬兰',
                continent: '欧洲'
              },
              {
                max: 58.93,
                min: 0,
                country: '瑞典',
                continent: '欧洲'
              },
              {
                max: 53.84,
                min: 0,
                country: '比利时',
                continent: '欧洲'
              },
              {
                max: 48.93,
                min: 0,
                country: '挪威',
                continent: '欧洲'
              }
            ]
          };

          const duration = 400;
          const years = Object.keys(asiaData);

          const spec: any = {
            type: 'bar',
            padding: 0,
            data: [
              {
                id: 'data0',
                values: []
              }
            ],
            direction: 'horizontal',
            yField: 'country',
            xField: 'max',
            seriesField: 'type',
            color: ['#008584', '#F2993D'],
            axes: [
              {
                animation: true,
                orient: 'bottom',
                type: 'linear',
                visible: true,
                grid: {
                  visible: true
                },
                label: {
                  style: {
                    fontSize: 12
                  }
                }
              },
              {
                animation: true,
                id: 'axis-left',
                orient: 'left',
                tick: { visible: false },
                label: {
                  visible: true,
                  style: {
                    fontSize: 12
                  }
                },
                type: 'band',
                grid: {
                  visible: true
                }
              }
            ],
            animationAppear: {
              bar: {
                type: 'growWidthIn',
                duration
              },
              axis: {
                duration,
                easing: 'linear'
              }
            },
            animationUpdate: {
              bar: {
                duration,
                easing: 'linear'
              },
              axis: {
                duration: duration * 0.8,
                easing: 'linear'
              }
            },
            bar: {
              style: {
                fill: {
                  gradient: 'linear',
                  stops: [
                    {
                      offset: 1
                    },
                    {
                      offset: 0,
                      opacity: 0.6
                    }
                  ]
                }
              }
            }
          };
          avatar.vchart.updateSpec(spec).then(() => {
            const view = avatar.vchart.getCompiler().getVGrammarView();
            const time = view.mark('text', view.rootMark).encode({
              text: '',
              fontSize: 40,
              zIndex: 1000,
              x: 700,
              y: 460,
              fill: 'grey',
              fontWeight: 'bold'
            });
            years.forEach((year, index) => {
              setTimeout(() => {
                time
                  .encode({
                    text: year
                  })
                  .animation({
                    enter: {
                      type: 'fadeIn',
                      duration
                    }
                  });
                asiaData[year]
                  .sort((pre, next) => next.max - pre.max)
                  .forEach((item, index) => {
                    item.type = index % 2 === 0 ? 'A' : 'B';
                  });

                avatar.vchart.updateData('data0', asiaData[year]);
              }, duration * (index + 1));
            });
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
