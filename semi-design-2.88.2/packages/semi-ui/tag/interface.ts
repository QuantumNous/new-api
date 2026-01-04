import React from 'react';
import { PopoverProps } from '../popover/index';

export type TagColor =
    | 'amber'
    | 'blue'
    | 'cyan'
    | 'green'
    | 'grey'
    | 'indigo'
    | 'light-blue'
    | 'light-green'
    | 'lime'
    | 'orange'
    | 'pink'
    | 'purple'
    | 'red'
    | 'teal'
    | 'violet'
    | 'yellow'
    | 'white';
export type TagType = 'ghost' | 'solid' | 'light';
export type TagSize = 'default' | 'small' | 'large';
export type AvatarShape = 'circle' | 'square';
export type TagShape = 'circle' | 'square';

export interface TagProps {
    children?: React.ReactNode;
    tagKey?: string | number;
    size?: TagSize;
    color?: TagColor;
    type?: TagType;
    closable?: boolean;
    visible?: boolean;
    onClose?: (tagChildren: React.ReactNode, event: React.MouseEvent<HTMLElement>, tagKey: string | number) => void;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    prefixIcon?: React.ReactNode;
    suffixIcon?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    avatarSrc?: string;
    colorful?: boolean;
    gradient?: boolean;
    avatarShape?: AvatarShape;
    shape?: TagShape;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
    'aria-label'?: React.AriaAttributes['aria-label'];
    tabIndex?: number; // use internal, when tag in taInput, we want to use left arrow and right arrow to control the tag focus, so the tabIndex need to be -1. 
    onMouseEnter?: () => void
}

export interface TagGroupProps<T> {
    style?: React.CSSProperties;
    className?: string;
    maxTagCount?: number;
    restCount?: number;
    tagList?: (T extends 'custom' ? React.ReactNode : TagProps)[];
    size?: 'small' | 'large';
    showPopover?: boolean;
    popoverProps?: PopoverProps;
    avatarShape?: AvatarShape;
    mode?: string;
    onTagClose?: (tagChildren: React.ReactNode, event: React.MouseEvent<HTMLElement>, tagKey: string | number) => void;
    onPlusNMouseEnter?: () => void
}
