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
import { Card, Button } from '@heroui/react';
import { Code, Zap, Clock, X, Eye, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CodeViewer from './CodeViewer';
import SSEViewer from './SSEViewer';

const DebugPanel = ({
  debugData,
  activeDebugTab,
  onActiveDebugTabChange,
  styleState,
  onCloseDebugPanel,
  customRequestMode,
}) => {
  const { t } = useTranslation();

  const [activeKey, setActiveKey] = useState(activeDebugTab);

  useEffect(() => {
    setActiveKey(activeDebugTab);
  }, [activeDebugTab]);

  const handleTabChange = (key) => {
    setActiveKey(key);
    onActiveDebugTabChange(key);
  };

  const tabs = [
    {
      key: 'preview',
      label: t('预览请求体'),
      icon: <Eye size={16} />,
      badge: customRequestMode ? t('自定义') : null,
      content: (
        <CodeViewer
          content={debugData.previewRequest}
          title='preview'
          language='json'
        />
      ),
    },
    {
      key: 'request',
      label: t('实际请求体'),
      icon: <Send size={16} />,
      content: (
        <CodeViewer
          content={debugData.request}
          title='request'
          language='json'
        />
      ),
    },
    {
      key: 'response',
      label: t('响应'),
      icon: <Zap size={16} />,
      badge:
        debugData.sseMessages && debugData.sseMessages.length > 0
          ? `SSE (${debugData.sseMessages.length})`
          : null,
      content:
        debugData.sseMessages && debugData.sseMessages.length > 0 ? (
          <SSEViewer sseData={debugData.sseMessages} title='response' />
        ) : (
          <CodeViewer
            content={debugData.response}
            title='response'
            language='json'
          />
        ),
    },
  ];

  const activeTab = tabs.find((tab) => tab.key === activeKey) || tabs[0];

  return (
    <Card
      className='h-full flex flex-col'
      bordered={false}
      bodyStyle={{
        padding: styleState.isMobile ? '16px' : '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className='flex items-center justify-between mb-6 flex-shrink-0'>
        <div className='flex items-center'>
          <div className='w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center mr-3'>
            <Code size={20} className='text-white' />
          </div>
          <h5 className='mb-0 text-xl font-semibold text-foreground'>
            {t('调试信息')}
          </h5>
        </div>

        {styleState.isMobile && onCloseDebugPanel && (
          <Button
            isIconOnly
            onPress={onCloseDebugPanel}
            variant='ghost'
            size='sm'
            className='rounded-lg'
            aria-label={t('关闭调试面板')}
          >
            <X size={16} />
          </Button>
        )}
      </div>

      <div className='flex min-h-0 flex-1 flex-col overflow-hidden debug-panel'>
        <div className='mb-3 flex flex-wrap gap-2'>
          {tabs.map((tab) => {
            const selected = tab.key === activeKey;
            return (
              <button
                key={tab.key}
                type='button'
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  selected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.icon}
                {tab.label}
                {tab.badge ? (
                  <span className='rounded-full bg-white/20 px-1.5 py-0.5 text-xs'>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className='min-h-0 flex-1 overflow-hidden'>{activeTab.content}</div>
      </div>

      <div className='flex items-center justify-between mt-4 pt-4 flex-shrink-0'>
        {(debugData.timestamp || debugData.previewTimestamp) && (
          <div className='flex items-center gap-2'>
            <Clock size={14} className='text-gray-500' />
            <span className='text-xs text-gray-500'>
              {activeKey === 'preview' && debugData.previewTimestamp
                ? `${t('预览更新')}: ${new Date(debugData.previewTimestamp).toLocaleString()}`
                : debugData.timestamp
                  ? `${t('最后请求')}: ${new Date(debugData.timestamp).toLocaleString()}`
                  : ''}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DebugPanel;
