import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import { strings } from "./constants";
import { Animation } from '@douyinfe/semi-animation';
import { debounce } from "lodash";
import { getUuidv4 } from "../utils/uuid";
import { handlePrevent } from "../utils/a11y";

const { PIC_PREFIX, PIC_SUFFIX_ARRAY, ROLE,
    SCROLL_ANIMATION_TIME, SHOW_SCROLL_GAP
} = strings;

export interface Content {
    type: 'text' | 'image_url' | 'file_url';
    text?: string;
    image_url?: {
        url: string;
        [x: string]: any
    };
    file_url?: {
        url: string;
        name: string;
        size: string;
        type: string;
        [x: string]: any
    }
}

export interface Message {
    role?: string;
    name?: string;
    id?: string;
    content?: string | Content[];
    parentId?: string;
    createAt?: number;
    status?: 'loading' | 'incomplete' | 'complete' | 'error';
    [x: string]: any
}

export interface EnableUploadProps {
    pasteUpload?: boolean;
    dragUpload?: boolean;
    clickUpload?: boolean
}

export interface ChatAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getContainerRef: () => HTMLDivElement;
    setWheelScroll: (flag: boolean) => void;
    notifyChatsChange: (chats: Message[]) => void;
    notifyLikeMessage: (message: Message) => void;
    notifyDislikeMessage: (message: Message) => void;
    notifyCopyMessage: (message: Message) => void;
    notifyClearContext: () => void;
    notifyMessageSend: (content: string, attachment: any[]) => void;
    notifyInputChange: (props: { inputValue: string; attachment: any[]}) => void;
    setBackBottomVisible: (visible: boolean) => void;
    registerWheelEvent: () => void;
    unRegisterWheelEvent: () => void;
    notifyStopGenerate: (e: any) => void;
    notifyHintClick: (hint: string) => void;
    setUploadAreaVisible: (visible: boolean) => void;
    manualUpload: (e: any) => void;
    getDropAreaElement: () => HTMLDivElement;
    getDragStatus: () => boolean;
    setDragStatus: (status: boolean) => void
}


export default class ChatFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ChatAdapter<P, S>, P, S> {

    animation: any;

    constructor(adapter: ChatAdapter<P, S>) {
        super({ ...adapter });
    }

    init = () => {
        this.scrollToBottomImmediately();
        this._adapter.registerWheelEvent();
    }

    destroy = () => {
        this.animation && this.animation.destroy();
        this._adapter.unRegisterWheelEvent();
    }

    stopGenerate = (e: any) => {
        this._adapter.notifyStopGenerate(e);
    }

    scrollToBottomImmediately = () => {
        const element = this._adapter.getContainerRef();
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }

    scrollToBottomWithAnimation = () => {
        const duration = SCROLL_ANIMATION_TIME;
        const element = this._adapter.getContainerRef();
        if (!element) {
            return;
        }
        const from = element.scrollTop;
        const to = element.scrollHeight;
        this.animation = new Animation(
            {
                from: { scrollTop: from },
                to: { scrollTop: to },
            },
            {
                duration,
                easing: 'easeInOutCubic'
            }
        );

        this.animation.on('frame', ({ scrollTop }: { scrollTop: number }) => {
            element.scrollTop = scrollTop;
        });

        this.animation.start();
    }

    containerScroll = (e: any) => {
        this._persistEvent(e);
        const update = () => {
            this.getScroll(e.target);
        };
        requestAnimationFrame(update);
    }

    getScroll = debounce((target: any) => {
        const scrollHeight = target.scrollHeight;
        const clientHeight = target.clientHeight;
        const scrollTop = target.scrollTop;
        const { backBottomVisible } = this.getStates();
        if (scrollHeight - scrollTop - clientHeight <= SHOW_SCROLL_GAP) {
            if (backBottomVisible) {
                this._adapter.setBackBottomVisible(false);
            }
        } else {
            if (!backBottomVisible) {
                this._adapter.setBackBottomVisible(true);
            }
        }
        return scroll;
    }, 100)

    handleScrollContainerResize = () => {
        this.getScroll(this._adapter.getContainerRef());
    }

    clearContext = (e: any) => {
        const { chats } = this.getStates();
        if (chats[chats.length - 1].role === ROLE.DIVIDER) {
            return;
        }
        const dividerMessage = {
            role: ROLE.DIVIDER,
            id: getUuidv4(),
            createAt: Date.now(),
        };
        const newChats = [...chats, dividerMessage];
        this._adapter.notifyChatsChange(newChats);
        this._adapter.notifyClearContext();
    }

    onMessageSend = (input: string, attachment: any[]) => {
        let content;
        if (Boolean(attachment) && attachment.length === 0) {
            content = input;
        } else {
            content = [];
            input && content.push({ type: 'text', text: input });
            (attachment ?? []).map(item => {
                const { fileInstance, name = '', url, size } = item;
                const suffix = name.split('.').pop();
                const isImg = fileInstance?.type?.startsWith(PIC_PREFIX) || PIC_SUFFIX_ARRAY.includes(suffix);
                if (isImg) {
                    content.push({
                        type: 'image_url',
                        image_url: { url: url }
                    });
                } else {
                    content.push({
                        type: 'file_url',
                        file_url: {
                            url: url,
                            name: name,
                            size: size,
                            type: fileInstance?.type
                        }
                    });
                }
            });
        }
        if (content) {
            const newMessage = {
                role: ROLE.USER,
                id: getUuidv4(),
                createAt: Date.now(),
                content,
            };
            this._adapter.notifyChatsChange([...this.getStates().chats, newMessage]);
        }
        this._adapter.setWheelScroll(false);
        this._adapter.registerWheelEvent();
        this._adapter.notifyMessageSend(input, attachment);
    }

    onHintClick = (hint: string) => {
        const { chats } = this.getStates();
        const newMessage = {
            role: ROLE.USER,
            id: getUuidv4(),
            createAt: Date.now(),
            content: hint,
        };
        const newChats = [...chats, newMessage];
        this._adapter.notifyChatsChange(newChats);
        this._adapter.notifyHintClick(hint);
    }

    onInputChange = (props: { inputValue: string; attachment: any[]}) => {
        this._adapter.notifyInputChange(props as any);
    }

    deleteMessage = (message: Message) => {
        const { onMessageDelete, onChatsChange } = this.getProps();
        const { chats } = this.getStates();
        onMessageDelete?.(message);
        const newChats = chats.filter(item => item.id !== message.id);
        onChatsChange?.(newChats);
    }

    likeMessage = (message: Message) => {
        const { chats } = this.getStates();
        this._adapter.notifyLikeMessage(message);
        const index = chats.findIndex(item => item.id === message.id);
        const newChat = {
            ...chats[index],
            like: !chats[index].like,
            dislike: false,
        };
        const newChats = [...chats];
        newChats.splice(index, 1, newChat);
        this._adapter.notifyChatsChange(newChats);
    }

    dislikeMessage = (message: Message) => {
        const { chats } = this.getStates();
        this._adapter.notifyDislikeMessage(message);
        const index = chats.findIndex(item => item.id === message.id);
        const newChat = {
            ...chats[index],
            like: false,
            dislike: !chats[index].dislike,
        };
        const newChats = [...chats];
        newChats.splice(index, 1, newChat);
        this._adapter.notifyChatsChange(newChats);
    }

    resetMessage = (message: Message) => {
        const { chats } = this.getStates();
        const lastMessage = chats[chats.length - 1];
        const newLastChat = {
            ...lastMessage,
            status: 'loading',
            content: '',
            id: getUuidv4(),
            createAt: Date.now(),
        };
        const newChats = chats.slice(0, -1).concat(newLastChat);
        this._adapter.notifyChatsChange(newChats);
        const { onMessageReset } = this.getProps();
        onMessageReset?.(message);
    }

    handleDragOver = (e: any) => {
        const dragStatus = this._adapter.getDragStatus();
        if (dragStatus) {
            return;
        }
        this._adapter.setUploadAreaVisible(true);
    };

    handleDragStart = (e: any) => {
        this._adapter.setDragStatus(true);
    }

    handleDragEnd = (e: any) => {
        this._adapter.setDragStatus(false);
    }

    handleContainerDragOver = (e: any) => {
        handlePrevent(e);
    }

    handleContainerDrop = (e) => {
        this._adapter.setUploadAreaVisible(false);
        this._adapter.manualUpload(e?.dataTransfer?.files);
        // 禁用默认实现，防止文件被打开
        //Disable the default implementation, preventing files from being opened
        handlePrevent(e);
    }

    handleContainerDragLeave = (e: any) => {
        handlePrevent(e);
        // 鼠标移动至 container 的子元素，则不做任何操作
        // If the mouse moves to the child element of container, no operation will be performed.
        const dropAreaElement = this._adapter.getDropAreaElement();
        const enterTarget = e.relatedTarget;
        if (dropAreaElement.contains(enterTarget)) {
            return;
        }
        /**
         * 延迟隐藏 container ，防止父元素的 mouseOver 被触发，导致 container 无法隐藏
         * Delay hiding of the container to prevent the parent element's mouseOver from being triggered,
         * causing the container to be unable to be hidden.
        */
        setTimeout(() => {
            this._adapter.setUploadAreaVisible(false);
        });
    }

    getUploadProps = (uploadProps?: boolean | EnableUploadProps) => {
        if (Object.prototype.toString.call(uploadProps) === '[object Object]') {
            const { dragUpload = true, clickUpload = true, pasteUpload = true } = uploadProps as EnableUploadProps;
            return {
                dragUpload: dragUpload,
                clickUpload: clickUpload,
                pasteUpload: pasteUpload
            };
        } else if (typeof uploadProps === 'boolean') {
            return {
                dragUpload: uploadProps,
                clickUpload: uploadProps,
                pasteUpload: uploadProps
            };
        } else {
            return {
                dragUpload: true,
                clickUpload: true,
                pasteUpload: true
            };
        }
    }
}

