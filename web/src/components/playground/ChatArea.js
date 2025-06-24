import React from 'react';
import {
  Card,
  Chat,
  Typography,
  Button,
} from '@douyinfe/semi-ui';
import {
  MessageSquare,
  Eye,
  EyeOff,
} from 'lucide-react';
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

  const renderInputArea = React.useCallback((props) => {
    return <CustomInputRender {...props} />;
  }, []);

  return (
    <Card
      className="h-full"
      bordered={false}
      bodyStyle={{ padding: 0, height: 'calc(100vh - 66px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* 聊天头部 */}
      {styleState.isMobile ? (
        <div className="pt-4"></div>
      ) : (
        <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <MessageSquare size={20} className="text-white" />
              </div>
              <div>
                <Typography.Title heading={5} className="!text-white mb-0">
                  {t('AI 对话')}
                </Typography.Title>
                <Typography.Text className="!text-white/80 text-sm hidden sm:inline">
                  {inputs.model || t('选择模型开始对话')}
                </Typography.Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                icon={showDebugPanel ? <EyeOff size={14} /> : <Eye size={14} />}
                onClick={onToggleDebugPanel}
                theme="borderless"
                type="primary"
                size="small"
                className="!rounded-lg !text-white/80 hover:!text-white hover:!bg-white/10"
              >
                {showDebugPanel ? t('隐藏调试') : t('显示调试')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 聊天内容区域 */}
      <div className="flex-1 overflow-hidden">
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
            overflow: 'hidden'
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
          className="h-full"
          placeholder={t('请输入您的问题...')}
        />
      </div>
    </Card>
  );
};

export default ChatArea; 