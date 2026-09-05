import { isObject } from '@visactor/vutils';

/**
 * 根据Key, 找到对应节点
 * @param hierarchyData
 * @param key
 * @param keyField
 * @param childrenField
 * @returns
 */
export const findHierarchyNode = <T>(
  hierarchyData: T[],
  key: string,
  keyField = 'key',
  childrenField = 'children'
): T | null => {
  for (let i = 0; i < hierarchyData.length; i++) {
    const node = hierarchyData[i];
    if (node[keyField] === key) {
      return node;
    }
    if (node[childrenField]) {
      const result = findHierarchyNode<T>(node[childrenField], key, keyField, childrenField);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

/**
 * 根据key, 找到对应节点的父节点
 * @param hierarchyData
 * @param key
 * @param keyField
 * @param childrenField
 * @returns
 */
export const findHierarchyNodeParent = <T>(
  hierarchyData: T[],
  key: string,
  keyField = 'key',
  childrenField = 'children'
): T | null => {
  for (let i = 0; i < hierarchyData.length; i++) {
    const node = hierarchyData[i];
    if (node[childrenField]) {
      for (let j = 0; j < node[childrenField].length; j++) {
        const childNode = node[childrenField][j];
        if (childNode[keyField] === key) {
          return node;
        }
        const result = findHierarchyNodeParent<T>([childNode], key, keyField, childrenField);
        if (result) {
          return result;
        }
      }
    }
  }
  return null;
};

/**
 * 回溯遍历多叉树, 找到给定key的路径.
 * @param hierarchyData
 * @param key
 * @param keyField
 * @param childrenField
 * @returns
 */
export const findHierarchyPath = <T>(
  hierarchyData: T[],
  key: string,
  keyField = 'key',
  childrenField = 'children'
): string[] => {
  const result: string[] = [];
  const dfs = (data: T[], path: string[]): boolean => {
    for (const item of data) {
      if (item[keyField] === key) {
        result.push(...path, item[keyField].toString());
        return true;
      }

      if (item[childrenField]) {
        const res = dfs(item[childrenField], [...path, item[keyField]]);
        if (res === true) {
          return res;
        }
      }
    }
    return false;
  };
  dfs(hierarchyData, []);
  return result;
};

export function isHierarchyItem(item: Object, valueField = 'value', childrenField = 'children') {
  // 检查 item 是否为对象且不为 null
  if (!isObject(item)) {
    return false;
  }

  // 检查 item 是否包含 childrenKey 属性且其值为数组
  if (item.hasOwnProperty(childrenField)) {
    return Array.isArray(item[childrenField]);
  }

  return false;
}

export function filterHierarchyDataByRange(
  data: any[],
  minValue: number,
  maxValue: number,
  valueField = 'value',
  childrenField = 'children'
) {
  if (!Array.isArray(data)) {
    return data;
  }

  return data
    .map(item => {
      const newItem = { ...item };
      if (Array.isArray(newItem[childrenField])) {
        newItem[childrenField] = filterHierarchyDataByRange(
          newItem[childrenField],
          minValue,
          maxValue,
          valueField,
          childrenField
        );
      }
      return newItem;
    })
    .filter(
      item =>
        (+item[valueField] >= minValue && +item[valueField] <= maxValue) ||
        (item[childrenField] && item[childrenField].length > 0)
    );
}
