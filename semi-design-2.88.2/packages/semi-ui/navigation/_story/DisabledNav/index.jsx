import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconUser, IconStar, IconUserGroup, IconEdit, IconApps, IconSetting } from '@douyinfe/semi-icons';

export default function DisabledNav() {
    const items = [
        { itemKey: 'user', text: '用户管理', icon: <IconUser />, disabled: true },
        { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
        {
            text: '任务平台',
            icon: <IconSetting />,
            itemKey: 'job',
            disabled: true,
            items: [{ itemKey: 'job_manage', text: '任务管理', disabled: true }, '用户任务查询'],
        },
        {
            text: '收藏夹',
            icon: <IconStar />,
            itemKey: 'star',
            items: [{ itemKey: 'like', text: '我的喜欢', disabled: true }, '点赞'],
        },
    ];

    return (
        <div>
            <Nav
                bodyStyle={{ height: 520 }}
                items={items}
                defaultOpenKeys={['job', 'star']}
                defaultSelectedKeys={['user']}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
                footer={{
                    collapseButton: true,
                }}
            />
            <Nav
                mode="horizontal"
                bodyStyle={{ width: '100%' }}
                items={items}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
            />
        </div>
    );
}