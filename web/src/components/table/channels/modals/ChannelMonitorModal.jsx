import React, { useEffect, useState } from 'react';
import { Modal, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../../../helpers';

const { Text } = Typography;

const ChannelMonitorModal = ({ visible, channel, onCancel }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  const columns = [
    {
      title: t('模型'),
      dataIndex: 'model_name',
      key: 'model_name',
      render: (text) => <Tag color='blue'>{text}</Tag>,
    },
    {
      title: t('RPM (当前/限制)'),
      dataIndex: 'current_rpm',
      key: 'rpm',
      render: (text, record) => (
        <Text>
          {text} / {record.limit_rpm > 0 ? record.limit_rpm : t('无限制')}
        </Text>
      ),
    },
    {
      title: t('TPM (当前/限制)'),
      dataIndex: 'current_tpm',
      key: 'tpm',
      render: (text, record) => (
        <Text>
          {text} / {record.limit_tpm > 0 ? record.limit_tpm : t('无限制')}
        </Text>
      ),
    },
    {
      title: t('RPD (当前/限制)'),
      dataIndex: 'current_rpd',
      key: 'rpd',
      render: (text, record) => (
        <Text>
          {text} / {record.limit_rpd > 0 ? record.limit_rpd : t('无限制')}
        </Text>
      ),
    },
  ];

  const fetchData = async () => {
    if (!channel?.id) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/channel/${channel.id}/monitor`);
      const { success, message, data } = res.data;
      if (success) {
        setData(data);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && channel) {
      fetchData();
    }
  }, [visible, channel]);

  return (
    <Modal
      title={`${t('渠道速率监控')} - ${channel?.name}`}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size='large'
      style={{ maxWidth: '90vw' }}
    >
      <Table
        dataSource={data}
        columns={columns}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
      />
    </Modal>
  );
};

export default ChannelMonitorModal;

