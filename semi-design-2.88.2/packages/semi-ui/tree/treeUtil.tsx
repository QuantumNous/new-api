import React from 'react';
import { cloneDeepWith, isPlainObject } from 'lodash';

export function cloneDeep(treeNodeList: any) {
    return cloneDeepWith(treeNodeList, val => {
        // only clone treeNode inner data and skip user data
        if (isPlainObject(val) && !val._innerDataTag) {
            return val;
        }
        if (React.isValidElement(val)) {
            return val;
        }
    });
}
