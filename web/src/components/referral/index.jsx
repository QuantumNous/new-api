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
  BarChart2,
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
      tone: 'violet',
    },
    {
      key: 'available',
      icon: Gift,
      label: t('可用邀请额度'),
      value: renderQuota(affQuota),
      tone: 'emerald',
    },
    {
      key: 'history',
      icon: TrendingUp,
      label: t('累计邀请收益'),
      value: renderQuota(affHistoryQuota),
      tone: 'amber',
    },
    {
      key: 'code',
      icon: Sparkles,
      label: t('邀请码'),
      value: affCode,
      tone: 'rose',
    },
  ];
  const rewardRules = [
    t('邀请好友注册，好友充值后您可获得相应奖励'),
    t('通过划转功能将奖励额度转入到您的账户余额中'),
    t('邀请的好友越多，获得的奖励越多'),
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
          <p className='referral-subtitle'>
            {t('邀请好友注册并完成充值后，奖励会自动累计到您的邀请额度中')}
          </p>
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
          <div className='referral-eyebrow'>
            <Gift size={15} />
            <span>{t('推广计划')}</span>
          </div>
          <h3 className='referral-hero-title'>
            {t('分享邀请链接，持续获得奖励')}
          </h3>
          <p className='referral-hero-description'>
            {t(
              '复制专属链接分享给好友，好友完成注册并充值后，奖励将自动进入您的邀请账户。',
            )}
          </p>

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

          <div className='referral-chip-row'>
            <div className='referral-chip'>
              <span>{t('邀请码')}</span>
              <strong>{affCode}</strong>
            </div>
            <div className='referral-chip'>
              <span>{t('邀请人数')}</span>
              <strong>{affCount}</strong>
            </div>
          </div>
        </div>

        <div className='referral-hero-side'>
          <div className='referral-spotlight'>
            <span className='referral-spotlight-label'>
              {t('当前可划转奖励')}
            </span>
            <strong className='referral-spotlight-value'>
              {renderQuota(affQuota)}
            </strong>
            <p className='referral-spotlight-note'>
              {t('满足最低划转额度后，可直接转入余额继续消费。')}
            </p>
          </div>

          <div className='referral-action-row'>
            <Button
              type='primary'
              className='referral-primary-button'
              icon={<Copy size={16} />}
              onClick={handleAffLinkClick}
            >
              {t('复制邀请链接')}
            </Button>
            <Button
              theme='outline'
              className='referral-outline-button'
              icon={<Sparkles size={16} />}
              disabled={!affQuota || affQuota <= 0}
              onClick={() => setOpenTransfer(true)}
            >
              {t('划转到余额')}
            </Button>
          </div>
        </div>
      </Card>

      <div className='referral-grid'>
        <Card className='referral-card referral-link-card'>
          <div className='referral-section-head'>
            <div className='referral-section-icon referral-section-icon-link'>
              <Share2 size={16} strokeWidth={2.1} />
            </div>
            <div>
              <h3>{t('邀请链接')}</h3>
              <p>{t('复制链接并分享给好友完成注册')}</p>
            </div>
          </div>

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

          <p className='referral-link-note'>
            {t('好友通过该链接注册并充值后，奖励会自动发放到您的邀请账户。')}
          </p>
        </Card>

        <Card className='referral-card referral-rules-card'>
          <div className='referral-section-head'>
            <div className='referral-section-icon referral-section-icon-rules'>
              <Users size={16} strokeWidth={2.1} />
            </div>
            <div>
              <h3>{t('奖励说明')}</h3>
              <p>{t('按步骤了解奖励发放与划转方式')}</p>
            </div>
          </div>

          <div className='referral-rules-list'>
            {rewardRules.map((item, index) => (
              <div className='referral-rule-item' key={item}>
                <div className='referral-rule-index'>{index + 1}</div>
                <div className='referral-rule-copy'>{item}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className='referral-card referral-stats-card'>
          <div className='referral-section-head'>
            <div className='referral-section-icon referral-section-icon-stats'>
              <BarChart2 size={16} strokeWidth={2.1} />
            </div>
            <div>
              <h3>{t('收益统计')}</h3>
              <p>{t('用更清晰的卡片查看邀请表现和奖励累积')}</p>
            </div>
          </div>

          <div className='referral-stats-grid'>
            {stats.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  className={`referral-stat-card referral-stat-${item.tone}`}
                  key={item.key}
                >
                  <div className='referral-stat-top'>
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </div>
                  <div className='referral-stat-value'>{item.value}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Referral;
