import React from 'react';
import { Dropdown as SemiDropdown } from '@douyinfe/semi-ui';
import { getPopupContainer, forwardStatics } from './common';

function Dropdown(props = {}) {
    return <SemiDropdown getPopupContainer={getPopupContainer} {...props} />;
}

export default forwardStatics(Dropdown, SemiDropdown);
