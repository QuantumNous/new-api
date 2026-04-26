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

import React, { useState, useEffect } from 'react';
import { Button, Switch } from '@heroui/react';
import { Code, Edit, Check, X, AlertTriangle } from 'lucide-react';
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

  // Initialize with the default payload when custom mode is enabled.
  useEffect(() => {
    if (
      customRequestMode &&
      (!customRequestBody || customRequestBody.trim() === '')
    ) {
      const defaultJson = defaultPayload
        ? JSON.stringify(defaultPayload, null, 2)
        : '';
      setLocalValue(defaultJson);
      onCustomRequestBodyChange(defaultJson);
    }
  }, [
    customRequestMode,
    defaultPayload,
    customRequestBody,
    onCustomRequestBodyChange,
  ]);

  // Sync external customRequestBody into local state.
  useEffect(() => {
    if (customRequestBody !== localValue) {
      setLocalValue(customRequestBody || '');
      validateJson(customRequestBody || '');
    }
  }, [customRequestBody]);

  // Validate JSON format.
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
      setErrorMessage(`${t('JSON格式错误')}: ${error.message}`);
      return false;
    }
  };

  const handleValueChange = (value) => {
    setLocalValue(value);
    validateJson(value);
    // Always save user input and let preview logic handle JSON parsing errors.
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
      // Keep the original value when formatting fails.
    }
  };

  return (
    <div className='space-y-4'>
      {/* Custom mode switch */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Code size={16} className='text-gray-500' />
          <span className='text-sm font-semibold text-foreground'>
            {t('自定义请求体模式')}
          </span>
        </div>
        <Switch
          isSelected={customRequestMode}
          onChange={handleModeToggle}
          aria-label={t('自定义请求体模式')}
          size='sm'
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>

      {customRequestMode && (
        <>
          {/* Help text */}
          <div className='flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning'>
            <AlertTriangle className='mt-0.5 shrink-0' size={16} />
            <span>
              {t(
                '启用此模式后，将使用您自定义的请求体发送API请求，模型配置面板的参数设置将被忽略。',
              )}
            </span>
          </div>

          {/* JSON editor */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-sm font-semibold text-foreground'>
                {t('请求体 JSON')}
              </span>
              <div className='flex items-center gap-2'>
                {isValid ? (
                  <div className='flex items-center gap-1 text-green-600'>
                    <Check size={14} />
                    <span className='text-xs'>{t('格式正确')}</span>
                  </div>
                ) : (
                  <div className='flex items-center gap-1 text-red-600'>
                    <X size={14} />
                    <span className='text-xs'>{t('格式错误')}</span>
                  </div>
                )}
                <Button
                  variant='ghost'
                  size='sm'
                  onPress={formatJson}
                  isDisabled={!isValid}
                  className='rounded-lg'
                >
                  <Edit size={14} />
                  {t('格式化')}
                </Button>
              </div>
            </div>

            <textarea
              value={localValue}
              onChange={(event) => handleValueChange(event.target.value)}
              placeholder='{"model": "gpt-4o", "messages": [...], ...}'
              rows={8}
              className={`custom-request-textarea w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-accent ${!isValid ? 'border-red-500' : 'border-border'}`}
              style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                lineHeight: '1.5',
                maxHeight: 320,
                resize: 'vertical',
              }}
            />

            {!isValid && errorMessage && (
              <span className='mt-1 block text-xs text-danger'>
                {errorMessage}
              </span>
            )}

            <span className='mt-2 block text-xs text-gray-500'>
              {t(
                '请输入有效的JSON格式的请求体。您可以参考预览面板中的默认请求体格式。',
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomRequestEditor;
