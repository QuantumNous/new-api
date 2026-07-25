import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  CapsuleTabs,
  Image as AmImage,
  ImageViewer,
  NavBar,
  SpinLoading,
} from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';

import { useImageGeneration } from '@classic/hooks/imagePlayground/useImageGeneration';
import { IMAGE_MAX_EDIT_IMAGES } from '@classic/constants/imagePlayground.constants';

import ConfigBar from '../components/gen/ConfigBar';
import MessageFeed from '../components/gen/MessageFeed';
import PromptBar from '../components/gen/PromptBar';
import ShareBar from '../components/gen/ShareBar';
import { showError } from '../shims/classic-utils';
import { fileToDataUrl } from '../utils/file';

const MODES = [
  { key: 'text2image', title: '文生图' },
  { key: 'image2image', title: '图生图' },
];

const ImageBody = ({ mode }) => {
  const {
    isI2I,
    inputs,
    handleInputChange,
    groups,
    models,
    availableSizes,
    messages,
    generating,
    turnLimitReached,
    missingRequiredImage,
    generate,
    regenerate,
    newConversation,
  } = useImageGeneration({ mode });

  const fileRef = useRef(null);
  const [viewerImage, setViewerImage] = useState('');

  const handlePickImage = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map(fileToDataUrl));
      const merged = [...(inputs.imageUrls || []), ...urls].slice(
        0,
        IMAGE_MAX_EDIT_IMAGES,
      );
      handleInputChange('imageUrls', merged);
    } catch (err) {
      showError('读取图片失败');
    }
  };

  const removeBaseImage = (idx) => {
    const next = [...(inputs.imageUrls || [])];
    next.splice(idx, 1);
    handleInputChange('imageUrls', next);
  };

  const renderAssistant = (m) => {
    if (m.status === 'success' && (m.images || []).length > 0) {
      return (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {m.images.map((url, i) => (
              <AmImage
                key={i}
                src={url}
                width={140}
                height={140}
                fit='cover'
                style={{ borderRadius: 8 }}
                onClick={() => setViewerImage(url)}
              />
            ))}
          </div>
          <ShareBar
            url={m.images[0]}
            filename={`image-${m.id}.png`}
            hint='微信内可直接长按图片转发好友或保存到相册。'
          />
        </div>
      );
    }
    if (m.status === 'failed') {
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
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SpinLoading style={{ '--size': '24px' }} />
        <span>生成中…</span>
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
            isI2I ? '上传底图并输入提示词开始编辑' : '输入提示词开始生成图片'
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
              ? '请先上传底图'
              : '描述你想要的图片…'
        }
        extra={
          isI2I ? (
            <div
              style={{
                marginBottom: 8,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {(inputs.imageUrls || []).map((url, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <AmImage
                    src={url}
                    width={64}
                    height={64}
                    fit='cover'
                    style={{ borderRadius: 8 }}
                  />
                  <Button
                    size='mini'
                    style={{ position: 'absolute', top: -8, right: -8 }}
                    onClick={() => removeBaseImage(idx)}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {(inputs.imageUrls || []).length < IMAGE_MAX_EDIT_IMAGES && (
                <Button
                  size='small'
                  fill='outline'
                  onClick={() => fileRef.current?.click()}
                >
                  <AddOutline /> 底图
                </Button>
              )}
              <input
                ref={fileRef}
                type='file'
                accept='image/*'
                multiple
                hidden
                onChange={handlePickImage}
              />
            </div>
          ) : null
        }
      />
      <ImageViewer
        image={viewerImage}
        visible={!!viewerImage}
        onClose={() => setViewerImage('')}
      />
    </div>
  );
};

const ImagePage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('text2image');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar onBack={() => navigate(-1)}>图片生成</NavBar>
      <CapsuleTabs activeKey={mode} onChange={setMode}>
        {MODES.map((m) => (
          <CapsuleTabs.Tab key={m.key} title={m.title} />
        ))}
      </CapsuleTabs>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ImageBody key={mode} mode={mode} />
      </div>
    </div>
  );
};

export default ImagePage;
