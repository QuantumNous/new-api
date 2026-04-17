import React from 'react';
import {
  Button,
  Input,
  Select,
  SideSheet,
  Space,
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const PoolPolicyFormSideSheet = ({
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
            {isEdit ? t('Update Pool Policy') : t('Create Pool Policy')}
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
          placeholder='metric'
          value={formData.metric}
          onChange={(value) => setFormData((prev) => ({ ...prev, metric: value }))}
        />
        <Select
          value={formData.scope_type}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, scope_type: value }))
          }
        >
          <Select.Option value='token'>token</Select.Option>
          <Select.Option value='user'>user</Select.Option>
        </Select>
        <Input
          placeholder='window_seconds'
          value={String(formData.window_seconds)}
          onChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              window_seconds: Number(value || 0),
            }))
          }
        />
        <Input
          placeholder='limit_count'
          value={String(formData.limit_count)}
          onChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              limit_count: Number(value || 0),
            }))
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

export default PoolPolicyFormSideSheet;
