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
  Button,
  Card,
  Form,
  InputNumber,
  Modal,
  Switch,
  Table,
  Typography,
  Space,
  Popconfirm,
  Banner,
  Input,
  Collapse,
  Tag,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconEdit, IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, getQuotaPerUnit } from '../../../helpers';

const { Text, Title } = Typography;

// 获取1倍率对应的基础价格 (USD/1M tokens)
// quotaPerUnit 默认为 500000，表示 $0.002 / 1K tokens = $2 / 1M tokens
// 公式: 1 / (quotaPerUnit / 1000000) = 1000000 / quotaPerUnit
const getRatioBasePrice = () => {
  const quotaPerUnit = getQuotaPerUnit() || 500000;
  return 1000000 / quotaPerUnit;
};

// 默认规则模板
const defaultRule = {
  name: '',
  min_input_tokens: 0,
  max_input_tokens: 0,
  min_output_tokens: 0,
  max_output_tokens: 0,
  input_price: 0,
  output_price: 0,
  input_ratio: 0,
  completion_ratio: 1.0,
};

// 默认分段计费规则模板（使用倍率模式）
const defaultTierRules = [
  {
    name: 'T1_input_le_32k_output_le_200',
    min_input_tokens: 0,
    max_input_tokens: 32000,
    min_output_tokens: 0,
    max_output_tokens: 200,
    input_ratio: 0.4,
    completion_ratio: 1.0,
    input_price: 0,
    output_price: 0,
  },
  {
    name: 'T2_input_le_32k_output_gt_200',
    min_input_tokens: 0,
    max_input_tokens: 32000,
    min_output_tokens: 201,
    max_output_tokens: 0,
    input_ratio: 0.4,
    completion_ratio: 1.5,
    input_price: 0,
    output_price: 0,
  },
  {
    name: 'T3_input_32k_to_128k',
    min_input_tokens: 32001,
    max_input_tokens: 128000,
    min_output_tokens: 0,
    max_output_tokens: 0,
    input_ratio: 0.6,
    completion_ratio: 1.0,
    input_price: 0,
    output_price: 0,
  },
  {
    name: 'T4_input_gt_128k',
    min_input_tokens: 128001,
    max_input_tokens: 0,
    min_output_tokens: 0,
    max_output_tokens: 0,
    input_ratio: 1.2,
    completion_ratio: 1.0,
    input_price: 0,
    output_price: 0,
  },
];

export default function TokenTierPricingSettings({ options, refresh }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // 模型配置弹窗
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [editingModelName, setEditingModelName] = useState('');
  const [editingModelConfig, setEditingModelConfig] = useState(null);
  const [isNewModel, setIsNewModel] = useState(true);

  // 规则编辑弹窗
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editingRuleIndex, setEditingRuleIndex] = useState(-1);
  const [pricingSubMode, setPricingSubMode] = useState('ratio'); // 'ratio' or 'price'

  // 配置状态
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [modelConfigs, setModelConfigs] = useState({});

  // 从 options 中解析配置
  useEffect(() => {
    if (options) {
      // 解析 global_enabled
      const enabledValue = options['token_tier_pricing.global_enabled'];
      setGlobalEnabled(enabledValue === 'true' || enabledValue === true);

      // 解析 model_configs
      const configsValue = options['token_tier_pricing.model_configs'];
      if (configsValue) {
        try {
          const parsed = typeof configsValue === 'string'
            ? JSON.parse(configsValue)
            : configsValue;
          setModelConfigs(parsed || {});
        } catch (e) {
          setModelConfigs({});
        }
      }
    }
  }, [options]);

  // 保存单个配置项
  const saveOption = async (key, value) => {
    try {
      const res = await API.put('/api/option/', { key, value });
      if (!res.data.success) {
        showError(res.data.message || t('保存失败'));
        return false;
      }
      return true;
    } catch (error) {
      showError(t('保存失败'));
      return false;
    }
  };

  // 保存全局开关
  const handleGlobalEnabledChange = async (checked) => {
    setLoading(true);
    const success = await saveOption('token_tier_pricing.global_enabled', String(checked));
    if (success) {
      setGlobalEnabled(checked);
      showSuccess(t('保存成功'));
    }
    setLoading(false);
  };

  // 保存模型配置
  const saveModelConfigs = async (newConfigs) => {
    setLoading(true);
    const success = await saveOption('token_tier_pricing.model_configs', JSON.stringify(newConfigs));
    if (success) {
      setModelConfigs(newConfigs);
      showSuccess(t('保存成功'));
      refresh();
    }
    setLoading(false);
    return success;
  };

  // 打开添加模型弹窗
  const handleAddModel = () => {
    // 计算新配置的优先级（比现有最大优先级大1）
    const maxPriority = Math.max(0, ...Object.values(modelConfigs).map(c => c.priority ?? 0));
    setEditingModelName('');
    setEditingModelConfig({
      enabled: true,
      models: '',
      priority: maxPriority + 1,
      rules: [...defaultTierRules],
    });
    setIsNewModel(true);
    setModelModalVisible(true);
  };

  // 打开编辑模型弹窗
  const handleEditModel = (modelName) => {
    setEditingModelName(modelName);
    setEditingModelConfig({ ...modelConfigs[modelName] });
    setIsNewModel(false);
    setModelModalVisible(true);
  };

  // 复制模型配置
  const handleCopyModel = (modelName) => {
    // 复制时保持原配置的优先级+1
    const originalPriority = modelConfigs[modelName]?.priority ?? 0;
    const maxPriority = Math.max(0, ...Object.values(modelConfigs).map(c => c.priority ?? 0));
    setEditingModelName(modelName + '_copy');
    setEditingModelConfig({
      ...modelConfigs[modelName],
      priority: Math.max(originalPriority + 1, maxPriority + 1),
    });
    setIsNewModel(true);
    setModelModalVisible(true);
  };

  // 删除模型配置
  const handleDeleteModel = async (modelName) => {
    const newConfigs = { ...modelConfigs };
    delete newConfigs[modelName];
    await saveModelConfigs(newConfigs);
  };

  // 保存模型配置
  const handleSaveModel = async () => {
    if (!editingModelName) {
      showError(t('请输入模型名称'));
      return;
    }

    // 检查配置名称是否重复（仅在新建时检查）
    if (isNewModel && modelConfigs[editingModelName]) {
      showError(t('配置名称已存在，请使用其他名称'));
      return;
    }

    const newConfigs = { ...modelConfigs };
    newConfigs[editingModelName] = editingModelConfig;

    const success = await saveModelConfigs(newConfigs);
    if (success) {
      setModelModalVisible(false);
    }
  };

  // 切换模型启用状态
  const handleToggleModelEnabled = async (modelName, enabled) => {
    const newConfigs = { ...modelConfigs };
    newConfigs[modelName] = { ...newConfigs[modelName], enabled };
    await saveModelConfigs(newConfigs);
  };

  // 打开添加规则弹窗
  const handleAddRule = () => {
    setEditingRule({
      ...defaultRule,
      inputPrice: 0,
      outputPrice: 0,
    });
    setEditingRuleIndex(-1);
    setPricingSubMode('ratio');
    setRuleModalVisible(true);
  };

  // 打开编辑规则弹窗
  const handleEditRule = (rule, index) => {
    const ruleWithPrice = { ...rule };
    const ratioBasePrice = getRatioBasePrice();

    // 从倍率计算价格用于显示
    if (rule.input_ratio > 0) {
      ruleWithPrice.inputPrice = rule.input_ratio * ratioBasePrice;
      if (rule.completion_ratio > 0) {
        ruleWithPrice.outputPrice = rule.input_ratio * ratioBasePrice * rule.completion_ratio;
      }
    }

    setEditingRule(ruleWithPrice);
    setEditingRuleIndex(index);
    setPricingSubMode('ratio');
    setRuleModalVisible(true);
  };

  // 删除规则
  const handleDeleteRule = (index) => {
    const newRules = editingModelConfig.rules.filter((_, i) => i !== index);
    setEditingModelConfig({ ...editingModelConfig, rules: newRules });
  };

  // 保存规则
  const handleSaveRule = () => {
    if (!editingRule.name) {
      showError(t('请填写规则名称'));
      return;
    }

    // 验证规则名称是否重复
    const existingRuleIndex = editingModelConfig.rules.findIndex(
      (r, i) => r.name === editingRule.name && i !== editingRuleIndex
    );
    if (existingRuleIndex !== -1) {
      showError(t('规则名称已存在，请使用其他名称'));
      return;
    }

    // 验证 Token 范围：如果设置了最大值，最小值不能大于最大值
    if (editingRule.max_input_tokens > 0 && editingRule.min_input_tokens > editingRule.max_input_tokens) {
      showError(t('最小输入Token不能大于最大输入Token'));
      return;
    }
    if (editingRule.max_output_tokens > 0 && editingRule.min_output_tokens > editingRule.max_output_tokens) {
      showError(t('最小输出Token不能大于最大输出Token'));
      return;
    }

    const ruleToSave = { ...editingRule };

    // 如果是价格模式,需要从价格计算倍率
    if (pricingSubMode === 'price') {
      if (editingRule.inputPrice > 0) {
        ruleToSave.input_ratio = editingRule.inputPrice / 2;
      } else {
        ruleToSave.input_ratio = 0;
      }

      if (editingRule.outputPrice > 0 && editingRule.inputPrice > 0) {
        ruleToSave.completion_ratio = editingRule.outputPrice / editingRule.inputPrice;
      } else {
        ruleToSave.completion_ratio = 1.0;
      }
    }

    // 确保清空价格字段(只保存倍率)
    ruleToSave.input_price = 0;
    ruleToSave.output_price = 0;
    delete ruleToSave.inputPrice;
    delete ruleToSave.outputPrice;

    let newRules;
    if (editingRuleIndex === -1) {
      newRules = [...editingModelConfig.rules, ruleToSave];
    } else {
      newRules = editingModelConfig.rules.map((r, i) => (i === editingRuleIndex ? ruleToSave : r));
    }

    setEditingModelConfig({ ...editingModelConfig, rules: newRules });
    setRuleModalVisible(false);
  };

  // 上移规则
  const handleMoveRuleUp = (index) => {
    if (index === 0) return;
    const newRules = [...editingModelConfig.rules];
    [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    setEditingModelConfig({ ...editingModelConfig, rules: newRules });
  };

  // 下移规则
  const handleMoveRuleDown = (index) => {
    if (index === editingModelConfig.rules.length - 1) return;
    const newRules = [...editingModelConfig.rules];
    [newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]];
    setEditingModelConfig({ ...editingModelConfig, rules: newRules });
  };

  // 使用默认规则模板
  const handleUseDefaultRules = () => {
    setEditingModelConfig({ ...editingModelConfig, rules: [...defaultTierRules] });
  };

  // 格式化 token 范围显示
  const formatTokenRange = (min, max) => {
    if (min === 0 && max === 0) return t('无限制');
    if (min === 0) return `≤ ${max.toLocaleString()}`;
    if (max === 0) return `≥ ${min.toLocaleString()}`;
    return `${min.toLocaleString()} - ${max.toLocaleString()}`;
  };

  // 规则表格列定义
  const ruleColumns = [
    {
      title: t('规则名称'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('输入Token范围'),
      key: 'input_range',
      render: (_, record) => formatTokenRange(record.min_input_tokens, record.max_input_tokens),
    },
    {
      title: t('输出Token范围'),
      key: 'output_range',
      render: (_, record) => formatTokenRange(record.min_output_tokens, record.max_output_tokens),
    },
    {
      title: t('计费倍率'),
      key: 'pricing',
      render: (_, record) => {
        const inputRatio = record.input_ratio || 0;
        const completionRatio = record.completion_ratio || 1.0;
        const ratioBasePrice = getRatioBasePrice();
        const inputPrice = (inputRatio * ratioBasePrice).toFixed(6);
        const outputPrice = (inputRatio * completionRatio * ratioBasePrice).toFixed(6);

        return (
          <div>
            <div>
              <Text>输入: {inputRatio.toFixed(2)}倍率</Text>
              <Text type="tertiary" size="small" style={{ marginLeft: 8 }}>
                (${inputPrice}/1M)
              </Text>
            </div>
            <div>
              <Text>输出: {completionRatio.toFixed(2)}倍率</Text>
              <Text type="tertiary" size="small" style={{ marginLeft: 8 }}>
                (${outputPrice}/1M)
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: t('操作'),
      key: 'actions',
      render: (_, record, index) => (
        <Space>
          <Button icon={<IconEdit />} size="small" onClick={() => handleEditRule(record, index)} />
          <Popconfirm title={t('确定删除此规则吗？')} onConfirm={() => handleDeleteRule(index)}>
            <Button icon={<IconDelete />} size="small" type="danger" />
          </Popconfirm>
          <Button size="small" disabled={index === 0} onClick={() => handleMoveRuleUp(index)}>↑</Button>
          <Button size="small" disabled={index === editingModelConfig?.rules?.length - 1} onClick={() => handleMoveRuleDown(index)}>↓</Button>
        </Space>
      ),
    },
  ];

  // 模型列表（按优先级排序）
  const modelList = Object.entries(modelConfigs)
    .map(([name, config]) => ({
      name,
      ...config,
    }))
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  return (
    <div style={{ padding: '20px' }}>
      <Banner
        type="info"
        description={t('分段计费使用倍率模式计费（1倍率 = $2/1M tokens）。您可以为每个配置设置多个模型（逗号分割，支持通配符*），根据输入/输出Token数量的不同范围使用不同的倍率。规则按顺序匹配，第一条匹配的规则将被使用。支持通过价格快速计算倍率。')}
        style={{ marginBottom: 20 }}
      />

      {/* 全局开关 */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title heading={5}>{t('启用分段计费')}</Title>
            <Text type="tertiary">{t('全局开关，关闭后所有模型的分段计费都将禁用')}</Text>
          </div>
          <Switch checked={globalEnabled} onChange={handleGlobalEnabledChange} loading={loading} />
        </div>
      </Card>

      {/* 模型配置列表 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title heading={5}>{t('模型计费配置')}</Title>
          <Button icon={<IconPlus />} onClick={handleAddModel}>{t('添加模型')}</Button>
        </div>

        {modelList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            {t('暂无配置，点击"添加模型"开始配置')}
          </div>
        ) : (
          <Collapse>
            {modelList.map((model) => (
              <Collapse.Panel
                key={model.name}
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Tag color="blue" size="small">#{model.priority ?? 0}</Tag>
                    <Text strong>{model.name}</Text>
                    <Tag color={model.enabled ? 'green' : 'grey'}>
                      {model.enabled ? t('已启用') : t('已禁用')}
                    </Tag>
                    <Text type="tertiary">({t('条规则', { count: model.rules?.length || 0 })})</Text>
                  </div>
                }
                itemKey={model.name}
              >
                <Space style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Space>
                    <Button icon={<IconEdit />} onClick={() => handleEditModel(model.name)}>{t('编辑')}</Button>
                    <Button icon={<IconCopy />} onClick={() => handleCopyModel(model.name)}>{t('复制')}</Button>
                    <Popconfirm title={t('确定删除此模型配置吗？')} onConfirm={() => handleDeleteModel(model.name)}>
                      <Button icon={<IconDelete />} type="danger">{t('删除')}</Button>
                    </Popconfirm>
                  </Space>
                  <Switch
                    checked={model.enabled}
                    onChange={(checked) => handleToggleModelEnabled(model.name, checked)}
                    size="large"
                  />
                </Space>

                <Table
                  columns={ruleColumns.slice(0, -1)}
                  dataSource={model.rules || []}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              </Collapse.Panel>
            ))}
          </Collapse>
        )}
      </Card>

      {/* 模型配置弹窗 */}
      <Modal
        title={isNewModel ? t('添加模型计费配置') : t('编辑模型计费配置')}
        visible={modelModalVisible}
        onCancel={() => setModelModalVisible(false)}
        onOk={handleSaveModel}
        okText={t('保存')}
        cancelText={t('取消')}
        width={1000}
        style={{ maxHeight: '85vh' }}
        bodyStyle={{ maxHeight: '65vh', overflow: 'auto', padding: '24px' }}
      >
        {editingModelConfig && (
          <>
            <Form labelPosition="left" labelWidth={120} style={{ marginBottom: 24 }}>
              <Form.Slot label={t('配置名称')} style={{ marginBottom: 20 }}>
                <Input
                  value={editingModelName}
                  onChange={(value) => setEditingModelName(value)}
                  placeholder={t('例如: GPT-4系列')}
                  disabled={!isNewModel}
                  size="large"
                />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                  {t('给这个配置起一个名字，方便管理')}
                </Text>
              </Form.Slot>
              <Form.Slot label={t('模型列表')} style={{ marginBottom: 20 }}>
                <Input
                  value={editingModelConfig.models}
                  onChange={(value) => setEditingModelConfig({ ...editingModelConfig, models: value })}
                  placeholder={t('例如: gpt-4, gpt-4o, gpt-4-turbo 或 gpt-4*')}
                  size="large"
                />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                  {t('多个模型用英文逗号分割，支持通配符 *')}
                </Text>
              </Form.Slot>
              <Form.Slot label={t('启用状态')} style={{ marginBottom: 20 }}>
                <Switch
                  checked={editingModelConfig.enabled}
                  onChange={(checked) => setEditingModelConfig({ ...editingModelConfig, enabled: checked })}
                  size="large"
                />
              </Form.Slot>
              <Form.Slot label={t('优先级')} style={{ marginBottom: 20 }}>
                <InputNumber
                  value={editingModelConfig.priority ?? 0}
                  onChange={(value) => setEditingModelConfig({ ...editingModelConfig, priority: value ?? 0 })}
                  min={0}
                  step={1}
                  style={{ width: '100%' }}
                  size="large"
                />
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                  {t('数值越小优先级越高，多个配置匹配同一模型时优先使用低优先级配置')}
                </Text>
              </Form.Slot>
            </Form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '30px 0 16px' }}>
              <Title heading={5}>{t('计费规则')}</Title>
              <Space>
                <Button size="default" onClick={handleUseDefaultRules}>{t('使用默认模板')}</Button>
                <Button icon={<IconPlus />} size="default" type="primary" onClick={handleAddRule}>
                  {t('添加规则')}
                </Button>
              </Space>
            </div>

            <Table
              columns={ruleColumns}
              dataSource={editingModelConfig.rules || []}
              rowKey="name"
              pagination={false}
              size="default"
            />
          </>
        )}
      </Modal>

      {/* 规则编辑弹窗 */}
      <Modal
        title={editingRuleIndex === -1 ? t('添加计费规则') : t('编辑计费规则')}
        visible={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={handleSaveRule}
        okText={t('保存')}
        cancelText={t('取消')}
        width={800}
        style={{ maxHeight: '90vh' }}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto', padding: '24px' }}
      >
        {editingRule && (
          <Form labelPosition="left" labelWidth={140}>
            <Form.Slot label={t('规则名称')} style={{ marginBottom: 20 }}>
              <Input
                value={editingRule.name}
                onChange={(value) => setEditingRule({ ...editingRule, name: value })}
                placeholder={t('例如: T1_input_le_32k')}
                size="large"
              />
            </Form.Slot>

            <Title heading={5} style={{ marginTop: 24, marginBottom: 16 }}>{t('输入Token条件')}</Title>
            <Form.Slot label={t('最小输入Token')} style={{ marginBottom: 20 }}>
              <InputNumber
                value={editingRule.min_input_tokens}
                onChange={(value) => setEditingRule({ ...editingRule, min_input_tokens: value || 0 })}
                min={0}
                suffix="tokens"
                style={{ width: '100%' }}
                size="large"
              />
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                {t('0 表示无下限')}
              </Text>
            </Form.Slot>
            <Form.Slot label={t('最大输入Token')} style={{ marginBottom: 20 }}>
              <InputNumber
                value={editingRule.max_input_tokens}
                onChange={(value) => setEditingRule({ ...editingRule, max_input_tokens: value || 0 })}
                min={0}
                suffix="tokens"
                style={{ width: '100%' }}
                size="large"
              />
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                {t('0 表示无上限')}
              </Text>
            </Form.Slot>

            <Title heading={5} style={{ marginTop: 24, marginBottom: 16 }}>{t('输出Token条件')}</Title>
            <Form.Slot label={t('最小输出Token')} style={{ marginBottom: 20 }}>
              <InputNumber
                value={editingRule.min_output_tokens}
                onChange={(value) => setEditingRule({ ...editingRule, min_output_tokens: value || 0 })}
                min={0}
                suffix="tokens"
                style={{ width: '100%' }}
                size="large"
              />
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                {t('0 表示无下限')}
              </Text>
            </Form.Slot>
            <Form.Slot label={t('最大输出Token')} style={{ marginBottom: 20 }}>
              <InputNumber
                value={editingRule.max_output_tokens}
                onChange={(value) => setEditingRule({ ...editingRule, max_output_tokens: value || 0 })}
                min={0}
                suffix="tokens"
                style={{ width: '100%' }}
                size="large"
              />
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                {t('0 表示无上限')}
              </Text>
            </Form.Slot>

            <Title heading={5} style={{ marginTop: 24, marginBottom: 16 }}>{t('计费设置')}</Title>

            {/* 设置模式切换 */}
            <Form.Slot label={t('设置方式')} style={{ marginBottom: 20 }}>
              <RadioGroup
                type='button'
                value={pricingSubMode}
                onChange={(e) => {
                  const newMode = e.target.value;
                  const oldMode = pricingSubMode;
                  setPricingSubMode(newMode);

                  if (!editingRule) return;

                  const updated = { ...editingRule };
                  const ratioBasePrice = getRatioBasePrice();

                  // 从倍率模式切换到价格模式
                  if (oldMode === 'ratio' && newMode === 'price') {
                    if (updated.input_ratio > 0) {
                      updated.inputPrice = updated.input_ratio * ratioBasePrice;
                      if (updated.completion_ratio > 0) {
                        updated.outputPrice = updated.input_ratio * ratioBasePrice * updated.completion_ratio;
                      }
                    }
                  }
                  // 从价格模式切换到倍率模式
                  else if (oldMode === 'price' && newMode === 'ratio') {
                    if (updated.inputPrice > 0) {
                      updated.input_ratio = updated.inputPrice / ratioBasePrice;
                      if (updated.outputPrice > 0) {
                        updated.completion_ratio = updated.outputPrice / updated.inputPrice;
                      }
                    }
                  }

                  setEditingRule(updated);
                }}
              >
                <Radio value='ratio'>{t('按倍率设置')}</Radio>
                <Radio value='price'>{t('按价格设置')}</Radio>
              </RadioGroup>
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                {t('两种方式可相互转换,最终以倍率形式保存 (1倍率 = $2/1M tokens)')}
              </Text>
            </Form.Slot>

            {/* 倍率模式 */}
            {pricingSubMode === 'ratio' && (
              <>
                <Form.Slot label={t('输入倍率')} style={{ marginBottom: 20 }}>
                  <InputNumber
                    value={editingRule.input_ratio}
                    onChange={(value) => {
                      const ratioBasePrice = getRatioBasePrice();
                      const updated = { ...editingRule, input_ratio: value || 0 };
                      // 同步更新价格字段
                      if (value > 0) {
                        updated.inputPrice = value * ratioBasePrice;
                        if (updated.completion_ratio > 0) {
                          updated.outputPrice = value * ratioBasePrice * updated.completion_ratio;
                        }
                      }
                      setEditingRule(updated);
                    }}
                    min={0}
                    step={0.01}
                    precision={4}
                    suffix="倍率"
                    style={{ width: '100%' }}
                    size="large"
                  />
                  <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                    {editingRule.input_ratio > 0 && (
                      <span style={{ color: 'var(--semi-color-primary)' }}>
                        {t('等价价格: ${{price}}/1M tokens', {
                          price: (editingRule.input_ratio * getRatioBasePrice()).toFixed(6),
                        })}
                      </span>
                    )}
                  </Text>
                </Form.Slot>

                <Form.Slot label={t('输出倍率')} style={{ marginBottom: 20 }}>
                  <InputNumber
                    value={editingRule.completion_ratio}
                    onChange={(value) => {
                      const ratioBasePrice = getRatioBasePrice();
                      const updated = { ...editingRule, completion_ratio: value || 1.0 };
                      // 同步更新价格字段
                      if (updated.input_ratio > 0 && value > 0) {
                        updated.outputPrice = updated.input_ratio * ratioBasePrice * value;
                      }
                      setEditingRule(updated);
                    }}
                    min={0}
                    step={0.01}
                    precision={4}
                    suffix="倍率"
                    style={{ width: '100%' }}
                    size="large"
                  />
                  <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                    {t('相对于输入倍率的倍数,默认1.0')}
                    {editingRule.input_ratio > 0 && editingRule.completion_ratio > 0 && (
                      <span style={{ color: 'var(--semi-color-primary)', marginLeft: 8 }}>
                        {t('(等价价格: ${{price}}/1M)', {
                          price: (editingRule.input_ratio * editingRule.completion_ratio * getRatioBasePrice()).toFixed(6),
                        })}
                      </span>
                    )}
                  </Text>
                </Form.Slot>
              </>
            )}

            {/* 价格模式 */}
            {pricingSubMode === 'price' && (
              <>
                <Form.Slot label={t('输入价格')} style={{ marginBottom: 20 }}>
                  <InputNumber
                    value={editingRule.inputPrice}
                    onChange={(value) => {
                      const ratioBasePrice = getRatioBasePrice();
                      const updated = { ...editingRule, inputPrice: value || 0 };
                      // 同步更新倍率字段
                      if (value > 0) {
                        updated.input_ratio = value / ratioBasePrice;
                        // 更新输出价格保持倍率不变
                        if (updated.completion_ratio > 0) {
                          updated.outputPrice = value * updated.completion_ratio;
                        }
                      }
                      setEditingRule(updated);
                    }}
                    min={0}
                    step={0.001}
                    precision={6}
                    suffix="USD/1M"
                    style={{ width: '100%' }}
                    size="large"
                    placeholder={t('例如: 0.800000')}
                  />
                  <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                    {editingRule.inputPrice > 0 && (
                      <span style={{ color: 'var(--semi-color-primary)' }}>
                        {t('等价倍率: {{ratio}}', {
                          ratio: (editingRule.inputPrice / getRatioBasePrice()).toFixed(4),
                        })}
                      </span>
                    )}
                  </Text>
                </Form.Slot>

                <Form.Slot label={t('输出价格')} style={{ marginBottom: 20 }}>
                  <InputNumber
                    value={editingRule.outputPrice}
                    onChange={(value) => {
                      const updated = { ...editingRule, outputPrice: value || 0 };
                      // 同步更新倍率字段
                      if (value > 0 && updated.inputPrice > 0) {
                        updated.completion_ratio = value / updated.inputPrice;
                      }
                      setEditingRule(updated);
                    }}
                    min={0}
                    step={0.001}
                    precision={6}
                    suffix="USD/1M"
                    style={{ width: '100%' }}
                    size="large"
                    placeholder={t('例如: 1.600000')}
                  />
                  <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                    {editingRule.outputPrice > 0 && editingRule.inputPrice > 0 && (
                      <span style={{ color: 'var(--semi-color-primary)' }}>
                        {t('等价倍率: {{ratio}} (相对于输入价格)', {
                          ratio: (editingRule.outputPrice / editingRule.inputPrice).toFixed(4),
                        })}
                      </span>
                    )}
                  </Text>
                </Form.Slot>
              </>
            )}
          </Form>
        )}
      </Modal>
    </div>
  );
}
