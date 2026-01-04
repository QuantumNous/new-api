import React, { PureComponent, ReactNode } from 'react';
import PropTypes from 'prop-types';
import type { ChatBoxProps, DefaultActionNodeObj, RenderActionProps } from '../interface';
import { IconThumbUpStroked, 
    IconDeleteStroked, 
    IconCopyStroked, 
    IconLikeThumb, 
    IconRedoStroked 
} from '@douyinfe/semi-icons';
import { BaseComponent, Button, Popconfirm } from '../../index';
import copy from 'copy-text-to-clipboard';
import { cssClasses, strings } from '@douyinfe/semi-foundation/chat/constants';
import ChatBoxActionFoundation, { ChatBoxActionAdapter } from '@douyinfe/semi-foundation/chat/chatBoxActionFoundation';
import LocaleConsumer from "../../locale/localeConsumer";
import { Locale } from "../../locale/interface";
import cls from 'classnames';

const { PREFIX_CHAT_BOX_ACTION } = cssClasses;
const { ROLE, MESSAGE_STATUS } = strings;

interface ChatBoxActionProps extends ChatBoxProps {
    customRenderFunc?: (props: RenderActionProps) => ReactNode
}

interface ChatBoxActionState {
    visible: boolean;
    showAction: boolean
}

class ChatBoxAction extends BaseComponent<ChatBoxActionProps, ChatBoxActionState> {

    static propTypes = {
        role: PropTypes.object,
        message: PropTypes.object,
        showReset: PropTypes.bool,
        onMessageBadFeedback: PropTypes.func,
        onMessageGoodFeedback: PropTypes.func,
        onMessageCopy: PropTypes.func,
        onChatsChange: PropTypes.func,
        onMessageDelete: PropTypes.func,
        onMessageReset: PropTypes.func,
        customRenderFunc: PropTypes.func,
    }

    copySuccessNode: ReactNode;
    foundation: ChatBoxActionFoundation;
    containerRef: React.RefObject<HTMLDivElement>;
    popconfirmTriggerRef: React.RefObject<HTMLSpanElement>;
    clickOutsideHandler: any;

    constructor(props: ChatBoxProps) {
        super(props);
        this.foundation = new ChatBoxActionFoundation(this.adapter);
        this.copySuccessNode = null;
        this.state = {
            visible: false,
            showAction: false,
        };
        this.clickOutsideHandler = null;
        this.containerRef = React.createRef<HTMLDivElement>();
        this.popconfirmTriggerRef = React.createRef<HTMLSpanElement>();
    }

    componentDidMount(): void {
        this.copySuccessNode = <LocaleConsumer<Locale["Chat"]> componentName="Chat" >
            {(locale: Locale["Chat"]) => locale['copySuccess']}
        </LocaleConsumer>;
    }

    componentWillUnmount(): void {
        this.foundation.destroy();
    }

    get adapter(): ChatBoxActionAdapter<ChatBoxActionProps, ChatBoxActionState> {
        return {
            ...super.adapter,
            notifyDeleteMessage: () => {
                const { message, onMessageDelete } = this.props;
                onMessageDelete?.(message);
            },
            notifyMessageCopy: () => {
                const { message, onMessageCopy } = this.props;
                onMessageCopy?.(message);
            },
            copyToClipboardAndToast: () => {
                const { message = {}, toast } = this.props;
                if (typeof message.content === 'string') {
                    copy(message.content);
                } else if (Array.isArray(message.content)) {
                    const content = message.content?.map(item => item.text).join('');
                    copy(content);
                }
                toast.success({
                    content: this.copySuccessNode
                });
            },
            notifyLikeMessage: () => {
                const { message, onMessageGoodFeedback } = this.props;
                onMessageGoodFeedback?.(message);
            },
            notifyDislikeMessage: () => {
                const { message, onMessageBadFeedback } = this.props;
                onMessageBadFeedback?.(message);
            },
            notifyResetMessage: () => {
                const { message, onMessageReset } = this.props;
                onMessageReset?.(message);
            },
            setVisible: (visible) => {
                this.setState({ visible });
            },
            setShowAction: (showAction) => {
                this.setState({ showAction });
            },
            registerClickOutsideHandler: (cb: () => void) => {
                if (this.clickOutsideHandler) {
                    this.adapter.unregisterClickOutsideHandler();
                }
                this.clickOutsideHandler = (e: React.MouseEvent): any => {
                    let el = this.popconfirmTriggerRef && this.popconfirmTriggerRef.current;
                    const target = e.target as Element;
                    const path = (e as any).composedPath && (e as any).composedPath() || [target];
                    if (
                        el && !(el as any).contains(target) && 
                        ! path.includes(el)
                    ) {
                        cb();
                    }
                };
                window.addEventListener('mousedown', this.clickOutsideHandler);
            },
            unregisterClickOutsideHandler: () => {
                if (this.clickOutsideHandler) {
                    window.removeEventListener('mousedown', this.clickOutsideHandler);
                    this.clickOutsideHandler = null;
                }
            },
        };
    }

    copyNode = () => {
        return <Button
            key={'copy'}
            theme='borderless'
            icon={<IconCopyStroked />}
            type='tertiary'
            onClick={this.foundation.copyMessage}
            className={`${PREFIX_CHAT_BOX_ACTION}-btn`}
        />;
    }

    likeNode = () => {
        const { message = {} } = this.props;
        const { like } = message;
        return <Button
            key={'like'}
            theme='borderless'
            icon={like ? <IconLikeThumb /> : <IconThumbUpStroked /> }
            type='tertiary'
            className={`${PREFIX_CHAT_BOX_ACTION}-btn`}
            onClick={this.foundation.likeMessage}
        />;
    }

    dislikeNode = () => {
        const { message = {} } = this.props;
        const { dislike } = message;
        return <Button
            theme='borderless'
            key={'dislike'}
            icon={dislike ? <IconLikeThumb className={`${PREFIX_CHAT_BOX_ACTION}-icon-flip`} /> : <IconThumbUpStroked className={'semi-chat-chatBox-action-icon-flip'} />}
            type='tertiary'
            className={`${PREFIX_CHAT_BOX_ACTION}-btn`}
            onClick={this.foundation.dislikeMessage}
        />;
    }

    resetNode = () => {
        return <Button
            key={'reset'}
            theme='borderless'
            icon={<IconRedoStroked className={`${PREFIX_CHAT_BOX_ACTION}-icon-redo`}/>}
            type='tertiary'
            onClick={this.foundation.resetMessage}
            className={`${PREFIX_CHAT_BOX_ACTION}-btn`}
        />;
    }

    deleteNode = () => {
        const deleteMessage = (<LocaleConsumer<Locale["Chat"]> componentName="Chat" >
            {(locale: Locale["Chat"]) => locale['deleteConfirm']}
        </LocaleConsumer>);
        return (<Popconfirm
            trigger="custom"
            visible={this.state.visible}
            key={'delete'}
            title={deleteMessage}
            onConfirm={this.foundation.deleteMessage}
            onCancel={this.foundation.hideDeletePopup}
            position='top'
        >
            <span 
                ref={this.popconfirmTriggerRef}
                className={`${PREFIX_CHAT_BOX_ACTION}-delete-wrap`}
            >
                <Button
                    theme='borderless'
                    icon={<IconDeleteStroked />}
                    type='tertiary'
                    className={`${PREFIX_CHAT_BOX_ACTION}-btn`}
                    onClick={this.foundation.showDeletePopup}
                />
            </span>
        </Popconfirm>);
    }

    render() {
        const { message = {}, lastChat } = this.props;
        const { showAction } = this.state;
        const { role, status = MESSAGE_STATUS.COMPLETE } = message;
        const complete = status === MESSAGE_STATUS.COMPLETE ;
        const showFeedback = role !== ROLE.USER && complete;
        const showReset = lastChat && role === ROLE.ASSISTANT;
        const finished = status !== MESSAGE_STATUS.LOADING && status !== MESSAGE_STATUS.INCOMPLETE;
        const wrapCls = cls(PREFIX_CHAT_BOX_ACTION, { 
            [`${PREFIX_CHAT_BOX_ACTION}-show`]: showReset && finished || showAction,
            [`${PREFIX_CHAT_BOX_ACTION}-hidden`]: !finished,
        });
        const { customRenderFunc } = this.props;
        if (customRenderFunc) {
            const actionNodes = [];
            const actionNodeObj = {} as DefaultActionNodeObj;
            if (complete) {
                const copyNode = this.copyNode();
                actionNodes.push(copyNode);
                actionNodeObj.copyNode = copyNode;
            }
            if (showFeedback) {
                const likeNode = this.likeNode();
                actionNodes.push(likeNode);
                actionNodeObj.likeNode = likeNode;
                const dislikeNode = this.dislikeNode();
                actionNodes.push(dislikeNode);
                actionNodeObj.dislikeNode = dislikeNode;
            }
            if (showReset) {
                const resetNode = this.resetNode();
                actionNodes.push(resetNode);
                actionNodeObj.resetNode = resetNode;
            }
            const deleteNode = this.deleteNode();
            actionNodes.push(deleteNode);
            actionNodeObj.deleteNode = deleteNode;
            return customRenderFunc({
                message,
                defaultActions: actionNodes,
                className: wrapCls,
                defaultActionsObj: actionNodeObj
            });
        }
        return <div className={wrapCls} ref={this.containerRef}>
            {complete && this.copyNode()}
            {showFeedback && this.likeNode()}
            {showFeedback && this.dislikeNode()}
            {showReset && this.resetNode()}
            {this.deleteNode()}
        </div>;
    }
}

export default ChatBoxAction;
