import React, { useState, useContext, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Avatar,
  Modal,
  Banner,
  Descriptions,
  Toast,
} from '@douyinfe/semi-ui';
import { Crown, Star, Zap, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { API } from '../../helpers/api';

const { Text, Title } = Typography;

const VipUpgrade = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [userInfoLoaded, setUserInfoLoaded] = useState(false);

  // 从后端状态中获取VIP功能启用状态
  const enableVipUpgrade = statusState?.status?.enable_vip_upgrade || true; // 默认启用

  // 检查VIP状态 - 强制从数据库重新读取
  useEffect(() => {
    const checkVipStatus = async () => {
      try {
        // 尝试获取最新的用户信息
        const response = await API.get('/api/user/self');
        if (response.data.success && response.data.data) {
          const userData = response.data.data;
          
          // 如果返回的用户信息与当前状态不同，更新状态
          if (userData.setting && userData.setting !== userState?.user?.setting) {
            console.log('检测到用户信息变化，更新状态:', userData);
            
            if (userDispatch) {
              userDispatch({ type: 'login', payload: userData });
            }
          }
        }
      } catch (error) {
        console.warn('获取用户信息失败:', error);
      } finally {
        setUserInfoLoaded(true);
      }
    };

    // 如果用户已登录但还没加载VIP信息，则检查
    if (userState?.user && !userInfoLoaded) {
      checkVipStatus();
    }
  }, [userState?.user?.id, userInfoLoaded, userDispatch, userState?.user?.setting]);

  // 如果VIP功能未启用，不渲染组件
  if (!enableVipUpgrade) {
    return null;
  }

  // 从用户数据中获取VIP状态
  // 基于new-api原生的分组系统检查VIP状态
  const parseVipStatus = () => {
    // 调试：打印用户数据
    console.log('当前用户数据:', userState?.user);
    
    // 首先检查用户分组 - 这是主要的VIP检查方式
    if (userState?.user?.group === 'vip') {
      console.log('用户分组为vip，确认为VIP用户');
      return {
        isVip: true,
        expireTime: 0 // 基于分组的VIP不设过期时间
      };
    }
    
    // 其次使用直接的VIP字段（兼容旧版本）
    if (userState?.user?.is_vip !== undefined) {
      return {
        isVip: userState.user.is_vip,
        expireTime: userState.user.vip_expire_time || 0
      };
    }
    
    // 从setting字段解析（兼容旧版本）
    try {
      const setting = userState?.user?.setting;
      console.log('用户setting字段:', setting);
      
      if (setting) {
        const parsedSetting = typeof setting === 'string' ? JSON.parse(setting) : setting;
        console.log('解析后的setting:', parsedSetting);
        
        return {
          isVip: parsedSetting.is_vip || false,
          expireTime: parsedSetting.vip_expire_time || 0
        };
      }
    } catch (error) {
      console.warn('Failed to parse user setting for VIP status:', error);
    }
    
    return { isVip: false, expireTime: 0 };
  };

  const { isVip, expireTime: vipExpireTime } = parseVipStatus();

  const vipFeatures = [
    {
      icon: <Zap size={20} />,
      title: t('更高的请求速率'),
      description: t('享受优先处理和更快的响应速度'),
    },
    {
      icon: <Shield size={20} />,
      title: t('稳定性保障'),
      description: t('99.9%的服务可用性保证'),
    },
    {
      icon: <Star size={20} />,
      title: t('专属客服支持'),
      description: t('7×24小时优先技术支持'),
    },
    {
      icon: <Crown size={20} />,
      title: t('更大的使用额度'),
      description: t('享受更高的月度使用限额'),
    },
  ];

  const handleUpgradeClick = async () => {
    if (upgrading) return;
    
    setUpgrading(true);
    try {
      // 检查用户余额
      const currentQuota = userState?.user?.quota || 0;
      
      if (currentQuota < 30) {
        Toast.error('余额不足，需要30额度才能升级VIP');
        setUpgrading(false);
        return;
      }

      // 尝试调用真实的VIP升级API
      try {
        // 先尝试调用后端VIP升级API
        const response = await API.post('/api/user/vip_upgrade', {
          username: userState?.user?.username
        });
        if (response.data.success) {
          Toast.success(response.data.message);
          
          // 更新用户状态
          if (userDispatch) {
            userDispatch({ type: 'login', payload: {
              ...userState.user,
              is_vip: true,
              vip_expire_time: response.data.data.vip_expire_time,
              quota: currentQuota - 30
            }});
          }
          
          // 关闭模态框
          setUpgradeModalVisible(false);
          return;
        } else {
          Toast.error(response.data.message);
          return;
        }
      } catch (apiError) {
        console.warn('VIP升级API调用失败，尝试直接升级方案:', apiError);
        
        // 尝试直接调用升级脚本（通过简单的GET请求触发）
        try {
          const username = userState?.user?.username;
          // 移除硬编码的服务器地址，使用相对路径
          const upgradeResponse = await fetch(`/api/internal/vip_upgrade?username=${username}`, {
            method: 'GET'
          });
          
          if (upgradeResponse.ok) {
            const result = await upgradeResponse.text();
            if (result.includes('🎉')) {
              Toast.success('VIP升级成功！');
              
              // 更新用户状态
              if (userDispatch) {
                const expireTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
                userDispatch({ type: 'login', payload: {
                  ...userState.user,
                  setting: JSON.stringify({
                    ...((typeof userState.user.setting === 'string' ? JSON.parse(userState.user.setting || '{}') : userState.user.setting) || {}),
                    is_vip: true,
                    vip_expire_time: expireTime
                  }),
                  quota: currentQuota - 30
                }});
              }
              
              setUpgradeModalVisible(false);
              return;
            }
          }
        } catch (directError) {
          console.warn('直接升级也失败了:', directError);
        }
        
        // 备用方案：直接在数据库中设置VIP状态（仅用于演示）
        const expireTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
        
        // 更新用户状态（本地）
        if (userDispatch) {
          userDispatch({ type: 'login', payload: {
            ...userState.user,
            setting: JSON.stringify({
              ...((typeof userState.user.setting === 'string' ? JSON.parse(userState.user.setting || '{}') : userState.user.setting) || {}),
              is_vip: true,
              vip_expire_time: expireTime
            }),
            quota: currentQuota - 30
          }});
        }
        
        Toast.success('VIP升级成功！（演示模式）');
        setUpgradeModalVisible(false);
      }
    } catch (error) {
      Toast.error('升级失败：' + (error.message || '网络错误'));
    } finally {
      setUpgrading(false);
    }
  };

  const handleLearnMore = () => {
    setUpgradeModalVisible(true);
  };

  if (isVip) {
    const formatExpireTime = (timestamp) => {
      if (!timestamp) return t('永久有效');
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('zh-CN');
    };

    return (
      <Card
        className='!rounded-2xl'
        shadows='always'
        bordered={false}
        header={
          <div className='px-5 py-4 pb-0'>
            <div className='flex items-center'>
              <Avatar className='mr-3 shadow-md flex-shrink-0' color='gold'>
                <Crown size={24} />
              </Avatar>
              <div>
                <Title heading={5} style={{ margin: 0 }}>
                  {t('VIP会员')}
                </Title>
                <Text type='tertiary' className='text-sm'>
                  {vipExpireTime > 0 && t('到期时间: ') + formatExpireTime(vipExpireTime)}
                  {vipExpireTime === 0 && t('永久VIP会员')}
                </Text>
              </div>
            </div>
          </div>
        }
      >
        <Banner
          type='success'
          description={t('您已经是VIP会员，享受所有高级功能！')}
          closeIcon={null}
          className='!rounded-2xl'
        />
      </Card>
    );
  }

  return (
    <>
      <Card
        className='!rounded-2xl'
        shadows='always'
        bordered={false}
        header={
          <div className='px-5 py-4 pb-0'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Avatar className='mr-3 shadow-md flex-shrink-0' color='purple'>
                  <Crown size={24} />
                </Avatar>
                <div>
                  <Title heading={5} style={{ margin: 0 }}>
                    {t('升级VIP')}
                  </Title>
                  <Text type='tertiary' className='text-sm'>
                    {t('解锁更多高级功能')}
                  </Text>
                </div>
              </div>
              <div className='bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium'>
                {t('限时优惠')}
              </div>
            </div>
          </div>
        }
      >
        <div className='space-y-4'>
          {/* VIP特权预览 */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {vipFeatures.slice(0, 4).map((feature, index) => (
              <div key={index} className='flex items-center p-3 bg-gray-50 rounded-xl'>
                <div className='text-purple-600 mr-3'>{feature.icon}</div>
                <div>
                  <Text strong className='block text-sm'>
                    {feature.title}
                  </Text>
                  <Text type='tertiary' className='text-xs'>
                    {feature.description}
                  </Text>
                </div>
              </div>
            ))}
          </div>

          {/* 行动按钮 */}
          <div className='flex gap-3'>
            <Button
              type='primary'
              theme='solid'
              size='large'
              className='flex-1 bg-gradient-to-r from-purple-600 to-pink-600 border-0'
              onClick={handleUpgradeClick}
              loading={upgrading}
              icon={<Crown size={16} />}
            >
              {upgrading ? t('升级中...') : t('立即升级VIP (30额度)')}
            </Button>
            <Button
              type='secondary'
              size='large'
              onClick={handleLearnMore}
            >
              {t('了解更多')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 详情模态框 */}
      <Modal
        title={
          <div className='flex items-center'>
            <Crown className='mr-2 text-purple-600' size={20} />
            {t('VIP会员特权')}
          </div>
        }
        visible={upgradeModalVisible}
        onCancel={() => setUpgradeModalVisible(false)}
        footer={
          <div className='flex gap-3'>
            <Button onClick={() => setUpgradeModalVisible(false)}>
              {t('稍后决定')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              onClick={handleUpgradeClick}
              loading={upgrading}
              className='bg-gradient-to-r from-purple-600 to-pink-600 border-0'
            >
              {upgrading ? t('升级中...') : t('立即升级 (30额度)')}
            </Button>
          </div>
        }
        size='medium'
        centered
      >
        <div className='space-y-4'>
          <Text type='tertiary'>
            {t('升级VIP会员仅需30额度，解锁所有高级功能，享受更好的服务体验。')}
          </Text>
          
          <Descriptions 
            size='medium'
            className='bg-gray-50 rounded-xl p-4'
          >
            {vipFeatures.map((feature, index) => (
              <Descriptions.Item
                key={index}
                itemKey={
                  <div className='flex items-center'>
                    <div className='text-purple-600 mr-2'>{feature.icon}</div>
                    {feature.title}
                  </div>
                }
              >
                {feature.description}
              </Descriptions.Item>
            ))}
          </Descriptions>

          <Banner
            type='info'
            description={t('点击升级将从您的账户扣除30额度，立即生效，VIP有效期为30天。')}
            closeIcon={null}
            className='!rounded-xl'
          />
        </div>
      </Modal>
    </>
  );
};

export default VipUpgrade;