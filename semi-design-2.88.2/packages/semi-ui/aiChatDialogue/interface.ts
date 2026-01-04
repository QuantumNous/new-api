import React, { ReactNode } from 'react';
import { MarkdownRenderProps as OriginMarkdownRenderProps } from '../markdownRender';
import { MDXProps } from 'mdx/types';
import { Annotation, ContentItem, InputFile, InputImage, Message } from '@douyinfe/semi-foundation/aiChatDialogue/foundation';
import { MessageContent } from '@douyinfe/semi-foundation/aiChatInput/interface';

export type MarkdownRenderProps = Partial<OriginMarkdownRenderProps>;

export { Message };

export interface AIChatDialogueProps {
    align?: 'leftRight' | 'leftAlign';
    chats?: Message[];
    className?: string;
    disabledFileItemClick?: boolean;
    hintCls?: string;
    hints?: string[];
    hintStyle?: React.CSSProperties;
    selecting?: boolean;
    markdownRenderProps?: MarkdownRenderProps;
    messageEditRender?: (props: MessageContent) => ReactNode;
    mode?: 'bubble' | 'noBubble' | 'userBubble';
    onAnnotationClick?: (annotation?: Annotation) => void;
    onChatsChange?: (chats?: Message[]) => void;
    onFileClick?: (file?: InputFile) => void;
    onHintClick?: (hint: string) => void;
    onImageClick?: (image?: InputImage) => void;
    onMessageBadFeedback?: (message?: Message) => void;
    onMessageCopy?: (message?: Message) => void;
    onMessageDelete?: (message?: Message) => void;
    onMessageEdit?: (message?: Message) => void;
    onMessageGoodFeedback?: (message?: Message) => void;
    onMessageReset?: (message?: Message) => void;
    onMessageShare?: (message?: Message) => void;
    onReferenceClick?: (item: ContentItem) => void;
    onSelect?: (selectedIds: string[]) => void;
    dialogueRenderConfig?: DialogueRenderConfig;
    renderDialogueContentItem?: DialogueContentItemRendererMap;
    renderHintBox?: (props: {content: string; index: number;onHintClick: () => void}) => React.ReactNode;
    roleConfig: RoleConfig;
    showReset?: boolean;
    showReference?: boolean;
    style?: React.CSSProperties
}

export interface AIChatDialogueItemProps extends AIChatDialogueProps {
    continueSend?: boolean;
    isLastChat?: boolean;
    isSelected?: boolean;
    message: Message;
    onSelectChange?: (isChecked: boolean, item: string) => void;
    role: Metadata
}

export interface DialogueContentProps {
    mode?: 'bubble' | 'noBubble' | 'userBubble';
    children?: string;
    role?: Metadata;
    message?: Message;
    customRenderFunc?: (props: RenderContentProps) => ReactNode;
    markdownRenderProps?: MarkdownRenderProps;
    editing?: boolean;
    messageEditRender?: (props: MessageContent) => ReactNode;
    onFileClick?: (file?: InputFile) => void;
    onImageClick?: (image?: InputImage) => void;
    disabledFileItemClick?: boolean;
    onAnnotationClick?: (annotation?: Annotation) => void;
    onReferenceClick?: (item: ContentItem) => void;
    renderDialogueContentItem?: DialogueContentItemRendererMap;
    showReference?: boolean
}

export interface AIChatDialogueActionProps {
    customRenderFunc?: (props: RenderActionProps) => ReactNode;
    isLastChat?: boolean;
    message?: Message;
    messageEditRender?: (props: MessageContent) => ReactNode;
    onMessageBadFeedback?: (message?: Message) => void;
    onMessageCopy?: (message?: Message) => void;
    onMessageDelete?: (message?: Message) => void;
    onMessageEdit?: (message?: Message) => void;
    onMessageGoodFeedback?: (message?: Message) => void;
    onMessageReset?: (message?: Message) => void;
    onMessageShare?: (message?: Message) => void;
    role?: Metadata;
    showReset?: boolean;
    className?: string
}

export interface DialogueRenderConfig {
    renderDialogueAction?: (props: RenderActionProps) => ReactNode;
    renderDialogueAvatar?: (props: RenderAvatarProps) => ReactNode;
    renderDialogueContent?: (props: RenderContentProps) => ReactNode;
    renderDialogueTitle?: (props: RenderTitleProps) => ReactNode;
    renderFullDialogue?: (props: RenderFullDialogueProps) => ReactNode
}

export interface RenderTitleProps {
    defaultTitle?: ReactNode;
    message?: Message;
    role?: Metadata
}

export interface RenderAvatarProps {
    defaultAvatar?: ReactNode;
    message?: Message;
    role?: Metadata
}

export interface RenderContentProps {
    message?: Message;
    role?: Metadata;
    defaultContent?: ReactNode | ReactNode[]; 
    className?: string
}

export interface DefaultActionNodeObj {
    copyNode: ReactNode;
    dislikeNode: ReactNode;
    likeNode: ReactNode;
    moreNode: ReactNode;
    resetNode: ReactNode
}

export interface RenderActionProps {
    message?: Message;
    defaultActions?: ReactNode | ReactNode[];
    className: string;
    defaultActionsObj?: DefaultActionNodeObj
}

export interface RenderFullDialogueProps {
    message?: Message;
    role?: Metadata;
    defaultNodes?: FullDialogueNodes;
    className: string
}

export interface FullDialogueNodes {
    avatar?: ReactNode;
    title?: ReactNode; 
    content?: ReactNode; 
    action?: ReactNode
}

export interface RoleConfig {
    user?: Metadata | Map<string, Metadata>;
    assistant?: Metadata | Map<string, Metadata>;
    system?: Metadata | Map<string, Metadata>;
    [x: string]: Metadata | Map<string, Metadata>
}

export interface Metadata {
    name?: string;
    avatar?: string;
    color?: string;
    [x: string]: any
}


export type DialogueContentItemRenderer = (item: any, message?: Message) => ReactNode;
export type DialogueContentItemRendererMap = Record<string, DialogueContentItemRenderer | Record<string, DialogueContentItemRenderer>>;


