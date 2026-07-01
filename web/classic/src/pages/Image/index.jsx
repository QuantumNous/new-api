import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useImageGeneration } from '../../hooks/imagePlayground/useImageGeneration';
import ImageConfigPanel from '../../components/imagePlayground/ImageConfigPanel';
import ImageChatArea from '../../components/imagePlayground/ImageChatArea';
import ImageHistoryPanel from '../../components/imagePlayground/ImageHistoryPanel';

const ImageModel = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styleState = { isMobile };

  const {
    inputs,
    handleInputChange,
    groups,
    models,
    availableSizes,
    messages,
    conversations,
    generating,
    locked,
    turnLimitReached,
    generate,
    regenerate,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  } = useImageGeneration();

  return (
    <div className='h-full'>
      <div className='mt-[60px] h-[calc(100vh-66px)] flex flex-col px-3 pb-2'>
        {/* 顶部标签页（图生图暂不展示） */}
        <Tabs type='line' activeKey='text2image' className='flex-shrink-0'>
          <TabPane tab={t('文生图')} itemKey='text2image' />
        </Tabs>

        {/* 三栏 */}
        <div
          className='flex-1 min-h-0 flex gap-3 mt-1'
          style={{ flexDirection: isMobile ? 'column' : 'row' }}
        >
          {/* 左：模型配置 */}
          <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0 }}>
            <ImageConfigPanel
              inputs={inputs}
              groups={groups}
              models={models}
              availableSizes={availableSizes}
              onInputChange={handleInputChange}
              disabled={locked}
              styleState={styleState}
            />
          </div>

          {/* 中：对话区 */}
          <div className='flex-1 min-w-0'>
            <ImageChatArea
              messages={messages}
              generating={generating}
              turnLimitReached={turnLimitReached}
              styleState={styleState}
              onSend={generate}
              onRegenerate={regenerate}
              onClear={newConversation}
            />
          </div>

          {/* 右：对话历史 */}
          <div style={{ width: isMobile ? '100%' : 320, flexShrink: 0 }}>
            <ImageHistoryPanel
              history={conversations}
              onNewConversation={newConversation}
              onClear={clearHistory}
              onDelete={deleteHistoryItem}
              onOpen={openHistoryItem}
              styleState={styleState}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModel;
