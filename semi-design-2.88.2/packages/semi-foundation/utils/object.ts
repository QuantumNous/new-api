import {
    get as lodashGet,
    set as lodashSet,
    has as lodashHas,
    toPath as lodashToPath,
    unset as lodashUnset,
    values as lodashValues,
    isNumber,
    isObject,
    values
} from 'lodash';

type Many<T> = T | ReadonlyArray<T>;
type PropertyName = string | number | symbol;
type PropertyPath = Many<PropertyName>;

type ObjectType = Record<string, any>;

const pathToArrayElem = (path: any) => {
    const pathArray = lodashToPath(path);
    // internal-issues:673
    const justNumber = isNumber(path) && pathArray.length === 1;
    return justNumber ? false : Number.isInteger(+pathArray[pathArray.length - 1]);
};

function isEmptyObject(target: ObjectType) {
/**
 *  var a = {};
 *  var b = { c: undefined }
 *  var d = {
 *      e: function(){},
 *      f: Symbol(''),
 *  }
 *  the result of JSON.stringify(a/b/d) are same: '{}'
 *  We can use the above features to remove keys with empty values in Form
 *  But we cannot use JSON.stringify() directly, because if the input parameter of JSON.stringify includes fiberNode, it will cause an TypeError: 'Converting circular structure to JSON'
 *  So we have to mock it's behavior, also, the form value cannot have Symbol or function type, it can be ignored
 */
    if (!isObject(target)) {
        return false;
    } else {
        const valuesOfTarget = values(target);
        // values(a)  ->   []
        // values(b)  ->   [undefined]
        if (!valuesOfTarget.length) {
            return true; // like target: {}
        } else {
            return valuesOfTarget.every(item => typeof item === 'undefined');
        }
    }
}

function cleanup(obj: ObjectType, path: string[], pull = true) {
    if (path.length === 0) {
        return;
    }

    const target = lodashGet(obj, path);

    // remove undefined from array
    // if (Array.isArray(target) && pull) {
    //     // only remove undefined form array from right to left
    //     // Remove undefined from right to left
    //     let lastIndex = findLastIndex(target, item => !isUndefined(item));
    //     lodashRemove(target, (value, index, array) => index > lastIndex);
    // }

    // Delete object if its empty
    if (Array.isArray(target) && target.every(e => e == null)) {
        lodashUnset(obj, path);
    } else if (isEmptyObject(target)) {
        lodashUnset(obj, path);
    }

    // Recur
    cleanup(obj, path.slice(0, path.length - 1), pull);
}

export function empty(object: ObjectType) {
    return lodashValues(object).length === 0;
}

export function get(object: ObjectType, path: PropertyPath) {
    return lodashGet(object, path);
}

export function remove(object: ObjectType, path: PropertyPath) {
    lodashUnset(object, path);
    // a.b => [a, b]
    // arr[11].a => [arr, 11, a]
    let pathArray = lodashToPath(path);
    pathArray = pathArray.slice(0, pathArray.length - 1);
    cleanup(object, pathArray, false);
}

export function set(object: any, path: PropertyPath, value: any, allowEmpty?: boolean) {
    if (allowEmpty) {
        return lodashSet(object, path, value);
    }
    if (value !== undefined) {
        return lodashSet(object, path, value);
    } else {
        // If the path is to an array leaf then we want to set to undefined
        // 将数组的叶子节点置为undefined时，例如 a.b[0]  a.b[1]  a.b[99]
        if (pathToArrayElem(path) && get(object, path) !== undefined) {
            lodashSet(object, path, undefined);
            let pathArray = lodashToPath(path);
            pathArray = pathArray.slice(0, pathArray.length - 1);
            cleanup(object, pathArray, false);
        } else if (!pathToArrayElem(path) && get(object, path) !== undefined) {
            // Only delete the field if it needs to be deleted and its not a path to an array ( array leaf )
            // eg:
            /*
                When the non-array leaf node is set to undefined
                for example: a.b.c
            */
            remove(object, path);
        }

    }
}

export function has(object: ObjectType, path: PropertyPath) {
    return lodashHas(object, path);
}

/**
 * set static properties from `srcObj` to `obj`
 * @param {object|Function} obj
 * @param {object|Function} srcObj
 * @returns {object|Function}
 */
export function forwardStatics<T extends ObjectType | ((...arg: any) => any)>(obj: T, srcObj: ObjectType | ((...arg: any) => any)): T {
    if (
        obj &&
        (typeof obj === 'function' || typeof obj === 'object') &&
        srcObj &&
        (typeof srcObj === 'function' || typeof srcObj === 'object')
    ) {
        Object.entries(srcObj).forEach(([key, value]) => {
            obj[key] = value;
        });
    }
    return obj;
}
