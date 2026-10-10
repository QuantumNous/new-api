import { type IOrientType } from '../../typings';
import type { ComponentThemeWithDirection } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
export declare function getComponentThemeFromGlobalTheme(type: ComponentTypeEnum, getTheme: (...key: string[]) => any, componentSpec: any, chartSpec: any): any;
export declare const getComponentThemeWithDirection: <T>(componentSpec: {
    orient?: IOrientType;
}, originalTheme: ComponentThemeWithDirection<T>) => T;
