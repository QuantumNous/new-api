import type { IAxis } from '@visactor/vchart';
import { isXAxis, isYAxis, isZAxis } from '@visactor/vchart';
import { getUpdateAttributeOfZAxis } from './util';

export class Axis3dMixin {
  layout3dBox?: { width: number; height: number; length: number };

  setLayout3dBox(box3d: { width: number; height: number; length: number }) {
    this.layout3dBox = box3d;
  }

  protected _afterUpdateAttribute(attrs: any, ignoreGrid: boolean) {
    const isZ = isZAxis((this as any)._orient);
    const isX = isXAxis((this as any)._orient);
    const isY = isYAxis((this as any)._orient);

    // 获取更新的坐标轴属性
    let regionHeight = 0;
    let regionWidth = 0;

    if (!ignoreGrid) {
      const regions = (this as any).getRegions();
      let { x: minX, y: minY } = regions[0].getLayoutStartPoint();
      let maxX = minX + regions[0].getLayoutRect().width;
      let maxY = minY + regions[0].getLayoutRect().height;
      for (let index = 1; index < regions.length; index++) {
        const region = regions[index];
        const { x, y } = region.getLayoutStartPoint();
        const { width, height } = region.getLayoutRect();
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, width + x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, height + y);
      }
      regionHeight = Math.abs(maxY - minY);
      regionWidth = Math.abs(maxX - minX);
    }

    let gridLength = 0;
    let axisLength = 0;
    const { width, height } = (this as any).getLayoutRect();
    let end = { x: 0, y: 0 };

    if (isX) {
      end = { x: width, y: 0 };
      gridLength = regionHeight;
      axisLength = width;
    } else if (isY) {
      end = { x: 0, y: height };
      gridLength = regionWidth;
      axisLength = height;
    }

    const depth = (this as any).layout3dBox ? (this as any).layout3dBox.length : 0;

    if (!isZ) {
      const items = (this as any).getLabelItems(axisLength);
      attrs.grid = {
        length: gridLength
      };
      attrs.start = { x: 0, y: 0 };
      attrs.text = (this as any)._spec.title.text || (this as any)._dataFieldText;
      attrs.maxWidth = (this as any)._getTitleLimit(isX);
      attrs.items = items;
      attrs.grid = {
        type: 'line',
        start: { x: 0, y: 0 },
        end,
        items: items[0],
        depth,
        length: gridLength
      };
      return attrs;
    }

    return getUpdateAttributeOfZAxis(this as unknown as IAxis, ignoreGrid);
  }
}
