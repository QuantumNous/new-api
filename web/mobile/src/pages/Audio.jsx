import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CapsuleTabs, Empty, NavBar, TextArea } from 'antd-mobile';

import { useAudioGeneration } from '@classic/hooks/audioPlayground/useAudioGeneration';
import {
  EMOTION_PRESETS,
  PRESET_VOICES,
} from '@classic/constants/audioPlayground.constants';

import AsyncTaskBubble from '../components/gen/AsyncTaskBubble';
import { useVisibleModes } from '../hooks/useVisibleModes';
import ConfigBar from '../components/gen/ConfigBar';
import MessageFeed from '../components/gen/MessageFeed';
import PromptBar from '../components/gen/PromptBar';
import ShareBar from '../components/gen/ShareBar';

// 一期移动端开放不需要上传参考音的两个模式：情感合成（预置音色）与声音设计。
// 克隆/双人对话需上传参考音频，引导桌面端。
const MODES = [
  { key: 'emotion', title: '情感合成' },
  { key: 'design', title: '声音设计' },
];

const AudioBody = ({ mode }) => {
  const {
    inputs,
    handleInputChange,
    groups,
    models,
    messages,
    generating,
    turnLimitReached,
    missingRequiredVoice,
    needsInstructions,
    generate,
    regenerate,
    refetch,
    newConversation,
  } = useAudioGeneration(mode);

  const isEmotion = mode === 'emotion';

  const renderAssistant = (m) => (
    <AsyncTaskBubble
      m={m}
      doneStatus='completed'
      resultUrl={m.audioUrl}
      renderResult={(url) => (
        <div>
          <audio controls src={url} style={{ width: '100%' }} />
          <ShareBar url={url} filename={`tts-${m.taskId || m.id}.mp3`} />
        </div>
      )}
      onRetry={() => regenerate(m.prompt)}
      onRefetch={() => refetch(m.id, m.taskId)}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ConfigBar
        disabled={generating}
        fields={[
          {
            key: 'group',
            label: '分组',
            value: inputs.group,
            options: groups,
            onChange: (v) => handleInputChange('group', v),
          },
          {
            key: 'model',
            label: '模型',
            value: inputs.model,
            options: models,
            onChange: (v) => handleInputChange('model', v),
          },
          ...(isEmotion
            ? [
                {
                  key: 'voicePreset',
                  label: '音色',
                  value: inputs.voicePreset,
                  options: PRESET_VOICES.map((v) => ({
                    label: v.label,
                    value: v.id,
                  })),
                  onChange: (v) => handleInputChange('voicePreset', v),
                },
                {
                  key: 'emotion',
                  label: '情感',
                  value: inputs.emotion,
                  options: EMOTION_PRESETS,
                  onChange: (v) => handleInputChange('emotion', v),
                },
              ]
            : []),
        ]}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length > 0 && (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Button size='mini' fill='none' onClick={newConversation}>
              新建会话
            </Button>
          </div>
        )}
        <MessageFeed
          messages={messages}
          renderAssistant={renderAssistant}
          empty={
            isEmotion
              ? '选择音色与情感，输入要朗读的文本'
              : '先描述音色特征，再输入要朗读的文本'
          }
        />
      </div>
      <PromptBar
        onSend={generate}
        generating={generating}
        disabled={turnLimitReached || missingRequiredVoice}
        placeholder='输入要合成的文本…'
        extra={
          needsInstructions ? (
            <div
              style={{
                background: 'var(--adm-color-fill-content, #f5f5f5)',
                borderRadius: 8,
                padding: '6px 10px',
                marginBottom: 8,
              }}
            >
              <TextArea
                placeholder='音色描述（必填），如「低沉沙哑的中年男声，语速缓慢」'
                value={inputs.instructions}
                onChange={(v) => handleInputChange('instructions', v)}
                rows={2}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
};

const Audio = () => {
  const navigate = useNavigate();
  const modes = useVisibleModes('audio', MODES);
  const [mode, setMode] = useState(modes[0]?.key || MODES[0].key);
  useEffect(() => {
    if (modes.length && !modes.some((m) => m.key === mode)) setMode(modes[0].key);
  }, [modes, mode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar onBack={() => navigate(-1)}>语音合成</NavBar>
      {modes.length === 0 ? (
        <Empty style={{ padding: 32 }} description='当前体验区暂未开放' />
      ) : (
        <>
          <CapsuleTabs activeKey={mode} onChange={setMode}>
            {modes.map((m) => (
              <CapsuleTabs.Tab key={m.key} title={m.title} />
            ))}
          </CapsuleTabs>
          <div style={{ flex: 1, minHeight: 0 }}>
            <AudioBody key={mode} mode={mode} />
          </div>
        </>
      )}
    </div>
  );
};

export default Audio;
