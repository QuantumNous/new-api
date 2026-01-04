import * as React from 'react';
import BaseComponent from '../_base/baseComponent';
import PropTypes from 'prop-types';
import cls from "classnames";
import "@douyinfe/semi-foundation/aiChatDialogue/aiChatDialogue.scss";
import { ReasoningWidget } from './widgets/contentItem/reasoning';
import { DialogueStepWidget } from './widgets/contentItem/dialogueStep';
import { AnnotationWidget } from './widgets/contentItem/annotation';
import DialogueItem from './Dialogue';
import DialogueFoundation, { DialogueAdapter, Message } from '@douyinfe/semi-foundation/aiChatDialogue/foundation';
import { AIChatDialogueProps } from './interface';
import { getDefaultPropsFromGlobalConfig } from '../_utils';
import { cssClasses, strings } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import Hint from './widgets/dialogueHint';
import { Button } from "../index";
import { IconChevronDown } from '@douyinfe/semi-icons';

export * from '@douyinfe/semi-foundation/aiChatDialogue/foundation';
export * from './interface';


export interface AIChatDialogueStates {
    chats?: Message[];
    selectedIds: Set<string>;
    cacheHints?: string[];
    backBottomVisible: boolean;
    wheelScroll: boolean
}

const { DIALOGUE_ALIGN, MODE } = strings;
const { PREFIX } = cssClasses;

class AIChatDialogue extends BaseComponent<AIChatDialogueProps, AIChatDialogueStates> {

    static __SemiComponentName__ = "AIChatDialogue"; 
    static Reasoning = ReasoningWidget;
    static Step = DialogueStepWidget;
    static Annotation = AnnotationWidget;

    foundation: DialogueFoundation;
    containerRef: React.RefObject<HTMLDivElement>;
    scrollTargetRef: React.RefObject<HTMLElement>;
    wheelEventHandler: any;


    static propTypes = {
        align: PropTypes.oneOf(['leftRight', 'leftAlign']),
        chats: PropTypes.array,
        className: PropTypes.string,
        disabledFileItemClick: PropTypes.bool,
        hints: PropTypes.array,
        hintCls: PropTypes.string,
        hintStyle: PropTypes.object,
        selecting: PropTypes.bool,
        markdownRenderProps: PropTypes.object,
        messageEditRender: PropTypes.func,
        mode: PropTypes.string,
        roleConfig: PropTypes.object,
        style: PropTypes.object,
        renderConfig: PropTypes.object,
        renderHintBox: PropTypes.func,
        renderDialogueContentItem: PropTypes.object,
        onAnnotationClick: PropTypes.func,
        onChatsChange: PropTypes.func,
        onFileClick: PropTypes.func,
        onImageClick: PropTypes.func,
        onHintClick: PropTypes.func,
        onMessageBadFeedback: PropTypes.func,
        onMessageCopy: PropTypes.func,
        onMessageDelete: PropTypes.func,
        onMessageEdit: PropTypes.func,
        onMessageGoodFeedback: PropTypes.func,
        onMessageReset: PropTypes.func,
        onMessageShare: PropTypes.func,
        onSelect: PropTypes.func,
        showReset: PropTypes.bool,
        showReference: PropTypes.bool,
    };

    static defaultProps = getDefaultPropsFromGlobalConfig(AIChatDialogue.__SemiComponentName__, {
        align: DIALOGUE_ALIGN.LEFT_RIGHT,
        mode: MODE.BUBBLE,
        selecting: false,
        disabledFileItemClick: false,
        showReset: true,
        showReference: false,
    })

    constructor(props: AIChatDialogueProps) {
        super(props);

        this.foundation = new DialogueFoundation(this.adapter);
        this.containerRef = React.createRef();
        this.scrollTargetRef = React.createRef();
        this.wheelEventHandler = null;


        this.state = {
            cacheHints: [],
            selectedIds: new Set<string>(),
            chats: [],
            backBottomVisible: false,
            wheelScroll: false,
        };
        
        this.onSelectOrRemove = this.onSelectOrRemove.bind(this);
    }

    get adapter(): DialogueAdapter<AIChatDialogueProps, AIChatDialogueStates> {
        return {
            ...super.adapter,
            getContainerRef: () => this.containerRef?.current,
            setWheelScroll: (flag: boolean) => {
                this.setState({
                    wheelScroll: flag,
                });
            },
            updateSelected: (selectedIds: Set<string>) => {
                this.setState({ selectedIds });
            },
            notifySelect: (selectedIds: string[]) => {
                const { onSelect } = this.props;
                onSelect && onSelect(selectedIds);
            },
            notifyChatsChange: (chats: Message[]) => {
                const { onChatsChange } = this.props;
                onChatsChange && onChatsChange(chats);
            },
            notifyCopyMessage: (message: Message) => {
                const { onMessageCopy } = this.props;
                onMessageCopy && onMessageCopy(message);
            },
            notifyLikeMessage: (message: Message) => {
                const { onMessageGoodFeedback } = this.props;
                onMessageGoodFeedback && onMessageGoodFeedback(message);
            },
            notifyDislikeMessage: (message: Message) => {
                const { onMessageBadFeedback } = this.props;
                onMessageBadFeedback && onMessageBadFeedback(message);
            },
            notifyEditMessage: (message: Message) => {
                const { onMessageEdit } = this.props;
                onMessageEdit && onMessageEdit(message);
            },
            notifyHintClick: (hint: string) => {
                const { onHintClick } = this.props;
                onHintClick && onHintClick(hint);
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
        };
    }

    static getDerivedStateFromProps(nextProps: AIChatDialogueProps, prevState: AIChatDialogueStates) {
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

    componentDidUpdate(prevProps: Readonly<AIChatDialogueProps>, prevState: Readonly<AIChatDialogueStates>, snapshot?: any): void {
        const { chats: newChats, hints: newHints } = this.props;
        const { chats: oldChats, cacheHints } = prevState;
        const { wheelScroll } = this.state;
        let shouldScroll = false;
        if (newChats.length > oldChats.length) {
            this.adapter.setWheelScroll(false);
            this.adapter.registerWheelEvent();
            this.foundation.scrollToBottomImmediately();
        }
        if (newChats !== oldChats) {
            this.foundation.handleChatsChange(newChats);
            if (Array.isArray(newChats) && Array.isArray(oldChats)) {
                const newLastChat = newChats[newChats.length - 1];
                const oldLastChat = oldChats[oldChats.length - 1];
                if (newChats.length > oldChats.length) {
                    if (oldChats.length === 0 || newLastChat.id !== oldLastChat.id) {
                        shouldScroll = true;
                    }
                } else if (newChats.length === oldChats.length && newChats.length && 
                    (newLastChat.status !== 'completed' || newLastChat.status !== oldLastChat.status)
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

    selectAll = () => {
        this.foundation.handleSelectAll();
    }

    deselectAll = () => {
        this.foundation.handleDeselectAll();
    }

    onSelectOrRemove(isChecked: boolean, item: string) {
        this.foundation.handleSelectOrRemove(isChecked, item);
    }

    scrollToBottom = (animation: boolean) => {
        if (animation) {
            this.foundation.scrollToBottomWithAnimation();
        } else {
            this.foundation.scrollToBottomImmediately();
        }
    }

    containerScroll = (e: React.UIEvent<HTMLDivElement>) => {
        (this.scrollTargetRef as any).current = e.target as HTMLElement;
        if (e.target !== e.currentTarget) {
            return;
        }
        this.foundation.containerScroll(e);
    }
    
    render() {
        const { roleConfig, onMessageBadFeedback, onMessageGoodFeedback, onMessageReset, onMessageEdit, onMessageDelete, onHintClick,
            selecting, hintCls, hintStyle, hints, renderHintBox, style, className, ...restProps } = this.props;
        const { selectedIds, chats, backBottomVisible, wheelScroll } = this.state;

        return (
            <div 
                className={cls(`${PREFIX}`, className)} 
                style={style}
            >
                <div 
                    className={cls(`${PREFIX}-list`, {
                        [`${PREFIX}-list-scroll-hidden`]: !wheelScroll
                    })}
                    onScroll={this.containerScroll}
                    ref={this.containerRef}
                >
                    {chats.map((chat, index) => {
                        const isLastChat = index === chats.length - 1;
                        const continueSend = index > 0 && chat?.role === chats[index - 1]?.role;
                        return (
                            <DialogueItem 
                                key={chat.id}
                                message={chat}
                                role={roleConfig[chat.role]}
                                onSelectChange={this.onSelectOrRemove}
                                isSelected={selectedIds.has(chat.id)}
                                roleConfig={roleConfig}
                                onMessageBadFeedback={this.foundation.dislikeMessage}
                                onMessageGoodFeedback={this.foundation.likeMessage}
                                onMessageReset={this.foundation.resetMessage}
                                onMessageEdit={this.foundation.editMessage}
                                onMessageDelete={this.foundation.deleteMessage}
                                isLastChat={isLastChat}
                                // todo: 不太确定用户的需求场景，暂时设置成 false，如果用户有相关需求，转为一个对外提供的 api
                                // todo: Not sure about the user's demand scenario, temporarily set it to false. 
                                // If the user has relevant needs, turn it into an external API
                                continueSend={false}
                                selecting={selecting}
                                {...restProps}
                            />
                        );
                    })}
                    {
                        !!hints?.length && <Hint
                            className={hintCls}
                            style={hintStyle}
                            hints={hints}
                            onHintClick={this.foundation.onHintClick}
                            renderHintBox={renderHintBox}
                            selecting={selecting}
                        />
                    }
                </div>
                {
                    backBottomVisible && (<span className={`${PREFIX}-backBottom`}>
                        <Button
                            className={`${PREFIX}-backBottom-button`}
                            icon={<IconChevronDown size="extra-large"/>}
                            type="tertiary"
                            onClick={this.foundation.scrollToBottomWithAnimation}
                        />
                    </span>)
                }
            </div>
        );
    }
}

export default AIChatDialogue;


