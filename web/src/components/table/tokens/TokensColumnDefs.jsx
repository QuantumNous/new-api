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
  Avatar,
  AvatarGroup,
  Button,
  Dropdown,
  Modal,
  Popover,
  Progress,
  Space,
  SplitButtonGroup,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCopy,
  IconEyeClosed,
  IconEyeOpened,
  IconTreeTriangleDown,
} from '@douyinfe/semi-icons';
import { MessageCircleMore, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import {
  getModelCategories,
  renderGroup,
  renderQuota,
  showError,
  timestamp2string,
} from '../../../helpers';

const { Paragraph } = Typography;

const getProgressColor = (pct) => {
  if (pct === 100) return 'var(--semi-color-success)';
  if (pct <= 10) return 'var(--semi-color-danger)';
  if (pct <= 30) return 'var(--semi-color-warning)';
  return undefined;
};

const renderTimestamp = (timestamp) => {
  const [date, time] = timestamp2string(timestamp).split(' ');
  return (
    <div className='token-time-cell'>
      <span>{date}</span>
      <small>{time}</small>
    </div>
  );
};

const renderNameCell = (text, record, t) => {
  const title = text || t('未命名令牌');
  const meta = record.model_limits_enabled
    ? t('已限制模型访问')
    : t('支持全部模型');

  return (
    <div className='token-name-cell'>
      <strong>{title}</strong>
      <span>{meta}</span>
    </div>
  );
};

const renderStatus = (text, t) => {
  let tone = 'neutral';
  let tagText = t('未知状态');

  if (text === 1) {
    tone = 'success';
    tagText = t('已启用');
  } else if (text === 2) {
    tone = 'danger';
    tagText = t('已禁用');
  } else if (text === 3) {
    tone = 'warning';
    tagText = t('已过期');
  } else if (text === 4) {
    tone = 'muted';
    tagText = t('已耗尽');
  }

  return (
    <Tag
      className={`token-status-tag token-status-${tone}`}
      shape='circle'
      size='small'
    >
      {tagText}
    </Tag>
  );
};

const renderGroupColumn = (text, record, t, groupRatios = {}) => {
  if (text === 'auto') {
    return (
      <Tooltip
        content={t(
          '当前分组为 auto，会自动选择最优分组，当一个组不可用时自动降级到下一个组（熔断机制）',
        )}
        position='top'
      >
        <Tag className='token-meta-pill token-meta-pill-auto' shape='circle'>
          {t('智能熔断')}
          {record && record.cross_group_retry ? `(${t('跨分组')})` : ''}
        </Tag>
      </Tooltip>
    );
  }

  const ratio = groupRatios[text];
  return (
    <span className='token-group-cell'>
      <span className='token-group-badges'>{renderGroup(text)}</span>
      {ratio !== undefined && (
        <Tag size='small' className='token-ratio-tag' shape='circle'>
          {ratio}x
        </Tag>
      )}
    </span>
  );
};

const renderTokenKey = (
  text,
  record,
  showKeys,
  resolvedTokenKeys,
  loadingTokenKeys,
  toggleTokenVisibility,
  copyTokenKey,
  copyTokenConnectionString,
  t,
) => {
  const revealed = !!showKeys[record.id];
  const loading = !!loadingTokenKeys[record.id];
  const keyValue =
    revealed && resolvedTokenKeys[record.id]
      ? resolvedTokenKeys[record.id]
      : record.key || '';
  const displayedKey = keyValue ? `sk-${keyValue}` : 'sk-****************';

  return (
    <div className='token-key-field'>
      <code className='token-key-code'>{displayedKey}</code>
      <div className='token-key-actions'>
        <Button
          theme='borderless'
          size='small'
          type='tertiary'
          className='token-icon-button'
          icon={revealed ? <IconEyeClosed /> : <IconEyeOpened />}
          loading={loading}
          aria-label='toggle token visibility'
          onClick={async (e) => {
            e.stopPropagation();
            await toggleTokenVisibility(record);
          }}
        />
        <Dropdown
          trigger='click'
          position='bottomRight'
          clickToHide
          menu={[
            {
              node: 'item',
              name: t('复制密钥'),
              onClick: () => copyTokenKey(record),
            },
            {
              node: 'item',
              name: t('复制连接信息'),
              onClick: () => copyTokenConnectionString(record),
            },
          ]}
        >
          <Button
            theme='borderless'
            size='small'
            type='tertiary'
            className='token-icon-button'
            icon={<IconCopy />}
            loading={loading}
            aria-label='copy token key'
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </Dropdown>
      </div>
    </div>
  );
};

const renderModelLimits = (text, record, t) => {
  if (!(record.model_limits_enabled && text)) {
    return (
      <Tag className='token-meta-pill' shape='circle'>
        {t('无限制')}
      </Tag>
    );
  }

  const models = text.split(',').filter(Boolean);
  const categories = getModelCategories(t);
  const vendorAvatars = [];
  const matchedModels = new Set();

  Object.entries(categories).forEach(([key, category]) => {
    if (key === 'all' || !category.icon || !category.filter) return;

    const vendorModels = models.filter((m) =>
      category.filter({ model_name: m }),
    );
    if (vendorModels.length === 0) return;

    vendorAvatars.push(
      <Tooltip
        key={key}
        content={vendorModels.join(', ')}
        position='top'
        showArrow
      >
        <Avatar
          size='extra-extra-small'
          alt={category.label}
          color='transparent'
        >
          {category.icon}
        </Avatar>
      </Tooltip>,
    );
    vendorModels.forEach((m) => matchedModels.add(m));
  });

  const unmatchedModels = models.filter((m) => !matchedModels.has(m));
  if (unmatchedModels.length > 0) {
    vendorAvatars.push(
      <Tooltip
        key='unknown'
        content={unmatchedModels.join(', ')}
        position='top'
        showArrow
      >
        <Avatar size='extra-extra-small' alt='unknown'>
          {t('其他')}
        </Avatar>
      </Tooltip>,
    );
  }

  return (
    <div className='token-model-cell'>
      <AvatarGroup size='extra-extra-small'>{vendorAvatars}</AvatarGroup>
      <span>{models.length + ' ' + t('个模型')}</span>
    </div>
  );
};

const renderAllowIps = (text, t) => {
  if (!text || text.trim() === '') {
    return (
      <Tag className='token-meta-pill' shape='circle'>
        {t('无限制')}
      </Tag>
    );
  }

  const ips = text
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean);
  const displayIps = ips.slice(0, 1);
  const extraCount = ips.length - displayIps.length;

  const ipTags = displayIps.map((ip, idx) => (
    <Tag key={idx} className='token-meta-pill' shape='circle'>
      {ip}
    </Tag>
  ));

  if (extraCount > 0) {
    ipTags.push(
      <Tooltip
        key='extra'
        content={ips.slice(1).join(', ')}
        position='top'
        showArrow
      >
        <Tag className='token-meta-pill token-meta-pill-count' shape='circle'>
          {'+' + extraCount}
        </Tag>
      </Tooltip>,
    );
  }

  return (
    <Space wrap className='token-ip-cell'>
      {ipTags}
    </Space>
  );
};

const renderQuotaUsage = (text, record, t) => {
  const used = parseInt(record.used_quota, 10) || 0;
  const remain = parseInt(record.remain_quota, 10) || 0;
  const total = used + remain;

  if (record.unlimited_quota) {
    const popoverContent = (
      <div className='text-xs p-2'>
        <Paragraph copyable={{ content: renderQuota(used) }}>
          {t('已用额度')}: {renderQuota(used)}
        </Paragraph>
      </div>
    );

    return (
      <Popover content={popoverContent} position='top'>
        <div className='token-quota-panel token-quota-panel-unlimited'>
          <div className='token-quota-top'>
            <span>{t('可用额度')}</span>
            <strong>{t('无限额度')}</strong>
          </div>
          <div className='token-quota-foot'>
            <span>
              {t('已用额度')} {renderQuota(used)}
            </span>
          </div>
        </div>
      </Popover>
    );
  }

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
      <div className='token-quota-panel'>
        <div className='token-quota-top'>
          <span>{t('剩余额度')}</span>
          <strong>{renderQuota(remain)}</strong>
        </div>
        <Progress
          percent={percent}
          stroke={getProgressColor(percent)}
          showInfo={false}
          aria-label='quota usage'
          className='token-quota-progress'
        />
        <div className='token-quota-foot'>
          <span>{renderQuota(total) + ' ' + t('总额度')}</span>
          <span>{percent.toFixed(0)}%</span>
        </div>
      </div>
    </Popover>
  );
};

const renderOperations = (
  text,
  record,
  onOpenLink,
  setEditingToken,
  setShowEdit,
  manageToken,
  refresh,
  t,
) => {
  const chatsArray = [];
  try {
    const raw = localStorage.getItem('chats');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i += 1) {
        const item = parsed[i];
        const name = Object.keys(item)[0];
        if (!name) continue;
        chatsArray.push({
          node: 'item',
          key: i,
          name,
          value: item[name],
          onClick: () => onOpenLink(name, item[name], record),
        });
      }
    }
  } catch (_) {
    showError(t('聊天链接配置错误，请联系管理员'));
  }

  return (
    <Space wrap className='token-actions-cell'>
      <SplitButtonGroup
        className='token-chat-group'
        aria-label={t('项目操作按钮组')}
      >
        <Button
          size='default'
          type='tertiary'
          className='token-chat-button'
          icon={<MessageCircleMore size={15} />}
          onClick={() => {
            if (chatsArray.length === 0) {
              showError(t('请联系管理员配置聊天链接'));
            } else {
              const first = chatsArray[0];
              onOpenLink(first.name, first.value, record);
            }
          }}
        >
          {t('聊天')}
        </Button>
        <Dropdown trigger='click' position='bottomRight' menu={chatsArray}>
          <Button
            type='tertiary'
            size='default'
            className='token-chat-button token-chat-button-split'
            icon={<IconTreeTriangleDown />}
          />
        </Dropdown>
      </SplitButtonGroup>

      <Button
        theme='borderless'
        type={record.status === 1 ? 'warning' : 'primary'}
        size='default'
        className='token-action-icon-button'
        icon={record.status === 1 ? <Pause size={15} /> : <Play size={15} />}
        onClick={async () => {
          await manageToken(
            record.id,
            record.status === 1 ? 'disable' : 'enable',
            record,
          );
          await refresh();
        }}
      />

      <Button
        theme='borderless'
        type='tertiary'
        size='default'
        className='token-action-icon-button'
        icon={<Pencil size={15} />}
        onClick={() => {
          setEditingToken(record);
          setShowEdit(true);
        }}
      />

      <Button
        theme='borderless'
        type='danger'
        size='default'
        className='token-action-icon-button token-action-icon-button-danger'
        icon={<Trash2 size={15} />}
        onClick={() => {
          Modal.confirm({
            title: t('确定是否要删除此令牌？'),
            content: t('此修改将不可逆'),
            onOk: () => {
              (async () => {
                await manageToken(record.id, 'delete', record);
                await refresh();
              })();
            },
          });
        }}
      />
    </Space>
  );
};

export const getTokensColumns = ({
  t,
  showKeys,
  resolvedTokenKeys,
  loadingTokenKeys,
  toggleTokenVisibility,
  copyTokenKey,
  copyTokenConnectionString,
  manageToken,
  onOpenLink,
  setEditingToken,
  setShowEdit,
  refresh,
  groupRatios = {},
}) => {
  return [
    {
      title: t('名称'),
      dataIndex: 'name',
      width: 180,
      render: (text, record) => renderNameCell(text, record, t),
    },
    {
      title: t('密钥'),
      key: 'token_key',
      width: 280,
      render: (text, record) =>
        renderTokenKey(
          text,
          record,
          showKeys,
          resolvedTokenKeys,
          loadingTokenKeys,
          toggleTokenVisibility,
          copyTokenKey,
          copyTokenConnectionString,
          t,
        ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text) => renderStatus(text, t),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      key: 'group',
      width: 220,
      render: (text, record) => renderGroupColumn(text, record, t, groupRatios),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      width: 210,
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('可用模型'),
      dataIndex: 'model_limits',
      width: 180,
      render: (text, record) => renderModelLimits(text, record, t),
    },
    {
      title: t('IP限制'),
      dataIndex: 'allow_ips',
      width: 180,
      render: (text) => renderAllowIps(text, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      width: 168,
      render: (text) => <div>{renderTimestamp(text)}</div>,
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      width: 168,
      render: (text, record) => {
        if (record.expired_time === -1) {
          return (
            <Tag
              className='token-meta-pill token-meta-pill-neutral'
              shape='circle'
            >
              {t('永不过期')}
            </Tag>
          );
        }
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      fixed: 'right',
      width: 190,
      render: (text, record) =>
        renderOperations(
          text,
          record,
          onOpenLink,
          setEditingToken,
          setShowEdit,
          manageToken,
          refresh,
          t,
        ),
    },
  ];
};
