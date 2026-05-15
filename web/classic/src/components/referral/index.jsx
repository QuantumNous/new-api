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

import React, { useContext, useEffect, useState } from 'react';
import { Avatar, Button, Card, Input, Typography } from '@douyinfe/semi-ui';
import {
  Copy,
  Gift,
  Link as LinkIcon,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  API,
  copy,
  getQuotaPerUnit,
  renderQuota,
  showError,
  showSuccess,
  stringToColor,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { useTranslation } from 'react-i18next';
import TransferModal from '../topup/modals/TransferModal';

const { Title } = Typography;

const Referral = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  const getUserQuota = async () => {
    const res = await API.get('/api/user/self');
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const getAffLink = async () => {
    const res = await API.get('/api/user/aff');
    const { success, message, data } = res.data;
    if (success) {
      setAffLink(`${window.location.origin}/register?aff=${data}`);
    } else {
      showError(message);
    }
  };

  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }

    const res = await API.post('/api/user/aff_transfer', {
      quota: transferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenTransfer(false);
      getUserQuota().then();
    } else {
      showError(message);
    }
  };

  const handleAffLinkClick = async () => {
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  const loadReferralData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([getUserQuota(), getAffLink()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReferralData().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  const username = userState?.user?.username || '-';
  const userInitial = username?.[0]?.toUpperCase() || 'U';
  const affCode = userState?.user?.aff_code || '-';
  const affCount = userState?.user?.aff_count || 0;
  const affQuota = userState?.user?.aff_quota || 0;
  const affHistoryQuota = userState?.user?.aff_history_quota || 0;
  const stats = [
    {
      key: 'count',
      icon: Users,
      label: t('邀请人数'),
      value: affCount,
    },
    {
      key: 'available',
      icon: Gift,
      label: t('可用邀请额度'),
      value: renderQuota(affQuota),
    },
    {
      key: 'history',
      icon: TrendingUp,
      label: t('累计邀请收益'),
      value: renderQuota(affHistoryQuota),
    },
    {
      key: 'code',
      icon: Sparkles,
      label: t('邀请码'),
      value: affCode,
    },
  ];

  return (
    <div className='referral-shell'>
      <TransferModal
        t={t}
        openTransfer={openTransfer}
        transfer={transfer}
        handleTransferCancel={() => setOpenTransfer(false)}
        userState={userState}
        renderQuota={renderQuota}
        getQuotaPerUnit={getQuotaPerUnit}
        transferAmount={transferAmount}
        setTransferAmount={setTransferAmount}
      />

      <div className='referral-header'>
        <div>
          <Title heading={2} className='referral-title'>
            {t('邀请奖励')}
          </Title>
        </div>
        <Button
          theme='outline'
          icon={<RefreshCw size={15} />}
          loading={refreshing}
          className='referral-refresh-button'
          onClick={loadReferralData}
        >
          {t('刷新')}
        </Button>
      </div>

      <Card className='referral-card referral-hero-card'>
        <div className='referral-hero-copy'>
          <div className='referral-identity'>
            <Avatar
              size='large'
              color={stringToColor(username)}
              className='referral-identity-avatar'
            >
              {userInitial}
            </Avatar>
            <div>
              <div className='referral-identity-name'>{username}</div>
              <div className='referral-identity-meta'>{t('推广伙伴')}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className='referral-card referral-link-card'>
        <div className='referral-link-input-row'>
          <Input
            value={affLink}
            readOnly
            prefix={<LinkIcon size={16} className='mx-3' />}
            className='referral-share-input'
          />
          <Button
            type='primary'
            className='referral-primary-button referral-copy-button'
            onClick={handleAffLinkClick}
          >
            <Copy size={16} className='mr-[8px]' />
            {t('复制')}
          </Button>
        </div>
      </Card>

      <div className='referral-grid'>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key} className='referral-card'>
              <div className='flex items-center gap-3'>
                <Icon size={18} />
                <div>
                  <div>{stat.label}</div>
                  <div>{stat.value}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className='mt-4'>
        <Button
          theme='outline'
          disabled={!affQuota || affQuota <= 0}
          onClick={() => setOpenTransfer(true)}
        >
          {t('划转到余额')}
        </Button>
      </div>
    </div>
  );
};

export default Referral;
