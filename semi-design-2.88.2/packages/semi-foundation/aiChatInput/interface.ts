import { BaseFileItem } from "../upload/foundation";

export interface RichTextJSON {
    type: string;
    [key: string]: any
}

export interface BaseSkill {
    icon?: any;
    value?: string;
    label?: string;
    hasTemplate?: boolean;
    [key: string]: any
}

export type Suggestion = string[] | {
    content: string;
    [key: string]: any
}

export interface Attachment extends BaseFileItem {
    validateMessage?: any;
    type?: 'file' | 'directory';
    children?: Attachment[]
}

export interface Reference {
    type: string;
    id: string;
    [key: string]: any
}

export interface Content {
    type: string;
    [key: string]: any
}

export interface LeftMenuChangeProps {
    [key: string]: any
}

export interface Setup {
    [key: string]: any
}

export interface MessageContent {
    references?: Reference[];
    attachments?: Attachment[];
    inputContents?: Content[];
    setup?: Setup
}



