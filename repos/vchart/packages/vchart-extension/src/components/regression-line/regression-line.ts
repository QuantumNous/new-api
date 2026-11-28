import { AbstractComponent, type IGraphic, createText, createLine, createArea } from '@visactor/vchart';
import { isEmpty, isValid, last } from '@visactor/vchart';
import { Factory } from '@visactor/vchart';
import type { RegressionLineAttrs } from '../regression-line/type';

export const REGRESSION_LINE = 'regressionLine';

export class RegressionLine extends AbstractComponent<Required<RegressionLineAttrs>> {
  name = REGRESSION_LINE;
  protected render() {
    this.removeAllChild();
    const {
      data,
      line = {},
      label,
      name = 'regression-line',
      confidenceInterval
    } = this.attribute as RegressionLineAttrs;
    if (isEmpty(data)) {
      return;
    }

    data.forEach(d => {
      const { color } = d;
      if (d.area && confidenceInterval?.visible !== false) {
        const areaShape = createArea({
          points: d.area,
          ...(isValid(color) ? { fill: color, fillOpacity: 0.12 } : null),
          ...confidenceInterval?.style
        });
        areaShape.name = 'scatter-regression-area';
        this.add(areaShape);
      }

      if (d.line && line?.visible !== false) {
        const lineShape = createLine({
          points: d.line,
          lineWidth: 1,
          ...(isValid(color) ? { stroke: color } : null),
          ...line?.style
        });
        lineShape.name = `${name}-curve`;
        this.add(lineShape);
      }

      const lastPoint = last(d.line);

      if (label && label.visible !== false && label.text && lastPoint) {
        const tag = createText({
          ...lastPoint,
          text: label.text,
          textAlign: 'end',
          textBaseline: 'middle',
          ...label.style
        });
        tag.name = `${name}-label`;
        this.add(tag);
      }
    });
  }
}

export const registerRegressionLine = () => {
  Factory.registerGraphicComponent(
    REGRESSION_LINE,
    (attrs: Required<RegressionLineAttrs>) => new RegressionLine(attrs) as unknown as IGraphic
  );
};
