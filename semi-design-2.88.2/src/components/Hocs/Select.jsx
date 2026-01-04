import React from 'react';
import { Select as SemiSelect } from '@douyinfe/semi-ui';
import { getPopupContainer, forwardStatics } from './common';

function Select(props = {}) {
    return <SemiSelect getPopupContainer={getPopupContainer} {...props} />;
}

export default forwardStatics(Select, SemiSelect);
