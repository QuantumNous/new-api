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

import React, { useEffect, useState, useContext } from 'react';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  renderQuota,
  renderQuotaWithAmount,
  copy,
  getQuotaPerUnit,
} from '../../helpers';
import {
  Avatar,
  Typography,
  Card,
  Button,
  Modal,
  Toast,
  Input,
  InputNumber,
  Banner,
  Skeleton,
  Divider,
} from '@douyinfe/semi-ui';
import { SiAlipay, SiWechat } from 'react-icons/si';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status/index.js';
import { useTheme } from '../../context/Theme';
import {
  CreditCard,
  Gift,
  Link as LinkIcon,
  Copy,
  Users,
  User,
  Coins,
} from 'lucide-react';

const { Text, Title } = Typography;

const TopUp = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const theme = useTheme();

  const [redemptionCode, setRedemptionCode] = useState('');
  const [topUpCode, setTopUpCode] = useState('');
  const [amount, setAmount] = useState(0.0);
  const [minTopUp, setMinTopUp] = useState(statusState?.status?.min_topup || 1);
  const [topUpCount, setTopUpCount] = useState(
    statusState?.status?.min_topup || 1,
  );
  const [topUpLink, setTopUpLink] = useState(
    statusState?.status?.top_up_link || '',
  );
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(
    statusState?.status?.enable_online_topup || false,
  );
  const [priceRatio, setPriceRatio] = useState(statusState?.status?.price || 1);

  const [stripeAmount, setStripeAmount] = useState(0.0);
  const [stripeMinTopUp, setStripeMinTopUp] = useState(statusState?.status?.stripe_min_topup || 1);
  const [stripeTopUpCount, setStripeTopUpCount] = useState(statusState?.status?.stripe_min_topup || 1);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(statusState?.status?.enable_stripe_topup || false);
  const [stripeOpen, setStripeOpen] = useState(false);

  const [userQuota, setUserQuota] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('');
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [amountLoading, setAmountLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [payMethods, setPayMethods] = useState([]);

  // 邀请相关状态
  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  // 预设充值额度选项
  const [presetAmounts, setPresetAmounts] = useState([
    { value: 5 },
    { value: 10 },
    { value: 30 },
    { value: 50 },
    { value: 100 },
    { value: 300 },
    { value: 500 },
    { value: 1000 },
  ]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const getUsername = () => {
    if (userState.user) {
      return userState.user.username;
    } else {
      return 'null';
    }
  };

  const getUserRole = () => {
    if (!userState.user) return t('普通用户');

    switch (userState.user.role) {
      case 100:
        return t('超级管理员');
      case 10:
        return t('管理员');
      case 0:
      default:
        return t('普通用户');
    }
  };

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('兑换成功！'));
        Modal.success({
          title: t('兑换成功！'),
          content: t('成功兑换额度：') + renderQuota(data),
          centered: true,
        });
        setUserQuota((quota) => {
          return quota + data;
        });
        if (userState.user) {
          const updatedUser = {
            ...userState.user,
            quota: userState.user.quota + data,
          };
          userDispatch({ type: 'login', payload: updatedUser });
        }
        setRedemptionCode('');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置充值链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const preTopUp = async (payment) => {
    if (!enableOnlineTopUp) {
      showError(t('管理员未开启在线充值！'));
      return;
    }
    setPayWay(payment);
    setPaymentLoading(true);
    try {
      await getAmount();
      if (topUpCount < minTopUp) {
        showError(t('充值数量不能小于') + minTopUp);
        return;
      }
      setOpen(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineTopUp = async () => {
    if (amount === 0) {
      await getAmount();
    }
    if (topUpCount < minTopUp) {
      showError('充值数量不能小于' + minTopUp);
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/pay', {
        amount: parseInt(topUpCount),
        top_up_code: topUpCode,
        payment_method: payWay,
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          let params = data;
          let url = res.data.url;
          let form = document.createElement('form');
          form.action = url;
          form.method = 'POST';
          let isSafari =
            navigator.userAgent.indexOf('Safari') > -1 &&
            navigator.userAgent.indexOf('Chrome') < 1;
          if (!isSafari) {
            form.target = '_blank';
          }
          for (let key in params) {
            let input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
          }
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        } else {
          showError(data);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
      showError(t('支付请求失败'));
    } finally {
      setOpen(false);
      setConfirmLoading(false);
    }
  };

  const stripePreTopUp = async () => {
    if (!enableStripeTopUp) {
      showError(t('管理员未开启在线充值！'));
      return;
    }
    setPayWay('stripe');
    setPaymentLoading(true);
    try {
      await getStripeAmount();
      if (stripeTopUpCount < stripeMinTopUp) {
        showError(t('充值数量不能小于') + stripeMinTopUp);
        return;
      }
      setStripeOpen(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineStripeTopUp = async () => {
    if (stripeAmount === 0) {
      await getStripeAmount();
    }
    if (stripeTopUpCount < stripeMinTopUp) {
      showError(t('充值数量不能小于') + stripeMinTopUp);
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/stripe/pay', {
        amount: parseInt(stripeTopUpCount),
        payment_method: 'stripe',
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          processStripeCallback(data);
        } else {
          showError(data);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
      showError(t('支付请求失败'));
    } finally {
      setStripeOpen(false);
      setConfirmLoading(false);
    }
  }

  const processStripeCallback = (data) => {
    window.open(data.pay_link, '_blank');
  };

  const getUserQuota = async () => {
    setUserDataLoading(true);
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      setUserQuota(data.quota);
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
    setUserDataLoading(false);
  };

  // 获取邀请链接
  const getAffLink = async () => {
    const res = await API.get('/api/user/aff');
    const { success, message, data } = res.data;
    if (success) {
      let link = `${window.location.origin}/register?aff=${data}`;
      setAffLink(link);
    } else {
      showError(message);
    }
  };

  // 划转邀请额度
  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/aff_transfer`, {
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

  // 复制邀请链接
  const handleAffLinkClick = async () => {
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  useEffect(() => {
    if (userState?.user?.id) {
      setUserDataLoading(false);
      setUserQuota(userState.user.quota);
    } else {
      getUserQuota().then();
    }
    getAffLink().then();
    setTransferAmount(getQuotaPerUnit());

    let payMethods = localStorage.getItem('pay_methods');
    try {
      payMethods = JSON.parse(payMethods);
      if (payMethods && payMethods.length > 0) {
        // 检查name和type是否为空
        payMethods = payMethods.filter((method) => {
          return method.name && method.type;
        });
        // 如果没有color，则设置默认颜色
        payMethods = payMethods.map((method) => {
          if (!method.color) {
            if (method.type === 'zfb') {
              method.color = 'rgba(var(--semi-blue-5), 1)';
            } else if (method.type === 'wx') {
              method.color = 'rgba(var(--semi-green-5), 1)';
            } else {
              method.color = 'rgba(var(--semi-primary-5), 1)';
            }
          }
          return method;
        });
        setPayMethods(payMethods);
      }
    } catch (e) {
      console.log(e);
      showError(t('支付方式配置错误, 请联系管理员'));
    }
  }, []);

  useEffect(() => {
    if (statusState?.status) {
      setMinTopUp(statusState.status.min_topup || 1);
      setTopUpCount(statusState.status.min_topup || 1);
      setTopUpLink(statusState.status.top_up_link || '');
      setEnableOnlineTopUp(statusState.status.enable_online_topup || false);
      setPriceRatio(statusState.status.price || 1);

      setStripeMinTopUp(statusState.status.stripe_min_topup || 1);
      setStripeTopUpCount(statusState.status.stripe_min_topup || 1);
      setEnableStripeTopUp(statusState.status.enable_stripe_topup || false);
    }
  }, [statusState?.status]);

  const renderAmount = () => {
    return amount + ' ' + t('元');
  };

  const renderStripeAmount = () => {
    return stripeAmount + ' ' + t('元');
  };

  const getAmount = async (value) => {
    if (value === undefined) {
      value = topUpCount;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(value),
        top_up_code: topUpCode,
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
    }
    setAmountLoading(false);
  };

  const getStripeAmount = async (value) => {
    if (value === undefined) {
      value = stripeTopUpCount
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/stripe/amount', {
        amount: parseFloat(value),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        // showInfo(message);
        if (message === 'success') {
          setStripeAmount(parseFloat(data));
        } else {
          setStripeAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setAmountLoading(false);
    }
  }

  const handleCancel = () => {
    setOpen(false);
  };

  const handleStripeCancel = () => {
    setStripeOpen(false);
  };

  const handleTransferCancel = () => {
    setOpenTransfer(false);
  };

  // 选择预设充值额度
  const selectPresetAmount = (preset) => {
    setTopUpCount(preset.value);
    setSelectedPreset(preset.value);
    setAmount(preset.value * priceRatio);

    setStripeTopUpCount(preset.value);
    setStripeAmount(preset.value);
  };

  // 格式化大数字显示
  const formatLargeNumber = (num) => {
    return num.toString();
  };

  return (
    <div className='mx-auto relative min-h-screen lg:min-h-0 mt-[60px]'>
      {/* 划转模态框 */}
      <Modal
        title={
          <div className='flex items-center'>
            <CreditCard className='mr-2' size={18} />
            {t('划转邀请额度')}
          </div>
        }
        visible={openTransfer}
        onOk={transfer}
        onCancel={handleTransferCancel}
        maskClosable={false}
        size='small'
        centered
      >
        <div className='space-y-4'>
          <div>
            <Typography.Text strong className='block mb-2'>
              {t('可用邀请额度')}
            </Typography.Text>
            <Input
              value={renderQuota(userState?.user?.aff_quota)}
              disabled
              size='large'
            />
          </div>
          <div>
            <Typography.Text strong className='block mb-2'>
              {t('划转额度')} ({t('最低') + renderQuota(getQuotaPerUnit())})
            </Typography.Text>
            <InputNumber
              min={getQuotaPerUnit()}
              max={userState?.user?.aff_quota || 0}
              value={transferAmount}
              onChange={(value) => setTransferAmount(value)}
              size='large'
              className='w-full'
            />
          </div>
        </div>
      </Modal>

      {/* 充值确认模态框 */}
      <Modal
        title={
          <div className='flex items-center'>
            <CreditCard className='mr-2' size={18} />
            {t('充值确认')}
          </div>
        }
        visible={open}
        onOk={onlineTopUp}
        onCancel={handleCancel}
        maskClosable={false}
        size='small'
        centered
        confirmLoading={confirmLoading}
      >
        <div className='space-y-4'>
          <div className='flex justify-between items-center py-2'>
            <Text strong>{t('充值数量')}：</Text>
            <Text>{renderQuotaWithAmount(topUpCount)}</Text>
          </div>
          <div className='flex justify-between items-center py-2'>
            <Text strong>{t('实付金额')}：</Text>
            {amountLoading ? (
              <Skeleton.Title style={{ width: '60px', height: '16px' }} />
            ) : (
              <Text type='danger' strong>
                {renderAmount()}
              </Text>
            )}
          </div>
          <div className='flex justify-between items-center py-2'>
            <Text strong>{t('支付方式')}：</Text>
            <Text>
              {(() => {
                const payMethod = payMethods.find(
                  (method) => method.type === payWay,
                );
                if (payMethod) {
                  return (
                    <div className='flex items-center'>
                      {payMethod.type === 'zfb' ? (
                        <SiAlipay className='mr-1' size={16} />
                      ) : payMethod.type === 'wx' ? (
                        <SiWechat className='mr-1' size={16} />
                      ) : (
                        <CreditCard className='mr-1' size={16} />
                      )}
                      {payMethod.name}
                    </div>
                  );
                } else {
                  // 默认充值方式
                  return payWay === 'zfb' ? (
                    <div className='flex items-center'>
                      <SiAlipay className='mr-1' size={16} />
                      {t('支付宝')}
                    </div>
                  ) : (
                    <div className='flex items-center'>
                      <SiWechat className='mr-1' size={16} />
                      {t('微信')}
                    </div>
                  );
                }
              })()}
            </Text>
          </div>
        </div>
      </Modal>

      <Modal
          title={t('确定要充值吗')}
          visible={stripeOpen}
          onOk={onlineStripeTopUp}
          onCancel={handleStripeCancel}
          maskClosable={false}
          size='small'
          centered
          confirmLoading={confirmLoading}
      >
        <p>
          {t('充值数量')}：{stripeTopUpCount}
        </p>
        <p>
          {t('实付金额')}：{renderStripeAmount()}
        </p>
        <p>{t('是否确认充值？')}</p>
      </Modal>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        {/* 左侧充值区域 */}
        <div className='lg:col-span-7 space-y-6 w-full'>
          {/* 在线充值卡片 */}
          <Card
            className='!rounded-2xl'
            shadows='always'
            bordered={false}
            header={
              <div className='px-5 py-4 pb-0'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center'>
                    <Avatar
                      className='mr-3 shadow-md flex-shrink-0'
                      color='blue'
                    >
                      <CreditCard size={24} />
                    </Avatar>
                    <div>
                      <Title heading={5} style={{ margin: 0 }}>
                        {t('在线充值')}
                      </Title>
                      <Text type='tertiary' className='text-sm'>
                        {t('快速方便的充值方式')}
                      </Text>
                    </div>
                  </div>

                  <div className='flex items-center'>
                    {userDataLoading ? (
                      <Skeleton.Paragraph style={{ width: '120px' }} rows={1} />
                    ) : (
                      <Text type='tertiary' className='hidden sm:block'>
                        <div className='flex items-center'>
                          <User size={14} className='mr-1' />
                          <span className='hidden md:inline'>
                            {getUsername()} ({getUserRole()})
                          </span>
                          <span className='md:hidden'>{getUsername()}</span>
                        </div>
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            }
          >
            <div className='space-y-4'>
              {/* 账户余额信息 */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-2'>
                <Card className='!rounded-2xl'>
                  <Text type='tertiary' className='mb-1'>
                    {t('当前余额')}
                  </Text>
                  {userDataLoading ? (
                    <Skeleton.Title
                      style={{ width: '100px', height: '30px' }}
                    />
                  ) : (
                    <div className='text-xl font-semibold mt-2'>
                      {renderQuota(userState?.user?.quota || userQuota)}
                    </div>
                  )}
                </Card>
                <Card className='!rounded-2xl'>
                  <Text type='tertiary' className='mb-1'>
                    {t('历史消耗')}
                  </Text>
                  {userDataLoading ? (
                    <Skeleton.Title
                      style={{ width: '100px', height: '30px' }}
                    />
                  ) : (
                    <div className='text-xl font-semibold mt-2'>
                      {renderQuota(userState?.user?.used_quota || 0)}
                    </div>
                  )}
                </Card>
              </div>

              {enableOnlineTopUp && (
                <>
                  {/* 预设充值额度卡片网格 */}
                  <div>
                    <Text strong className='block mb-3'>
                      {t('选择充值额度')}
                    </Text>
                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3'>
                      {presetAmounts.map((preset, index) => (
                        <Card
                          key={index}
                          onClick={() => selectPresetAmount(preset)}
                          className={`cursor-pointer !rounded-2xl transition-all hover:shadow-md ${selectedPreset === preset.value
                            ? 'border-blue-500'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                          bodyStyle={{ textAlign: 'center' }}
                        >
                          <div className='font-medium text-lg flex items-center justify-center mb-1'>
                            <Coins size={16} className='mr-0.5' />
                            {formatLargeNumber(preset.value)}
                          </div>
                          <div className='text-xs text-gray-500'>
                            {t('实付')} ￥
                            {(preset.value * priceRatio).toFixed(2)}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                  {/* 桌面端显示的自定义金额和支付按钮 */}
                  <div className='hidden md:block space-y-4'>
                    <Divider style={{ margin: '24px 0' }}>
                      <Text className='text-sm font-medium'>
                        {t('或输入自定义金额')}
                      </Text>
                    </Divider>

                    <div>
                      <div className='flex justify-between mb-2'>
                        <Text strong>{t('充值数量')}</Text>
                        {amountLoading ? (
                          <Skeleton.Title
                            style={{ width: '80px', height: '16px' }}
                          />
                        ) : (
                          <Text type='tertiary'>
                            {t('实付金额：') + renderAmount()}
                          </Text>
                        )}
                      </div>
                      <InputNumber
                        disabled={!enableOnlineTopUp}
                        placeholder={
                          t('充值数量，最低 ') + renderQuotaWithAmount(minTopUp)
                        }
                        value={topUpCount}
                        min={minTopUp}
                        max={999999999}
                        step={1}
                        precision={0}
                        onChange={async (value) => {
                          if (value && value >= 1) {
                            setTopUpCount(value);
                            setSelectedPreset(null);
                            await getAmount(value);
                          }
                        }}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value);
                          if (!value || value < 1) {
                            setTopUpCount(1);
                            getAmount(1);
                          }
                        }}
                        size='large'
                        className='w-full'
                        formatter={(value) => (value ? `${value}` : '')}
                        parser={(value) =>
                          value ? parseInt(value.replace(/[^\d]/g, '')) : 0
                        }
                      />
                    </div>

                    <div>
                      <Text strong className='block mb-3'>
                        {t('选择支付方式')}
                      </Text>
                      {payMethods.length === 2 ? (
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                          {payMethods.map((payMethod) => (
                            <Button
                              key={payMethod.type}
                              type='primary'
                              onClick={() => preTopUp(payMethod.type)}
                              size='large'
                              disabled={!enableOnlineTopUp}
                              loading={paymentLoading && payWay === payMethod.type}
                              icon={
                                payMethod.type === 'zfb' ? (
                                  <SiAlipay size={16} />
                                ) : payMethod.type === 'wx' ? (
                                  <SiWechat size={16} />
                                ) : (
                                  <CreditCard size={16} />
                                )
                              }
                              style={{
                                height: '40px',
                                color: payMethod.color,
                              }}
                              className='transition-all hover:shadow-md w-full'
                            >
                              <span className='ml-1'>{payMethod.name}</span>
                            </Button>
                          ))}
                        </div>
                      ) : payMethods.length === 3 ? (
                        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                          {payMethods.map((payMethod) => (
                            <Button
                              key={payMethod.type}
                              type='primary'
                              onClick={() => preTopUp(payMethod.type)}
                              size='large'
                              disabled={!enableOnlineTopUp}
                              loading={paymentLoading && payWay === payMethod.type}
                              icon={
                                payMethod.type === 'zfb' ? (
                                  <SiAlipay size={16} />
                                ) : payMethod.type === 'wx' ? (
                                  <SiWechat size={16} />
                                ) : (
                                  <CreditCard size={16} />
                                )
                              }
                              style={{
                                height: '40px',
                                color: payMethod.color,
                              }}
                              className='transition-all hover:shadow-md w-full'
                            >
                              <span className='ml-1'>{payMethod.name}</span>
                            </Button>
                          ))}
                        </div>
                      ) : payMethods.length > 3 ? (
                        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                          {payMethods.map((payMethod) => (
                            <Card
                              key={payMethod.type}
                              onClick={() => preTopUp(payMethod.type)}
                              disabled={!enableOnlineTopUp}
                              className={`cursor-pointer !rounded-xl p-0 transition-all hover:shadow-md ${paymentLoading && payWay === payMethod.type
                                ? 'border-blue-400'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                              bodyStyle={{
                                padding: '10px',
                                textAlign: 'center',
                                opacity: !enableOnlineTopUp ? 0.5 : 1
                              }}
                            >
                              {paymentLoading && payWay === payMethod.type ? (
                                <div className='flex flex-col items-center justify-center h-full'>
                                  <div className='mb-1'>
                                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500'></div>
                                  </div>
                                  <div className='text-xs text-gray-500'>{t('处理中')}</div>
                                </div>
                              ) : (
                                <>
                                  <div className='flex items-center justify-center mb-1'>
                                    {payMethod.type === 'zfb' ? (
                                      <SiAlipay size={20} color={payMethod.color} />
                                    ) : payMethod.type === 'wx' ? (
                                      <SiWechat size={20} color={payMethod.color} />
                                    ) : (
                                      <CreditCard size={20} color={payMethod.color} />
                                    )}
                                  </div>
                                  <div className='text-sm font-medium'>{payMethod.name}</div>
                                </>
                              )}
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className='grid grid-cols-1 gap-3'>
                          {payMethods.map((payMethod) => (
                            <Button
                              key={payMethod.type}
                              type='primary'
                              onClick={() => preTopUp(payMethod.type)}
                              size='large'
                              disabled={!enableOnlineTopUp}
                              loading={paymentLoading && payWay === payMethod.type}
                              icon={
                                payMethod.type === 'zfb' ? (
                                  <SiAlipay size={16} />
                                ) : payMethod.type === 'wx' ? (
                                  <SiWechat size={16} />
                                ) : (
                                  <CreditCard size={16} />
                                )
                              }
                              style={{
                                height: '40px',
                                color: payMethod.color,
                              }}
                              className='transition-all hover:shadow-md w-full'
                            >
                              <span className='ml-1'>{payMethod.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {!enableOnlineTopUp && !enableStripeTopUp && (
                <Banner
                  type='warning'
                  description={t(
                    '管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。',
                  )}
                  closeIcon={null}
                  className='!rounded-2xl'
                />
              )}

              {enableStripeTopUp && (
                  <>
                    {/* 桌面端显示的自定义金额和支付按钮 */}
                    <div className='hidden md:block space-y-4'>
                      <Divider style={{ margin: '24px 0' }}>
                        <Text className='text-sm font-medium'>
                          {t(!enableOnlineTopUp ? '或输入自定义金额' : 'Stripe')}
                        </Text>
                      </Divider>

                      <div>
                        <div className='flex justify-between mb-2'>
                          <Text strong>{t('充值数量')}</Text>
                          {amountLoading ? (
                              <Skeleton.Title
                                  style={{ width: '80px', height: '16px' }}
                              />
                          ) : (
                              <Text type='tertiary'>
                                {t('实付金额：') + renderStripeAmount()}
                              </Text>
                          )}
                        </div>
                        <InputNumber
                            disabled={!enableStripeTopUp}
                            placeholder={
                                t('充值数量，最低 ') + renderQuotaWithAmount(stripeMinTopUp)
                            }
                            value={stripeTopUpCount}
                            min={stripeMinTopUp}
                            max={999999999}
                            step={1}
                            precision={0}
                            onChange={async (value) => {
                              if (value && value >= 1) {
                                setStripeTopUpCount(value);
                                setSelectedPreset(null);
                                await getStripeAmount(value);
                              }
                            }}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value);
                              if (!value || value < 1) {
                                setStripeTopUpCount(1);
                                getStripeAmount(1);
                              }
                            }}
                            size='large'
                            className='w-full'
                            formatter={(value) => (value ? `${value}` : '')}
                            parser={(value) =>
                                value ? parseInt(value.replace(/[^\d]/g, '')) : 0
                            }
                        />
                      </div>

                      <div>
                        <Text strong className='block mb-3'>
                          {t('选择支付方式')}
                        </Text>
                          <div className='grid grid-cols-1 gap-3'>
                            <Button
                                key='stripe'
                                type='primary'
                                onClick={() => stripePreTopUp()}
                                size='large'
                                disabled={!enableStripeTopUp}
                                loading={paymentLoading && payWay === 'stripe'}
                                icon={<CreditCard size={16} />}
                                style={{
                                  height: '40px',
                                  color: '#b161fe',
                                }}
                                className='transition-all hover:shadow-md w-full'
                            >
                              <span className='ml-1'>Stripe</span>
                            </Button>
                          </div>
                      </div>
                    </div>
                  </>
              )}

              <Divider style={{ margin: '24px 0' }}>
                <Text className='text-sm font-medium'>{t('兑换码充值')}</Text>
              </Divider>

              <Card className='!rounded-2xl'>
                <div className='flex items-start mb-4'>
                  <Gift size={16} className='mr-2 mt-0.5' />
                  <Text strong>{t('使用兑换码快速充值')}</Text>
                </div>

                <div className='mb-4'>
                  <Input
                    placeholder={t('请输入兑换码')}
                    value={redemptionCode}
                    onChange={(value) => setRedemptionCode(value)}
                    size='large'
                  />
                </div>

                <div className='flex flex-col sm:flex-row gap-3'>
                  {topUpLink && (
                    <Button
                      type='secondary'
                      onClick={openTopUpLink}
                      size='large'
                      className='flex-1'
                      icon={<LinkIcon size={16} />}
                      style={{ height: '40px' }}
                    >
                      {t('获取兑换码')}
                    </Button>
                  )}
                  <Button
                    type='primary'
                    onClick={topUp}
                    disabled={isSubmitting || !redemptionCode}
                    loading={isSubmitting}
                    size='large'
                    className='flex-1'
                    style={{ height: '40px' }}
                  >
                    {isSubmitting ? t('兑换中...') : t('兑换')}
                  </Button>
                </div>
              </Card>
            </div>
          </Card>
        </div>

        {/* 右侧邀请信息卡片 */}
        <div className='lg:col-span-5'>
          <Card
            className='!rounded-2xl'
            shadows='always'
            bordered={false}
            header={
              <div className='px-5 py-4 pb-0'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center'>
                    <Avatar
                      className='mr-3 shadow-md flex-shrink-0'
                      color='green'
                    >
                      <Users size={24} />
                    </Avatar>
                    <div>
                      <Title heading={5} style={{ margin: 0 }}>
                        {t('邀请奖励')}
                      </Title>
                      <Text type='tertiary' className='text-sm'>
                        {t('邀请好友获得额外奖励')}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            <div className='space-y-6'>
              <div className='grid grid-cols-1 gap-4'>
                <Card className='!rounded-2xl'>
                  <div className='flex justify-between items-center'>
                    <Text type='tertiary'>{t('待使用收益')}</Text>
                    <Button
                      type='primary'
                      theme='solid'
                      size='small'
                      disabled={
                        !userState?.user?.aff_quota ||
                        userState?.user?.aff_quota <= 0
                      }
                      onClick={() => setOpenTransfer(true)}
                    >
                      {t('划转到余额')}
                    </Button>
                  </div>
                  <div className='text-2xl font-semibold mt-2'>
                    {renderQuota(userState?.user?.aff_quota || 0)}
                  </div>
                </Card>

                <div className='grid grid-cols-2 gap-4'>
                  <Card className='!rounded-2xl'>
                    <Text type='tertiary'>{t('总收益')}</Text>
                    <div className='text-xl font-semibold mt-2'>
                      {renderQuota(userState?.user?.aff_history_quota || 0)}
                    </div>
                  </Card>
                  <Card className='!rounded-2xl'>
                    <Text type='tertiary'>{t('邀请人数')}</Text>
                    <div className='text-xl font-semibold mt-2 flex items-center'>
                      <Users size={16} className='mr-1' />
                      {userState?.user?.aff_count || 0}
                    </div>
                  </Card>
                </div>
              </div>

              <div className='space-y-4'>
                <Title heading={6}>{t('邀请链接')}</Title>
                <Input
                  value={affLink}
                  readonly
                  size='large'
                  suffix={
                    <Button
                      type='primary'
                      theme='light'
                      onClick={handleAffLinkClick}
                      icon={<Copy size={14} />}
                    >
                      {t('复制')}
                    </Button>
                  }
                />

                <div className='mt-4'>
                  <Card className='!rounded-2xl'>
                    <div className='space-y-4'>
                      <div className='flex items-start'>
                        <div className='w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 mr-3 flex-shrink-0'></div>
                        <Text type='tertiary' className='text-sm leading-6'>
                          {t('邀请好友注册，好友充值后您可获得相应奖励')}
                        </Text>
                      </div>
                      <div className='flex items-start'>
                        <div className='w-1.5 h-1.5 rounded-full bg-green-500 mt-2 mr-3 flex-shrink-0'></div>
                        <Text type='tertiary' className='text-sm leading-6'>
                          {t('通过划转功能将奖励额度转入到您的账户余额中')}
                        </Text>
                      </div>
                      <div className='flex items-start'>
                        <div className='w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 mr-3 flex-shrink-0'></div>
                        <Text type='tertiary' className='text-sm leading-6'>
                          {t('邀请的好友越多，获得的奖励越多')}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 移动端底部固定的自定义金额和支付区域 */}
      {enableOnlineTopUp && (
        <div
          className='md:hidden fixed bottom-0 left-0 right-0 p-4 shadow-lg z-50'
          style={{ background: 'var(--semi-color-bg-0)' }}
        >
          <div className='space-y-4'>
            <div>
              <div className='flex justify-between mb-2'>
                <Text strong>{t('充值数量')}</Text>
                {amountLoading ? (
                  <Skeleton.Title style={{ width: '80px', height: '16px' }} />
                ) : (
                  <Text type='tertiary'>
                    {t('实付金额：') + renderAmount()}
                  </Text>
                )}
              </div>
              <InputNumber
                disabled={!enableOnlineTopUp}
                placeholder={
                  t('充值数量，最低 ') + renderQuotaWithAmount(minTopUp)
                }
                value={topUpCount}
                min={minTopUp}
                max={999999999}
                step={1}
                precision={0}
                onChange={async (value) => {
                  if (value && value >= 1) {
                    setTopUpCount(value);
                    setSelectedPreset(null);
                    await getAmount(value);
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value);
                  if (!value || value < 1) {
                    setTopUpCount(1);
                    getAmount(1);
                  }
                }}
                className='w-full'
                formatter={(value) => (value ? `${value}` : '')}
                parser={(value) =>
                  value ? parseInt(value.replace(/[^\d]/g, '')) : 0
                }
              />
            </div>

            <div>
              {payMethods.length === 2 ? (
                <div className='grid grid-cols-2 gap-3'>
                  {payMethods.map((payMethod) => (
                    <Button
                      key={payMethod.type}
                      type='primary'
                      onClick={() => preTopUp(payMethod.type)}
                      disabled={!enableOnlineTopUp}
                      loading={paymentLoading && payWay === payMethod.type}
                      icon={
                        payMethod.type === 'zfb' ? (
                          <SiAlipay size={16} />
                        ) : payMethod.type === 'wx' ? (
                          <SiWechat size={16} />
                        ) : (
                          <CreditCard size={16} />
                        )
                      }
                      style={{
                        color: payMethod.color,
                      }}
                      className='h-10'
                    >
                      <span className='ml-1'>{payMethod.name}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className='grid grid-cols-4 gap-2'>
                  {payMethods.map((payMethod) => (
                    <Card
                      key={payMethod.type}
                      onClick={() => preTopUp(payMethod.type)}
                      disabled={!enableOnlineTopUp}
                      className={`cursor-pointer !rounded-xl p-0 transition-all ${paymentLoading && payWay === payMethod.type
                        ? 'border-blue-400'
                        : 'border-gray-200'
                        }`}
                      bodyStyle={{
                        padding: '8px',
                        textAlign: 'center',
                        opacity: !enableOnlineTopUp ? 0.5 : 1
                      }}
                    >
                      {paymentLoading && payWay === payMethod.type ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto'></div>
                      ) : (
                        <>
                          <div className='flex justify-center'>
                            {payMethod.type === 'zfb' ? (
                              <SiAlipay size={18} color={payMethod.color} />
                            ) : payMethod.type === 'wx' ? (
                              <SiWechat size={18} color={payMethod.color} />
                            ) : (
                              <CreditCard size={18} color={payMethod.color} />
                            )}
                          </div>
                          <div className='text-xs mt-1'>{payMethod.name}</div>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopUp;
