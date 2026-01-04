import React from 'react';
import { Tooltip as SemiTooltip } from '@douyinfe/semi-ui';
import { getPopupContainer } from './common';

export default function Tooltip(props = {}) {
    return <SemiTooltip getPopupContainer={getPopupContainer} {...props} />;
}
