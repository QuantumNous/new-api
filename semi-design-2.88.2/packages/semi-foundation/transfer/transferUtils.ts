import { omit } from 'lodash';
import { strings } from './constants';

export function _generateGroupedData(dataSource: any[]): any[] {
    const newData: any[] = [];
    for (const group of dataSource) {
        group.children.forEach((item: any) => {
            const { children, ...rest } = group;
            newData.push({ ...item, _parent: rest });
        });
    }
    return newData;
}

// DFS
export function _generateTreeData(dataSource: any[]): any[] {
    const newData = [];
    const stack = [...dataSource].reverse();
    while (stack.length) {
        const current = stack.pop();
        current.path = current.path || [omit(current, ['children'])];
        if (current.children && Array.isArray(current.children)) {
            const nodes = current.children;
            for (let i = nodes.length - 1; i >= 0; i--) {
                const child = { ...nodes[i] };
                child.path = [].concat(current.path).concat(omit(child, ['children']));
                stack.push(child);
            }
        } else {
            current.isLeaf = true;
        }
        newData.push(omit(current, ['children']));
    }
    return newData;
}

export function _generateDataByType(dataSource: any[], type: string): any[] {
    const newData = dataSource.slice() || [];
    if (type === strings.TYPE_GROUP_LIST) {
        return _generateGroupedData(newData);
    }
    if (type === strings.TYPE_TREE_TO_LIST) {
        return _generateTreeData(newData);
    }
    return newData;
}

export function _generateSelectedItems(value: any[], data: any[]): Map<any, any> {
    const selectedItems = new Map();
    value.forEach(val => {
        const index = data.findIndex(option => option.value === val);
        if (index !== -1) {
            const option = data[index];
            selectedItems.set(option.key, option);
        }
    });
    return selectedItems;
}