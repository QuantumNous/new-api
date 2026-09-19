import { DataSet, DataView } from '@visactor/vdataset';
import { registerDataSetInstanceTransform } from '../../data/register';
import { dimensionTree } from '../../data/transforms/dimension-data';
import type { IGroup } from '../../typings';

export class Group implements IGroup {
  protected _fields: string[] = [];
  get fields() {
    return this._fields;
  }

  protected _groupData?: DataView;
  get groupData() {
    return this._groupData;
  }

  constructor(fields: string[]) {
    this._fields = fields;
  }

  initData(viewData: DataView, dataSet: DataSet) {
    const dataName = viewData.name;
    const groupData = new DataView(dataSet instanceof DataSet ? dataSet : viewData.dataSet);
    groupData.name = dataName;
    groupData.parse([viewData], {
      type: 'dataview'
    });
    registerDataSetInstanceTransform(dataSet, 'dimensionTree', dimensionTree);
    groupData.transform(
      {
        type: 'dimensionTree',
        options: {
          fields: this._fields
        }
      },
      false
    );
    groupData.target.addListener('change', this.groupDataUpdate.bind(this));
    this._groupData = groupData;
  }

  groupDataUpdate() {
    // do nothing
  }

  getGroupValueInField(field: string) {
    const values = this.groupData?.latestData?.dimensionValues?.[field];
    return values ? Array.from(values) : [];
  }
}
