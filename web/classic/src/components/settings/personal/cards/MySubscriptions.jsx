import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, Empty, Button } from '@douyinfe/semi-ui';
import { API, showError } from '../../../../helpers';

const { Text, Title } = Typography;

const MySubscriptions = ({ t }) => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/self');
      const { success, data, message } = res.data;
      if (success) {
        setSubscriptions(data?.subscriptions || []);
      } else {
        showError(message || t('获取订阅信息失败'));
      }
    } catch (e) {
      showError(e.message || t('获取订阅信息失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  const formatQuota = (amount) => {
    if (!amount) return '0';
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return String(amount);
  };

  const getStatusTag = (s) => {
    const now = Date.now() / 1000;
    const isExpired = (s.end_time || 0) > 0 && (s.end_time || 0) < now;
    const isActive = s.status === 'active' && !isExpired;
    if (isActive) return <Tag color="green" size="small">{t('生效中')}</Tag>;
    if (s.status === 'cancelled') return <Tag color="red" size="small">{t('已取消')}</Tag>;
    return <Tag color="grey" size="small">{t('已过期')}</Tag>;
  };

  const getSourceLabel = (source) => {
    switch (source) {
      case 'bind_group':
        return t('分组绑定');
      case 'order':
        return t('购买');
      case 'admin':
        return t('管理员分配');
      default:
        return source || '-';
    }
  };

  const renderSubscription = (item, index) => {
    const s = item.subscription || {};
    const plan = item.plan || {};
    const remaining = (s.amount_total || 0) - (s.amount_used || 0);
    const percent = s.amount_total > 0 ? ((s.amount_used / s.amount_total) * 100).toFixed(1) : 0;

    return (
      <div
        key={s.id || index}
        className="border rounded-xl p-4 hover:shadow-sm transition-shadow"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusTag(s)}
            <Text className="text-xs text-gray-500">
              {getSourceLabel(s.source)}
            </Text>
          </div>
          <Text className="text-xs text-gray-400">
            {plan.title || (t('套餐') + ' #' + s.plan_id)}
          </Text>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <div className="text-xs text-gray-500">{t('总额度')}</div>
            <div className="font-medium text-sm">{formatQuota(s.amount_total)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('已用')}</div>
            <div className="font-medium text-sm">{formatQuota(s.amount_used)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('剩余')}</div>
            <div className="font-medium text-sm text-green-600">{formatQuota(remaining)}</div>
          </div>
        </div>

        {s.amount_total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(parseFloat(percent), 100)}%` }}
            />
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-400">
          <span>{t('开始')}: {formatTime(s.start_time)}</span>
          <span>{t('到期')}: {s.end_time ? formatTime(s.end_time) : t('永久')}</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="!rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title heading={6} className="!mb-0">{t('我的订阅')}</Title>
          <Text className="text-xs text-gray-500">{t('当前生效的订阅套餐详情')}</Text>
        </div>
        <Button size="small" theme="outline" onClick={loadSubscriptions} loading={loading}>
          {t('刷新')}
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <Empty
          description={t('暂无订阅')}
          style={{ padding: '20px 0' }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {subscriptions.map((s, i) => renderSubscription(s, i))}
        </div>
      )}
    </Card>
  );
};

export default MySubscriptions;
