import React from 'react';
import { storiesOf } from '@storybook/react';
import { IconHome, IconHistogram, IconSetting, IconLive, IconUser, IconStar, IconUserGroup } from '@douyinfe/semi-icons';

import Nav from '..';

const stories = storiesOf('Navigation', module);

stories.add(`default`, () => {
    const Demo = () => {
        let logo = '//lf1-cdn-tos.bytescm.com/obj/ttfe/ies/semi/logo_huoshan.png';

        return (
            <div style={{ height: '100vh', display: 'inline-block' }}>
                <Nav onSelect={(...args: any[]) => console.log(...args)}>
                    <Nav.Header logo={<img src={logo} />} text={'火山运营'} />
                    <Nav.Item itemKey={'1'} text={'Option 1'} icon="mail" link="/mail" />
                    <Nav.Sub text={'Group 2'} icon="folder" itemKey={'2'}>
                        {['2-1', '2-2'].map(k => (
                            <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} link={`folder/${k}`} />
                        ))}
                        <Nav.Item itemKey={'2-3'} text={'Option 2-3'} />
                        <Nav.Sub text={'Group 2-4'} itemKey={'2-4'}>
                            <Nav.Item itemKey={'2-4-1'} text={'Option 2-3-1'} />
                            <Nav.Item itemKey={'2-4-2'} text={'Option 2-3-2'} />
                        </Nav.Sub>
                    </Nav.Sub>
                    <Nav.Item key={3} itemKey={'3'} text={'Option 3'} icon="gift" />
                    <Nav.Item key={4} itemKey={'4'} text={'Option 4'} icon="list" />
                    <Nav.Sub text={'Group 5'} icon="flag" itemKey={'5'}>
                        {['5-1', '5-2'].map(k => (
                            <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
                        ))}
                    </Nav.Sub>
                    <Nav.Footer collapseButton  />
                </Nav>
            </div>
        );
    };

    return <Demo />;
});


stories.add(`fix 35`, () => {
    const Demo = () => {
        return (
            <>
                <Nav
                    style={{ maxWidth: 220, height: '100%' }}
                    defaultSelectedKeys={['Home']}
                    items={[
                        { itemKey: 'Home', text: '首页', icon: <IconHome size="large" /> },
                        { itemKey: 'Histogram', text: '基础数据', icon: <IconHistogram size="large" /> },
                        { itemKey: 'Live', text: '测试功能', icon: <IconLive size="large" /> },
                        { itemKey: 'Setting', text: '设置', icon: <IconSetting size="large" /> },
                    ]}
                    footer={{
                        collapseButton: true,
                    }}
                />
                <Nav
                    bodyStyle={{ height: 320 }}
                    items={[
                        { itemKey: 'user', text: '用户管理', icon: <IconUser /> },
                        { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
                        {
                            text: '任务平台',
                            icon: <IconSetting />,
                            itemKey: 'job',
                            items: ['任务管理', '用户任务查询'],
                        },
                    ]}
                    onSelect={data => console.log('trigger onSelect: ', data)}
                    onClick={data => console.log('trigger onClick: ', data)}
                />
                <Nav
                    bodyStyle={{ height: 320 }}
                    defaultOpenKeys={['user', 'union']}
                    onSelect={data => console.log('trigger onSelect: ', data)}
                    onClick={data => console.log('trigger onClick: ', data)}
                >
                    <Nav.Header logo={<img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/webcast_logo.svg" />} text={'Semi 运营后台'} />
                    <Nav.Item itemKey={'union'} text={'公会中心'} icon={<IconStar />} />
                    <Nav.Sub itemKey={'user'} text="用户管理" icon={<IconUser />}>
                        <Nav.Item itemKey={'golder'} text={'金主管理'} />
                        <Nav.Item itemKey={'ban'} text={'用户封禁'} />
                    </Nav.Sub>
                    <Nav.Sub itemKey={'union-management'} text="公会管理" icon={<IconUserGroup />}>
                        <Nav.Item itemKey={'notice'} text={'公告设置'} />
                        <Nav.Item itemKey={'query'} text={'公会查询'} />
                        <Nav.Item itemKey={'info'} text={'信息录入'} />
                    </Nav.Sub>
                    <Nav.Footer collapseButton={true} />
                </Nav>
            </>
        );
    };

    return <Demo />;
});
