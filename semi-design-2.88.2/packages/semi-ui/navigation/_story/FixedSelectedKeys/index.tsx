import React from 'react';
import { Layout, Nav } from '@douyinfe/semi-ui';
import { BrowserRouter, useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { IconSemiLogo } from '@douyinfe/semi-icons';

const { Header, Sider, Content } = Layout;

const RouterConfig = {
    config: {
        itemKey: '/config',
        text: 'Config',
        items: [
            {
                itemKey: '/config/ability',
                text: 'Ability',
                items: [
                    {
                        itemKey: '/config/ability/management',
                        text: 'Ability management',
                    },
                ],
            },
            {
                itemKey: '/config/task',
                text: 'Task',
                items: [
                    {
                        itemKey: '/config/task/management',
                        text: 'Word management',
                    },
                ],
            },
        ],
    },
    distribution: {
        itemKey: '/distribution',
        text: 'Distribution',
        items: [
            {
                itemKey: '/distribution/queue',
                text: 'Queue',
                items: [
                    {
                        itemKey: '/distribution/queue/management',
                        text: 'Config management',
                    },
                ],
            },
        ],
    },
};

const AppHeader = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const selectedKeys = React.useMemo(
        () => [
            location.pathname
                .split('/')
                .slice(0, 2)
                .join('/'),
        ],
        [location.pathname]
    );
    const HeaderItems = React.useMemo(
        () =>
            Object.values(RouterConfig).map(option => (
                <Nav.Item
                    key={option.itemKey}
                    itemKey={option.itemKey}
                    text={option.text}
                    onClick={() => {
                        if (option.itemKey) {
                            navigate(option.itemKey);
                        }
                    }}
                />
            )),
        [navigate]
    );

    return (
        <Header>
            <div>
                <Nav mode="horizontal" selectedKeys={selectedKeys} style={{ height: '52px' }}>
                    <Nav.Header>
                        <IconSemiLogo style={{ fontSize: 36 }} />
                        <span>Semi Design</span>
                    </Nav.Header>
                    {HeaderItems}
                </Nav>
            </div>
        </Header>
    );
};

const AppSider = () => {
    const location = useLocation();

    const selectedFirstLevelKey = React.useMemo(() => location.pathname.split('/')[1], [location.pathname]);
    const siderItems = React.useMemo(() => {
        const selectedKeyConfig = RouterConfig[selectedFirstLevelKey];
        return selectedKeyConfig?.items ?? [];
    }, [selectedFirstLevelKey]);

    const selectedKey = React.useMemo(() => [location.pathname], [location.pathname]);

    return (
        <Sider>
            <Nav selectedKeys={selectedKey} items={siderItems} />
        </Sider>
    );
};

const AppContent = () => {
    return (
        <Routes>
            <Route path="/config/ability/management" element={<div>ability</div>} />
            <Route path="/config/task/management" element={<div>word</div>} />
            <Route path="/config" element={<Navigate to="/config/ability/management" replace />} />
            <Route path="/distribution/queue/management" element={<div>config management</div>} />
            <Route path="/distribution" element={<Navigate to="/distribution/queue/management" replace />} />
            <Route index element={<Navigate to="/config/ability/management" replace />} />
        </Routes>
    );
};

export default function App() {
    return (
        <BrowserRouter>
            <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                <Layout>
                    <AppHeader />
                    <Layout>
                        <AppSider />
                        <Content>
                            <AppContent />
                        </Content>
                    </Layout>
                </Layout>
            </div>
        </BrowserRouter>
    );
}
