import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Collapse, NavBar } from 'antd-mobile';

import { UserContext } from '@classic/context/User';
import { usePlaygroundState } from '@classic/hooks/playground/usePlaygroundState';
import { useApiRequest } from '@classic/hooks/playground/useApiRequest';
import { useDataLoader } from '@classic/hooks/playground/useDataLoader';
import {
  MESSAGE_ROLES,
  MESSAGE_STATUS,
} from '@classic/constants/playground.constants';
import { buildApiPayload } from '@classic/helpers/api';

import ConfigBar from '../components/gen/ConfigBar';
import MessageFeed from '../components/gen/MessageFeed';
import PromptBar from '../components/gen/PromptBar';
import {
  createMessage,
  createLoadingAssistantMessage,
  getTextContent,
} from '../shims/classic-utils';

const Chat = () => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);

  const state = usePlaygroundState();
  const {
    inputs,
    parameterEnabled,
    message,
    setMessage,
    setModels,
    setGroups,
    setModelEndpointTypes,
    setDebugData,
    setActiveDebugTab,
    sseSourceRef,
    saveMessagesImmediately,
    handleInputChange,
    models,
    groups,
  } = state;

  const { sendRequest, onStopGenerator } = useApiRequest(
    setMessage,
    setDebugData,
    setActiveDebugTab,
    sseSourceRef,
    saveMessagesImmediately,
  );

  useDataLoader(
    userState,
    inputs,
    handleInputChange,
    setModels,
    setGroups,
    setModelEndpointTypes,
  );

  const lastMessage = message[message.length - 1];
  const generating =
    lastMessage?.role === MESSAGE_ROLES.ASSISTANT &&
    (lastMessage.status === MESSAGE_STATUS.LOADING ||
      lastMessage.status === MESSAGE_STATUS.INCOMPLETE);

  const handleSend = (content) => {
    if (generating) return;
    const userMessage = createMessage(MESSAGE_ROLES.USER, content);
    const loadingMessage = createLoadingAssistantMessage();
    setMessage((prev) => {
      const newMessages = [...prev, userMessage];
      const payload = buildApiPayload(
        newMessages,
        null,
        inputs,
        parameterEnabled,
      );
      sendRequest(payload, inputs.stream);
      const withLoading = [...newMessages, loadingMessage];
      setTimeout(() => saveMessagesImmediately(withLoading), 0);
      return withLoading;
    });
  };

  const handleClear = () => {
    // 与 classic handleClearMessages 一致：清空并立即持久化空列表，
    // 否则重进对话页会重新加载已存的旧消息（原来只 setMessage 未落盘）。
    setMessage([]);
    setTimeout(() => saveMessagesImmediately([]), 0);
  };

  const renderAssistant = (m) => {
    const text = getTextContent(m);
    return (
      <div>
        {m.reasoningContent && (
          <Collapse defaultActiveKey={[]} style={{ marginBottom: 8 }}>
            <Collapse.Panel key='think' title='思考过程'>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--adm-color-weak)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.reasoningContent}
              </div>
            </Collapse.Panel>
          </Collapse>
        )}
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text ||
            (m.status === MESSAGE_STATUS.LOADING ? '思考中…' : '')}
        </div>
        {m.status === MESSAGE_STATUS.ERROR && (
          <div style={{ color: 'var(--adm-color-danger)', marginTop: 4 }}>
            请求出错，请重试
          </div>
        )}
      </div>
    );
  };

  const visibleMessages = message.filter(
    (m) => m.role !== MESSAGE_ROLES.SYSTEM,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar
        onBack={() => navigate(-1)}
        right={
          visibleMessages.length > 0 && (
            <Button size='mini' fill='none' onClick={handleClear}>
              清空
            </Button>
          )
        }
      >
        对话
      </NavBar>
      <ConfigBar
        disabled={generating}
        fields={[
          {
            key: 'group',
            label: '分组',
            value: inputs.group,
            options: groups,
            onChange: (v) => handleInputChange('group', v),
          },
          {
            key: 'model',
            label: '模型',
            value: inputs.model,
            options: models,
            onChange: (v) => handleInputChange('model', v),
          },
        ]}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <MessageFeed
          messages={visibleMessages}
          renderAssistant={renderAssistant}
          empty='输入内容开始对话'
        />
      </div>
      {generating && (
        <div style={{ textAlign: 'center', padding: 4 }}>
          <Button size='mini' fill='outline' onClick={onStopGenerator}>
            停止生成
          </Button>
        </div>
      )}
      <PromptBar
        onSend={handleSend}
        generating={false}
        disabled={generating}
        placeholder='输入内容…'
      />
    </div>
  );
};

export default Chat;
