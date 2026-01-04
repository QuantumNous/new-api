import React from 'react';
import { TreeSelect as SemiTreeSelect } from '@douyinfe/semi-ui';
import { getPopupContainer, forwardStatics } from './common';

function TreeSelect(props = {}) {
    return <SemiTreeSelect getPopupContainer={getPopupContainer} {...props} />;
}

export default forwardStatics(TreeSelect, SemiTreeSelect);