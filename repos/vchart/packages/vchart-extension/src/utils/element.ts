import type { IRegion } from '@visactor/vchart';
export function getAllRegionBounds(regions: IRegion[]) {
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

  return {
    x1: minX,
    y1: minY,
    x2: maxX,
    y2: maxY
  };
}
