/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { AlertTriangle, ChevronDown, MoreVertical } from 'lucide-react';
import { FaRandom } from 'react-icons/fa';
import {
  timestamp2string,
  renderGroup,
  renderQuota,
  getChannelIcon,
  renderQuotaWithAmount,
  showSuccess,
  showError,
  showInfo,
} from '../../../helpers';
import {
  CHANNEL_OPTIONS,
  MODEL_FETCHABLE_CHANNEL_TYPES,
} from '../../../constants';
import { parseUpstreamUpdateMeta } from '../../../hooks/channels/upstreamUpdateUtils';
import ClickMenu from '../../common/ui/ClickMenu';
import ConfirmDialog from '../../common/ui/ConfirmDialog';

// Tone palette mirrors the Semi `<Tag color>` palette used throughout
// /console for status chips.  Maps to semantic surface tones so light/dark
// inherit from theme tokens.  Includes the extra `lime`/`yellow`/`purple`/
// `white` tones the channels view relies on for the response-time +
// IO.NET + balance chips.
const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
  'light-blue': 'bg-primary/10 text-primary',
  yellow: 'bg-warning/15 text-warning',
  lime: 'bg-success/10 text-success',
  red: 'bg-danger/15 text-danger',
  purple:
    'bg-[color-mix(in_oklab,var(--app-primary)_8%,transparent)] text-[color-mix(in_oklab,var(--app-primary)_82%,var(--app-foreground))]',
  grey: 'bg-surface-secondary text-muted',
  white: 'border border-border bg-background text-foreground',
};

function StatusChip({
  tone = 'grey',
  size = 'sm',
  className = '',
  onClick,
  prefixIcon,
  children,
}) {
  const cls = TAG_TONE[tone] || TAG_TONE.grey;
  const sizeCls = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full font-medium ${cls} ${sizeCls} ${
        onClick ? 'cursor-pointer transition hover:-translate-y-px hover:opacity-85 active:scale-95' : ''
      } ${className}`}
    >
      {prefixIcon}
      <span className='inline-flex items-center'>{children}</span>
    </Component>
  );
}

const renderType = (type, record = {}, t) => {
  const channelInfo = record?.channel_info;
  const type2label = new Map();
  for (let i = 0; i < CHANNEL_OPTIONS.length; i++) {
    type2label[CHANNEL_OPTIONS[i].value] = CHANNEL_OPTIONS[i];
  }
  type2label[0] = { value: 0, label: t('未知类型'), color: 'grey' };

  let icon = getChannelIcon(type);

  if (channelInfo?.is_multi_key) {
    icon =
      channelInfo?.multi_key_mode === 'random' ? (
        <span className='flex items-center gap-1'>
          <FaRandom className='text-primary' />
          {icon}
        </span>
      ) : (
        <span className='flex items-center gap-1'>
          <ChevronDown size={12} className='text-primary' />
          {icon}
        </span>
      );
  }

  const typeTag = (
    <StatusChip tone={type2label[type]?.color} prefixIcon={icon}>
      {type2label[type]?.label}
    </StatusChip>
  );

  let ionetMeta = null;
  if (record?.other_info) {
    try {
      const parsed = JSON.parse(record.other_info);
      if (parsed && typeof parsed === 'object' && parsed.source === 'ionet') {
        ionetMeta = parsed;
      }
    } catch (error) {
      // ignore invalid metadata
    }
  }

  if (!ionetMeta) {
    return typeTag;
  }

  const handleNavigate = (event) => {
    event?.stopPropagation?.();
    if (!ionetMeta?.deployment_id) {
      return;
    }
    const targetUrl = `/console/deployment?deployment_id=${ionetMeta.deployment_id}`;
    window.open(targetUrl, '_blank', 'noopener');
  };

  return (
    <span className='inline-flex items-center gap-1.5'>
      {typeTag}
      <Tooltip
        content={
          <div className='max-w-xs'>
            <div className='text-xs text-foreground'>
              {t('来源于 IO.NET 部署')}
            </div>
            {ionetMeta?.deployment_id && (
              <div className='text-xs text-muted mt-1'>
                {t('部署 ID')}: {ionetMeta.deployment_id}
              </div>
            )}
          </div>
        }
      >
        <StatusChip tone='purple' onClick={handleNavigate}>
          IO.NET
        </StatusChip>
      </Tooltip>
    </span>
  );
};

const renderTagType = (t) => (
  <StatusChip tone='light-blue'>{t('标签聚合')}</StatusChip>
);

const renderStatus = (status, channelInfo = undefined, t) => {
  if (channelInfo?.is_multi_key) {
    const keySize = channelInfo.multi_key_size;
    let enabledKeySize = keySize;
    if (channelInfo.multi_key_status_list) {
      enabledKeySize =
        keySize - Object.keys(channelInfo.multi_key_status_list).length;
    }
    return renderMultiKeyStatus(status, keySize, enabledKeySize, t);
  }

  switch (status) {
    case 1:
      return <StatusChip tone='green'>{t('已启用')}</StatusChip>;
    case 2:
      return <StatusChip tone='red'>{t('已禁用')}</StatusChip>;
    case 3:
      return <StatusChip tone='yellow'>{t('自动禁用')}</StatusChip>;
    default:
      return <StatusChip tone='grey'>{t('未知状态')}</StatusChip>;
  }
};

const renderMultiKeyStatus = (status, keySize, enabledKeySize, t) => {
  const suffix = ` ${enabledKeySize}/${keySize}`;
  switch (status) {
    case 1:
      return <StatusChip tone='green'>{t('已启用') + suffix}</StatusChip>;
    case 2:
      return <StatusChip tone='red'>{t('已禁用') + suffix}</StatusChip>;
    case 3:
      return <StatusChip tone='yellow'>{t('自动禁用') + suffix}</StatusChip>;
    default:
      return <StatusChip tone='grey'>{t('未知状态') + suffix}</StatusChip>;
  }
};

const renderResponseTime = (responseTime, t) => {
  const seconds = (responseTime / 1000).toFixed(2) + t(' 秒');
  if (responseTime === 0) {
    return <StatusChip tone='grey'>{t('未测试')}</StatusChip>;
  }
  if (responseTime <= 1000) {
    return <StatusChip tone='green'>{seconds}</StatusChip>;
  }
  if (responseTime <= 3000) {
    return <StatusChip tone='lime'>{seconds}</StatusChip>;
  }
  if (responseTime <= 5000) {
    return <StatusChip tone='yellow'>{seconds}</StatusChip>;
  }
  return <StatusChip tone='red'>{seconds}</StatusChip>;
};

const isRequestPassThroughEnabled = (record) => {
  if (!record || record.children !== undefined) {
    return false;
  }
  const settingValue = record.setting;
  if (!settingValue) return false;
  if (typeof settingValue === 'object') {
    return settingValue.pass_through_body_enabled === true;
  }
  if (typeof settingValue !== 'string') return false;
  try {
    const parsed = JSON.parse(settingValue);
    return parsed?.pass_through_body_enabled === true;
  } catch (error) {
    return false;
  }
};

const getUpstreamUpdateMeta = (record) => {
  const supported =
    !!record &&
    record.children === undefined &&
    MODEL_FETCHABLE_CHANNEL_TYPES.has(record.type);
  if (!record || record.children !== undefined) {
    return {
      supported: false,
      enabled: false,
      pendingAddModels: [],
      pendingRemoveModels: [],
    };
  }
  const parsed =
    record?.upstreamUpdateMeta && typeof record.upstreamUpdateMeta === 'object'
      ? record.upstreamUpdateMeta
      : parseUpstreamUpdateMeta(record?.settings);
  return {
    supported,
    enabled: parsed?.enabled === true,
    pendingAddModels: Array.isArray(parsed?.pendingAddModels)
      ? parsed.pendingAddModels
      : [],
    pendingRemoveModels: Array.isArray(parsed?.pendingRemoveModels)
      ? parsed.pendingRemoveModels
      : [],
  };
};

// Replaces Semi `<InputNumber innerButtons defaultValue onBlur>` with a
// native `<input type='number'>`.  Keeps the same uncontrolled-input
// behaviour (commits on blur, no controlled state).
function PriorityInput({ defaultValue, min = -999, onBlur, ariaLabel }) {
  return (
    <input
      type='number'
      defaultValue={defaultValue}
      min={min}
      onBlur={onBlur}
      aria-label={ariaLabel}
      className='h-8 w-[70px] rounded-lg border border-border bg-background px-2 text-sm text-foreground tabular-nums outline-none focus:border-primary'
    />
  );
}

// Operate cell — extracted into a component so we can host a
// `ConfirmDialog` adjacent to the action buttons (Semi
// `Modal.confirm`/`Modal.warning` had no equivalent inside a column-defs
// render closure, so we emulate it with local state + the shared dialog).
function ChannelOperateCell({
  record,
  t,
  manageChannel,
  testChannel,
  setCurrentTestChannel,
  setShowModelTestModal,
  setEditingChannel,
  setShowEdit,
  setCurrentMultiKeyChannel,
  setShowMultiKeyManageModal,
  refresh,
  activePage,
  channels,
  copySelectedChannel,
  checkOllamaVersion,
  detectChannelUpstreamUpdates,
  openUpstreamUpdateModal,
  submitTagEdit,
}) {
  const [confirm, setConfirm] = useState(null);

  const ask = (config) => setConfirm(config);

  if (record.children !== undefined) {
    // Tag-aggregate row — only the "warn before bulk-update tag priority/weight"
    // dialog needs hosting at the cell level (children priority/weight
    // editors call ask() too).
    return null;
  }

  const upstreamUpdateMeta = getUpstreamUpdateMeta(record);
  const moreItems = [
    {
      label: t('删除'),
      danger: true,
      onClick: () =>
        ask({
          title: t('确定是否要删除此渠道？'),
          content: t('此修改将不可逆'),
          danger: true,
          onConfirm: async () => {
            await manageChannel(record.id, 'delete', record);
            await refresh();
            setTimeout(() => {
              if (channels.length === 0 && activePage > 1) {
                refresh(activePage - 1);
              }
            }, 100);
          },
        }),
    },
    {
      label: t('复制'),
      onClick: () =>
        ask({
          title: t('确定是否要复制此渠道？'),
          content: t('复制渠道的所有信息'),
          onConfirm: () => copySelectedChannel(record),
        }),
    },
  ];

  if (upstreamUpdateMeta.supported) {
    moreItems.push({
      label: t('仅检测上游模型更新'),
      onClick: () => detectChannelUpstreamUpdates(record),
    });
    moreItems.push({
      label: t('处理上游模型更新'),
      onClick: () => {
        if (!upstreamUpdateMeta.enabled) {
          showInfo(t('该渠道未开启上游模型更新检测'));
          return;
        }
        if (
          upstreamUpdateMeta.pendingAddModels.length === 0 &&
          upstreamUpdateMeta.pendingRemoveModels.length === 0
        ) {
          showInfo(t('该渠道暂无可处理的上游模型更新'));
          return;
        }
        openUpstreamUpdateModal(
          record,
          upstreamUpdateMeta.pendingAddModels,
          upstreamUpdateMeta.pendingRemoveModels,
          upstreamUpdateMeta.pendingAddModels.length > 0 ? 'add' : 'remove',
        );
      },
    });
  }

  if (record.type === 4) {
    moreItems.unshift({
      label: t('测活'),
      onClick: () => checkOllamaVersion(record),
    });
  }

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {/* Test split-button */}
      <span className='inline-flex overflow-hidden rounded-lg border border-border'>
        <Button
          size='sm'
          variant='light'
          className='rounded-none'
          onPress={() => testChannel(record, '')}
        >
          {t('测试')}
        </Button>
        <Button
          isIconOnly
          size='sm'
          variant='light'
          className='rounded-none border-l border-border'
          onPress={() => {
            setCurrentTestChannel(record);
            setShowModelTestModal(true);
          }}
          aria-label={t('选择模型测试')}
        >
          <ChevronDown size={14} />
        </Button>
      </span>

      {record.status === 1 ? (
        <Button
          size='sm'
          color='danger'
          variant='flat'
          onPress={() => manageChannel(record.id, 'disable', record)}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          size='sm'
          variant='flat'
          onPress={() => manageChannel(record.id, 'enable', record)}
        >
          {t('启用')}
        </Button>
      )}

      {record.channel_info?.is_multi_key ? (
        <span className='inline-flex overflow-hidden rounded-lg border border-border'>
          <Button
            size='sm'
            variant='light'
            className='rounded-none'
            onPress={() => {
              setEditingChannel(record);
              setShowEdit(true);
            }}
          >
            {t('编辑')}
          </Button>
          <ClickMenu
            items={[
              {
                label: t('多密钥管理'),
                onClick: () => {
                  setCurrentMultiKeyChannel(record);
                  setShowMultiKeyManageModal(true);
                },
              },
            ]}
            trigger={
              <Button
                isIconOnly
                size='sm'
                variant='light'
                className='rounded-none border-l border-border'
                aria-label={t('多密钥操作')}
              >
                <ChevronDown size={14} />
              </Button>
            }
          />
        </span>
      ) : (
        <Button
          size='sm'
          variant='light'
          onPress={() => {
            setEditingChannel(record);
            setShowEdit(true);
          }}
        >
          {t('编辑')}
        </Button>
      )}

      <ClickMenu
        items={moreItems}
        trigger={
          <Button
            isIconOnly
            size='sm'
            variant='light'
            aria-label={t('更多操作')}
          >
            <MoreVertical size={14} />
          </Button>
        }
      />

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title || ''}
        cancelText={t('取消')}
        confirmText={t('确定')}
        danger={!!confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          action?.();
        }}
      >
        {confirm?.content}
      </ConfirmDialog>
    </div>
  );
}

// Tag-aggregate row's operate cell (different action set; no destructive
// confirmations needed inline).
function TagOperateCell({
  record,
  t,
  manageTag,
  setShowEditTag,
  setEditingTag,
}) {
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <Button
        size='sm'
        variant='light'
        onPress={() => manageTag(record.key, 'enable')}
      >
        {t('启用全部')}
      </Button>
      <Button
        size='sm'
        variant='light'
        onPress={() => manageTag(record.key, 'disable')}
      >
        {t('禁用全部')}
      </Button>
      <Button
        size='sm'
        variant='light'
        onPress={() => {
          setShowEditTag(true);
          setEditingTag(record.key);
        }}
      >
        {t('编辑')}
      </Button>
    </div>
  );
}

// Priority cell needs its own host component when the row is a tag
// aggregate, because it triggers an inline confirm before submitting the
// tag bulk update.
function TagPriorityWeightInput({
  field,
  defaultValue,
  record,
  t,
  submitTagEdit,
}) {
  const [confirm, setConfirm] = useState(null);

  return (
    <>
      <PriorityInput
        defaultValue={defaultValue}
        min={field === 'weight' ? 0 : -999}
        ariaLabel={field === 'weight' ? t('权重') : t('优先级')}
        onBlur={(e) => {
          const value = e.target.value;
          if (value === '' || value === record[field]?.toString()) return;
          setConfirm({
            title:
              field === 'weight'
                ? t('修改子渠道权重')
                : t('修改子渠道优先级'),
            content:
              (field === 'weight'
                ? t('确定要修改所有子渠道权重为 ')
                : t('确定要修改所有子渠道优先级为 ')) +
              value +
              t(' 吗？'),
            onConfirm: () =>
              submitTagEdit(field, {
                tag: record.key,
                [field]: value,
              }),
          });
        }}
      />
      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title || ''}
        cancelText={t('取消')}
        confirmText={t('确定')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          action?.();
        }}
      >
        {confirm?.content}
      </ConfirmDialog>
    </>
  );
}

export const getChannelsColumns = ({
  t,
  COLUMN_KEYS,
  updateChannelBalance,
  manageChannel,
  manageTag,
  submitTagEdit,
  testChannel,
  setCurrentTestChannel,
  setShowModelTestModal,
  setEditingChannel,
  setShowEdit,
  setShowEditTag,
  setEditingTag,
  copySelectedChannel,
  refresh,
  activePage,
  channels,
  checkOllamaVersion,
  setShowMultiKeyManageModal,
  setCurrentMultiKeyChannel,
  openUpstreamUpdateModal,
  detectChannelUpstreamUpdates,
}) => {
  return [
    {
      key: COLUMN_KEYS.ID,
      title: t('ID'),
      dataIndex: 'id',
    },
    {
      key: COLUMN_KEYS.NAME,
      title: t('名称'),
      dataIndex: 'name',
      render: (text, record) => {
        const passThroughEnabled = isRequestPassThroughEnabled(record);
        const upstreamUpdateMeta = getUpstreamUpdateMeta(record);
        const pendingAddCount = upstreamUpdateMeta.pendingAddModels.length;
        const pendingRemoveCount =
          upstreamUpdateMeta.pendingRemoveModels.length;
        const showUpstreamUpdateTag =
          upstreamUpdateMeta.supported &&
          upstreamUpdateMeta.enabled &&
          (pendingAddCount > 0 || pendingRemoveCount > 0);
        const nameNode =
          record.remark && record.remark.trim() !== '' ? (
            <Tooltip
              content={
                <div className='flex flex-col gap-2 max-w-xs'>
                  <div className='text-sm'>{record.remark}</div>
                  <Button
                    size='sm'
                    variant='bordered'
                    color='primary'
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      navigator.clipboard
                        .writeText(record.remark)
                        .then(() => showSuccess(t('复制成功')))
                        .catch(() => showError(t('复制失败')));
                    }}
                  >
                    {t('复制')}
                  </Button>
                </div>
              }
              placement='top-start'
            >
              <span>{text}</span>
            </Tooltip>
          ) : (
            <span>{text}</span>
          );

        if (!passThroughEnabled && !showUpstreamUpdateTag) {
          return nameNode;
        }

        return (
          <span className='inline-flex flex-wrap items-center gap-1.5'>
            {nameNode}
            {passThroughEnabled && (
              <Tooltip
                content={t(
                  '该渠道已开启请求透传：参数覆写、模型重定向、渠道适配等 NewAPI 内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。',
                )}
                placement='top-start'
              >
                <span className='inline-flex items-center text-warning'>
                  <AlertTriangle size={14} />
                </span>
              </Tooltip>
            )}
            {showUpstreamUpdateTag && (
              <span className='inline-flex items-center gap-1'>
                {pendingAddCount > 0 ? (
                  <Tooltip content={t('点击处理新增模型')} placement='top'>
                    <StatusChip
                      tone='green'
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        openUpstreamUpdateModal(
                          record,
                          upstreamUpdateMeta.pendingAddModels,
                          upstreamUpdateMeta.pendingRemoveModels,
                          'add',
                        );
                      }}
                    >
                      +{pendingAddCount}
                    </StatusChip>
                  </Tooltip>
                ) : null}
                {pendingRemoveCount > 0 ? (
                  <Tooltip content={t('点击处理删除模型')} placement='top'>
                    <StatusChip
                      tone='red'
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        openUpstreamUpdateModal(
                          record,
                          upstreamUpdateMeta.pendingAddModels,
                          upstreamUpdateMeta.pendingRemoveModels,
                          'remove',
                        );
                      }}
                    >
                      -{pendingRemoveCount}
                    </StatusChip>
                  </Tooltip>
                ) : null}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text) => (
        <div className='flex flex-wrap items-center gap-1'>
          {text
            ?.split(',')
            .sort((a, b) => {
              if (a === 'default') return -1;
              if (b === 'default') return 1;
              return a.localeCompare(b);
            })
            .map((item) => renderGroup(item))}
        </div>
      ),
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record) => {
        if (record.children === undefined) {
          return <>{renderType(text, record, t)}</>;
        }
        return <>{renderTagType(t)}</>;
      },
    },
    {
      key: COLUMN_KEYS.STATUS,
      title: t('状态'),
      dataIndex: 'status',
      render: (text, record) => {
        if (text === 3) {
          if (record.other_info === '') record.other_info = '{}';
          let otherInfo = {};
          try {
            otherInfo = JSON.parse(record.other_info);
          } catch (error) {
            otherInfo = {};
          }
          const reason = otherInfo['status_reason'];
          const time = otherInfo['status_time'];
          return (
            <Tooltip
              content={
                t('原因：') + reason + t('，时间：') + timestamp2string(time)
              }
            >
              {renderStatus(text, record.channel_info, t)}
            </Tooltip>
          );
        }
        return renderStatus(text, record.channel_info, t);
      },
    },
    {
      key: COLUMN_KEYS.RESPONSE_TIME,
      title: t('响应时间'),
      dataIndex: 'response_time',
      render: (text) => renderResponseTime(text, t),
    },
    {
      key: COLUMN_KEYS.BALANCE,
      title: t('已用/剩余'),
      dataIndex: 'expired_time',
      render: (text, record) => {
        if (record.children === undefined) {
          return (
            <div className='inline-flex flex-wrap items-center gap-1'>
              <Tooltip content={t('已用额度')}>
                <StatusChip tone='white'>
                  {renderQuota(record.used_quota)}
                </StatusChip>
              </Tooltip>
              <Tooltip
                content={
                  record.type === 57
                    ? t('查看 Codex 帐号信息与用量')
                    : t('剩余额度') +
                      ': ' +
                      renderQuotaWithAmount(record.balance) +
                      t('，点击更新')
                }
              >
                <StatusChip
                  tone={record.type === 57 ? 'light-blue' : 'white'}
                  onClick={() => updateChannelBalance(record)}
                >
                  {record.type === 57
                    ? t('帐号信息')
                    : renderQuotaWithAmount(record.balance)}
                </StatusChip>
              </Tooltip>
            </div>
          );
        }
        return (
          <Tooltip content={t('已用额度')}>
            <StatusChip tone='white'>
              {renderQuota(record.used_quota)}
            </StatusChip>
          </Tooltip>
        );
      },
    },
    {
      key: COLUMN_KEYS.PRIORITY,
      title: t('优先级'),
      dataIndex: 'priority',
      render: (text, record) => {
        if (record.children === undefined) {
          return (
            <PriorityInput
              defaultValue={record.priority}
              min={-999}
              ariaLabel={t('优先级')}
              onBlur={(e) =>
                manageChannel(record.id, 'priority', record, e.target.value)
              }
            />
          );
        }
        return (
          <TagPriorityWeightInput
            field='priority'
            defaultValue={record.priority}
            record={record}
            t={t}
            submitTagEdit={submitTagEdit}
          />
        );
      },
    },
    {
      key: COLUMN_KEYS.WEIGHT,
      title: t('权重'),
      dataIndex: 'weight',
      render: (text, record) => {
        if (record.children === undefined) {
          return (
            <PriorityInput
              defaultValue={record.weight}
              min={0}
              ariaLabel={t('权重')}
              onBlur={(e) =>
                manageChannel(record.id, 'weight', record, e.target.value)
              }
            />
          );
        }
        return (
          <TagPriorityWeightInput
            field='weight'
            defaultValue={record.weight}
            record={record}
            t={t}
            submitTagEdit={submitTagEdit}
          />
        );
      },
    },
    {
      key: COLUMN_KEYS.OPERATE,
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record) => {
        if (record.children === undefined) {
          return (
            <ChannelOperateCell
              record={record}
              t={t}
              manageChannel={manageChannel}
              testChannel={testChannel}
              setCurrentTestChannel={setCurrentTestChannel}
              setShowModelTestModal={setShowModelTestModal}
              setEditingChannel={setEditingChannel}
              setShowEdit={setShowEdit}
              setCurrentMultiKeyChannel={setCurrentMultiKeyChannel}
              setShowMultiKeyManageModal={setShowMultiKeyManageModal}
              refresh={refresh}
              activePage={activePage}
              channels={channels}
              copySelectedChannel={copySelectedChannel}
              checkOllamaVersion={checkOllamaVersion}
              detectChannelUpstreamUpdates={detectChannelUpstreamUpdates}
              openUpstreamUpdateModal={openUpstreamUpdateModal}
              submitTagEdit={submitTagEdit}
            />
          );
        }
        return (
          <TagOperateCell
            record={record}
            t={t}
            manageTag={manageTag}
            setShowEditTag={setShowEditTag}
            setEditingTag={setEditingTag}
          />
        );
      },
    },
  ];
};
