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
  isMobile,
}) => {
  const { t } = useTranslation();

  const renderInputArea = React.useCallback((props) => {
    return <CustomInputRender {...props} />;
  }, []);

  return (
    <Card
      className='playground-chat-card h-full'
      bordered={false}
      bodyStyle={{
        padding: 0,
        height: isMobile ? 'calc(100vh - 66px)' : 'calc(100vh - 88px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 聊天头部 */}
      {styleState.isMobile ? (
        <div className='playground-chat-mobile-spacer pt-4'></div>
      ) : (
        <div className='playground-chat-header px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='playground-chat-header-icon w-10 h-10 rounded-full flex items-center justify-center'>
                <MessageSquare size={20} />
              </div>
              <div>
                <Typography.Title
                  heading={5}
                  className='playground-chat-title mb-0'
                >
                  {t('AI 对话')}
                </Typography.Title>
                <Typography.Text className='playground-chat-subtitle text-sm hidden sm:inline'>
                  {inputs.model || t('选择模型开始对话')}
                </Typography.Text>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                icon={showDebugPanel ? <EyeOff size={14} /> : <Eye size={14} />}
                onClick={onToggleDebugPanel}
                theme='borderless'
                type='primary'
                size='small'
                className='playground-chat-debug-toggle !rounded-full'
              >
                {showDebugPanel ? t('隐藏调试') : t('显示调试')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 聊天内容区域 */}
      <div className='playground-chat-body flex-1 overflow-hidden'>
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
            // overflow: 'hidden',
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
          className='playground-chat-surface h-full'
          placeholder={t('请输入您的问题...')}
        />
      </div>
    </Card>
  );
};

export default ChatArea;
