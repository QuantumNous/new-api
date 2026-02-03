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
import { Button, Tag, Tooltip } from '@douyinfe/semi-ui';
import { RefreshCw, Search, Users, Zap, Clock, Activity, Calendar, CalendarDays } from 'lucide-react';

// 格式化限制值的辅助函数
const formatLimitValue = (value, t) => {
  if (value === 0 || value === undefined || value === null) {
    return t('无限制');
  }
  // 格式化大数字
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  showSearchModal,
  refresh,
  loading,
  t,
  userGroup,
  groupDescription,
  groupLimits,
}) => {
  const ICON_BUTTON_CLASS = 'text-white hover:bg-opacity-80 !rounded-full';

  // 检查是否启用了用户组限制功能
  const isGroupLimitEnabled = groupLimits?.enabled === true;

  // 限制项配置（仅在启用时使用）
  // 按照顺序：并发数、RPM、RPD、TPM、TPD
  const limitItems = isGroupLimitEnabled ? [
    {
      key: 'group',
      label: t('用户组'),
      value: groupDescription || userGroup || 'default',
      icon: <Users size={16} />,
      color: 'blue',
      isGroup: true,
    },
    {
      key: 'concurrency',
      label: t('并发数'),
      value: groupLimits?.concurrency,
      icon: <Zap size={16} />,
      color: 'green',
      tooltip: t('同时进行的请求数限制'),
    },
    {
      key: 'rpm',
      label: 'RPM',
      value: groupLimits?.rpm,
      icon: <Activity size={16} />,
      color: 'orange',
      tooltip: t('每分钟请求数限制'),
    },
    {
      key: 'rpd',
      label: 'RPD',
      value: groupLimits?.rpd,
      icon: <CalendarDays size={16} />,
      color: 'amber',
      tooltip: t('每日请求数限制'),
    },
    {
      key: 'tpm',
      label: 'TPM',
      value: groupLimits?.tpm,
      icon: <Clock size={16} />,
      color: 'purple',
      tooltip: t('每分钟令牌数限制'),
    },
    {
      key: 'tpd',
      label: 'TPD',
      value: groupLimits?.tpd,
      icon: <Calendar size={16} />,
      color: 'cyan',
      tooltip: t('每日令牌数限制'),
    },
  ] : [];

  return (
    <div className='mb-4'>
      {/* 问候语和操作按钮行 */}
      <div className='flex items-center justify-between mb-3'>
        <h2
          className='text-2xl font-semibold text-gray-800 dark:text-gray-200 transition-opacity duration-1000 ease-in-out'
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          {getGreeting}
        </h2>
        <div className='flex gap-3'>
          <Button
            type='tertiary'
            icon={<Search size={16} />}
            onClick={showSearchModal}
            className={`bg-green-500 hover:bg-green-600 ${ICON_BUTTON_CLASS}`}
          />
          <Button
            type='tertiary'
            icon={<RefreshCw size={16} />}
            onClick={refresh}
            loading={loading}
            className={`bg-blue-500 hover:bg-blue-600 ${ICON_BUTTON_CLASS}`}
          />
        </div>
      </div>

      {/* 用户限制信息行 - 仅在启用时显示 */}
      {isGroupLimitEnabled && limitItems.length > 0 && (
        <div 
          className='flex flex-wrap items-center gap-3 transition-opacity duration-1000 ease-in-out'
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          {limitItems.map((item) => (
            <Tooltip 
              key={item.key}
              content={item.tooltip || item.label}
              position='bottom'
            >
              <Tag
                color={item.color}
                size='large'
                shape='square'
                className='flex items-center gap-2 cursor-default px-4 py-2'
              >
                {item.icon}
                <span className='font-medium'>{item.label}:</span>
                <span>
                  {item.isGroup 
                    ? item.value 
                    : formatLimitValue(item.value, t)
                  }
                </span>
              </Tag>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
