import React, { PureComponent } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { FileItem } from '../../upload/interface';
import type { InputBoxProps, InputBoxState } from '../interface';
import { BaseComponent, Button, Upload, Tooltip, TextArea } from '../../index';
import { IconDeleteStroked, IconChainStroked, IconArrowUp } from '@douyinfe/semi-icons';
import { cssClasses, strings } from "@douyinfe/semi-foundation/chat/constants";
import InputBoxFoundation, { InputBoxAdapter } from '@douyinfe/semi-foundation/chat/inputboxFoundation';
import Attachment from '../attachment';

const { PREFIX_INPUT_BOX } = cssClasses;
const { SEND_HOT_KEY } = strings;
const textAutoSize = { minRows: 1, maxRows: 5 };

class InputBox extends BaseComponent<InputBoxProps, InputBoxState> {

    inputAreaRef: React.RefObject<any>;
    static propTypes = {
        uploadProps: PropTypes.object,
    };

    static defaultProps = {
        uploadProps: {}
    };

    constructor(props: InputBoxProps) {
        super(props);
        this.inputAreaRef = React.createRef();
        this.foundation = new InputBoxFoundation(this.adapter);

        this.state = {
            content: '',
            attachment: []
        };
    }

    get adapter(): InputBoxAdapter<InputBoxProps, InputBoxState> {
        return {
            ...super.adapter,
            notifyInputChange: (props: { inputValue: string; attachment: any[]}) => {
                const { onInputChange } = this.props;
                onInputChange && onInputChange(props);
            },
            setInputValue: (value) => {
                this.setState({
                    content: value
                });
            },
            setAttachment: (attachment: any[]) => {
                this.setState({
                    attachment: attachment
                });
            },
            notifySend: (content: string, attachment: FileItem[]) => {
                const { onSend } = this.props;
                onSend && onSend(content, attachment);
            }
        };
    }

    onClick = () => {
        this.inputAreaRef.current?.focus();
    }

    renderUploadButton = () => {
        const { uploadProps, uploadRef, uploadTipProps, clickUpload } = this.props;
        if (!clickUpload) {
            return null;
        }
        const { attachment } = this.state;
        const { className, onChange, renderFileItem, children, ...rest } = uploadProps;
        const realUploadProps = {
            ...rest,
            className: cls(`${PREFIX_INPUT_BOX}-upload`, {
                [className]: className
            }),
            onChange: this.foundation.onAttachmentAdd,
        };
        const uploadNode = <Upload
            ref={uploadRef}
            fileList={attachment}
            {...realUploadProps}
        >
            {children ? children : <Button 
                className={`${PREFIX_INPUT_BOX}-uploadButton`}
                icon={<IconChainStroked size="extra-large" />}
                theme='borderless'
            />}
        </Upload>;
        return (uploadTipProps ? <Tooltip {...uploadTipProps}><span>{uploadNode}</span></Tooltip> : uploadNode);
    }

    renderInputArea = () => {
        const { content, attachment } = this.state;
        const { placeholder, sendHotKey } = this.props;
        return (<div
            className={`${PREFIX_INPUT_BOX}-inputArea`}
        >
            <TextArea
                placeholder={placeholder}
                onEnterPress={this.foundation.onEnterPress}
                value={content}
                onChange={this.foundation.onInputAreaChange}
                ref={this.inputAreaRef}
                className={`${PREFIX_INPUT_BOX}-textarea`}
                autosize={textAutoSize} 
                disabledEnterStartNewLine={sendHotKey === SEND_HOT_KEY.ENTER ? true : false}
                onPaste={this.foundation.onPaste as any}
            />
            <Attachment 
                attachment={attachment as any} 
                onClear={this.foundation.onAttachmentDelete}
            />
        </div>);
    }

    renderClearButton = () => {
        const { onClearContext } = this.props;
        return (
            <Button
                className={`${PREFIX_INPUT_BOX}-clearButton`}
                theme='borderless'
                icon={<IconDeleteStroked />}
                onClick={onClearContext}
            />
        );
    }

    renderSendButton = () => {
        const disabledSend = this.foundation.getDisableSend();
        return (
            <Button
                disabled={disabledSend}
                theme='solid'
                type='primary'
                className={`${PREFIX_INPUT_BOX}-sendButton`}
                // icon={<IconSend size="extra-large" className={`${PREFIX_INPUT_BOX}-sendButton-icon`} />}
                icon={<IconArrowUp size="large" className={`${PREFIX_INPUT_BOX}-sendButton-icon`} />}
                onClick={this.foundation.onSend}
            />
        );
    }

    render() {
        const { onClearContext, renderInputArea, onSend, style, className, showClearContext } = this.props;
        const clearNode = this.renderClearButton();
        const uploadNode = this.renderUploadButton();
        const inputNode = this.renderInputArea();
        const sendNode = this.renderSendButton();
        const nodes = (
            <div className={cls(PREFIX_INPUT_BOX, { [className]: className })} style={style}>
                <div 
                    className={`${PREFIX_INPUT_BOX}-inner`}
                    onClick={this.onClick}
                >
                    {showClearContext && clearNode}
                    <div className={`${PREFIX_INPUT_BOX}-container`}>
                        {uploadNode}
                        {inputNode}
                        {sendNode}
                    </div>
                </div>
            </div>
        );
        if (renderInputArea) {
            return renderInputArea({
                defaultNode: nodes, 
                onClear: onClearContext,
                onSend: onSend,
                detailProps: {
                    clearContextNode: clearNode,
                    uploadNode: uploadNode,
                    inputNode: inputNode,
                    sendNode: sendNode,
                    onClick: this.onClick,
                }
            });
        }
        return nodes; 
    }
}

export default InputBox;