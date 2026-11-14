import { vennTransform } from '@visactor/vlayouts';
import { isFunction } from '@visactor/vutils';

interface IVennLayoutOptions {
  setField: string;
  valueField: string;
  getViewBox: () => {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
}

export const vennLayout = (
  data: Array<Record<string, unknown>>,
  op: IVennLayoutOptions | (() => IVennLayoutOptions)
) => {
  const options = isFunction(op) ? op() : op;
  const viewBox = options.getViewBox();

  if (viewBox && data?.length) {
    return vennTransform(
      {
        setField: options.setField,
        valueField: options.valueField,
        ...viewBox
      },
      data
    );
  }

  return [];
};
