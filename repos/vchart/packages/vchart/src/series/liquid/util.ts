import type { LiquidShapeType } from './interface';

export const getShapes = (shapesType: LiquidShapeType, size: number) => {
  if (shapesType === 'drop') {
    return pin(0, 0, size);
  }
  return shapesType;
};

/* Adapted from liquid shapes by ai-qing-hai and hustcc
 * https://github.com/antvis/G2
 * Licensed under the MIT

 * url: https://github.com/antvis/G2/blob/v5/src/shape/liquid/shapes.ts
 * License: https://github.com/antvis/G2/blob/v5/LICENSE
 * @license
 */
function pin(x: number, y: number, radius: number) {
  const w = (radius * 4) / 3;
  const h = Math.max(w, radius * 2);
  const r = w / 2;

  // Attrs of the upper circle.
  const cx = x;
  const cy = r + y - h / 2;
  const theta = Math.asin(r / ((h - r) * 0.85));
  const dy = Math.sin(theta) * r;
  const dx = Math.cos(theta) * r;

  // The start point of the path.
  const x0 = cx - dx;
  const y0 = cy + dy;

  // Control point.
  const cpX = x;
  const cpY = cy + r / Math.sin(theta);

  return `
      M ${x0} ${y0}
      A ${r} ${r} 0 1 1 ${x0 + dx * 2} ${y0}
      Q ${cpX} ${cpY} ${x} ${y + h / 2}
      Q ${cpX} ${cpY} ${x0} ${y0}
      Z 
    `;
}
