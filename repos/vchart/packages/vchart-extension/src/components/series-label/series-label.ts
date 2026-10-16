/**
 * @description vchart 自定义组件，用于实现柱图、线图以及面积图的系列标签
 * @author zhangweixing
 */

import { AbstractComponent, type IGraphic, type IText, createText, createLine } from '@visactor/vchart';
import type { Dict } from '@visactor/vchart';
import { isEmpty } from '@visactor/vchart';
import { Factory } from '@visactor/vchart';
import type { SeriesLabelAttrs, SeriesLabelData } from './type';
import { dodge, dodgeHorizontal } from './util';
import { SERIES_LABEL } from './constant';

export class SeriesLabelComponent extends AbstractComponent<Required<SeriesLabelAttrs>> {
  name = SERIES_LABEL;
  protected render() {
    this.removeAllChild();
    const { data, layout, label, line = {} } = this.attribute as SeriesLabelAttrs;
    if (isEmpty(data)) {
      return;
    }

    const labelStyleMap = label?.styleMap ?? {};
    const adjustedPoints: Dict<any> = {};
    const filteredData = (data as SeriesLabelData[]).filter(datum => labelStyleMap[datum.id]?.visible !== false);
    if (layout === 'vertical') {
      const lineHeight = (label?.style?.fontSize ?? 12) * 1.5; // 进行扰动，将重叠的文本抖开
      const createAndAddTextGraphic = (datum: any, textPoint: any, labelStyleMap: any) => {
        const { label: text, color, textAlign, textBaseline, id } = datum;
        const formatMethod = labelStyleMap[id]?.formatMethod ?? this.attribute.label?.formatMethod;
        const textGraphic = createText({
          text: formatMethod
            ? formatMethod(text, datum.datum, {
                series: datum.series
              })
            : text,
          ...this.attribute.label?.style,
          ...textPoint,
          textAlign,
          textBaseline,
          fill: this.attribute.label?.style?.fill ?? color,
          ...labelStyleMap[id]?.style
        });
        textGraphic.name = 'series-label-text';
        textGraphic.id = id;
        this.add(textGraphic);

        return textGraphic;
      };

      ['start', 'end'].forEach(position => {
        const posData = filteredData.filter(datum => datum.position === position);
        const posYArr = posData.map(datum => datum.point.y);
        const dodgedPosY = dodge(posYArr, lineHeight);
        posData.forEach((datum, index) => {
          const textPoint = {
            x: datum.point.x + (label?.space ?? 8) * (datum.textAlign === 'start' ? 1 : -1),
            y: dodgedPosY[index]
          };
          createAndAddTextGraphic(datum, textPoint, labelStyleMap);
          adjustedPoints[datum.id] = textPoint;
        });
      });
    } else {
      const startTexts: IText[] = [];
      const endTexts: IText[] = [];
      filteredData.forEach(datum => {
        const { point, label: text, color, textAlign, textBaseline, id, position } = datum;

        const textPoint = {
          x: point.x,
          y: point.y
        };

        const formatMethod = labelStyleMap[id]?.formatMethod ?? label?.formatMethod;

        const textGraphic = createText({
          text: formatMethod
            ? formatMethod(text, datum.datum, {
                series: datum.series
              })
            : text,
          ...label?.style,
          ...textPoint,
          textAlign,
          textBaseline,
          fill: label?.style?.fill ?? color,
          ...labelStyleMap[id]?.style
        });
        textGraphic.id = id;
        textGraphic.name = 'series-label-text';
        this.add(textGraphic);
        if (position === 'start') {
          startTexts.push(textGraphic);
        } else if (position === 'end') {
          endTexts.push(textGraphic);
        }
      });
      // 水平扰动，防重叠
      startTexts.length && dodgeHorizontal(startTexts as unknown as IText[], 4, 10);
      endTexts.length && dodgeHorizontal(endTexts as unknown as IText[], 4, 10);
      // 调整间距
      const labelSpace = label?.space ?? 8;
      [...startTexts, ...endTexts].forEach((text: IText) => {
        const flag = text.attribute.textBaseline === 'top' ? 1 : -1;
        text.setAttribute('y', (text.attribute.y as number) + labelSpace * flag);

        adjustedPoints[text.id] = {
          x: text.attribute.x,
          y: text.attribute.y
        };
      });
    }

    if (line.visible !== false) {
      filteredData.forEach(datum => {
        const { point: start, color, id } = datum;
        const end = {
          x: adjustedPoints[id].x + (labelStyleMap[id]?.style?.dx ?? 0),
          y: adjustedPoints[id].y + (labelStyleMap[id]?.style?.dy ?? 0)
        };

        if (line.autoVisible !== false) {
          if ((layout === 'vertical' && start.y !== end.y) || (layout === 'horizontal' && start.x !== end.x)) {
            const lineShape = createLine({
              points: [start, end],
              lineWidth: 1,
              stroke: color,
              ...line.style
            });
            lineShape.name = 'series-label-line';
            this.add(lineShape);
          }
        } else {
          const lineShape = createLine({
            points: [start, end],
            lineWidth: 1,
            stroke: color,
            ...line.style
          });
          lineShape.name = 'series-label-line';
          this.add(lineShape);
        }
      });
    }
  }
}

export const registerSeriesLabel = () => {
  Factory.registerGraphicComponent(
    'seriesLabel',
    (attrs: Required<SeriesLabelAttrs>) => new SeriesLabelComponent(attrs) as unknown as IGraphic
  );
};
