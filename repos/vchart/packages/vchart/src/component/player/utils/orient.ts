import type { IOrientType } from '../../../typings';

export const isVertical = (orient: IOrientType) => orient === 'left' || orient === 'right';

export const isHorizontal = (orient: IOrientType) => orient === 'top' || orient === 'bottom';
