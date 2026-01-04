import { ReactNode } from "react";
import { OnChangeProps, UploadProps } from "../upload";
import { TooltipProps } from "../tooltip";
import { BaseSkill, Reference, Suggestion, Attachment, Content, Setup, LeftMenuChangeProps, RichTextJSON, MessageContent } from "@douyinfe/semi-foundation/aiChatInput/interface";
import { Extension } from "@tiptap/core";
import { Content as TiptapContent } from "@tiptap/core";
import { PopoverProps } from "../popover";
export * from "@douyinfe/semi-foundation/aiChatInput/interface";

export interface AIChatInputState {
    templateVisible: boolean;
    skillVisible: boolean;
    suggestionVisible: boolean;
    attachments?: Attachment[];
    skill?: Skill;
    popupWidth?: number;
    activeSkillIndex?: number;
    activeSuggestionIndex?: number;
    popupKey?: number;
    content?: RichTextJSON;
    richTextInit?: boolean
}

export interface AIChatInputProps {
    dropdownMatchTriggerWidth?: boolean;
    className?: string;
    style?: React.CSSProperties;
    // Rich text editor related
    placeholder?: string;
    extensions?: Extension[];
    onContentChange?: (contents: Content[]) => void;
    defaultContent?: TiptapContent;
    onFocus?: (event: React.FocusEvent) => void;
    onBlur?: (event: React.FocusEvent) => void;
    // Reference related
    references?: Reference[];
    renderReference?: (reference: Reference) => ReactNode;
    onReferenceDelete?: (reference: Reference) => void;
    onReferenceClick?: (reference: Reference) => void;
    // Upload related
    uploadProps?: UploadProps;
    onUploadChange?: (props: OnChangeProps) => void;
    // TopSlot related
    renderTopSlot?: (props: RenderTopSlotProps) => ReactNode;
    topSlotPosition?: 'top' | 'middle' | 'bottom';
    showUploadFile?: boolean;
    showReference?: boolean;
    // Operate area related
    round?: boolean; // full round for footer operate/configure button
    canSend?: boolean; // custom can send
    onMessageSend?: (props: MessageContent) => void;
    onStopGenerate?: () => void;
    uploadTipProps?: TooltipProps;
    generating?: boolean;
    // Configure area related
    renderConfigureArea?: (className?: string) => ReactNode;
    onConfigureChange?: (value: LeftMenuChangeProps, changedValue: LeftMenuChangeProps) => void;
    // Action area related
    renderActionArea?: (props: ActionAreaProps) => ReactNode;
    // Suggestion related
    suggestions?: Suggestion[];
    renderSuggestionItem?: (props: RenderSuggestionItemProps) => ReactNode;
    onSuggestClick?: (suggestion: Suggestion) => void;
    // Skill related
    skills?: Skill[];
    skillHotKey?: string;
    templatesStyle?: React.CSSProperties;
    templatesCls?: string;
    onSkillChange?: (skill: Skill) => void;
    renderSkillItem?: (props: RenderSkillItemProps) => ReactNode;
    // Template related
    renderTemplate?: (skill: Skill, onTemplateClick: (content: string) => void) => ReactNode;
    onTemplateVisibleChange?: (visible: boolean) => void;
    showTemplateButton?: boolean;
    // transformer
    transformer?: Map<string, (obj: any) => any>;
    // Popover related
    popoverProps?: PopoverProps
}

export interface RenderSuggestionItemProps {
    suggestion: Suggestion;
    className: string;
    onClick: () => void;
    onMouseEnter: () => void
}

export interface RenderSkillItemProps {
    skill: Skill;
    className: string;
    onClick: () => void;
    onMouseEnter: () => void
}

export interface Skill extends BaseSkill {
    icon?: ReactNode
}

interface ActionAreaProps {
    // menuItem: by order,upload button, send(stopGenerate) button
    menuItem: ReactNode[];
    className: string
}

interface RenderTopSlotProps {
    references: Reference[];
    attachments: Attachment[];
    content: Content[];
    handleUploadFileDelete: (attachment: Attachment) => void;
    handleReferenceDelete: (reference: Reference) => void
}
