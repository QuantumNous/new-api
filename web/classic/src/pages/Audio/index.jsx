import React, { useEffect, useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { usePlaygroundTabs } from '../../hooks/common/usePlaygroundTabs';
import { useAudioGeneration } from '../../hooks/audioPlayground/useAudioGeneration';
import AudioConfigPanel from '../../components/audioPlayground/AudioConfigPanel';
import AudioChatArea from '../../components/audioPlayground/AudioChatArea';
import VideoHistoryPanel from '../../components/videoPlayground/VideoHistoryPanel';
import { VideoPlaygroundBody } from '../Video';
import {
  AUDIO_MODES,
  AUDIO_EMOTION_EXAMPLES,
  AUDIO_SYNTHESIS_EXAMPLES,
  AUDIO_DIALOGUE_EXAMPLES,
  AUDIO_DESIGN_EXAMPLES,
} from '../../constants/audioPlayground.constants';

// 单个玩法的三栏体验区。切 tab 时整体重挂载,各玩法历史/参数互不串扰(mode 作为 key)。
// 四个玩法:情感合成(IndexTTS-2)+ 语音合成/双人对话/声音设计(vLLM-Omni)。语音合成把
// 音色来源(上传克隆/预设音色)与语言合并为面板内选项。历史面板复用 VideoHistoryPanel。
const AudioPlaygroundBody = ({ mode }) => {
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
    missingRequiredVoice,
    engine,
    needsVoice,
    needsEmotion,
    needsVoiceSource,
    needsRefAudio,
    refAudioRequired,
    needsDualRef,
    needsSpeaker,
    needsLanguage,
    needsRefText,
    needsInstructions,
    refAudioMaxMB,
    generate,
    regenerate,
    refetch,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  } = useAudioGeneration(mode);

  const instructionsRequired = AUDIO_MODES[mode]?.instructionsRequired || false;

  // 各玩法欢迎语。
  const welcomeText =
    mode === 'synthesis'
      ? t(
          '欢迎使用 AI 语音合成,请在左侧选择音色来源(上传克隆或预设音色),并在下方输入要合成的文本',
        )
      : mode === 'dialogue'
        ? t(
            '欢迎使用 AI 双人对话,请在左侧上传两位说话人参考音,并在下方输入含 [S1]/[S2] 标记的对话脚本',
          )
        : mode === 'design'
          ? t(
              '欢迎使用 AI 声音设计,请在左侧描述目标声线,并在下方输入要合成的文本',
            )
          : t(
              '欢迎使用 AI 情感合成,请在左侧选择参考音色,并在下方输入要合成的文本',
            );

  // 各玩法输入框占位。
  const placeholderText =
    mode === 'dialogue'
      ? t('请输入对话脚本,用 [S1]/[S2] 标记两位说话人')
      : t('请输入要合成的文本');

  // 各玩法缺必填输入提示。
  const missingVoiceHint = needsDualRef
    ? t('请先在左侧上传说话人1与说话人2的参考音')
    : needsRefAudio && refAudioRequired
      ? t('请先在左侧上传参考音(克隆源)')
      : instructionsRequired
        ? t('请先在左侧填写声线描述')
        : needsVoiceSource
          ? t('请先在左侧选择音色来源并完成配置')
          : t('请先在左侧选择预置音色或上传参考音频');

  // 各玩法一键示例(结构化:含预置文件/参数)。
  const presets =
    mode === 'dialogue'
      ? AUDIO_DIALOGUE_EXAMPLES
      : mode === 'design'
        ? AUDIO_DESIGN_EXAMPLES
        : mode === 'synthesis'
          ? AUDIO_SYNTHESIS_EXAMPLES
          : AUDIO_EMOTION_EXAMPLES;

  return (
    <div
      className='flex-1 min-h-0 flex gap-3 mt-1'
      style={{ flexDirection: isMobile ? 'column' : 'row' }}
    >
      <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0 }}>
        <AudioConfigPanel
          inputs={inputs}
          groups={groups}
          models={models}
          onInputChange={handleInputChange}
          disabled={locked}
          engine={engine}
          needsVoice={needsVoice}
          needsEmotion={needsEmotion}
          needsVoiceSource={needsVoiceSource}
          needsRefAudio={needsRefAudio}
          refAudioRequired={refAudioRequired}
          needsDualRef={needsDualRef}
          needsSpeaker={needsSpeaker}
          needsLanguage={needsLanguage}
          needsRefText={needsRefText}
          needsInstructions={needsInstructions}
          instructionsRequired={instructionsRequired}
          refAudioMaxMB={refAudioMaxMB}
          styleState={styleState}
        />
      </div>

      <div className='flex-1 min-w-0'>
        <AudioChatArea
          messages={messages}
          generating={generating}
          turnLimitReached={turnLimitReached}
          missingRequiredVoice={missingRequiredVoice}
          welcomeText={welcomeText}
          placeholderText={placeholderText}
          missingVoiceHint={missingVoiceHint}
          presets={presets}
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

// 子标签页(标签文案取中央元数据;含「视频配音」dub)。可见性由运营配置过滤。
const AudioModel = () => {
  const { t } = useTranslation();
  const tabs = usePlaygroundTabs('audio');
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'emotion');

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

        {/* 视频配乐(dub):输入上传视频、产物配好音的视频 —— 复用视频体验区三栏
            (VideoPlaygroundBody/useVideoGeneration,task_type=v2a),不走音频 hook。 */}
        {activeTab === 'dub' ? (
          <VideoPlaygroundBody key={activeTab} mode='dub' />
        ) : (
          <AudioPlaygroundBody key={activeTab} mode={activeTab} />
        )}
      </div>
    </div>
  );
};

export default AudioModel;
