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

import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import { Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isVideo,
}) => {
  const { t } = useTranslation();
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const modalState = useOverlayState({
    isOpen: isModalOpen,
    onOpenChange: (isOpen) => {
      if (!isOpen) setIsModalOpen(false);
    },
  });

  useEffect(() => {
    if (isModalOpen && isVideo) {
      setVideoError(false);
      setIsLoading(true);
    }
  }, [isModalOpen, isVideo]);

  const handleVideoError = () => {
    setVideoError(true);
    setIsLoading(false);
  };

  const handleVideoLoaded = () => {
    setIsLoading(false);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(modalContent);
  };

  const handleOpenInNewTab = () => {
    window.open(modalContent, '_blank');
  };

  const renderVideoContent = () => {
    if (videoError) {
      return (
        <div className='flex flex-col items-center px-4 py-10 text-center'>
          <p className='mb-4 text-sm text-muted'>
            {t('视频无法在当前浏览器中播放，这可能是由于：')}
          </p>
          <p className='mb-2 text-xs text-muted'>
            {t('• 视频服务商的跨域限制')}
          </p>
          <p className='mb-2 text-xs text-muted'>
            {t('• 需要特定的请求头或认证')}
          </p>
          <p className='mb-4 text-xs text-muted'>
            {t('• 防盗链保护机制')}
          </p>

          <div className='mt-3 flex flex-wrap justify-center gap-2'>
            <Button
              startContent={<ExternalLink size={16} />}
              onPress={handleOpenInNewTab}
              size='sm'
              variant='flat'
            >
              {t('在新标签页中打开')}
            </Button>
            <Button
              startContent={<Copy size={16} />}
              onPress={handleCopyUrl}
              size='sm'
              variant='flat'
            >
              {t('复制链接')}
            </Button>
          </div>

          <div className='mt-4 max-w-full break-all rounded-xl bg-surface-secondary p-2 text-[10px] text-muted'>
            {modalContent}
          </div>
        </div>
      );
    }

    return (
      <div className='relative h-full'>
        {isLoading && (
          <div className='absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2'>
            <Spinner size='lg' />
          </div>
        )}
        <video
          src={modalContent}
          controls
          className='h-full max-h-full w-full max-w-full object-contain'
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          onLoadStart={() => setIsLoading(true)}
        />
      </div>
    );
  };

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size={isVideo ? '5xl' : '3xl'} scroll='inside'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {isVideo ? t('视频预览') : t('内容预览')}
            </ModalHeader>
            <ModalBody className={isVideo ? 'h-[70vh] p-4' : 'max-h-[70vh] p-6'}>
              {isVideo ? (
                renderVideoContent()
              ) : (
                <p className='whitespace-pre-line text-sm text-foreground'>
                  {modalContent}
                </p>
              )}
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button color='primary' onPress={() => setIsModalOpen(false)}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ContentModal;
