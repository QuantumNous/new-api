/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Switch,
  Typography,
  Banner,
  Tag,
  Space,
  Spin,
  Popconfirm,
  Tooltip,
  TimePicker,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconArrowUp,
  IconArrowDown,
  IconTick,
  IconClose,
  IconInfoCircle,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';

// 星期选项
const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

// 生成 UUID
function generateId () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 格式化时间 Date -> "HH:MM"
function formatTime (date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "HH:MM" -> Date
function parseTime (str) {
  if (!str) return null;
  const parts = str.split(':');
  if (parts.length !== 2) return null;
  const d = new Date();
  d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  return d;
}

export default function SettingsTimeDynamicRatio () {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [rules, setRules] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [groups, setGroups] = useState([]);

  // 获取分组列表
  const fetchGroups = useCallback(async () => {
    try {
      const res = await API.get('/api/group/');
      if (res.data.success) {
        const groupData = res.data.data || [];
        setGroups(groupData.map((g) => ({ label: g, value: g })));
      }
    } catch {
      // 静默失败
    }
  }, []);

  // 获取配置
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/time-dynamic-ratio/');
      if (res.data.success && res.data.data) {
        const data = res.data.data;
        setGlobalEnabled(data.enabled || false);
        setRules(data.rules || []);
      }
    } catch (err) {
      showError('获取时间动态倍率配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchGroups();
  }, [fetchSettings, fetchGroups]);

  // 保存配置
  const saveSettings = async (newEnabled, newRules) => {
    setSaving(true);
    try {
      const res = await API.put('/api/time-dynamic-ratio/', {
        enabled: newEnabled ?? globalEnabled,
        rules: newRules ?? rules,
      });
      if (res.data.success) {
        showSuccess('保存成功');
        await fetchSettings();
      } else {
        showError(res.data.message || '保存失败');
      }
    } catch (err) {
      showError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 全局开关
  const handleGlobalToggle = (checked) => {
    setGlobalEnabled(checked);
    saveSettings(checked, rules);
  };

  // 规则开关
  const handleRuleToggle = (ruleId, checked) => {
    const newRules = rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: checked } : r,
    );
    setRules(newRules);
    saveSettings(globalEnabled, newRules);
  };

  // 删除规则
  const handleDeleteRule = (ruleId) => {
    const newRules = rules.filter((r) => r.id !== ruleId);
    setRules(newRules);
    saveSettings(globalEnabled, newRules);
  };

  // 优先级调整
  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const newRules = [...rules];
    [newRules[index - 1], newRules[index]] = [
      newRules[index],
      newRules[index - 1],
    ];
    // 重新排序 priority
    newRules.forEach((r, i) => (r.priority = i + 1));
    setRules(newRules);
    saveSettings(globalEnabled, newRules);
  };

  const handleMoveDown = (index) => {
    if (index >= rules.length - 1) return;
    const newRules = [...rules];
    [newRules[index], newRules[index + 1]] = [
      newRules[index + 1],
      newRules[index],
    ];
    newRules.forEach((r, i) => (r.priority = i + 1));
    setRules(newRules);
    saveSettings(globalEnabled, newRules);
  };

  // 打开新增/编辑弹窗
  const openModal = (rule = null) => {
    setEditingRule(rule);
    setModalVisible(true);
  };

  // 关闭弹窗
  const closeModal = () => {
    setModalVisible(false);
    setEditingRule(null);
  };

  // 提交编辑
  const handleModalOk = () => {
    if (!formApi) return;
    formApi.validate().then((values) => {
      const newRule = {
        id: editingRule?.id || generateId(),
        name: values.name,
        enabled: editingRule?.enabled ?? true,
        priority: editingRule?.priority || rules.length + 1,
        start_time: formatTime(values.start_time),
        end_time: formatTime(values.end_time),
        weekdays: values.weekdays || [],
        groups: values.groups || [],
        models: values.models || [],
        multiplier: values.multiplier,
      };

      let newRules;
      if (editingRule) {
        newRules = rules.map((r) => (r.id === editingRule.id ? newRule : r));
      } else {
        newRules = [...rules, newRule];
      }
      newRules.forEach((r, i) => (r.priority = i + 1));
      setRules(newRules);
      saveSettings(globalEnabled, newRules);
      closeModal();
    });
  };

  // 格式化星期显示
  const formatWeekdays = (weekdays) => {
    if (!weekdays || weekdays.length === 0) return '每天';
    if (weekdays.length === 7) return '每天';
    return weekdays
      .sort((a, b) => a - b)
      .map((wd) => WEEKDAY_OPTIONS.find((o) => o.value === wd)?.label || wd)
      .join('、');
  };

  // 格式化分组显示
  const formatGroups = (groupsList) => {
    if (!groupsList || groupsList.length === 0) return '全部';
    return groupsList.join('、');
  };

  // 格式化模型显示
  const formatModels = (models) => {
    if (!models || models.length === 0) return '全部';
    return models.join('、');
  };

  // 倍率颜色
  const getMultiplierColor = (multiplier) => {
    if (multiplier < 1) return 'green';
    if (multiplier > 1) return 'red';
    return 'grey';
  };

  // 表格列定义
  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (_, record, index) => (
        <Space>
          <span>{index + 1}</span>
          <Button
            icon={<IconArrowUp />}
            size='small'
            theme='borderless'
            disabled={index === 0}
            onClick={() => handleMoveUp(index)}
          />
          <Button
            icon={<IconArrowDown />}
            size='small'
            theme='borderless'
            disabled={index === rules.length - 1}
            onClick={() => handleMoveDown(index)}
          />
        </Space>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '时间段',
      key: 'time',
      width: 140,
      render: (_, record) => (
        <span>
          {record.start_time} → {record.end_time}
        </span>
      ),
    },
    {
      title: '星期',
      key: 'weekdays',
      width: 140,
      render: (_, record) => (
        <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 130 }}>
          {formatWeekdays(record.weekdays)}
        </Typography.Text>
      ),
    },
    {
      title: '分组',
      key: 'groups',
      width: 120,
      render: (_, record) => (
        <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 110 }}>
          {formatGroups(record.groups)}
        </Typography.Text>
      ),
    },
    {
      title: '模型',
      key: 'models',
      width: 140,
      render: (_, record) => (
        <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 130 }}>
          {formatModels(record.models)}
        </Typography.Text>
      ),
    },
    {
      title: '倍率',
      dataIndex: 'multiplier',
      width: 80,
      render: (multiplier) => (
        <Tag color={getMultiplierColor(multiplier)} size='large'>
          ×{multiplier}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          size='small'
          onChange={(checked) => handleRuleToggle(record.id, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            icon={<IconEdit />}
            size='small'
            theme='borderless'
            onClick={() => openModal(record)}
          />
          <Popconfirm
            title='确认删除此规则？'
            onConfirm={() => handleDeleteRule(record.id)}
          >
            <Button
              icon={<IconDelete />}
              size='small'
              theme='borderless'
              type='danger'
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 修复 TimePicker 弹窗透明背景 + 压缩上方空白 */}
      <style>{`
        .td-ratio-timepicker .semi-timepicker-panel {
          background: var(--semi-color-bg-0, #fff) !important;
          border: 1px solid var(--semi-color-border, #e0e0e0);
          border-radius: 6px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.12);
        }
        .td-ratio-timepicker .semi-scrolllist {
          background: var(--semi-color-bg-0, #fff) !important;
        }
        .td-ratio-timepicker .semi-scrolllist-body {
          max-height: 180px !important;
        }
        .td-ratio-timepicker .semi-scrolllist-item-wheel {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
        .td-ratio-timepicker .semi-scrolllist-item-wheel ul {
          padding-top: 0 !important;
        }
        .td-ratio-timepicker .semi-scrolllist-list-outer {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
      `}</style>
      <Typography.Title heading={5} style={{ marginBottom: 12 }}>
        时间动态倍率
        <Tooltip content='根据时间段、分组、模型三个维度灵活调控计费倍率。规则按优先级从上到下匹配，命中即生效。'>
          <IconInfoCircle style={{ marginLeft: 6, color: 'var(--semi-color-text-2)' }} />
        </Tooltip>
      </Typography.Title>

      <div style={{ marginBottom: 16 }}>
        <Space align='center'>
          <Typography.Text strong>全局开关</Typography.Text>
          <Switch
            checked={globalEnabled}
            onChange={handleGlobalToggle}
            loading={saving}
          />
          {globalEnabled ? (
            <Tag color='green' prefixIcon={<IconTick />}>已启用</Tag>
          ) : (
            <Tag color='grey' prefixIcon={<IconClose />}>已关闭</Tag>
          )}
        </Space>
      </div>

      {!globalEnabled && (
        <Banner
          type='info'
          description='全局开关关闭时，所有规则不会生效，计费保持原有行为。'
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        <div style={{ marginBottom: 12 }}>
          <Button
            icon={<IconPlus />}
            theme='solid'
            onClick={() => openModal()}
          >
            新增规则
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={rules}
          rowKey='id'
          pagination={false}
          size='small'
          empty='暂无规则，点击「新增规则」添加'
        />
      </Spin>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={closeModal}
        okText='确定'
        cancelText='取消'
        width={520}
      >
        <Form
          getFormApi={(api) => setFormApi(api)}
          labelPosition='left'
          labelWidth={80}
          initValues={
            editingRule
              ? {
                name: editingRule.name,
                start_time: parseTime(editingRule.start_time),
                end_time: parseTime(editingRule.end_time),
                weekdays: editingRule.weekdays || [],
                groups: editingRule.groups || [],
                models: editingRule.models || [],
                multiplier: editingRule.multiplier,
              }
              : {
                name: '',
                start_time: null,
                end_time: null,
                weekdays: [],
                groups: [],
                models: [],
                multiplier: 1.0,
              }
          }
        >
          <Form.Input
            field='name'
            label='规则名称'
            placeholder='如：VIP 凌晨优惠'
            rules={[{ required: true, message: '请输入规则名称' }]}
          />

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Form.TimePicker
                field='start_time'
                label='开始时间'
                format='HH:mm'
                popupClassName='td-ratio-timepicker'
                style={{ width: '100%' }}
                rules={[{ required: true, message: '请选择开始时间' }]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Form.TimePicker
                field='end_time'
                label='结束时间'
                format='HH:mm'
                popupClassName='td-ratio-timepicker'
                style={{ width: '100%' }}
                rules={[{ required: true, message: '请选择结束时间' }]}
              />
            </div>
          </div>

          <Banner
            type='info'
            description='支持跨午夜时间段，如 22:00 → 06:00'
            style={{ marginBottom: 12 }}
          />

          <Form.Select
            field='weekdays'
            label='生效星期'
            multiple
            placeholder='留空表示每天生效'
            optionList={WEEKDAY_OPTIONS}
            style={{ width: '100%' }}
          />

          <Form.Select
            field='groups'
            label='分组'
            multiple
            placeholder='留空表示全部分组'
            optionList={groups}
            style={{ width: '100%' }}
            filter
          />

          <Form.TagInput
            field='models'
            label='模型'
            placeholder='输入模型名后按回车，支持通配符如 gpt-4*'
          />

          <Form.InputNumber
            field='multiplier'
            label='倍率'
            min={0.01}
            step={0.1}
            precision={2}
            suffix='倍'
            rules={[
              { required: true, message: '请输入倍率' },
              {
                validator: (rule, value) => value > 0,
                message: '倍率必须大于 0',
              },
            ]}
            style={{ width: '100%' }}
          />

          <Banner
            type='warning'
            description='倍率 < 1 表示折扣（如 0.5 = 五折），> 1 表示加价（如 1.5 = 加价 50%）'
            style={{ marginBottom: 0 }}
          />
        </Form>
      </Modal>
    </div>
  );
}
