/**
 * Part of the utils function implementation process reference
 * https://github.com/react-component/tree/blob/master/src/util.tsx
 */

import { difference, uniq, max, isObject, isNull, isUndefined, isEmpty, pick, get, omit } from 'lodash';
import { strings } from './constants';

export interface KeyEntities {
    [x: string]: any
}

export interface TreeDataSimpleJson {
    [x: string]: string | TreeDataSimpleJson
}

export interface NodeData {
    key: any;
    label: any;
    value: any;
    children?: any
}

export interface KeyMapProps {
    key?: string;
    label?: string;
    value?: string;
    disabled?: string;
    children?: string;
    isLeaf?: string;
    icon?: string
}

const DRAG_OFFSET = 0.45;

function getPosition(level: any, index: any) {
    return `${level}-${index}`;
}

function isValid(val: any) {
    return !isNull(val) && !isUndefined(val);
}

/**
 * Flat nest tree data into flatten list. This is used for virtual list render.
 * @param treeNodeList Origin data node list
 * @param expandedKeys
 * @param filteredShownKeys
 * need expanded keys, provides `true` means all expanded
 */
export function flattenTreeData(treeNodeList: any[], expandedKeys: Set<string>, keyMaps: KeyMapProps, filteredShownKeys: boolean | Set<any> = false) {
    const flattenList: any[] = [];
    const filterSearch = Boolean(filteredShownKeys);
    const realKeyName = get(keyMaps, 'key', 'key');
    const realChildrenName = get(keyMaps, 'children', 'children');
    if (isUndefined(treeNodeList)) {
        return [];
    }
    function flatten(list: any[], parent: any = null) {
        return list.map((treeNode, index) => {
            const pos = getPosition(parent ? parent.pos : '0', index);
            const mergedKey = treeNode[realKeyName];
            const otherData = {};
            if (keyMaps) {
                Object.entries(omit(keyMaps, 'children')).forEach(([key, value]) => {
                    const result = treeNode[value as string];
                    !isUndefined(result) && (otherData[key] = result);
                });
            }

            // Add FlattenDataNode into list
            const flattenNode: any = {
                ...pick(treeNode, ['key', 'label', 'value', 'icon', 'disabled', 'isLeaf']),
                ...otherData,
                parent,
                pos,
                children: null,
                data: treeNode,
                _innerDataTag: true,
                isEnd: [...(parent ? parent.isEnd : []), index === list.length - 1],
            };
            const isBooleanFilteredShownKeys = typeof filteredShownKeys === 'boolean';
            if (!filterSearch || (!isBooleanFilteredShownKeys && filteredShownKeys.has(mergedKey))) {
                flattenList.push(flattenNode);
            }

            // Loop treeNode children
            if (expandedKeys.has(mergedKey) && (!filterSearch || (!isBooleanFilteredShownKeys && filteredShownKeys.has(mergedKey)))) {
                flattenNode.children = flatten(treeNode[realChildrenName] || [], flattenNode);
            } else {
                flattenNode.children = [];
            }

            return flattenNode;
        });
    }
    flatten(treeNodeList);
    return flattenList;
}

export function convertJsonToData(treeJson: TreeDataSimpleJson) {
    const treeData: any[] = [];
    const traverseNode = (key: string, children: any, path: any, res: any[]) => {
        const currPath = [...path, key];
        const itemKey = currPath.join(strings.JSON_KEY_SPLIT);

        const newNode: NodeData = {
            key: itemKey,
            label: key,
            value: children,
        };
        if (isObject(children)) {
            const newChildren: any[] = [];
            Object.entries(children).forEach(c => {
                traverseNode(c[0], c[1], currPath, newChildren);
            });
            newNode.children = newChildren;
        }
        res.push(newNode);
    };
    Object.entries(treeJson).forEach(item => traverseNode(item[0], item[1], [], treeData));
    return treeData;
}

/**
 * Traverse all the data by `treeData`.
 */
export function traverseDataNodes(treeNodes: any[], callback: (data: any) => void, keyMaps: KeyMapProps) {
    const realKeyName = get(keyMaps, 'key', 'key');
    const realChildrenName = get(keyMaps, 'children', 'children');
    const processNode = (node: any, ind?: number, parent?: any) => {
        const children = node ? node[realChildrenName] : treeNodes;
        const pos = node ? getPosition(parent.pos, ind) : '0';
        // Process node if is not root
        if (node) {
            const nodeKey = get(node, realKeyName, null);
            const data = {
                data: { ...node },
                ind,
                pos,
                key: nodeKey !== null ? nodeKey : pos,
                parentPos: parent.node ? parent.pos : null,
                level: Number(parent.level) + 1,
            };
            callback(data);
        }
        // Process children node
        if (children) {
            children.forEach((subNode: any, subIndex: number) => {
                processNode(subNode, subIndex, {
                    node,
                    pos,
                    level: parent ? Number(parent.level) + 1 : -1,
                });
            });
        }
    };

    processNode(null);
}

/* Convert data to entities map */
export function convertDataToEntities(dataNodes: any[], keyMaps?: KeyMapProps) {
    const posEntities = {};
    const keyEntities = {};
    const valueEntities = {};
    const wrapper = {
        posEntities,
        keyEntities,
        valueEntities,
    };
    const realValueName = get(keyMaps, 'value', 'value');

    traverseDataNodes(dataNodes, (data: any) => {
        const { pos, key, parentPos } = data;
        const entity = { ...data };
        const value = get(entity, `data.${realValueName}`, null);

        if (value !== null) {
            valueEntities[value] = key;
        }

        posEntities[pos] = entity;
        keyEntities[key] = entity;

        // Fill children
        entity.parent = posEntities[parentPos];
        if (entity.parent) {
            entity.parent.children = entity.parent.children || [];
            entity.parent.children.push(entity);
        }
    }, keyMaps);

    return wrapper;
}


/* Get key by value */
export function findKeysForValues(valueList: any, valueEntities: any, isMultiple = false) {
    if (!isValid(valueList)) {
        return [];
    }
    if (!isMultiple && Array.isArray(valueList)) {
        valueList = valueList.length ? [valueList[0]] : [];
    } else if (!Array.isArray(valueList)) {
        valueList = [valueList];
    }

    if (isEmpty(valueEntities)) {
        return valueList;
    }

    const res: any[] = [];
    valueList.forEach((val: string) => {
        if (val in valueEntities) {
            res.push(valueEntities[val]);
        } else {
            // if val not in valueEntities, then value push to keys array
            val && res.push(val);
        }
    });

    return res;
}

export function findDescendantKeys(selectedKeys: string[], options: KeyEntities, self = true) {
    const res: string[] = [];
    const findChild = (item: any) => {
        if (!item) {
            return;
        }
        const { children } = item;
        const hasChildren = isValid(children);
        if (hasChildren) {
            children.forEach((child: any) => {
                res.push(child.key);
                findChild(options[child.key]);
            });
        }
    };
    selectedKeys.forEach(item => {
        if (self) {
            res.push(item);
        }
        findChild(options[item]);
    });
    return res;
}

export function findChildKeys(keys: string[], options: any, omitKeys: any[] = []) {
    const res: any[] = [];
    keys &&
        keys.forEach(key => {
            const opts = options[key];
            opts &&
                opts.children &&
                opts.children.forEach((child: any) => {
                    if (!omitKeys.length || !omitKeys.includes(child.key)) {
                        res.push(child.key);
                    }
                });
        });
    return res;
}

/* istanbul ignore next */
export function findLeafKeys(keys: string[], options: any) {
    const res: any[] = [];
    const findChild = (item: any) => {
        if (!item) {
            return;
        }
        const { children } = item;
        const isLeaf = !isValid(children);
        if (isLeaf) {
            res.push(item.key);
        } else {
            children.forEach((child: any) => {
                findChild(options[child.key]);
            });
        }
    };
    keys.forEach(item => {
        findChild(options[item]);
    });
    return res;
}

export function findSiblingKeys(selectedKeys: string[], options: any, self = true) {
    const par: any[] = [];
    selectedKeys.forEach(item => {
        if (options[item] && options[item].parent) {
            par.push(options[item].parent.key);
        }
    });

    const res = findChildKeys(uniq(par), options, self ? [] : selectedKeys);
    return res;
}

export function findAncestorKeys(selectedKeys: string[], options: any, self = true) {
    const res: any[] = [];
    // Recursively find the parent element
    const findPar = (item: any) => {
        if (item.parent) {
            res.push(item.parent.key);
            findPar(item.parent);
        }
    };
    selectedKeys.forEach(item => {
        options[item] && findPar(options[item]);
        if (self) {
            res.push(item);
        }
    });
    return res;
}

function getSortedKeyList(keyList: any[], keyEntities: KeyEntities) {
    const levelMap = {};
    keyList.forEach(key => {
        if (!keyEntities[key]) {
            return;
        }
        const { level } = keyEntities[key];
        if (levelMap[level]) {
            levelMap[level].push(key);
        } else {
            levelMap[level] = [key];
        }
    });
    return levelMap;
}

export function calcCheckedKeys(values: any, keyEntities: KeyEntities) {
    const keyList = Array.isArray(values) ? values : [values];
    const descendantKeys = findDescendantKeys(keyList, keyEntities, true);
    /**
     * Recursively find the parent element. Because the incoming nodes are all checked,
     * their descendants must be checked. That is to say, if the descendant nodes have
     *  disabled+unchecked nodes, their ancestor nodes will definitely not be checked
     */
    const checkedKeys = new Set([...descendantKeys]);
    let halfCheckedKeys = new Set([]);
    let visited: any[] = [];

    const levelMap: { [key: number]: string[] } = getSortedKeyList(keyList, keyEntities);

    const calcCurrLevel = (node: any) => {
        const { key, parent, level } = node;
        // If the node does not have a parent node, or the node has been processed just now, no processing is done
        if (!parent || visited.includes(key)) {
            return;
        }

        const siblingKeys = findSiblingKeys([key], keyEntities);
        // visited for caching to avoid double counting
        visited = [...visited, ...siblingKeys];
        const allChecked = siblingKeys.every((siblingKey: string) => checkedKeys.has(siblingKey));
        if (!allChecked) {
            const ancestorKeys = findAncestorKeys([key], keyEntities, false);
            halfCheckedKeys = new Set([...halfCheckedKeys, ...ancestorKeys]);
        } else {
            checkedKeys.add(parent.key);
            // IMPORTANT! parent level may not exist in original level map; if add to the end directly may destroy the hierarchical order
            if (level - 1 in levelMap && level) {
                levelMap[level - 1].push(parent.key);
            } else {
                levelMap[level - 1] = [parent.key];
            }
        }
    };
    // Loop keyList from deepest Level to topLevel, bottom up
    while (!isEmpty(levelMap)) {
        const maxLevel = max(Object.keys(levelMap).map(key => Number(key)));
        levelMap[maxLevel].forEach((key: string) => calcCurrLevel(keyEntities[key]));
        delete levelMap[maxLevel];
    }

    return {
        checkedKeys,
        halfCheckedKeys,
    };
}

/* Calculate the expanded node by key */
export function calcExpandedKeys(keyList: any[] = [], keyEntities: KeyEntities, autoExpandParent = true) {
    if (!Array.isArray(keyList)) {
        keyList = [keyList];
    }
    if (autoExpandParent) {
        const ancestorKeys = findAncestorKeys(keyList, keyEntities, true);
        return new Set(ancestorKeys);
    }
    return new Set(keyList);
}

/* Calculate the expanded node by value */
export function calcExpandedKeysForValues(value: any, keyEntities: KeyEntities, isMultiple: boolean, valueEntities: any) {
    const keys = findKeysForValues(value, valueEntities, isMultiple);
    return new Set(findAncestorKeys(keys, keyEntities, false));
}

export function calcMotionKeys(oldKeySet: Set<string>, newKeySet: Set<string>, keyEntities: KeyEntities) {
    let motionType = 'show';
    const oldKeys = [...oldKeySet];
    const newKeys = [...newKeySet];

    if (Math.abs(oldKeys.length - newKeys.length) !== 1) {
        return { motionType, motionKeys: [] };
    }

    let diffKeys = [];
    if (oldKeys.length > newKeys.length) {
        motionType = 'hide';
        diffKeys = difference(oldKeys, newKeys);
    } else {
        diffKeys = difference(newKeys, oldKeys);
    }

    return {
        motionType: diffKeys.length === 1 ? motionType : 'show',
        motionKeys: diffKeys.length === 1 ? findDescendantKeys(diffKeys, keyEntities, false) : [],
    };
}
/**
 * @returns whether option includes sugInput.
 * When filterTreeNode is a function,returns the result of filterTreeNode which called with (sugInput, target, option).
 */
export function filter(sugInput: string, option: any, filterTreeNode: any, filterProps: any) {
    if (!filterTreeNode) {
        return true;
    }
    let filterFn = filterTreeNode;
    let target = option;
    if (typeof filterTreeNode === 'boolean') {
        filterFn = (targetVal: string, val: any) => {
            const input = targetVal.toLowerCase();
            return val
                ?.toString()
                .toLowerCase()
                .includes(input);
        };
    }
    if (filterProps) {
        target = option[filterProps];
    }
    return filterFn(sugInput, target, option);
}

export function normalizedArr(val: any) {
    if (!Array.isArray(val)) {
        return [val];
    } else {
        return val;
    }
}

// flag is used to determine whether to return when the key does not belong to the keys in keyEntities
// export function normalizeKeyList(keyList: any, keyEntities: KeyEntities, leafOnly = false) {
export function normalizeKeyList(keyList: any, keyEntities: KeyEntities, leafOnly = false, flag?: boolean) {
    const res: string[] = [];
    const keyListSet = new Set(keyList);
    if (!leafOnly) {
        keyList.forEach((key: string) => {
            if (!keyEntities[key]) {
                if (flag) {
                    res.push(key);
                }
                return;
            }
            const { parent } = keyEntities[key];
            if (parent && keyListSet.has(parent.key)) {
                return;
            }
            res.push(key);
        });
    } else {
        keyList.forEach(key => {
            if (keyEntities[key] && !isValid(keyEntities[key].children)) {
                res.push(key);
            }
            // when key is not in keyEntities, if flag is true, key should be push in res
            if (!keyEntities[key] && flag) {
                res.push(key);
            }
        });
    }
    return res;
}

export function getMotionKeys(eventKey: string, expandedKeys: Set<string>, keyEntities: KeyEntities) {
    const res: any[] = [];

    const getChild = (itemKey: string) => {
        keyEntities[itemKey].children &&
            keyEntities[itemKey].children.forEach((item: any) => {
                const { key } = item;
                res.push(key);
                if (expandedKeys.has(key)) {
                    getChild(key);
                }
            });
    };
    getChild(eventKey);
    return res;
}

export function calcCheckedKeysForChecked(key: string, keyEntities: KeyEntities, checkedKeys: Set<string>, halfCheckedKeys: Set<string>) {
    const descendantKeys = findDescendantKeys([key], keyEntities, true);
    const nodeItem = keyEntities[key];
    checkedKeys = new Set([...checkedKeys, key]);
    const calcCurrLevel = (node: any) => {
        if (!node.parent) {
            return;
        }
        const { key } = node;
        const siblingKeys = findSiblingKeys([key], keyEntities);
        const allChecked = siblingKeys.every(key => checkedKeys.has(key));
        if (!allChecked) {
            const ancestorKeys = findAncestorKeys([key], keyEntities, false);
            halfCheckedKeys = new Set([...halfCheckedKeys, ...ancestorKeys]);
        } else {
            const par = node.parent;
            checkedKeys.add(par.key);
            calcCurrLevel(par);
        }
    };
    calcCurrLevel(nodeItem);
    return {
        checkedKeys: new Set([...checkedKeys, ...descendantKeys]),
        halfCheckedKeys,
    };
}

export function calcCheckedKeysForUnchecked(key: string, keyEntities: KeyEntities, checkedKeys: Set<string>, halfCheckedKeys: Set<string>) {
    const descendantKeys = findDescendantKeys([key], keyEntities, true);
    const nodeItem = keyEntities[key];
    descendantKeys.forEach(descendantKey => {
        if (checkedKeys.has(descendantKey)) {
            checkedKeys.delete(descendantKey);
        }
        if (halfCheckedKeys.has(descendantKey)) {
            halfCheckedKeys.delete(descendantKey);
        }
    });
    const calcCurrLevel = (node: any) => {
        const par = node.parent;
        // no parent
        if (!par) {
            return;
        }
        // Has a parent node, and the parent node is not checked or halfChecked
        if (!checkedKeys.has(par.key) && !halfCheckedKeys.has(par.key)) {
            return;
        }
        // Has a parent node, and the parent node is checked or halfChecked
        const { key } = node;
        const siblingKeys = findSiblingKeys([key], keyEntities);
        const anyChecked = siblingKeys.some(key => checkedKeys.has(key) || halfCheckedKeys.has(key));
        const ancestorKeys = findAncestorKeys([key], keyEntities, false);
        // If there is checked or halfChecked in the sibling node, you need to change the parent node to halfChecked
        if (anyChecked) {
            ancestorKeys.forEach(itemKey => {
                if (checkedKeys.has(itemKey)) {
                    checkedKeys.delete(itemKey);
                    halfCheckedKeys.add(itemKey);
                }
            });
            // If there is no checked or halfChecked in the sibling node, you need to change the parent node to unchecked
        } else {
            if (checkedKeys.has(par.key)) {
                checkedKeys.delete(par.key);
            }
            if (halfCheckedKeys.has(par.key)) {
                halfCheckedKeys.delete(par.key);
            }
            calcCurrLevel(par);
        }
    };
    nodeItem && calcCurrLevel(nodeItem);
    return {
        checkedKeys,
        halfCheckedKeys,
    };
}

export function filterTreeData(info: any) {
    const {
        showFilteredOnly,
        keyEntities,
        inputValue,
        treeData,
        filterTreeNode,
        filterProps,
        prevExpandedKeys,
        keyMaps
    } = info;

    let filteredOptsKeys = [];
    filteredOptsKeys = Object.values(keyEntities)
        .filter((item: any) => filter(inputValue, item.data, filterTreeNode, filterProps))
        .map((item: any) => item.key);
    let expandedOptsKeys = findAncestorKeys(filteredOptsKeys, keyEntities, false);
    if (prevExpandedKeys.length) {
        const prevExpandedValidKeys = prevExpandedKeys.filter((key: string) => Boolean(keyEntities[key]));
        expandedOptsKeys = expandedOptsKeys.concat(prevExpandedValidKeys);
    }
    const shownChildKeys = findDescendantKeys(filteredOptsKeys, keyEntities, true);
    const filteredShownKeys = new Set([...shownChildKeys, ...expandedOptsKeys]);
    const flattenNodes = flattenTreeData(treeData, new Set(expandedOptsKeys), keyMaps, showFilteredOnly && filteredShownKeys);

    return {
        flattenNodes,
        filteredKeys: new Set(filteredOptsKeys),
        filteredExpandedKeys: new Set(expandedOptsKeys),
        filteredShownKeys,
    };
}

// return data.value if data.value exist else fall back to key
export function getValueOrKey(data: any, keyMaps?: KeyMapProps) {
    const valueName = get(keyMaps, 'value', 'value');
    const keyName = get(keyMaps, 'key', 'key');
    if (Array.isArray(data)) {
        return data.map(item => get(item, valueName, item[keyName]));
    }
    return get(data, valueName, data[keyName]);
}

/* Convert value to string */
export function normalizeValue(value: any, withObject: boolean, keyMaps?: KeyMapProps) {
    if (withObject && isValid(value)) {
        return getValueOrKey(value, keyMaps);
    } else {
        return value;
    }
}

export function updateKeys(keySet: Set<string> | string[], keyEntities: KeyEntities) {
    const keyArr = [...keySet];
    return keyArr.filter(key => key in keyEntities);
}

export function calcDisabledKeys(keyEntities: KeyEntities, keyMaps?: KeyMapProps) {
    const disabledName = get(keyMaps, 'disabled', 'disabled');
    const disabledKeys = Object.keys(keyEntities).filter(key => keyEntities[key].data[disabledName]);
    const { checkedKeys } = calcCheckedKeys(disabledKeys, keyEntities);
    return checkedKeys;
}

export function calcDropRelativePosition(event: any, treeNode: any) {
    const { clientY } = event;
    const { top, bottom, height } = treeNode.nodeInstance.getBoundingClientRect();
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    if (clientY <= top + height * DRAG_OFFSET) {
        return -1;
    }
    if (clientY >= bottom - height * DRAG_OFFSET) {
        return 1;
    }

    return 0;
}

export function getDragNodesKeys(key: string, keyEntities: KeyEntities) {
    return findDescendantKeys([key], keyEntities, true);
}

export function calcDropActualPosition(pos: string, relativeDropPos: any) {
    const posArr = pos.split('-');
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    return relativeDropPos + Number(posArr[posArr.length - 1]);
}
