import type { ITextMark } from '../../mark/interface';
import type { DirectionType } from '../../typings/space';
// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../../typings/space';
import { AttributeLevel } from '../../constant/attribute';
import type { ISeries } from '../interface';

// 直角坐标系下 固定点位的标签
// only used in rangeColumn
export function setRectLabelPos(
  component: ISeries,
  labelMark: ITextMark,
  position: string,
  offset: number,
  x: (datum: any) => number,
  x1: (datum: any) => number,
  y: (datum: any) => number,
  y1: (datum: any) => number,
  direction: () => DirectionType
) {
  component.setMarkStyle(labelMark, {
    textAlign: (datum: any) => {
      const d = direction();
      if (d === Direction.vertical) {
        return 'center';
      }
      const _x = x(datum);
      const _x1 = x1(datum);
      // d = h
      if (position === 'middle') {
        return 'center';
      }
      // 柱子 从左到右
      if (_x >= _x1) {
        if (position === 'start') {
          return 'left';
        }
        if (position === 'end') {
          return 'right';
        }
        if (position === 'outside') {
          return 'left';
        }
      }
      // 柱子 从右到左
      else {
        if (position === 'start') {
          return 'right';
        }
        if (position === 'end') {
          return 'left';
        }
        if (position === 'outside') {
          return 'right';
        }
      }
      return 'center';
    },
    textBaseline: (datum: any) => {
      const d = direction();
      if (d === Direction.horizontal) {
        return 'middle';
      }
      // d = v
      const _y = y(datum);
      const _y1 = y1(datum);
      if (position === 'middle') {
        return 'middle';
      }
      // 柱子 从下到上
      if (_y1 >= _y) {
        if (position === 'start') {
          return 'bottom';
        }
        if (position === 'end') {
          return 'top';
        }
        if (position === 'outside') {
          return 'bottom';
        }
      }
      // 柱子 从上到下
      else {
        if (position === 'start') {
          return 'top';
        }
        if (position === 'end') {
          return 'bottom';
        }
        if (position === 'outside') {
          return 'top';
        }
      }
      return 'middle';
    }
  });
  component.setMarkStyle(
    labelMark,
    {
      x: (datum: any) => {
        const d = direction();
        const _x = x(datum);
        const _x1 = x1(datum);
        if (d === Direction.vertical) {
          return (_x + _x1) / 2;
        }
        // d = h
        if (position === 'middle') {
          return (_x + _x1) / 2;
        }
        // 柱子 从左到右
        if (_x >= _x1) {
          if (position === 'start') {
            return _x1 + offset;
          }
          if (position === 'end') {
            return _x - offset;
          }
          if (position === 'outside') {
            return _x + offset;
          }
        }
        // 柱子 从右到左
        else {
          if (position === 'start') {
            return _x1 - offset;
          }
          if (position === 'end') {
            return _x + offset;
          }
          if (position === 'outside') {
            return _x - offset;
          }
        }
        return (_x + _x1) / 2;
      },
      y: (datum: any) => {
        const d = direction();
        const _y = y(datum);
        const _y1 = y1(datum);
        if (d === Direction.horizontal) {
          return (_y + _y1) / 2;
        }
        // d = v
        if (position === 'middle') {
          return (_y + _y1) / 2;
        }
        // 柱子 从下到上
        if (_y >= _y1) {
          if (position === 'start') {
            return _y1 + offset;
          }
          if (position === 'end') {
            return _y - offset;
          }
          if (position === 'outside') {
            return _y + offset;
          }
        }
        // 柱子 从上到下
        else {
          if (position === 'start') {
            return _y1 - offset;
          }
          if (position === 'end') {
            return _y + offset;
          }
          if (position === 'outside') {
            return _y - offset;
          }
        }
        return (_y + _y1) / 2;
      }
    },
    'normal',
    AttributeLevel.Series
  );
}
