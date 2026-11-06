import type { IText } from '@visactor/vrender-core';
import type { BandScale } from '@visactor/vscale';
// eslint-disable-next-line no-duplicate-imports
import { isContinuous, isDiscrete } from '@visactor/vscale';
import type { ICartesianSeries } from '../../../series';
import { Direction, type ILayoutPoint, type StringOrNumber } from '../../../typings';
import type {
  AxisCurrentValueMap,
  CrossHairStateByField,
  CrossHairStateItem,
  IBound,
  ICrosshairInfo,
  ICrosshairLabelInfo,
  IHair
} from '../interface';
import { getDatumByValue } from './common';
import { getAxisLabelOffset } from '../../axis/util';
import { isValid } from '@visactor/vutils';
import type { IAxis, ILinearAxis } from '../../axis';
import { getFormatFunction } from '../../util';
import type { IDimensionData } from '../../../event/events/dimension/interface';

export const layoutByValue = (
  stateByField: CrossHairStateByField,
  series: ICartesianSeries,
  layoutStartPoint: ILayoutPoint,
  enableRemain: boolean = false
) => {
  if (!layoutStartPoint) {
    layoutStartPoint = { x: 0, y: 0 };
  }

  Object.keys(stateByField).forEach(field => {
    const { currentValue, cacheInfo, labelsComp, attributes, coordKey } = stateByField[field];
    let axis = null;
    let coord = 0;
    let axisLabel: IText = null;
    if (currentValue.size) {
      const item = Array.from(currentValue.values())[0];
      coord =
        item.axis.getScale().scale(item.datum) +
        item.axis.getLayoutStartPoint()[coordKey as 'x' | 'y'] -
        layoutStartPoint[coordKey as 'x' | 'y'];
      axis = item.axis;
      axisLabel = axis
        .getVRenderComponents()[0]
        ?.children[0]?.children[0]?.children[0]?.getChildByName('axis-label-container')
        ?.getChildByName('axis-label-container-layer-0')?.children[0];
    }
    const isVisible = !!currentValue.size && Number.isFinite(coord) && !Number.isNaN(coord);
    const useCache = enableRemain && !isVisible && isValid(cacheInfo);
    const newCacheInfo: ICrosshairInfo = useCache
      ? cacheInfo
      : {
          coordRange: [0, 0],
          sizeRange: [0, 0],
          coord,
          labelsTextStyle: {},
          labels: labelsComp
            ? Object.keys(labelsComp).reduce((res: Record<string, ICrosshairLabelInfo>, labelKey: string) => {
                res[labelKey] = { visible: false, text: '', dx: 0, dy: 0 };

                return res;
              }, {})
            : null,
          visible: isVisible,
          axis,
          axisLabel: axisLabel
        };
    if (newCacheInfo) {
      newCacheInfo._isCache = useCache;
    }
    let bandSize;
    let offsetSize: number = 0;

    // 计算x轴和y轴的数据，只允许最多一对x和一对y
    if (attributes) {
      currentValue.forEach(({ axis, datum: value = '' }) => {
        let niceLabelFormatter: (value: StringOrNumber) => StringOrNumber = null;
        const scale = axis.getScale();
        if (isDiscrete(scale.type)) {
          bandSize = (scale as BandScale).bandwidth();

          if (bandSize === 0 && (scale as BandScale).step) {
            offsetSize = (scale as BandScale).step();
          }
        } else if (isContinuous(scale.type)) {
          const field1 = field === 'xField' ? series.fieldX[0] : series.fieldY[0]; // todo
          const field2 = field === 'xField' ? series.fieldX2 : series.fieldY2; // todo
          const datum = getDatumByValue(series.getViewData().latestData, +value, field1, field2);
          if (datum) {
            const startX = field === 'xField' ? series.dataToPositionX(datum) : series.dataToPositionY(datum);
            if (field2) {
              bandSize = Math.abs(
                startX - (field === 'xField' ? series.dataToPositionX1(datum) : series.dataToPositionY1(datum))
              );
              value = `${datum[field1]} ~ ${datum[field2]}`;
            } else {
              bandSize = 1;
            }
            coord = startX;
          }
          niceLabelFormatter = (axis as ILinearAxis).niceLabelFormatter;
        }
        if (newCacheInfo && attributes.label?.visible && !useCache) {
          const labelOffset = getAxisLabelOffset(axis.getSpec());
          const axisOrient = axis.getOrient();
          const syncAxisLabelAngle = attributes.label?.syncAxisLabelAngle;
          if (newCacheInfo.labels[axisOrient]) {
            newCacheInfo.labels[axisOrient].visible = true;
            newCacheInfo.labels[axisOrient].text = value;
            if (axisOrient === 'left') {
              newCacheInfo.labels[axisOrient].dx = -labelOffset;
              newCacheInfo.labelsTextStyle[axisOrient] = {
                textAlign: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textAlign ?? 'right' : 'right',
                textBaseline: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textBaseline ?? 'middle' : 'middle'
              };
            } else if (axisOrient === 'right') {
              newCacheInfo.labels[axisOrient].dx = labelOffset;
              newCacheInfo.labelsTextStyle[axisOrient] = {
                textAlign: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textAlign ?? 'left' : 'left',
                textBaseline: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textBaseline ?? 'middle' : 'middle'
              };
            } else if (axisOrient === 'top') {
              newCacheInfo.labels[axisOrient].y = 0;
              newCacheInfo.labels[axisOrient].dy = -labelOffset;
              newCacheInfo.labelsTextStyle[axisOrient] = {
                textAlign: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textAlign ?? 'center' : 'center',
                textBaseline: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textBaseline ?? 'bottom' : 'bottom'
              };
            } else if (axisOrient === 'bottom') {
              newCacheInfo.labels[axisOrient].dy = labelOffset;
              newCacheInfo.labelsTextStyle[axisOrient] = {
                textAlign: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textAlign ?? 'center' : 'center',
                textBaseline: syncAxisLabelAngle && axisLabel ? axisLabel.attribute.textBaseline ?? 'top' : 'top'
              };
            }
            newCacheInfo.labels[axisOrient].defaultFormatter = niceLabelFormatter;
          }
        }
      });
    }

    if (newCacheInfo && !useCache) {
      const region = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
      setRegionArea(region, currentValue);
      if (field === 'xField') {
        newCacheInfo.coordRange = [region.x1, region.x2];
        newCacheInfo.sizeRange = [region.y1, region.y2];
        newCacheInfo.coord = coord + layoutStartPoint.x;
        if (newCacheInfo.labels) {
          newCacheInfo.labels.top.y = region.y1;
          newCacheInfo.labels.bottom.y = region.y2;
        }
      } else {
        newCacheInfo.coordRange = [region.y1, region.y2]; // todo
        newCacheInfo.sizeRange = [region.x1, region.x2];
        newCacheInfo.coord = coord + layoutStartPoint.y;

        if (newCacheInfo.labels) {
          newCacheInfo.labels.left.x = region.x1;
          newCacheInfo.labels.right.x = region.x2;
        }
      }

      if (newCacheInfo.coord < newCacheInfo.coordRange[0] || newCacheInfo.coord > newCacheInfo.coordRange[1]) {
        newCacheInfo.visible = false;
      }

      if (attributes && attributes.label) {
        Object.keys(newCacheInfo.labels).forEach(labelKey => {
          if (newCacheInfo.labels[labelKey].visible) {
            setFormattedCrosshairLabel(newCacheInfo.labels[labelKey], labelKey, attributes.label);
          }
        });
      }
    }

    stateByField[field].bandSize = bandSize ?? 0;
    stateByField[field].offsetSize = offsetSize;
    stateByField[field].cacheInfo = newCacheInfo;
  });

  return stateByField;
};

const setFormattedCrosshairLabel = (labelInfo: ICrosshairLabelInfo, position: string, labelSpec: IHair['label']) => {
  const { formatMethod, formatter } = labelSpec;
  const { formatFunc, args } = getFormatFunction(formatMethod, formatter, labelInfo.text, {
    label: labelInfo.text,
    position
  });
  if (formatFunc) {
    labelInfo.text = formatFunc(...args);
  } else if (labelInfo.defaultFormatter) {
    labelInfo.text = labelInfo.defaultFormatter(labelInfo.text);
  }
};

// 计算x轴和y轴对应的region区域
const setRegionArea = (outRegion: IBound, currentValue: AxisCurrentValueMap) => {
  currentValue.forEach(({ axis }) => {
    const regions = axis.getRegions();
    regions.forEach(r => {
      const { x, y } = r.getLayoutStartPoint();
      const { width, height } = r.getLayoutRect();

      outRegion.x1 = Math.min(outRegion.x1, x);
      outRegion.y1 = Math.min(outRegion.y1, y);
      outRegion.x2 = Math.max(outRegion.x2, x + width);
      outRegion.y2 = Math.max(outRegion.y2, y + height);
    });
  });
};

export const layoutCrosshair = (stateItem: CrossHairStateItem) => {
  const { cacheInfo, attributes, bandSize, offsetSize, coordKey, anotherAxisKey } = stateItem;
  const { coord, sizeRange } = cacheInfo;

  // 外部设置的size
  const type = attributes.type;
  let positionAttribute;
  if (type === 'line') {
    const pos = coord + bandSize / 2;

    positionAttribute = {
      visible: true,
      start: { [coordKey]: pos, [anotherAxisKey]: sizeRange[0] },
      end: { [coordKey]: pos, [anotherAxisKey]: sizeRange[1] }
    };
  } else if (type === 'rect') {
    const [offset0, offset1] = getRectSize(attributes, bandSize, offsetSize, cacheInfo.axis);
    const { coordRange } = cacheInfo;

    positionAttribute = {
      visible: true,
      start: {
        [coordKey]: Math.max(coord + offset0, coordRange[0]),
        [anotherAxisKey]: sizeRange[0]
      },
      end: {
        [coordKey]: Math.min(coord + offset1, coordRange[1]),
        [anotherAxisKey]: sizeRange[1]
      }
    };
  }

  return positionAttribute;
};

const getRectSize = (hair: IHair, bandSize: number, offsetSize: number, axis: IAxis) => {
  // 外部设置的size
  const visualSize = bandSize === 0 ? offsetSize : bandSize;
  let size = visualSize;

  if (hair.style?.sizePercent) {
    // 按照百分比设置大小
    size = visualSize * hair.style.sizePercent;
  } else if (typeof hair.style?.size === 'number') {
    size = hair.style.size;
  } else if (typeof hair.style?.size === 'function') {
    const axisRect = axis.getLayoutRect();
    size = hair.style.size(axisRect, axis);
  }

  return bandSize === 0 ? [-size / 2, size / 2] : [bandSize / 2 - size / 2, size / 2 + bandSize / 2];
};

export const getCartesianCrosshairRect = (dimensionData: IDimensionData, layoutStartPoint: ILayoutPoint) => {
  const currValueX: AxisCurrentValueMap = new Map();
  const currValueY: AxisCurrentValueMap = new Map();
  const { series, datum } = dimensionData;
  const isHorizontal = (series as ICartesianSeries).direction === Direction.horizontal;
  const axisHelper = isHorizontal
    ? (series as ICartesianSeries).getYAxisHelper()
    : (series as ICartesianSeries).getXAxisHelper();
  const axisId = axisHelper.getAxisId();
  const axis = series
    .getChart()
    .getComponentsByKey('axes')
    .find(axis => axis.id === axisId) as IAxis;

  if (!axis) {
    return undefined;
  }
  (isHorizontal ? currValueY : currValueX).set(axis.getSpecIndex(), {
    datum: series.getDatumPositionValues(datum[0], series.getDimensionField())?.[0],
    axis
  });

  const state: CrossHairStateByField = {
    xField: {
      coordKey: 'x',
      anotherAxisKey: 'y',
      currentValue: currValueX,
      attributes: {
        visible: !!currValueX.size,
        type: 'rect'
      }
    },
    yField: {
      coordKey: 'y',
      anotherAxisKey: 'x',
      currentValue: currValueY,
      attributes: {
        visible: !!currValueY.size,
        type: 'rect'
      }
    }
  };

  layoutByValue(state, series as ICartesianSeries, layoutStartPoint);

  if (state.xField.cacheInfo) {
    return layoutCrosshair(state.xField);
  }
  if (state.yField.cacheInfo) {
    return layoutCrosshair(state.yField);
  }
  return undefined;
};
