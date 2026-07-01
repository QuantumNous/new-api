import React from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useVideoGeneration } from '../../hooks/videoPlayground/useVideoGeneration';
import VideoConfigPanel from '../../components/videoPlayground/VideoConfigPanel';
import VideoChatArea from '../../components/videoPlayground/VideoChatArea';
import VideoHistoryPanel from '../../components/videoPlayground/VideoHistoryPanel';

const VideoModel = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styleState = { isMobile };

  const {
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
    generate,
    regenerate,
    refetch,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  } = useVideoGeneration();

  return (
    <div className='h-full'>
      <div className='mt-[60px] h-[calc(100vh-66px)] flex flex-col px-3 pb-2'>
        {/* 顶部标签页（图生视频暂不展示） */}
        <Tabs type='line' activeKey='text2video' className='flex-shrink-0'>
          <TabPane tab={t('文生视频')} itemKey='text2video' />
        </Tabs>

        <div
          className='flex-1 min-h-0 flex gap-3 mt-1'
          style={{ flexDirection: isMobile ? 'column' : 'row' }}
        >
          <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0 }}>
            <VideoConfigPanel
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
      </div>
    </div>
  );
};

export default VideoModel;
