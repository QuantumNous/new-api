import * as React from 'react';
import BaseComponent from '../_base/baseComponent';
import cls from "classnames";
import PropTypes from 'prop-types';
import type { ChatProps, ChatState, Message } from './interface';
import InputBox from './inputBox';
import "@douyinfe/semi-foundation/chat/chat.scss";
import Hint from './hint';
import { IconChevronDown, IconDisc } from '@douyinfe/semi-icons';
import ChatContent from './chatContent';
import { getDefaultPropsFromGlobalConfig } from '../_utils';
import { cssClasses, strings } from '@douyinfe/semi-foundation/chat/constants';
import ChatFoundation, { ChatAdapter } from '@douyinfe/semi-foundation/chat/foundation';
import type { FileItem } from '../upload';
import LocaleConsumer from "../locale/localeConsumer";
import { Locale } from "../locale/interface";
import { Button, Upload } from '../index';
import ResizeObserver from '../resizeObserver';

const prefixCls = cssClasses.PREFIX;
const { CHAT_ALIGN, MODE, SEND_HOT_KEY, MESSAGE_STATUS } = strings;

class Chat extends BaseComponent<ChatProps, ChatState> {

    static __SemiComponentName__ = "Chat";
    // dragStatus: Whether the component contains the dragged object  
    dragStatus = false;

    containerRef: React.RefObject<HTMLDivElement>;
    animation: any;
    wheelEventHandler: any;
    foundation: ChatFoundation;
    uploadRef: React.RefObject<Upload>;
    dropAreaRef: React.RefObject<HTMLDivElement>;
    scrollTargetRef: React.RefObject<HTMLElement>;

    static propTypes = {
        className: PropTypes.string,
        style: PropTypes.object,
        roleConfig: PropTypes.object,
        chats: PropTypes.array,
        hints: PropTypes.array,
        renderHintBox: PropTypes.func,
        onChatsChange: PropTypes.func,
        align: PropTypes.string,
        chatBoxRenderConfig: PropTypes.object,
        customMarkDownComponents: PropTypes.object,
        onClear: PropTypes.func,
        onMessageDelete: PropTypes.func,
        onMessageReset: PropTypes.func,
        onMessageCopy: PropTypes.func,
        onMessageGoodFeedback: PropTypes.func,
        onMessageBadFeedback: PropTypes.func,
        inputContentConvert: PropTypes.func,
        onMessageSend: PropTypes.func,
        InputBoxStyle: PropTypes.object,
        inputBoxCls: PropTypes.string,
        renderFullInputBox: PropTypes.func,
        placeholder: PropTypes.string,
        topSlot: PropTypes.node || PropTypes.array,
        bottomSlot: PropTypes.node || PropTypes.array,
        showStopGenerate: PropTypes.bool,
        showClearContext: PropTypes.bool,
        hintStyle: PropTypes.object,
        hintCls: PropTypes.string,
        uploadProps: PropTypes.object,
        uploadTipProps: PropTypes.object,
        mode: PropTypes.string,
        markdownRenderProps: PropTypes.object,
    };

    static defaultProps = getDefaultPropsFromGlobalConfig(Chat.__SemiComponentName__, {
        align: CHAT_ALIGN.LEFT_RIGHT,
        showStopGenerate: false,
        mode: MODE.BUBBLE,
        showClearContext: false,
        sendHotKey: SEND_HOT_KEY.ENTER,
    })

    constructor(props: ChatProps) {
        super(props);

        this.containerRef = React.createRef();
        this.uploadRef = React.createRef();
        this.dropAreaRef = React.createRef();
        this.wheelEventHandler = null;
        this.foundation = new ChatFoundation(this.adapter);
        this.scrollTargetRef = React.createRef();

        this.state = {
            backBottomVisible: false,
            chats: [],
            cacheHints: [],
            wheelScroll: false,
            uploadAreaVisible: false,
        };
    }

    get adapter(): ChatAdapter {
        return {
            ...super.adapter,
            getContainerRef: () => this.containerRef?.current,
            setWheelScroll: (flag: boolean) => {
                this.setState({
                    wheelScroll: flag,
                });
            },
            notifyChatsChange: (chats: Message[]) => {
                const { onChatsChange } = this.props;
                onChatsChange && onChatsChange(chats);
            },
            notifyLikeMessage: (message: Message) => {
                const { onMessageGoodFeedback } = this.props;
                onMessageGoodFeedback && onMessageGoodFeedback(message);
            },
            notifyDislikeMessage: (message: Message) => {
                const { onMessageBadFeedback } = this.props;
                onMessageBadFeedback && onMessageBadFeedback(message);
            },
            notifyCopyMessage: (message: Message) => {
                const { onMessageCopy } = this.props;
                onMessageCopy && onMessageCopy(message);
            },
            notifyClearContext: () => {
                const { onClear } = this.props;
                onClear && onClear();
            },
            notifyMessageSend: (content: string, attachment: any[]) => {
                const { onMessageSend } = this.props;
                onMessageSend && onMessageSend(content, attachment);
            },
            notifyInputChange: (props: { inputValue: string; attachment: any[]}) => {
                const { onInputChange } = this.props;
                onInputChange && onInputChange(props);
            },
            setBackBottomVisible: (visible: boolean) => {
                this.setState((state) => {
                    if (state.backBottomVisible !== visible) {
                        return {
                            backBottomVisible: visible,
                        };
                    }
                    return null;
                });
            },
            registerWheelEvent: () => {
                this.adapter.unRegisterWheelEvent();
                const containerElement = this.containerRef.current;
                if (!containerElement) {
                    return ;
                }
                this.wheelEventHandler = (e: any) => {
                    /**
                     * Why use this.scrollTargetRef.current and wheel's currentTarget target comparison?
                     * Both scroll and wheel events are on the container
                     * his.scrollTargetRef.current is the object where scrolling actually occurs
                     * wheel's currentTarget is the container,
                     * Only when the wheel event occurs and there is scroll, the following logic(show scroll bar) needs to be executed
                     */
                    if (this.scrollTargetRef?.current !== e.currentTarget) {
                        return;
                    }
                    this.adapter.setWheelScroll(true);
                    this.adapter.unRegisterWheelEvent();
                };

                containerElement.addEventListener('wheel', this.wheelEventHandler);
            },
            unRegisterWheelEvent: () => {
                if (this.wheelEventHandler) {
                    const containerElement = this.containerRef.current;
                    if (!containerElement) {
                        return ;
                    } else {
                        containerElement.removeEventListener('wheel', this.wheelEventHandler);
                    }
                    this.wheelEventHandler = null;
                }
            },
            notifyStopGenerate: (e: MouseEvent) => {
                const { onStopGenerator } = this.props;
                onStopGenerator && onStopGenerator(e);
            },
            notifyHintClick: (hint: string) => {
                const { onHintClick } = this.props;
                onHintClick && onHintClick(hint);
            },
            setUploadAreaVisible: (visible: boolean) => {
                this.setState({ uploadAreaVisible: visible });
            },
            manualUpload: (file: File[]) => {
                const uploadComponent = this.uploadRef.current;
                if (uploadComponent) {
                    uploadComponent.insert(file);
                }
            },
            getDropAreaElement: () => {
                return this.dropAreaRef?.current;
            },
            getDragStatus: () => this.dragStatus,
            setDragStatus: (status: boolean) => { this.dragStatus = status; },
        };
    }

    static getDerivedStateFromProps(nextProps: ChatProps, prevState: ChatState) {
        const { chats, hints } = nextProps;
        const newState = {} as any;
        if (chats !== prevState.chats) {
            newState.chats = chats ?? [];
        }
        if (hints !== prevState.cacheHints) {
            newState.cacheHints = hints;
        }
        if (Object.keys(newState).length) {
            return newState;
        }
        return null;
    }

    componentDidMount(): void {
        this.foundation.init();
    }

    componentDidUpdate(prevProps: Readonly<ChatProps>, prevState: Readonly<ChatState>, snapshot?: any): void {
        const { chats: newChats, hints: newHints } = this.props;
        const { chats: oldChats, cacheHints } = prevState;
        const { wheelScroll } = this.state;
        let shouldScroll = false;
        if (newChats !== oldChats) {
            if (Array.isArray(newChats) && Array.isArray(oldChats)) {
                const newLastChat = newChats[newChats.length - 1];
                const oldLastChat = oldChats[oldChats.length - 1];
                if (newChats.length > oldChats.length) {
                    if (oldChats.length === 0 || newLastChat.id !== oldLastChat.id) {
                        shouldScroll = true;
                    }
                } else if (newChats.length === oldChats.length && newChats.length && 
                    (newLastChat.status !== 'complete' || newLastChat.status !== oldLastChat.status)
                ) {
                    shouldScroll = true;
                }
            }
        }
        if (newHints !== cacheHints) {
            if (newHints.length > cacheHints.length) {
                shouldScroll = true;
            }
        }
        if (!wheelScroll && shouldScroll) {
            this.foundation.scrollToBottomImmediately();
        }
    }

    componentWillUnmount(): void {
        this.foundation.destroy();
    }

    resetMessage = () => {
        this.foundation.resetMessage(null);
    }

    clearContext = () => {
        this.foundation.clearContext(null);
    }

    scrollToBottom = (animation: boolean) => {
        if (animation) {
            this.foundation.scrollToBottomWithAnimation();
        } else {
            this.foundation.scrollToBottomImmediately();
        }
    }

    sendMessage = (content: string, attachment: FileItem[]) => {
        this.foundation.onMessageSend(content, attachment);
    }

    containerScroll = (e: React.UIEvent<HTMLDivElement>) => {
        (this.scrollTargetRef as any).current = e.target as HTMLElement;
        if (e.target !== e.currentTarget) {
            return;
        }
        this.foundation.containerScroll(e);
    }

    render() {
        const { topSlot, bottomSlot, roleConfig, hints,
            onChatsChange, onMessageCopy, renderInputArea,
            chatBoxRenderConfig, align, renderHintBox,
            style, className, showStopGenerate,
            customMarkDownComponents, mode, showClearContext,
            placeholder, inputBoxCls, inputBoxStyle,
            hintStyle, hintCls, uploadProps, uploadTipProps,
            sendHotKey, renderDivider, markdownRenderProps, enableUpload
        } = this.props;
        const { backBottomVisible, chats, wheelScroll, uploadAreaVisible } = this.state;
        let showStopGenerateFlag = false;
        const lastChat = chats.length > 0 && chats[chats.length - 1];
        let disableSend = false;
        if (lastChat && showStopGenerate) {
            const lastChatOnGoing = lastChat?.status && [MESSAGE_STATUS.LOADING, MESSAGE_STATUS.INCOMPLETE].includes(lastChat?.status);
            disableSend = lastChatOnGoing;
            showStopGenerate && (showStopGenerateFlag = lastChatOnGoing);
        }
        const { dragUpload, clickUpload, pasteUpload } = this.foundation.getUploadProps(enableUpload);
        const dragEventHandlers = dragUpload ? {
            onDragOver: this.foundation.handleDragOver,
            onDragStart: this.foundation.handleDragStart,
            onDragEnd: this.foundation.handleDragEnd,
        } : {};
        return (
            <div
                className={cls(`${prefixCls}`, className)}
                style={style}
                {...dragEventHandlers}
            >
                {dragUpload && uploadAreaVisible && <div
                    ref={this.dropAreaRef}
                    className={`${prefixCls}-dropArea`}
                    onDragOver={this.foundation.handleContainerDragOver}
                    onDrop={this.foundation.handleContainerDrop}
                    onDragLeave={this.foundation.handleContainerDragLeave}
                >
                    <span className={`${prefixCls}-dropArea-text`}>
                        <LocaleConsumer<Locale["Chat"]> componentName="Chat" >
                            {(locale: Locale["Chat"]) => locale['dropAreaText']}
                        </LocaleConsumer>
                    </span>
                </div>}
                <div className={`${prefixCls}-inner`}>
                    {/* top slot */}
                    {topSlot}
                    {/* chat area */}
                    <div className={`${prefixCls}-content`}>
                        <ResizeObserver onResize={this.foundation.handleScrollContainerResize}>
                            <div
                                className={cls(`${prefixCls}-container`, {
                                    'semi-chat-container-scroll-hidden': !wheelScroll
                                })}
                                onScroll={this.containerScroll}
                                ref={this.containerRef}
                            >
                                <ChatContent
                                    align={align}
                                    mode={mode}
                                    chats={chats}
                                    roleConfig={roleConfig}
                                    customMarkDownComponents={customMarkDownComponents}
                                    onMessageDelete={this.foundation.deleteMessage}
                                    onChatsChange={onChatsChange}
                                    onMessageBadFeedback={this.foundation.dislikeMessage}
                                    onMessageGoodFeedback={this.foundation.likeMessage}
                                    onMessageReset={this.foundation.resetMessage}
                                    onMessageCopy={onMessageCopy}
                                    chatBoxRenderConfig={chatBoxRenderConfig}
                                    renderDivider={renderDivider}
                                    markdownRenderProps={markdownRenderProps}
                                />
                                {/* hint area */}
                                {!!hints?.length && <Hint
                                    className={hintCls}
                                    style={hintStyle}
                                    value={hints}
                                    onHintClick={this.foundation.onHintClick}
                                    renderHintBox={renderHintBox}
                                />}
                            </div>
                        </ResizeObserver>
                    </div>
                    {backBottomVisible && !showStopGenerateFlag && (<span className={`${prefixCls}-action`}>
                        <Button
                            className={`${prefixCls}-action-content ${prefixCls}-action-backBottom`}
                            icon={<IconChevronDown size="extra-large"/>}
                            type="tertiary"
                            onClick={this.foundation.scrollToBottomWithAnimation}
                        />
                    </span>)}
                    {showStopGenerateFlag && (<span className={`${prefixCls}-action`}>
                        <Button
                            className={`${prefixCls}-action-content ${prefixCls}-action-stop`}
                            icon={<IconDisc size="extra-large" />}
                            type="tertiary"
                            onClick={this.foundation.stopGenerate}
                        >
                            <LocaleConsumer<Locale["Chat"]> componentName="Chat" >
                                {(locale: Locale["Chat"]) => locale['stop']}
                            </LocaleConsumer>
                        </Button>
                    </span>)}
                    {/* input area */}
                    <InputBox
                        showClearContext={showClearContext}
                        uploadRef={this.uploadRef}
                        manualUpload={this.adapter.manualUpload}
                        style={inputBoxStyle}
                        className={inputBoxCls}
                        placeholder={placeholder}
                        disableSend={disableSend}
                        onClearContext={this.foundation.clearContext}
                        onSend={this.foundation.onMessageSend}
                        onInputChange={this.foundation.onInputChange}
                        renderInputArea={renderInputArea}
                        uploadProps={uploadProps}
                        uploadTipProps={uploadTipProps}
                        sendHotKey={sendHotKey}
                        clickUpload={clickUpload}
                        pasteUpload={pasteUpload}
                    />
                    {bottomSlot}
                </div>
            </div>
        );
    }
}

export default Chat;
