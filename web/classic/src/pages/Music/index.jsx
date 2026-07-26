import React, { useEffect, useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { usePlaygroundTabs } from '../../hooks/common/usePlaygroundTabs';
import { useMusicGeneration } from '../../hooks/musicPlayground/useMusicGeneration';
import MusicConfigPanel from '../../components/musicPlayground/MusicConfigPanel';
import MusicChatArea from '../../components/musicPlayground/MusicChatArea';
import VideoHistoryPanel from '../../components/videoPlayground/VideoHistoryPanel';

// 单个玩法的三栏体验区。切 tab 时整体重挂载,各玩法历史/参数互不串扰(mode 作为 key)。
// 涵盖 ACE-Step(文生音乐/音乐改编/音乐重绘)与 AudioX/SoulX(文生音效/视频配音效/视频
// 配乐/歌声合成)。历史面板与视频/语音同构,直接复用。
const MusicPlaygroundBody = ({ mode }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styleState = { isMobile };
  const {
    inputs,
    handleInputChange,
    applyExample,
    groups,
    models,
    messages,
    conversations,
    generating,
    locked,
    turnLimitReached,
    missingRequiredAudio,
    missingRequiredVideo,
    engine,
    needsAudio,
    needsVideo,
    needsDualAudio,
    needsText,
    showTranslation,
    translationGroups,
    translationModels,
    refAudioMaxMB,
    videoMaxMB,
    generate,
    regenerate,
    refetch,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  } = useMusicGeneration(mode);

  // cover=参考音频 / repaint=源音频(其余玩法无单音频标签)。
  const audioLabel =
    mode === 'cover' ? t('参考音频') : mode === 'repaint' ? t('源音频') : '';

  // 各玩法欢迎语。
  const welcomeText =
    mode === 't2a'
      ? t('欢迎使用 AI 文生音效,请在左侧选择模型,并在下方输入音效描述')
      : mode === 'svs'
        ? t('欢迎使用 AI 歌声合成,请在左侧上传音色参考与目标曲/伴奏')
        : '';

  return (
    <div
      className='flex-1 min-h-0 flex gap-3 mt-1'
      style={{ flexDirection: isMobile ? 'column' : 'row' }}
    >
      <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0 }}>
        <MusicConfigPanel
          inputs={inputs}
          groups={groups}
          models={models}
          onInputChange={handleInputChange}
          disabled={locked}
          engine={engine}
          needsAudio={needsAudio}
          needsVideo={needsVideo}
          needsDualAudio={needsDualAudio}
          showTranslation={showTranslation}
          translationGroups={translationGroups}
          translationModels={translationModels}
          audioLabel={audioLabel}
          refAudioMaxMB={refAudioMaxMB}
          videoMaxMB={videoMaxMB}
          styleState={styleState}
        />
      </div>

      <div className='flex-1 min-w-0'>
        <MusicChatArea
          messages={messages}
          generating={generating}
          turnLimitReached={turnLimitReached}
          missingRequiredAudio={missingRequiredAudio}
          missingRequiredVideo={missingRequiredVideo}
          engine={engine}
          mode={mode}
          needsText={needsText}
          needsVideo={needsVideo}
          needsDualAudio={needsDualAudio}
          showTranslation={showTranslation}
          welcomeText={welcomeText}
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

const MusicModel = () => {
  const { t } = useTranslation();
  const tabs = usePlaygroundTabs('music');
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 't2m');

  useEffect(() => {
    if (tabs.length && !tabs.some((tb) => tb.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  if (!tabs.length) return null;

  return (
    <div className='h-full'>
      <div className='mt-[60px] h-[calc(100vh-66px)] flex flex-col px-3 pb-2'>
        <Tabs
          type='line'
          activeKey={activeTab}
          onChange={setActiveTab}
          className='flex-shrink-0'
        >
          {tabs.map((tb) => (
            <TabPane key={tb.key} tab={t(tb.label)} itemKey={tb.key} />
          ))}
        </Tabs>

        <MusicPlaygroundBody key={activeTab} mode={activeTab} />
      </div>
    </div>
  );
};

export default MusicModel;
