import { handlePrevent } from "../utils/a11y";
import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import { strings } from './constants';

const { SEND_HOT_KEY } = strings;

export interface InputBoxAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyInputChange: (props: { inputValue: string; attachment: any[]}) => void;
    setInputValue: (value: string) => void;
    setAttachment: (attachment: any[]) => void;
    notifySend: (content: string, attachment: any[]) => void
}

export default class InputBoxFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<InputBoxAdapter<P, S>, P, S> {
    constructor(adapter: InputBoxAdapter<P, S>) {
        super({ ...adapter });
    }

    onInputAreaChange = (value: string) => {
        const attachment = this.getState('attachment');
        this._adapter.setInputValue(value);
        this._adapter.notifyInputChange({ inputValue: value, attachment });
    }

    onAttachmentAdd = (props: any) => {
        const { fileList } = props;
        const { uploadProps } = this.getProps();
        const { onChange } = uploadProps;
        if (onChange) {
            onChange(props);
        }
        const { content } = this.getStates();
        let newFileList = [...fileList];
        this._adapter.setAttachment(newFileList);
        this._adapter.notifyInputChange({
            inputValue: content,
            attachment: newFileList
        });
    }
    
    onAttachmentDelete = (props: any) => {
        const { content, attachment } = this.getStates();
        const newAttachMent = attachment.filter(item => item.uid !== props.uid);
        this._adapter.setAttachment(newAttachMent);
        this._adapter.notifyInputChange({
            inputValue: content,
            attachment: newAttachMent
        });
    }
    
    onSend = (e: any) => {
        if (this.getDisableSend()) {
            return; 
        }
        const { content, attachment } = this.getStates();
        this._adapter.setInputValue('');
        this._adapter.setAttachment([]);
        this._adapter.notifySend(content, attachment);
    }

    getDisableSend = () => {
        const { content, attachment } = this.getStates();
        const { disableSend: disableSendInProps } = this.getProps();
        /** 不能发送的条件：（满足任1）
         *  1. props 中禁止发送；2. 没有文本输入，且没有上传文件； 3.上传文件中有状态不为 success 的
         *  Conditions under which content cannot be sent: (any one of the following conditions must be met)
         *  1. Sending is disabled in props; 2. No text input and no file upload; 3. There are files uploaded that do not have a success status.
         */
        const disabledSend = disableSendInProps || 
            (content.length === 0 && attachment.length === 0) || 
            attachment.find(item => item.status !== strings.FILE_STATUS.SUCCESS)
        ;
        return disabledSend;
    }

    onEnterPress = (e: any) => {
        const { sendHotKey } = this.getProps();
        if (sendHotKey === SEND_HOT_KEY.SHIFT_PLUS_ENTER && e.shiftKey === false) {
            return ;
        } else if (sendHotKey === SEND_HOT_KEY.ENTER && e.shiftKey === true) {
            return ;
        }
        handlePrevent(e);
        this.onSend(e);
    };

    onPaste = (e: any) => {
        const items = e.clipboardData?.items;
        const { manualUpload, pasteUpload } = this.getProps();
        let files = [];
        if (pasteUpload && items) {
            for (const it of items) {
                const file = it.getAsFile();
                file && files.push(it.getAsFile());
            }
            if (files.length) {
                // 文件上传，则需要阻止默认粘贴行为
                // File upload, you need to prevent the default paste behavior
                manualUpload(files);
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

}