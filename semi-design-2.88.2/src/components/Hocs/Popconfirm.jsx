import React from 'react';
import { Popconfirm as SemiPopconfirm } from '@douyinfe/semi-ui/';
import { getPopupContainer, forwardStatics } from './common';

function Popconfirm(props = {}) {
    return <SemiPopconfirm getPopupContainer={getPopupContainer} {...props} />;
}

export default forwardStatics(Popconfirm, SemiPopconfirm);
