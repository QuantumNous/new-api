import React from 'react';
import { DatePicker as SemiDatePicker } from '@douyinfe/semi-ui';
import { getPopupContainer } from './common';

export default function DatePicker(props = {}) {
    return <SemiDatePicker getPopupContainer={getPopupContainer} {...props} />;
}
