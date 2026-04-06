import React, { useEffect, useMemo, useState } from 'react';
import {
  Empty,
  SideSheet,
  Space,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showError } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import CardTable from '../../../common/ui/CardTable';

const { Text } = Typography;

const InvitedUsersModal = ({ visible, onCancel, user, t }) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [invitees, setInvitees] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const pagedInvitees = useMemo(() => {
    const start = Math.max(0, (Number(currentPage || 1) - 1) * pageSize);
    const end = start + pageSize;
    return (invitees || []).slice(start, end);
  }, [invitees, currentPage]);

  const loadInvitees = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/${user.id}/invitees`);
      if (res.data?.success) {
        setInvitees(res.data.data || []);
        setCurrentPage(1);
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setCurrentPage(1);
    loadInvitees();
  }, [visible]);

  const columns = useMemo(() => {
    return [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 70,
      },
      {
        title: t('用户名'),
        dataIndex: 'username',
        width: 120,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 80,
        render: (text) => {
          if (text === 1) {
            return (
              <Tag color='green' shape='circle' size='small'>
                {t('已启用')}
              </Tag>
            );
          } else if (text === 2) {
            return (
              <Tag color='red' shape='circle' size='small'>
                {t('已禁用')}
              </Tag>
            );
          }
          return (
            <Tag color='grey' shape='circle' size='small'>
              {t('未知状态')}
            </Tag>
          );
        },
      },
      {
        title: t('注册时间'),
        dataIndex: 'created_at',
        width: 170,
        render: (text) => {
          if (!text) return '-';
          const d = new Date(text * 1000);
          return d.toLocaleString();
        },
      },
      {
        title: t('注册IP'),
        dataIndex: 'register_ip',
        width: 140,
        render: (text) => text || '-',
      },
      {
        title: t('浏览器'),
        dataIndex: 'register_ua',
        width: 200,
        render: (text) => {
          if (!text) return '-';
          const maxLen = 40;
          const display = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
          return (
            <Tooltip content={text} position='top' style={{ maxWidth: 400 }}>
              <span className='text-xs'>{display}</span>
            </Tooltip>
          );
        },
      },
    ];
  }, [t]);

  return (
    <SideSheet
      visible={visible}
      placement='right'
      width={isMobile ? '100%' : 800}
      bodyStyle={{ padding: 0 }}
      onCancel={onCancel}
      title={
        <Space>
          <Tag color='blue' shape='circle'>
            {t('邀请')}
          </Tag>
          <Typography.Title heading={4} className='m-0'>
            {t('被邀请用户列表')}
          </Typography.Title>
          <Text type='tertiary' className='ml-2'>
            {user?.username || '-'} (ID: {user?.id || '-'})
          </Text>
        </Space>
      }
    >
      <div className='p-4'>
        <CardTable
          columns={columns}
          dataSource={pagedInvitees}
          rowKey={(row) => row?.id}
          loading={loading}
          scroll={{ x: 'max-content' }}
          hidePagination={false}
          pagination={{
            currentPage,
            pageSize,
            total: invitees.length,
            pageSizeOpts: [10, 20, 50],
            showSizeChanger: false,
            onPageChange: (page) => setCurrentPage(page),
          }}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('暂无被邀请用户')}
              style={{ padding: 30 }}
            />
          }
          size='middle'
        />
      </div>
    </SideSheet>
  );
};

export default InvitedUsersModal;
