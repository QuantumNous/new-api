import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Space,
  Button,
  Form,
  Card,
  Typography,
  Banner,
  Row,
  Col,
  InputNumber,
  Switch,
  Select,
  Input,
} from '@douyinfe/semi-ui';
import {
  IconCode,
  IconEdit,
  IconPlus,
  IconDelete,
  IconSetting,
} from '@douyinfe/semi-icons';

const { Text } = Typography;

const JSONEditor = ({
  value = '',
  onChange,
  field,
  label,
  placeholder,
  extraText,
  showClear = true,
  template,
  templateLabel,
  editorType = 'keyValue', // keyValue, object, region
  autosize = true,
  rules = [],
  formApi = null,
  ...props
}) => {
  const { t } = useTranslation();
  
  // 初始化JSON数据
  const [jsonData, setJsonData] = useState(() => {
    // 初始化时解析JSON数据
    if (value && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return parsed;
      } catch (error) {
        return {};
      }
    }
    return {};
  });
  
  // 根据键数量决定默认编辑模式
  const [editMode, setEditMode] = useState(() => {
    // 如果初始JSON数据的键数量大于10个，则默认使用手动模式
    if (value && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        const keyCount = Object.keys(parsed).length;
        return keyCount > 10 ? 'manual' : 'visual';
      } catch (error) {
        // JSON无效时默认显示手动编辑模式
        return 'manual';
      }
    }
    return 'visual';
  });
  const [jsonError, setJsonError] = useState('');

  // 数据同步 - 当value变化时总是更新jsonData（如果JSON有效）
  useEffect(() => {
    try {
      const parsed = value && value.trim() ? JSON.parse(value) : {};
      setJsonData(parsed);
      setJsonError('');
    } catch (error) {
      console.log('JSON解析失败:', error.message);
      setJsonError(error.message);
      // JSON格式错误时不更新jsonData
    }
  }, [value]);


  // 处理可视化编辑的数据变化
  const handleVisualChange = useCallback((newData) => {
    setJsonData(newData);
    setJsonError('');
    const jsonString = Object.keys(newData).length === 0 ? '' : JSON.stringify(newData, null, 2);
    
    // 通过formApi设置值（如果提供的话）
    if (formApi && field) {
      formApi.setValue(field, jsonString);
    }
    
    onChange?.(jsonString);
  }, [onChange, formApi, field]);

  // 处理手动编辑的数据变化
  const handleManualChange = useCallback((newValue) => {
    onChange?.(newValue);
    // 验证JSON格式
    if (newValue && newValue.trim()) {
      try {
        const parsed = JSON.parse(newValue);
        setJsonError('');
        // 预先准备可视化数据，但不立即应用
        // 这样切换到可视化模式时数据已经准备好了
      } catch (error) {
        setJsonError(error.message);
      }
    } else {
      setJsonError('');
    }
  }, [onChange]);

  // 切换编辑模式
  const toggleEditMode = useCallback(() => {
    if (editMode === 'visual') {
      // 从可视化模式切换到手动模式
      setEditMode('manual');
    } else {
      // 从手动模式切换到可视化模式，需要验证JSON
      try {
        const parsed = value && value.trim() ? JSON.parse(value) : {};
        setJsonData(parsed);
        setJsonError('');
        setEditMode('visual');
      } catch (error) {
        setJsonError(error.message);
        // JSON格式错误时不切换模式
        return;
      }
    }
  }, [editMode, value]);

  // 添加键值对
  const addKeyValue = useCallback(() => {
    const newData = { ...jsonData };
    const keys = Object.keys(newData);
    let newKey = 'key';
    let counter = 1;
    while (newData.hasOwnProperty(newKey)) {
      newKey = `key${counter}`;
      counter++;
    }
    newData[newKey] = '';
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 删除键值对
  const removeKeyValue = useCallback((keyToRemove) => {
    const newData = { ...jsonData };
    delete newData[keyToRemove];
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 更新键名
  const updateKey = useCallback((oldKey, newKey) => {
    if (oldKey === newKey) return;
    const newData = { ...jsonData };
    const value = newData[oldKey];
    delete newData[oldKey];
    newData[newKey] = value;
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 更新值
  const updateValue = useCallback((key, newValue) => {
    const newData = { ...jsonData };
    newData[key] = newValue;
    handleVisualChange(newData);
  }, [jsonData, handleVisualChange]);

  // 填入模板
  const fillTemplate = useCallback(() => {
    if (template) {
      const templateString = JSON.stringify(template, null, 2);
      
      // 通过formApi设置值（如果提供的话）
      if (formApi && field) {
        formApi.setValue(field, templateString);
      }
      
      // 无论哪种模式都要更新值
      onChange?.(templateString);
      
      // 如果是可视化模式，同时更新jsonData
      if (editMode === 'visual') {
        setJsonData(template);
      }
      
      // 清除错误状态
      setJsonError('');
    }
  }, [template, onChange, editMode, formApi, field]);

  // 渲染键值对编辑器
  const renderKeyValueEditor = () => {
    if (typeof jsonData !== 'object' || jsonData === null) {
      return (
        <div className="text-center py-6 px-4">
          <div className="text-gray-400 mb-2">
            <IconCode size={32} />
          </div>
          <Text type="tertiary" className="text-gray-500 text-sm">
            {t('无效的JSON数据，请检查格式')}
          </Text>
        </div>
      );
    }
    const entries = Object.entries(jsonData);
    
    return (
      <div className="space-y-1">
        {entries.length === 0 && (
          <div className="text-center py-6 px-4">
            <div className="text-gray-400 mb-2">
              <IconCode size={32} />
            </div>
            <Text type="tertiary" className="text-gray-500 text-sm">
              {t('暂无数据，点击下方按钮添加键值对')}
            </Text>
          </div>
        )}
        
        {entries.map(([key, value], index) => (
          <Card key={index} className="!p-3 !border-gray-200 !rounded-md hover:shadow-sm transition-shadow duration-200">
            <Row gutter={12} align="middle">
              <Col span={10}>
                <div className="space-y-1">
                  <Text type="tertiary" size="small">{t('键名')}</Text>
                  <Input
                    placeholder={t('键名')}
                    value={key}
                    onChange={(newKey) => updateKey(key, newKey)}
                    size="small"
                  />
                </div>
              </Col>
              <Col span={11}>
                <div className="space-y-1">
                  <Text type="tertiary" size="small">{t('值')}</Text>
                  <Input
                    placeholder={t('值')}
                    value={value}
                    onChange={(newValue) => updateValue(key, newValue)}
                    size="small"
                  />
                </div>
              </Col>
              <Col span={3}>
                <div className="flex justify-center pt-4">
                  <Button
                    icon={<IconDelete />}
                    type="danger"
                    theme="borderless"
                    size="small"
                    onClick={() => removeKeyValue(key)}
                    className="hover:bg-red-50"
                  />
                </div>
              </Col>
            </Row>
          </Card>
        ))}
        
        <div className="flex justify-center pt-1">
          <Button
            icon={<IconPlus />}
            onClick={addKeyValue}
            size="small"
            theme="solid"
            type="primary"
            className="shadow-sm hover:shadow-md transition-shadow px-4"
          >
            {t('添加键值对')}
          </Button>
        </div>
      </div>
    );
  };

  // 渲染对象编辑器（用于复杂JSON）
  const renderObjectEditor = () => {
    const entries = Object.entries(jsonData);
    
    return (
      <div className="space-y-1">
        {entries.length === 0 && (
          <div className="text-center py-6 px-4">
            <div className="text-gray-400 mb-2">
              <IconSetting size={32} />
            </div>
            <Text type="tertiary" className="text-gray-500 text-sm">
              {t('暂无参数，点击下方按钮添加请求参数')}
            </Text>
          </div>
        )}
        
        {entries.map(([key, value], index) => (
          <Card key={index} className="!p-3 !border-gray-200 !rounded-md hover:shadow-sm transition-shadow duration-200">
            <Row gutter={12} align="middle">
              <Col span={8}>
                <div className="space-y-1">
                  <Text type="tertiary" size="small">{t('参数名')}</Text>
                  <Input
                    placeholder={t('参数名')}
                    value={key}
                    onChange={(newKey) => updateKey(key, newKey)}
                    size="small"
                  />
                </div>
              </Col>
              <Col span={13}>
                <div className="space-y-1">
                  <Text type="tertiary" size="small">{t('参数值')} ({typeof value})</Text>
                  {renderValueInput(key, value)}
                </div>
              </Col>
              <Col span={3}>
                <div className="flex justify-center pt-4">
                  <Button
                    icon={<IconDelete />}
                    type="danger"
                    theme="borderless"
                    size="small"
                    onClick={() => removeKeyValue(key)}
                    className="hover:bg-red-50"
                  />
                </div>
              </Col>
            </Row>
          </Card>
        ))}
        
        <div className="flex justify-center pt-1">
          <Button
            icon={<IconPlus />}
            onClick={addKeyValue}
            size="small"
            theme="solid"
            type="primary"
            className="shadow-sm hover:shadow-md transition-shadow px-4"
          >
            {t('添加参数')}
          </Button>
        </div>
      </div>
    );
  };

  // 渲染参数值输入控件
  const renderValueInput = (key, value) => {
    const valueType = typeof value;
    
    if (valueType === 'boolean') {
      return (
        <div className="flex items-center">
          <Switch
            checked={value}
            onChange={(newValue) => updateValue(key, newValue)}
            size="small"
          />
          <Text type="tertiary" size="small" className="ml-2">
            {value ? t('true') : t('false')}
          </Text>
        </div>
      );
    }
    
    if (valueType === 'number') {
      return (
        <InputNumber
          value={value}
          onChange={(newValue) => updateValue(key, newValue)}
          size="small"
          style={{ width: '100%' }}
          step={key === 'temperature' ? 0.1 : 1}
          precision={key === 'temperature' ? 2 : 0}
          placeholder={t('输入数字')}
        />
      );
    }
    
    // 字符串类型或其他类型
    return (
      <Input
        placeholder={t('参数值')}
        value={String(value)}
        onChange={(newValue) => {
          // 尝试转换为适当的类型
          let convertedValue = newValue;
          if (newValue === 'true') convertedValue = true;
          else if (newValue === 'false') convertedValue = false;
          else if (!isNaN(newValue) && newValue !== '' && newValue !== '0') {
            convertedValue = Number(newValue);
          }
          
          updateValue(key, convertedValue);
        }}
        size="small"
      />
    );
  };

  // 渲染区域编辑器（特殊格式）
  const renderRegionEditor = () => {
    const entries = Object.entries(jsonData);
    const defaultEntry = entries.find(([key]) => key === 'default');
    const modelEntries = entries.filter(([key]) => key !== 'default');
    
    return (
      <div className="space-y-1">
        {/* 默认区域 */}
        <Card className="!p-2 !border-blue-200 !bg-blue-50">
          <div className="flex items-center mb-1">
            <Text strong size="small" className="text-blue-700">{t('默认区域')}</Text>
          </div>
          <Input
            placeholder={t('默认区域，如: us-central1')}
            value={defaultEntry ? defaultEntry[1] : ''}
            onChange={(value) => updateValue('default', value)}
            size="small"
          />
        </Card>
        
        {/* 模型专用区域 */}
        <div className="space-y-1">
          <Text strong size="small">{t('模型专用区域')}</Text>
          {modelEntries.map(([modelName, region], index) => (
            <Card key={index} className="!p-3 !border-gray-200 !rounded-md hover:shadow-sm transition-shadow duration-200">
              <Row gutter={12} align="middle">
                <Col span={10}>
                  <div className="space-y-1">
                    <Text type="tertiary" size="small">{t('模型名称')}</Text>
                    <Input
                      placeholder={t('模型名称')}
                      value={modelName}
                      onChange={(newKey) => updateKey(modelName, newKey)}
                      size="small"
                    />
                  </div>
                </Col>
                <Col span={11}>
                  <div className="space-y-1">
                    <Text type="tertiary" size="small">{t('区域')}</Text>
                    <Input
                      placeholder={t('区域')}
                      value={region}
                      onChange={(newValue) => updateValue(modelName, newValue)}
                      size="small"
                    />
                  </div>
                </Col>
                <Col span={3}>
                  <div className="flex justify-center pt-4">
                    <Button
                      icon={<IconDelete />}
                      type="danger"
                      theme="borderless"
                      size="small"
                      onClick={() => removeKeyValue(modelName)}
                      className="hover:bg-red-50"
                    />
                  </div>
                </Col>
              </Row>
            </Card>
          ))}
          
          <div className="flex justify-center pt-1">
            <Button
              icon={<IconPlus />}
              onClick={addKeyValue}
              size="small"
              theme="solid"
              type="primary"
              className="shadow-sm hover:shadow-md transition-shadow px-4"
            >
              {t('添加模型区域')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染可视化编辑器
  const renderVisualEditor = () => {
    switch (editorType) {
      case 'region':
        return renderRegionEditor();
      case 'object':
        return renderObjectEditor();
      case 'keyValue':
      default:
        return renderKeyValueEditor();
    }
  };

  const hasJsonError = jsonError && jsonError.trim() !== '';

  return (
    <div className="space-y-1">
      {/* Label统一显示在上方 */}
      {label && (
        <div className="flex items-center">
          <Text className="text-sm font-medium text-gray-900">{label}</Text>
        </div>
      )}
      
      {/* 编辑模式切换 */}
      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
        <div className="flex items-center gap-2">
          {editMode === 'visual' && (
            <Text type="tertiary" size="small" className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
              {t('可视化模式')}
            </Text>
          )}
          {editMode === 'manual' && (
            <Text type="tertiary" size="small" className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
              {t('手动编辑模式')}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-2">
          {template && templateLabel && (
            <Button
              size="small"
              type="tertiary"
              onClick={fillTemplate}
              className="!text-semi-color-primary hover:bg-blue-50 text-xs"
            >
              {templateLabel}
            </Button>
          )}
          <Space size="tight">
            <Button
              size="small"
              type={editMode === 'visual' ? 'primary' : 'tertiary'}
              icon={<IconEdit />}
              onClick={toggleEditMode}
              disabled={editMode === 'manual' && hasJsonError}
              className={editMode === 'visual' ? 'shadow-sm' : ''}
            >
              {t('可视化')}
            </Button>
            <Button
              size="small"
              type={editMode === 'manual' ? 'primary' : 'tertiary'}
              icon={<IconCode />}
              onClick={toggleEditMode}
              className={editMode === 'manual' ? 'shadow-sm' : ''}
            >
              {t('手动编辑')}
            </Button>
          </Space>
        </div>
      </div>

      {/* JSON错误提示 */}
      {hasJsonError && (
        <Banner
          type="danger"
          description={`JSON 格式错误: ${jsonError}`}
          className="!rounded-md text-sm"
        />
      )}

      {/* 编辑器内容 */}
      {editMode === 'visual' ? (
        <div>
          <Card className="!p-3 !border-gray-200 !shadow-sm !rounded-md bg-white">
            {renderVisualEditor()}
          </Card>
          {/* 可视化模式下的额外文本显示在下方 */}
          {extraText && (
            <div className="text-xs text-gray-600 mt-0.5">
              {extraText}
            </div>
          )}
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
        <Form.TextArea
          field={field}
          placeholder={placeholder}
          value={value}
          onChange={handleManualChange}
          showClear={showClear}
          rows={Math.max(8, value ? value.split('\n').length : 8)}
          rules={rules}
          noLabel={true}
          {...props}
        />
      )}

      {/* 额外文本在手动编辑模式下显示 */}
      {extraText && editMode === 'manual' && (
        <div className="text-xs text-gray-600">
          {extraText}
        </div>
      )}
    </div>
  );
};

export default JSONEditor; 