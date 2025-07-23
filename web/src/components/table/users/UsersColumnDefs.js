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
import {
  Button,
  Space,
  Tag,
  Tooltip,
  Progress,
  Switch,
} from '@douyinfe/semi-ui';
import { renderGroup, renderNumber, renderQuota } from '../../../helpers';

/**
 * Render user role
 */
const renderRole = (role, t) => {
  switch (role) {
    case 1:
      return (
        <Tag color='blue' shape='circle'>
          {t('普通用户')}
        </Tag>
      );
    case 10:
      return (
        <Tag color='yellow' shape='circle'>
          {t('管理员')}
        </Tag>
      );
    case 100:
      return (
        <Tag color='orange' shape='circle'>
          {t('超级管理员')}
        </Tag>
      );
    default:
      return (
        <Tag color='red' shape='circle'>
          {t('未知身份')}
        </Tag>
      );
  }
};

/**
 * Render username with remark
 */
const renderUsername = (text, record) => {
  const remark = record.remark;
  if (!remark) {
    return <span>{text}</span>;
  }
  const maxLen = 10;
  const displayRemark = remark.length > maxLen ? remark.slice(0, maxLen) + '…' : remark;
  return (
    <Space spacing={2}>
      <span>{text}</span>
      <Tooltip content={remark} position="top" showArrow>
        <Tag color='white' shape='circle' className="!text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 flex-shrink-0 rounded-full" style={{ backgroundColor: '#10b981' }} />
            {displayRemark}
          </div>
        </Tag>
      </Tooltip>
    </Space>
  );
};

/**
 * Render user statistics
 */
const renderStatistics = (text, record, showEnableDisableModal, t) => {
  const enabled = record.status === 1;
  const isDeleted = record.DeletedAt !== null;

  // Determine tag text & color like original status column
  let tagColor = 'grey';
  let tagText = t('未知状态');
  if (isDeleted) {
    tagColor = 'red';
    tagText = t('已注销');
  } else if (record.status === 1) {
    tagColor = 'green';
    tagText = t('已激活');
  } else if (record.status === 2) {
    tagColor = 'red';
    tagText = t('已封禁');
  }

  const handleToggle = (checked) => {
    if (checked) {
      showEnableDisableModal(record, 'enable');
    } else {
      showEnableDisableModal(record, 'disable');
    }
  };

  const used = parseInt(record.used_quota) || 0;
  const remain = parseInt(record.quota) || 0;
  const total = used + remain;
  const percent = total > 0 ? (remain / total) * 100 : 0;

  const getProgressColor = (pct) => {
    if (pct === 100) return 'var(--semi-color-success)';
    if (pct <= 10) return 'var(--semi-color-danger)';
    if (pct <= 30) return 'var(--semi-color-warning)';
    return undefined;
  };

  const quotaSuffix = (
    <div className='flex flex-col items-end'>
      <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
      <Progress
        percent={percent}
        stroke={getProgressColor(percent)}
        aria-label='quota usage'
        format={() => `${percent.toFixed(0)}%`}
        style={{ width: '100%', marginTop: '1px', marginBottom: 0 }}
      />
    </div>
  );

  const content = (
    <Tag
      color={tagColor}
      shape='circle'
      size='large'
      prefixIcon={
        <Switch
          size='small'
          checked={enabled}
          onChange={handleToggle}
          disabled={isDeleted}
          aria-label='user status switch'
        />
      }
      suffixIcon={quotaSuffix}
    >
      {tagText}
    </Tag>
  );

  const tooltipContent = (
    <div className='text-xs'>
      <div>{t('已用额度')}: {renderQuota(used)}</div>
      <div>{t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)</div>
      <div>{t('总额度')}: {renderQuota(total)}</div>
      <div>{t('调用次数')}: {renderNumber(record.request_count)}</div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position='top'>
      {content}
    </Tooltip>
  );
};

/**
 * Render invite information
 */
const renderInviteInfo = (text, record, t) => {
  return (
    <div>
      <Space spacing={1}>
        <Tag color='white' shape='circle' className="!text-xs">
          {t('邀请')}: {renderNumber(record.aff_count)}
        </Tag>
        <Tag color='white' shape='circle' className="!text-xs">
          {t('收益')}: {renderQuota(record.aff_history_quota)}
        </Tag>
        <Tag color='white' shape='circle' className="!text-xs">
          {record.inviter_id === 0 ? t('无邀请人') : `${t('邀请人')}: ${record.inviter_id}`}
        </Tag>
      </Space>
    </div>
  );
};

/**
 * Render operations column
 */
const renderOperations = (text, record, {
  setEditingUser,
  setShowEditUser,
  showPromoteModal,
  showDemoteModal,
  showDeleteModal,
  t
}) => {
  if (record.DeletedAt !== null) {
    return <></>;
  }

  return (
    <Space>
      <Button
        type='tertiary'
        size="small"
        onClick={() => {
          setEditingUser(record);
          setShowEditUser(true);
        }}
      >
        {t('编辑')}
      </Button>
      <Button
        type='warning'
        size="small"
        onClick={() => showPromoteModal(record)}
      >
        {t('提升')}
      </Button>
      <Button
        type='secondary'
        size="small"
        onClick={() => showDemoteModal(record)}
      >
        {t('降级')}
      </Button>
      <Button
        type='danger'
        size="small"
        onClick={() => showDeleteModal(record)}
      >
        {t('注销')}
      </Button>
    </Space>
  );
};

/**
 * Get users table column definitions
 */
export const getUsersColumns = ({
  t,
  setEditingUser,
  setShowEditUser,
  showPromoteModal,
  showDemoteModal,
  showEnableDisableModal,
  showDeleteModal
}) => {
  return [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (text, record) => renderUsername(text, record),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        return <div>{renderGroup(text)}</div>;
      },
    },
    {
      title: t('角色'),
      dataIndex: 'role',
      render: (text, record, index) => {
        return <div>{renderRole(text, t)}</div>;
      },
    },
    {
      title: t('状态'),
      dataIndex: 'info',
      render: (text, record, index) => renderStatistics(text, record, showEnableDisableModal, t),
    },
    {
      title: t('邀请信息'),
      dataIndex: 'invite',
      render: (text, record, index) => renderInviteInfo(text, record, t),
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 200,
      render: (text, record, index) => renderOperations(text, record, {
        setEditingUser,
        setShowEditUser,
        showPromoteModal,
        showDemoteModal,
        showEnableDisableModal,
        showDeleteModal,
        t
      }),
    },
  ];
}; 