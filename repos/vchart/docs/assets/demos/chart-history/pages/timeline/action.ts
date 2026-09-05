import type { ICircle, ILine, IPath, IText } from '@visactor/vrender';
import { tickDistance, tickSvgMap } from './actor/asset';
import { allChartPageKeys, chartPageKeys, darkWhite, highlightColor, lightBlack } from '../../constant';
import type {
  PageActList,
  PageTransitionActList,
  VRenderLineActor,
  VRenderCircleActor,
  Player,
  BaseLayer,
  BaseActor,
  Page,
  VRenderPathActor
} from '@internal/story-player';
import { array } from '@visactor/vutils';

const darkPageKeys = ['1833', '1877'];

export const pageTimelineAction = (
  player: Player,
  layerMap: Record<string, BaseLayer>,
  pageMap: Record<string, Page>,
  actorMap: Record<string, BaseActor>
) => {
  player.createAction(actorMap.pageTimelineActorRoadMapText, {
    pageList: [pageMap.pageTimeline.id],
    layer: layerMap.layerVRender.id,
    acts: [
      {
        page: pageMap.pageTimeline.id,
        duration: 800,
        callback: ({ avatar }) => {
          (avatar as IText).animate().to(
            {
              opacity: 1
            },
            800,
            'quadInOut'
          );
        }
      }
    ],
    transitionActs: [
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

  const lineLength = 1060;
  const timelineTransitionList: PageTransitionActList<VRenderLineActor> = [];
  chartPageKeys
    .map(key => array(key)[0])
    .forEach((key, i) => {
      timelineTransitionList.push({
        transitionType: 'to',
        toPage: pageMap[key].id,
        duration: 700,
        callback: ({ avatar }) => {
          (avatar as ILine).animate().to(
            {
              points: [
                { x: 640 + (0.5 - i) * tickDistance, y: 50 },
                { x: 640 + (1 - i) * tickDistance + lineLength, y: 50 }
              ],
              stroke: darkPageKeys.includes(key) ? darkWhite : lightBlack
            },
            700,
            'quadInOut'
          );
        }
      });
    });
  player.createAction(actorMap.pageTimelineActorTimeline as VRenderLineActor, {
    pageList: [pageMap.pageTimeline.id, ...allChartPageKeys.map(key => pageMap[key].id)],
    layer: layerMap.layerTimeline.id,
    acts: [
      {
        page: pageMap.pageTimeline.id,
        duration: 800,
        callback: ({ avatar }) => {
          (avatar as ILine).animate().to(
            {
              points: [
                { x: 110, y: 470 },
                { x: 110 + lineLength, y: 470 }
              ]
            },
            800,
            'quadInOut'
          );
        }
      }
    ],
    transitionActs: timelineTransitionList
  });

  const timeProgressTransitionList: PageTransitionActList<VRenderLineActor> = [];
  chartPageKeys
    .map(key => array(key)[0])
    .forEach((key, i) => {
      timeProgressTransitionList.push({
        transitionType: 'to',
        toPage: pageMap[key].id,
        duration: 700,
        callback: ({ avatar }) => {
          (avatar as ILine).animate().to(
            {
              points: [
                { x: 640 + (0.5 - i) * tickDistance, y: 50 },
                { x: 640 + tickDistance, y: 50 }
              ]
            },
            700,
            'quadInOut'
          );
        }
      });
    });
  const timeProgressActList: PageActList<VRenderLineActor> = [];
  chartPageKeys.forEach((keys, i) => {
    const keyList = array(keys);
    const xFrom = 640 + (0.5 - i) * tickDistance;
    const xTo = 640 + 2 * tickDistance;
    keyList.forEach((key, j) => {
      const duration = pageMap[key].config.duration ?? 6000;
      timeProgressActList.push({
        page: pageMap[key].id,
        duration,
        callback: ({ avatar }) => {
          (avatar as ILine).animate().to(
            {
              points: [
                { x: xFrom, y: 50 },
                { x: xTo - tickDistance * (1 - (j + 1) / keyList.length), y: 50 }
              ]
            },
            duration,
            'linear'
          );
        }
      });
    });
  });
  player.createAction(actorMap.pageTimelineActorTimeProgress as VRenderLineActor, {
    pageList: [pageMap.pageTimeline.id, ...allChartPageKeys.map(key => pageMap[key].id)],
    layer: layerMap.layerTimeline.id,
    transitionActs: timeProgressTransitionList,
    acts: timeProgressActList
  });

  const getTimeTickTransitionMap = (
    tickIndex: number,
    subTickIndex: number,
    subTickCount: number
  ): PageTransitionActList<VRenderCircleActor> => {
    const timeTickTransitionList: PageTransitionActList<VRenderCircleActor> = [];
    chartPageKeys
      .map(key => array(key)[0])
      .forEach((key, pageIndex) => {
        timeTickTransitionList.push({
          transitionType: 'to',
          toPage: pageMap[key].id,
          duration: 700,
          callback: ({ avatar }) => {
            (avatar as ICircle).animate().to(
              {
                fill:
                  pageIndex >= tickIndex
                    ? highlightColor
                    : subTickIndex === 0
                    ? darkPageKeys.includes(key)
                      ? darkWhite
                      : lightBlack
                    : '#82887C',
                opacity: 1,
                x: 640 + (tickIndex - pageIndex + 1 + subTickIndex / subTickCount) * tickDistance,
                y: 50
              },
              700,
              'quadInOut'
            );
          }
        });
      });
    return timeTickTransitionList;
  };
  chartPageKeys.forEach((keys, i) => {
    const keyList = array(keys);
    keyList.forEach((key, j) => {
      const tick = actorMap[`pageTimelineActorTimeTick${key}`] as VRenderCircleActor;
      player.createAction(tick, {
        pageList: [pageMap.pageTimeline.id, ...allChartPageKeys.map(key => pageMap[key].id)],
        layer: layerMap.layerTimeline.id,
        timeOffset: 100 * i,
        acts:
          j === 0
            ? [
                {
                  page: pageMap.pageTimeline.id,
                  duration: 500,
                  callback: ({ avatar }) => {
                    (avatar as IText)
                      .animate()
                      .to(
                        {
                          opacity: 1
                        },
                        500,
                        'quadInOut'
                      )
                      .wait(200)
                      .to(
                        {
                          radius: 10,
                          fill: highlightColor
                        },
                        500,
                        'quadInOut'
                      )
                      .to(
                        {
                          radius: 6,
                          fill: lightBlack
                        },
                        500,
                        'quadInOut'
                      );
                  }
                }
              ]
            : [],
        transitionActs: getTimeTickTransitionMap(i, j, keyList.length)
      });
    });

    const label = actorMap[`pageTimelineActorTimeLabel${keyList[0]}`] as VRenderPathActor;
    const getTimeLabelTransitionMap = (labelIndex: number): Required<PageTransitionActList<VRenderCircleActor>> => {
      const timeLabelTransitionList: PageTransitionActList<VRenderCircleActor> = [];
      const labelKeys = chartPageKeys.map(key => array(key)[0]);
      labelKeys.forEach((key, pageIndex) => {
        timeLabelTransitionList.push({
          transitionType: 'to',
          toPage: pageMap[key].id,
          duration: 700,
          callback: ({ avatar }) => {
            const scale = pageIndex === labelIndex ? 1 : 0.7;
            const tickWidth = tickSvgMap[labelKeys[labelIndex]].size[0] * scale;
            (avatar as IText).animate().to(
              {
                fill: pageIndex >= labelIndex ? highlightColor : darkPageKeys.includes(key) ? darkWhite : lightBlack,
                x: 640 + (labelIndex - pageIndex + 1) * tickDistance - tickWidth / 2,
                y: 70,
                scaleX: scale,
                scaleY: scale
              },
              700,
              'quadInOut'
            );
          }
        });
      });
      return timeLabelTransitionList;
    };
    player.createAction(label, {
      pageList: [pageMap.pageTimeline.id, ...allChartPageKeys.map(key => pageMap[key].id)],
      layer: layerMap.layerTimeline.id,
      timeOffset: 100 * i,
      acts: [
        {
          page: pageMap.pageTimeline.id,
          duration: 500,
          callback: ({ avatar }) => {
            (avatar as IPath)
              .animate()
              .to(
                {
                  opacity: 1
                },
                500,
                'quadInOut'
              )
              .wait(200)
              .to(
                {
                  y: 500,
                  fill: highlightColor
                },
                500,
                'quadInOut'
              )
              .to(
                {
                  y: 490,
                  fill: lightBlack
                },
                500,
                'quadInOut'
              );
          }
        }
      ],
      transitionActs: getTimeLabelTransitionMap(i)
    });
  });
};
