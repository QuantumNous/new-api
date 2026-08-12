import type { IPointLike } from '@visactor/vchart';
import type { IExtensionGroupMarkSpec, IExtensionMarkSpec } from '@visactor/vchart';
import type { IConversionFunnelSpec, IConversionFunnelChartSpecBase, Arrow } from './interface';
import type { ParsedArrow } from './arrow-data-transform';
import { LayoutZIndex, FunnelChartSpecTransformer } from '@visactor/vchart';
import { isFunction } from '@visactor/vchart';
import {
  DEFAULT_ARROW_MARK_STYLE,
  DEFAULT_ARROW_SYMBOL_MARK_STYLE,
  DEFAULT_ARROW_TEXT_MARK_STYLE,
  DEFAULT_FUNNEL_BACKGROUND_MARK_STYLE
} from './constants';

export class ConversionFunnelChartSpecTransformer extends FunnelChartSpecTransformer<IConversionFunnelChartSpecBase> {
  transformSpec(spec: IConversionFunnelChartSpecBase): void {
    const { conversionArrow, extensionMark = [], funnelBackground } = spec;
    if (conversionArrow && conversionArrow.arrows && conversionArrow.arrows.length) {
      const marks = addArrowMark(conversionArrow);
      if (marks && marks.length) {
        extensionMark.push(...marks);
      }
    }
    if (funnelBackground && funnelBackground.visible) {
      const mark = addFunnelBackgroundMark(funnelBackground);
      if (mark) {
        extensionMark.push(mark);
      }
    }
    spec.extensionMark = extensionMark;
    super.transformSpec(spec);
  }

  _getDefaultSeriesSpec(spec: IConversionFunnelChartSpecBase) {
    const seriesSpec = super._getDefaultSeriesSpec(spec);
    (seriesSpec as IConversionFunnelChartSpecBase).conversionArrow = spec.conversionArrow;
    (seriesSpec as IConversionFunnelChartSpecBase).funnelBackground = spec.funnelBackground;
    return seriesSpec;
  }
}

/**  Arrow Related */
function addArrowMark(arrowSpec: IConversionFunnelSpec['conversionArrow']) {
  const { arrows, ...style } = arrowSpec;
  const leftArrows = arrows.filter(arrow => arrow.position === 'left');
  const rightArrows = arrows.filter(arrow => arrow.position === 'right');

  const rightGroup = computeArrows(rightArrows, style);
  const leftGroup = computeArrows(leftArrows, style);

  const result = [];
  if (rightGroup) {
    rightGroup.name = 'arrowRight';
    result.push(rightGroup);
  }
  if (leftGroup) {
    leftGroup.name = 'arrowLeft';
    result.push(leftGroup);
  }

  return result;
}

function computeArrows(arrows: Arrow[], style: Omit<IConversionFunnelSpec['conversionArrow'], 'arrows'>) {
  if (arrows?.length === 0) {
    return null;
  }

  const { line, symbol, text, margin } = style;

  const result: IExtensionMarkSpec<'polygon' | 'symbol' | 'text'>[] = [];

  const rootGroup: IExtensionGroupMarkSpec = {
    type: 'group' as any,
    zIndex: LayoutZIndex.Mark + 1,
    children: []
  };
  const lineMark = generateArrowLineSpec(line, margin);
  if (lineMark) {
    result.push(lineMark);
  }
  const arrowMark = generateArrowSymbolSpec(symbol, margin);
  if (arrowMark) {
    result.push(arrowMark);
  }
  const textMark = generateArrowTextSpec(text, margin);
  if (textMark) {
    result.push(textMark);
  }
  rootGroup.children = result;
  return rootGroup;
}

function generateArrowLineSpec(line: IConversionFunnelSpec['conversionArrow']['line'] = {}, margin?: number) {
  const { style = {}, ...rest } = line;
  const renderable = (arrow: any, ctx: any) => {
    const { from, to } = arrow;
    const { vchart } = ctx;
    const data = vchart?.getChart()?.getSeriesData()?.latestData;
    if (!data) {
      false;
    }
    if (to > data.length - 1 || from > data.length - 1) {
      return false;
    }
    return true;
  };

  return {
    type: 'polygon',
    interactive: false,
    ...rest,
    dataKey: arrow => `${arrow.id}`,
    style: {
      ...DEFAULT_ARROW_MARK_STYLE,
      ...style,
      renderable,
      points: (arrow: any, ctx: any) => {
        if (!renderable(arrow, ctx)) {
          return [];
        }
        let points = arrow.layout.points;
        points = prepareArrowPoints(arrow, ctx, margin);
        return points;
      }
    }
  } as IExtensionMarkSpec<'polygon'>;
}

function generateArrowSymbolSpec(symbol: IConversionFunnelSpec['conversionArrow']['symbol'] = {}, margin?: number) {
  const { style = {}, ...rest } = symbol;
  return {
    type: 'symbol',
    interactive: false,
    dataKey: arrow => `${arrow.id}`,
    ...rest,
    style: {
      ...DEFAULT_ARROW_SYMBOL_MARK_STYLE,
      ...style,

      x: (arrow: any, ctx: any) => {
        let points = arrow.layout.points;
        points = prepareArrowPoints(arrow, ctx, margin);
        return points[points?.length - 1]?.x ?? NaN;
      },
      y: (arrow: any, ctx: any) => {
        let points = arrow.layout.points;
        points = prepareArrowPoints(arrow, ctx, margin);
        return points[points?.length - 1]?.y ?? NaN;
      },
      angle: (arrow: any) => (arrow.position === 'left' ? 90 : -90)
    }
  } as IExtensionMarkSpec<'symbol'>;
}

function generateArrowTextSpec(text: IConversionFunnelSpec['conversionArrow']['text'] = {}, margin?: number) {
  const { style = {}, formatMethod, textMargin = 4, ...rest } = text;

  return {
    type: 'text',
    dataKey: arrow => `${arrow.id}`,
    interactive: false,
    animation: false,
    ...rest,
    style: {
      ...DEFAULT_ARROW_TEXT_MARK_STYLE,
      text: (arrow: any, ctx: any) => {
        const { text: textContent } = arrow;
        let displayTextContent: ReturnType<typeof formatMethod> = textContent;

        if (isFunction(formatMethod)) {
          const { vchart } = ctx;
          const { from, to } = arrow;
          const { field } = arrow.context;
          const rawData = vchart?.getChart()?.getSeriesData()?.latestData ?? [];
          const viewData = vchart?.getChart()?.getAllSeries()[0]?.getViewData()?.latestData ?? [];

          const fromData = viewData.find((datum: any) => datum[field] === rawData[from][field]);
          const toData = viewData.find((datum: any) => datum[field] === rawData[to][field]);

          displayTextContent = formatMethod(textContent, { arrow, from: fromData, to: toData });
        }
        return displayTextContent;
      },
      x: (arrow: any, ctx: any) => {
        let points = arrow.layout.points;
        points = prepareArrowPoints(arrow, ctx, margin);
        return points[1]?.x + (arrow.position === 'left' ? -textMargin : textMargin) ?? NaN;
      },
      y: (arrow: any, ctx: any) => {
        let points = arrow.layout.points;
        points = prepareArrowPoints(arrow, ctx, margin);
        return (points[1]?.y + points[2]?.y) / 2 ?? NaN;
      },
      textAlign: (arrow: any) => (arrow.position === 'left' ? 'right' : 'left'),
      textBaseline: 'middle',
      ...style
    }
  } as IExtensionMarkSpec<'text'>;
}

function prepareArrowPoints(arrow: ParsedArrow, ctx: any, margin?: number) {
  const { vchart } = ctx;
  const { from, to } = arrow;
  const { field } = arrow.context;
  const rawData = vchart?.getChart()?.getSeriesData()?.latestData;
  const viewData = vchart?.getChart()?.getAllSeries()[0]?.getViewData()?.latestData;

  let points: IPointLike[] = [];

  if (rawData && rawData.length) {
    const fromDatum = viewData.find((datum: any) => datum[field] === rawData[from][field]);
    const toDatum = viewData.find((datum: any) => datum[field] === rawData[to][field]);
    const firstDatum = viewData[0];

    if (fromDatum && toDatum && firstDatum) {
      const fromPoints = ctx.getPoints(fromDatum);
      const toPoints = ctx.getPoints(toDatum);
      const firstPoints = ctx.getPoints(firstDatum);
      points = computeArrowPoints(arrow, fromPoints, toPoints, firstPoints, margin);
      arrow.layout.points = points;
    }
  }
  return points;
}

function computeArrowPoints(
  arrow: ParsedArrow,
  fromPoints: IPointLike[],
  toPoints: IPointLike[],
  firstPoints: IPointLike[],
  margin = 12
) {
  const { layout, distance, position } = arrow;
  const { level, fromIndex, toIndex, fromTotal, toTotal } = layout;

  const isRight = position === 'right';

  const fromTop = isRight ? fromPoints[1] : fromPoints[0];
  const fromBottom = isRight ? fromPoints[2] : fromPoints[3];

  const fromHeight = Math.abs(fromTop.y - fromBottom.y);

  const toTop = isRight ? toPoints[1] : toPoints[0];
  const toBottom = isRight ? toPoints[2] : toPoints[3];
  const toHeight = Math.abs(toTop.y - toBottom.y);

  const firstTop = isRight ? firstPoints[1] : firstPoints[0];

  const fromOffset = fromHeight / (fromTotal + 1);
  const toOffset = toHeight / (toTotal + 1);

  const fromY = fromTop.y + fromOffset * (fromIndex + 1);
  const toY = toTop.y + toOffset * (toIndex + 1);

  const sign = isRight ? -1 : 1;

  const points = [
    { x: fromTop.x - margin * sign, y: fromY },
    { x: firstTop.x - (margin + (level + 1) * distance) * sign, y: fromY },
    {
      x: firstTop.x - (margin + (level + 1) * distance) * sign,
      y: toY
    },
    {
      x: toTop.x - margin * sign,
      y: toY
    }
  ];
  return points;
}

/**  Funnel Background Related */
function addFunnelBackgroundMark(funnelBackground: IConversionFunnelSpec['funnelBackground']) {
  const { style = {}, ...rest } = funnelBackground;
  return {
    type: 'rect',
    ...rest,
    dataIndex: 0,
    zIndex: 0,
    style: {
      ...DEFAULT_FUNNEL_BACKGROUND_MARK_STYLE,
      ...style,
      x: 0,
      y: (datum, ctx: any) => {
        const points = ctx.getPoints(datum);
        const tl = points[0];
        return tl.y;
      },
      width: (datum, ctx: any) => {
        const region = ctx.getRegion();
        const { width } = region.getLayoutRect();
        return width;
      },
      height: (datum, ctx: any) => {
        const points = ctx.getPoints(datum);
        const tl = points[0];
        const bl = points[3];
        return bl.y - tl.y;
      }
    }
  } as IExtensionMarkSpec<'rect'>;
}
