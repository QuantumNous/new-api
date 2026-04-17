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

const PoolBindingFormSideSheet = ({
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
            {isEdit ? t('Update Pool Binding') : t('Create Pool Binding')}
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
        <Select
          value={formData.binding_type}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, binding_type: value }))
          }
        >
          <Select.Option value='token'>token</Select.Option>
          <Select.Option value='user'>user</Select.Option>
          <Select.Option value='group'>group</Select.Option>
          <Select.Option value='default'>default</Select.Option>
          <Select.Option value='subscription_plan'>subscription_plan</Select.Option>
        </Select>
        <Input
          placeholder={
            formData.binding_type === 'token'
              ? 'token_id'
              : formData.binding_type === 'user'
                ? 'user_id'
                : formData.binding_type === 'group'
                  ? 'group'
                  : formData.binding_type === 'subscription_plan'
                    ? 'subscription_plan'
                    : 'binding_value'
          }
          value={formData.binding_value}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, binding_value: value }))
          }
        />
        <Input
          placeholder='pool_id'
          value={formData.pool_id}
          onChange={(value) => setFormData((prev) => ({ ...prev, pool_id: value }))}
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

export default PoolBindingFormSideSheet;
