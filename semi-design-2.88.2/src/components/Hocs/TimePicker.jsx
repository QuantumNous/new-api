import React from 'react';
import { TimePicker as SemiTimePicker } from '@douyinfe/semi-ui';
import { getPopupContainer } from './common';

export default function TimePicker(props = {}) {
    return <SemiTimePicker getPopupContainer={getPopupContainer} {...props} />;
}
