import type { Dict, IPointLike } from '@visactor/vchart';
import type { BarLinkAttrs, BarLinkDatum } from './type';
import type { Datum, ICartesianSeries, IMarkGraphic, ISpec } from '@visactor/vchart';
import { getDatumOfGraphic, STACK_FIELD_END } from '@visactor/vchart';
import { array } from '@visactor/vchart';
import { BAR_LINK } from './constant';

export function groupBarsByFields(elements: IMarkGraphic[], groupFields: string[]) {
  const result: Dict<IMarkGraphic[]> = {};
  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    const itemData = getDatumOfGraphic(item) as Datum;
    const groupKey = groupFields.map(field => itemData[field]).join('-');
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
  }
  return result;
}

export function getLinkData(
  currentElement: IMarkGraphic,
  nextElement: IMarkGraphic,
  config: {
    isHorizontal: boolean;
    isXAxisInverse: boolean;
    isYAxisInverse: boolean;
    linkType: string;
    doFill: boolean;
    regionStartX: number;
    regionStartY: number;
  }
): BarLinkDatum {
  const { isHorizontal, isXAxisInverse, isYAxisInverse, linkType, doFill, regionStartX, regionStartY } = config;

  const currentBarBounds = currentElement.AABBBounds;
  const nextBarBounds = nextElement.AABBBounds;

  let linePoints: [IPointLike, IPointLike];
  let areaPoints: [IPointLike, IPointLike];

  if (isHorizontal) {
    linePoints = [
      {
        x: (currentBarBounds.x1 + currentBarBounds.x2) / 2 + regionStartX,
        y: currentBarBounds.y1 + regionStartY
      },
      {
        x: (nextBarBounds.x1 + nextBarBounds.x2) / 2 + regionStartX,
        y: nextBarBounds.y2 + regionStartY
      }
    ];
    if (isXAxisInverse) {
      if (linkType === 'total') {
        linePoints = [
          {
            x: currentBarBounds.x1 + regionStartX,
            y: currentBarBounds.y1 + regionStartY
          },
          {
            x: nextBarBounds.x1 + regionStartX,
            y: nextBarBounds.y2 + regionStartY
          }
        ];
      }

      if (doFill) {
        areaPoints = [
          {
            x: currentBarBounds.x1 + regionStartX,
            x1: currentBarBounds.x2 + regionStartX,
            y: currentBarBounds.y1 + regionStartY
          },
          {
            x: nextBarBounds.x1 + regionStartX,
            x1: nextBarBounds.x2 + regionStartX,
            y: nextBarBounds.y2 + regionStartY
          }
        ];
      }
    } else {
      if (linkType === 'total') {
        linePoints = [
          {
            x: currentBarBounds.x2 + regionStartX,
            y: currentBarBounds.y1 + regionStartY
          },
          {
            x: nextBarBounds.x2 + regionStartX,
            y: nextBarBounds.y2 + regionStartY
          }
        ];
      }

      if (doFill) {
        areaPoints = [
          {
            x: currentBarBounds.x2 + regionStartX,
            x1: currentBarBounds.x1 + regionStartX,
            y: currentBarBounds.y1 + regionStartY
          },
          {
            x: nextBarBounds.x2 + regionStartX,
            x1: nextBarBounds.x1 + regionStartX,
            y: nextBarBounds.y2 + regionStartY
          }
        ];
      }
    }
  } else {
    linePoints = [
      {
        x: currentBarBounds.x2 + regionStartX,
        y: (currentBarBounds.y1 + currentBarBounds.y2) / 2 + regionStartY
      },
      {
        x: nextBarBounds.x1 + regionStartX,
        y: (nextBarBounds.y1 + nextBarBounds.y2) / 2 + regionStartY
      }
    ];

    if (isYAxisInverse) {
      if (linkType === 'total') {
        linePoints = [
          {
            x: currentBarBounds.x2 + regionStartX,
            y: currentBarBounds.y2 + regionStartY
          },
          {
            x: nextBarBounds.x1 + regionStartX,
            y: nextBarBounds.y2 + regionStartY
          }
        ];
      }
      if (doFill) {
        areaPoints = [
          {
            x: currentBarBounds.x2 + regionStartX,
            y: currentBarBounds.y2 + regionStartY,
            y1: currentBarBounds.y1 + regionStartY
          },
          {
            x: nextBarBounds.x1 + regionStartX,
            y: nextBarBounds.y2 + regionStartY,
            y1: nextBarBounds.y1 + regionStartY
          }
        ];
      }
    } else {
      if (linkType === 'total') {
        linePoints = [
          {
            x: currentBarBounds.x2 + regionStartX,
            y: currentBarBounds.y1 + regionStartY
          },
          {
            x: nextBarBounds.x1 + regionStartX,
            y: nextBarBounds.y1 + regionStartY
          }
        ];
      }
      if (doFill) {
        areaPoints = [
          {
            x: currentBarBounds.x2 + regionStartX,
            y: currentBarBounds.y1 + regionStartY,
            y1: currentBarBounds.y2 + regionStartY
          },
          {
            x: nextBarBounds.x1 + regionStartX,
            y: nextBarBounds.y1 + regionStartY,
            y1: nextBarBounds.y2 + regionStartY
          }
        ];
      }
    }
  }

  return {
    // points,
    areaPoints,
    linePoints,
    data: [getDatumOfGraphic(currentElement) as Datum, getDatumOfGraphic(nextElement) as Datum],
    color: currentElement.attribute.fill as string
  };
}

export function getBarLinkConfig(
  style: Pick<BarLinkAttrs, 'areaStyle' | 'label' | 'linkStyle' | 'styleMap' | 'doFill' | 'linkType'> = {},
  extraStyle?: any
) {
  const { linkType = 'total', doFill, ...rest } = style;
  return {
    type: 'component',
    componentType: BAR_LINK,
    zIndex: 500, // 需要处于 region 上层
    interactive: false,
    style: {
      data: (datum: any, context: any) => {
        const { vchart } = context;
        const regions = vchart.getChart().getAllRegions();
        const linkLineData: BarLinkDatum[] = [];
        regions.forEach((region: any) => {
          // 获取所有 bar 系列
          const barSeriesArr = region
            .getSeries()
            .filter((s: ICartesianSeries) => s.type === 'bar') as ICartesianSeries[];
          const { x: regionStartX, y: regionStartY } = region.getLayoutStartPoint();
          if (barSeriesArr.length) {
            const groupFields = barSeriesArr[0].getGroupFields();
            const allBarElements: IMarkGraphic[] = [];
            barSeriesArr.forEach(barSeries => {
              const barGraphicElements = barSeries.getMarkInName('bar')?.getGraphics();

              barGraphicElements.forEach(barElement => {
                allBarElements.push(barElement);
              });
            });
            // 按照 xField/yField 进行分组
            const groupData = groupBarsByFields(allBarElements, groupFields);

            // 对同组内的图形进行排序
            Object.values(groupData).forEach((groupedValues: IMarkGraphic[]) => {
              groupedValues.sort((prev: IMarkGraphic, curr: IMarkGraphic) => {
                return (
                  (getDatumOfGraphic(prev) as Datum)[STACK_FIELD_END] -
                  (getDatumOfGraphic(curr) as Datum)[STACK_FIELD_END]
                );
              });
            });

            const barSeries = barSeriesArr[0];
            const isHorizontal = barSeries.direction === 'horizontal';
            const isYAxisInverse = barSeries.getYAxisHelper().isInverse();
            const isXAxisInverse = barSeries.getXAxisHelper().isInverse();

            const groupValues: IMarkGraphic[][] = Object.values(groupData);

            // 根据每组图形：
            // 1. 水平，每组图形的 y1 进行由小到大排序，保证图形顺序
            // 2. 垂直，每组图形的 x1 进行由小到大排序，保证图形顺序
            if (groupValues.length) {
              if (isHorizontal) {
                const firstElementPosY = groupValues[0][0].AABBBounds.y1;
                const lastElementPosY = groupValues[groupValues.length - 1][0].AABBBounds.y1;
                if (firstElementPosY < lastElementPosY) {
                  groupValues.reverse();
                }
              } else {
                const firstElementPosX = groupValues[0][0].AABBBounds.x1;
                const lastElementPosX = groupValues[groupValues.length - 1][0].AABBBounds.x1;
                if (firstElementPosX > lastElementPosX) {
                  groupValues.reverse();
                }
              }
            }

            for (let index = 0; index < groupValues.length - 1; index++) {
              const currentValues: IMarkGraphic[] = groupValues[index];
              const nextValues: IMarkGraphic[] = groupValues[index + 1];

              currentValues.forEach((element, elementIndex) => {
                const nextElement = nextValues[elementIndex] ?? nextValues[nextValues.length - 1];

                const linkData = getLinkData(element, nextElement, {
                  isHorizontal,
                  isXAxisInverse,
                  isYAxisInverse,
                  doFill,
                  linkType,
                  regionStartX,
                  regionStartY
                });

                linkLineData.push(linkData);
              });

              if (currentValues.length < nextValues.length) {
                // 如果当前组的个数小于下一个组的个数，用当前组的最后一个元素去链接下一组剩余的图形
                // 使用当前组的最后一个元素去链接下一组剩余的图形
                const lastElementOfCurrentElement = currentValues[currentValues.length - 1];
                for (let i = currentValues.length; i < nextValues.length; i++) {
                  const nextElement = nextValues[i];

                  const linkData = getLinkData(lastElementOfCurrentElement, nextElement, {
                    isHorizontal,
                    isXAxisInverse,
                    isYAxisInverse,
                    doFill,
                    linkType,
                    regionStartX,
                    regionStartY
                  });

                  linkLineData.push(linkData);
                }
              }
            }
          }
        });

        return linkLineData;
      },
      linkType,
      ...rest,
      ...extraStyle
    }
  };
}

export function appendBarLinkConfig(
  rawSpec: ISpec,
  barLinkSpec?: Pick<BarLinkAttrs, 'areaStyle' | 'label' | 'linkStyle' | 'styleMap' | 'doFill' | 'linkType'>
) {
  // 判断 editorSpec 中是否有 barLink，有则添加 customMark
  (rawSpec as any).customMark = array((rawSpec as any).customMark).filter((obj: any) => obj.componentType !== BAR_LINK);
  (rawSpec as any).customMark.push(getBarLinkConfig(barLinkSpec));
}
