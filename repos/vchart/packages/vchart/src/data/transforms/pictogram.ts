import { isValid, merge } from '@visactor/vutils';
import type { DataView, SVGParserResult } from '@visactor/vdataset';
import { DEFAULT_DATA_INDEX } from '../../constant/data';
import { measureText } from '../../util';

function isValidStrokeOrFill(attr: any) {
  return isValid(attr) && attr !== 'none' && !attr.includes?.('url');
}

const getLineWidth = (attributes: any) => {
  const strokeWidth = parseFloat(attributes.strokeWidth);
  if (!isNaN(strokeWidth)) {
    return strokeWidth;
  }

  const stroke = attributes.stroke;
  return stroke && isValidStrokeOrFill(stroke) ? 1 : 0;
};

const getFill = (attributes: any, defaultFill?: string) => {
  const fill = attributes.fill ?? defaultFill;
  return fill && isValidStrokeOrFill(fill) ? fill : undefined;
};

const getStroke = (attributes: any, defaultStroke?: string) => {
  const stroke = attributes.stroke ?? defaultStroke;
  return stroke && isValidStrokeOrFill(stroke) ? stroke : false;
};

const commonAttributes = (attributes: Record<string, any>) => {
  return {
    ...attributes,
    x: parseFloat(attributes.x) || undefined,
    y: parseFloat(attributes.y) || undefined,
    fillStrokeOrder: false,
    fill: getFill(attributes),
    lineWidth: getLineWidth(attributes),
    stroke: getStroke(attributes)
  };
};

export const graphicAttributeTransform = {
  group: (attributes: Record<string, any>) => {
    const common = commonAttributes(attributes) as any;
    return {
      ...common,
      visibleAll: common.visible !== false
    };
  },
  rule: (attributes: Record<string, any>) => {
    return {
      ...commonAttributes(attributes),
      x: parseFloat(attributes.x1),
      y: parseFloat(attributes.y1),
      x1: parseFloat(attributes.x2),
      y1: parseFloat(attributes.y2)
    };
  },
  rect: (attributes: Record<string, any>) => {
    return {
      ...commonAttributes(attributes),
      // rect 在 chrome 下有默认黑色填充，这里保持效果一致
      fill: getFill(attributes, '#000'),
      width: parseFloat(attributes.width),
      height: parseFloat(attributes.height)
    };
  },
  polygon: (attributes: Record<string, any>) => {
    return {
      ...commonAttributes(attributes),
      // rect 在 chrome 下有默认黑色填充，这里保持效果一致
      fill: getFill(attributes, '#000'),
      points: attributes.points
        .trim()
        .split(/\s+/)
        .map((pair: string) => {
          const [x, y] = pair.split(',').map(Number);
          return { x, y };
        })
    };
  },
  line: (attributes: Record<string, any>) => {
    return {
      ...commonAttributes(attributes),
      points: attributes.points
        .trim()
        .split(/\s+/)
        .map((pair: string) => {
          const [x, y] = pair.split(',').map(Number);
          return { x, y };
        })
    };
  },
  path: (attributes: Record<string, any>) => {
    return {
      ...commonAttributes(attributes),
      path: attributes.d,
      fillStrokeOrder: false,
      fill: getFill(attributes, '#000')
    };
  },
  arc: (attributes: Record<string, any>) => {
    return {
      ...commonAttributes(attributes),
      outerRadius: attributes.r ?? attributes.ry,
      x: parseFloat(attributes.cx),
      y: parseFloat(attributes.cy),
      startAngle: 0,
      endAngle: Math.PI * 2,
      scaleX: parseFloat(attributes.rx) / parseFloat(attributes.ry) || 1,
      fill: getFill(attributes, '#000')
    };
  },
  text: (attributes: Record<string, any>, value: string) => {
    return {
      ...commonAttributes(attributes),
      text: value,
      textAlign: attributes.textAlign ?? 'left',
      textBaseLine: attributes.textAnchor ?? 'middle',
      anchor: [0, 0],
      fill: getFill(attributes, '#000')
    };
  }
};

export const pictogram = (data: DataView[]) => {
  if (!data || !data[0]) {
    return {};
  }
  const { elements } = data[0].latestData as SVGParserResult;

  // 处理最终属性
  if (elements && elements.length) {
    // TODO: type
    // elements.forEach((el: SVGParsedElementExtend, index: number) => {
    elements.forEach((el: any, index: number) => {
      el[DEFAULT_DATA_INDEX] = index;
      el._uniqueId = `${el.id}-${index}`;
      el.data = undefined;

      const { graphicType: type, transform } = el;

      const finalAttributes = {
        visible: el.attributes.visibility !== 'hidden' && el.attributes.visibility !== 'collapse'
      };

      if (el.graphicType === 'text') {
        merge(finalAttributes, el._inheritStyle, el.parent?._textGroupStyle, el.attributes);
      } else if (el.graphicType !== 'group') {
        merge(finalAttributes, el._inheritStyle, el.attributes);
      }

      if (graphicAttributeTransform[type]) {
        el._finalAttributes = graphicAttributeTransform[type](finalAttributes, el.value);
      } else {
        el._finalAttributes = finalAttributes;
      }

      if (transform) {
        el._finalAttributes.postMatrix = { ...transform };
      }
    });

    // 处理文字布局
    const texts = elements.filter(el => el.tagName === 'text');
    for (let i = 0; i < texts.length; i++) {
      const textId = texts[i]._uniqueId;
      const children = elements.filter(el => {
        let result = false;
        let parent = el.parent;
        while (parent) {
          if (parent._uniqueId === textId) {
            result = true;
            break;
          }
          parent = parent.parent;
        }
        return result;
      });

      if (children && children.length) {
        const startX = texts[i]._textGroupStyle?.x ?? 0;
        let curX = startX;

        for (let j = 0; j < children.length; j++) {
          const currentChild = children[j];
          if (currentChild.graphicType === 'group') {
            curX = startX;
          } else if (currentChild.value) {
            if (currentChild.parent._textGroupStyle.x === undefined) {
              const lastText = children
                .slice(0, j)
                .reverse()
                .find(c => c.graphicType === 'text' && c.value);
              if (lastText) {
                const width = measureText(lastText.value, lastText._finalAttributes).width;
                curX += width;
              }
              currentChild._finalAttributes.x = curX;
            }
          }
        }
      }
    }
  }

  return elements;
};
