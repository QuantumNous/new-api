import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import isPromise from "../utils/isPromise";

export type OKType = 'primary' | 'secondary' | 'tertiary' | 'warning' | 'danger';
export type Size = 'small' | 'medium' | 'large' | 'full-width';

export interface ModalAdapter extends DefaultAdapter<ModalProps, ModalState> {
    disabledBodyScroll: () => void;
    enabledBodyScroll: () => void;
    notifyCancel: (e: any) => void | Promise<any>;
    notifyOk: (e: any) => void | Promise<any>;
    notifyClose: () => void;
    toggleDisplayNone: (displayNone: boolean, callback?: (displayNone: boolean) => void) => void;
    notifyFullScreen: (isFullScreen: boolean) => void;
    getProps: () => ModalProps
}

export interface ModalProps {
    afterClose?: () => void;
    bodyStyle?: Record<string, any>;
    cancelButtonProps?: any;
    cancelText?: string;
    centered?: boolean;
    className?: string;
    modalContentClass?: string;
    closable?: boolean;
    confirmLoading?: boolean;
    cancelLoading?: boolean;
    content?: any;
    footer?: any;
    hasCancel?: boolean;
    header?: any;
    height?: string | number;
    mask?: boolean;
    maskClosable?: boolean;
    maskStyle?: Record<string, any>;
    maskFixed?: boolean;
    motion?: boolean;
    okButtonProps?: any;
    okText?: string;
    okType?: OKType;
    onCancel?: (e: any) => void | Promise<any>;
    onOk?: (e: any) => void | Promise<any>;
    style?: Record<string, any>;
    title?: any;
    visible?: boolean;
    width?: string | number;
    zIndex?: number;
    icon?: any;
    getPopupContainer?: () => HTMLElement;
    closeIcon?: any;
    closeOnEsc?: boolean;
    size?: Size;
    lazyRender?: boolean;
    keepDOM?: boolean;
    direction?: any;
    fullScreen?: boolean;
    preventScroll?: boolean;
    footerFill?: boolean
}
export interface ModalState {
    displayNone: boolean;
    isFullScreen: boolean;
    onOKReturnPromiseStatus?: "pending"|"fulfilled"|"rejected";
    onCancelReturnPromiseStatus?: "pending"|"fulfilled"|"rejected"
}

export default class ModalFoundation extends BaseFoundation<ModalAdapter> {

    constructor(adapter: ModalAdapter) {
        super({
            ...adapter,
        });
    }

    destroy() {
        this.afterHide();
    }

    handleCancel(e: any) {
        const result = this._adapter.notifyCancel(e);
        if (isPromise(result)) {
            this._adapter.setState({ onCancelReturnPromiseStatus: "pending" });
            (result as Promise<any>)?.then(() => {
                this._adapter.setState({ onCancelReturnPromiseStatus: "fulfilled" });
            })?.catch(e => {
                this._adapter.setState({ onCancelReturnPromiseStatus: "rejected" });
                throw e;
            });
        }
    }

    handleOk(e: any) {
        const result = this._adapter.notifyOk(e);
        if (isPromise(result)) {
            this._adapter.setState({ onOKReturnPromiseStatus: "pending" });
            (result as Promise<any>)?.then(() => {
                this._adapter.setState({ onOKReturnPromiseStatus: "fulfilled" });
            })?.catch(e => {
                this._adapter.setState({ onOKReturnPromiseStatus: "rejected" });
                throw e;
            });
        }
    }

    beforeShow() {
        this._adapter.disabledBodyScroll();
    }

    afterHide() {
        this._adapter.enabledBodyScroll();
        this._adapter.notifyClose();
    }

    enabledBodyScroll() {
        this._adapter.enabledBodyScroll();
    }

    // afterClose() {
    //     this._adapter.notifyClose();
    // }


    toggleDisplayNone = (displayNone: boolean, callback?: (displayNone: boolean) => void) => {
        this._adapter.toggleDisplayNone(displayNone, callback);
    };


    // mergeMotionProp = (motion: Motion, prop: string, cb: () => void) => {
    //     const mergedMotion = typeof (motion) === 'undefined' || motion ? {
    //         ...(motion as { [key: string]: (() => void) | boolean }),
    //         [prop]: (...args: any) => {
    //             const curr = get(motion, prop);
    //             if (typeof curr === 'function') {
    //                 curr(...args);
    //             }
    //             cb();
    //         }
    //     } : false;
    //     return mergedMotion;
    // };
    //
    // getMergedMotion() {
    //     let { motion } = this._adapter.getProps();
    //     const { keepDOM } = this._adapter.getProps();
    //     motion = this.mergeMotionProp(motion, 'didLeave', this.afterClose.bind(this));
    //     if (!keepDOM) {
    //         return motion;
    //     }
    //     const mergedMotion = this.mergeMotionProp(motion, 'didLeave', this.toggleHidden.bind(this, true));
    //     return mergedMotion;
    // }
}
