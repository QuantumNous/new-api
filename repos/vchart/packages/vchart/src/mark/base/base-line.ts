import { isValidScaleType } from '@visactor/vscale';
import type { StateValueType } from '../../compile/mark';
import type { ConvertToMarkStyleSpec, ILineLikeMarkSpec } from '../../typings/visual';
import type { IPointLike } from '@visactor/vutils';
import { isFunction, isNil } from '@visactor/vutils';
import { BaseMark } from './base-mark';
import { DiffState, type IMarkGraphic, type IMarkStyle } from '../interface';
import type { Datum } from '../../typings/common';
import type { IGroup, ILine, ILineGraphicAttribute } from '@visactor/vrender-core';
import { isSegmentAttrEqual } from '../utils/line';
import type { IMarkSpec } from '../../typings/spec/common';
import { DEFAULT_DATA_KEY } from '../../constant/data';

export const LINE_SEGMENT_ATTRIBUTES = [
  'stroke',
  'strokeOpacity',
  'lineDash',
  'lineDashOffset',
  'lineCap',
  'lineJoin',
  'lineWidth',
  'miterLimit'
];

export abstract class BaseLineMark<T extends ILineLikeMarkSpec = ILineLikeMarkSpec> extends BaseMark<T> {
  protected abstract _getIgnoreAttributes(): string[];

  protected _getSegmentAttributes() {
    return LINE_SEGMENT_ATTRIBUTES;
  }

  protected _segmentStyleKeys: string[] = [];

  initStyleWithSpec(spec: IMarkSpec<T>) {
    this._segmentStyleKeys = [];

    super.initStyleWithSpec(spec);
  }
  /**
   * @override
   * 之所以覆写是因为 vgrammar 侧默认都会处理 lineSegments，非常耗性能，所以需要 VChart 给一个标志位用于是否执行。
   * 由外部series调用，设置markStyle的接口。
   * @param style
   * @param level
   * @param state
   */
  setStyle<T>(
    style: Partial<ConvertToMarkStyleSpec<T>> | Partial<IMarkStyle<T>>,
    state: StateValueType = 'normal',
    level: number = 0
  ): void {
    if (isNil(style)) {
      return;
    }

    if (this.stateStyle[state] === undefined) {
      this.stateStyle[state] = {};
    }

    const ignoreAttributes = this._getIgnoreAttributes();
    const segmentAttributes = this._getSegmentAttributes();
    const isUserLevel = this.isUserLevel(level);

    Object.keys(style).forEach(attr => {
      const attrStyle = (style as any)[attr];
      if (isNil(attrStyle) || ignoreAttributes.includes(attr)) {
        return;
      }
      if (
        isUserLevel &&
        segmentAttributes.includes(attr) &&
        (isValidScaleType(attrStyle?.type) || attrStyle?.scale || isFunction(attrStyle))
      ) {
        if (!this._segmentStyleKeys.includes(attr)) {
          this._segmentStyleKeys.push(attr);
        }
      }

      const styleConverter = this._filterAttribute(attr as any, attrStyle, state, level, isUserLevel);

      this.setAttribute(attr as any, styleConverter, state, level);
    });
  }

  _isValidPointChannel = (channel: string) => {
    return ['x', 'y', 'defined'].includes(channel);
  };

  _getLineSegments(items: any[], points: IPointLike[]) {
    if (!this._segmentStyleKeys || !this._segmentStyleKeys.length) {
      return null;
    }

    const segments: { attrs: any; startIndex: number; endIndex?: number }[] = [];
    let prevSegmentAttrs: any = null;

    items.forEach((item, index) => {
      if (
        !prevSegmentAttrs ||
        !this._segmentStyleKeys.every(key => {
          return isSegmentAttrEqual(prevSegmentAttrs[key], item[key], key);
        })
      ) {
        if (segments.length) {
          segments[segments.length - 1].endIndex = index;
        }

        prevSegmentAttrs = item;
        segments.push({
          attrs: prevSegmentAttrs,
          startIndex: index
        });
      }
    });

    if (segments.length >= 2) {
      return segments.map(entry => {
        return {
          ...entry.attrs,
          points: points.slice(entry.startIndex, isNil(entry.endIndex) ? points.length : entry.endIndex)
        };
      });
    }

    return null;
  }

  _getPrevPoints(g: ILine): IPointLike[] | null {
    const { points, segments } = g.attribute;

    return (
      points ??
      (segments
        ? segments.reduce((res: IPointLike[], seg: ILineGraphicAttribute) => {
            if (seg.points) {
              seg.points.forEach((point: IPointLike) => {
                res.push(point);
              });
            }

            return res;
          }, [])
        : null)
    );
  }

  _runPointsEncoder(newStyles: Record<string, (datum: Datum) => any>, g: IMarkGraphic, attrs: any = {}) {
    const data = g.context.data;
    const lineAttrs: any[] = [];
    const points: IPointLike[] = [];
    const commonAttrs: any = {};
    const progressive = this.renderContext?.progressive;
    const isFirstFrame = progressive && progressive.currentIndex === 0;

    data.forEach((datum: Datum, index: number) => {
      points[index] = {} as IPointLike;
      lineAttrs[index] = {};

      Object.keys(newStyles).forEach(attrName => {
        if (this._isValidPointChannel(attrName)) {
          (points[index] as any)[attrName] = newStyles[attrName](datum);
        } else if (this._segmentStyleKeys.includes(attrName) && !progressive) {
          lineAttrs[index][attrName] = newStyles[attrName](datum);
        } else if (index === 0 && (!progressive || isFirstFrame)) {
          commonAttrs[attrName] = newStyles[attrName](datum);
        }
      });

      // todo 上下文，似乎是动画相关的
      (points[index] as any).context = this._keyGetter(datum) ?? index;
    });

    if (progressive) {
      const segments = (g as any).attribute?.segments ? [...(g as any).attribute.segments] : [];

      segments.push({
        points
      });
      return isFirstFrame
        ? {
            ...commonAttrs,
            segments
          }
        : { segments };
    } else if (this._segmentStyleKeys && this._segmentStyleKeys.length) {
      const segments = this._getLineSegments(lineAttrs, points);

      if (segments) {
        return {
          ...commonAttrs,
          ...lineAttrs[0],
          segments,
          points: null as IPointLike[]
        };
      }
    }

    return {
      ...commonAttrs,
      ...lineAttrs[0],
      points,
      segments: null as any[]
    };
  }

  _runEncoderOfGraphic(newStyles: Record<string, (datum: Datum) => any>, g: IMarkGraphic, attrs: any = {}) {
    const data = g.context.data;
    if (newStyles && Object.keys(newStyles).some(this._isValidPointChannel) && data && data.length) {
      return this._runPointsEncoder(newStyles, g, attrs);
    }

    return super._runEncoderOfGraphic(newStyles, g, attrs);
  }

  protected _getDataByKey(data: Datum[]) {
    return this._dataByGroup;
  }

  protected _runProgressiveJoin() {
    const currentIndex = this.renderContext.progressive.currentIndex;
    const graphics: IMarkGraphic[] = [];

    this._dataByGroup.keys.forEach((groupKey, index) => {
      const data = this.renderContext.progressive.groupedData.get(groupKey as string);
      const groupStep = this.renderContext.progressive.step;
      const dataSlice = data.slice(currentIndex * groupStep, (currentIndex + 1) * groupStep);

      if (currentIndex === 0) {
        const g = {
          context: {
            ...this._getCommonContext(),
            diffState: DiffState.enter,
            data: dataSlice,
            uniqueKey: groupKey,
            key: groupKey,
            groupKey: groupKey
          }
        };

        graphics.push(g as IMarkGraphic);
      } else {
        const g = this._graphics[index];
        g.context.data = dataSlice;
      }
    });
    const res = currentIndex === 0 ? graphics : this._graphics;

    return {
      graphicsByGroup: { [DEFAULT_DATA_KEY]: res },
      graphics: res,
      needUpdate: false
    };
  }

  protected _setCommonAttributesToTheme(g: IMarkGraphic) {
    // do nothing in line/area
  }
  protected _addProgressiveGraphic(parent: IGroup, g: IMarkGraphic) {
    g.incremental = 1;
    (parent as IGroup).appendChild(g);
  }
}
