import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { isNumber, noop } from 'lodash';


export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'default';
export type ToastTheme = 'light' | 'normal';
export type Directions = 'ltr' | 'rtl';

export interface ConfigProps {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    duration?: number;
    zIndex?: number;
    theme?: ToastTheme;
    getPopupContainer?: () => HTMLElement | null
}
export interface ToastProps extends ConfigProps {
    onClose?: () => void;
    content: any;
    type?: ToastType;
    textMaxWidth?: string | number;
    style?: Record<string, any>;
    className?: string;
    showClose?: boolean;
    icon?: any;
    direction?: Directions;
    close?: (id: string) => void;
    stack?: boolean
}


export interface ToastInstance extends ToastProps{
    id?: string;
    motion?: boolean
}

export interface ToastState{}


export interface ToastAdapter extends DefaultAdapter<ToastProps, ToastState>{
    notifyWrapperToRemove: (id: string) => void;
    notifyClose: () => void
}

export default class ToastFoundation extends BaseFoundation<ToastAdapter> {


    _timer: ReturnType<typeof setTimeout> = null;

    _id: string | null = null; // cache id

    constructor(adapter: ToastAdapter) {
        super({ ...ToastFoundation.defaultAdapter, ...adapter });
    }

    init() {
        this.startCloseTimer_();
        this._id = this._adapter.getProp('id');
    }

    destroy() {
        this.clearCloseTimer_();
    }

    startCloseTimer_() {
        // unit: s
        const duration = this._adapter.getProp('duration');
        if (duration && isNumber(duration)) {
            this._timer = setTimeout(() => {
                this.close(); // call parent to remove itself
            }, duration * 1000);
        }
    }

    close(e?: any) {
        if (e) {
            e.stopPropagation();
        }
        this._adapter.notifyWrapperToRemove(this._id);
        this._adapter.notifyClose();
    }

    clearCloseTimer_() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    restartCloseTimer() {
        this.clearCloseTimer_();
        this.startCloseTimer_();
    }
}
