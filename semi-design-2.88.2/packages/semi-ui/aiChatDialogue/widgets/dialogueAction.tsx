import React, { ReactNode } from 'react';
import { AIChatDialogueActionProps, DefaultActionNodeObj } from '../interface';
import { IconThumbUpStroked, 
    IconDeleteStroked, 
    IconShareStroked,
    IconCopyStroked, 
    IconLikeThumb, 
    IconRedoStroked,
    IconEditStroked,
    IconMoreStroked
} from '@douyinfe/semi-icons';
import BaseComponent from '../../_base/baseComponent';
import { Button, Dropdown, Modal, Toast } from '../../index';
import copy from 'copy-text-to-clipboard';
import { cssClasses, strings } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import DialogueActionFoundation, { DialogueActionAdapter } from '@douyinfe/semi-foundation/aiChatDialogue/actionFoundation';
import LocaleConsumer from "../../locale/localeConsumer";
import { Locale } from "../../locale/interface";
import cls from 'classnames';

const { PREFIX_ACTION } = cssClasses;
const { ROLE, STATUS } = strings;

interface AIChatDialogueActionState {
    visible: boolean;
    showAction: boolean
}

class DialogueAction extends BaseComponent<AIChatDialogueActionProps, AIChatDialogueActionState> {

    copySuccessNode: ReactNode;
    foundation: DialogueActionFoundation;
    containerRef: React.RefObject<HTMLDivElement>;
    dropdownTriggerRef: React.RefObject<HTMLSpanElement>;
    clickOutsideHandler: any;

    constructor(props: AIChatDialogueActionProps) {
        super(props);
        this.foundation = new DialogueActionFoundation(this.adapter);
        this.state = {
            visible: false,
            showAction: false,
        };
        this.copySuccessNode = null;
        this.clickOutsideHandler = null;
        this.containerRef = React.createRef<HTMLDivElement>();
        this.dropdownTriggerRef = React.createRef<HTMLSpanElement>();
    }

    componentDidMount(): void {
        this.copySuccessNode = <LocaleConsumer<Locale["AIChatDialogue"]> componentName="AIChatDialogue" >
            {(locale: Locale["AIChatDialogue"]) => locale['copySuccess']}
        </LocaleConsumer>;
    }

    get adapter(): DialogueActionAdapter<AIChatDialogueActionProps, AIChatDialogueActionState> {
        return {
            ...super.adapter,
            notifyMessageCopy: () => {
                const { message, onMessageCopy } = this.props;
                onMessageCopy?.(message);
            },
            copyToClipboardAndToast: () => {
                const { message } = this.props;
                if (typeof message?.content === 'string') {
                    copy(message.content);
                } else if (Array.isArray(message?.content)) {
                    const content = message.content?.map(item => {
                        if (typeof (item as any)?.content === 'string') {
                            return (item as any)?.content;
                        } else {
                            return (item as any)?.content?.map(innerItem => innerItem?.text).join('');
                        }
                    }).join('');
                    copy(content);
                }
                Toast.success({
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
            notifyShareMessage: () => {
                const { message, onMessageShare } = this.props;
                onMessageShare?.(message);
            },
            notifyEditMessage: () => {
                const { message, onMessageEdit } = this.props;
                onMessageEdit?.(message);
            },
            notifyDeleteMessage: () => {
                const { message, onMessageDelete } = this.props;
                onMessageDelete?.(message);
            },
            setVisible: (visible: boolean) => {
                this.setState({ visible });
            },
            setShowAction: (showAction: boolean) => {
                this.setState({ showAction });
            },
            registerClickOutsideHandler: (cb: () => void) => {
                if (this.clickOutsideHandler) {
                    this.adapter.unregisterClickOutsideHandler();
                }
                this.clickOutsideHandler = (e: React.MouseEvent): any => {
                    let el = this.dropdownTriggerRef && this.dropdownTriggerRef.current;
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

    showDeleteModal = () => {
        Modal.warning({ title: <LocaleConsumer<Locale["AIChatDialogue"]> componentName="AIChatDialogue" >
            {(locale: Locale["AIChatDialogue"]) => locale['deleteConfirm']}
        </LocaleConsumer>, content: <LocaleConsumer<Locale["AIChatDialogue"]> componentName="AIChatDialogue" >
            {(locale: Locale["AIChatDialogue"]) => locale['deleteContent']}
        </LocaleConsumer>, onOk: this.foundation.deleteMessage });
        this.foundation.hideMoreDropdown();
    }

    copyNode = () => {
        return <Button
            key={'copy'}
            theme='borderless'
            icon={<IconCopyStroked />}
            type='tertiary'
            onClick={this.foundation.copyMessage}
            className={`${PREFIX_ACTION}-btn`}
        />;
    }

    resetNode = () => {
        return <Button
            key={'reset'}
            theme='borderless'
            icon={<IconRedoStroked className={`${PREFIX_ACTION}-icon-redo`}/>}
            type='tertiary'
            onClick={this.foundation.resetMessage}
            className={`${PREFIX_ACTION}-btn`}
        />;
    }

    shareNode = () => {
        return <Button
            key={'share'}
            theme='borderless'
            icon={<IconShareStroked />}
            type='tertiary'
            onClick={this.foundation.shareMessage}
        />;
    }


    likeNode = () => {
        const { message } = this.props;
        const { like } = message;
        return <Button
            key={'like'}
            theme='borderless'
            icon={like ? <IconLikeThumb /> : <IconThumbUpStroked /> }
            type='tertiary'
            className={`${PREFIX_ACTION}-btn`}
            onClick={() => this.foundation.likeMessage()}
        />;
    }

    dislikeNode = () => {
        const { message } = this.props;
        const { dislike } = message;
        return <Button
            theme='borderless'
            key={'dislike'}
            icon={dislike ? <IconLikeThumb className={`${PREFIX_ACTION}-icon-flip`} /> : <IconThumbUpStroked className={'semi-chat-chatBox-action-icon-flip'} />}
            type='tertiary'
            className={`${PREFIX_ACTION}-btn`}
            onClick={() => this.foundation.dislikeMessage()}
        />;
    }

    editNode = () => {
        // todo: 支持多模态消息编辑，需要使用 aiChatInput 组件
        return <Button
            key={'edit'}
            theme='borderless'
            icon={<IconEditStroked />}
            type='tertiary'
            onClick={() => this.foundation.editMessage()}
        />;
    }



    moreNode = () => {
        return (
            <Dropdown
                trigger="custom"
                position='bottomLeft'
                className={`${PREFIX_ACTION}-dropdown`}
                visible={this.state.visible}
                onCancel={this.foundation.hideMoreDropdown}
                spacing={12}
                stopPropagation
                render={
                    <Dropdown.Menu>
                        <Dropdown.Item onClick={() => this.showDeleteModal()}>
                            <IconDeleteStroked /> <LocaleConsumer<Locale["AIChatDialogue"]> componentName="AIChatDialogue" >
                                {(locale: Locale["AIChatDialogue"]) => locale['delete']}
                            </LocaleConsumer>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <span 
                    ref={this.dropdownTriggerRef}
                >
                    <Button
                        key={'more'}
                        theme='borderless'
                        icon={<IconMoreStroked />}
                        type='tertiary'
                        onClick={this.foundation.showMoreDropdown}
                    />
                </span>
            </Dropdown>)
        ;
    }

    render() {
        const { message, isLastChat } = this.props;
        const { showAction } = this.state;
        const { role, status = STATUS.COMPLETED } = message;
        const completed = status === STATUS.COMPLETED ;
        const showFeedback = role !== ROLE.USER && completed;
        const showReset = isLastChat && role === ROLE.ASSISTANT;
        const finished = status !== STATUS.IN_PROGRESS && status !== STATUS.INCOMPLETE;
        const showEdit = role === ROLE.USER;

        const wrapCls = cls(PREFIX_ACTION, { 
            [`${PREFIX_ACTION}-show`]: showReset && finished || showAction,
            [`${PREFIX_ACTION}-hidden`]: !finished
        });

        const { customRenderFunc } = this.props;
        if (customRenderFunc) {
            const actionNodes = [];
            const actionNodeObj = {} as DefaultActionNodeObj;
            if (completed) {
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
            const moreNode = this.moreNode();
            actionNodes.push(moreNode);
            actionNodeObj.moreNode = moreNode;
            return customRenderFunc({
                message,
                defaultActions: actionNodes,
                className: wrapCls,
                defaultActionsObj: actionNodeObj
            });
        }

        return <div className={wrapCls} ref={this.containerRef}>
            {completed && this.copyNode()}
            {showReset && this.resetNode()}
            {completed && this.shareNode()}
            {showEdit && this.editNode()}
            {showFeedback && this.likeNode()}
            {showFeedback && this.dislikeNode()}
            {this.moreNode()}
        </div>;
    }
}

export default DialogueAction;
