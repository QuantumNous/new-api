import { debounce } from "lodash";
import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import { getUuidv4 } from "../utils/uuid";
import { strings } from "./constants";
import { Animation } from '@douyinfe/semi-animation';

export interface DialogueAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getContainerRef: () => HTMLDivElement;
    setWheelScroll: (flag: boolean) => void;
    updateSelected: (selectedIds: Set<string>) => void;
    notifySelect: (selectedIds: string[]) => void;
    notifyChatsChange: (chats: Message[]) => void;
    notifyCopyMessage: (message: Message) => void;
    notifyLikeMessage: (message: Message) => void;
    notifyDislikeMessage: (message: Message) => void;
    notifyEditMessage: (message: Message) => void;
    notifyHintClick: (hint: string) => void;
    setBackBottomVisible: (visible: boolean) => void;
    registerWheelEvent: () => void;
    unRegisterWheelEvent: () => void
}

export default class DialogueFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<DialogueAdapter<P, S>, P, S> {
    constructor(adapter: DialogueAdapter<P, S>) {
        super({ ...adapter });
    }

    animation: any;

    init = () => {
        this.scrollToBottomImmediately();
        this._adapter.registerWheelEvent();
    }

    destroy = () => {
        this.animation && this.animation.destroy();

    }

    handleSelectAll = () => {
        const { chats } = this.getProps();
        const selectedSet = new Set<string>(chats.map((chat: Message) => chat.id));
        this._adapter.updateSelected(selectedSet);
        this._adapter.notifySelect(Array.from(selectedSet));
    }

    handleDeselectAll = () => {
        this._adapter.updateSelected(new Set());
        this._adapter.notifySelect([]);
    }

    handleChatsChange = (chats: Message[]) => {
        this._adapter.notifyChatsChange(chats);
    }

    handleSelectOrRemove = (isChecked: boolean, id: string) => {
        const { selectedIds } = this.getStates() as any;
        const newSelectedSet: Set<string> = selectedIds instanceof Set ? new Set<string>(selectedIds) : new Set<string>(selectedIds || []);
        if (isChecked) {
            newSelectedSet.add(id);
        } else {
            newSelectedSet.delete(id);
        }
        this._adapter.updateSelected(newSelectedSet);
        this._adapter.notifySelect(Array.from(newSelectedSet));
    }

    likeMessage = (message: Message) => {
        const { chats } = this.getStates();
        this._adapter.notifyLikeMessage(message);
        const index = chats.findIndex((item: Message) => item.id === message.id);
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
            status: 'in_progress',
            content: '',
            id: getUuidv4(),
            createAt: Date.now(),
        };
        const newChats = chats.slice(0, -1).concat(newLastChat);
        this._adapter.notifyChatsChange(newChats);
        const { onMessageReset } = this.getProps();
        onMessageReset?.(message);
    }

    editMessage = (message: Message) => {
        const { chats } = this.getStates();
        this._adapter.notifyEditMessage(message);
        const index = chats.findIndex(item => item.id === message.id);
        const newChat = {
            ...chats[index],
            editing: !chats[index].editing,
        };
        // Make sure there is only one message in edit mode
        chats.map(item => {
            if (item.editing) {
                item.editing = !item.editing;
            }
        });
        const newChats = [...chats];
        newChats.splice(index, 1, newChat);
        this._adapter.notifyChatsChange(newChats);
    }

    deleteMessage = (message: Message) => {
        const { onMessageDelete, onChatsChange } = this.getProps();
        const { chats } = this.getStates();
        onMessageDelete?.(message);
        const newChats = chats.filter(item => item.id !== message.id);
        onChatsChange?.(newChats);
    }

    onHintClick = (hint: string) => {
        const { chats } = this.getStates();
        const newMessage = {
            role: strings.ROLE.USER,
            id: getUuidv4(),
            createAt: Date.now(),
            content: hint,
        };
        const newChats = [...chats, newMessage];
        this._adapter.notifyChatsChange(newChats);
        this._adapter.notifyHintClick(hint);
    }

    scrollToBottomImmediately = () => {
        const element = this._adapter.getContainerRef();
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }

    scrollToBottomWithAnimation = () => {
        const duration = strings.SCROLL_ANIMATION_TIME;
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
        if (scrollHeight - scrollTop - clientHeight <= strings.SHOW_SCROLL_GAP) {
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


}


export interface Message {
    id: string;
    content?: string | ContentItem[];
    output_text?: string;
    role: string;
    name?: string;
    createdAt?: number;
    updatedAt?: number;
    model?: string;
    status?: string;
    // type?: string;
    [x: string]: any
}

export type ContentItem = InputContentItem | OutputContentItem;

export type InputContentItem = InputMessage | ItemReference;
export type OutputContentItem = OutputMessage | ToolCallContentItem | MCPContentItem | Reasoning ;

export type ToolCallContentItem = FileSearchToolCall | WebSearchToolCall | FunctionToolCall | CustomToolCall | ImageGenerationCall| CustomObject;
export type MCPContentItem = MCPToolCall;

export interface CommonContentItem {
    id?: string;
    type?: string;
    status?: string;
    role?: string
}

export interface InputMessage extends CommonContentItem {
    content?: string | (InputText | InputImage | InputFile | InputAudio)[]
}

export interface ItemReference extends CommonContentItem {
    file_id?: string
}

export interface CustomObject {
    [key: string]: any
}

export interface OutputMessage extends CommonContentItem {
    content?: (OutputText | Refusal)[]
}

export interface OutputText {
    text?: string;
    type?: string;
    annotations?: Annotation[]
}

export interface Refusal extends CommonContentItem {
    refusal?: string;
    type?: string
}

export interface URLCitation {
    end_index?: number;
    start_index?: number;
    title?: string;
    type?: string;
    url?: string
}

export type Annotation = URLCitation | CustomObject;

export interface Reasoning extends CommonContentItem {
    summary?: {
        text?: string;
        type?: string
    }[];
    content?: {
        text?: string;
        type?: string
    }[]
}

export interface FileSearchToolCallResult {
    attributes?: Map<string, string>;
    score?: number;
    file_id?: string;
    filename?: string;
    text?: string
}

export interface FileSearchToolCall extends CommonContentItem {
    queries?: string[];
    results?: FileSearchToolCallResult[]
}

export interface WebSearchToolCall extends CommonContentItem {
    action?: SearchAction | OpenPageAction | FindAction
}
export interface SearchAction {
    type?: string;
    query?: string;
    sources?: { type: string; url: string }[]
}
export interface OpenPageAction {
    type?: string;
    url?: string
}
export interface FindAction {
    action?: string;
    type?: string;
    query?: string
}

export interface FunctionToolCall extends CommonContentItem {
    call_id?: string;
    name?: string;
    arguments?: string
}

export interface CustomToolCall extends CommonContentItem {
    call_id?: string;
    name?: string;
    input?: string
}

export interface ImageGenerationCall extends CommonContentItem {
    result?: string
}

// MCPToolCall 
export interface MCPToolCall extends CommonContentItem {
    arguments?: string;
    server_label?: string;
    name?: string;
    result?: string;
    output?: string
}

export interface FileUploadToolCall extends CommonContentItem {
    result?: string
}

export interface InputText extends CommonContentItem {
    text?: string
}

export interface InputImage extends CommonContentItem {
    detail?: string;
    file_id?: string;
    image_url?: string
}

export interface InputFile extends CommonContentItem {
    file_id?: string;
    file_data?: string;
    file_url?: string;
    filename?: string;
    size?: string;
    file_type?: string;
    fileInstance?: any
}

export interface InputAudio extends CommonContentItem {
    input_audio?: {
        data: string;
        format: string
    }
}



// 内部自定义 dialogue item 类型
export interface Action {
    status?: string;
    summary?: string;
    description?: string;
    icon?: any
}

export interface Step {
    type?: string;
    status?: string;
    summary?: string;
    actions?: Action[]
}

export interface Reference {
    id?: string;
    type?: string;
    name?: string;
    url?: string;
    content?: string
}
