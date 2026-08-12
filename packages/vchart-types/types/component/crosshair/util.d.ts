import type { Tag } from '@visactor/vrender-components';
import type { IBoundsLike } from '@visactor/vutils';
import type { Datum } from '../../typings';
import type { ICrosshairTheme } from './interface';
import type { ITheme } from '../../theme';
export declare function limitTagInBounds(shape: Tag, bounds: IBoundsLike): void;
export declare function getDatumByValue(data: Datum[], value: number, startField: string, endField?: string): Datum | null;
export declare const getCartesianCrosshairTheme: (chartTheme: ITheme, chartSpec: any) => ICrosshairTheme;
export declare const getPolarCrosshairTheme: (chartTheme: ITheme, chartSpec: any) => ICrosshairTheme;
