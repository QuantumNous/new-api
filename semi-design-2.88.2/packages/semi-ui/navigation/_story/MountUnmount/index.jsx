import React, { useState } from 'react';
import { Nav, Button } from '@douyinfe/semi-ui';
import { IconUser, IconStar, IconUserGroup, IconEdit, IconApps, IconSetting } from '@douyinfe/semi-icons';

function AppNav({ shouldRender = true }) {
    const [selectedKeys, setSelectedKeys] = useState([]);
    const navItems = [
        { itemKey: 'user', text: '用户管理', icon: <IconUser /> },
        { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
        {
            itemKey: 'union-management',
            text: '公会管理',
            icon: <IconUserGroup />,
            items: ['公告设置', '公会查询', '信息录入'],
        },
        {
            itemKey: 'approve-management',
            text: '审批管理',
            icon: <IconEdit />,
            items: [
                '入驻审核',
                {
                    itemKey: 'operation-management',
                    text: '运营管理',
                    items: ['人员管理', '人员变更'],
                },
            ],
        },
        {
            text: '任务平台',
            icon: <IconSetting />,
            itemKey: 'job',
            items: ['任务管理', '用户任务查询'],
        },
    ];

    const onSelect = ({ itemKey }) => {
        setSelectedKeys([itemKey]);
    };

    return shouldRender ? <Nav items={navItems} selectedKeys={selectedKeys} onSelect={onSelect} /> : null;
}

function Demo() {
    const [shouldRender, setShouldRender] = useState(true);

    return (
        <div>
            <div>
                <Button onClick={() => setShouldRender(!shouldRender)}>Rerender</Button>
            </div>
            <AppNav shouldRender={shouldRender} />
        </div>
    );
}

export default Demo;
