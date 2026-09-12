import { isArray, isFunction, isPlainObject, isString } from '@visactor/vutils';

interface IFunctionTransformRegistry {
  getFunction: (key: string) => unknown;
}

// todo 以目前的场景来看，并没有递归的需要。
// 考虑到不确定性，还是递归处理spec对象，时间消耗很少
export function specTransform(
  spec: unknown,
  special: {
    [key: string]: (v: unknown) => unknown;
  } = {
    data: v => v
  }
): unknown {
  if (!spec) {
    return spec;
  }
  // 如果是普通对象
  if (spec.constructor === Object) {
    const result: any = {};
    for (const key in spec as any) {
      if (Object.prototype.hasOwnProperty.call(spec, key)) {
        // todo 特殊处理怎样更合理?
        if (special[key]) {
          result[key] = special[key](spec[key]);
          continue;
        }
        result[key] = specTransform(spec[key], special);
      }
    }
    return result;
  }
  // 如果是数组
  if (isArray(spec)) {
    return spec.map(s => specTransform(s, special));
  }
  return spec;
}

/**
 * functionTransform is used to replace the function registered by the instance
 * @param value
 * @returns
 */
export function functionTransform(value: unknown, registry: IFunctionTransformRegistry): any {
  if (!value) {
    return value;
  }
  if (isString(value)) {
    return registry.getFunction(value) ?? value;
  }
  // 如果是普通对象
  if (isPlainObject(value)) {
    const result: any = {};
    for (const key in value as any) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = functionTransform((value as any)[key], registry);
      }
    }
    return result;
  }
  // 如果是数组
  if (isArray(value)) {
    return value.map(item => functionTransform(item, registry));
  }
  return value;
}

export function transformFunctionAttribute(att: unknown, ...args: unknown[]) {
  if (isFunction(att)) {
    return att(...args);
  }
  return att;
}
