import type { Tag } from '@visactor/vrender-components';
import type { IBoundsLike } from '@visactor/vutils';
import type { Datum } from '../../../typings';
import type { ICrosshairTheme } from '../interface';
export declare function limitTagInBounds(shape: Tag, bounds: IBoundsLike): void;
export declare function getDatumByValue(data: Datum[], value: number, startField: string, endField?: string): Datum | null;
export declare const getCartesianCrosshairTheme: (getTheme: (...keys: string[]) => any, chartSpec: any) => ICrosshairTheme;
export declare const getPolarCrosshairTheme: (getTheme: (...keys: string[]) => any, chartSpec: any) => ICrosshairTheme;
