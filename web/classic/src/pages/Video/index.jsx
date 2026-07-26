import React, { useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useVideoGeneration } from '../../hooks/videoPlayground/useVideoGeneration';
import VideoConfigPanel from '../../components/videoPlayground/VideoConfigPanel';
import VideoChatArea from '../../components/videoPlayground/VideoChatArea';
import VideoHistoryPanel from '../../components/videoPlayground/VideoHistoryPanel';

// 单个模式(文生视频 / 图生视频 / 首尾帧 / … / 视频配乐)的三栏体验区。切 tab 时整体
// 重挂载,各模式历史/参数互不串扰。
// 导出供语音模型页复用:「视频配乐」(mode='dub')的入口在语音页,但输入(上传视频)与
// 产物(配好音的视频)是视频形态,复用本三栏体验区而非音频体验区。
export const VideoPlaygroundBody = ({ mode }) => {
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const {
    isI2V,
    isFLF2V,
    isS2V,
    isSR,
    isVACE,
    isDub,
    dubAvailable,
    needsImage,
    followsInput,
    maxRefImages,
    maxInputMB,
    inputs,
    handleInputChange,
    applyExample,
    groups,
    models,
    availableSizes,
    availableDurations,
    availableAspectRatios,
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
          followsInput={followsInput}
          isI2V={isI2V}
          isFLF2V={isFLF2V}
          isS2V={isS2V}
          isSR={isSR}
          isVACE={isVACE}
          isDub={isDub}
          dubAvailable={dubAvailable}
          maxRefImages={maxRefImages}
          maxInputMB={maxInputMB}
          inputs={inputs}
          groups={groups}
          models={models}
          availableSizes={availableSizes}
          availableDurations={availableDurations}
          availableAspectRatios={availableAspectRatios}
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
          mode={mode}
          isSR={isSR}
          isDub={isDub}
          onApplyExample={applyExample}
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
          <TabPane tab={t('数字人')} itemKey='s2v' />
          {/* 视频超分不再直接提供：超分能力经 1080P 档位的两段流水线触达（sr 模式代码保留给流水线） */}
          <TabPane tab={t('视频编辑')} itemKey='vace' />
        </Tabs>

        <VideoPlaygroundBody key={activeTab} mode={activeTab} />
      </div>
    </div>
  );
};

export default VideoModel;
