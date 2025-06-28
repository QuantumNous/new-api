import { useCallback, useState, useRef } from 'react';
import { Toast, Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { getTextContent, buildApiPayload, createLoadingAssistantMessage } from '../helpers';
import { MESSAGE_ROLES } from '../constants/playground.constants';

export const useMessageEdit = (
  setMessage,
  inputs,
  parameterEnabled,
  sendRequest,
  saveMessages
) => {
  const { t } = useTranslation();
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editingMessageRef = useRef(null);

  const handleMessageEdit = useCallback((targetMessage) => {
    const editableContent = getTextContent(targetMessage);
    setEditingMessageId(targetMessage.id);
    editingMessageRef.current = targetMessage;
    setEditValue(editableContent);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editingMessageId || !editValue.trim()) return;

    setMessage(prevMessages => {
      let messageIndex = prevMessages.findIndex(msg => msg === editingMessageRef.current);

      if (messageIndex === -1) {
        messageIndex = prevMessages.findIndex(msg => msg.id === editingMessageId);
      }

      const targetMessage = prevMessages[messageIndex];
      let newContent;

      if (Array.isArray(targetMessage.content)) {
        newContent = targetMessage.content.map(item =>
          item.type === 'text' ? { ...item, text: editValue.trim() } : item
        );
      } else {
        newContent = editValue.trim();
      }

      const updatedMessages = prevMessages.map(msg =>
        msg.id === editingMessageId ? { ...msg, content: newContent } : msg
      );

      // 处理用户消息编辑后的重新生成
      if (targetMessage.role === MESSAGE_ROLES.USER) {
        const hasSubsequentAssistantReply = messageIndex < prevMessages.length - 1 &&
          prevMessages[messageIndex + 1].role === MESSAGE_ROLES.ASSISTANT;

        if (hasSubsequentAssistantReply) {
          Modal.confirm({
            title: t('消息已编辑'),
            content: t('检测到该消息后有AI回复，是否删除后续回复并重新生成？'),
            okText: t('重新生成'),
            cancelText: t('仅保存'),
            onOk: () => {
              const messagesUntilUser = updatedMessages.slice(0, messageIndex + 1);
              setMessage(messagesUntilUser);
              // 编辑后保存（重新生成的情况），传入更新后的消息列表
              setTimeout(() => saveMessages(messagesUntilUser), 0);

              setTimeout(() => {
                const payload = buildApiPayload(messagesUntilUser, null, inputs, parameterEnabled);
                setMessage(prevMsg => [...prevMsg, createLoadingAssistantMessage()]);
                sendRequest(payload, inputs.stream);
              }, 100);
            },
            onCancel: () => {
              setMessage(updatedMessages);
              // 编辑后保存（仅保存的情况），传入更新后的消息列表
              setTimeout(() => saveMessages(updatedMessages), 0);
            }
          });
          return prevMessages;
        }
      }

      // 编辑后保存（普通情况），传入更新后的消息列表
      setTimeout(() => saveMessages(updatedMessages), 0);
      return updatedMessages;
    });

    setEditingMessageId(null);
    editingMessageRef.current = null;
    setEditValue('');
    Toast.success({ content: t('消息已更新'), duration: 2 });
  }, [editingMessageId, editValue, t, inputs, parameterEnabled, sendRequest, setMessage, saveMessages]);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    editingMessageRef.current = null;
    setEditValue('');
  }, []);

  return {
    editingMessageId,
    editValue,
    setEditValue,
    handleMessageEdit,
    handleEditSave,
    handleEditCancel
  };
}; 