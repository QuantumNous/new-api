import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CapsuleTabs, NavBar, TextArea } from 'antd-mobile';

import { useMusicGeneration } from '@classic/hooks/musicPlayground/useMusicGeneration';
import { MUSIC_DURATIONS } from '@classic/constants/musicPlayground.constants';

import AsyncTaskBubble from '../components/gen/AsyncTaskBubble';
import ConfigBar from '../components/gen/ConfigBar';
import MessageFeed from '../components/gen/MessageFeed';
import PromptBar from '../components/gen/PromptBar';
import ShareBar from '../components/gen/ShareBar';

// 一期移动端开放纯文本输入的两个模式；翻唱/局部重绘/歌声合成需上传音频，引导桌面端。
const MODES = [
  { key: 't2m', title: '文生音乐' },
  { key: 't2a', title: '文生音效' },
];

const MusicBody = ({ mode }) => {
  const {
    inputs,
    handleInputChange,
    groups,
    models,
    messages,
    generating,
    turnLimitReached,
    generate,
    regenerate,
    refetch,
    newConversation,
  } = useMusicGeneration(mode);

  const [showLyrics, setShowLyrics] = useState(false);
  const isT2M = mode === 't2m';

  const renderAssistant = (m) => (
    <div>
      {m.translatedText && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--adm-color-weak)',
            marginBottom: 6,
          }}
        >
          译文：{m.translatedText}
        </div>
      )}
      <AsyncTaskBubble
        m={m}
        doneStatus='completed'
        resultUrl={m.musicUrl}
        renderResult={(url) => (
          <div>
            <audio controls src={url} style={{ width: '100%' }} />
            <ShareBar url={url} filename={`music-${m.taskId || m.id}.mp3`} />
          </div>
        )}
        onRetry={() => regenerate(m.prompt)}
        onRefetch={() => refetch(m.id, m.taskId)}
      />
    </div>
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
          ...(isT2M
            ? [
                {
                  key: 'duration',
                  label: '时长',
                  value: inputs.duration,
                  options: MUSIC_DURATIONS.map((d) => ({
                    label: d ? `${d} 秒` : '默认',
                    value: d,
                  })),
                  onChange: (v) => handleInputChange('duration', v),
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
            isT2M
              ? '描述想要的音乐风格，可选填歌词'
              : '描述想要的音效，如「雨打在铁皮屋顶上」'
          }
        />
      </div>
      <PromptBar
        onSend={generate}
        generating={generating}
        disabled={turnLimitReached}
        placeholder={isT2M ? '描述音乐风格…' : '描述音效…'}
        extra={
          isT2M ? (
            <div style={{ marginBottom: 8 }}>
              <Button
                size='mini'
                fill='none'
                onClick={() => setShowLyrics(!showLyrics)}
              >
                {showLyrics ? '收起歌词' : '填写歌词（可选）'}
              </Button>
              {showLyrics && (
                <div
                  style={{
                    background: 'var(--adm-color-fill-content, #f5f5f5)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    marginTop: 4,
                  }}
                >
                  <TextArea
                    placeholder='歌词留空则由引擎自动生成'
                    value={inputs.lyrics}
                    onChange={(v) => handleInputChange('lyrics', v)}
                    rows={2}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                  />
                </div>
              )}
            </div>
          ) : null
        }
      />
    </div>
  );
};

const Music = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('t2m');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar onBack={() => navigate(-1)}>音乐音效</NavBar>
      <CapsuleTabs activeKey={mode} onChange={setMode}>
        {MODES.map((m) => (
          <CapsuleTabs.Tab key={m.key} title={m.title} />
        ))}
      </CapsuleTabs>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MusicBody key={mode} mode={mode} />
      </div>
    </div>
  );
};

export default Music;
