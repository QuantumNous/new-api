import React, { useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useImageGeneration } from '../../hooks/imagePlayground/useImageGeneration';
import ImageConfigPanel from '../../components/imagePlayground/ImageConfigPanel';
import ImageChatArea from '../../components/imagePlayground/ImageChatArea';
import ImageHistoryPanel from '../../components/imagePlayground/ImageHistoryPanel';

// 单个模式(文生图 / 图生图)的三栏体验区。按 mode 调 hook;放在带 key 的
// 父级下,切 tab 时整体重挂载,各模式历史/参数互不串扰。
const ImagePlaygroundBody = ({ mode }) => {
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const {
    isI2I,
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
    missingRequiredImage,
    generate,
    regenerate,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  } = useImageGeneration({ mode });

  return (
    <div
      className='flex-1 min-h-0 flex gap-3 mt-1'
      style={{ flexDirection: isMobile ? 'column' : 'row' }}
    >
      {/* 左：模型配置（图生图额外含底图上传） */}
      <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0 }}>
        <ImageConfigPanel
          isI2I={isI2I}
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
          missingRequiredImage={missingRequiredImage}
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
  );
};

const ImageModel = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('text2image');

  return (
    <div className='h-full'>
      <div className='mt-[60px] h-[calc(100vh-66px)] flex flex-col px-3 pb-2'>
        <Tabs
          type='line'
          activeKey={activeTab}
          onChange={setActiveTab}
          className='flex-shrink-0'
        >
          <TabPane tab={t('文生图')} itemKey='text2image' />
          <TabPane tab={t('图生图')} itemKey='image2image' />
        </Tabs>

        {/* key 使切换 tab 时整体重挂载,各模式 hook 状态独立 */}
        <ImagePlaygroundBody key={activeTab} mode={activeTab} />
      </div>
    </div>
  );
};

export default ImageModel;
