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

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  SideSheet,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCalendarClock,
  IconClose,
  IconCreditCard,
  IconPlusCircle,
  IconSave,
} from '@douyinfe/semi-icons';
import { Trash2, Clock, Boxes, RefreshCw } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

const durationUnitOptions = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '日' },
  { value: 'hour', label: '小时' },
  { value: 'custom', label: '自定义(秒)' },
];

const resetPeriodOptions = [
  { value: 'never', label: '不重置' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'custom', label: '自定义(秒)' },
];

const quotaTypeLabel = (quotaType) => (quotaType === 1 ? '按次' : '按量');

const AddEditSubscriptionModal = ({
  visible,
  handleClose,
  editingPlan,
  placement = 'left',
  pricingModels = [],
  refresh,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = editingPlan?.plan?.id !== undefined;
  const formKey = isEdit ? `edit-${editingPlan?.plan?.id}` : 'create';

  const getInitValues = () => ({
    title: '',
    subtitle: '',
    price_amount: 0,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    custom_seconds: 0,
    quota_reset_period: 'never',
    quota_reset_custom_seconds: 0,
    enabled: true,
    sort_order: 0,
    stripe_price_id: '',
    creem_product_id: '',
  });

  const [items, setItems] = useState([]);
  // Model benefits UX
  const [pendingModels, setPendingModels] = useState([]);
  const [defaultNewAmountTotal, setDefaultNewAmountTotal] = useState(0);
  const [bulkAmountTotal, setBulkAmountTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const buildFormValues = () => {
    const base = getInitValues();
    if (editingPlan?.plan?.id === undefined) return base;
    const p = editingPlan.plan || {};
    return {
      ...base,
      title: p.title || '',
      subtitle: p.subtitle || '',
      price_amount: Number(p.price_amount || 0),
      currency: p.currency || 'USD',
      duration_unit: p.duration_unit || 'month',
      duration_value: Number(p.duration_value || 1),
      custom_seconds: Number(p.custom_seconds || 0),
      quota_reset_period: p.quota_reset_period || 'never',
      quota_reset_custom_seconds: Number(p.quota_reset_custom_seconds || 0),
      enabled: p.enabled !== false,
      sort_order: Number(p.sort_order || 0),
      stripe_price_id: p.stripe_price_id || '',
      creem_product_id: p.creem_product_id || '',
    };
  };

  useEffect(() => {
    // 1) always keep items in sync
    if (visible && isEdit && editingPlan) {
      setItems((editingPlan.items || []).map((it) => ({ ...it })));
    } else if (visible && !isEdit) {
      setItems([]);
    }
  }, [visible, editingPlan]);

  const modelOptions = useMemo(() => {
    return (pricingModels || []).map((m) => ({
      label: `${m.model_name} (${quotaTypeLabel(m.quota_type)})`,
      value: m.model_name,
      quota_type: m.quota_type,
    }));
  }, [pricingModels]);

  const addItem = (modelName) => {
    const modelMeta = modelOptions.find((m) => m.value === modelName);
    if (!modelMeta) return;
    if (items.some((it) => it.model_name === modelName)) {
      showError(t('该模型已添加'));
      return;
    }
    setItems([
      ...items,
      {
        model_name: modelName,
        quota_type: modelMeta.quota_type,
        amount_total: 0,
      },
    ]);
  };

  const addPendingModels = () => {
    const selected = (pendingModels || []).filter(Boolean);
    if (selected.length === 0) {
      showError(t('请选择要添加的模型'));
      return;
    }
    const existing = new Set((items || []).map((it) => it.model_name));
    const toAdd = selected.filter((name) => !existing.has(name));
    if (toAdd.length === 0) {
      showError(t('所选模型已全部存在'));
      return;
    }
    const defaultAmount = Number(defaultNewAmountTotal || 0);
    const next = [...items];
    toAdd.forEach((modelName) => {
      const modelMeta = modelOptions.find((m) => m.value === modelName);
      if (!modelMeta) return;
      next.push({
        model_name: modelName,
        quota_type: modelMeta.quota_type,
        amount_total:
          Number.isFinite(defaultAmount) && defaultAmount >= 0
            ? defaultAmount
            : 0,
      });
    });
    setItems(next);
    setPendingModels([]);
    showSuccess(t('已添加'));
  };

  const applyBulkAmountTotal = ({ scope }) => {
    const n = Number(bulkAmountTotal || 0);
    if (!Number.isFinite(n) || n < 0) {
      showError(t('请输入有效的数量'));
      return;
    }
    if (!items || items.length === 0) {
      showError(t('请先添加模型权益'));
      return;
    }

    if (scope === 'selected') {
      if (!selectedRowKeys || selectedRowKeys.length === 0) {
        showError(t('请先勾选要批量设置的权益'));
        return;
      }
      const keySet = new Set(selectedRowKeys);
      setItems(
        items.map((it) => {
          const k = `${it.model_name}-${it.quota_type}`;
          if (!keySet.has(k)) return it;
          return { ...it, amount_total: n };
        }),
      );
      showSuccess(t('已对选中项批量设置'));
      return;
    }

    // scope === 'all'
    setItems(items.map((it) => ({ ...it, amount_total: n })));
    showSuccess(t('已对全部批量设置'));
  };

  const deleteSelectedItems = () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) {
      showError(t('请先勾选要删除的权益'));
      return;
    }
    const keySet = new Set(selectedRowKeys);
    const next = (items || []).filter(
      (it) => !keySet.has(`${it.model_name}-${it.quota_type}`),
    );
    setItems(next);
    setSelectedRowKeys([]);
    showSuccess(t('已删除选中项'));
  };

  const updateItem = (idx, patch) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const removeItem = (idx) => {
    const next = [...items];
    next.splice(idx, 1);
    setItems(next);
  };

  const submit = async (values) => {
    if (!values.title || values.title.trim() === '') {
      showError(t('套餐标题不能为空'));
      return;
    }
    const cleanedItems = items
      .filter((it) => it.model_name && Number(it.amount_total) > 0)
      .map((it) => ({
        model_name: it.model_name,
        quota_type: Number(it.quota_type || 0),
        amount_total: Number(it.amount_total),
      }));
    if (cleanedItems.length === 0) {
      showError(t('请至少配置一个模型权益（且数量>0）'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        plan: {
          ...values,
          price_amount: Number(values.price_amount || 0),
          duration_value: Number(values.duration_value || 0),
          custom_seconds: Number(values.custom_seconds || 0),
          quota_reset_period: values.quota_reset_period || 'never',
          quota_reset_custom_seconds:
            values.quota_reset_period === 'custom'
              ? Number(values.quota_reset_custom_seconds || 0)
              : 0,
          sort_order: Number(values.sort_order || 0),
        },
        items: cleanedItems,
      };
      if (editingPlan?.plan?.id) {
        const res = await API.put(
          `/api/subscription/admin/plans/${editingPlan.plan.id}`,
          payload,
        );
        if (res.data?.success) {
          showSuccess(t('更新成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/subscription/admin/plans', payload);
        if (res.data?.success) {
          showSuccess(t('创建成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('创建失败'));
        }
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = [
    {
      title: t('模型'),
      dataIndex: 'model_name',
      render: (v, row) => (
        <div className='text-sm'>
          <div className='font-medium'>{v}</div>
          <div className='text-xs text-gray-500'>
            {t('计费')}: {quotaTypeLabel(row.quota_type)}
          </div>
        </div>
      ),
    },
    {
      title: t('数量'),
      dataIndex: 'amount_total',
      width: 220,
      render: (v, row, idx) => (
        <InputNumber
          value={Number(v || 0)}
          min={0}
          precision={0}
          onChange={(val) => updateItem(idx, { amount_total: val })}
          placeholder={row.quota_type === 1 ? t('次数') : t('额度')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '',
      width: 60,
      render: (_, __, idx) => (
        <Button
          type='danger'
          theme='borderless'
          icon={<Trash2 size={14} />}
          onClick={() => removeItem(idx)}
        />
      ),
    },
  ];

  return (
    <>
      <SideSheet
        placement={placement}
        title={
          <Space>
            {isEdit ? (
              <Tag color='blue' shape='circle'>
                {t('更新')}
              </Tag>
            ) : (
              <Tag color='green' shape='circle'>
                {t('新建')}
              </Tag>
            )}
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新套餐信息') : t('创建新的订阅套餐')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={visible}
        width={isMobile ? '100%' : 700}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleClose}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={handleClose}
      >
        <Spin spinning={loading}>
          <Form
            key={formKey}
            initValues={buildFormValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2'>
                {/* 基本信息 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconCalendarClock size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('基本信息')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('套餐的基本信息和定价')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='title'
                        label={t('套餐标题')}
                        placeholder={t('例如：基础套餐')}
                        rules={[
                          { required: true, message: t('请输入套餐标题') },
                        ]}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='subtitle'
                        label={t('套餐副标题')}
                        placeholder={t('例如：适合轻度使用')}
                        showClear
                      />
                    </Col>

                    <Col span={12}>
                      <Form.InputNumber
                        field='price_amount'
                        label={t('实付金额')}
                        min={0}
                        precision={2}
                        rules={[{ required: true, message: t('请输入金额') }]}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={12}>
                      <Form.Select
                        field='currency'
                        label={t('币种')}
                        rules={[{ required: true }]}
                      >
                        <Select.Option value='USD'>USD</Select.Option>
                        <Select.Option value='EUR'>EUR</Select.Option>
                        <Select.Option value='CNY'>CNY</Select.Option>
                      </Form.Select>
                    </Col>

                    <Col span={12}>
                      <Form.InputNumber
                        field='sort_order'
                        label={t('排序')}
                        precision={0}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={12}>
                      <Form.Switch
                        field='enabled'
                        label={t('启用状态')}
                        size='large'
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 有效期设置 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='green'
                      className='mr-2 shadow-md'
                    >
                      <Clock size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('有效期设置')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('配置套餐的有效时长')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Select
                        field='duration_unit'
                        label={t('有效期单位')}
                        rules={[{ required: true }]}
                      >
                        {durationUnitOptions.map((o) => (
                          <Select.Option key={o.value} value={o.value}>
                            {o.label}
                          </Select.Option>
                        ))}
                      </Form.Select>
                    </Col>

                    <Col span={12}>
                      {values.duration_unit === 'custom' ? (
                        <Form.InputNumber
                          field='custom_seconds'
                          label={t('自定义秒数')}
                          min={0}
                          precision={0}
                          rules={[{ required: true, message: t('请输入秒数') }]}
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <Form.InputNumber
                          field='duration_value'
                          label={t('有效期数值')}
                          min={1}
                          precision={0}
                          rules={[{ required: true, message: t('请输入数值') }]}
                          style={{ width: '100%' }}
                        />
                      )}
                    </Col>
                  </Row>
                </Card>

                {/* 额度重置 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='orange'
                      className='mr-2 shadow-md'
                    >
                      <RefreshCw size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('额度重置')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('支持周期性重置套餐权益额度')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Select
                        field='quota_reset_period'
                        label={t('重置周期')}
                      >
                        {resetPeriodOptions.map((o) => (
                          <Select.Option key={o.value} value={o.value}>
                            {o.label}
                          </Select.Option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col span={12}>
                      {values.quota_reset_period === 'custom' ? (
                        <Form.InputNumber
                          field='quota_reset_custom_seconds'
                          label={t('自定义秒数')}
                          min={60}
                          precision={0}
                          rules={[{ required: true, message: t('请输入秒数') }]}
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <Form.InputNumber
                          field='quota_reset_custom_seconds'
                          label={t('自定义秒数')}
                          min={0}
                          precision={0}
                          style={{ width: '100%' }}
                          disabled
                        />
                      )}
                    </Col>
                  </Row>
                </Card>

                {/* 第三方支付配置 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='purple'
                      className='mr-2 shadow-md'
                    >
                      <IconCreditCard size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('第三方支付配置')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('Stripe/Creem 商品ID（可选）')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='stripe_price_id'
                        label='Stripe PriceId'
                        placeholder='price_...'
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='creem_product_id'
                        label='Creem ProductId'
                        placeholder='prod_...'
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 模型权益 */}
                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center justify-between mb-3 gap-3'>
                    <div className='flex items-center'>
                      <Avatar
                        size='small'
                        color='orange'
                        className='mr-2 shadow-md'
                      >
                        <Boxes size={16} />
                      </Avatar>
                      <div>
                        <Text className='text-lg font-medium'>
                          {t('模型权益')}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {t('配置套餐可使用的模型及额度')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 工具栏：最少步骤完成“添加 + 批量设置” */}
                  <div className='flex flex-col gap-2 mb-3'>
                    <div className='flex flex-col md:flex-row gap-2 md:items-center'>
                      <Select
                        placeholder={t('选择模型（可多选）')}
                        multiple
                        filter
                        value={pendingModels}
                        onChange={setPendingModels}
                        style={{ width: '100%', flex: 1 }}
                      >
                        {modelOptions.map((o) => (
                          <Select.Option key={o.value} value={o.value}>
                            {o.label}
                          </Select.Option>
                        ))}
                      </Select>
                      <InputNumber
                        value={Number(defaultNewAmountTotal || 0)}
                        min={0}
                        precision={0}
                        onChange={(v) => setDefaultNewAmountTotal(v)}
                        style={{ width: isMobile ? '100%' : 180 }}
                        placeholder={t('默认数量')}
                      />
                      <Button
                        theme='solid'
                        type='primary'
                        icon={<IconPlusCircle />}
                        onClick={addPendingModels}
                      >
                        {t('添加')}
                      </Button>
                    </div>

                    <div className='flex flex-col md:flex-row gap-2 md:items-center md:justify-between'>
                      <div className='flex items-center gap-2'>
                        <Tag color='white' shape='circle'>
                          {t('已选')} {selectedRowKeys?.length || 0}
                        </Tag>
                        <InputNumber
                          value={Number(bulkAmountTotal || 0)}
                          min={0}
                          precision={0}
                          onChange={(v) => setBulkAmountTotal(v)}
                          style={{ width: isMobile ? '100%' : 220 }}
                          placeholder={t('统一设置数量')}
                        />
                      </div>
                      <div className='flex items-center gap-2 justify-end'>
                        <Button
                          theme='light'
                          type='primary'
                          onClick={() =>
                            applyBulkAmountTotal({ scope: 'selected' })
                          }
                        >
                          {t('应用到选中')}
                        </Button>
                        <Button
                          theme='light'
                          type='primary'
                          onClick={() => applyBulkAmountTotal({ scope: 'all' })}
                        >
                          {t('应用到全部')}
                        </Button>
                        <Button
                          theme='light'
                          type='danger'
                          icon={<Trash2 size={14} />}
                          onClick={deleteSelectedItems}
                        >
                          {t('删除选中')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Table
                    columns={itemColumns}
                    dataSource={items}
                    pagination={false}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: (keys) => setSelectedRowKeys(keys || []),
                    }}
                    rowKey={(row) => `${row.model_name}-${row.quota_type}`}
                    empty={
                      <div className='py-6 text-center text-gray-500'>
                        {t('尚未添加任何模型')}
                      </div>
                    }
                  />
                </Card>
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default AddEditSubscriptionModal;
