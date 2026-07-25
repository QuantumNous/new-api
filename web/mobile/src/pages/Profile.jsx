import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, List, NavBar } from 'antd-mobile';

import { UserContext } from '@classic/context/User';
import { API, updateAPI } from '@classic/helpers/api';

import { isAdmin, showError, showSuccess } from '../shims/classic-utils';
import { pointsEnabled, renderPoints, renderQuota } from '../utils/quota';

const Profile = () => {
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);
  const [self, setSelf] = useState(null);
  const [checkinEnabled, setCheckinEnabled] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [ticketUnread, setTicketUnread] = useState(0);
  // 管理员待办角标：{kyc, enterprise, bank_transfer, invoice} + 工单未读
  const [pendingCounts, setPendingCounts] = useState(null);
  const [adminTicketUnread, setAdminTicketUnread] = useState(0);
  const admin = isAdmin();

  const loadSelf = useCallback(async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res.data.success) setSelf(res.data.data);
    } catch (e) {
      showError(e);
    }
  }, []);

  const loadCheckin = useCallback(async () => {
    try {
      const res = await API.get('/api/user/checkin', {
        skipErrorHandler: true,
      });
      if (res.data.success) {
        setCheckinEnabled(!!res.data.data?.enabled);
        setCheckedInToday(!!res.data.data?.stats?.checked_in_today);
      }
    } catch (e) {
      // 签到未启用时静默
    }
  }, []);

  const loadBadges = useCallback(async () => {
    try {
      const res = await API.get('/api/user/feedback/unread', {
        skipErrorHandler: true,
      });
      if (res.data.success) {
        setTicketUnread(res.data.data?.unread || 0);
      }
    } catch (e) {
      // 静默
    }
    if (isAdmin()) {
      try {
        const [countsRes, unreadRes] = await Promise.all([
          API.get('/api/user/review/pending_counts', { skipErrorHandler: true }),
          API.get('/api/user/feedback/admin/unread', { skipErrorHandler: true }),
        ]);
        if (countsRes.data.success) setPendingCounts(countsRes.data.data);
        if (unreadRes.data.success) {
          setAdminTicketUnread(
            unreadRes.data.data?.unread ?? unreadRes.data.data ?? 0,
          );
        }
      } catch (e) {
        // 静默
      }
    }
  }, []);

  useEffect(() => {
    loadSelf();
    loadCheckin();
    loadBadges();
  }, [loadSelf, loadCheckin, loadBadges]);

  const badge = (n) =>
    n > 0 ? <span className='m-badge danger'>{n}</span> : null;

  const handleCheckin = async () => {
    try {
      const res = await API.post('/api/user/checkin');
      const { success, message } = res.data;
      if (success) {
        showSuccess('签到成功！');
        setCheckedInToday(true);
        loadSelf();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleLogout = async () => {
    const confirmed = await Dialog.confirm({ content: '确定退出登录吗？' });
    if (!confirmed) return;
    try {
      await API.get('/api/user/logout');
    } catch (e) {
      // 即使接口失败也清理本地状态
    }
    localStorage.removeItem('user');
    userDispatch({ type: 'logout' });
    updateAPI();
    navigate('/login', { replace: true });
  };

  const user = self || userState?.user || {};

  return (
    <div>
      <NavBar back={null}>我的</NavBar>
      <div style={{ padding: 12 }}>
        <div
          className='m-hero'
          style={{ display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(user.display_name || user.username || '?')[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {user.display_name || user.username}
            </div>
            {self && (
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                剩余额度 {renderQuota(self.quota)} · 已用{' '}
                {renderQuota(self.used_quota)}
                {pointsEnabled() &&
                  ` · 积分 ${renderPoints(self.points_balance)}（已用 ${renderPoints(self.points_used)}）`}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='m-section-title'>账户</div>
      <List
        className='m-list-card'
        style={{ '--border-top': 'none', '--border-bottom': 'none' }}
      >
        {checkinEnabled && (
          <List.Item
            extra={checkedInToday ? '今日已签到' : ''}
            onClick={checkedInToday ? undefined : handleCheckin}
          >
            每日签到
          </List.Item>
        )}
        <List.Item onClick={() => navigate('/tokens')}>令牌管理</List.Item>
        <List.Item onClick={() => navigate('/logs')}>使用日志</List.Item>
        <List.Item extra={badge(ticketUnread)} onClick={() => navigate('/tickets')}>
          我的工单
        </List.Item>
        <List.Item onClick={() => navigate('/setting')}>账户设置</List.Item>
        <List.Item
          description='移动端暂不支持充值'
          onClick={() =>
            Dialog.alert({
              content: '请在电脑浏览器打开本站，进入「控制台 → 充值」完成充值。',
            })
          }
        >
          充值说明
        </List.Item>
      </List>

      {admin && (
        <>
          <div className='m-section-title'>管理</div>
          <List
            className='m-list-card'
            style={{ '--border-top': 'none', '--border-bottom': 'none' }}
          >
            <List.Item
              extra={badge(adminTicketUnread)}
              onClick={() => navigate('/admin/tickets')}
            >
              工单管理
            </List.Item>
            <List.Item
              extra={badge(pendingCounts?.kyc)}
              onClick={() => navigate('/admin/kyc')}
            >
              实名认证审批
            </List.Item>
            <List.Item
              extra={badge(pendingCounts?.enterprise)}
              onClick={() => navigate('/admin/enterprise')}
            >
              企业认证审批
            </List.Item>
            <List.Item
              extra={badge(pendingCounts?.bank_transfer)}
              onClick={() => navigate('/admin/transfers')}
            >
              企业转账审核
            </List.Item>
            <List.Item
              extra={badge(pendingCounts?.invoice)}
              onClick={() => navigate('/admin/invoices')}
            >
              企业开票审核
            </List.Item>
          </List>
        </>
      )}

      <div style={{ padding: 16 }}>
        <Button block color='danger' fill='outline' onClick={handleLogout}>
          退出登录
        </Button>
      </div>
    </div>
  );
};

export default Profile;
