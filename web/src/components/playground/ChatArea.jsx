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

import React, { useEffect, useRef, useState } from 'react';
import { Card, Button } from '@heroui/react';
import { MessageSquare, Eye, EyeOff, Send, Trash2 } from 'lucide-react';
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
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [message]);

  const handleSend = () => {
    const next = draft.trim();
    if (!next) return;
    onMessageSend(next);
    setDraft('');
  };

  const inputNode = (
    <textarea
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSend();
        }
      }}
      placeholder={t('请输入您的问题...')}
      rows={1}
      className='max-h-32 min-h-8 w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted'
    />
  );

  const clearContextNode = (
    <button
      type='button'
      aria-label={t('清空上下文')}
      onClick={onClearMessages}
      className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-red-500 hover:text-white'
    >
      <Trash2 size={14} />
    </button>
  );

  const sendNode = (
    <button
      type='button'
      aria-label={t('发送')}
      onClick={handleSend}
      className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white transition hover:bg-purple-600'
    >
      <Send size={14} />
    </button>
  );

  return (
    <Card
      className='h-full'
      bordered={false}
      bodyStyle={{
        padding: 0,
        height: 'calc(100vh - 66px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Chat header */}
      {styleState.isMobile ? (
        <div className='pt-4'></div>
      ) : (
        <div className='px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-t-2xl'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center'>
                <MessageSquare size={20} className='text-white' />
              </div>
              <div>
                <h5 className='mb-0 text-xl font-semibold text-white'>
                  {t('AI 对话')}
                </h5>
                <span className='hidden text-sm text-white/80 sm:inline'>
                  {inputs.model || t('选择模型开始对话')}
                </span>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                onPress={onToggleDebugPanel}
                variant='ghost'
                size='sm'
                className='rounded-lg text-white/80 hover:bg-white/10 hover:text-white'
              >
                {showDebugPanel ? <EyeOff size={14} /> : <Eye size={14} />}
                {showDebugPanel ? t('隐藏调试') : t('显示调试')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat content */}
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <div
          ref={(node) => {
            scrollRef.current = node;
            if (chatRef) {
              chatRef.current = node;
            }
          }}
          className='min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4'
        >
          {message.map((item, index) => {
            const role = roleInfo[item.role] || { name: item.role };
            const isUser = item.role === 'user';
            return (
              <div
                key={item.id || index}
                className={`rounded-2xl border p-4 shadow-sm ${
                  isUser
                    ? 'ml-auto max-w-[92%] border-blue-100 bg-blue-50/80 dark:border-blue-900/40 dark:bg-blue-950/30'
                    : 'mr-auto max-w-[92%] border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70'
                }`}
              >
                <div className='mb-2 flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500'>
                    {role.avatar ? (
                      <img
                        src={role.avatar}
                        alt=''
                        className='h-5 w-5 rounded-full'
                      />
                    ) : null}
                    {role.name}
                  </div>
                  {renderChatBoxAction?.({ message: item })}
                </div>
                {renderCustomChatContent({
                  message: item,
                  className: 'text-sm leading-6',
                })}
              </div>
            );
          })}
        </div>

        <CustomInputRender
          detailProps={{
            clearContextNode,
            uploadNode: null,
            inputNode,
            sendNode,
            onClick: () => {},
          }}
        />
      </div>
    </Card>
  );
};

export default ChatArea;
