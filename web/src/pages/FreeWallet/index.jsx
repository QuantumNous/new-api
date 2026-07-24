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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Typography, Button, Empty } from '@douyinfe/semi-ui';
import { ArrowLeft } from 'lucide-react';
import {
  API,
  showError,
  renderQuota,
  timestamp2string,
} from '../../helpers';

// 免费额度过期哨兵值，与后端 model.FreeQuotaNeverExpire 一致（永不过期）。
const FREE_QUOTA_NEVER_EXPIRE = 9999999999;

const FreeWallet = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState([]);

  const loadLedgers = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/self/free_quota/ledgers');
      const { success, message, data } = res.data;
      if (success) {
        setLedgers(Array.isArray(data) ? data : []);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgers();
  }, []);

  const sourceMeta = {
    checkin: { text: t('签到奖励'), color: 'green' },
    topup_gift: { text: t('充值赠送'), color: 'blue' },
    redemption: { text: t('免费兑换码'), color: 'violet' },
    admin: { text: t('管理员发放'), color: 'orange' },
  };

  const statusMeta = {
    1: { text: t('生效中'), color: 'green' },
    2: { text: t('已用完'), color: 'grey' },
    3: { text: t('已过期'), color: 'red' },
  };

  const columns = [
    {
      title: t('来源'),
      dataIndex: 'source',
      render: (source) => {
        const m = sourceMeta[source] || { text: source, color: 'grey' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: t('入账额度'),
      dataIndex: 'amount',
      render: (amount) => renderQuota(amount),
    },
    {
      title: t('剩余额度'),
      dataIndex: 'remaining',
      render: (remaining) => renderQuota(remaining),
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      render: (expiredTime) => {
        if (!expiredTime || expiredTime >= FREE_QUOTA_NEVER_EXPIRE) {
          return <Tag color='cyan'>{t('永不过期')}</Tag>;
        }
        return timestamp2string(expiredTime);
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (status) => {
        const m = statusMeta[status] || { text: status, color: 'grey' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: t('入账时间'),
      dataIndex: 'created_time',
      render: (createdTime) =>
        createdTime ? timestamp2string(createdTime) : '-',
    },
  ];

  return (
    <div
      className='wallet-page console-finance-command-page console-command-center topup-command-center w-full relative min-h-screen lg:min-h-0 mt-[60px]'
      style={{ width: '100%', minHeight: '100vh' }}
    >
      <div className='console-dashboard-orb console-dashboard-orb-teal' />
      <div className='console-dashboard-orb console-dashboard-orb-blue' />
      <div className='console-dashboard-orb console-dashboard-orb-amber' />
      <div className='console-finance-command-content'>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Button
            icon={<ArrowLeft size={16} />}
            theme='borderless'
            type='tertiary'
            onClick={() => navigate('/console/topup')}
          >
            {t('返回')}
          </Button>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {t('免费钱包明细')}
          </Typography.Title>
        </div>
        <Card>
          <Table
            columns={columns}
            dataSource={ledgers}
            loading={loading}
            rowKey='id'
            pagination={{ pageSize: 20 }}
            empty={<Empty description={t('暂无免费额度明细')} />}
          />
        </Card>
      </div>
    </div>
  );
};

export default FreeWallet;
