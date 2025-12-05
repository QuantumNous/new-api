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

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  TextArea,
  Typography,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus, IconEdit, IconSetting } from '@douyinfe/semi-icons';

const { Text } = Typography;

const generateId = (() => {
  let counter = 0;
  return () => `op_${counter++}`;
})();

const defaultOperation = () => ({
  id: generateId(),
  path: '',
  mode: 'set',
  value: '',
  keep_origin: false,
  from: '',
  to: '',
  logic: 'OR',
  conditions: [],
});

const defaultCondition = () => ({
  id: generateId(),
  path: '',
  mode: 'full',
  value: '',
  invert: false,
  pass_missing_key: false,
});

const parseMaybeJSON = (text) => {
  if (text === undefined || text === null) return '';
  const trimmed = String(text).trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return trimmed;
  }
};

const stringifyValue = (val) => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
};

// 解析配置并返回摘要信息
const parseConfigSummary = (value, t) => {
  if (!value || !value.trim()) {
    return { count: 0, items: [] };
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.operations)) {
      const items = parsed.operations
        .filter((op) => op.path)
        .map((op) => ({
          path: op.path,
          mode: op.mode || 'set',
          hasConditions: (op.conditions || []).length > 0,
        }));
      return { count: items.length, items };
    }
    return { count: 0, items: [] };
  } catch {
    return { count: 0, items: [] };
  }
};

const OverrideEditor = ({
  value = '',
  onChange,
  field,
  label,
  type = 'param',
  formApi,
  templates = [],
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState('visual');
  const [operations, setOperations] = useState([defaultOperation()]);
  const [jsonText, setJsonText] = useState(
    typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2),
  );
  const [importError, setImportError] = useState('');
  // 临时状态，用于 Modal 中编辑
  const [tempJsonText, setTempJsonText] = useState('');
  const [tempOperations, setTempOperations] = useState([]);

  const builtinVars = useMemo(
    () => [
      '{{context.model}}',
      '{{context.upstream_model}}',
      '{{context.original_model}}',
      '{{context.api_key}}',
      '{{request.*}}',
      '{{client_headers.*}}',
    ],
    [],
  );

  // 配置摘要
  const configSummary = useMemo(() => parseConfigSummary(value, t), [value, t]);

  const emitChange = useCallback(
    (val) => {
      setJsonText(val);
      if (typeof onChange === 'function') {
        onChange(val);
      }
      if (formApi && typeof formApi.setValue === 'function' && field) {
        formApi.setValue(field, val);
      }
    },
    [onChange, formApi, field],
  );

  const serializeOperations = (ops) =>
    ops
      .filter((op) => op.path) // 过滤掉空路径的操作
      .map((op) => ({
        path: op.path,
        mode: op.mode,
        value: parseMaybeJSON(op.value),
        keep_origin: !!op.keep_origin,
        from: op.from,
        to: op.to,
        logic: op.logic || 'OR',
        conditions: (op.conditions || []).map((c) => ({
          path: c.path,
          mode: c.mode || 'full',
          value: parseMaybeJSON(c.value),
          invert: !!c.invert,
          pass_missing_key: !!c.pass_missing_key,
        })),
      }));

  const buildPreview = useCallback((ops) => {
    const validOps = ops.filter((op) => op.path);
    if (validOps.length === 0) {
      return '';
    }
    const payload = { operations: serializeOperations(ops) };
    return JSON.stringify(payload, null, 2);
  }, []);

  const importFromJSON = useCallback((text, switchToVisual = false) => {
    if (!text || !text.trim()) {
      const newOps = [defaultOperation()];
      setTempOperations(newOps);
      setImportError('');
      if (switchToVisual) setEditMode('visual');
      return newOps;
    }
    try {
      const parsed = JSON.parse(text);
      let opList = [];
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.operations)) {
        opList = parsed.operations;
      } else if (parsed && typeof parsed === 'object') {
        opList = Object.entries(parsed).map(([k, v]) => ({
          path: k,
          mode: 'set',
          value: v,
          keep_origin: false,
          from: '',
          to: '',
          conditions: [],
          logic: 'OR',
        }));
      }
      if (opList.length === 0) {
        opList = [defaultOperation()];
      }
      const normalized = opList.map((op) => ({
        id: generateId(),
        path: op.path || '',
        mode: op.mode || 'set',
        value: stringifyValue(op.value),
        keep_origin: !!op.keep_origin,
        from: op.from || '',
        to: op.to || '',
        logic: op.logic || 'OR',
        conditions: (op.conditions || []).map((c) => ({
          id: generateId(),
          path: c.path || '',
          mode: c.mode || 'full',
          value: stringifyValue(c.value),
          invert: !!c.invert,
          pass_missing_key: !!c.pass_missing_key,
        })),
      }));
      setTempOperations(normalized);
      setImportError('');
      if (switchToVisual) {
        setEditMode('visual');
      }
      return normalized;
    } catch (e) {
      setImportError(e.message || 'JSON 解析失败');
      return null;
    }
  }, []);

  // 打开 Modal 时初始化临时状态
  const handleOpenModal = () => {
    setTempJsonText(value || '');
    const ops = importFromJSON(value || '', false);
    if (ops) {
      setTempOperations(ops);
    }
    setEditMode('visual');
    setImportError('');
    setModalVisible(true);
  };

  // 确认保存
  const handleConfirm = () => {
    if (editMode === 'visual') {
      const newValue = buildPreview(tempOperations);
      emitChange(newValue);
    } else {
      emitChange(tempJsonText);
    }
    setModalVisible(false);
  };

  // 取消编辑
  const handleCancel = () => {
    setModalVisible(false);
    setImportError('');
  };

  // 清空配置
  const handleClear = () => {
    emitChange('');
    setModalVisible(false);
  };

  const updateTempOperation = (id, key, val) => {
    setTempOperations((prev) =>
      prev.map((op) => (op.id === id ? { ...op, [key]: val } : op)),
    );
  };

  const updateTempCondition = (opId, condId, key, val) => {
    setTempOperations((prev) =>
      prev.map((op) => {
        if (op.id !== opId) return op;
        const updated = (op.conditions || []).map((c) =>
          c.id === condId ? { ...c, [key]: val } : c,
        );
        return { ...op, conditions: updated };
      }),
    );
  };

  const addTempCondition = (opId) => {
    setTempOperations((prev) =>
      prev.map((op) =>
        op.id === opId
          ? { ...op, conditions: [...(op.conditions || []), defaultCondition()] }
          : op,
      ),
    );
  };

  const removeTempCondition = (opId, condId) => {
    setTempOperations((prev) =>
      prev.map((op) =>
        op.id === opId
          ? { ...op, conditions: (op.conditions || []).filter((c) => c.id !== condId) }
          : op,
      ),
    );
  };

  const handleTemplateApply = (template) => {
    if (!template) return;
    const pretty = JSON.stringify(template, null, 2);
    setTempJsonText(pretty);
    importFromJSON(pretty, true);
  };

  // 同步 tempJsonText 当切换到 JSON 模式
  useEffect(() => {
    if (modalVisible && editMode === 'json') {
      const newJson = buildPreview(tempOperations);
      setTempJsonText(newJson);
    }
  }, [modalVisible, editMode, tempOperations, buildPreview]);

  // 触发区域的渲染
  const renderTrigger = () => {
    const hasConfig = configSummary.count > 0;

    return (
      <div className='override-editor-trigger'>
        <div className='flex items-center justify-between mb-1'>
          <Text strong>{label}</Text>
        </div>
        <div
          className='flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all'
          onClick={handleOpenModal}
        >
          <IconSetting className='text-gray-400' />
          <div className='flex-1 min-w-0'>
            {hasConfig ? (
              <Space wrap size='small'>
                <Tag color='blue' size='small'>
                  {t('{{count}} 条规则', { count: configSummary.count })}
                </Tag>
                {configSummary.items.slice(0, 3).map((item, idx) => (
                  <Tag key={idx} size='small' color='light-blue'>
                    {item.path}
                    {item.hasConditions && (
                      <span className='text-orange-500 ml-1'>*</span>
                    )}
                  </Tag>
                ))}
                {configSummary.items.length > 3 && (
                  <Text type='tertiary' size='small'>
                    +{configSummary.items.length - 3}
                  </Text>
                )}
              </Space>
            ) : (
              <Text type='tertiary'>{t('点击配置')}</Text>
            )}
          </div>
          <IconEdit className='text-gray-400' />
        </div>
      </div>
    );
  };

  // Modal 中的可视化编辑内容
  const visualContent = (
    <Space vertical spacing='medium' className='w-full'>
      <Space align='center' wrap>
        <Text type='tertiary'>{t('可用变量')}：</Text>
        {builtinVars.map((v) => (
          <Tag key={v} size='small'>
            {v}
          </Tag>
        ))}
      </Space>

      {templates?.length > 0 && (
        <Space wrap>
          <Text type='tertiary'>{t('模板快速填充')}：</Text>
          {templates.map((tpl) => (
            <Button
              key={tpl.label}
              size='small'
              onClick={() => handleTemplateApply(tpl.data)}
            >
              {tpl.label}
            </Button>
          ))}
        </Space>
      )}

      {tempOperations.map((op, index) => (
        <Card
          key={op.id}
          title={`${t('操作')} ${index + 1}`}
          size='small'
          headerExtraContent={
            <Button
              type='danger'
              icon={<IconDelete />}
              onClick={() =>
                setTempOperations((prev) => prev.filter((item) => item.id !== op.id))
              }
              size='small'
            >
              {t('删除')}
            </Button>
          }
        >
          <Space vertical className='w-full' spacing='medium'>
            <Row gutter={12}>
              <Col span={12}>
                <Input
                  value={op.path}
                  onChange={(val) => updateTempOperation(op.id, 'path', val)}
                  placeholder={t('路径，如 messages.-1.content 或 headers.Authorization')}
                  addonBefore={t('路径')}
                />
              </Col>
              <Col span={6}>
                <Select
                  value={op.mode}
                  onChange={(val) => updateTempOperation(op.id, 'mode', val)}
                  style={{ width: '100%' }}
                  placeholder={t('操作类型')}
                  optionList={[
                    { label: 'set', value: 'set' },
                    { label: 'delete', value: 'delete' },
                    { label: 'move', value: 'move' },
                    { label: 'prepend', value: 'prepend' },
                    { label: 'append', value: 'append' },
                  ]}
                />
              </Col>
              <Col span={6}>
                {(op.mode === 'set' || op.mode === 'append' || op.mode === 'prepend') && (
                  <Space>
                    <Text type='tertiary'>{t('保留原值')}</Text>
                    <Switch
                      checked={op.keep_origin}
                      onChange={(val) => updateTempOperation(op.id, 'keep_origin', val)}
                    />
                  </Space>
                )}
              </Col>
            </Row>

            {op.mode === 'move' && (
              <Row gutter={12}>
                <Col span={12}>
                  <Input
                    value={op.from}
                    onChange={(val) => updateTempOperation(op.id, 'from', val)}
                    placeholder={t('来源路径，如 meta.old')}
                    addonBefore={t('From')}
                  />
                </Col>
                <Col span={12}>
                  <Input
                    value={op.to}
                    onChange={(val) => updateTempOperation(op.id, 'to', val)}
                    placeholder={t('目标路径，如 meta.new')}
                    addonBefore={t('To')}
                  />
                </Col>
              </Row>
            )}

            {op.mode !== 'delete' && op.mode !== 'move' && (
              <TextArea
                value={op.value}
                onChange={(val) => updateTempOperation(op.id, 'value', val)}
                placeholder={t('值，支持 JSON 或字符串，支持 {{变量}}')}
                autosize
              />
            )}

            <Space align='center'>
              <Text type='tertiary'>{t('条件逻辑')}</Text>
              <Select
                value={op.logic || 'OR'}
                onChange={(val) => updateTempOperation(op.id, 'logic', val)}
                style={{ width: 120 }}
                optionList={[
                  { label: 'OR', value: 'OR' },
                  { label: 'AND', value: 'AND' },
                ]}
              />
              <Button
                size='small'
                icon={<IconPlus />}
                onClick={() => addTempCondition(op.id)}
              >
                {t('添加条件')}
              </Button>
            </Space>

            {(op.conditions || []).map((cond) => (
              <Card
                key={cond.id}
                size='small'
                className='bg-gray-50'
                headerExtraContent={
                  <Button
                    icon={<IconDelete />}
                    size='small'
                    onClick={() => removeTempCondition(op.id, cond.id)}
                  />
                }
              >
                <Space vertical className='w-full' spacing='small'>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Input
                        value={cond.path}
                        onChange={(val) => updateTempCondition(op.id, cond.id, 'path', val)}
                        placeholder={t('条件路径，如 context.model')}
                        addonBefore={t('路径')}
                      />
                    </Col>
                    <Col span={12}>
                      <Select
                        value={cond.mode}
                        onChange={(val) => updateTempCondition(op.id, cond.id, 'mode', val)}
                        style={{ width: '100%' }}
                        optionList={[
                          { label: 'full', value: 'full' },
                          { label: 'prefix', value: 'prefix' },
                          { label: 'suffix', value: 'suffix' },
                          { label: 'contains', value: 'contains' },
                          { label: 'gt', value: 'gt' },
                          { label: 'gte', value: 'gte' },
                          { label: 'lt', value: 'lt' },
                          { label: 'lte', value: 'lte' },
                        ]}
                      />
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Input
                        value={cond.value}
                        onChange={(val) => updateTempCondition(op.id, cond.id, 'value', val)}
                        placeholder={t('条件值，支持 JSON 或字符串')}
                        addonBefore={t('值')}
                      />
                    </Col>
                    <Col span={6}>
                      <Space>
                        <Tooltip content={t('取反匹配结果')}>
                          <Text type='tertiary'>{t('反选')}</Text>
                        </Tooltip>
                        <Switch
                          checked={cond.invert}
                          onChange={(val) =>
                            updateTempCondition(op.id, cond.id, 'invert', val)
                          }
                        />
                      </Space>
                    </Col>
                    <Col span={6}>
                      <Space>
                        <Tooltip content={t('缺少字段时是否视为通过')}>
                          <Text type='tertiary'>{t('缺失通过')}</Text>
                        </Tooltip>
                        <Switch
                          checked={cond.pass_missing_key}
                          onChange={(val) =>
                            updateTempCondition(op.id, cond.id, 'pass_missing_key', val)
                          }
                        />
                      </Space>
                    </Col>
                  </Row>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      ))}

      <Button
        icon={<IconPlus />}
        onClick={() => setTempOperations((prev) => [...prev, defaultOperation()])}
        theme='light'
      >
        {t('添加操作')}
      </Button>
    </Space>
  );

  // Modal 中的 JSON 编辑内容
  const jsonContent = (
    <Space vertical className='w-full'>
      <TextArea
        value={tempJsonText}
        onChange={(val) => {
          setTempJsonText(val);
        }}
        placeholder={t('直接编辑 JSON，支持 operations 格式或简单 key-value')}
        autosize={{ minRows: 8 }}
      />
      {importError && <Text type='danger'>{importError}</Text>}
      <Button onClick={() => importFromJSON(tempJsonText, true)}>{t('导入到可视化')}</Button>
    </Space>
  );

  return (
    <div className='override-editor'>
      {renderTrigger()}

      <Modal
        title={label}
        visible={modalVisible}
        onCancel={handleCancel}
        width={800}
        style={{ maxWidth: '95vw' }}
        footer={
          <Space>
            <Button type='danger' theme='light' onClick={handleClear}>
              {t('清空')}
            </Button>
            <Button onClick={handleCancel}>{t('取消')}</Button>
            <Button type='primary' theme='solid' onClick={handleConfirm}>
              {t('确定')}
            </Button>
          </Space>
        }
      >
        <div className='mb-4'>
          <Tabs
            size='small'
            activeKey={editMode}
            onChange={(key) => {
              if (key === 'visual') {
                importFromJSON(tempJsonText, false);
              }
              setEditMode(key);
            }}
          >
            <Tabs.TabPane tab={t('可视化')} itemKey='visual' />
            <Tabs.TabPane tab='JSON' itemKey='json' />
          </Tabs>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {editMode === 'visual' ? visualContent : jsonContent}
        </div>
      </Modal>
    </div>
  );
};

export default OverrideEditor;
