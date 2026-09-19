import { baseMerge, isArray, isObject } from '@visactor/vutils';
/* 与原生的 lodash merge 差异在于对数组是否应用最后一个 source 的结果
 * 以及对一些特殊情况的处理，比如对数组类型 padding 和对象类型的 padding 的 merge
 */
export function mergeSpec(target: any, ...sources: any[]): any {
  let sourceIndex = -1;
  const length = sources.length;
  while (++sourceIndex < length) {
    const source = sources[sourceIndex];
    baseMerge(target, source, true, true);
  }
  return target;
}

export function mergeSpecWithFilter(
  target: any,
  filter: string | { type: string; index: number },
  spec: any,
  forceMerge: boolean
) {
  Object.keys(target).forEach(k => {
    if (isObject(filter)) {
      if (filter.type === k) {
        if (isArray(target[k])) {
          if (target[k].length >= filter.index) {
            target[k][filter.index] = forceMerge ? mergeSpec({}, target[k][filter.index], spec) : spec;
          }
        } else {
          target[k] = forceMerge ? mergeSpec({}, target[k], spec) : spec;
        }
      }
    } else {
      // filter === user id
      if (isArray(target[k])) {
        const index = target[k].findIndex((_s: { id: string | number }) => _s.id === filter);
        if (index >= 0) {
          target[k][index] = forceMerge ? mergeSpec({}, target[k][index], spec) : spec;
        }
      } else if (target.id === filter) {
        target[k] = forceMerge ? mergeSpec({}, target[k], spec) : spec;
      }
    }
  });
}
