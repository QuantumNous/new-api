import React, { ReactNode } from 'react';
import { PopoverProps } from '../popover';
import { TooltipProps } from '../tooltip';
import { ArrayElement } from '../_base/base';
import { strings } from '@douyinfe/semi-foundation/typography/constants';

export type EllipsisPos = 'end' | 'middle';
export type ShowTooltip = {
    type?: string;
    opts?: Partial<PopoverProps> & Partial<TooltipProps>;
    renderTooltip?: (content: TooltipProps['content'], children: ReactNode ) => ReactNode
};

export type Ellipsis = {
    collapseText?: string;
    collapsible?: boolean;
    expandText?: string;
    expandable?: boolean;
    pos?: EllipsisPos;
    rows?: number;
    showTooltip?: boolean | ShowTooltip;
    suffix?: string;
    onExpand?: (expanded: boolean, event: React.MouseEvent<HTMLAnchorElement>) => void
};
export type OmitTypographyProps = 'dangerouslySetInnerHTML';
export type TypographyBaseType = ArrayElement<typeof strings.TYPE>;
export type TypographyBaseSize = ArrayElement<typeof strings.SIZE>;
export type TypographyBaseSpacing = ArrayElement<typeof strings.SPACING>;
export type TypographyBaseRule = ArrayElement<typeof strings.RULE>;
export type TypographyBaseTruncate = ArrayElement<typeof strings.TRUNCATE>;
