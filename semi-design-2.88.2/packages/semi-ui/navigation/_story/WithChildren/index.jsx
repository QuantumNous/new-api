import React, { useState, useCallback } from 'react';
import { Nav, Button } from '@douyinfe/semi-ui';
import { IconAppCenter, IconArticle, IconFolder, IconPhoneStroke, IconSetting } from '@douyinfe/semi-icons';

const defaultItems = [
    {
        title: '应用管理',
        key: 'app',
        icon: <IconAppCenter />,
        children: [
            { title: '应用控制台', key: '/app/perm', children: [] },
            { title: '查看应用', key: '/app/list', children: [] },
            { title: '创建应用', key: '/app/create', children: [] },
            { title: '应用鉴权', key: '/app/auth', children: [] },
        ],
    },
    {
        title: '版本管理',
        key: 'version',
        icon: <IconArticle />,
        children: [
            { title: '版本发布', key: '/version/release', children: [] },
            { title: '产品功能发布', key: '/feature/release', children: [] },
            { title: '发版记录', key: '/version/releases', children: [] },
            { title: '开发文档', key: '/version/doc', children: [] },
            { title: 'VESDK介绍', key: '/version/sdkinfo', children: [] },
        ],
    },
    {
        title: '模块化打包',
        key: 'module',
        icon: <IconFolder />,
        children: [
            // { title: 'CI打包配置', key: '/module/ciconfig', children: [] },
            { title: '业务打包配置', key: '/module/cilist', children: [] },
            { title: '宏模块管理', key: '/module/group', children: [] },
            { title: '宏参数管理', key: '/module/param', children: [] },
            { title: '分支管理', key: '/module/branch', children: [] },
        ],
    },
    {
        title: '机型打分',
        key: 'device',
        icon: <IconPhoneStroke />,
        children: [
            { title: '机型性能查询', key: '/benchmark/performance', children: [] },
            { title: '生成黑白名单', key: '/benchmark/list', children: [] },
            { title: '黑白名单管理', key: '/benchmark/manage', children: [] },
            { title: '机型查询', key: '/benchmark/model', children: [] },
            { title: '元数据管理', key: '/benchmark/data', children: [] },
            { title: '场景打分管理', key: '/benchmark/scene', children: [] },
        ],
    },
    {
        title: 'VESDK数据',
        key: 'vesdk',
        icon: <IconPhoneStroke />,
        children: [
            { title: 'VESDK DAU趋势', key: '/trend/dau', children: [] },
            { title: 'VESDK API趋势', key: '/trend/api', children: [] },
        ],
    },
    {
        title: '工具能力',
        key: 'setting',
        icon: <IconSetting />,
        children: [
            { title: '群消息发送', key: '/setting/msg', children: [] },
            { title: '群标签管理', key: '/setting/tag', children: [] },
            { title: '上传文件', key: '/setting/upload', children: [] },
        ],
    },
];

const normalize = ({ title: text, key: itemKey, children: items, ...rest } = {}) => ({
    ...rest,
    text,
    itemKey,
    items: Array.isArray(items) && items.length ? items.map(normalize) : undefined,
});

const Demo = (props = {}) => {
    const [items, setItems] = useState(() => defaultItems.map(normalize));
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [openKeys, setOpenKeys] = useState([]);

    const onSelect = useCallback(item => {
        console.log(item);
        setSelectedKeys([item.itemKey]);
    }, []);
    const onOpenChange = useCallback(item => {
        console.log('onOpenChange: ', item);
        setOpenKeys([...item.openKeys]);
    });

    return (
        <div style={{ width: '100%', height: '100vh' }}>
            <Button onClick={() => setItems(defaultItems.map(normalize))}>重置导航</Button>
            <Nav
                defaultSelectedKeys={selectedKeys}
                openKeys={openKeys}
                style={{ height: '100%' }}
                bodyStyle={{ height: 480 }}
                items={items}
                onSelect={onSelect}
                onOpenChange={onOpenChange}
                header={{
                    logo: <img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/webcast_logo.svg" />,
                    text: 'Semi 运营后台',
                }}
                footer={{
                    collapseButton: true,
                }}
            />
        </div>
    );
};

export default Demo;
