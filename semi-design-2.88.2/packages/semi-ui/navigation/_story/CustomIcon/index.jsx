import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconUser, IconStar, IconSetting, IconPlus, IconTriangleUp, IconTriangleDown } from '@douyinfe/semi-icons';

export default function ArrowIcon() {
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
                bodyStyle={{ height: 380 }}
                items={items}
                defaultOpenKeys={['job', 'star']}
                defaultSelectedKeys={['user']}
                expandIcon={<IconTriangleDown />}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
                footer={{
                    collapseButton: true,
                }}
            />
            <Nav
                bodyStyle={{ width: 520 }}
                items={items}
                mode='horizontal'
                defaultOpenKeys={['job', 'star']}
                defaultSelectedKeys={['user']}
                expandIcon={<IconTriangleDown />}
                footer={{
                    collapseButton: true,
                }}
            />
        </div>
    );
}