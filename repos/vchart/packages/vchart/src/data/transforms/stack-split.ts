import type { ISeriesStackData, ISeriesStackDataLeaf, ISeriesStackDataNode } from '../../series/interface';
import { isFunction, isNil } from '@visactor/vutils';
import type { DataView } from '@visactor/vdataset';
import type { Datum } from '../../typings';

export interface IStackOption {
  fields: string[];
}

export type StackOption = IStackOption | (() => IStackOption);

export const stackSplit = (data: Array<DataView>, op: StackOption) => {
  const result: ISeriesStackData = {
    nodes: {}
  };
  const { fields } = isFunction(op) ? op() : op;
  if (!fields?.length) {
    return result;
  }
  const lastFieldIndex = fields.length - 1;
  let temp: ISeriesStackDataNode = result;
  let nextNode: ISeriesStackDataNode;
  let leaf: ISeriesStackDataLeaf;
  data.forEach(dv => {
    dv.latestData &&
      dv.latestData.forEach((d: Datum) => {
        temp = result;
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          const fV = d[f];
          if (isNil(fV)) {
            break;
          }
          temp.groupField = f;
          if (!temp.nodes[fV]) {
            if (i === lastFieldIndex) {
              temp.nodes[fV] = { values: [] };
            } else {
              nextNode = { nodes: {} };
              temp.nodes[fV] = nextNode;
            }
          }
          if (i === lastFieldIndex) {
            leaf = temp.nodes[fV] as ISeriesStackDataLeaf;
            leaf.values.push(d);
          } else {
            temp = temp.nodes[fV] as ISeriesStackDataNode;
          }
        }
      });
  });
  return result;
};
