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
import { Button, Chip, Tooltip } from '@heroui/react';
import { renderQuota, timestamp2string } from '../../../helpers';
import {
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_MAP,
  REDEMPTION_ACTIONS,
} from '../../../constants/redemption.constants';

/**
 * Check if redemption code is expired
 */
export const isExpired = (record) => {
  return (
    record.status === REDEMPTION_STATUS.UNUSED &&
    record.expired_time !== 0 &&
    record.expired_time < Math.floor(Date.now() / 1000)
  );
};

/**
 * Render timestamp
 */
const renderTimestamp = (timestamp) => {
  return <>{timestamp2string(timestamp)}</>;
};

/**
 * Render redemption code status
 */
const renderStatus = (status, record, t) => {
  if (isExpired(record)) {
    return (
      <Chip color='warning' size='sm' variant='flat'>
        {t('已过期')}
      </Chip>
    );
  }

  const statusConfig = REDEMPTION_STATUS_MAP[status];
  if (statusConfig) {
    return (
      <Chip color={toChipColor(statusConfig.color)} size='sm' variant='flat'>
        {t(statusConfig.text)}
      </Chip>
    );
  }

  return (
    <Chip size='sm' variant='flat'>
      {t('未知状态')}
    </Chip>
  );
};

const toChipColor = (color) => {
  const map = {
    green: 'success',
    red: 'danger',
    orange: 'warning',
    yellow: 'warning',
    blue: 'primary',
    grey: 'default',
    black: 'default',
  };
  return map[color] || 'default';
};

/**
 * Get redemption code table column definitions
 */
export const getRedemptionsColumns = ({
  t,
  manageRedemption,
  copyText,
  setEditingRedemption,
  setShowEdit,
  refresh,
  redemptions,
  activePage,
  showDeleteRedemptionModal,
}) => {
  return [
    {
      title: t('ID'),
      dataIndex: 'id',
    },
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record) => {
        return <div>{renderStatus(text, record, t)}</div>;
      },
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      render: (text) => {
        return (
          <div>
            <Chip size='sm' variant='flat'>
              {renderQuota(parseInt(text))}
            </Chip>
          </div>
        );
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (text) => {
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      render: (text) => {
        return <div>{text === 0 ? t('永不过期') : renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('兑换人ID'),
      dataIndex: 'used_user_id',
      render: (text) => {
        return <div>{text === 0 ? t('无') : text}</div>;
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 205,
      render: (text, record) => {
        const canToggle = !isExpired(record);
        const isUnused = record.status === REDEMPTION_STATUS.UNUSED;

        return (
          <div className='flex flex-wrap items-center gap-1.5'>
            <Tooltip
              content={record.key}
              placement='top'
            >
              <Button variant='flat' size='sm'>
                {t('查看')}
              </Button>
            </Tooltip>
            <Button
              size='sm'
              variant='flat'
              onPress={async () => {
                await copyText(record.key);
              }}
            >
              {t('复制')}
            </Button>
            <Button
              variant='flat'
              size='sm'
              onPress={() => {
                setEditingRedemption(record);
                setShowEdit(true);
              }}
              isDisabled={record.status !== REDEMPTION_STATUS.UNUSED}
            >
              {t('编辑')}
            </Button>
            {canToggle ? (
              <Button
                size='sm'
                variant='flat'
                color={isUnused ? 'warning' : 'primary'}
                onPress={() =>
                  manageRedemption(
                    record.id,
                    isUnused
                      ? REDEMPTION_ACTIONS.DISABLE
                      : REDEMPTION_ACTIONS.ENABLE,
                    record,
                  )
                }
                isDisabled={!isUnused && record.status === REDEMPTION_STATUS.USED}
              >
                {isUnused ? t('禁用') : t('启用')}
              </Button>
            ) : null}
            <Button
              size='sm'
              variant='flat'
              color='danger'
              onPress={() => showDeleteRedemptionModal(record)}
            >
              {t('删除')}
            </Button>
          </div>
        );
      },
    },
  ];
};
