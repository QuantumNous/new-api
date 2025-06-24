import React, { useState, useEffect } from 'react';
import {
  TextArea,
  Typography,
  Button,
  Switch,
  Banner,
} from '@douyinfe/semi-ui';
import {
  Code,
  Edit,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CustomRequestEditor = ({
  customRequestMode,
  customRequestBody,
  onCustomRequestModeChange,
  onCustomRequestBodyChange,
  defaultPayload,
}) => {
  const { t } = useTranslation();
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [localValue, setLocalValue] = useState(customRequestBody || '');

  // 当切换到自定义模式时，用默认payload初始化
  useEffect(() => {
    if (customRequestMode && (!customRequestBody || customRequestBody.trim() === '')) {
      const defaultJson = defaultPayload ? JSON.stringify(defaultPayload, null, 2) : '';
      setLocalValue(defaultJson);
      onCustomRequestBodyChange(defaultJson);
    }
  }, [customRequestMode, defaultPayload, customRequestBody, onCustomRequestBodyChange]);

  // 同步外部传入的customRequestBody到本地状态
  useEffect(() => {
    if (customRequestBody !== localValue) {
      setLocalValue(customRequestBody || '');
      validateJson(customRequestBody || '');
    }
  }, [customRequestBody]);

  // 验证JSON格式
  const validateJson = (value) => {
    if (!value.trim()) {
      setIsValid(true);
      setErrorMessage('');
      return true;
    }

    try {
      JSON.parse(value);
      setIsValid(true);
      setErrorMessage('');
      return true;
    } catch (error) {
      setIsValid(false);
      setErrorMessage(`JSON格式错误: ${error.message}`);
      return false;
    }
  };

  const handleValueChange = (value) => {
    setLocalValue(value);
    validateJson(value);
    // 始终保存用户输入，让预览逻辑处理JSON解析错误
    onCustomRequestBodyChange(value);
  };

  const handleModeToggle = (enabled) => {
    onCustomRequestModeChange(enabled);
    if (enabled && defaultPayload) {
      const defaultJson = JSON.stringify(defaultPayload, null, 2);
      setLocalValue(defaultJson);
      onCustomRequestBodyChange(defaultJson);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(localValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setLocalValue(formatted);
      onCustomRequestBodyChange(formatted);
      setIsValid(true);
      setErrorMessage('');
    } catch (error) {
      // 如果格式化失败，保持原样
    }
  };

  return (
    <div className="space-y-4">
      {/* 自定义模式开关 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code size={16} className="text-gray-500" />
          <Typography.Text strong className="text-sm">
            自定义请求体模式
          </Typography.Text>
        </div>
        <Switch
          checked={customRequestMode}
          onChange={handleModeToggle}
          checkedText="开"
          uncheckedText="关"
          size="small"
        />
      </div>

      {customRequestMode && (
        <>
          {/* 提示信息 */}
          <Banner
            type="warning"
            description="启用此模式后，将使用您自定义的请求体发送API请求，模型配置面板的参数设置将被忽略。"
            icon={<AlertTriangle size={16} />}
            className="!rounded-lg"
            closable={false}
          />

          {/* JSON编辑器 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Typography.Text strong className="text-sm">
                请求体 JSON
              </Typography.Text>
              <div className="flex items-center gap-2">
                {isValid ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check size={14} />
                    <Typography.Text className="text-xs">
                      格式正确
                    </Typography.Text>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600">
                    <X size={14} />
                    <Typography.Text className="text-xs">
                      格式错误
                    </Typography.Text>
                  </div>
                )}
                <Button
                  theme="borderless"
                  type="tertiary"
                  size="small"
                  icon={<Edit size={14} />}
                  onClick={formatJson}
                  disabled={!isValid}
                  className="!rounded-lg"
                >
                  格式化
                </Button>
              </div>
            </div>

            <TextArea
              value={localValue}
              onChange={handleValueChange}
              placeholder='{"model": "gpt-4o", "messages": [...], ...}'
              autosize={{ minRows: 8, maxRows: 20 }}
              className={`custom-request-textarea !rounded-lg font-mono text-sm ${!isValid ? '!border-red-500' : ''}`}
              style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                lineHeight: '1.5',
              }}
            />

            {!isValid && errorMessage && (
              <Typography.Text type="danger" className="text-xs mt-1 block">
                {errorMessage}
              </Typography.Text>
            )}

            <Typography.Text className="text-xs text-gray-500 mt-2 block">
              请输入有效的JSON格式的请求体。您可以参考预览面板中的默认请求体格式。
            </Typography.Text>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomRequestEditor; 