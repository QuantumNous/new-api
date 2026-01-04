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

import React from 'react';
import { Card, Chat, Typography, Button } from '@douyinfe/semi-ui';
import { MessageSquare, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CustomInputRender from './CustomInputRender';
import { IconMenu } from '@douyinfe/semi-icons';

const ChatArea = ({
  chatRef,
  message,
  inputs,
  styleState,
  showDebugPanel,
  roleInfo,
  onMessageSend,
  onMessageCopy,
  onMessageReset,
  onMessageDelete,
  onStopGenerator,
  onClearMessages,
  onToggleDebugPanel,
  renderCustomChatContent,
  renderChatBoxAction,
  onOpenHistory,
}) => {
  const { t } = useTranslation();

  const renderInputArea = React.useCallback((props) => {
    return <CustomInputRender {...props} />;
  }, []);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0b0b0b]">
      {/* 聊天头部 */}
      {styleState.isMobile ? (
        <div className='flex items-center justify-between px-4 py-3 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-gray-800 shrink-0'>
            <Button 
                icon={<IconMenu />} 
                theme="borderless" 
                type="tertiary" 
                onClick={onOpenHistory}
            />
            <Typography.Text strong>{t('Chat')}</Typography.Text>
            <div className='w-8'></div>{/* Spacer for centering */}
        </div>
      ) : (
        <div className='px-6 py-4 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-gray-800 shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
                <MessageSquare size={18} className='text-gray-600 dark:text-gray-300' />
              </div>
              <div>
                <div className='flex items-center gap-2'>
                    <Typography.Title heading={6} className='!mb-0 text-gray-900 dark:text-white'>
                    {t('Chat')}
                    </Typography.Title>
                    {inputs.model && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                            {inputs.model}
                        </span>
                    )}
                </div>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                icon={showDebugPanel ? <EyeOff size={14} /> : <Eye size={14} />}
                onClick={onToggleDebugPanel}
                theme='borderless'
                type='tertiary'
                size='small'
                className='!text-gray-500 hover:!text-gray-700 dark:!text-gray-400 dark:hover:!text-gray-200'
              >
                {showDebugPanel ? t('Hide Debug') : t('Show Debug')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 聊天内容区域 */}
      <div className='flex-1 overflow-hidden relative'>
        <Chat
          ref={chatRef}
          chatBoxRenderConfig={{
            renderChatBoxContent: renderCustomChatContent,
            renderChatBoxAction: renderChatBoxAction,
            renderChatBoxTitle: () => null,
          }}
          renderInputArea={renderInputArea}
          roleConfig={roleInfo}
          style={{
            height: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
          chats={message}
          onMessageSend={onMessageSend}
          onMessageCopy={onMessageCopy}
          onMessageReset={onMessageReset}
          onMessageDelete={onMessageDelete}
          showClearContext
          showStopGenerate
          onStopGenerator={onStopGenerator}
          onClear={onClearMessages}
          className='h-full'
          placeholder={t('Type a message...')}
        />
      </div>
    </div>
  );
};

export default ChatArea;
