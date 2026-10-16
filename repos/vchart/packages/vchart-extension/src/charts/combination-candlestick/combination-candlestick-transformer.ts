import type { ICommonChartSpec, ICartesianSeriesSpec, IDataType, IGridLayoutSpec, IOrientType } from '@visactor/vchart';
import { CartesianChartSpecTransformer, isPercent } from '@visactor/vchart';
import type { ICombinationCandlestickChartSpec } from './interface';
import { merge, array } from '@visactor/vchart';
import { transformCandlestickSeriesSpec } from '../candlestick';
import type { ICandlestickSeriesSpec } from '../candlestick/series/interface';

/**
 * @description 组合蜡烛图 spec a转换
 */
export class CombinationCandlestickChartSpecTransformer<
  T extends ICombinationCandlestickChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected needAxes(): boolean {
    return true;
  }

  transformSpec(spec: T): void {
    this.transformRegion(spec);
    if (spec.tooltip === undefined) {
      spec.tooltip = {};
    }
    this.transformSeriesSpec(spec);
    this._transformAxisSpec(spec);
    this._transformLayout(spec);
  }

  transformRegion(spec: T): void {
    const commonSpec = spec as unknown as ICommonChartSpec;
    commonSpec.region = [spec.candlestickRegion ?? {}];
    if (spec.previewSeries) {
      commonSpec.region.push(spec.previewRegion ?? {});
    }
  }

  transformSeriesSpec(spec: T): void {
    // 单独的系列转换
    spec.series = spec.series ?? [];
    spec.series.forEach(s => {
      this._transformSeriesData(spec, s);
      s.regionIndex = 0;
    });
    const tempCandlestickSeries = spec.series.find(s => s.id === spec.candlestickSeries.id) as ICandlestickSeriesSpec;
    let candlestickSpec;
    if (tempCandlestickSeries) {
      merge(tempCandlestickSeries, spec.candlestickSeries);
      candlestickSpec = tempCandlestickSeries;
    } else {
      spec.series.push(spec.candlestickSeries);
      candlestickSpec = spec.candlestickSeries;
    }
    transformCandlestickSeriesSpec(candlestickSpec);
    this._transformSeriesData(spec, candlestickSpec);
    candlestickSpec.regionIndex = 0;

    if (spec.previewSeries) {
      array(spec.previewSeries).forEach(previewSeries => {
        const tempPreviewSeries = spec.series.find(s => s.id === previewSeries.id);
        let previewSeriesSpec;
        if (tempPreviewSeries) {
          merge(tempPreviewSeries, previewSeries);
          previewSeriesSpec = tempPreviewSeries;
        } else {
          spec.series.push(previewSeries);
          previewSeriesSpec = previewSeries;
        }
        previewSeriesSpec.regionIndex = 1;
        this._transformSeriesData(spec, previewSeriesSpec);
      });
    }
  }

  private _transformSeriesData(spec: T, seriesSpec: ICartesianSeriesSpec) {
    if (seriesSpec.data) {
      spec.data = array(spec.data ?? []);
      array(seriesSpec.data).forEach((d, index) => {
        (spec.data as IDataType[]).push(d);
        if (index === 0) {
          seriesSpec.dataIndex = (spec.data as IDataType[]).length - 1;
          if ('id' in d) {
            seriesSpec.dataId = d.id;
          } else if ('name' in d) {
            seriesSpec.dataId = d.name;
          }
        }
      });
      delete seriesSpec.data;
    }
  }

  protected _transformAxisSpec(spec: T) {
    super._transformAxisSpec(spec);
    if (!spec.previewSeries) {
      return;
    }
    if (!spec.previewAxes) {
      spec.previewAxes = {
        type: 'linear',
        orient: 'left',
        visible: false
      };
    }
    spec.previewAxes.regionIndex = [1];
    spec.axes.push(spec.previewAxes);

    spec.axes.forEach(axis => {
      if (axis === spec.previewAxes) {
        return;
      }
      if (axis.orient === 'left' || axis.orient === 'right') {
        axis.regionIndex = [0];
      }
    });
  }

  protected _transformDataZoomSpec(spec: T) {
    if (spec.dataZoom) {
      array(spec.dataZoom).forEach(dataZoom => {
        if (dataZoom.orient === 'left' || dataZoom.orient === 'right') {
          dataZoom.regionIndex = [0];
        }
      });
    }
  }

  protected _transformLayout(spec: T) {
    const layout: IGridLayoutSpec = {
      type: 'grid',
      col: 2,
      row: 6,
      elements: [],
      colWidth: [],
      rowHeight: []
    };
    // 创建布局的临时计算属性
    let totalRow = 0;
    let totalCol = 0;
    // 先获取总计的行和列
    // 如果有 title
    if (spec.title && spec.title?.visible !== false) {
      totalRow++;
    }
    // 图例
    if (spec.legends) {
      const firstLegend = array(spec.legends)[0];
      if (firstLegend?.visible !== false) {
        if (firstLegend.orient === 'top' || firstLegend.orient === 'bottom') {
          totalRow++;
        } else {
          totalCol++;
        }
      }
    }
    // datazoom
    if (spec.dataZoom) {
      array(spec.dataZoom).forEach(dataZoom => {
        if (dataZoom?.visible !== false) {
          if (dataZoom.orient === 'top' || dataZoom.orient === 'bottom') {
            totalRow++;
          } else {
            totalCol++;
          }
        }
      });
    }
    // 轴
    if (spec.axes) {
      const hasLayout = {
        top: false,
        bottom: false,
        left: false,
        right: false,
        z: false
      };
      array(spec.axes).forEach(axis => {
        if (hasLayout[axis.orient]) {
          return;
        }
        hasLayout[axis.orient] = true;
        if (axis.orient === 'top' || axis.orient === 'bottom') {
          totalRow++;
        } else {
          totalCol++;
        }
      });
    }
    // 系列
    totalRow++;
    totalCol++;
    // 预览系列
    if (spec.previewSeries) {
      totalRow++;
    }
    layout.row = totalRow;
    layout.col = totalCol;

    const temp = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    };
    // 开始布局
    if (spec.title && spec.title?.visible !== false) {
      this._layoutOrientItem(layout, spec.title, temp, { specKey: 'title', index: 0 }, 'total');
    }
    // 图例
    if (spec.legends) {
      const firstLegend = array(spec.legends)[0];
      if (firstLegend?.visible !== false) {
        this._layoutOrientItem(
          layout,
          firstLegend as { orient: IOrientType },
          temp,
          { specKey: 'legends', index: 0 },
          'less'
        );
      }
    }
    // datazoom
    if (spec.dataZoom) {
      array(spec.dataZoom).forEach((dataZoom, index) => {
        if (dataZoom?.visible === false) {
          return;
        }
        this._layoutOrientItem(
          layout,
          dataZoom as { orient: IOrientType },
          temp,
          { specKey: 'dataZoom', index },
          'one'
        );
      });
    }
    // 轴 先只布局左右
    if (spec.axes) {
      const hasLayout = {
        left: false,
        right: false
      };
      spec.axes.forEach((axis, index) => {
        if (axis.orient !== 'left' && axis.orient !== 'right') {
          return;
        }
        if (hasLayout[axis.orient]) {
          return;
        }
        hasLayout[axis.orient] = true;
        this._layoutOrientItem(layout, axis as { orient: IOrientType }, temp, { specKey: 'axes', index }, 'one');
      });
    }
    // region
    const regionLayout = this._layoutOrientItem(
      layout,
      { orient: 'top' },
      temp,
      { specKey: 'region', index: 0 },
      'one'
    );

    // 预览图region
    if (spec.previewSeries) {
      const regionLayout = this._layoutOrientItem(
        layout,
        { orient: 'bottom' },
        temp,
        { specKey: 'region', index: 1 },
        'one'
      );
      const previewAxesIndex = spec.axes.findIndex(axis => axis === spec.previewAxes);
      if (previewAxesIndex !== -1) {
        const previewAxesLayout = {
          col: regionLayout.col - 1,
          row: regionLayout.row,
          modelKey: 'axes',
          modelIndex: previewAxesIndex
        };
        layout.elements.push(previewAxesLayout);
      }
      if (spec.previewHeight) {
        if (typeof spec.previewHeight === 'string') {
          if (isPercent(spec.previewHeight)) {
            const heightStr = spec.previewHeight;
            layout.rowHeight.push({
              index: regionLayout.row,
              size: (size: number) => (Number(heightStr.substring(0, heightStr.length - 1)) * size) / 100
            });
          }
        } else {
          layout.rowHeight.push({
            index: regionLayout.row,
            size: spec.previewHeight
          });
        }
      }
    }

    // 下轴
    const bottomAxesIndex = spec.axes.findIndex(axis => axis.orient === 'bottom');
    this._layoutOrientItem(
      layout,
      spec.axes[bottomAxesIndex],
      temp,
      { specKey: 'axes', index: bottomAxesIndex },
      'one'
    );

    // 修正axes,datazoom
    spec.axes.forEach((axis, index) => {
      // 预览图的轴已处理
      if (axis === spec.previewAxes) {
        return;
      }
      const axisLayout = layout.elements.find(
        item => 'modelKey' in item && item.modelKey === 'axes' && item.modelIndex === index
      );
      if (axisLayout) {
        if (axis.orient === 'top' || axis.orient === 'bottom') {
          axisLayout.col = regionLayout.col;
        } else {
          axisLayout.row = regionLayout.row;
        }
      }
    });
    // 修正datazoom
    array(spec.dataZoom).forEach((dataZoom, index) => {
      const dataZoomLayout = layout.elements.find(
        item => 'modelKey' in item && item.modelKey === 'dataZoom' && item.modelIndex === index
      );
      if (dataZoomLayout) {
        if (dataZoom.orient === 'top' || dataZoom.orient === 'bottom') {
          dataZoomLayout.col = regionLayout.col;
        } else {
          dataZoomLayout.row = regionLayout.row;
        }
      }
    });

    spec.layout = layout;
  }

  private _layoutOrientItem(
    layout: IGridLayoutSpec,
    modelSpec: { orient?: IOrientType },
    temp: { top: number; bottom: number; left: number; right: number },
    modelInfo: { specKey: string; index: number },
    spanType: 'total' | 'one' | 'less'
  ) {
    const modelLayout: IGridLayoutSpec['elements'][number] = {
      modelKey: modelInfo.specKey,
      modelIndex: modelInfo.index,
      col: 0,
      row: 0
    };
    const orient = modelSpec.orient ?? 'top';
    const { span, index } = this._getLayoutElementCommon(layout, temp, spanType, orient);
    layout.elements.push(modelLayout);
    if (orient === 'top') {
      modelLayout.row = temp.top;
      modelLayout.rowSpan = 1;
      modelLayout.colSpan = span;
      modelLayout.col = index;
      temp.top++;
    } else if (orient === 'bottom') {
      modelLayout.row = layout.row - temp.bottom - 1;
      modelLayout.rowSpan = 1;
      modelLayout.colSpan = span;
      modelLayout.col = index;
      temp.bottom++;
    } else if (orient === 'left') {
      modelLayout.col = temp.left;
      modelLayout.colSpan = 1;
      modelLayout.rowSpan = span;
      modelLayout.row = index;
      temp.left++;
    } else if (orient === 'right') {
      modelLayout.col = layout.col - temp.right - 1;
      modelLayout.colSpan = 1;
      modelLayout.rowSpan = span;
      modelLayout.row = index;
      temp.right++;
    }
    return modelLayout;
  }

  private _getLayoutElementCommon(
    layout: IGridLayoutSpec,
    temp: { top: number; bottom: number; left: number; right: number },
    span: 'total' | 'one' | 'less',
    orient: IOrientType
  ) {
    if (orient === 'top' || orient === 'bottom') {
      return {
        span: span === 'total' ? layout.col : span === 'one' ? 1 : layout.col - temp.left - temp.right,
        index: span === 'total' ? 0 : temp.left
      };
    }
    return {
      span: span === 'total' ? layout.row : span === 'one' ? 1 : layout.row - temp.top - temp.bottom,
      index: span === 'total' ? 0 : temp.top
    };
  }
}
