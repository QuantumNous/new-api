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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { CheckCircle2, Clock3, QrCode, RefreshCw, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { API } from '../../helpers';

const { Text, Title } = Typography;

const POLL_INTERVAL_MS = 3000;
const CLOSE_DELAY_MS = 800;
const SUCCESS_MESSAGE_TYPE = 'newapi:alipay-f2f-success';

const normalizeReturnTo = (raw) => {
  if (!raw) {
    return '/console/topup';
  }
  try {
    const targetUrl = new URL(raw, window.location.origin);
    if (targetUrl.origin !== window.location.origin) {
      return '/console/topup';
    }
    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  } catch (error) {
    return '/console/topup';
  }
};

const statusConfigMap = {
  pending: { color: 'blue', label: '待支付', icon: <Clock3 size={16} /> },
  success: {
    color: 'green',
    label: '支付成功',
    icon: <CheckCircle2 size={16} />,
  },
  expired: { color: 'red', label: '已过期', icon: <XCircle size={16} /> },
  failed: { color: 'red', label: '支付失败', icon: <XCircle size={16} /> },
};

const AlipayPayment = () => {
  const { tradeNo } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const successHandledRef = useRef(false);

  const queryReturnTo = useMemo(
    () => normalizeReturnTo(searchParams.get('return_to')),
    [searchParams],
  );

  const loadOrder = async (silent = false) => {
    if (!tradeNo) {
      setError('订单号不能为空');
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await API.get(`/api/payment/alipay/order/${tradeNo}`, {
        params: {
          return_to: queryReturnTo,
        },
      });
      if (res.data?.success) {
        setDetail(res.data.data);
        setError('');
      } else {
        setError(res.data?.message || '获取订单信息失败');
      }
    } catch (err) {
      if (!silent) {
        setError('获取订单信息失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [tradeNo, queryReturnTo]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!detail || detail.status !== 'pending') {
      return undefined;
    }
    const timer = window.setInterval(() => {
      loadOrder(true);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [detail?.status, tradeNo, queryReturnTo]);

  useEffect(() => {
    if (!detail || detail.status !== 'success' || successHandledRef.current) {
      return;
    }
    successHandledRef.current = true;

    const returnTo = normalizeReturnTo(detail.return_to || queryReturnTo);
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: SUCCESS_MESSAGE_TYPE,
            tradeNo: detail.trade_no,
            scene: detail.scene,
            returnTo,
          },
          window.location.origin,
        );
        window.opener.focus?.();
      }
    } catch (error) {
      // ignore cross-window errors
    }

    const closeTimer = window.setTimeout(() => {
      try {
        window.close();
      } catch (error) {
        // ignore
      }
      const fallbackTimer = window.setTimeout(() => {
        window.location.replace(returnTo);
      }, 300);
      return () => window.clearTimeout(fallbackTimer);
    }, CLOSE_DELAY_MS);

    return () => {
      window.clearTimeout(closeTimer);
    };
  }, [detail, queryReturnTo]);

  const returnTo = normalizeReturnTo(detail?.return_to || queryReturnTo);
  const remainingSeconds = detail?.expires_at
    ? Math.max(0, Math.ceil((detail.expires_at * 1000 - now) / 1000))
    : 0;
  const statusConfig =
    statusConfigMap[detail?.status] || statusConfigMap.pending;

  return (
    <div className='min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50'>
      <Card className='w-full max-w-3xl !rounded-3xl shadow-sm border-0'>
        {loading ? (
          <div className='py-16 flex justify-center'>
            <Spin size='large' />
          </div>
        ) : error ? (
          <Empty
            image={<XCircle size={72} className='text-red-500 mx-auto' />}
            description={error}
          >
            <Button type='primary' onClick={() => loadOrder()}>
              重新加载
            </Button>
          </Empty>
        ) : (
          <div className='grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start'>
            <div className='rounded-3xl bg-white border border-slate-200 p-6 flex flex-col items-center'>
              <div className='w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4'>
                <QrCode size={28} />
              </div>
              <Title heading={4} style={{ marginBottom: 8 }}>
                支付宝当面付
              </Title>
              <Text type='tertiary'>请使用支付宝扫码完成支付</Text>
              <div className='mt-6 p-4 rounded-2xl bg-white border border-slate-200'>
                {detail?.qr_code ? (
                  <QRCodeSVG
                    value={detail.qr_code}
                    size={240}
                    level='M'
                    includeMargin
                  />
                ) : (
                  <div className='w-[240px] h-[240px] flex items-center justify-center text-slate-400'>
                    二维码生成中
                  </div>
                )}
              </div>
              <Space spacing={8} className='mt-6'>
                <Tag color={statusConfig.color} prefixIcon={statusConfig.icon}>
                  {statusConfig.label}
                </Tag>
                {detail?.status === 'pending' && remainingSeconds > 0 && (
                  <Tag color='blue'>剩余 {remainingSeconds}s</Tag>
                )}
              </Space>
            </div>

            <div className='space-y-4'>
              <div>
                <Text type='tertiary'>订单标题</Text>
                <Title heading={4} style={{ marginTop: 8, marginBottom: 0 }}>
                  {detail?.title || '支付宝订单'}
                </Title>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Card
                  className='!rounded-2xl bg-slate-50 border-0'
                  bodyStyle={{ padding: 16 }}
                >
                  <Text type='tertiary'>订单号</Text>
                  <div className='mt-2 break-all font-medium'>
                    {detail?.trade_no}
                  </div>
                </Card>
                <Card
                  className='!rounded-2xl bg-slate-50 border-0'
                  bodyStyle={{ padding: 16 }}
                >
                  <Text type='tertiary'>支付金额</Text>
                  <div className='mt-2 text-2xl font-semibold text-emerald-600'>
                    {Number(detail?.amount || 0).toFixed(2)}
                  </div>
                </Card>
              </div>

              <Card
                className='!rounded-2xl bg-slate-50 border-0'
                bodyStyle={{ padding: 16 }}
              >
                <Space vertical spacing={12} style={{ width: '100%' }}>
                  <div className='flex items-center justify-between gap-3'>
                    <Text type='tertiary'>订单状态</Text>
                    <Tag
                      color={statusConfig.color}
                      prefixIcon={statusConfig.icon}
                    >
                      {statusConfig.label}
                    </Tag>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <Text type='tertiary'>支付场景</Text>
                    <Text>
                      {detail?.scene === 'subscription'
                        ? '订阅购买'
                        : '余额充值'}
                    </Text>
                  </div>
                  {detail?.trade_status && (
                    <div className='flex items-center justify-between gap-3'>
                      <Text type='tertiary'>支付宝状态</Text>
                      <Text>{detail.trade_status}</Text>
                    </div>
                  )}
                  {detail?.expires_at > 0 && (
                    <div className='flex items-center justify-between gap-3'>
                      <Text type='tertiary'>过期时间</Text>
                      <Text>
                        {new Date(detail.expires_at * 1000).toLocaleString()}
                      </Text>
                    </div>
                  )}
                </Space>
              </Card>

              <Space wrap>
                {detail?.status === 'pending' && (
                  <Button
                    icon={<RefreshCw size={14} />}
                    onClick={() => loadOrder(true)}
                  >
                    刷新状态
                  </Button>
                )}
                <Button
                  type='primary'
                  onClick={() => window.location.replace(returnTo)}
                >
                  {detail?.status === 'success' ? '返回来源页' : '稍后返回'}
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AlipayPayment;
