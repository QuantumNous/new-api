import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { isNumber } from 'lodash';
import { strings } from '../notification/constants';


export type NoticePosition = 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
export type NoticeType = 'warning' | 'success' | 'info' | 'error' | 'default';
export type NoticeTheme = 'light' | 'normal';


export interface NoticeProps {
    duration?: number;
    id?: string;
    title?: any;
    content?: any;
    position?: NoticePosition;
    type?: NoticeType;
    onClick?: (e: any) => void;
    onClose?: () => void;
    onCloseClick?: (id: string) => void;
    showClose?: boolean;
    close?: (id: string) => void;
    zIndex?: number;
    icon?: any;
    getPopupContainer?: () => HTMLElement;
    theme?: NoticeTheme;
    onHookClose?: () => void;
    direction?: typeof strings.directions[number];
    className?: string;
    style?: any
}

export interface NoticeState{
    visible: boolean
}

export interface NoticeInstance extends NoticeProps{
    motion?: boolean
}

export interface NoticeAdapter extends DefaultAdapter<NoticeProps, NoticeState>{
    notifyWrapperToRemove: (id: string) => void;
    notifyClose: () => void
}



export default class NotificationFoundation extends BaseFoundation<NoticeAdapter> {


    _timer: ReturnType<typeof setTimeout> | null = null;

    _id: string | null = null; // cache id

    constructor(adapter: NoticeAdapter) {
        super({ ...NotificationFoundation.defaultAdapter, ...adapter });
    }


    init() {
        this._startCloseTimer();
        this._id = this.getProp('id');
    }

    destroy() {
        this._clearCloseTimer();
    }

    _startCloseTimer() {
        // unit: s
        const duration = this.getProp('duration');
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

    _clearCloseTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    restartCloseTimer() {
        this._clearCloseTimer();
        this._startCloseTimer();
    }
}
