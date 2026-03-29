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
import { Button, Card, Chat, Typography } from '@douyinfe/semi-ui';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CustomInputRender from './CustomInputRender';

const ChatArea = ({
  chatRef,
  message,
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
  title,
  subtitle,
  placeholder,
}) => {
  const { t } = useTranslation();

  const renderInputArea = React.useCallback((props) => {
    return <CustomInputRender {...props} />;
  }, []);

  return (
    <Card
      className='h-full rounded-3xl overflow-hidden shadow-[0_18px_50px_rgba(15,23,42,0.08)]'
      bordered={false}
      bodyStyle={{
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {styleState.isMobile ? (
        <div className='pt-4' />
      ) : (
        <div className='px-6 py-4 bg-gradient-to-r from-slate-900 via-sky-900 to-cyan-700 rounded-t-3xl'>
          <div className='flex items-center justify-between gap-4'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white'>
                <MessageSquare size={20} />
              </div>
              <div className='min-w-0'>
                <Typography.Title heading={5} className='!text-white mb-0'>
                  {title || t('AI 对话')}
                </Typography.Title>
                <Typography.Text className='!text-white/80 text-sm hidden sm:inline'>
                  {subtitle || t('选择模型开始创作')}
                </Typography.Text>
              </div>
            </div>
            <Button
              icon={showDebugPanel ? <EyeOff size={14} /> : <Eye size={14} />}
              onClick={onToggleDebugPanel}
              theme='borderless'
              type='primary'
              size='small'
              className='!rounded-lg !text-white/80 hover:!text-white hover:!bg-white/10'
            >
              {showDebugPanel ? t('隐藏调试') : t('显示调试')}
            </Button>
          </div>
        </div>
      )}

      <div className='flex-1 overflow-hidden'>
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
          placeholder={placeholder || t('请输入您的问题...')}
        />
      </div>
    </Card>
  );
};

export default ChatArea;
