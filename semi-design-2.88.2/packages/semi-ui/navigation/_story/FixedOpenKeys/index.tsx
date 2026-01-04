import React, { useState, useMemo, useCallback } from 'react';
import { IconUser, IconStar, IconUserGroup, IconEdit, IconSetting } from '@douyinfe/semi-icons';
import { Nav, Button } from '../../../index';

/**
 * test with cypress
 */
export default function Demo() {
    const [selectedKeys, setSelectedKeys] = useState(['入驻审核']);
    const navItems = useMemo(
        () => [
            { itemKey: 'user', text: '用户管理', icon: <IconUser />, 'data-key': 'user' },
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
        ],
        []
    );
    const navItemKeys = useMemo(
        () =>
            navItems.reduce((prev, item) => {
                const que = [item];
                while (que.length) {
                    const cur = que.pop();
                    if (cur) {
                        if (typeof cur === 'object') {
                            if (Array.isArray(cur.items) && cur.items.length) {
                                que.push(...cur.items);
                            } else if (cur.itemKey) {
                                prev.push(cur.itemKey);
                            }
                        } else {
                            prev.push(cur);
                        }
                    }
                }
                return prev;
            }, []),
        [navItems]
    );

    const randomSelect = useCallback(() => {
        const randomIndex = Math.floor(Math.random() * navItemKeys.length);
        setSelectedKeys([navItemKeys[randomIndex]]);
    }, [navItemKeys]);

    const handleSelect = (...args) => {
        console.log(...args);
        setSelectedKeys(args[0].selectedKeys);
    };

    return (
        <div style={{ height: '100vh', display: 'inline-block' }}>
            <Button onClick={randomSelect}>随机选中</Button>
            <Nav onSelect={handleSelect} selectedKeys={selectedKeys} items={navItems} />
        </div>
    );
}
