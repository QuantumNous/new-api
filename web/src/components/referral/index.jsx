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
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Typography,
} from '@douyinfe/semi-ui';
import {
  BarChart2,
  Copy,
  Gift,
  Link as LinkIcon,
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

  useEffect(() => {
    getUserQuota().then();
    getAffLink().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  const username = userState?.user?.username || '-';
  const userInitial = username?.[0]?.toUpperCase() || 'U';

  return (
    <div className='personal-settings-shell referral-page-shell'>
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

      <div className='personal-settings-page-header'>
        <Title heading={2} className='personal-settings-page-title'>
          {t('邀请奖励')}
        </Title>
        <p className='personal-settings-page-subtitle'>
          {t('管理您的邀请链接、收益统计和奖励划转')}
        </p>
      </div>

      <div className='personal-settings-stack'>
        <Card className='personal-settings-surface personal-settings-overview referral-overview-card'>
          <div className='personal-settings-card-head'>
            <div className='personal-settings-card-title-row'>
              <span className='personal-settings-card-icon'>
                <Gift size={16} strokeWidth={2.1} />
              </span>
              <div>
                <h2 className='personal-settings-card-title'>
                  {t('邀请信息')}
                </h2>
                <p className='personal-settings-card-subtitle'>
                  {t('邀请好友注册，好友充值后您可获得相应奖励')}
                </p>
              </div>
            </div>
          </div>

          <div className='personal-settings-overview-grid referral-overview-grid'>
            <div className='personal-settings-profile-panel'>
              <div className='personal-settings-profile-top'>
                <Avatar
                  size='large'
                  color={stringToColor(username)}
                  className='personal-settings-profile-avatar'
                >
                  {userInitial}
                </Avatar>
                <div className='personal-settings-profile-copy'>
                  <div className='personal-settings-profile-name'>
                    {username}
                  </div>
                  <div className='personal-settings-profile-meta'>
                    <span className='personal-settings-profile-dot' />
                    {t('推广伙伴')}
                  </div>
                </div>
              </div>

              <div className='personal-settings-detail-list'>
                <div className='personal-settings-detail-row'>
                  <span className='personal-settings-detail-label'>
                    {t('邀请码')}
                  </span>
                  <div className='personal-settings-detail-value-wrap'>
                    <span className='personal-settings-detail-value'>
                      {userState?.user?.aff_code || '-'}
                    </span>
                  </div>
                </div>
                <div className='personal-settings-detail-row'>
                  <span className='personal-settings-detail-label'>
                    {t('邀请人数')}
                  </span>
                  <div className='personal-settings-detail-value-wrap'>
                    <span className='personal-settings-detail-value'>
                      {userState?.user?.aff_count || 0}
                    </span>
                  </div>
                </div>
                <div className='personal-settings-detail-row'>
                  <span className='personal-settings-detail-label'>
                    {t('可用邀请额度')}
                  </span>
                  <div className='personal-settings-detail-value-wrap'>
                    <span className='personal-settings-detail-value referral-accent-value'>
                      {renderQuota(userState?.user?.aff_quota || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className='personal-settings-quota-panel'>
              <div className='personal-settings-quota-label'>
                {t('收益统计')}
              </div>
              <div className='personal-settings-metric-grid'>
                <div className='personal-settings-metric-card personal-settings-metric-balance'>
                  <div className='personal-settings-metric-top'>
                    <TrendingUp size={15} />
                    <span>{t('待使用收益')}</span>
                  </div>
                  <div className='personal-settings-metric-value'>
                    {renderQuota(userState?.user?.aff_quota || 0)}
                  </div>
                </div>
                <div className='personal-settings-metric-card personal-settings-metric-used'>
                  <div className='personal-settings-metric-top'>
                    <BarChart2 size={15} />
                    <span>{t('总收益')}</span>
                  </div>
                  <div className='personal-settings-metric-value'>
                    {renderQuota(userState?.user?.aff_history_quota || 0)}
                  </div>
                </div>
              </div>

              <div className='personal-settings-requests-card referral-count-card'>
                <div className='personal-settings-requests-top'>
                  <span>{t('邀请人数')}</span>
                  <strong>{userState?.user?.aff_count || 0}</strong>
                </div>
                <div className='personal-settings-requests-track'>
                  <div
                    className='personal-settings-requests-fill'
                    style={{
                      width: `${Math.min(userState?.user?.aff_count || 0, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <Button
                type='primary'
                className='personal-settings-primary-button personal-settings-cta-button'
                disabled={
                  !userState?.user?.aff_quota || userState?.user?.aff_quota <= 0
                }
                onClick={() => setOpenTransfer(true)}
              >
                <Sparkles size={16} />
                {t('划转到余额')}
              </Button>
            </div>
          </div>
        </Card>

        <Card className='personal-settings-surface personal-settings-section-card referral-link-card'>
          <div className='personal-settings-card-head'>
            <div className='personal-settings-card-title-row'>
              <span className='personal-settings-card-icon'>
                <Share2 size={16} strokeWidth={2.1} />
              </span>
              <div>
                <h2 className='personal-settings-card-title'>
                  {t('邀请链接')}
                </h2>
                <p className='personal-settings-card-subtitle'>
                  {t('复制链接并分享给好友完成注册')}
                </p>
              </div>
            </div>
          </div>

          <div className='referral-link-input-row'>
            <Input
              value={affLink}
              readOnly
              prefix={<LinkIcon size={16} />}
              className='referral-link-input'
            />
            <Button
              type='primary'
              className='personal-settings-primary-button referral-copy-button'
              onClick={handleAffLinkClick}
            >
              <Copy size={16} />
              {t('复制')}
            </Button>
          </div>
        </Card>

        <Card className='personal-settings-surface personal-settings-section-card referral-rules-card'>
          <div className='personal-settings-card-head'>
            <div className='personal-settings-card-title-row'>
              <span className='personal-settings-card-icon'>
                <Users size={16} strokeWidth={2.1} />
              </span>
              <div>
                <h2 className='personal-settings-card-title'>
                  {t('奖励说明')}
                </h2>
                <p className='personal-settings-card-subtitle'>
                  {t('邀请的好友越多，获得的奖励越多')}
                </p>
              </div>
            </div>
          </div>

          <div className='referral-rules-list'>
            {[
              t('邀请好友注册，好友充值后您可获得相应奖励'),
              t('通过划转功能将奖励额度转入到您的账户余额中'),
              t('邀请的好友越多，获得的奖励越多'),
            ].map((item) => (
              <div className='referral-rule-item' key={item}>
                <Badge dot type='success' />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Referral;
