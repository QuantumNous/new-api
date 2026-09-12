import type { ICandlestickSeriesTheme } from '../series/interface';

export const getCandlestickTheme = (): ICandlestickSeriesTheme => {
  const res: ICandlestickSeriesTheme = {
    rising: {
      style: {
        boxFill: '#FF0000',
        stroke: '#FF0000'
      }
    },
    falling: {
      style: {
        boxFill: '#00AA00',
        stroke: '#00AA00'
      }
    },
    doji: {
      style: {
        boxFill: '#000000',
        stroke: '#000000'
      }
    },
    candlestick: {
      style: {
        lineWidth: 1
      }
    }
  };
  return res;
};

export const candlestick: ICandlestickSeriesTheme = getCandlestickTheme();
