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

import { useCallback } from 'react';
import { Toast, Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { getTextContent } from '../../helpers';
import { ERROR_MESSAGES } from '../../constants/playground.constants';

export const useMessageActions = (message, setMessage, onMessageSend, saveMessages) => {
  const { t } = useTranslation();

  // 复制消息
  const handleMessageCopy = useCallback((targetMessage) => {
    const textToCopy = getTextContent(targetMessage);

    if (!textToCopy) {
      Toast.warning({
        content: t(ERROR_MESSAGES.NO_TEXT_CONTENT),
        duration: 2,
      });
      return;
    }

    const copyToClipboard = async (text) => {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          Toast.success({
            content: t('消息已复制到剪贴板'),
            duration: 2,
          });
        } catch (err) {
          console.error('Clipboard API 复制失败:', err);
          fallbackCopy(text);
        }
      } else {
        fallbackCopy(text);
      }
    };

    const fallbackCopy = (text) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = `
          position: fixed;
          top: -9999px;
          left: -9999px;
          opacity: 0;
          pointer-events: none;
          z-index: -1;
        `;
        textArea.setAttribute('readonly', '');

        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, text.length);

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          Toast.success({
            content: t('消息已复制到剪贴板'),
            duration: 2,
          });
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (err) {
        console.error('回退复制方案也失败:', err);

        let errorMessage = t(ERROR_MESSAGES.COPY_FAILED);
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
          errorMessage = t(ERROR_MESSAGES.COPY_HTTPS_REQUIRED);
        } else if (!navigator.clipboard && !document.execCommand) {
          errorMessage = t(ERROR_MESSAGES.BROWSER_NOT_SUPPORTED);
        }

        Toast.error({
          content: errorMessage,
          duration: 4,
        });
      }
    };

    copyToClipboard(textToCopy);
  }, [t]);

  // 重新生成消息
  const handleMessageReset = useCallback((targetMessage) => {
    setMessage(prevMessages => {
      // 使用引用查找索引，防止重复 id 造成误匹配
      let messageIndex = prevMessages.findIndex(msg => msg === targetMessage);

      // 回退到 id 匹配（兼容不同引用场景）
      if (messageIndex === -1) {
        messageIndex = prevMessages.findIndex(msg => msg.id === targetMessage.id);
      }

      if (messageIndex === -1) return prevMessages;

      if (targetMessage.role === 'user') {
        const newMessages = prevMessages.slice(0, messageIndex);
        const contentToSend = getTextContent(targetMessage);

        setTimeout(() => {
          onMessageSend(contentToSend);
        }, 100);

        return newMessages;
      } else if (targetMessage.role === 'assistant' || targetMessage.role === 'system') {
        let userMessageIndex = messageIndex - 1;
        while (userMessageIndex >= 0 && prevMessages[userMessageIndex].role !== 'user') {
          userMessageIndex--;
        }

        if (userMessageIndex >= 0) {
          const userMessage = prevMessages[userMessageIndex];
          const newMessages = prevMessages.slice(0, userMessageIndex);
          const contentToSend = getTextContent(userMessage);

          setTimeout(() => {
            onMessageSend(contentToSend);
          }, 100);

          return newMessages;
        }
      }

      return prevMessages;
    });
  }, [setMessage, onMessageSend]);

  // 删除消息
  const handleMessageDelete = useCallback((targetMessage) => {
    Modal.confirm({
      title: t('确认删除'),
      content: t('确定要删除这条消息吗？'),
      okText: t('确定'),
      cancelText: t('取消'),
      okButtonProps: {
        type: 'danger',
      },
      onOk: () => {
        setMessage(prevMessages => {
          // 使用引用查找索引，防止重复 id 造成误匹配
          let messageIndex = prevMessages.findIndex(msg => msg === targetMessage);

          // 回退到 id 匹配（兼容不同引用场景）
          if (messageIndex === -1) {
            messageIndex = prevMessages.findIndex(msg => msg.id === targetMessage.id);
          }

          if (messageIndex === -1) return prevMessages;

          let updatedMessages;
          if (targetMessage.role === 'user' && messageIndex < prevMessages.length - 1) {
            const nextMessage = prevMessages[messageIndex + 1];
            if (nextMessage.role === 'assistant') {
              Toast.success({
                content: t('已删除消息及其回复'),
                duration: 2,
              });
              updatedMessages = prevMessages.filter((_, index) =>
                index !== messageIndex && index !== messageIndex + 1
              );
            } else {
              Toast.success({
                content: t('消息已删除'),
                duration: 2,
              });
              updatedMessages = prevMessages.filter(msg => msg.id !== targetMessage.id);
            }
          } else {
            Toast.success({
              content: t('消息已删除'),
              duration: 2,
            });
            updatedMessages = prevMessages.filter(msg => msg.id !== targetMessage.id);
          }

          // 删除消息后保存，传入更新后的消息列表
          setTimeout(() => saveMessages(updatedMessages), 0);
          return updatedMessages;
        });
      },
    });
  }, [setMessage, t, saveMessages]);

  // 切换角色
  const handleRoleToggle = useCallback((targetMessage) => {
    if (!(targetMessage.role === 'assistant' || targetMessage.role === 'system')) {
      return;
    }

    const newRole = targetMessage.role === 'assistant' ? 'system' : 'assistant';

    setMessage(prevMessages => {
      const updatedMessages = prevMessages.map(msg => {
        if (msg.id === targetMessage.id &&
          (msg.role === 'assistant' || msg.role === 'system')) {
          return { ...msg, role: newRole };
        }
        return msg;
      });

      // 切换角色后保存，传入更新后的消息列表
      setTimeout(() => saveMessages(updatedMessages), 0);
      return updatedMessages;
    });

    Toast.success({
      content: t(`已切换为${newRole === 'system' ? 'System' : 'Assistant'}角色`),
      duration: 2,
    });
  }, [setMessage, t, saveMessages]);

  return {
    handleMessageCopy,
    handleMessageReset,
    handleMessageDelete,
    handleRoleToggle,
  };
}; 