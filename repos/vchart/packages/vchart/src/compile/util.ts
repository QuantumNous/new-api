import { isNil } from '@visactor/vutils';
import type { IMorphConfig } from '../animation/spec';
import type { IGroupMark, IMark, IMarkRaw } from '../mark/interface';
import { MarkTypeEnum } from '../mark/interface';
import { groupData } from '../mark/utils/common';
import type { DiffResult } from '../typings/common';
import type { RenderMode } from '../typings/spec';
// eslint-disable-next-line no-duplicate-imports
import { RenderModeEnum } from '../typings/spec/common';

// TODO: feishu => lark
export function toRenderMode(mode: RenderMode): any {
  switch (mode) {
    case RenderModeEnum['desktop-browser']:
    case RenderModeEnum['mobile-browser']:
      return 'browser';
    case RenderModeEnum.node:
    case RenderModeEnum.worker:
      return 'node';
    case RenderModeEnum.miniApp:
    case RenderModeEnum['desktop-miniApp']:
      return 'feishu';
    case RenderModeEnum.lynx:
      return 'lynx';
    case RenderModeEnum.wx:
      return 'wx';
    case RenderModeEnum.tt:
      return 'tt';
    case RenderModeEnum.harmony:
      return 'harmony';
  }
  return 'browser';
}

export function traverseGroupMark<T>(
  group: IMark,
  apply: (mark: IMark) => T,
  filter?: (mark: IMark) => boolean,
  leafFirst?: boolean,
  stop?: boolean
): T | undefined {
  const traverse = (mark: IMark): T | undefined => {
    if (!leafFirst) {
      if (mark && (!filter || filter(mark))) {
        const res = apply.call(null, mark);

        if (stop && res) {
          return res;
        }
      }
    }

    if (mark.type === MarkTypeEnum.group) {
      const children: IMark[] = (mark as IGroupMark).getMarks();

      if (children) {
        for (let i = 0; i < children.length; i++) {
          const res = traverse(children[i]);

          if (res && stop) {
            return res;
          }
        }
      }
    }

    if (leafFirst) {
      if (mark && (!filter || filter(mark))) {
        const res = apply.call(null, mark);

        if (res && stop) {
          return res;
        }
      }
    }

    return undefined;
  };

  return traverse(group);
}

export function findSimpleMarks(groups: IMark[]): IMark[] {
  const marks: IMark[] = [];

  groups.forEach(g => {
    traverseGroupMark(g, (m: IMark) => {
      if (m.type !== MarkTypeEnum.group && m.type !== MarkTypeEnum.component) {
        marks.push(m);
      }
    });
  });

  return marks;
}

export function diffUpdateByGroup(
  prev: IMark[],
  next: IMark[],
  prevKey: (datum: IMark) => string,
  nextKey: (datum: IMark) => string
) {
  const prevGroup = groupData<IMark>(prev, datum => prevKey(datum as IMark));
  const nextGroup = groupData<IMark>(next, datum => nextKey(datum as IMark));

  let prevAfterDiff = prev;
  let nextAfterDiff = next;
  const update: { prev: IMark[]; next: IMark[] }[] = [];
  nextGroup.keys.forEach(key => {
    if (!isNil(key)) {
      const prevKeyData = prevGroup.data.get(key);
      const nextKeyData = nextGroup.data.get(key);
      if (prevKeyData && nextKeyData) {
        update.push({ prev: prevKeyData, next: nextKeyData });
        prevAfterDiff = prevAfterDiff.filter(datum => !prevKeyData.includes(datum));
        nextAfterDiff = nextAfterDiff.filter(datum => !nextKeyData.includes(datum));
      }
    }
  });
  return {
    prev: prevAfterDiff,
    next: nextAfterDiff,
    update
  };
}

export function diffMarks(
  prevMarks: IMark[],
  nextMarks: IMark[],
  runningConfig: IMorphConfig
): DiffResult<IMark[], IMark[]> {
  const diffResult: DiffResult<IMark[], IMark[]> = {
    enter: [],
    exit: [],
    update: []
  };

  let prevDiffMarks: IMark[] = [];
  let nextDiffMarks: IMark[] = [];

  // filter out marks & specs which will not morph
  prevMarks.forEach(mark => {
    if ((runningConfig.morph && mark.getMarkConfig().morph) || runningConfig.morphAll || runningConfig.reuse) {
      prevDiffMarks.push(mark);
    } else {
      diffResult.exit.push({ prev: [mark] });
    }
  });
  nextMarks.forEach(mark => {
    if ((runningConfig.morph && mark.getMarkConfig().morph) || runningConfig.morphAll || runningConfig.reuse) {
      nextDiffMarks.push(mark);
    } else {
      diffResult.enter.push({ next: [mark] });
    }
  });

  // 1. match by custom key
  const keyDiffResult = diffUpdateByGroup(
    prevDiffMarks,
    nextDiffMarks,
    mark => mark.getMarkConfig().morphKey,
    mark => mark.getMarkConfig().morphKey
  );
  prevDiffMarks = keyDiffResult.prev;
  nextDiffMarks = keyDiffResult.next;
  diffResult.update = diffResult.update.concat(keyDiffResult.update);

  // 2. match by name
  const nameDiffResult = diffUpdateByGroup(
    prevDiffMarks,
    nextDiffMarks,
    mark => `${mark.getUserId()}`,
    mark => `${mark.getUserId()}`
  );
  prevDiffMarks = nameDiffResult.prev;
  nextDiffMarks = nameDiffResult.next;
  diffResult.update = diffResult.update.concat(nameDiffResult.update);

  // 3. match by index

  // FIXME: mark index cannot be get before executing, index is decided by remove/order for now
  const prevParentGroup = groupData(prevDiffMarks, mark => mark.group?.id?.());
  const nextParentGroup = groupData(nextDiffMarks, mark => mark.group?.id?.());

  Object.keys(nextParentGroup).forEach(groupName => {
    const prevChildren = prevParentGroup.data.get(groupName);
    const nextChildren = nextParentGroup.data.get(groupName);
    if (prevChildren && nextChildren) {
      for (let i = 0; i < Math.max(prevChildren.length, nextChildren.length); i += 1) {
        const prevChild = prevChildren[i];
        const nextChild = nextChildren[i];
        if (prevChild && nextChild) {
          diffResult.update.push({ prev: [prevChild], next: [nextChild] });
        } else if (prevChild) {
          diffResult.exit.push({ prev: [prevChild] });
        } else if (nextChild) {
          diffResult.enter.push({ next: [nextChild] });
        }
      }

      prevDiffMarks = prevDiffMarks.filter(mark => !prevChildren.includes(mark));
      nextDiffMarks = nextDiffMarks.filter(mark => !nextChildren.includes(mark));
    }
  });

  // 4. handle unmatched marks
  prevDiffMarks.forEach(mark => diffResult.exit.push({ prev: [mark] }));
  nextDiffMarks.forEach(mark => diffResult.enter.push({ next: [mark] }));

  return diffResult;
}
