/**
 * @description 工具函数集合
 * @author wangfupeng
 */
declare class NavUA {
    _ua: string;
    isOldEdge: boolean;
    isFirefox: boolean;
    constructor();
    isIE(): boolean;
    isWebkit(): boolean;
}
export declare const UA: NavUA;
/**
 * 获取随机字符
 * @param prefix 前缀
 */
export declare function getRandom(prefix?: string): string;
/**
 * 替换 html 特殊字符
 * @param html html 字符串
 */
export declare function replaceHtmlSymbol(html: string): string;
export declare function replaceSpecialSymbol(value: string): string;
interface Obj {
    [key: string]: unknown;
    [key: number]: unknown;
}
interface ArrObj {
    length: number;
    [key: number]: unknown;
}
/**
 * 遍历对象或数组，执行回调函数
 * @param obj 对象或数组
 * @param fn 回调函数 (key, val) => {...}
 */
export declare function forEach<T extends ArrObj, V = T[Extract<keyof T, number>]>(obj: T, fn: (key: string, value: V) => boolean | void): void;
export declare function forEach<T extends Obj>(obj: T, fn: (key: string, value: T[Extract<keyof T, string | number>]) => boolean | void): void;
export declare function forEach<T extends unknown[]>(obj: T, fn: (key: string, value: T[Extract<keyof T, number>]) => boolean | void): void;
/**
 * 遍历类数组
 * @param fakeArr 类数组
 * @param fn 回调函数
 */
export declare function arrForEach<T extends {
    length: number;
    [key: number]: unknown;
}>(fakeArr: T, fn: (this: T, item: T[number], index: number) => boolean | unknown): void;
/**
 * 节流
 * @param fn 函数
 * @param interval 间隔时间，毫秒
 */
export declare function throttle<C, T extends unknown[]>(fn: (this: C, ...args: T) => unknown, interval?: number): (this: C, ...args: T) => void;
/**
 * 防抖
 * @param fn 函数
 * @param delay 间隔时间，毫秒
 */
export declare function debounce<C, T extends unknown[]>(fn: (this: C, ...args: T) => void, delay?: number): (this: C, ...args: T) => void;
/**
 * isFunction 是否是函数
 * @param fn 函数
 */
export declare function isFunction(fn: any): fn is Function;
/**
 * 引用与非引用值 深拷贝方法
 * @param data
 */
export declare function deepClone<T>(data: T): T;
/**
 * 将可遍历的对象转换为数组
 * @param data 可遍历的对象
 */
export declare function toArray<T>(data: T): any[];
/**
 * 唯一id生成
 * @param length 随机数长度
 */
export declare function getRandomCode(): string;
/**
 * hex color 转换成 rgb
 * @param hex string
 */
export declare function hexToRgb(hex: string): string | null;
export {};
