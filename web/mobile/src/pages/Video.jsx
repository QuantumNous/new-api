import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  CapsuleTabs,
  Image,
  NavBar,
  ProgressCircle,
  SpinLoading,
  TextArea,
} from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';

import { useVideoGeneration } from '@classic/hooks/videoPlayground/useVideoGeneration';

import ConfigBar from '../components/gen/ConfigBar';
import MessageFeed from '../components/gen/MessageFeed';
import PromptBar from '../components/gen/PromptBar';
import ShareBar from '../components/gen/ShareBar';
import { showError } from '../shims/classic-utils';
import { fileToDataUrl } from '../utils/file';

// 一期移动端只开放高频的文生视频/图生视频；首尾帧、数字人、超分、视频编辑
// 输入形态复杂（多图/音频/视频上传），引导到桌面端。
const MODES = [
  { key: 'text2video', title: '文生视频' },
  { key: 'image2video', title: '图生视频' },
];

const VideoBody = ({ mode }) => {
  const {
    needsImage,
    maxInputMB,
    inputs,
    handleInputChange,
    groups,
    models,
    availableSizes,
    availableDurations,
    availableAspectRatios,
    dubAvailable,
    messages,
    generating,
    turnLimitReached,
    missingRequiredImage,
    generate,
    regenerate,
    refetch,
    newConversation,
  } = useVideoGeneration({ mode });

  const fileRef = useRef(null);

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (maxInputMB && file.size > maxInputMB * 1024 * 1024) {
      showError(`图片不能超过 ${maxInputMB}MB`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      handleInputChange('firstFrame', dataUrl);
    } catch (err) {
      showError('读取图片失败');
    }
  };

  const renderAssistant = (m) => {
    if (m.status === 'completed' && m.videoUrl) {
      return (
        <div>
          <video
            controls
            playsInline
            src={m.videoUrl}
            style={{ width: '100%', borderRadius: 8 }}
          />
          <ShareBar
            url={m.videoUrl}
            filename={`video-${m.taskId || m.id}.mp4`}
          />
        </div>
      );
    }
    if (m.status === 'failed' || m.status === 'canceled') {
      return (
        <div>
          <div style={{ color: 'var(--adm-color-danger)' }}>
            生成失败{m.error ? `：${m.error}` : ''}
          </div>
          <Button
            size='mini'
            fill='outline'
            style={{ marginTop: 8 }}
            onClick={() => regenerate(m.prompt)}
          >
            重试
          </Button>
        </div>
      );
    }
    // queued / in_progress
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {typeof m.progress === 'number' && m.progress > 0 ? (
          <ProgressCircle percent={Math.round(m.progress)}>
            {Math.round(m.progress)}%
          </ProgressCircle>
        ) : (
          <SpinLoading style={{ '--size': '24px' }} />
        )}
        <div>
          <div>
            {m.stage === 'upscaling'
              ? '画质增强中（超分）…'
              : m.stage === 'dubbing'
                ? '配音中…'
                : m.status === 'queued'
                  ? '排队中…'
                  : '生成中…'}
          </div>
          {m.pollTimedOut && (
            <Button
              size='mini'
              fill='outline'
              style={{ marginTop: 6 }}
              onClick={() => refetch(m.id, m.taskId)}
            >
              查询结果
            </Button>
          )}
        </div>
      </div>
    );
  };

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
          {
            key: 'size',
            label: '尺寸',
            value: inputs.size,
            options: availableSizes,
            onChange: (v) => handleInputChange('size', v),
          },
          {
            key: 'seconds',
            label: '时长',
            value: inputs.seconds,
            options: availableDurations,
            onChange: (v) => handleInputChange('seconds', v),
          },
          {
            key: 'aspectRatio',
            label: '比例',
            value: inputs.aspectRatio,
            options: availableAspectRatios,
            onChange: (v) => handleInputChange('aspectRatio', v),
          },
        ]}
      />
      {/* 插帧/配音开关：默认关。插帧透传 target_fps；配音开启则生成后自动接 v2a 配音段 */}
      <div className='m-config-bar' style={{ paddingTop: 0, borderBottom: '0.5px solid rgba(17,24,39,0.06)' }}>
        <div
          className={`m-config-chip${inputs.interpolation ? ' active' : ''}`}
          onClick={() =>
            !generating &&
            handleInputChange('interpolation', !inputs.interpolation)
          }
        >
          插帧：{inputs.interpolation ? '开' : '关'} · 帧率翻倍更流畅
        </div>
        {dubAvailable && (
          <div
            className={`m-config-chip${inputs.dubbing ? ' active' : ''}`}
            onClick={() =>
              !generating && handleInputChange('dubbing', !inputs.dubbing)
            }
          >
            配音：{inputs.dubbing ? '开' : '关'} · 生成后自动配音
          </div>
        )}
      </div>
      {dubAvailable && inputs.dubbing && (
        <div style={{ padding: '8px 12px 0' }}>
          <TextArea
            placeholder='配音提示词（可选）：描述想要的声音，留空则按画面自动配音'
            value={inputs.dubPrompt || ''}
            onChange={(v) => handleInputChange('dubPrompt', v)}
            rows={2}
            maxLength={500}
          />
        </div>
      )}
      {/1080/i.test(inputs.size || '') && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 12,
            color: '#b45309',
            background: '#fffbeb',
            borderBottom: '0.5px solid rgba(17,24,39,0.06)',
          }}
        >
          1080P 将先生成再调用超分模型提升画质：耗时更久，且会同时产生本模型与超分模型的额度/积分消耗
        </div>
      )}
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
            needsImage ? '上传一张图片并输入提示词开始生成' : '输入提示词开始生成视频'
          }
        />
      </div>
      <PromptBar
        onSend={generate}
        generating={generating}
        disabled={turnLimitReached || missingRequiredImage}
        placeholder={
          turnLimitReached
            ? '本会话轮数已达上限，请新建会话'
            : missingRequiredImage
              ? '请先上传图片'
              : '描述你想要的视频…'
        }
        extra={
          needsImage ? (
            <div style={{ marginBottom: 8 }}>
              {inputs.firstFrame ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Image
                    src={inputs.firstFrame}
                    width={72}
                    height={72}
                    fit='cover'
                    style={{ borderRadius: 8 }}
                    onClick={() => fileRef.current?.click()}
                  />
                  <Button
                    size='mini'
                    style={{ position: 'absolute', top: -8, right: -8 }}
                    onClick={() => handleInputChange('firstFrame', '')}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <Button
                  size='small'
                  fill='outline'
                  onClick={() => fileRef.current?.click()}
                >
                  <AddOutline /> 上传图片
                </Button>
              )}
              <input
                ref={fileRef}
                type='file'
                accept='image/*'
                hidden
                onChange={handlePickImage}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
};

const Video = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('text2video');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar onBack={() => navigate(-1)}>视频生成</NavBar>
      <CapsuleTabs activeKey={mode} onChange={setMode}>
        {MODES.map((m) => (
          <CapsuleTabs.Tab key={m.key} title={m.title} />
        ))}
      </CapsuleTabs>
      <div style={{ flex: 1, minHeight: 0 }}>
        <VideoBody key={mode} mode={mode} />
      </div>
    </div>
  );
};

export default Video;
