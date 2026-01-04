import React, { useState } from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconDescriptions, IconTree, IconAvatar } from '@douyinfe/semi-icons-lab';

export default function NumberItemKey() {
    const [openKeys, setOpenKeys] = useState([]);
    return (
        <Nav
            bodyStyle={{ height: 320 }}
            openKeys={openKeys}
            onOpenChange={props => setOpenKeys(props.openKeys)}
            items={[
                { itemKey: 1, text: '用户管理', icon: <IconAvatar /> },
                { itemKey: 2, text: '活动管理', icon: <IconDescriptions /> },
                {
                    text: '任务平台',
                    icon: <IconTree />,
                    itemKey: 3,
                    items: ['任务管理', '用户任务查询'],
                },
            ]}
            onSelect={data => console.log('trigger onSelect: ', data)}
            onClick={data => console.log('trigger onClick: ', data)}
        />
    );
};

