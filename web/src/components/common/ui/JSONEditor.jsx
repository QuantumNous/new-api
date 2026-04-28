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
  Card,
  Input,
  Switch,
  Tabs,
  TextArea,
  Tooltip,
} from '@heroui/react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

// 唯一 ID 生成器，确保在组件生命周期内稳定且递增
const generateUniqueId = (() => {
  let counter = 0;
  return () => `kv_${counter++}`;
})();

const inputClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary';

function FieldSlot({ label, extraText, children }) {
  return (
    <div className='space-y-2'>
      {label ? (
        <div className='text-sm font-medium text-foreground'>
          {label}
        </div>
      ) : null}
      {children}
      {extraText ? (
        <div className='text-xs leading-5 text-muted'>
          {extraText}
        </div>
      ) : null}
    </div>
  );
}

function AlertBanner({ type = 'warning', children, className = '' }) {
  const colorClass =
    type === 'danger'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-warning/30 bg-warning/10 text-warning';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${colorClass} ${className}`}>
      <div className='flex items-start gap-2'>
        <AlertTriangle className='mt-0.5 shrink-0' size={16} />
        <div className='min-w-0 flex-1'>{children}</div>
      </div>
    </div>
  );
}

function HiddenField({ field, value }) {
  if (!field) return null;
  const hiddenValue =
    typeof value === 'string' ? value : value ? JSON.stringify(value) : '';
  return <input type='hidden' name={field} value={hiddenValue} readOnly />;
}

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
  renderStringValueSuffix,
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
    arr.forEach((item) => {
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
    if (value && typeof value === 'object')
      return JSON.stringify(value, null, 2);
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

    keyValuePairs.forEach((pair) => {
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
      else if (value && typeof value === 'object')
        setManualText(JSON.stringify(value, null, 2));
      else setManualText('');
    }
  }, [value, editMode]);

  const syncFormValue = useCallback(
    (nextValue) => {
      if (formApi && field) {
        formApi.setValue(field, nextValue);
      }
    },
    [formApi, field],
  );

  // 处理可视化编辑的数据变化
  const handleVisualChange = useCallback(
    (newPairs) => {
      setKeyValuePairs(newPairs);
      const jsonObject = keyValueArrayToObject(newPairs);
      const jsonString =
        Object.keys(jsonObject).length === 0
          ? ''
          : JSON.stringify(jsonObject, null, 2);

      setJsonError('');
      syncFormValue(jsonString);
      onChange?.(jsonString);
    },
    [onChange, syncFormValue, keyValueArrayToObject],
  );

  // 处理手动编辑的数据变化
  const handleManualChange = useCallback(
    (newValue) => {
      setManualText(newValue);
      if (newValue && newValue.trim()) {
        try {
          const parsed = JSON.parse(newValue);
          setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
          setJsonError('');
          syncFormValue(newValue);
          onChange?.(newValue);
        } catch (error) {
          setJsonError(error.message);
        }
      } else {
        setKeyValuePairs([]);
        setJsonError('');
        syncFormValue('');
        onChange?.('');
      }
    },
    [onChange, objectToKeyValueArray, keyValuePairs, syncFormValue],
  );

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    if (editMode === 'visual') {
      const jsonObject = keyValueArrayToObject(keyValuePairs);
      setManualText(
        Object.keys(jsonObject).length === 0
          ? ''
          : JSON.stringify(jsonObject, null, 2),
      );
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
      }
    }
  }, [
    editMode,
    value,
    manualText,
    keyValuePairs,
    keyValueArrayToObject,
    objectToKeyValueArray,
  ]);

  // 添加键值对
  const addKeyValue = useCallback(() => {
    const newPairs = [...keyValuePairs];
    const existingKeys = newPairs.map((p) => p.key);
    let counter = 1;
    let newKey = `field_${counter}`;
    while (existingKeys.includes(newKey)) {
      counter += 1;
      newKey = `field_${counter}`;
    }
    newPairs.push({
      id: generateUniqueId(),
      key: newKey,
      value: '',
    });
    handleVisualChange(newPairs);
  }, [keyValuePairs, handleVisualChange]);

  // 删除键值对
  const removeKeyValue = useCallback(
    (id) => {
      const newPairs = keyValuePairs.filter((pair) => pair.id !== id);
      handleVisualChange(newPairs);
    },
    [keyValuePairs, handleVisualChange],
  );

  // 更新键名
  const updateKey = useCallback(
    (id, newKey) => {
      const newPairs = keyValuePairs.map((pair) =>
        pair.id === id ? { ...pair, key: newKey } : pair,
      );
      handleVisualChange(newPairs);
    },
    [keyValuePairs, handleVisualChange],
  );

  // 更新值
  const updateValue = useCallback(
    (id, newValue) => {
      const newPairs = keyValuePairs.map((pair) =>
        pair.id === id ? { ...pair, value: newValue } : pair,
      );
      handleVisualChange(newPairs);
    },
    [keyValuePairs, handleVisualChange],
  );

  // 填入模板
  const fillTemplate = useCallback(() => {
    if (template) {
      const templateString = JSON.stringify(template, null, 2);

      syncFormValue(templateString);
      setManualText(templateString);
      setKeyValuePairs(objectToKeyValueArray(template, keyValuePairs));
      onChange?.(templateString);
      setJsonError('');
    }
  }, [template, onChange, syncFormValue, objectToKeyValueArray, keyValuePairs]);

  const renderDuplicateWarning = () => {
    if (duplicateKeys.size === 0) return null;
    return (
      <AlertBanner className='mb-3'>
        <div>
          <strong>{t('存在重复的键名：')}</strong>
          <span>{Array.from(duplicateKeys).join(', ')}</span>
          <br />
          <span className='text-xs opacity-80'>
            {t('注意：JSON中重复的键只会保留最后一个同名键的值')}
          </span>
        </div>
      </AlertBanner>
    );
  };

  // 渲染值输入控件（支持嵌套）
  const renderValueInput = (pairId, pairKey, value) => {
    const valueType = typeof value;

    if (valueType === 'boolean') {
      return (
        <div className='flex items-center gap-2'>
          <Switch
            isSelected={value}
            onValueChange={(newValue) => updateValue(pairId, newValue)}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
          <span className='text-sm text-muted'>
            {value ? t('true') : t('false')}
          </span>
        </div>
      );
    }

    if (valueType === 'number') {
      return (
        <input
          type='number'
          value={value}
          onChange={(event) => updateValue(pairId, Number(event.target.value))}
          className={inputClass}
          placeholder={t('输入数字')}
        />
      );
    }

    if (valueType === 'object' && value !== null) {
      // 简化嵌套对象的处理，使用TextArea
      return (
        <TextArea
          rows={2}
          fullWidth
          value={JSON.stringify(value, null, 2)}
          onChange={(event) => {
            try {
              const obj = event.target.value.trim()
                ? JSON.parse(event.target.value)
                : {};
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
      <div className='flex items-center gap-2'>
        <Input
          placeholder={t('参数值')}
          value={String(value)}
          onChange={(event) => {
            const newValue = event.target.value;
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
        {renderStringValueSuffix?.({ pairId, pairKey, value })}
      </div>
    );
  };

  // 渲染键值对编辑器
  const renderKeyValueEditor = () => {
    return (
      <div className='space-y-2'>
        {renderDuplicateWarning()}

        {keyValuePairs.length === 0 && (
          <div className='rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted'>
            {t('暂无数据，点击下方按钮添加键值对')}
          </div>
        )}

        {keyValuePairs.map((pair, index) => {
          const isDuplicate = duplicateKeys.has(pair.key);
          const isLastDuplicate =
            isDuplicate &&
            keyValuePairs.slice(index + 1).every((p) => p.key !== pair.key);

          return (
            <div
              key={pair.id}
              className='grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_2.5rem]'
            >
              <div className='relative'>
                <Input
                  placeholder={t('键名')}
                  value={pair.key}
                  onChange={(event) => updateKey(pair.id, event.target.value)}
                  className={isDuplicate ? 'border-warning' : undefined}
                />
                {isDuplicate && (
                  <Tooltip
                    content={
                      isLastDuplicate
                        ? t('这是重复键中的最后一个，其值将被使用')
                        : t('重复的键名，此值将被后面的同名键覆盖')
                    }
                  >
                    <AlertTriangle
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-warning'
                      size={15}
                    />
                  </Tooltip>
                )}
              </div>
              <div>{renderValueInput(pair.id, pair.key, pair.value)}</div>
              <Button
                isIconOnly
                variant='danger-soft'
                aria-label={t('删除')}
                onPress={() => removeKeyValue(pair.id)}
                className='w-full md:w-10'
              >
                <Trash2 size={16} />
              </Button>
            </div>
          );
        })}

        <div className='mt-3 flex justify-center'>
          <Button variant='outline' onPress={addKeyValue}>
            <Plus size={16} />
            {t('添加键值对')}
          </Button>
        </div>
      </div>
    );
  };

  // 渲染区域编辑器（特殊格式）- 也需要改造以支持重复键
  const renderRegionEditor = () => {
    const defaultPair = keyValuePairs.find((pair) => pair.key === 'default');
    const modelPairs = keyValuePairs.filter((pair) => pair.key !== 'default');

    return (
      <div className='space-y-4'>
        {renderDuplicateWarning()}

        {/* 默认区域 */}
        <FieldSlot label={t('默认区域')}>
          <Input
            placeholder={t('默认区域，如: us-central1')}
            value={defaultPair ? defaultPair.value : ''}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (defaultPair) {
                updateValue(defaultPair.id, nextValue);
              } else {
                const newPairs = [
                  ...keyValuePairs,
                  {
                    id: generateUniqueId(),
                    key: 'default',
                    value: nextValue,
                  },
                ];
                handleVisualChange(newPairs);
              }
            }}
          />
        </FieldSlot>

        {/* 模型专用区域 */}
        <FieldSlot label={t('模型专用区域')}>
          <div className='space-y-2'>
            {modelPairs.map((pair) => {
              const isDuplicate = duplicateKeys.has(pair.key);
              return (
                <div
                  key={pair.id}
                  className='grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_2.5rem]'
                >
                  <div className='relative'>
                    <Input
                      placeholder={t('模型名称')}
                      value={pair.key}
                      onChange={(event) => updateKey(pair.id, event.target.value)}
                      className={isDuplicate ? 'border-warning' : undefined}
                    />
                    {isDuplicate && (
                      <Tooltip content={t('重复的键名')}>
                        <AlertTriangle
                          className='absolute right-3 top-1/2 -translate-y-1/2 text-warning'
                          size={15}
                        />
                      </Tooltip>
                    )}
                  </div>
                  <Input
                    placeholder={t('区域')}
                    value={pair.value}
                    onChange={(event) => updateValue(pair.id, event.target.value)}
                  />
                  <Button
                    isIconOnly
                    variant='danger-soft'
                    aria-label={t('删除')}
                    onPress={() => removeKeyValue(pair.id)}
                    className='w-full md:w-10'
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              );
            })}

            <div className='mt-3 flex justify-center'>
              <Button variant='outline' onPress={addKeyValue}>
                <Plus size={16} />
                {t('添加模型区域')}
              </Button>
            </div>
          </div>
        </FieldSlot>
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
    <FieldSlot label={label}>
      <Card className='rounded-2xl border border-border bg-background/80 shadow-sm'>
        <div className='flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between'>
          <Tabs
            selectedKey={editMode}
            onSelectionChange={(key) => {
              const nextKey = String(key);
              if (nextKey === 'manual' && editMode === 'visual') {
                setEditMode('manual');
              } else if (nextKey === 'visual' && editMode === 'manual') {
                toggleEditMode();
              }
            }}
            size='sm'
            variant='underlined'
          >
            <Tabs.List aria-label={t('编辑模式')}>
              <Tabs.Tab id='visual'>{t('可视化')}</Tabs.Tab>
              <Tabs.Tab id='manual'>{t('手动编辑')}</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {template && templateLabel && (
            <Button variant='ghost' size='sm' onPress={fillTemplate}>
              {templateLabel}
            </Button>
          )}
        </div>
        <div className='p-4'>
          {/* JSON错误提示 */}
          {hasJsonError && (
            <AlertBanner type='danger' className='mb-3'>
              {`JSON 格式错误: ${jsonError}`}
            </AlertBanner>
          )}

          {/* 编辑器内容 */}
          {editMode === 'visual' ? (
            <div>
              {renderVisualEditor()}
              {/* 隐藏字段用于原生表单场景的数据绑定；主流程仍由 formApi/onChange 驱动 */}
              <HiddenField field={field} value={value} rules={rules} />
            </div>
          ) : (
            <div>
              <div className='relative'>
                <TextArea
                  placeholder={placeholder}
                  value={manualText}
                  onChange={(event) => handleManualChange(event.target.value)}
                  rows={Math.max(8, manualText ? manualText.split('\n').length : 8)}
                  fullWidth
                />
                {showClear && manualText ? (
                  <Button
                    size='sm'
                    variant='ghost'
                    onPress={() => handleManualChange('')}
                    className='absolute right-2 top-2'
                  >
                    {t('清空')}
                  </Button>
                ) : null}
              </div>
              {/* 隐藏字段用于原生表单场景的数据绑定；主流程仍由 formApi/onChange 驱动 */}
              <HiddenField field={field} value={value} rules={rules} />
            </div>
          )}

          {/* 额外文本显示在卡片底部 */}
          {extraText && (
            <div className='my-3 flex items-center gap-3 text-xs text-muted'>
              <span className='h-px flex-1 bg-border' />
              <span>{extraText}</span>
              <span className='h-px flex-1 bg-border' />
            </div>
          )}
          {extraFooter && <div className='mt-1'>{extraFooter}</div>}
        </div>
      </Card>
    </FieldSlot>
  );
};

export default JSONEditor;
