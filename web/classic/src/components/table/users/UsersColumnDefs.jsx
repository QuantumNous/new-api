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
  Popover,
  Typography,
  Dropdown,
} from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import {
  renderGroup,
  renderNumber,
  renderQuota,
  timestamp2string,
} from '../../../helpers';

const renderTimestamp = (text) => (text ? timestamp2string(text) : '-');

const KYC_STATUS_MAP = {
  0: { text: '未认证', color: 'grey' },
  1: { text: '审核中', color: 'orange' },
  2: { text: '已认证', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

const renderKYCStatus = (status, t) => {
  const s = KYC_STATUS_MAP[status] ?? KYC_STATUS_MAP[0];
  return (
    <Tag color={s.color} shape='circle' size='small'>
      {t(s.text)}
    </Tag>
  );
};

const ENTERPRISE_STATUS_MAP = {
  0: { text: '未认证', color: 'grey' },
  1: { text: '审核中', color: 'orange' },
  2: { text: '已认证', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

const renderEnterpriseStatus = (status, t) => {
  const s = ENTERPRISE_STATUS_MAP[status] ?? ENTERPRISE_STATUS_MAP[0];
  return (
    <Tag color={s.color} shape='circle' size='small'>
      {t(s.text)}
    </Tag>
  );
};

/**
 * Render user role
 *
 * 企业账户体系（基于 enterprise_status / parent_user_id）优先于「普通用户」标签：
 *   - parent_user_id > 0           → 企业子用户（只读子账户，紫色）
 *   - enterprise_status === 2（非子）→ 企业用户（已企业认证主账户，青色）
 * 管理员 / 超级管理员保持原标签不受影响。
 */
const renderRole = (role, record, t) => {
  if (role === 1 && (record?.parent_user_id || 0) > 0) {
    return (
      <Tag color='violet' shape='circle'>
        {t('企业子用户')}
      </Tag>
    );
  }
  if (role === 1 && record?.enterprise_status === 2) {
    return (
      <Tag color='cyan' shape='circle'>
        {t('企业用户')}
      </Tag>
    );
  }
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
 * Render username with remark, and an affiliation line for sub-accounts.
 */
const renderUsername = (text, record, t) => {
  const remark = record.remark;
  let main;
  if (!remark) {
    main = <span>{text}</span>;
  } else {
    const maxLen = 10;
    const displayRemark =
      remark.length > maxLen ? remark.slice(0, maxLen) + '…' : remark;
    main = (
      <Space spacing={2}>
        <span>{text}</span>
        <Tooltip content={remark} position='top' showArrow>
          <Tag color='white' shape='circle' className='!text-xs'>
            <div className='flex items-center gap-1'>
              <div
                className='w-2 h-2 flex-shrink-0 rounded-full'
                style={{ backgroundColor: '#10b981' }}
              />
              {displayRemark}
            </div>
          </Tag>
        </Tooltip>
      </Space>
    );
  }

  // 子账户：用户名下方加一行「隶属 企业主用户名 (#id)」，展示归属企业（方案 A）。
  if ((record?.parent_user_id || 0) > 0) {
    const parentName = record.parent_username || `#${record.parent_user_id}`;
    return (
      <div className='flex flex-col gap-0.5'>
        {main}
        <span className='text-xs text-gray-400'>
          {t('隶属')} {parentName}（#{record.parent_user_id}）
        </span>
      </div>
    );
  }
  return main;
};

/**
 * Render user statistics
 */
const renderStatistics = (text, record, showEnableDisableModal, t) => {
  const isDeleted = record.DeletedAt !== null;

  // Determine tag text & color like original status column
  let tagColor = 'grey';
  let tagText = t('未知状态');
  if (isDeleted) {
    tagColor = 'red';
    tagText = t('已注销');
  } else if (record.status === 1) {
    tagColor = 'green';
    tagText = t('已启用');
  } else if (record.status === 2) {
    tagColor = 'red';
    tagText = t('已禁用');
  }

  const content = (
    <Tag color={tagColor} shape='circle' size='small'>
      {tagText}
    </Tag>
  );

  const tooltipContent = (
    <div className='text-xs'>
      <div>
        {t('调用次数')}: {renderNumber(record.request_count)}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position='top'>
      {content}
    </Tooltip>
  );
};

// Render separate quota usage column
const renderQuotaUsage = (text, record, t) => {
  const { Paragraph } = Typography;
  const used = parseInt(record.used_quota) || 0;
  const remain = parseInt(record.quota) || 0;
  const total = used + remain;
  const percent = total > 0 ? (remain / total) * 100 : 0;
  const popoverContent = (
    <div className='text-xs p-2'>
      <Paragraph copyable={{ content: renderQuota(used) }}>
        {t('已用额度')}: {renderQuota(used)}
      </Paragraph>
      <Paragraph copyable={{ content: renderQuota(remain) }}>
        {t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)
      </Paragraph>
      <Paragraph copyable={{ content: renderQuota(total) }}>
        {t('总额度')}: {renderQuota(total)}
      </Paragraph>
    </div>
  );
  return (
    <Popover content={popoverContent} position='top'>
      <Tag color='white' shape='circle'>
        <div className='flex flex-col items-end'>
          <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
          <Progress
            percent={percent}
            aria-label='quota usage'
            format={() => `${percent.toFixed(0)}%`}
            style={{ width: '100%', marginTop: '1px', marginBottom: 0 }}
          />
        </div>
      </Tag>
    </Popover>
  );
};

/**
 * Render invite information
 */
const renderInviteInfo = (text, record, t) => {
  return (
    <div>
      <Space spacing={1}>
        <Tag color='white' shape='circle' className='!text-xs'>
          {t('邀请')}: {renderNumber(record.aff_count)}
        </Tag>
        <Tag color='white' shape='circle' className='!text-xs'>
          {t('收益')}: {renderQuota(record.aff_history_quota)}
        </Tag>
        <Tag color='white' shape='circle' className='!text-xs'>
          {record.inviter_id === 0
            ? t('无邀请人')
            : `${t('邀请人')}: ${record.inviter_id}`}
        </Tag>
      </Space>
    </div>
  );
};

/**
 * Render operations column
 */
const renderOperations = (
  text,
  record,
  {
    setEditingUser,
    setShowEditUser,
    showPromoteModal,
    showDemoteModal,
    showEnableDisableModal,
    showDeleteModal,
    showResetPasskeyModal,
    showResetTwoFAModal,
    showUserSubscriptionsModal,
    t,
  },
) => {
  if (record.DeletedAt !== null) {
    return <></>;
  }

  // 子账户（只读，隶属企业）：以下管理员操作对其无意义或有害，一律隐藏——
  //   提升（有害：会造出绕过限制的矛盾管理员）、降级（no-op）、订阅管理（惰性额度）、
  //   重置 Passkey/2FA（个人设置已隐藏，子账户无法设置故无的放矢）。
  // 只保留 禁用/启用、编辑、注销。提升/降级后端也已加守卫兜底。
  const isSubAccount = (record?.parent_user_id || 0) > 0;

  const moreMenu = isSubAccount
    ? [
        {
          node: 'item',
          name: t('注销'),
          type: 'danger',
          onClick: () => showDeleteModal(record),
        },
      ]
    : [
        {
          node: 'item',
          name: t('订阅管理'),
          onClick: () => showUserSubscriptionsModal(record),
        },
        {
          node: 'divider',
        },
        {
          node: 'item',
          name: t('重置 Passkey'),
          onClick: () => showResetPasskeyModal(record),
        },
        {
          node: 'item',
          name: t('重置 2FA'),
          onClick: () => showResetTwoFAModal(record),
        },
        {
          node: 'divider',
        },
        {
          node: 'item',
          name: t('注销'),
          type: 'danger',
          onClick: () => showDeleteModal(record),
        },
      ];

  return (
    <Space>
      {record.status === 1 ? (
        <Button
          type='danger'
          size='small'
          onClick={() => showEnableDisableModal(record, 'disable')}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          size='small'
          onClick={() => showEnableDisableModal(record, 'enable')}
        >
          {t('启用')}
        </Button>
      )}
      <Button
        type='tertiary'
        size='small'
        onClick={() => {
          setEditingUser(record);
          setShowEditUser(true);
        }}
      >
        {t('编辑')}
      </Button>
      {!isSubAccount && (
        <Button
          type='warning'
          size='small'
          onClick={() => showPromoteModal(record)}
        >
          {t('提升')}
        </Button>
      )}
      {!isSubAccount && (
        <Button
          type='secondary'
          size='small'
          onClick={() => showDemoteModal(record)}
        >
          {t('降级')}
        </Button>
      )}
      <Dropdown menu={moreMenu} trigger='click' position='bottomRight'>
        <Button type='tertiary' size='small' icon={<IconMore />} />
      </Dropdown>
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
  showDeleteModal,
  showResetPasskeyModal,
  showResetTwoFAModal,
  showUserSubscriptionsModal,
}) => {
  return [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (text, record) => renderUsername(text, record, t),
    },
    {
      title: t('状态'),
      dataIndex: 'info',
      render: (text, record, index) =>
        renderStatistics(text, record, showEnableDisableModal, t),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        // 子账户的分组字段纯惰性：计费走绑定 key 所属的企业主账户分组，子账户自身
        // 不发起计费流量，故其 group 改成什么都不生效。显示 - 避免误导（防管理员误以为
        // 调子账户分组能改价）。
        if ((record?.parent_user_id || 0) > 0) {
          return <span className='text-gray-400'>-</span>;
        }
        return <div>{renderGroup(text)}</div>;
      },
    },
    {
      title: t('角色'),
      dataIndex: 'role',
      render: (text, record, index) => {
        return <div>{renderRole(text, record, t)}</div>;
      },
    },
    {
      title: t('实名认证'),
      dataIndex: 'kyc_status',
      render: (text, record) => renderKYCStatus(text ?? 0, t),
    },
    {
      title: t('企业认证'),
      dataIndex: 'enterprise_status',
      render: (text, record) => renderEnterpriseStatus(text ?? 0, t),
    },
    {
      title: t('邀请信息'),
      dataIndex: 'invite',
      render: (text, record, index) => renderInviteInfo(text, record, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      render: renderTimestamp,
    },
    {
      title: t('最后登录'),
      dataIndex: 'last_login_at',
      render: renderTimestamp,
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 200,
      render: (text, record, index) =>
        renderOperations(text, record, {
          setEditingUser,
          setShowEditUser,
          showPromoteModal,
          showDemoteModal,
          showEnableDisableModal,
          showDeleteModal,
          showResetPasskeyModal,
          showResetTwoFAModal,
          showUserSubscriptionsModal,
          t,
        }),
    },
  ];
};
