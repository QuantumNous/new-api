import React, { ReactNode } from 'react';
import { MDXProps } from 'mdx/types';
import { Upload } from '../index';
import type { FileItem, UploadProps } from '../upload';
import { EnableUploadProps, Message } from '@douyinfe/semi-foundation/chat/foundation';
import type { TooltipProps } from '../tooltip';
import { MarkdownRenderProps as OriginMarkdownRenderProps } from '../markdownRender';

export type MarkdownRenderProps = Partial<OriginMarkdownRenderProps>;

export { Message };
export interface CommonChatsProps {
    align?: 'leftRight' | 'leftAlign';
    mode?: 'bubble' | 'noBubble' | 'userBubble';
    chats?: Message[];
    roleConfig?: RoleConfig;
    onMessageDelete?: (message?: Message) => void;
    onChatsChange?: (chats?: Message[]) => void;
    onMessageBadFeedback?: (message?: Message) => void;
    onMessageGoodFeedback?: (message?: Message) => void;
    onMessageReset?: (message?: Message) => void;
    onMessageCopy?: (message?: Message) => void;
    chatBoxRenderConfig?: ChatBoxRenderConfig;
    customMarkDownComponents?: MDXProps['components'];
    renderDivider?: (message?: Message) => ReactNode;
    markdownRenderProps?: MarkdownRenderProps
}

export interface ChatProps extends CommonChatsProps {
    style?: React.CSSProperties;
    className?: string;
    hints?: string[];
    renderHintBox?: (props: {content: string; index: number;onHintClick: () => void}) => React.ReactNode;
    onHintClick?: (hint: string) => void;
    onChatsChange?: (chats?: Message[]) => void;
    onStopGenerator?: (e?: MouseEvent) => void;
    customMarkDownComponents?: MDXProps['components'];
    onClear?: () => void;
    onInputChange?: (props: { value?: string; attachment?: FileItem[] }) => void;
    onMessageSend?: (content: string, attachment: FileItem[]) => void;
    inputBoxStyle?: React.CSSProperties;
    inputBoxCls?: string;
    renderInputArea?: (props?: RenderInputAreaProps) => ReactNode;
    placeholder?: string;
    topSlot?: ReactNode | ReactNode[];
    bottomSlot?: ReactNode | ReactNode[];
    showStopGenerate?: boolean;
    hintStyle?: React.CSSProperties;
    hintCls?: string;
    uploadProps?: UploadProps;
    uploadTipProps?: TooltipProps;
    showClearContext?: boolean;
    sendHotKey?: 'enter' | 'shift+enter';
    enableUpload?: boolean | EnableUploadProps
}

export interface RenderInputAreaProps {
    defaultNode?: ReactNode;
    onSend?: (content?: string, attachment?: FileItem[]) => void;
    onClear?: (e?: any) => void;
    detailProps?: {
        clearContextNode?: ReactNode;
        uploadNode?: ReactNode;
        inputNode?: ReactNode;
        sendNode?: ReactNode;
        onClick?: (e?: MouseEvent) => void
    }
}

export interface RenderTitleProps {
    message?: Message;
    role?: Metadata;
    defaultTitle?: ReactNode
}

export interface RenderAvatarProps {
    message?: Message;
    role?: Metadata; 
    defaultAvatar?: ReactNode
}

export interface RenderContentProps {
    message?: Message;
    role?: Metadata;
    defaultContent?: ReactNode | ReactNode[]; 
    className?: string
}

export interface DefaultActionNodeObj {
    copyNode: ReactNode;
    likeNode: ReactNode;
    dislikeNode: ReactNode;
    resetNode: ReactNode;
    deleteNode: ReactNode
}

export interface RenderActionProps {
    message?: Message;
    defaultActions?: ReactNode | ReactNode[];
    className: string;
    defaultActionsObj?: DefaultActionNodeObj
}

export interface RenderFullChatBoxProps {
    message?: Message;
    role?: Metadata;
    defaultNodes?: FullChatBoxNodes;
    className: string
}

export interface ChatBoxRenderConfig {
    renderChatBoxTitle?: (props: RenderTitleProps) => ReactNode;
    renderChatBoxAvatar?: (props: RenderAvatarProps) => ReactNode;
    renderChatBoxContent?: (props: RenderContentProps) => ReactNode;
    renderChatBoxAction?: (props: RenderActionProps) => ReactNode;
    renderFullChatBox?: (props: RenderFullChatBoxProps) => ReactNode
}

export interface FullChatBoxNodes {
    avatar?: ReactNode;
    title?: ReactNode; 
    content?: ReactNode; 
    action?: ReactNode
}

export interface RoleConfig {
    user?: Metadata;
    assistant?: Metadata;
    system?: Metadata;
    [x: string]: Metadata
}

export interface Metadata {
    name?: string;
    avatar?: string;
    color?: string;
    [x: string]: any
}

export interface ChatState {
    chats?: Message[];
    isLoading?: boolean;
    backBottomVisible?: boolean;
    scrollVisible?: boolean;
    wheelScroll?: boolean;
    cacheHints?: string[];
    uploadAreaVisible?: boolean
}

export interface ChatBoxProps extends Omit<CommonChatsProps, "chats"> {
    toast?: any;
    style?: React.CSSProperties;
    className?: string;
    previousMessage?: Message;
    message?: Message;
    lastChat?: boolean;
    customMarkDownComponents?: MDXProps['components']
}

export interface InputBoxProps {
    showClearContext?: boolean;
    sendHotKey?: 'enter' | 'shift+enter';
    placeholder: string;
    className?: string;
    style?: React.CSSProperties;
    disableSend?: boolean;
    uploadRef?: React.RefObject<Upload>;
    uploadTipProps?: TooltipProps;
    uploadProps?: UploadProps;
    manualUpload?: (file: File[]) => void;
    renderInputArea?: (props: RenderInputAreaProps) => React.ReactNode;
    onSend?: (content: string, attachment: FileItem[]) => void;
    onClearContext?: (e: any) => void;
    onInputChange?: (props: {inputValue: string; attachment: FileItem[]}) => void;
    clickUpload?: boolean;
    pasteUpload?: boolean
}

export interface InputBoxState {
    content: string;
    attachment: FileItem[]
}
