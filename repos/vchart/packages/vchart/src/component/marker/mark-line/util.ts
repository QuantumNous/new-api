import type { IPoint } from '../../../typings';

export function getInsertPoints(
  start: IPoint,
  end: IPoint,
  direction: 'top' | 'bottom' | 'left' | 'right',
  offset: number = 0
) {
  const points: IPoint[] = [];
  const dy = start.y - end.y;
  const dx = start.x - end.x;

  switch (direction) {
    case 'top':
      points.push(start);
      points.push({
        x: start.x,
        y: dy > 0 ? start.y - offset - Math.abs(dy) : start.y - offset
      });
      points.push({
        x: end.x,
        y: dy > 0 ? end.y - offset : end.y - offset - Math.abs(dy)
      });
      points.push(end);
      break;
    case 'bottom':
      points.push(start);
      points.push({ x: start.x, y: dy < 0 ? start.y + offset + Math.abs(dy) : start.y + offset });
      points.push({ x: end.x, y: dy < 0 ? end.y + offset : end.y + offset + Math.abs(dy) });
      points.push(end);
      break;
    case 'left':
      points.push(start);
      points.push({
        x: dx > 0 ? start.x - offset - Math.abs(dx) : start.x - offset,
        y: start.y
      });
      points.push({
        x: dx > 0 ? end.x - offset : end.x - offset - Math.abs(dx),
        y: end.y
      });
      points.push(end);
      break;
    case 'right':
      points.push(start);
      points.push({
        x: dx > 0 ? start.x + offset : start.x + offset + Math.abs(dx),
        y: start.y
      });
      points.push({
        x: dx > 0 ? end.x + offset + Math.abs(dx) : end.x + offset,
        y: end.y
      });
      points.push(end);
      break;
    default:
      break;
  }
  return points;
}

export function getTextOffset(
  start: IPoint,
  end: IPoint,
  direction: 'top' | 'bottom' | 'left' | 'right',
  offset: number = 0
) {
  const dy = start.y - end.y;
  const dx = start.x - end.x;

  if (direction === 'bottom') {
    return {
      dx: dx > 0 ? -dx / 2 : Math.abs(dx / 2),
      dy: dy > 0 ? offset : Math.abs(dy) + offset
    };
  }

  if (direction === 'top') {
    return {
      dx: dx > 0 ? -Math.abs(dx / 2) : +Math.abs(dx / 2),
      dy: dy > 0 ? -(Math.abs(dy) + offset) : -offset
    };
  }

  if (direction === 'left') {
    return {
      dx: dx > 0 ? -dx - offset : -offset,
      dy: dy > 0 ? -(dy / 2) : Math.abs(dy / 2)
    };
  }

  if (direction === 'right') {
    return {
      dx: dx > 0 ? offset : Math.abs(dx) + offset,
      dy: dy > 0 ? -(dy / 2) : Math.abs(dy / 2)
    };
  }

  return {};
}
