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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  Typography,
  Banner,
  Tabs,
  TabPane,
  Card,
  Input,
  InputNumber,
  Switch,
  TextArea,
  Row,
  Col,
  Divider,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconDelete,
  IconAlertTriangle,
} from '@douyinfe/semi-icons';

const { Text } = Typography;

// 唯一 ID 生成器，确保在组件生命周期内稳定且递增
const generateUniqueId = (() => {
  let counter = 0;
  return () => `kv_${counter++}`;
})();

const JSONEditor = ({
  value = '',
  onChange,
  field,
  label,
  placeholder,
  extraText,
  extraFooter,
  showClear = true,
  template,
  templateLabel,
  editorType = 'keyValue',
  rules = [],
  formApi = null,
  ...props
}) => {
  const { t } = useTranslation();

  // 将对象转换为键值对数组（包含唯一ID）
  const objectToKeyValueArray = useCallback((obj, prevPairs = []) => {
    if (!obj || typeof obj !== 'object') return [];

    const entries = Object.entries(obj);
    return entries.map(([key, value], index) => {
      // 如果上一次转换后同位置的键一致，则沿用其 id，保持 React key 稳定
      const prev = prevPairs[index];
      const shouldReuseId = prev && prev.key === key;
      return {
        id: shouldReuseId ? prev.id : generateUniqueId(),
        key,
        value,
      };
    });
  }, []);

  // 将键值对数组转换为对象（重复键时后面的会覆盖前面的）
  const keyValueArrayToObject = useCallback((arr) => {
    const result = {};
    arr.forEach(item => {
      if (item.key) {
        result[item.key] = item.value;
      }
    });
    return result;
  }, []);

  // 初始化键值对数组
  const [keyValuePairs, setKeyValuePairs] = useState(() => {
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return objectToKeyValueArray(parsed);
      } catch (error) {
        return [];
      }
    }
    if (typeof value === 'object' && value !== null) {
      return objectToKeyValueArray(value);
    }
    return [];
  });

  // 手动模式下的本地文本缓冲
  const [manualText, setManualText] = useState(() => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
    return '';
  });

  // 根据键数量决定默认编辑模式
  const [editMode, setEditMode] = useState(() => {
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        const keyCount = Object.keys(parsed).length;
        return keyCount > 10 ? 'manual' : 'visual';
      } catch (error) {
        return 'manual';
      }
    }
    return 'visual';
  });

  const [jsonError, setJsonError] = useState('');

  // 计算重复的键
  const duplicateKeys = useMemo(() => {
    const keyCount = {};
    const duplicates = new Set();

    keyValuePairs.forEach(pair => {
      if (pair.key) {
        keyCount[pair.key] = (keyCount[pair.key] || 0) + 1;
        if (keyCount[pair.key] > 1) {
          duplicates.add(pair.key);
        }
      }
    });

    return duplicates;
  }, [keyValuePairs]);

  // 数据同步 - 当value变化时更新键值对数组
  useEffect(() => {
    try {
      let parsed = {};
      if (typeof value === 'string' && value.trim()) {
        parsed = JSON.parse(value);
      } else if (typeof value === 'object' && value !== null) {
        parsed = value;
      }

      // 只在外部值真正改变时更新，避免循环更新
      const currentObj = keyValueArrayToObject(keyValuePairs);
      if (JSON.stringify(parsed) !== JSON.stringify(currentObj)) {
        setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
      }
      setJsonError('');
    } catch (error) {
      console.log('JSON解析失败:', error.message);
      setJsonError(error.message);
    }
  }, [value]);

  // 外部 value 变化时，若不在手动模式，则同步手动文本
  useEffect(() => {
    if (editMode !== 'manual') {
      if (typeof value === 'string') setManualText(value);
      else if (value && typeof value === 'object') setManualText(JSON.stringify(value, null, 2));
      else setManualText('');
    }
  }, [value, editMode]);

  // 处理可视化编辑的数据变化
  const handleVisualChange = useCallback((newPairs) => {
    setKeyValuePairs(newPairs);
    const jsonObject = keyValueArrayToObject(newPairs);
    const jsonString = Object.keys(jsonObject).length === 0 ? '' : JSON.stringify(jsonObject, null, 2);

    setJsonError('');

    // 通过formApi设置值
    if (formApi && field) {
      formApi.setValue(field, jsonString);
    }

    onChange?.(jsonString);
  }, [onChange, formApi, field, keyValueArrayToObject]);

  // 处理手动编辑的数据变化
  const handleManualChange = useCallback((newValue) => {
    setManualText(newValue);
    if (newValue && newValue.trim()) {
      try {
        const parsed = JSON.parse(newValue);
        setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
        setJsonError('');
        onChange?.(newValue);
      } catch (error) {
        setJsonError(error.message);
      }
    } else {
      setKeyValuePairs([]);
      setJsonError('');
      onChange?.('');
    }
  }, [onChange, objectToKeyValueArray, keyValuePairs]);

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    if (editMode === 'visual') {
      const jsonObject = keyValueArrayToObject(keyValuePairs);
      setManualText(Object.keys(jsonObject).length === 0 ? '' : JSON.stringify(jsonObject, null, 2));
      setEditMode('manual');
    } else {
      try {
        let parsed = {};
        if (manualText && manualText.trim()) {
          parsed = JSON.parse(manualText);
        } else if (typeof value === 'string' && value.trim()) {
          parsed = JSON.parse(value);
        } else if (typeof value === 'object' && value !== null) {
          parsed = value;
        }
        setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
        setJsonError('');
        setEditMode('visual');
      } catch (error) {
        setJsonError(error.message);
        return;
      }
    }
  }, [editMode, value, manualText, keyValuePairs, keyValueArrayToObject, objectToKeyValueArray]);

  // 添加键值对
  const addKeyValue = useCallback(() => {
    const newPairs = [...keyValuePairs];
    const existingKeys = newPairs.map(p => p.key);
    let counter = 1;
    let newKey = `field_${counter}`;
    while (existingKeys.includes(newKey)) {
      counter += 1;
      newKey = `field_${counter}`;
    }
    newPairs.push({
      id: generateUniqueId(),
      key: newKey,
      value: ''
    });
    handleVisualChange(newPairs);
  }, [keyValuePairs, handleVisualChange]);

  // 删除键值对
  const removeKeyValue = useCallback((id) => {
    const newPairs = keyValuePairs.filter(pair => pair.id !== id);
    handleVisualChange(newPairs);
  }, [keyValuePairs, handleVisualChange]);

  // 更新键名
  const updateKey = useCallback((id, newKey) => {
    const newPairs = keyValuePairs.map(pair =>
      pair.id === id ? { ...pair, key: newKey } : pair
    );
    handleVisualChange(newPairs);
  }, [keyValuePairs, handleVisualChange]);

  // 更新值
  const updateValue = useCallback((id, newValue) => {
    const newPairs = keyValuePairs.map(pair =>
      pair.id === id ? { ...pair, value: newValue } : pair
    );
    handleVisualChange(newPairs);
  }, [keyValuePairs, handleVisualChange]);

  // 填入模板
  const fillTemplate = useCallback(() => {
    if (template) {
      const templateString = JSON.stringify(template, null, 2);

      if (formApi && field) {
        formApi.setValue(field, templateString);
      }

      setManualText(templateString);
      setKeyValuePairs(objectToKeyValueArray(template, keyValuePairs));
      onChange?.(templateString);
      setJsonError('');
    }
  }, [template, onChange, formApi, field, objectToKeyValueArray, keyValuePairs]);

  // 渲染值输入控件（支持嵌套）
  const renderValueInput = (pairId, value) => {
    const valueType = typeof value;

    if (valueType === 'boolean') {
      return (
        <div className="flex items-center">
          <Switch
            checked={value}
            onChange={(newValue) => updateValue(pairId, newValue)}
          />
          <Text type="tertiary" className="ml-2">
            {value ? t('true') : t('false')}
          </Text>
        </div>
      );
    }

    if (valueType === 'number') {
      return (
        <InputNumber
          value={value}
          onChange={(newValue) => updateValue(pairId, newValue)}
          style={{ width: '100%' }}
          placeholder={t('输入数字')}
        />
      );
    }

    if (valueType === 'object' && value !== null) {
      // 简化嵌套对象的处理，使用TextArea
      return (
        <TextArea
          rows={2}
          value={JSON.stringify(value, null, 2)}
          onChange={(txt) => {
            try {
              const obj = txt.trim() ? JSON.parse(txt) : {};
              updateValue(pairId, obj);
            } catch {
              // 忽略解析错误
            }
          }}
          placeholder={t('输入JSON对象')}
        />
      );
    }

    // 字符串或其他原始类型
    return (
      <Input
        placeholder={t('参数值')}
        value={String(value)}
        onChange={(newValue) => {
          let convertedValue = newValue;
          if (newValue === 'true') convertedValue = true;
          else if (newValue === 'false') convertedValue = false;
          else if (!isNaN(newValue) && newValue !== '') {
            const num = Number(newValue);
            // 检查是否为整数
            if (Number.isInteger(num)) {
              convertedValue = num;
            }
          }
          updateValue(pairId, convertedValue);
        }}
      />
    );
  };

  // 渲染键值对编辑器
  const renderKeyValueEditor = () => {
    return (
      <div className="space-y-1">
        {/* 重复键警告 */}
        {duplicateKeys.size > 0 && (
          <Banner
            type="warning"
            icon={<IconAlertTriangle />}
            description={
              <div>
                <Text strong>{t('存在重复的键名：')}</Text>
                <Text>{Array.from(duplicateKeys).join(', ')}</Text>
                <br />
                <Text type="tertiary" size="small">
                  {t('注意：JSON中重复的键只会保留最后一个同名键的值')}
                </Text>
              </div>
            }
            className="mb-3"
          />
        )}

        {keyValuePairs.length === 0 && (
          <div className="text-center py-6 px-4">
            <Text type="tertiary" className="text-gray-500 text-sm">
              {t('暂无数据，点击下方按钮添加键值对')}
            </Text>
          </div>
        )}

        {keyValuePairs.map((pair, index) => {
          const isDuplicate = duplicateKeys.has(pair.key);
          const isLastDuplicate = isDuplicate &&
            keyValuePairs.slice(index + 1).every(p => p.key !== pair.key);

          return (
            <Row key={pair.id} gutter={8} align="middle">
              <Col span={6}>
                <div className="relative">
                  <Input
                    placeholder={t('键名')}
                    value={pair.key}
                    onChange={(newKey) => updateKey(pair.id, newKey)}
                    status={isDuplicate ? 'warning' : undefined}
                  />
                  {isDuplicate && (
                    <Tooltip
                      content={
                        isLastDuplicate
                          ? t('这是重复键中的最后一个，其值将被使用')
                          : t('重复的键名，此值将被后面的同名键覆盖')
                      }
                    >
                      <IconAlertTriangle
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        style={{
                          color: isLastDuplicate ? '#ff7d00' : '#faad14',
                          fontSize: '14px'
                        }}
                      />
                    </Tooltip>
                  )}
                </div>
              </Col>
              <Col span={16}>
                {renderValueInput(pair.id, pair.value)}
              </Col>
              <Col span={2}>
                <Button
                  icon={<IconDelete />}
                  type="danger"
                  theme="borderless"
                  onClick={() => removeKeyValue(pair.id)}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          );
        })}

        <div className="mt-2 flex justify-center">
          <Button
            icon={<IconPlus />}
            type="primary"
            theme="outline"
            onClick={addKeyValue}
          >
            {t('添加键值对')}
          </Button>
        </div>
      </div>
    );
  };

  // 渲染区域编辑器（特殊格式）- 也需要改造以支持重复键
  const renderRegionEditor = () => {
    const defaultPair = keyValuePairs.find(pair => pair.key === 'default');
    const modelPairs = keyValuePairs.filter(pair => pair.key !== 'default');

    return (
      <div className="space-y-2">
        {/* 重复键警告 */}
        {duplicateKeys.size > 0 && (
          <Banner
            type="warning"
            icon={<IconAlertTriangle />}
            description={
              <div>
                <Text strong>{t('存在重复的键名：')}</Text>
                <Text>{Array.from(duplicateKeys).join(', ')}</Text>
                <br />
                <Text type="tertiary" size="small">
                  {t('注意：JSON中重复的键只会保留最后一个同名键的值')}
                </Text>
              </div>
            }
            className="mb-3"
          />
        )}

        {/* 默认区域 */}
        <Form.Slot label={t('默认区域')}>
          <Input
            placeholder={t('默认区域，如: us-central1')}
            value={defaultPair ? defaultPair.value : ''}
            onChange={(value) => {
              if (defaultPair) {
                updateValue(defaultPair.id, value);
              } else {
                const newPairs = [...keyValuePairs, {
                  id: generateUniqueId(),
                  key: 'default',
                  value: value
                }];
                handleVisualChange(newPairs);
              }
            }}
          />
        </Form.Slot>

        {/* 模型专用区域 */}
        <Form.Slot label={t('模型专用区域')}>
          <div>
            {modelPairs.map((pair) => {
              const isDuplicate = duplicateKeys.has(pair.key);
              return (
                <Row key={pair.id} gutter={8} align="middle" className="mb-2">
                  <Col span={10}>
                    <div className="relative">
                      <Input
                        placeholder={t('模型名称')}
                        value={pair.key}
                        onChange={(newKey) => updateKey(pair.id, newKey)}
                        status={isDuplicate ? 'warning' : undefined}
                      />
                      {isDuplicate && (
                        <Tooltip content={t('重复的键名')}>
                          <IconAlertTriangle
                            className="absolute right-2 top-1/2 transform -translate-y-1/2"
                            style={{ color: '#faad14', fontSize: '14px' }}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </Col>
                  <Col span={12}>
                    <Input
                      placeholder={t('区域')}
                      value={pair.value}
                      onChange={(newValue) => updateValue(pair.id, newValue)}
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      icon={<IconDelete />}
                      type="danger"
                      theme="borderless"
                      onClick={() => removeKeyValue(pair.id)}
                      style={{ width: '100%' }}
                    />
                  </Col>
                </Row>
              );
            })}

            <div className="mt-2 flex justify-center">
              <Button
                icon={<IconPlus />}
                onClick={addKeyValue}
                type="primary"
                theme="outline"
              >
                {t('添加模型区域')}
              </Button>
            </div>
          </div>
        </Form.Slot>
      </div>
    );
  };

  // 渲染可视化编辑器
  const renderVisualEditor = () => {
    switch (editorType) {
      case 'region':
        return renderRegionEditor();
      case 'object':
      case 'keyValue':
      default:
        return renderKeyValueEditor();
    }
  };

  const hasJsonError = jsonError && jsonError.trim() !== '';

  return (
    <Form.Slot label={label}>
      <Card
        header={
          <div className="flex justify-between items-center">
            <Tabs
              type="slash"
              activeKey={editMode}
              onChange={(key) => {
                if (key === 'manual' && editMode === 'visual') {
                  setEditMode('manual');
                } else if (key === 'visual' && editMode === 'manual') {
                  toggleEditMode();
                }
              }}
            >
              <TabPane tab={t('可视化')} itemKey="visual" />
              <TabPane tab={t('手动编辑')} itemKey="manual" />
            </Tabs>

            {template && templateLabel && (
              <Button
                type="tertiary"
                onClick={fillTemplate}
                size="small"
              >
                {templateLabel}
              </Button>
            )}
          </div>
        }
        headerStyle={{ padding: '12px 16px' }}
        bodyStyle={{ padding: '16px' }}
        className="!rounded-2xl"
      >
        {/* JSON错误提示 */}
        {hasJsonError && (
          <Banner
            type="danger"
            description={`JSON 格式错误: ${jsonError}`}
            className="mb-3"
          />
        )}

        {/* 编辑器内容 */}
        {editMode === 'visual' ? (
          <div>
            {renderVisualEditor()}
            {/* 隐藏的Form字段用于验证和数据绑定 */}
            <Form.Input
              field={field}
              value={value}
              rules={rules}
              style={{ display: 'none' }}
              noLabel={true}
              {...props}
            />
          </div>
        ) : (
          <div>
            <TextArea
              placeholder={placeholder}
              value={manualText}
              onChange={handleManualChange}
              showClear={showClear}
              rows={Math.max(8, manualText ? manualText.split('\n').length : 8)}
            />
            {/* 隐藏的Form字段用于验证和数据绑定 */}
            <Form.Input
              field={field}
              value={value}
              rules={rules}
              style={{ display: 'none' }}
              noLabel={true}
              {...props}
            />
          </div>
        )}

        {/* 额外文本显示在卡片底部 */}
        {extraText && (
          <Divider margin='12px' align='center'>
            <Text type="tertiary" size="small">{extraText}</Text>
          </Divider>
        )}
        {extraFooter && (
          <div className="mt-1">
            {extraFooter}
          </div>
        )}
      </Card>
    </Form.Slot>
  );
};

export default JSONEditor;