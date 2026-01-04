import { Popover as SemiPopover } from '@douyinfe/semi-ui';
import React from 'react';
import { getPopupContainer } from './common';

export default function Popover(props = {}) {
    return <SemiPopover getPopupContainer={getPopupContainer} {...props} />;
}
