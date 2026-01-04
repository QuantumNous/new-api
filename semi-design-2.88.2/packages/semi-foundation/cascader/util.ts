import {
    isNull,
    isUndefined,
    isEqual
} from 'lodash';
import { strings, VALUE_SPLIT } from './constants';

function getPosition(level: any, index: any) {
    return `${level}-${index}`;
}

export function isValid(val: any) {
    return !isNull(val) && !isUndefined(val);
}

export function normalizedArr(val: any) {
    if (!Array.isArray(val)) {
        return [val];
    } else {
        return val;
    }
}

/**
 * @returns whether option includes sugInput.
 * When filterTreeNode is a function,returns the result of filterTreeNode which called with (sugInput, target, option).
 */
export function filter(sugInput: string, option: any, filterTreeNode: any, filteredPath?: string[]) {
    if (!filterTreeNode) {
        return true;
    }
    let filterFn = filterTreeNode;
    let target: string;
    if (typeof filterTreeNode === 'boolean') {
        filterFn = (targetVal: string, val: string) => {
            const input = targetVal.toLowerCase();
            return val
                .toLowerCase()
                .includes(input);
        };
        // 当 filterTreeNode 是 bool 类型时，由 Cascader 内部判断是否符合筛选条件，使用 join('') 修复搜索英文逗号导致所有数据被匹配问题
        // When the type of of filterTreeNode is bool, Cascader internally determines whether it meets the filtering conditions.
        // Use join('') to fix the problem that searching for English commas causes all data to be matched.
        target = filteredPath.join('');
    } else {
        // 当 filterTreeNode 为函数类型时，由用户判断是否符合筛选条件，使用 join(), 和原来保持一致
        // When the type of of filterTreeNode is function, the user determines whether it meets the filtering conditions, 
        // uses join() to be consistent with the previous version.
        target = filteredPath.join();
    }
    return filterFn(sugInput, target, option);
}

/**
 * Traverse all the data by `treeData`.
 */
function traverseDataNodes(treeNodes: any, callback: any) {
    const processNode = (node: any, ind?: any, parent?: any) => {
        const children = node ? node.children : treeNodes;
        let item: any = null;
        // Process node if is not root
        if (node) {
            const key = parent ? `${parent.key}${VALUE_SPLIT}${node.value}` : `${node.value}`;
            const pos = parent ? getPosition(parent.pos, ind) : `${ind}`;
            item = {
                data: { ...node },
                ind,
                key,
                pos,
                level: parent ? parent.level + 1 : 0,
                parentKey: parent ? parent.key : null,
                path: parent ? [...parent.path, key] : [key],
                valuePath: parent ? [...parent.valuePath, node.value] : [node.value]
            };

            callback(item);
        }

        // Process children node
        if (children) {
            children.forEach((subNode: any, subIndex: any) => {
                processNode(subNode, subIndex, item);
            });
        }
    };

    processNode(null);
}

export function getKeysByValuePath(valuePath: (string | number)[][] | (string | number)[]) {
    if (valuePath?.length) {
        if (Array.isArray(valuePath[0])) {
            return valuePath.map((item) => getKeyByValuePath(item));
        } else {
            return [getKeyByValuePath(valuePath as (string | number)[])];
        }
    }
    return [];
}

export function getKeyByValuePath(valuePath: (string | number)[]) {
    return valuePath.join(VALUE_SPLIT);
}

export function getValuePathByKey(key: string) {
    return key.split(VALUE_SPLIT);
}

export function getKeyByPos(pos: string, treeData: any) {
    const posArr = pos.split('-').map(item => Number(item));
    let resultData = treeData;
    let valuePath = [];
    posArr.forEach((item, index) => {
        resultData = index === 0 ? resultData[item] : resultData?.children?.[item];
        valuePath.push(resultData?.value);
    });
    return getKeyByValuePath(valuePath);
}

export function convertDataToEntities(dataNodes: any) {
    const keyEntities: any = {};

    traverseDataNodes(dataNodes, (data: any) => {
        const { key, parentKey } = data;
        const entity = { ...data };

        keyEntities[key] = entity;

        // Fill children
        entity.parent = keyEntities[parentKey];
        if (entity.parent) {
            entity.parent.children = entity.parent.children || [];
            entity.parent.children.push(entity);
        }
    });
    return keyEntities;
}

export function calcMergeType(autoMergeValue: boolean, leafOnly: boolean): string {
    let mergeType: string;
    if (leafOnly) {
        mergeType = strings.LEAF_ONLY_MERGE_TYPE;
    } else if (autoMergeValue) {
        mergeType = strings.AUTO_MERGE_VALUE_MERGE_TYPE;
    } else {
        mergeType = strings.NONE_MERGE_TYPE;
    }
    return mergeType;
}