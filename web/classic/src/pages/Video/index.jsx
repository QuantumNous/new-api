import React, { useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useVideoGeneration } from '../../hooks/videoPlayground/useVideoGeneration';
import VideoConfigPanel from '../../components/videoPlayground/VideoConfigPanel';
import VideoChatArea from '../../components/videoPlayground/VideoChatArea';
import VideoHistoryPanel from '../../components/videoPlayground/VideoHistoryPanel';

// 单个模式(文生视频 / 图生视频 / 首尾帧)的三栏体验区。切 tab 时整体重挂载,
// 各模式历史/参数互不串扰。
const VideoPlaygroundBody = ({ mode }) => {
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const {
    isI2V,
    isFLF2V,
    needsImage,
    inputs,
    handleInputChange,
    groups,
    models,
    availableSizes,
    availableDurations,
    messages,
    conversations,
    generating,
    locked,
    turnLimitReached,
    missingRequiredImage,
    generate,
    regenerate,
    refetch,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  } = useVideoGeneration({ mode });

  return (
    <div
      className='flex-1 min-h-0 flex gap-3 mt-1'
      style={{ flexDirection: isMobile ? 'column' : 'row' }}
    >
      <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0 }}>
        <VideoConfigPanel
          needsImage={needsImage}
          isFLF2V={isFLF2V}
          inputs={inputs}
          groups={groups}
          models={models}
          availableSizes={availableSizes}
          availableDurations={availableDurations}
          onInputChange={handleInputChange}
          disabled={locked}
          styleState={styleState}
        />
      </div>

      <div className='flex-1 min-w-0'>
        <VideoChatArea
          messages={messages}
          generating={generating}
          turnLimitReached={turnLimitReached}
          missingRequiredImage={missingRequiredImage}
          styleState={styleState}
          onSend={generate}
          onRegenerate={regenerate}
          onRefetch={refetch}
          onClear={newConversation}
        />
      </div>

      <div style={{ width: isMobile ? '100%' : 320, flexShrink: 0 }}>
        <VideoHistoryPanel
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

const VideoModel = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('text2video');

  return (
    <div className='h-full'>
      <div className='mt-[60px] h-[calc(100vh-66px)] flex flex-col px-3 pb-2'>
        <Tabs
          type='line'
          activeKey={activeTab}
          onChange={setActiveTab}
          className='flex-shrink-0'
        >
          <TabPane tab={t('文生视频')} itemKey='text2video' />
          <TabPane tab={t('图生视频')} itemKey='image2video' />
          <TabPane tab={t('首尾帧')} itemKey='flf2v' />
        </Tabs>

        <VideoPlaygroundBody key={activeTab} mode={activeTab} />
      </div>
    </div>
  );
};

export default VideoModel;
