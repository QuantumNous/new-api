import React, { CSSProperties } from 'react';
import { BaseProps } from '../_base/baseComponent';

export type AvatarShape = 'circle' | 'square';
export type AvatarSize = 'extra-extra-small' | 'extra-small' | 'small' | 'default' | 'medium' | 'large' | 'extra-large';
export type AvatarColor =
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
    | 'yellow';

export interface AvatarProps extends BaseProps {
    children?: React.ReactNode;
    color?: AvatarColor;
    shape?: AvatarShape;
    size?: string;
    hoverMask?: React.ReactNode;
    src?: string;
    srcSet?: string;
    alt?: string;
    gap?: number;
    onError?: React.MouseEventHandler;
    onClick?: React.MouseEventHandler;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    imgAttr?: React.ImgHTMLAttributes<HTMLImageElement>;
    bottomSlot?: {
        render?: () => React.ReactNode;
        shape?: "circle"|"square";
        text: React.ReactNode;
        bgColor: string;
        textColor: string;
        className: string;
        style?: CSSProperties 
    };
    topSlot?: {
        render?: () => React.ReactNode;
        gradientStart?: string;
        gradientEnd?: string; 
        text: React.ReactNode;
        textColor: string;
        className: string;
        style?: CSSProperties
    };
    border?: {
        color?: string; 
        motion?: boolean
    } | boolean;
    contentMotion?: boolean
}

export type AvatarGroupShape = 'circle' | 'square';
export type AvatarGroupSize = 'extra-extra-small' | 'extra-small' | 'small' | 'default' | 'medium' | 'large' | 'extra-large';
export type AvatarGroupOverlapFrom = 'start' | 'end';

export interface AvatarGroupProps {
    children?: React.ReactNode;
    shape?: AvatarGroupShape;
    size?: string;
    overlapFrom?: AvatarGroupOverlapFrom;
    maxCount?: number;
    renderMore?: (restNumber?: number, restAvatars?: React.ReactNode[]) => React.ReactNode
}
