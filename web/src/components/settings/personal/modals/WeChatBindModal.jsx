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

import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Image, Toast } from '@douyinfe/semi-ui';
import { IconKey } from '@douyinfe/semi-icons';
import { SiWechat } from 'react-icons/si';
import { API } from '../../../../helpers';

const WeChatBindModal = ({
  t,
  showWeChatBindModal,
  setShowWeChatBindModal,
  inputs,
  handleInputChange,
  bindWeChat,
  status,
  onBindSuccess,
}) => {
  const [directBindData, setDirectBindData] = useState({
    loginToken: '',
    qrcodeUrl: '',
    polling: false,
    bindStatus: 'idle', // idle | scanning | confirmed | expired | error
  });
  const [qrcodeLoading, setQrcodeLoading] = useState(false);
  const pollingIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const isDirectBind = status?.wechat_direct_login_enabled;

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showWeChatBindModal && isDirectBind) {
      generateDirectBindQRCode();
    } else if (!showWeChatBindModal) {
      cleanup();
    }
  }, [showWeChatBindModal, isDirectBind]);

  const cleanup = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDirectBindData({
      loginToken: '',
      qrcodeUrl: '',
      polling: false,
      bindStatus: 'idle',
    });
  };

  const generateDirectBindQRCode = async () => {
    setQrcodeLoading(true);
    try {
      const res = await API.post('/api/wechat/create_login_qrcode');
      if (res.data.success) {
        setDirectBindData({
          loginToken: res.data.data.login_token,
          qrcodeUrl: res.data.data.qrcode_url,
          polling: true,
          bindStatus: 'idle',
        });

        pollBindStatus(res.data.data.login_token);
      } else {
        Toast.error(res.data.message || '生成二维码失败');
        setDirectBindData(prev => ({ ...prev, polling: false, bindStatus: 'error' }));
      }
    } catch (error) {
      Toast.error('生成二维码失败');
      setDirectBindData(prev => ({ ...prev, polling: false, bindStatus: 'error' }));
    } finally {
      setQrcodeLoading(false);
    }
  };

  const pollBindStatus = (loginToken) => {
    let pollCount = 0;
    const maxPolls = 300; // 最多轮询300次（10分钟）

    pollingIntervalRef.current = setInterval(async () => {
      try {
        pollCount++;
        const res = await API.get(`/api/wechat/login_status?login_token=${loginToken}`);
        if (res.data.success) {
          const { status, auth_code } = res.data.data;

          if (status === 'success' && auth_code) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setDirectBindData(prev => ({ ...prev, polling: false, bindStatus: 'confirmed' }));
            await bindWithAuthCode(auth_code);
          } else if (status === 'scanned') {
            setDirectBindData(prev => ({ ...prev, bindStatus: 'scanning' }));
          } else if (status === 'expired') {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setDirectBindData(prev => ({ ...prev, polling: false, bindStatus: 'expired' }));
            Toast.warning('二维码已过期，请重新生成');
          } else if (pollCount >= maxPolls) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setDirectBindData(prev => ({ ...prev, polling: false, bindStatus: 'expired' }));
            Toast.warning('二维码已过期，请重新生成');
          }
        }
      } catch (error) {
        console.error('轮询失败:', error);
      }
    }, 2000);
  };

  const bindWithAuthCode = async (authCode) => {
    try {
      const res = await API.get(`/api/oauth/wechat/bind?code=${authCode}`);
      const { success, message } = res.data;
      if (success) {
        Toast.success(t('微信账户绑定成功！'));
        if (onBindSuccess) {
          await onBindSuccess();
        }
        setTimeout(() => {
          setShowWeChatBindModal(false);
        }, 1000);
      } else {
        Toast.error(message || '绑定失败');
        setDirectBindData(prev => ({ ...prev, bindStatus: 'error' }));
      }
    } catch (error) {
      Toast.error('绑定失败，请重试');
      setDirectBindData(prev => ({ ...prev, bindStatus: 'error' }));
    }
  };

  // 渲染验证码绑定界面
  const renderVerificationBind = () => {
    return (
      <Modal
        title={
          <div className='flex items-center'>
            <SiWechat className='mr-2 text-green-500' size={20} />
            {t('绑定微信账户')}
          </div>
        }
        visible={showWeChatBindModal}
        onCancel={() => setShowWeChatBindModal(false)}
        footer={null}
        size={'small'}
        centered={true}
        className='modern-modal'
      >
        <div className='space-y-4 py-4 text-center'>
          <Image src={status.wechat_qrcode} className='mx-auto' />
          <div className='text-gray-600'>
            <p>
              {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
            </p>
          </div>
          <Input
            placeholder={t('验证码')}
            name='wechat_verification_code'
            value={inputs.wechat_verification_code}
            onChange={(v) => handleInputChange('wechat_verification_code', v)}
            size='large'
            className='!rounded-lg'
            prefix={<IconKey />}
          />
          <Button
            type='primary'
            theme='solid'
            size='large'
            onClick={bindWeChat}
            className='!rounded-lg w-full !bg-slate-600 hover:!bg-slate-700'
            icon={<SiWechat size={16} />}
          >
            {t('绑定')}
          </Button>
        </div>
      </Modal>
    );
  };

  const renderDirectBind = () => {
    const getStatusText = () => {
      switch (directBindData.bindStatus) {
        case 'idle':
          return t('请使用微信扫码关注公众号，即可自动绑定');
        case 'scanning':
          return t('检测到扫码，请在微信中确认绑定');
        case 'confirmed':
          return t('绑定成功！');
        case 'expired':
          return t('二维码已过期，请点击下方按钮刷新');
        case 'error':
          return t('发生错误，请点击下方按钮重试');
        default:
          return t('请使用微信扫码关注公众号，即可自动绑定');
      }
    };
    const getStatusColor = () => {
      switch (directBindData.bindStatus) {
        case 'idle':
          return 'text-gray-600';
        case 'scanning':
          return 'text-blue-500';
        case 'confirmed':
          return 'text-green-500';
        case 'expired':
          return 'text-amber-500';
        case 'error':
          return 'text-red-500';
        default:
          return 'text-gray-600';
      }
    };

    return (
      <Modal
        title={
          <div className='flex items-center'>
            <SiWechat className='mr-2 text-green-500' size={20} />
            {t('绑定微信账户')}
          </div>
        }
        visible={showWeChatBindModal}
        onCancel={() => {
          cleanup();
          setShowWeChatBindModal(false);
        }}
        footer={null}
        size={'small'}
        centered={true}
        className='modern-modal'
      >
        <div className='space-y-4 py-4 text-center'>
          {directBindData.qrcodeUrl ? (
            <div className='flex flex-col items-center'>
              <img
                src={directBindData.qrcodeUrl}
                alt='绑定二维码'
                className='mb-4 w-48 h-48 border border-gray-200 rounded-lg shadow-sm'
              />
              <div className={`text-center mb-4 ${getStatusColor()}`}>
                <p>{getStatusText()}</p>
                {directBindData.polling && (
                  <div className='flex items-center justify-center mt-2'>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2'></div>
                    <span className='text-sm text-gray-500'>{t('等待扫码...')}</span>
                  </div>
                )}
              </div>
              <Button
                theme='outline'
                type='tertiary'
                onClick={generateDirectBindQRCode}
                loading={qrcodeLoading}
                disabled={directBindData.bindStatus === 'confirmed'}
              >
                {t('刷新二维码')}
              </Button>
            </div>
          ) : (
            <div className='text-center py-8'>
              {qrcodeLoading ? (
                <>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4'></div>
                  <p className='text-gray-500'>{t('正在生成二维码...')}</p>
                </>
              ) : (
                <p className='text-red-500'>{t('生成二维码失败，请重试')}</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    );
  };
  return isDirectBind ? renderDirectBind() : renderVerificationBind();
};

export default WeChatBindModal;
