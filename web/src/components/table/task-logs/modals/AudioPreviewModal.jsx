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
import {
  Button,
  Chip,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    <div className='flex gap-4 rounded-2xl border border-border bg-background p-4'>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          className='h-20 w-20 shrink-0 rounded-xl object-cover'
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <div className='min-w-0 flex-1'>
        <div className='mb-1 flex items-center gap-2'>
          <span className='truncate text-[15px] font-semibold text-foreground'>
            {title}
          </span>
          {duration > 0 && (
            <Chip size='sm' variant='flat'>
              {formatDuration(duration)}
            </Chip>
          )}
        </div>

        {tags && (
          <div className='mb-2 truncate text-xs text-muted'>
            {tags}
          </div>
        )}

        {hasError ? (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-sm text-warning'>
              {t('音频无法播放')}
            </span>
            <Button
              size='sm'
              startContent={<ExternalLink size={16} />}
              onPress={() => window.open(audioUrl, '_blank')}
              variant='flat'
            >
              {t('在新标签页中打开')}
            </Button>
            <Button
              size='sm'
              startContent={<Copy size={16} />}
              onPress={() => navigator.clipboard.writeText(audioUrl)}
              variant='flat'
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
            className='h-9 w-full'
          />
        )}
      </div>
    </div>
  );
};

const AudioPreviewModal = ({ isModalOpen, setIsModalOpen, audioClips }) => {
  const { t } = useTranslation();
  const clips = Array.isArray(audioClips) ? audioClips : [];
  const modalState = useOverlayState({
    isOpen: isModalOpen,
    onOpenChange: (isOpen) => {
      if (!isOpen) setIsModalOpen(false);
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='2xl' scroll='inside'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('音乐预览')}
            </ModalHeader>
            <ModalBody className='max-h-[70vh] p-4'>
              {clips.length === 0 ? (
                <span className='text-sm text-muted'>
                  {t('无')}
                </span>
              ) : (
                <div className='flex flex-col gap-3'>
                  {clips.map((clip, idx) => (
                    <AudioClipCard key={clip.clip_id || clip.id || idx} clip={clip} />
                  ))}
                </div>
              )}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default AudioPreviewModal;
