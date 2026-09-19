import type { Datum } from '../../typings';
import { findHierarchyNode, findHierarchyNodeParent } from '../../util/hierarchy';
import { array, isNil } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports

export enum DrillEnum {
  DrillDown = 'drillDown',
  DrillUp = 'drillUp'
}

export type DrillInfo = {
  key: string;
  type: DrillEnum;
  path: string[];
};

/**
 * 通用的上卷下钻的数据过滤方法.
 */
export const drillFilter = (
  data: Array<Datum>,
  op: {
    info: () => DrillInfo;
    keyField: () => string;
  }
) => {
  // 根据key找到节点
  const info = op.info();
  const keyField = op.keyField();
  const dataKey = info?.key;

  if (isNil(dataKey)) {
    return data;
  }

  // 下钻, 找到当前选中节点
  if (info.type === DrillEnum.DrillDown) {
    const targetNode = findHierarchyNode(data, dataKey, keyField, 'children');
    return array(targetNode);
  }

  // 上卷, 找到当前选中节点的父节点
  if (info.type === DrillEnum.DrillUp) {
    const targetNode = findHierarchyNodeParent(data, dataKey, keyField, 'children');
    if (targetNode) {
      return array(targetNode);
    }
  }
  return data;
};
