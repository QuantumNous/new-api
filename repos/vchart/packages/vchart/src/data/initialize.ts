import { warn } from '../util/debug';
import { isString, cloneDeep } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { DataSet, DataView } from '@visactor/vdataset';
import type { IDataViewOptions, IFields, ITransformOptions } from '@visactor/vdataset';
import type { IDataValues, SheetParseOptions } from '../typings/spec/common';
import { registerDataSetInstanceTransform } from './register';
import { copyDataView } from './transforms/copy-data-view';
import type { IParserOptions } from '@visactor/vdataset';

export function initializeData() {
  // todo
}

export function initCSVData() {
  // todo
}

export function initData() {
  // todo
}

export function initFoldData() {
  // todo
}

export function dataViewFromDataView(rawData: DataView, dataSet?: DataSet, op?: IDataViewOptions) {
  dataSet = dataSet instanceof DataSet ? dataSet : rawData.dataSet;
  registerDataSetInstanceTransform(dataSet, 'copyDataView', copyDataView);
  const viewData = new DataView(dataSet, op);
  viewData.parse([rawData], {
    type: 'dataview'
  });
  viewData.transform({
    type: 'copyDataView',
    level: TransformLevel.copyDataView
  });
  return viewData;
}

/**
 * 将数据实例化为 DataView
 * @param data 数据
 * @param dataSet 数据集
 * @returns
 */
export function dataToDataView(data: DataView | IDataValues, dataSet: DataSet, sourceDataViews: DataView[] = []) {
  if (data instanceof DataView) {
    return data;
  }

  const { id, values = [], fromDataIndex, fromDataId, transforms = [] } = data;
  const parser = (data.parser ? cloneDeep(data.parser) : { clone: true }) as IParserOptions;
  const fields = cloneDeep(data.fields);
  // set parser.clone default value to true
  parser.clone = !(parser.clone === false);
  let dataView: DataView;
  const existDataView = sourceDataViews.find(dv => dv.name === id);
  if (existDataView) {
    dataView = existDataView;
  } else {
    const initOption: IDataViewOptions = { name: id };
    // fields 支持在dataView初始化参数中传入
    if (fields) {
      initOption.fields = fields as IFields;
    }
    dataView = new DataView(dataSet, initOption);
    if (typeof fromDataId === 'string') {
      // 使用id查找上游dataview
      const fromDataView = sourceDataViews.find(dv => dv.name === fromDataId);
      if (!fromDataView) {
        warn(`no data matches fromDataId ${fromDataId}`);
        return null;
      }

      dataView.parse([fromDataView], {
        type: 'dataview'
      });
      dataView.transform({
        type: 'copyDataView'
      });
    } else if (typeof fromDataIndex === 'number') {
      // 使用index查找上游dataview
      const fromDataView = sourceDataViews[fromDataIndex];
      if (!fromDataView) {
        warn(`no data matches fromDataIndex ${fromDataIndex}`);
        return null;
      }

      dataView.parse([fromDataView], {
        type: 'dataview'
      });
      dataView.transform({
        type: 'copyDataView'
      });
    } else if (Array.isArray(values)) {
      dataView.parse(values, parser);
    } else if (isString(values) && (!parser || ['csv', 'dsv', 'tsv'].includes((parser as SheetParseOptions).type))) {
      // 内置 csv parser
      dataView.parse(values, (parser as SheetParseOptions) ?? { type: 'csv' });
    } else {
      // 如果 values 不符合要求，则默认设置为 []，同时打印错误信息
      dataView.parse([]);
      warn('values should be array');
    }
    // 处理transform
    if (transforms && transforms.length) {
      transforms.forEach((transform: ITransformOptions) => {
        if (dataSet.getTransform(transform.type)) {
          dataView.transform(transform);
        }
      });
    }
  }

  return dataView;
}

export function updateDataViewInData(dataView: DataView, data: IDataValues, forceMerge: boolean) {
  if (!dataView) {
    return;
  }
  if (data.fields) {
    dataView.setFields(data.fields as any, forceMerge);
  }
  dataView.parseNewData(data.values, data.parser as any);
}

export enum TransformLevel {
  copyDataView = -10,

  treemapFilter = -8,
  treemapFlatten = -7,

  dotObjFlat = -7,
  linkDotInfo = -7,
  sankeyLayout = -7,

  dataZoomFilter = -6,
  legendFilter = -5
}
