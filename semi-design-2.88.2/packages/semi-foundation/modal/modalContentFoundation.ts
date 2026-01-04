import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import KeyCode from '../utils/keyCode';
import { ModalProps } from '../modal/modalFoundation';

export interface ModalContentProps extends ModalProps {
    onClose: (e: any) => void;
    getContainerContext: () => any;
    isFullScreen?: boolean;
    contentClassName?: string;
    maskClassName?: string;
    onAnimationEnd?: (e: any) => void;
    maskExtraProps?: Record<string, any>;
    contentExtraProps?: Record<string, any>
}

export interface ModalContentState {
    dialogMouseDown: boolean;
    prevFocusElement: HTMLElement
}

export interface ModalContentAdapter extends DefaultAdapter<ModalContentProps, ModalContentState> {
    notifyClose: (e: any) => void;
    notifyDialogMouseDown: () => void;
    notifyDialogMouseUp: () => void;
    addKeyDownEventListener: () => void;
    removeKeyDownEventListener: () => void;
    getMouseState: () => boolean;
    modalDialogFocus: () => void;
    modalDialogBlur: () => void;
    prevFocusElementReFocus: () => void
}

export default class ModalContentFoundation extends BaseFoundation<ModalContentAdapter> {

    constructor(adapter: ModalContentAdapter) {
        super({ ...ModalContentFoundation.defaultAdapter, ...adapter });
    }

    destroy() {
        this.handleKeyDownEventListenerUnmount();
        this.modalDialogBlur();
        this.prevFocusElementReFocus();
    }

    handleDialogMouseDown() {
        this._adapter.notifyDialogMouseDown();
    }

    handleMaskMouseUp() {
        this._adapter.notifyDialogMouseUp();
    }

    handleKeyDown = (e: any) => {
        const { closeOnEsc } = this.getProps();
        if (closeOnEsc && e.keyCode === KeyCode.ESC) {
            e.stopPropagation();
            this.close(e);
            return;
        }
    }

    handleKeyDownEventListenerMount() {
        this._adapter.addKeyDownEventListener();
    }

    handleKeyDownEventListenerUnmount() {
        this._adapter.removeKeyDownEventListener();
    }

    getMouseState() {
        this._adapter.getMouseState();
    }

    handleMaskClick(e: any) {
        const { dialogMouseDown } = this.getStates();
        if (e.target === e.currentTarget && !dialogMouseDown) {
            this.close(e);
        }
    }

    close(e: any) {
        this._adapter.notifyClose(e);
    }

    modalDialogFocus() {
        this._adapter.modalDialogFocus();
    }

    modalDialogBlur() {
        this._adapter.modalDialogBlur();
    }

    prevFocusElementReFocus() {
        this._adapter.prevFocusElementReFocus();
    }
}
