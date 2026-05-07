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
import { Chat } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import PlaygroundComposer from './PlaygroundComposer';

const ChatArea = ({
  chatRef,
  message,
  inputs,
  models,
  videoModels,
  playgroundMode,
  customRequestMode,
  roleInfo,
  onInputChange,
  onModeChange,
  onMessageSend,
  onMessageCopy,
  onMessageReset,
  onMessageDelete,
  onStopGenerator,
  onClearMessages,
  renderCustomChatContent,
  renderChatBoxAction,
}) => {
  const { t } = useTranslation();

  const renderInputArea = React.useCallback(
    (props) => {
      return (
        <PlaygroundComposer
          {...props}
          inputs={inputs}
          models={models}
          videoModels={videoModels}
          playgroundMode={playgroundMode}
          customRequestMode={customRequestMode}
          onInputChange={onInputChange}
          onModeChange={onModeChange}
        />
      );
    },
    [
      customRequestMode,
      inputs,
      models,
      videoModels,
      onInputChange,
      onModeChange,
      playgroundMode,
    ],
  );

  return (
    <section className='new-playground-chat-area'>
      <div className='new-playground-chat-scroll'>
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
          className='new-playground-chat'
          placeholder={t('Send a message or type "/" to choose a skill')}
        />
      </div>
    </section>
  );
};

export default ChatArea;
