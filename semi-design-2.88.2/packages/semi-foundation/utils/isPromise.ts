import isObject from './isObject';

export default function isPromise(value: any) {
    return isObject(value) && typeof (value.then) === 'function';
}