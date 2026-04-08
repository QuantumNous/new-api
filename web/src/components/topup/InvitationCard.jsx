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
import {
  Avatar,
  Typography,
  Card,
  Button,
  Input,
  Badge,
  Space,
  Table,
  Spin,
  Tabs,
  TabPane,
  Tag,
} from '@douyinfe/semi-ui';
import {
  Copy,
  Users,
  BarChart2,
  TrendingUp,
  Gift,
  Zap,
  UserCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';

const { Text } = Typography;

const PAGE_SIZE = 10;

const InvitationCard = ({
  userState,
  renderQuota,
  setOpenTransfer,
  affLink,
  handleAffLinkClick,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('invitees');

  const [invitees, setInvitees] = useState([]);
  const [inviteesTotal, setInviteesTotal] = useState(0);
  const [inviteesPage, setInviteesPage] = useState(1);
  const [inviteesLoading, setInviteesLoading] = useState(false);

  const [commissions, setCommissions] = useState([]);
  const [commissionsTotal, setCommissionsTotal] = useState(0);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  const fetchInvitees = (page) => {
    setInviteesLoading(true);
    API.get(
      `/api/user/aff/invitees?page=${page}&page_size=${PAGE_SIZE}`,
    )
      .then((res) => {
        if (res.data.success) {
          setInvitees(res.data.data?.items || []);
          setInviteesTotal(res.data.data?.total || 0);
        }
      })
      .finally(() => setInviteesLoading(false));
  };

  const fetchCommissions = (page) => {
    setCommissionsLoading(true);
    API.get(
      `/api/user/aff/commissions?page=${page}&page_size=${PAGE_SIZE}`,
    )
      .then((res) => {
        if (res.data.success) {
          setCommissions(res.data.data?.items || []);
          setCommissionsTotal(res.data.data?.total || 0);
        }
      })
      .finally(() => setCommissionsLoading(false));
  };

  useEffect(() => {
    fetchInvitees(1);
  }, []);

  useEffect(() => {
    if (activeTab === 'commissions' && commissions.length === 0 && !commissionsLoading) {
      fetchCommissions(1);
    }
  }, [activeTab]);

  const inviteeColumns = [
    {
      title: t('用户名'),
      dataIndex: 'username',
      width: 120,
    },
    {
      title: t('显示名称'),
      dataIndex: 'display_name',
      width: 120,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v) => (
        <Tag color={v === 1 ? 'green' : 'red'} size='small'>
          {v === 1 ? t('已启用') : t('已禁用')}
        </Tag>
      ),
      width: 80,
    },
    {
      title: t('返佣次数'),
      dataIndex: 'commission_count',
      width: 90,
    },
    {
      title: t('贡献收益'),
      dataIndex: 'total_earned',
      render: (v) => renderQuota(v),
    },
  ];

  const commissionColumns = [
    {
      title: t('时间'),
      dataIndex: 'created_at',
      render: (v) => new Date(v * 1000).toLocaleDateString(),
      width: 110,
    },
    {
      title: t('用户'),
      dataIndex: 'invitee_username',
      width: 120,
    },
    {
      title: t('充值金额'),
      dataIndex: 'recharge_amount',
      render: (v) => `$${v.toFixed(2)}`,
      width: 100,
    },
    {
      title: t('返佣比例'),
      dataIndex: 'commission_rate',
      render: (v) => `${v}%`,
      width: 90,
    },
    {
      title: t('获得额度'),
      dataIndex: 'commission_quota',
      render: (v) => renderQuota(v),
    },
  ];

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='green' className='mr-3 shadow-md'>
          <Gift size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('邀请奖励')}
          </Typography.Text>
          <div className='text-xs'>{t('邀请好友获得额外奖励')}</div>
        </div>
      </div>

      <Space vertical style={{ width: '100%' }}>
        <Card
          className='!rounded-xl w-full'
          cover={
            <div
              className='relative h-30'
              style={{
                '--palette-primary-darkerChannel': '0 75 80',
                backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className='relative z-10 h-full flex flex-col justify-between p-4'>
                <div className='flex justify-between items-center'>
                  <Text strong style={{ color: 'white', fontSize: '16px' }}>
                    {t('收益统计')}
                  </Text>
                  <Button
                    type='primary'
                    theme='solid'
                    size='small'
                    disabled={
                      !userState?.user?.aff_quota ||
                      userState?.user?.aff_quota <= 0
                    }
                    onClick={() => setOpenTransfer(true)}
                    className='!rounded-lg'
                  >
                    <Zap size={12} className='mr-1' />
                    {t('划转到余额')}
                  </Button>
                </div>

                <div className='grid grid-cols-3 gap-6 mt-4'>
                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {renderQuota(userState?.user?.aff_quota || 0)}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <TrendingUp
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '12px',
                        }}
                      >
                        {t('待使用收益')}
                      </Text>
                    </div>
                  </div>

                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {renderQuota(userState?.user?.aff_history_quota || 0)}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <BarChart2
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '12px',
                        }}
                      >
                        {t('总收益')}
                      </Text>
                    </div>
                  </div>

                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {userState?.user?.aff_count || 0}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <Users
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '12px',
                        }}
                      >
                        {t('邀请人数')}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <Input
            value={affLink}
            readonly
            className='!rounded-lg'
            prefix={t('邀请链接')}
            suffix={
              <Button
                type='primary'
                theme='solid'
                onClick={handleAffLinkClick}
                icon={<Copy size={14} />}
                className='!rounded-lg'
              >
                {t('复制')}
              </Button>
            }
          />
        </Card>

        <Card
          className='!rounded-xl w-full'
          title={<Text type='tertiary'>{t('奖励说明')}</Text>}
        >
          <div className='space-y-3'>
            <div className='flex items-start gap-2'>
              <Badge dot type='success' />
              <Text type='tertiary' className='text-sm'>
                {t('邀请好友注册，好友充值后您可获得相应奖励')}
              </Text>
            </div>

            <div className='flex items-start gap-2'>
              <Badge dot type='success' />
              <Text type='tertiary' className='text-sm'>
                {t('通过划转功能将奖励额度转入到您的账户余额中')}
              </Text>
            </div>

            <div className='flex items-start gap-2'>
              <Badge dot type='success' />
              <Text type='tertiary' className='text-sm'>
                {t('邀请的好友越多，获得的奖励越多')}
              </Text>
            </div>
          </div>
        </Card>

        <Tabs type='card' activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <div className='flex items-center gap-2'>
                <UserCheck size={16} />
                {t('受邀用户')}
              </div>
            }
            itemKey='invitees'
          >
            <div className='py-2'>
              <Spin spinning={inviteesLoading}>
                <Table
                  columns={inviteeColumns}
                  dataSource={invitees}
                  rowKey='id'
                  size='small'
                  pagination={{
                    currentPage: inviteesPage,
                    pageSize: PAGE_SIZE,
                    total: inviteesTotal,
                    showTotal: true,
                    onPageChange: (page) => {
                      setInviteesPage(page);
                      fetchInvitees(page);
                    },
                  }}
                  scroll={{ x: 'max-content' }}
                  empty={
                    <Text type='tertiary' className='text-sm'>
                      {t('暂无受邀用户')}
                    </Text>
                  }
                />
              </Spin>
            </div>
          </TabPane>
          <TabPane
            tab={
              <div className='flex items-center gap-2'>
                <BarChart2 size={16} />
                {t('返佣记录')}
              </div>
            }
            itemKey='commissions'
          >
            <div className='py-2'>
              <Spin spinning={commissionsLoading}>
                <Table
                  columns={commissionColumns}
                  dataSource={commissions}
                  rowKey='id'
                  size='small'
                  pagination={{
                    currentPage: commissionsPage,
                    pageSize: PAGE_SIZE,
                    total: commissionsTotal,
                    showTotal: true,
                    onPageChange: (page) => {
                      setCommissionsPage(page);
                      fetchCommissions(page);
                    },
                  }}
                  scroll={{ x: 'max-content' }}
                  empty={
                    <Text type='tertiary' className='text-sm'>
                      {t('暂无返佣记录')}
                    </Text>
                  }
                />
              </Spin>
            </div>
          </TabPane>
        </Tabs>
      </Space>
    </Card>
  );
};

export default InvitationCard;
