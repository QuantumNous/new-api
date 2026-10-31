import { isHTMLElement, cloneDeep } from '@visactor/vutils';
import { isDataView } from '@visactor/vdataset';

const ignoreWhen = (value: any) => {
  return isDataView(value) || isHTMLElement(value);
};

/**
 * 深拷贝 spec，为避免循环引用，DataView 维持原有引用
 * @param spec 原spec
 */
export function cloneDeepSpec(spec: any, excludeKeys: string[] = ['data']) {
  return cloneDeep(spec, ignoreWhen, excludeKeys);
}
