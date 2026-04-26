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

import React, { useState, useMemo, useCallback } from 'react';
import { Button, Tooltip } from '@heroui/react';
import {
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copy, showError, showSuccess } from '../../helpers';

const PILL_TONE_CLASS = {
  default:
    'border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  primary:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200',
  success:
    'border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
};

const Pill = ({ children, tone = 'default' }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PILL_TONE_CLASS[tone] || PILL_TONE_CLASS.default}`}
  >
    {children}
  </span>
);

/**
 * SSEViewer component for displaying Server-Sent Events in an interactive format
 * @param {Object} props - Component props
 * @param {Array} props.sseData - Array of SSE messages to display
 * @returns {JSX.Element} Rendered SSE viewer component
 */
const SSEViewer = ({ sseData }) => {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [copied, setCopied] = useState(false);

  const parsedSSEData = useMemo(() => {
    if (!sseData || !Array.isArray(sseData)) {
      return [];
    }

    return sseData.map((item, index) => {
      let parsed = null;
      let error = null;
      let isDone = false;

      if (item === '[DONE]') {
        isDone = true;
      } else {
        try {
          parsed = typeof item === 'string' ? JSON.parse(item) : item;
        } catch (e) {
          error = e.message;
        }
      }

      return {
        index,
        raw: item,
        parsed,
        error,
        isDone,
        key: `sse-${index}`,
      };
    });
  }, [sseData]);

  const stats = useMemo(() => {
    const total = parsedSSEData.length;
    const errors = parsedSSEData.filter((item) => item.error).length;
    const done = parsedSSEData.filter((item) => item.isDone).length;
    const valid = total - errors - done;

    return { total, errors, done, valid };
  }, [parsedSSEData]);

  const handleToggleAll = useCallback(() => {
    setExpandedKeys((prev) => {
      if (prev.length === parsedSSEData.length) {
        return [];
      } else {
        return parsedSSEData.map((item) => item.key);
      }
    });
  }, [parsedSSEData]);

  const handleCopyAll = useCallback(async () => {
    try {
      const allData = parsedSSEData
        .map((item) =>
          item.parsed ? JSON.stringify(item.parsed, null, 2) : item.raw,
        )
        .join('\n\n');

      await copy(allData);
      setCopied(true);
      showSuccess(t('已复制全部数据'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showError(t('复制失败'));
      console.error('Copy failed:', err);
    }
  }, [parsedSSEData, t]);

  const handleCopySingle = useCallback(
    async (item) => {
      try {
        const textToCopy = item.parsed
          ? JSON.stringify(item.parsed, null, 2)
          : item.raw;
        await copy(textToCopy);
        showSuccess(t('已复制'));
      } catch (err) {
        showError(t('复制失败'));
      }
    },
    [t],
  );

  const renderSSEItem = (item) => {
    if (item.isDone) {
      return (
        <div className='flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg'>
          <CheckCircle size={16} className='text-green-600' />
          <span className='font-medium text-green-600'>
            {t('流式响应完成')} [DONE]
          </span>
        </div>
      );
    }

    if (item.error) {
      return (
        <div className='space-y-2'>
          <div className='flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg'>
            <XCircle size={16} className='text-red-600' />
            <span className='text-red-600'>
              {t('解析错误')}: {item.error}
            </span>
          </div>
          <div className='p-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-xs overflow-auto'>
            <pre>{item.raw}</pre>
          </div>
        </div>
      );
    }

    return (
      <div className='space-y-2'>
        {/* Formatted JSON display */}
        <div className='relative'>
          <pre className='p-4 bg-gray-900 text-gray-100 rounded-lg overflow-auto text-xs font-mono leading-relaxed'>
            {JSON.stringify(item.parsed, null, 2)}
          </pre>
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            onPress={() => handleCopySingle(item)}
            className='absolute right-2 top-2 bg-gray-800/80 text-gray-300 hover:bg-gray-700'
            aria-label={t('复制')}
          >
            <Copy size={12} />
          </Button>
        </div>

        {/* Key summary */}
        {item.parsed?.choices?.[0] && (
          <div className='flex flex-wrap gap-2 text-xs'>
            {item.parsed.choices[0].delta?.content && (
              <Pill tone='primary'>
                {`${t('内容')}: "${String(item.parsed.choices[0].delta.content).substring(0, 20)}..."`}
              </Pill>
            )}
            {item.parsed.choices[0].delta?.reasoning_content && (
              <Pill tone='warning'>{t('有 Reasoning')}</Pill>
            )}
            {item.parsed.choices[0].finish_reason && (
              <Pill tone='success'>
                {`${t('完成')}: ${item.parsed.choices[0].finish_reason}`}
              </Pill>
            )}
            {item.parsed.usage && (
              <Pill>
                {`${t('令牌')}: ${item.parsed.usage.prompt_tokens || 0}/${item.parsed.usage.completion_tokens || 0}`}
              </Pill>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!parsedSSEData || parsedSSEData.length === 0) {
    return (
      <div className='flex items-center justify-center h-full min-h-[200px] text-gray-500'>
        <span>{t('暂无SSE响应数据')}</span>
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-lg'>
      {/* Header toolbar */}
      <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <Zap size={16} className='text-blue-500' />
          <span className='font-semibold text-foreground'>{t('SSE数据流')}</span>
          <Pill tone='primary'>{stats.total}</Pill>
          {stats.errors > 0 && (
            <Pill tone='danger'>{`${stats.errors} ${t('错误')}`}</Pill>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <Tooltip content={t('复制全部')}>
            <Button
              size='sm'
              onPress={handleCopyAll}
              variant='ghost'
            >
              <Copy size={14} />
              {copied ? t('已复制') : t('复制全部')}
            </Button>
          </Tooltip>
          <Tooltip
            content={
              expandedKeys.length === parsedSSEData.length
                ? t('全部收起')
                : t('全部展开')
            }
          >
            <Button
              size='sm'
              onPress={handleToggleAll}
              variant='ghost'
            >
              {expandedKeys.length === parsedSSEData.length ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              {expandedKeys.length === parsedSSEData.length
                ? t('收起')
                : t('展开')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* SSE data list */}
      <div className='flex-1 overflow-auto p-4'>
        <div className='overflow-hidden rounded-lg bg-white dark:bg-gray-800'>
          {parsedSSEData.map((item) => (
            <div key={item.key} className='border-b border-gray-100 last:border-b-0 dark:border-gray-700'>
              <button
                type='button'
                className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-700/40'
                onClick={() =>
                  setExpandedKeys((prev) =>
                    prev.includes(item.key)
                      ? prev.filter((key) => key !== item.key)
                      : [...prev, item.key],
                  )
                }
              >
                <div className='flex min-w-0 items-center gap-2'>
                  <Pill>{`#${item.index + 1}`}</Pill>
                  {item.isDone ? (
                    <span className='text-green-600 font-medium'>[DONE]</span>
                  ) : item.error ? (
                    <span className='text-red-600'>{t('解析错误')}</span>
                  ) : (
                    <>
                      <span className='text-gray-600'>
                        {item.parsed?.id ||
                          item.parsed?.object ||
                          t('SSE 事件')}
                      </span>
                      {item.parsed?.choices?.[0]?.delta && (
                        <span className='text-xs text-gray-400'>
                          •{' '}
                          {Object.keys(item.parsed.choices[0].delta)
                            .filter((k) => item.parsed.choices[0].delta[k])
                            .join(', ')}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {expandedKeys.includes(item.key) ? (
                  <ChevronUp className='shrink-0 text-gray-400' size={16} />
                ) : (
                  <ChevronDown className='shrink-0 text-gray-400' size={16} />
                )}
              </button>
              {expandedKeys.includes(item.key) && (
                <div className='px-4 pb-4'>{renderSSEItem(item)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SSEViewer;
