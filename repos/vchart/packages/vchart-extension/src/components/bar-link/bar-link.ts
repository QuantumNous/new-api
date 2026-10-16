/**
 * @description 堆叠柱系列的连接线组件
 * @author zhangweixing
 */
import {
  AbstractComponent,
  Segment,
  type IGraphic,
  type ILineGraphicAttribute,
  createArea,
  createText
} from '@visactor/vchart';
import { cloneDeep, isEmpty } from '@visactor/vchart';
import { Factory } from '@visactor/vchart';
import { STACK_FIELD_END, STACK_FIELD_START } from '@visactor/vchart';
import type { BarLinkAttrs } from './type';
import { BAR_LINK } from './constant';

export class BarLinkComponent extends AbstractComponent<Required<BarLinkAttrs>> {
  name = BAR_LINK;

  protected render() {
    const { data, linkStyle, areaStyle, styleMap, label, linkType = 'total' } = this.attribute as BarLinkAttrs;
    if (isEmpty(data)) {
      return;
    }
    this.removeAllChild();
    data.forEach((datum, index) => {
      const { linePoints, areaPoints, id = index, color, data: curData } = datum;

      if (areaPoints && styleMap?.[`area-${id}`]?.visible !== false) {
        // 先绘制面
        const area = createArea({
          points: areaPoints,
          fillOpacity: 0.3,
          fill: color,
          zIndex: 0,
          ...areaStyle,
          ...styleMap?.[`area-${id}`]
        });
        area.name = 'bar-link-area';
        area.id = `area-${id}`;
        this.add(area);
      }

      if (
        linePoints &&
        styleMap?.[`line-${id}`]?.visible !== false &&
        (linkStyle?.lineStyle as any)?.lineWidth !== 0 &&
        styleMap?.[`line-${id}`]?.lineWidth !== 0
      ) {
        // 再绘制点
        const { startSymbol = {}, endSymbol = {}, lineStyle } = linkStyle || {};

        const startSymbolAttrs = cloneDeep(startSymbol);
        const endSymbolAttrs = cloneDeep(endSymbol);
        if (styleMap?.[`line-${id}`] && styleMap[`line-${id}`].stroke) {
          (startSymbolAttrs as any).style = {
            ...(startSymbolAttrs as any).style,
            color: styleMap[`line-${id}`].stroke
          };
          (endSymbolAttrs as any).style = {
            ...(endSymbolAttrs as any).style,
            color: styleMap[`line-${id}`].stroke
          };
        }

        if (!(startSymbolAttrs as any).symbolType && !(startSymbolAttrs as any).originSymbolType) {
          (startSymbolAttrs as any).originSymbolType = 'solidArrow';
        }
        if (!(endSymbolAttrs as any).symbolType && !(endSymbolAttrs as any).originSymbolType) {
          (endSymbolAttrs as any).originSymbolType = 'solidArrow';
        }
        const line = new Segment({
          points: linePoints,
          startSymbol: {
            size: 8,
            ...startSymbolAttrs
          },
          endSymbol: {
            size: 8,
            ...endSymbolAttrs
          },
          lineStyle: {
            lineDash: [3, 3],
            lineWidth: 1,
            stroke: '#000',
            ...lineStyle,
            ...styleMap?.[`line-${id}`]
          } as ILineGraphicAttribute,
          pickable: true,
          childrenPickable: false,
          zIndex: 1
        });
        line.name = 'bar-link-line';
        line.id = `line-${id}`;
        this.add(line as unknown as IGraphic);
      }

      if (label?.visible && styleMap?.[`label-${id}`]?.visible !== false) {
        const { style, formatMethod } = label;

        const [startData, endData] = curData;

        let startValue = startData[STACK_FIELD_END];
        let endValue = endData[STACK_FIELD_END];
        if (linkType === 'value') {
          startValue = startData[STACK_FIELD_END] - startData[STACK_FIELD_START];
          endValue = endData[STACK_FIELD_END] - endData[STACK_FIELD_START];
        }

        const value = endValue - startValue;
        const percentage = ((endValue - startValue) / startValue) * 100;

        const text = createText({
          x: (linePoints[0].x + linePoints[1].x) * 0.5,
          y: (linePoints[0].y + linePoints[1].y) * 0.5,
          text: formatMethod ? (formatMethod(value, percentage, curData) as string) : `${value} ${percentage}`,
          fontSize: 14,
          fill: '#000',
          stroke: '#fff',
          lineWidth: 1,
          textAlign: 'center',
          textBaseline: 'middle',
          background: '#fff',
          zIndex: 2,
          ...style,
          ...styleMap?.[`label-${id}`]
        });
        text.name = 'bar-link-label';
        text.id = `label-${id}`;
        this.add(text);
      }
    });
  }
}

export const registerBarLink = () => {
  Factory.registerGraphicComponent(
    BAR_LINK,
    (attrs: Required<BarLinkAttrs>) => new BarLinkComponent(attrs) as unknown as IGraphic
  );
};
