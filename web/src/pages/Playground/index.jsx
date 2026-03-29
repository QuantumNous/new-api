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

import React, { useCallback, useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Layout, Toast, Typography } from '@douyinfe/semi-ui';
import { AlertTriangle } from 'lucide-react';
import { UserContext } from '../../context/User';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { usePlaygroundState } from '../../hooks/playground/usePlaygroundState';
import { useMessageActions } from '../../hooks/playground/useMessageActions';
import { useApiRequest } from '../../hooks/playground/useApiRequest';
import { useSyncMessageAndCustomBody } from '../../hooks/playground/useSyncMessageAndCustomBody';
import { useMessageEdit } from '../../hooks/playground/useMessageEdit';
import { useDataLoader } from '../../hooks/playground/useDataLoader';
import { ERROR_MESSAGES, MESSAGE_ROLES } from '../../constants/playground.constants';
import {
  buildApiPayload,
  buildMessageContent,
  createLoadingAssistantMessage,
  createMessage,
  encodeToBase64,
  getAvailableModelsForPlaygroundMode,
  getLogo,
  getPreferredModelForPlaygroundMode,
  getTextContent,
  isModelCompatibleWithPlaygroundMode,
  PLAYGROUND_MODES,
  stringToColor,
} from '../../helpers';
import {
  OptimizedDebugPanel,
  OptimizedMessageActions,
  OptimizedMessageContent,
  OptimizedSettingsPanel,
} from '../../components/playground/OptimizedComponents';
import ChatArea from '../../components/playground/ChatArea';
import FloatingButtons from '../../components/playground/FloatingButtons';
import PlaygroundCreationCenter from '../../components/playground/PlaygroundCreationCenter';
import { PlaygroundProvider } from '../../contexts/PlaygroundContext';

const generateAvatarDataUrl = (username) => {
  if (!username) {
    return 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png';
  }
  const firstLetter = username[0].toUpperCase();
  const bgColor = stringToColor(username);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="${bgColor}" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="16" fill="#ffffff" font-family="sans-serif">${firstLetter}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${encodeToBase64(svg)}`;
};

const Playground = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const [searchParams] = useSearchParams();

  const state = usePlaygroundState();
  const {
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    playgroundMode,
    showSettings,
    models,
    groups,
    message,
    debugData,
    activeDebugTab,
    previewPayload,
    sseSourceRef,
    chatRef,
    handleInputChange,
    handleParameterToggle,
    debouncedSaveConfig,
    saveMessagesImmediately,
    handleConfigImport,
    handleConfigReset,
    setShowSettings,
    setModels,
    setGroups,
    setMessage,
    setDebugData,
    setActiveDebugTab,
    setPreviewPayload,
    setShowDebugPanel,
    setCustomRequestMode,
    setCustomRequestBody,
    setPlaygroundMode,
  } = state;

  const { sendRequest, onStopGenerator } = useApiRequest(
    setMessage,
    setDebugData,
    setActiveDebugTab,
    sseSourceRef,
    saveMessagesImmediately,
  );

  useDataLoader(userState, inputs, handleInputChange, setModels, setGroups);

  const {
    editingMessageId,
    editValue,
    setEditValue,
    handleMessageEdit,
    handleEditSave,
    handleEditCancel,
  } = useMessageEdit(
    setMessage,
    inputs,
    parameterEnabled,
    sendRequest,
    saveMessagesImmediately,
  );

  const { syncMessageToCustomBody, syncCustomBodyToMessage } =
    useSyncMessageAndCustomBody(
      customRequestMode,
      customRequestBody,
      message,
      inputs,
      setCustomRequestBody,
      setMessage,
      debouncedSaveConfig,
    );

  const roleInfo = {
    user: {
      name: userState?.user?.username || 'User',
      avatar: generateAvatarDataUrl(userState?.user?.username),
    },
    assistant: {
      name: 'Assistant',
      avatar: getLogo(),
    },
    system: {
      name: 'System',
      avatar: getLogo(),
    },
  };

  const availableModeModels = {
    [PLAYGROUND_MODES.CHAT]: getAvailableModelsForPlaygroundMode(
      models,
      PLAYGROUND_MODES.CHAT,
    ),
    [PLAYGROUND_MODES.IMAGE]: getAvailableModelsForPlaygroundMode(
      models,
      PLAYGROUND_MODES.IMAGE,
    ),
    [PLAYGROUND_MODES.VIDEO]: getAvailableModelsForPlaygroundMode(
      models,
      PLAYGROUND_MODES.VIDEO,
    ),
  };
  const modelsLoaded = models.length > 0;
  const modeCounts = {
    [PLAYGROUND_MODES.CHAT]: availableModeModels.chat.length,
    [PLAYGROUND_MODES.IMAGE]: availableModeModels.image.length,
    [PLAYGROUND_MODES.VIDEO]: availableModeModels.video.length,
  };
  const modeHasAvailableModels = !modelsLoaded || modeCounts[playgroundMode] > 0;

  const modeUi = {
    [PLAYGROUND_MODES.CHAT]: {
      title: t('智能对话工作区'),
      subtitle: inputs.model
        ? `${t('当前模型')} · ${inputs.model}`
        : t('选择模型开始创作'),
      placeholder: t('输入你的问题、任务或提示词方向...'),
      unavailableTitle: t('当前账号暂无适合智能对话的模型'),
      unavailableDescription: t(
        '可以先切换到图片创作或视频创作，也可以在左侧模型配置中查看当前账号返回的全量模型列表。',
      ),
    },
    [PLAYGROUND_MODES.IMAGE]: {
      title: t('图片创作工作区'),
      subtitle: inputs.model
        ? `${t('当前模型')} · ${inputs.model}`
        : t('可继续使用文生图与带图编辑能力'),
      placeholder: t('描述想要生成的画面，或先开启图片输入后再进行图片编辑...'),
      unavailableTitle: t('当前账号暂无适合图片创作的模型'),
      unavailableDescription: t(
        '图片创作会优先匹配图片模型；如果当前账号没有返回相关模型，请切换模式或等待模型配置更新。',
      ),
    },
    [PLAYGROUND_MODES.VIDEO]: {
      title: t('视频创作工作区'),
      subtitle: inputs.model
        ? `${t('当前模型')} · ${inputs.model}`
        : t('可继续使用文生视频与参考图视频能力'),
      placeholder: t('描述想生成的视频镜头、节奏和风格，必要时可先开启图片输入作为参考图...'),
      unavailableTitle: t('当前账号暂无适合视频创作的模型'),
      unavailableDescription: t(
        '视频创作会优先匹配视频模型；如果当前账号暂未返回相关模型，可先切换到其它创作模式。',
      ),
    },
  };
  const activeModeUi = modeUi[playgroundMode] || modeUi[PLAYGROUND_MODES.CHAT];

  const constructPreviewPayload = useCallback(() => {
    try {
      if (customRequestMode && customRequestBody && customRequestBody.trim()) {
        try {
          return JSON.parse(customRequestBody);
        } catch (parseError) {
          console.warn('Failed to parse custom request body for preview:', parseError);
        }
      }

      const messages = [...message];
      if (
        !(
          messages.length === 0 ||
          messages.every((item) => item.role !== MESSAGE_ROLES.USER)
        )
      ) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
          if (messages[index].role === MESSAGE_ROLES.USER) {
            if (inputs.imageEnabled && inputs.imageUrls) {
              const validImageUrls = inputs.imageUrls.filter(
                (url) => url.trim() !== '',
              );
              if (validImageUrls.length > 0) {
                const textContent = getTextContent(messages[index]) || '示例消息';
                messages[index] = {
                  ...messages[index],
                  content: buildMessageContent(textContent, validImageUrls, true),
                };
              }
            }
            break;
          }
        }
      }

      return buildApiPayload(messages, null, inputs, parameterEnabled);
    } catch (error) {
      console.error('Failed to construct preview payload:', error);
      return null;
    }
  }, [customRequestBody, customRequestMode, inputs, message, parameterEnabled]);

  const handleModeChange = useCallback(
    (nextMode) => {
      setPlaygroundMode(nextMode);
      if (nextMode === PLAYGROUND_MODES.CHAT && inputs.imageEnabled) {
        handleInputChange('imageEnabled', false);
      }

      const preferredModel = getPreferredModelForPlaygroundMode(
        inputs.model,
        models,
        nextMode,
      );
      if (preferredModel && preferredModel !== inputs.model) {
        handleInputChange('model', preferredModel);
      }
    },
    [
      handleInputChange,
      inputs.imageEnabled,
      inputs.model,
      models,
      setPlaygroundMode,
    ],
  );

  useEffect(() => {
    if (playgroundMode === PLAYGROUND_MODES.CHAT && inputs.imageEnabled) {
      handleInputChange('imageEnabled', false);
    }
  }, [handleInputChange, inputs.imageEnabled, playgroundMode]);

  useEffect(() => {
    if (!modelsLoaded) {
      return;
    }

    const preferredModel = getPreferredModelForPlaygroundMode(
      inputs.model,
      models,
      playgroundMode,
    );
    if (preferredModel && preferredModel !== inputs.model) {
      handleInputChange('model', preferredModel);
    }
  }, [handleInputChange, inputs.model, models, modelsLoaded, playgroundMode]);

  const onMessageSend = useCallback(
    (content, attachment) => {
      console.log('attachment: ', attachment);

      if (!customRequestMode) {
        const preferredModel = getPreferredModelForPlaygroundMode(
          inputs.model,
          models,
          playgroundMode,
        );
        const resolvedModel = preferredModel || inputs.model;

        if (!modeHasAvailableModels || !resolvedModel) {
          Toast.warning(activeModeUi.unavailableTitle);
          return;
        }

        if (!isModelCompatibleWithPlaygroundMode(resolvedModel, playgroundMode)) {
          Toast.warning(activeModeUi.unavailableTitle);
          return;
        }

        if (resolvedModel !== inputs.model) {
          handleInputChange('model', resolvedModel);
        }
      }

      const userMessage = createMessage(MESSAGE_ROLES.USER, content);
      const loadingMessage = createLoadingAssistantMessage();

      if (customRequestMode && customRequestBody) {
        try {
          const customPayload = JSON.parse(customRequestBody);

          setMessage((prevMessage) => {
            const newMessages = [...prevMessage, userMessage, loadingMessage];
            sendRequest(customPayload, customPayload.stream !== false);
            setTimeout(() => saveMessagesImmediately(newMessages), 0);
            return newMessages;
          });
          return;
        } catch (error) {
          console.error('Failed to parse custom request body:', error);
          Toast.error(ERROR_MESSAGES.JSON_PARSE_ERROR);
          return;
        }
      }

      const validImageUrls = (inputs.imageUrls || []).filter(
        (url) => url.trim() !== '',
      );
      const messageContent = buildMessageContent(
        content,
        validImageUrls,
        inputs.imageEnabled,
      );
      const userMessageWithImages = createMessage(
        MESSAGE_ROLES.USER,
        messageContent,
      );

      const preferredModel = getPreferredModelForPlaygroundMode(
        inputs.model,
        models,
        playgroundMode,
      );
      const requestInputs =
        preferredModel && preferredModel !== inputs.model
          ? { ...inputs, model: preferredModel }
          : inputs;

      setMessage((prevMessage) => {
        const newMessages = [...prevMessage, userMessageWithImages];
        const payload = buildApiPayload(
          newMessages,
          null,
          requestInputs,
          parameterEnabled,
        );
        sendRequest(payload, requestInputs.stream);

        if (inputs.imageEnabled) {
          setTimeout(() => {
            handleInputChange('imageEnabled', false);
          }, 100);
        }

        const messagesWithLoading = [...newMessages, loadingMessage];
        setTimeout(() => saveMessagesImmediately(messagesWithLoading), 0);
        return messagesWithLoading;
      });
    },
    [
      activeModeUi.unavailableTitle,
      customRequestBody,
      customRequestMode,
      handleInputChange,
      inputs,
      modeHasAvailableModels,
      models,
      parameterEnabled,
      playgroundMode,
      saveMessagesImmediately,
      sendRequest,
      setMessage,
    ],
  );

  const messageActions = useMessageActions(
    message,
    setMessage,
    onMessageSend,
    saveMessagesImmediately,
  );

  const toggleReasoningExpansion = useCallback(
    (messageId) => {
      setMessage((prevMessages) =>
        prevMessages.map((item) =>
          item.id === messageId && item.role === MESSAGE_ROLES.ASSISTANT
            ? { ...item, isReasoningExpanded: !item.isReasoningExpanded }
            : item,
        ),
      );
    },
    [setMessage],
  );

  const renderCustomChatContent = useCallback(
    ({ message: currentMessage, className }) => {
      const isCurrentlyEditing = editingMessageId === currentMessage.id;

      return (
        <OptimizedMessageContent
          message={currentMessage}
          className={className}
          styleState={styleState}
          onToggleReasoningExpansion={toggleReasoningExpansion}
          isEditing={isCurrentlyEditing}
          onEditSave={handleEditSave}
          onEditCancel={handleEditCancel}
          editValue={editValue}
          onEditValueChange={setEditValue}
        />
      );
    },
    [
      editValue,
      editingMessageId,
      handleEditCancel,
      handleEditSave,
      setEditValue,
      styleState,
      toggleReasoningExpansion,
    ],
  );

  const renderChatBoxAction = useCallback(
    (props) => {
      const { message: currentMessage } = props;
      const isAnyMessageGenerating = message.some(
        (item) => item.status === 'loading' || item.status === 'incomplete',
      );
      const isCurrentlyEditing = editingMessageId === currentMessage.id;

      return (
        <OptimizedMessageActions
          message={currentMessage}
          styleState={styleState}
          onMessageReset={messageActions.handleMessageReset}
          onMessageCopy={messageActions.handleMessageCopy}
          onMessageDelete={messageActions.handleMessageDelete}
          onRoleToggle={messageActions.handleRoleToggle}
          onMessageEdit={handleMessageEdit}
          isAnyMessageGenerating={isAnyMessageGenerating}
          isEditing={isCurrentlyEditing}
        />
      );
    },
    [editingMessageId, handleMessageEdit, message, messageActions, styleState],
  );

  useEffect(() => {
    syncMessageToCustomBody();
  }, [message, syncMessageToCustomBody]);

  useEffect(() => {
    syncCustomBodyToMessage();
  }, [customRequestBody, syncCustomBodyToMessage]);

  useEffect(() => {
    if (searchParams.get('expired')) {
      Toast.warning(t('登录过期，请重新登录！'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const preview = constructPreviewPayload();
      setPreviewPayload(preview);
      setDebugData((prev) => ({
        ...prev,
        previewRequest: preview ? JSON.stringify(preview, null, 2) : null,
        previewTimestamp: preview ? new Date().toISOString() : null,
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [
    constructPreviewPayload,
    customRequestBody,
    customRequestMode,
    inputs,
    message,
    parameterEnabled,
    setDebugData,
    setPreviewPayload,
  ]);

  useEffect(() => {
    debouncedSaveConfig();
  }, [
    customRequestBody,
    customRequestMode,
    debouncedSaveConfig,
    inputs,
    parameterEnabled,
    playgroundMode,
    showDebugPanel,
  ]);

  const handleClearMessages = useCallback(() => {
    setMessage([]);
    setTimeout(() => saveMessagesImmediately([]), 0);
  }, [saveMessagesImmediately, setMessage]);

  const handlePasteImage = useCallback(
    (base64Data) => {
      if (!inputs.imageEnabled) {
        return;
      }
      handleInputChange('imageUrls', [...(inputs.imageUrls || []), base64Data]);
    },
    [handleInputChange, inputs.imageEnabled, inputs.imageUrls],
  );

  const playgroundContextValue = {
    onPasteImage: handlePasteImage,
    imageUrls: inputs.imageUrls || [],
    imageEnabled: inputs.imageEnabled || false,
  };

  return (
    <PlaygroundProvider value={playgroundContextValue}>
      <div className='h-full'>
        <Layout className='h-full bg-transparent flex flex-col md:flex-row'>
          {(showSettings || !isMobile) && (
            <Layout.Sider
              className={`
                bg-transparent border-r-0 flex-shrink-0 overflow-auto mt-[60px]
                ${
                  isMobile
                    ? 'fixed top-0 left-0 right-0 bottom-0 z-[1000] w-full h-auto bg-white shadow-lg'
                    : 'relative z-[1] w-80 h-[calc(100vh-66px)]'
                }
              `}
              width={isMobile ? '100%' : 320}
            >
              <OptimizedSettingsPanel
                inputs={inputs}
                parameterEnabled={parameterEnabled}
                models={models}
                groups={groups}
                styleState={styleState}
                showSettings={showSettings}
                showDebugPanel={showDebugPanel}
                customRequestMode={customRequestMode}
                customRequestBody={customRequestBody}
                playgroundMode={playgroundMode}
                modeHasAvailableModels={modeHasAvailableModels}
                onInputChange={handleInputChange}
                onParameterToggle={handleParameterToggle}
                onCloseSettings={() => setShowSettings(false)}
                onConfigImport={handleConfigImport}
                onConfigReset={handleConfigReset}
                onCustomRequestModeChange={setCustomRequestMode}
                onCustomRequestBodyChange={setCustomRequestBody}
                previewPayload={previewPayload}
                messages={message}
              />
            </Layout.Sider>
          )}

          <Layout.Content className='relative flex-1 overflow-hidden'>
            <div className='mt-[60px] h-[calc(100vh-66px)] flex flex-col overflow-hidden'>
              <div className='px-4 pt-4 pb-4 lg:px-6 flex-shrink-0'>
                <PlaygroundCreationCenter
                  playgroundMode={playgroundMode}
                  onModeChange={handleModeChange}
                  modeCounts={modeCounts}
                  currentModel={inputs.model}
                />
              </div>

              {!modeHasAvailableModels && modelsLoaded && !customRequestMode && (
                <div className='px-4 pb-4 lg:px-6 flex-shrink-0'>
                  <Card
                    bordered={false}
                    className='rounded-2xl border border-amber-200/80 bg-amber-50/90 shadow-none'
                    bodyStyle={{ padding: 16 }}
                  >
                    <div className='flex items-start gap-3'>
                      <div className='mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white'>
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='!mb-1 !text-amber-900'>
                          {activeModeUi.unavailableTitle}
                        </Typography.Title>
                        <Typography.Paragraph className='!mb-0 text-sm text-amber-800'>
                          {activeModeUi.unavailableDescription}
                        </Typography.Paragraph>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              <div className='flex-1 min-h-0 px-4 pb-4 lg:px-6 lg:pb-6 overflow-hidden'>
                <div className='h-full overflow-hidden flex flex-col lg:flex-row gap-4'>
                  <div className='flex-1 min-h-0 flex flex-col'>
                    <ChatArea
                      chatRef={chatRef}
                      message={message}
                      styleState={styleState}
                      showDebugPanel={showDebugPanel}
                      roleInfo={roleInfo}
                      onMessageSend={onMessageSend}
                      onMessageCopy={messageActions.handleMessageCopy}
                      onMessageReset={messageActions.handleMessageReset}
                      onMessageDelete={messageActions.handleMessageDelete}
                      onStopGenerator={onStopGenerator}
                      onClearMessages={handleClearMessages}
                      onToggleDebugPanel={() => setShowDebugPanel(!showDebugPanel)}
                      renderCustomChatContent={renderCustomChatContent}
                      renderChatBoxAction={renderChatBoxAction}
                      title={activeModeUi.title}
                      subtitle={activeModeUi.subtitle}
                      placeholder={activeModeUi.placeholder}
                    />
                  </div>

                  {showDebugPanel && !isMobile && (
                    <div className='w-96 flex-shrink-0 h-full'>
                      <OptimizedDebugPanel
                        debugData={debugData}
                        activeDebugTab={activeDebugTab}
                        onActiveDebugTabChange={setActiveDebugTab}
                        styleState={styleState}
                        customRequestMode={customRequestMode}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showDebugPanel && isMobile && (
              <div className='fixed top-0 left-0 right-0 bottom-0 z-[1000] bg-white overflow-auto shadow-lg'>
                <OptimizedDebugPanel
                  debugData={debugData}
                  activeDebugTab={activeDebugTab}
                  onActiveDebugTabChange={setActiveDebugTab}
                  styleState={styleState}
                  showDebugPanel={showDebugPanel}
                  onCloseDebugPanel={() => setShowDebugPanel(false)}
                  customRequestMode={customRequestMode}
                />
              </div>
            )}

            <FloatingButtons
              styleState={styleState}
              showSettings={showSettings}
              showDebugPanel={showDebugPanel}
              onToggleSettings={() => setShowSettings(!showSettings)}
              onToggleDebugPanel={() => setShowDebugPanel(!showDebugPanel)}
            />
          </Layout.Content>
        </Layout>
      </div>
    </PlaygroundProvider>
  );
};

export default Playground;
