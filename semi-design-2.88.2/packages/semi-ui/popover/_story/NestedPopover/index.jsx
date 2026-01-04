import React, { useState } from 'react';
import Popover from '../../index';
import Tooltip from '../../../tooltip/index';
import Popconfirm from '../../../popconfirm/index';
import Icon from '../../../icons';
import { IconAlertTriangle, IconDelete } from '@douyinfe/semi-icons';
export default function Demo() {
    const [popoverVisible, setPopoverVisible] = useState(false);
    return (
        <div
            style={{
                padding: 50,
            }}
        >
            <Popconfirm
                visible={popoverVisible}
                trigger="custom"
                title="确定是否要删除此标签"
                content="此修改将不可逆"
                okType="danger"
                icon={(
                    <Icon
                        style={{
                            color: '#fa392f',
                        }}
                        type={<IconAlertTriangle />}
                        size="extra-large"
                    />
                )}
                onConfirm={e => setPopoverVisible(false)}
                onCancel={e => setPopoverVisible(false)}
            >
                <span>
                    <Tooltip content="删除标签">
                        <Icon type={<IconDelete />} onClick={e => setPopoverVisible(!popoverVisible)} />
                    </Tooltip>
                </span>
            </Popconfirm>
        </div>
    );
}
