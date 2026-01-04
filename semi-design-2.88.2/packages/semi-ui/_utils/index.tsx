import React from 'react';
import { cloneDeepWith, set, get } from 'lodash';
import warning from '@douyinfe/semi-foundation/utils/warning';
import { isHTMLElement } from '@douyinfe/semi-foundation/utils/dom';
import semiGlobal from "./semi-global";
/**
 * stop propagation
 *
 * @param {React.MouseEvent<HTMLElement>} e React mouse event object
 * @param {boolean} noImmediate Skip stopping immediate propagation
 */
export function stopPropagation(e: React.MouseEvent | React.FocusEvent<HTMLElement>, noImmediate?: boolean) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }

    if (!noImmediate && e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
        e.nativeEvent.stopImmediatePropagation();
    }
}

/**
 * use in Table, Form, Navigation
 * 
 * skip clone function and react element
 */
export function cloneDeep<T>(value: T): T;
export function cloneDeep<T>(value: T, customizer: (value: any) => any): any;
export function cloneDeep(value: any, customizer?: (value: any) => any) {
    return cloneDeepWith(value, v => {
        if (typeof customizer === 'function') {
            return customizer(v);
        }
        if (typeof v === 'function' || React.isValidElement(v)) {
            return v;
        }
        if (Object.prototype.toString.call(v) === '[object Error]') {
            return v;
        }
        // it is tricky
        // when array length beyond max length, array.length will be 0
        if (Array.isArray(v) && v.length === 0) {
            const keys: string[] = Object.keys(v);
            if (keys.length) {
                const newArray: any[] = [];
                keys.forEach(key => {
                    set(newArray, key, v[key]);
                });
                // internal-issues:887
                try {
                    warning(
                        get(process, 'env.NODE_ENV') !== 'production',
                        `[Semi] You may use an out-of-bounds array. In some cases, your program may not behave as expected.
                    The maximum length of an array is 4294967295.
                    Please check whether the array subscript in your data exceeds the maximum value of the JS array subscript`
                    );
                } catch (e) {

                }
                return newArray;
            } else {
                return undefined;
            }
        }
        return undefined;
    });
}
export interface RegisterMediaQueryOption {
    match?: (e: MediaQueryList | MediaQueryListEvent) => void;
    unmatch?: (e: MediaQueryList | MediaQueryListEvent) => void;
    callInInit?: boolean
}

/**
 * register matchFn and unMatchFn callback while media query
 * @param {string} media media string
 * @param {object} param param object
 * @returns function
 */
export const registerMediaQuery = (media: string, { match, unmatch, callInInit = true }: RegisterMediaQueryOption): () => void => {
    if (typeof window !== 'undefined') {
        const mediaQueryList = window.matchMedia(media);
        function handlerMediaChange(e: MediaQueryList | MediaQueryListEvent): void {
            if (e.matches) {
                match && match(e);
            } else {
                unmatch && unmatch(e);
            }
        }
        callInInit && handlerMediaChange(mediaQueryList);
        if (Object.prototype.hasOwnProperty.call(mediaQueryList, 'addEventListener')) {
            mediaQueryList.addEventListener('change', handlerMediaChange);
            return (): void => mediaQueryList.removeEventListener('change', handlerMediaChange);
        }
        mediaQueryList.addListener(handlerMediaChange);
        return (): void => mediaQueryList.removeListener(handlerMediaChange);
    }
    return () => undefined;
};

/**
 * Determine whether the incoming element is a built-in icon
 * @param icon 元素
 * @returns boolean
 */
export const isSemiIcon = (icon: any): boolean => React.isValidElement(icon) && get(icon.type, 'elementType') === 'Icon';

export function getActiveElement(): HTMLElement | null {
    return document ? document.activeElement as HTMLElement : null;
}

export function isNodeContainsFocus(node: HTMLElement) {
    const activeElement = getActiveElement();
    return activeElement === node || node.contains(activeElement);
}

export function getFocusableElements(node: HTMLElement) {
    if (!isHTMLElement(node)) {
        return [];
    }
    const focusableSelectorsList = [
        "input:not([disabled]):not([tabindex='-1'])",
        "textarea:not([disabled]):not([tabindex='-1'])",
        "button:not([disabled]):not([tabindex='-1'])",
        "a[href]:not([tabindex='-1'])",
        "select:not([disabled]):not([tabindex='-1'])",
        "area[href]:not([tabindex='-1'])",
        "iframe:not([tabindex='-1'])",
        "object:not([tabindex='-1'])",
        "*[tabindex]:not([tabindex='-1'])",
        "*[contenteditable]:not([tabindex='-1'])",
    ];
    const focusableSelectorsStr = focusableSelectorsList.join(',');
    // we are not filtered elements which are invisible
    const focusableElements = Array.from(node.querySelectorAll<HTMLElement>(focusableSelectorsStr));
    return focusableElements;
}



export async function runAfterTicks(func: (...args: any) => any, numberOfTicks: number) {
    if (numberOfTicks===0) {
        await func();
        return;
    } else {
        await new Promise<void>(resolve=>{
            setTimeout(async ()=>{
                await runAfterTicks(func, numberOfTicks-1);
                resolve();
            }, 0);
        });
        return;
    }
}

export function getScrollbarWidth() {
    if (globalThis && Object.prototype.toString.call(globalThis) === '[object Window]') {
        return window.innerWidth - document.documentElement.clientWidth;
    }
    return 0;
}

export function getDefaultPropsFromGlobalConfig(componentName: string, semiDefaultProps: any = {}) {
    const getFromGlobalConfig = ()=> semiGlobal?.config?.overrideDefaultProps?.[componentName] || {};
    return new Proxy({
        ...semiDefaultProps,
    }, {
        get(target, key, receiver) {
            const defaultPropsFromGlobal = getFromGlobalConfig();
            if (key in defaultPropsFromGlobal) {
                return defaultPropsFromGlobal[key];
            }
            return Reflect.get(target, key, receiver);
        },
        set(target, key, value, receiver) {
            return Reflect.set(target, key, value, receiver);
        },
        ownKeys() {
            const defaultPropsFromGlobal = getFromGlobalConfig();
            return Array.from(new Set([...Reflect.ownKeys(semiDefaultProps), ...Object.keys(defaultPropsFromGlobal)]));
        },
        getOwnPropertyDescriptor(target, key) {
            const defaultPropsFromGlobal = getFromGlobalConfig();
            if (key in defaultPropsFromGlobal) {
                return Reflect.getOwnPropertyDescriptor(defaultPropsFromGlobal, key);
            } else {
                return Reflect.getOwnPropertyDescriptor(target, key);
            }
        }
    });
}

