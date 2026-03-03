/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useRef, useEffect } from 'react';
import { Modal, Typography, Tag, Button } from '@douyinfe/semi-ui';
import { IconExternalOpen, IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const AudioClipCard = ({ clip }) => {
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    setHasError(false);
  }, [clip.audio_url]);

  const title = clip.title || t('未命名');
  const tags = clip.tags || clip.metadata?.tags || '';
  const duration = clip.duration || clip.metadata?.duration;
  const imageUrl = clip.image_url || clip.image_large_url;
  const audioUrl = clip.audio_url;

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--semi-color-border)',
        background: 'var(--semi-color-bg-1)',
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          style={{
            width: 80,
            height: 80,
            borderRadius: '8px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <Text strong ellipsis={{ showTooltip: true }} style={{ fontSize: 15 }}>
            {title}
          </Text>
          {duration > 0 && (
            <Tag size='small' color='grey' shape='circle'>
              {formatDuration(duration)}
            </Tag>
          )}
        </div>

        {tags && (
          <div style={{ marginBottom: '8px' }}>
            <Text
              type='tertiary'
              size='small'
              ellipsis={{ showTooltip: true, rows: 1 }}
            >
              {tags}
            </Text>
          </div>
        )}

        {hasError ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <Text type='warning' size='small'>
              {t('音频无法播放')}
            </Text>
            <Button
              size='small'
              icon={<IconExternalOpen />}
              onClick={() => window.open(audioUrl, '_blank')}
            >
              {t('在新标签页中打开')}
            </Button>
            <Button
              size='small'
              icon={<IconCopy />}
              onClick={() => navigator.clipboard.writeText(audioUrl)}
            >
              {t('复制链接')}
            </Button>
          </div>
        ) : (
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            preload='none'
            onError={() => setHasError(true)}
            style={{ width: '100%', height: 36 }}
          />
        )}
      </div>
    </div>
  );
};

const AudioPreviewModal = ({ isModalOpen, setIsModalOpen, audioClips }) => {
  const { t } = useTranslation();
  const clips = Array.isArray(audioClips) ? audioClips : [];

  return (
    <Modal
      title={t('音乐预览')}
      visible={isModalOpen}
      onOk={() => setIsModalOpen(false)}
      onCancel={() => setIsModalOpen(false)}
      closable={null}
      footer={null}
      bodyStyle={{
        maxHeight: '70vh',
        overflow: 'auto',
        padding: '16px',
      }}
      width={560}
    >
      {clips.length === 0 ? (
        <Text type='tertiary'>{t('无')}</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clips.map((clip, idx) => (
            <AudioClipCard key={clip.clip_id || clip.id || idx} clip={clip} />
          ))}
        </div>
      )}
    </Modal>
  );
};

export default AudioPreviewModal;
