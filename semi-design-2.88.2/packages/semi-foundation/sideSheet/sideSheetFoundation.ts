import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { noop } from 'lodash';
import KeyCode from '../utils/keyCode';


export interface SideSheetProps {
    afterVisibleChange?: (isVisible: boolean) => void;
    bodyStyle?: Record<string, any>;
    className?: string;
    closable?: boolean;
    closeIcon?: any;
    closeOnEsc?: boolean;
    disableScroll?: boolean;
    footer?: any;
    getPopupContainer?: () => HTMLElement;
    headerStyle?: Record<string, any>;
    height?: number | string;
    keepDOM?: boolean;
    mask?: boolean;
    maskClosable?: boolean;
    maskStyle?: Record<string, any>;
    motion?: boolean;
    onCancel?: (e: any) => void;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    size?: 'small' | 'medium' | 'large';
    style?: Record<string, any>;
    title?: any;
    visible?: boolean;
    width?: number | string;
    zIndex?: number;
    children?: any;
    'aria-label'?: string
}

export interface SideSheetState {
    displayNone: boolean
}

export interface SideSheetAdapter extends DefaultAdapter<SideSheetProps, SideSheetState> {
    disabledBodyScroll: () => void;
    enabledBodyScroll: () => void;
    notifyCancel: (e: any) => void;
    notifyVisibleChange: (visible: boolean) => void;
    setOnKeyDownListener: () => void;
    removeKeyDownListener: () => void;
    toggleDisplayNone: (displayNone: boolean) => void
}



export default class SideSheetFoundation extends BaseFoundation<SideSheetAdapter> {
    constructor(adapter: SideSheetAdapter) {
        super({ ...SideSheetFoundation.defaultAdapter, ...adapter });
    }

    get defaultAdapter() {
        return ({
            handleCancel: noop,
            beforeShow: noop,
            afterHide: noop,
        });
    }

    destroy() {
        this.afterHide();
    }

    handleCancel(e: any) {
        this._adapter.notifyCancel(e);
    }

    beforeShow() {
        const allowDisable = this.getProp('disableScroll');
        allowDisable && this._adapter.disabledBodyScroll();
        this._adapter.setOnKeyDownListener();
    }

    afterHide() {
        const allowDisable = this.getProp('disableScroll');
        allowDisable && this._adapter.enabledBodyScroll();
        this._adapter.removeKeyDownListener();
    }

    handleKeyDown(e: any) {
        const { closeOnEsc } = this.getProps();
        if (closeOnEsc && e.keyCode === KeyCode.ESC) {
            e.stopPropagation();
            this.handleCancel(e);
            return;
        }
    }


    onVisibleChange(visible: boolean) {
        this._adapter.notifyVisibleChange(visible);
    }


    toggleDisplayNone = (displayNone: boolean)=>{
        this._adapter.toggleDisplayNone(displayNone);
    }

}
