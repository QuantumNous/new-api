import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { AppOutline, CompassOutline, UserOutline } from 'antd-mobile-icons';

const tabs = [
  { key: '/', title: '首页', icon: <AppOutline /> },
  { key: '/experience', title: '体验', icon: <CompassOutline /> },
  { key: '/profile', title: '我的', icon: <UserOutline /> },
];

const TabLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
      <div className='m-tabbar-wrap'>
        <TabBar
          activeKey={location.pathname}
          onChange={(key) => navigate(key)}
        >
          {tabs.map((item) => (
            <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
          ))}
        </TabBar>
      </div>
    </div>
  );
};

export default TabLayout;
