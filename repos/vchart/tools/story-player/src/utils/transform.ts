import { Matrix } from '@visactor/vutils';

export const getTransformPointFunc = (offsetX: number, offsetY: number, scaleX: number, scaleY: number) => {
  const m = new Matrix().translate(-offsetX, -offsetY).setScale(1 / scaleX, 1 / scaleY);
  return (x: number, y: number) => {
    const point = { x: 0, y: 0 };
    m.transformPoint({ x, y }, point);
    return point;
  };
};

export const getPixelNumber = (value: string) => {
  if (value.endsWith('px')) {
    return parseFloat(value.slice(0, value.length - 2));
  }
  return parseFloat(value);
};
