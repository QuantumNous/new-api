import React from 'react';
import { Nav } from '../../../index';
import { IconUser, IconStar, IconUserGroup, IconEdit, IconApps, IconSetting } from '@douyinfe/semi-icons';

const Demo = (props = {}) => {
    const superLargeSubs = [];
    const superLen = 120;

    for (let i = 0; i < superLen; i++) {
        superLargeSubs.push(`Item ${i}`);
    }

    return (
        <div style={{ width: '100%', height: '100vh' }}>
            <Nav
                defaultSelectedKeys={['人员管理']}
                style={{ height: '100%' }}
                bodyStyle={{ height: 480 }}
                items={[
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
                        text: '超长导航列表',
                        icon: <IconApps />,
                        itemKey: 'long-list',
                        maxHeight: 9999,
                        items: superLargeSubs,
                    },
                    {
                        text: '任务平台',
                        icon: <IconSetting />,
                        itemKey: 'job',
                        items: ['任务管理', '用户任务查询'],
                    },
                ]}
                onSelect={key => console.log(key)}
                header={{
                    logo: <img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/webcast_logo.svg" />,
                    text: 'Semi运营后台',
                }}
                footer={{
                    collapseButton: true,
                    collapseText: isCollapsed => <span>{isCollapsed ? '展开' : '收起'}</span>,
                }}
            />
        </div>
    );
};

export default Demo;
