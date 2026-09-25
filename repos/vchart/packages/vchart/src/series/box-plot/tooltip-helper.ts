import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { Datum, ITooltipLinePattern, TooltipActiveType } from '../../typings';
import { isValid } from '@visactor/vutils';
import { BOX_PLOT_OUTLIER_VALUE_FIELD, BOX_PLOT_TOOLTIP_KEYS } from '../../constant/box-plot';
import type { BoxPlotSeries } from './box-plot';

export class BoxPlotSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  /** 获取默认的tooltip pattern */
  protected getDefaultContentList(activeType: TooltipActiveType): ITooltipLinePattern[] {
    return [
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.OUTLIER),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.OUTLIER),
        shapeType: this.shapeTypeCallback,
        shapeColor: this.getOutlierFillColor,
        shapeStroke: this.getOutlierFillColor
      },
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.MAX),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.MAX)
      },
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.Q3),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.Q3)
      },
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.MEDIAN),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.MEDIAN)
      },
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.Q1),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.Q1)
      },
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.MIN),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.MIN)
      },
      {
        key: this.getContentKey(BOX_PLOT_TOOLTIP_KEYS.SERIES_FIELD),
        value: this.getContentValue(BOX_PLOT_TOOLTIP_KEYS.SERIES_FIELD)
      }
    ];
  }
  getContentKey = (contentType: BOX_PLOT_TOOLTIP_KEYS) => (datum: any) => {
    if (this.isOutlierMark(datum)) {
      if (contentType === BOX_PLOT_TOOLTIP_KEYS.OUTLIER) {
        //异常值mark
        return (this.series as BoxPlotSeries).getOutliersField();
      } else if (contentType === BOX_PLOT_TOOLTIP_KEYS.SERIES_FIELD) {
        const seriesField = (this.series as BoxPlotSeries).getSeriesField();
        return seriesField;
      }
      return null;
    }

    switch (contentType) {
      case BOX_PLOT_TOOLTIP_KEYS.MIN: {
        const minField = (this.series as BoxPlotSeries).getMinField();
        return minField;
      }
      case BOX_PLOT_TOOLTIP_KEYS.MAX: {
        const maxField = (this.series as BoxPlotSeries).getMaxField();
        return maxField;
      }
      case BOX_PLOT_TOOLTIP_KEYS.MEDIAN: {
        const medianField = (this.series as BoxPlotSeries).getMedianField();
        return medianField;
      }
      case BOX_PLOT_TOOLTIP_KEYS.Q1: {
        const q1Field = (this.series as BoxPlotSeries).getQ1Field();
        return q1Field;
      }
      case BOX_PLOT_TOOLTIP_KEYS.Q3: {
        const q3Field = (this.series as BoxPlotSeries).getQ3Field();
        return q3Field;
      }
      case BOX_PLOT_TOOLTIP_KEYS.SERIES_FIELD: {
        const seriesField = (this.series as BoxPlotSeries).getSeriesField();
        return seriesField;
      }
    }

    return null;
  };

  getContentValue = (contentType: BOX_PLOT_TOOLTIP_KEYS) => (datum: any) => {
    if (this.isOutlierMark(datum)) {
      if (contentType === BOX_PLOT_TOOLTIP_KEYS.OUTLIER) {
        //异常值mark
        return datum[BOX_PLOT_OUTLIER_VALUE_FIELD];
      } else if (contentType === BOX_PLOT_TOOLTIP_KEYS.SERIES_FIELD) {
        const seriesField = (this.series as BoxPlotSeries).getSeriesField();
        return datum[seriesField];
      }
      return null;
    }

    switch (contentType) {
      case BOX_PLOT_TOOLTIP_KEYS.MIN: {
        const minField = (this.series as BoxPlotSeries).getMinField();
        return datum[minField];
      }
      case BOX_PLOT_TOOLTIP_KEYS.MAX: {
        const maxField = (this.series as BoxPlotSeries).getMaxField();
        return datum[maxField];
      }
      case BOX_PLOT_TOOLTIP_KEYS.MEDIAN: {
        const medianField = (this.series as BoxPlotSeries).getMedianField();
        return datum[medianField];
      }
      case BOX_PLOT_TOOLTIP_KEYS.Q1: {
        const q1Field = (this.series as BoxPlotSeries).getQ1Field();
        return datum[q1Field];
      }
      case BOX_PLOT_TOOLTIP_KEYS.Q3: {
        const q3Field = (this.series as BoxPlotSeries).getQ3Field();
        return datum[q3Field];
      }
      case BOX_PLOT_TOOLTIP_KEYS.SERIES_FIELD: {
        const seriesField = (this.series as BoxPlotSeries).getSeriesField();
        return datum[seriesField];
      }
    }

    return null;
  };
  shapeColorCallback = (datum: Datum) => {
    const shaftShape = (this.series as BoxPlotSeries).getShaftShape();
    return shaftShape === 'line'
      ? (this.series.getMarkInName('boxPlot').getAttribute('stroke' as any, datum) as any)
      : (this.series.getMarkInName('boxPlot').getAttribute('fill' as any, datum) as any);
  };

  getOutlierFillColor = (datum: Datum) => {
    const outliersStyle = (this.series as BoxPlotSeries).getOutliersStyle();
    return outliersStyle?.fill ?? (this.series.getMarkInName('outlier')?.getAttribute('fill' as any, datum) as any);
  };
  isOutlierMark = (datum: Datum) => {
    return isValid(datum[BOX_PLOT_OUTLIER_VALUE_FIELD]);
  };
}
