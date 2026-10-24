import { array } from '@visactor/vutils';
import type { IData } from './../../typings/spec/common';
import { DataView } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import type { DataSet } from '@visactor/vdataset';
import type { IDataValues, StringOrNumber } from '../../typings';
import { dataToDataView, updateDataViewInData } from '../../data/initialize';
import { warn } from '../../util/debug';
export class ChartData {
  protected _dataArr: DataView[] = [];
  get dataList() {
    return this._dataArr;
  }

  protected _dataSet: DataSet;

  constructor(dataSet: DataSet) {
    this._dataSet = dataSet;
  }

  parseData(dataSpec: IData) {
    this._dataArr = [];
    const list = array(dataSpec);
    for (let i = 0; i < list.length; i++) {
      this._dataArr.push(dataToDataView(list[i], this._dataSet, this._dataArr));
    }
  }

  updateData(dataSpec: IData, fullUp: boolean = false, forceMerge: boolean = true) {
    const list = array(dataSpec);
    if (fullUp && list.length !== this._dataArr.length) {
      return false;
    }
    this._dataValueForEach(list, (_data, dv) => {
      dv.markRunning();
    });
    this._dataValueForEach(list, (data, dv) => {
      updateDataViewInData(dv, data, forceMerge);
    });
    return true;
  }

  private _dataValueForEach(
    list: (IDataValues | DataView)[],
    callBack: (data: IDataValues, dv: DataView, index: number) => void
  ) {
    list.forEach((data, i) => {
      if (data instanceof DataView) {
        // ignore DataView, it should be update by use DataView api
        return;
      }
      const dv = this.getSeriesData(data.id, i);
      if (!dv) {
        return;
      }

      callBack(data, dv, i);
    });
  }

  getSeriesData(id: StringOrNumber | undefined, index: number | undefined): DataView | undefined {
    if (!this._dataArr.length) {
      return null;
    }

    // dataId 优先
    if (typeof id === 'string') {
      const metchData = this._dataArr.filter((data: any) => {
        return data.name === id;
      });

      if (metchData[0]) {
        return metchData[0];
      }
      warn(`no data matches dataId ${id}!`);
    }

    // 其次使用dataIndex
    if (typeof index === 'number') {
      if (this._dataArr[index]) {
        return this._dataArr[index];
      }

      warn(`no data matches dataIndex ${index}!`);
    }

    // 最后返回第一条数据
    return this._dataArr[0];
  }
}
