import React from 'react';
import {
  Button,
  Input,
  SideSheet,
  Space,
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const PoolChannelFormSideSheet = ({
  visible,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  t,
}) => {
  const isEdit = Number(formData?.id || 0) > 0;

  return (
    <SideSheet
      visible={visible}
      placement={isEdit ? 'right' : 'left'}
      onCancel={onCancel}
      closeIcon={null}
      title={
        <Space>
          <Tag color={isEdit ? 'blue' : 'green'} shape='circle'>
            {isEdit ? t('Update') : t('Create')}
          </Tag>
          <Title heading={4} className='m-0'>
            {isEdit ? t('Update Pool Channel') : t('Create Pool Channel')}
          </Title>
        </Space>
      }
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button theme='solid' type='primary' onClick={onSubmit}>
              {isEdit ? t('Update') : t('Create')}
            </Button>
            <Button theme='light' onClick={onCancel}>
              {t('Cancel')}
            </Button>
          </Space>
        </div>
      }
      width={560}
    >
      <div className='p-4 space-y-3'>
        <Input
          placeholder='pool_id'
          value={formData.pool_id}
          onChange={(value) => setFormData((prev) => ({ ...prev, pool_id: value }))}
        />
        <Input
          placeholder='channel_id'
          value={formData.channel_id}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, channel_id: value }))
          }
        />
        <Input
          placeholder='weight'
          value={String(formData.weight)}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, weight: Number(value || 0) }))
          }
        />
        <Input
          placeholder='priority'
          value={String(formData.priority)}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, priority: Number(value || 0) }))
          }
        />
        <div className='flex items-center gap-2'>
          <Text type='secondary'>Enabled</Text>
          <Switch
            checked={formData.enabled}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, enabled: Boolean(value) }))
            }
          />
        </div>
      </div>
    </SideSheet>
  );
};

export default PoolChannelFormSideSheet;
