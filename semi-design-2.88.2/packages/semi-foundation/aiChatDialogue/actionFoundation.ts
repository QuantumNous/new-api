import BaseFoundation, { DefaultAdapter } from "../base/foundation";

export interface DialogueActionAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyDeleteMessage: () => void;
    notifyMessageCopy: () => void;
    copyToClipboardAndToast: () => void;
    notifyLikeMessage: () => void;
    notifyDislikeMessage: () => void;
    notifyResetMessage: () => void;
    notifyShareMessage: () => void;
    notifyEditMessage: () => void;
    setVisible: (visible: boolean) => void;
    setShowAction: (showAction: boolean) => void;
    registerClickOutsideHandler(...args: any[]): void;
    unregisterClickOutsideHandler(...args: any[]): void
}

export default class DialogueActionFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<DialogueActionAdapter<P, S>, P, S> {
    constructor(adapter: DialogueActionAdapter<P, S>) {
        super({ ...adapter });
    }

    destroy = () => {
        this._adapter.unregisterClickOutsideHandler();
    }

    copyMessage = () => {
        this._adapter.notifyMessageCopy();
        this._adapter.copyToClipboardAndToast(); 
    }

    resetMessage = () => {
        this._adapter.notifyResetMessage();
    }

    likeMessage = () => {
        this._adapter.notifyLikeMessage();
    }

    dislikeMessage = () => {
        this._adapter.notifyDislikeMessage();
    }

    shareMessage = () => {
        this._adapter.notifyShareMessage();
    }

    editMessage = () => {
        this._adapter.notifyEditMessage();
    }

    deleteMessage = () => {
        this._adapter.notifyDeleteMessage();
        this.hideMoreDropdown();
    }

    showMoreDropdown = () => {
        this._adapter.setVisible(true);
        this._adapter.setShowAction(true);
        this._adapter.registerClickOutsideHandler(this.hideMoreDropdown);
    }

    hideMoreDropdown = () => {
        this._adapter.setVisible(false);
        setTimeout(() => {
            this._adapter.setShowAction(false);
        }, 150);
        this._adapter.unregisterClickOutsideHandler();
    }

}