import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Empty, Typography, Toast } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API } from '../../../helpers';
import { renderQuota } from '../../../helpers';

const { Text } = Typography;

const AffInviteesModal = ({ visible, onCancel, t }) => {
  const [loading, setLoading] = useState(false);
  const [invitees, setInvitees] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const loadInvitees = async (currentPage, currentPageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/aff/invitees?p=${currentPage}&page_size=${currentPageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setInvitees(data?.items || []);
        setTotal(data?.total || 0);
      } else {
        Toast.error({ content: message || t('加载邀请明细失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载邀请明细失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    loadInvitees(page, pageSize);
  }, [visible, page, pageSize]);

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        render: (id) => <Text>{id}</Text>,
      },
      {
        title: t('用户名'),
        dataIndex: 'username',
        render: (username) => <Text>{username || '-'}</Text>,
      },
      {
        title: t('显示名称'),
        dataIndex: 'display_name',
        render: (displayName) => <Text>{displayName || '-'}</Text>,
      },
      {
        title: t('邮箱'),
        dataIndex: 'email',
        render: (email) => <Text>{email || '-'}</Text>,
      },
      {
        title: t('剩余额度'),
        dataIndex: 'quota',
        render: (quota) => <Text>{renderQuota(quota || 0)}</Text>,
      },
      {
        title: t('已用额度'),
        dataIndex: 'used_quota',
        render: (usedQuota) => <Text>{renderQuota(usedQuota || 0)}</Text>,
      },
    ],
    [t],
  );

  return (
    <Modal
      title={t('邀请明细')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size='large'
    >
      <Table
        rowKey='id'
        columns={columns}
        dataSource={invitees}
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50, 100],
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无邀请记录')}
            style={{ padding: 30 }}
          />
        }
      />
    </Modal>
  );
};

export default AffInviteesModal;
