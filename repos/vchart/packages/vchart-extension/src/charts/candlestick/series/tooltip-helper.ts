import type { ISeriesTooltipHelper, Datum, ITooltipLinePattern, TooltipActiveType } from '@visactor/vchart';
import { BaseSeriesTooltipHelper } from '@visactor/vchart';
import { CANDLESTICK_TOOLTIP_KEYS } from './constant';
import type { CandlestickSeries } from './candlestick';

export class CandlestickSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  /** 获取默认的tooltip pattern */
  protected getDefaultContentList(activeType: TooltipActiveType): ITooltipLinePattern[] {
    return [
      {
        key: this.getContentKey(CANDLESTICK_TOOLTIP_KEYS.OPEN),
        value: this.getContentValue(CANDLESTICK_TOOLTIP_KEYS.OPEN)
      },
      {
        key: this.getContentKey(CANDLESTICK_TOOLTIP_KEYS.HIGH),
        value: this.getContentValue(CANDLESTICK_TOOLTIP_KEYS.HIGH)
      },
      {
        key: this.getContentKey(CANDLESTICK_TOOLTIP_KEYS.LOW),
        value: this.getContentValue(CANDLESTICK_TOOLTIP_KEYS.LOW)
      },
      {
        key: this.getContentKey(CANDLESTICK_TOOLTIP_KEYS.CLOSE),
        value: this.getContentValue(CANDLESTICK_TOOLTIP_KEYS.CLOSE)
      },
      {
        key: this.getContentKey(CANDLESTICK_TOOLTIP_KEYS.SERIES_FIELD),
        value: this.getContentValue(CANDLESTICK_TOOLTIP_KEYS.SERIES_FIELD)
      }
    ];
  }
  getContentKey = (contentType: CANDLESTICK_TOOLTIP_KEYS) => (datum: any) => {
    switch (contentType) {
      case CANDLESTICK_TOOLTIP_KEYS.OPEN: {
        const openField = (this.series as CandlestickSeries).getOpenField();
        return openField;
      }
      case CANDLESTICK_TOOLTIP_KEYS.HIGH: {
        const highField = (this.series as CandlestickSeries).getHighField();
        return highField;
      }
      case CANDLESTICK_TOOLTIP_KEYS.LOW: {
        const lowField = (this.series as CandlestickSeries).getLowField();
        return lowField;
      }
      case CANDLESTICK_TOOLTIP_KEYS.CLOSE: {
        const closeField = (this.series as CandlestickSeries).getCloseField();
        return closeField;
      }
      case CANDLESTICK_TOOLTIP_KEYS.SERIES_FIELD: {
        const seriesField = (this.series as CandlestickSeries).getSeriesField();
        return seriesField;
      }
    }

    return null;
  };

  getContentValue = (contentType: CANDLESTICK_TOOLTIP_KEYS) => (datum: any) => {
    switch (contentType) {
      case CANDLESTICK_TOOLTIP_KEYS.OPEN: {
        const openField = (this.series as CandlestickSeries).getOpenField();
        return datum[openField];
      }
      case CANDLESTICK_TOOLTIP_KEYS.HIGH: {
        const highField = (this.series as CandlestickSeries).getHighField();
        return datum[highField];
      }
      case CANDLESTICK_TOOLTIP_KEYS.LOW: {
        const lowField = (this.series as CandlestickSeries).getLowField();
        return datum[lowField];
      }
      case CANDLESTICK_TOOLTIP_KEYS.CLOSE: {
        const closeField = (this.series as CandlestickSeries).getCloseField();
        return datum[closeField];
      }
      case CANDLESTICK_TOOLTIP_KEYS.SERIES_FIELD: {
        const seriesField = (this.series as CandlestickSeries).getSeriesField();
        return datum[seriesField];
      }
    }

    return null;
  };
  shapeColorCallback = (datum: Datum) => {
    return this.series.getMarkInName('candlestick').getAttribute('stroke' as any, datum) as any;
  };
}
