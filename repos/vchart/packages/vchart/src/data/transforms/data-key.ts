import { DEFAULT_DATA_INDEX, DEFAULT_DATA_KEY, DEFAULT_DATA_SERIES_FIELD } from '../../constant/data';
import type { BaseSeries } from '../../series/base/base-series';
import type { TreemapSeries } from '../../series/treemap/treemap';
import type { AddVChartPropertyContext } from './add-property';
import {
  DEFAULT_HIERARCHY_DEPTH,
  DEFAULT_HIERARCHY_ROOT,
  DEFAULT_HIERARCHY_ROOT_INDEX
} from '../../constant/hierarchy';
import type { SunburstSeries } from '../../series/sunburst/sunburst';
import type { CirclePackingSeries } from '../../series/circle-packing/circle-packing';

export function initKeyMap(this: BaseSeries<any>) {
  return {
    keyMap: new Map(),
    needDefaultSeriesField: !this._seriesField,
    defaultSeriesField: !this._seriesField ? this.getSeriesKeys()[0] : null,
    getKey: this.generateDefaultDataKey(this._spec.dataKey)
  };
}

export function addDataKey(d: any, i: number, context: AddVChartPropertyContext) {
  if (!d) {
    return;
  }
  if (context.needDefaultSeriesField) {
    d[DEFAULT_DATA_SERIES_FIELD] = context.defaultSeriesField;
  }
  d[DEFAULT_DATA_INDEX] = i;
  d[DEFAULT_DATA_KEY] = context.getKey(d, i, context);
}

export function initHierarchyKeyMap(this: TreemapSeries | SunburstSeries | CirclePackingSeries) {
  return {
    keyMap: new Map(),
    needDefaultSeriesField: true,
    defaultSeriesField: this.getSeriesKeys()[0],
    getKey: (this as any).generateDefaultDataKey((this as any)._spec.dataKey),
    categoryField: this.getCategoryField()
  };
}

export function addHierarchyDataKey(
  d: any,
  i: number,
  context: AddVChartPropertyContext,
  depth: number = 0,
  root?: string,
  rootIndex?: number
) {
  if (rootIndex === undefined) {
    rootIndex = i;
  }
  addDataKey(d, i, context);
  d[DEFAULT_HIERARCHY_DEPTH] = depth;
  d[DEFAULT_HIERARCHY_ROOT] = root || d[context.categoryField];
  d[DEFAULT_HIERARCHY_ROOT_INDEX] = rootIndex;
  if (d.children && d.children.length) {
    d.children.forEach((_d: any, _i: number) =>
      addHierarchyDataKey(_d, _i, context, d[DEFAULT_HIERARCHY_DEPTH] + 1, d[DEFAULT_HIERARCHY_ROOT], rootIndex)
    );
  }
}
