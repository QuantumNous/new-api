import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  TextArea,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { CHANNEL_OPTIONS } from '../../../../constants/channel.constants';
import {
  getChannelModels,
  loadChannelModels,
  API,
  buildGroupOptions,
  showError,
} from '../../../../helpers';

const DEFAULT_TYPE = 14;

const emptyForm = {
  type: DEFAULT_TYPE,
  name: '',
  key: '',
  base_url: '',
  models: '',
  group: 'default',
  balance: 0,
  priority: 0,
  weight: 0,
  tag: '',
  remark: '',
  note: '',
};

const getModelText = (type) => getChannelModels(type).join(',');

const EditPreparationModal = ({ visible, preparation, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [groupOptions, setGroupOptions] = useState([
    { label: 'default', value: 'default' },
  ]);

  const isEdit = Boolean(preparation?.id);

  useEffect(() => {
    if (!visible) return;
    loadChannelModels().catch(() => {});
    API.get('/api/group/')
      .then((res) => {
        if (res.data.success) {
          setGroupOptions(buildGroupOptions(res.data.data));
        }
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (preparation) {
      setForm({
        ...emptyForm,
        ...preparation,
        key: '',
        base_url: preparation.base_url || '',
        tag: preparation.tag || '',
        remark: preparation.remark || '',
        note: preparation.note || '',
        priority: preparation.priority ?? 0,
        weight: preparation.weight ?? 0,
        group: preparation.group || 'default',
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [visible, preparation]);

  const typeOptions = useMemo(
    () =>
      CHANNEL_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    [],
  );

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleTypeChange = (value) => {
    const models = getModelText(value);
    setForm((prev) => ({
      ...prev,
      type: value,
      models: prev.models || models,
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showError(t('名称不能为空'));
      return;
    }
    if (!isEdit && !form.key.trim()) {
      showError(t('Key 不能为空'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        id: preparation?.id,
        type: Number(form.type),
        balance: Number(form.balance) || 0,
        priority: Number(form.priority) || 0,
        weight: Number(form.weight) || 0,
        base_url: form.base_url ? form.base_url : undefined,
        tag: form.tag ? form.tag : undefined,
        remark: form.remark ? form.remark : undefined,
      };
      await onSubmit(payload);
    } catch (error) {
      showError(error.message || t('保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? t('编辑候选渠道') : t('添加候选渠道')}
      visible={visible}
      onCancel={onCancel}
      footer={
        <div className='flex justify-end gap-2'>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button type='primary' loading={submitting} onClick={handleSubmit}>
            {t('保存')}
          </Button>
        </div>
      }
      style={{ width: 720 }}
    >
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        <div>
          <div className='mb-1 font-semibold'>{t('渠道类型')}</div>
          <Select
            value={form.type}
            optionList={typeOptions}
            onChange={handleTypeChange}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>{t('名称')}</div>
          <Input
            value={form.name}
            onChange={(value) => update('name', value)}
          />
        </div>
        <div className='md:col-span-2'>
          <div className='mb-1 font-semibold'>Key</div>
          <TextArea
            value={form.key}
            onChange={(value) => update('key', value)}
            placeholder={isEdit ? t('留空则保留原 Key') : ''}
            rows={3}
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>Base URL</div>
          <Input
            value={form.base_url}
            onChange={(value) => update('base_url', value)}
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>{t('分组')}</div>
          <Select
            value={form.group}
            optionList={groupOptions}
            onChange={(value) => update('group', value || 'default')}
            style={{ width: '100%' }}
          />
        </div>
        <div className='md:col-span-2'>
          <div className='mb-1 font-semibold'>{t('模型')}</div>
          <TextArea
            value={form.models}
            onChange={(value) => update('models', value)}
            rows={2}
            placeholder={
              getModelText(form.type) || t('不填则使用 Claude 默认模型')
            }
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>{t('余额')}</div>
          <InputNumber
            value={form.balance}
            onChange={(value) => update('balance', value ?? 0)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>{t('优先级')}</div>
          <InputNumber
            value={form.priority}
            onChange={(value) => update('priority', value ?? 0)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>{t('权重')}</div>
          <InputNumber
            value={form.weight}
            min={0}
            onChange={(value) => update('weight', value ?? 0)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div className='mb-1 font-semibold'>Tag</div>
          <Input value={form.tag} onChange={(value) => update('tag', value)} />
        </div>
        <div className='md:col-span-2'>
          <div className='mb-1 font-semibold'>{t('备注')}</div>
          <TextArea
            value={form.note || form.remark}
            onChange={(value) => update('note', value)}
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
};

export default EditPreparationModal;
