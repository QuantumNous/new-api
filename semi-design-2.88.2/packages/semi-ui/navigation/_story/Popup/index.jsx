import React from 'react';
import { Nav } from '@douyinfe/semi-ui';
import { IconUser, IconStar, IconUserGroup, IconEdit, IconApps, IconSetting } from '@douyinfe/semi-icons';

export default function GetPopupNav() {
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
            <div id={'con'} style={{ position: 'relative ' }}>
            </div>
            <Nav
                items={items}
                mode={'horizontal'}
                defaultOpenKeys={['job', 'star']}
                getPopupContainer={() => document.querySelector('#con')}
                defaultSelectedKeys={['user']}
                footer={{
                    collapseButton: true,
                }}
            />
        </div>
    );
}