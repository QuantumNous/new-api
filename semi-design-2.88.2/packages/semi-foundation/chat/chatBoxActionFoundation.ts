import BaseFoundation, { DefaultAdapter } from "../base/foundation";

export interface ChatBoxActionAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyDeleteMessage: () => void;
    notifyMessageCopy: () => void;
    copyToClipboardAndToast: () => void;
    notifyLikeMessage: () => void;
    notifyDislikeMessage: () => void;
    notifyResetMessage: () => void;
    setVisible: (visible: boolean) => void;
    setShowAction: (showAction: boolean) => void;
    registerClickOutsideHandler(...args: any[]): void;
    unregisterClickOutsideHandler(...args: any[]): void
}

export default class ChatBoxActionFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ChatBoxActionAdapter<P, S>, P, S> {
    constructor(adapter: ChatBoxActionAdapter<P, S>) {
        super({ ...adapter });
    }

    showDeletePopup = () => {
        this._adapter.setVisible(true);
        this._adapter.setShowAction(true);
        this._adapter.registerClickOutsideHandler(this.hideDeletePopup);
    }

    hideDeletePopup = () => {
        /** visible 控制 popConfirm 的显隐
         * showAction 控制在 popConfirm 显示时候，保证操作区显示
         * 需要有时间间隔，用 visible 直接控制的话，在 popconfirm 通过取消按钮关闭时会导致操作区显示闪动
        */ 
        this._adapter.setVisible(false);
        setTimeout(() => {
            this._adapter.setShowAction(false);
        }, 150);
        this._adapter.unregisterClickOutsideHandler();
    }

    destroy = () => {
        this._adapter.unregisterClickOutsideHandler();
    }

    deleteMessage = () => {
        this._adapter.notifyDeleteMessage();
    }

    copyMessage = () => {
        this._adapter.notifyMessageCopy();
        this._adapter.copyToClipboardAndToast(); 
    }

    likeMessage = () => {
        this._adapter.notifyLikeMessage();
    }

    dislikeMessage = () => {
        this._adapter.notifyDislikeMessage();
    }

    resetMessage = () => {
        this._adapter.notifyResetMessage();
    }

}