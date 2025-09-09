/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Tabs, Badge } from '@douyinfe/semi-ui';
import { 
  FaServer, 
  FaPlay, 
  FaSpinner, 
  FaStop, 
  FaExclamationTriangle, 
  FaClock 
} from 'react-icons/fa';

const DeploymentsTabs = ({
  statusCounts,
  activeStatusKey,
  handleTabChange,
  t,
}) => {
  const getStatusIcon = (status) => {
    const icons = {
      all: <FaServer />,
      running: <FaPlay style={{ color: '#52c41a' }} />,
      deploying: <FaSpinner style={{ color: '#1890ff' }} />,
      stopped: <FaStop style={{ color: '#8c8c8c' }} />,
      error: <FaExclamationTriangle style={{ color: '#ff4d4f' }} />,
      pending: <FaClock style={{ color: '#faad14' }} />,
    };
    return icons[status] || <FaServer />;
  };

  const tabList = [
    {
      key: 'all',
      label: t('全部'),
      icon: getStatusIcon('all'),
    },
    {
      key: 'running',
      label: t('运行中'),
      icon: getStatusIcon('running'),
    },
    {
      key: 'deploying',
      label: t('部署中'),
      icon: getStatusIcon('deploying'),
    },
    {
      key: 'stopped',
      label: t('已停止'),
      icon: getStatusIcon('stopped'),
    },
    {
      key: 'error',
      label: t('错误'),
      icon: getStatusIcon('error'),
    },
    {
      key: 'pending',
      label: t('待部署'),
      icon: getStatusIcon('pending'),
    },
  ];

  const renderTabTitle = (tab) => {
    const count = statusCounts[tab.key] || 0;
    
    return (
      <div className='flex items-center gap-2'>
        {tab.icon}
        <span>{tab.label}</span>
        <Badge 
          count={count} 
          type={tab.key === 'error' ? 'danger' : 'primary'}
          size='small'
        />
      </div>
    );
  };

  return (
    <div className='w-full'>
      <Tabs
        type='line'
        activeKey={activeStatusKey}
        onChange={handleTabChange}
        size='small'
      >
        {tabList.map((tab) => (
          <Tabs.TabPane
            key={tab.key}
            tab={renderTabTitle(tab)}
            itemKey={tab.key}
          />
        ))}
      </Tabs>
    </div>
  );
};

export default DeploymentsTabs;