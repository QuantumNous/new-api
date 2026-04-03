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

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Typography, Spin } from '@douyinfe/semi-ui';
import { IconCopy, IconExternalOpen } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../../../../constants/playground.constants';

const { Text } = Typography;

const buildImagePreviewUrl = (url) => {
  if (typeof url !== 'string') {
    return '';
  }
  const trimmedURL = url.trim();
  if (!trimmedURL) {
    return '';
  }
  if (trimmedURL.startsWith('data:') || !/^https?:\/\//i.test(trimmedURL)) {
    return trimmedURL;
  }
  return `${API_ENDPOINTS.CREATIVE_CENTER_IMAGE_PROXY}?url=${encodeURIComponent(trimmedURL)}`;
};

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isVideo,
  isModalOpenurl,
  setIsModalOpenurl,
  modalImageUrl,
}) => {
  const { t } = useTranslation();
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const imagePreviewUrl = useMemo(
    () => buildImagePreviewUrl(modalImageUrl),
    [modalImageUrl],
  );

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

  const handleDownloadImage = () => {
    if (!imagePreviewUrl) {
      return;
    }
    const link = document.createElement('a');
    link.href = imagePreviewUrl;
    link.rel = 'noreferrer';
    link.download = 'task-preview-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderVideoContent = () => {
    if (videoError) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '16px' }}
          >
            {t('视频无法在当前浏览器中播放，这可能是由于：')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}
          >
            {t('视频服务商的跨域限制')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}
          >
            {t('需要特定的请求头或认证')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}
          >
            {t('防盗链保护机制')}
          </Text>

          <div style={{ marginTop: '20px' }}>
            <Button
              icon={<IconExternalOpen />}
              onClick={handleOpenInNewTab}
              style={{ marginRight: '8px' }}
            >
              {t('在新标签页中打开')}
            </Button>
            <Button icon={<IconCopy />} onClick={handleCopyUrl}>
              {t('复制链接')}
            </Button>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '8px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
            }}
          >
            <Text
              type='tertiary'
              style={{ fontSize: '10px', wordBreak: 'break-all' }}
            >
              {modalContent}
            </Text>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            <Spin size='large' />
          </div>
        )}
        <video
          src={modalContent}
          controls
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          onLoadStart={() => setIsLoading(true)}
        />
      </div>
    );
  };

  return (
    <>
      <Modal
        visible={isModalOpen}
        onOk={() => setIsModalOpen(false)}
        onCancel={() => setIsModalOpen(false)}
        closable={null}
        bodyStyle={{
          height: isVideo ? '70vh' : '400px',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: isVideo && videoError ? '0' : '24px',
        }}
        width={isVideo ? '90vw' : 800}
        style={isVideo ? { maxWidth: 960 } : undefined}
      >
        {isVideo ? (
          renderVideoContent()
        ) : (
          <p style={{ whiteSpace: 'pre-line' }}>{modalContent}</p>
        )}
      </Modal>

      <Modal
        visible={Boolean(isModalOpenurl)}
        onCancel={() => setIsModalOpenurl?.(false)}
        onOk={() => setIsModalOpenurl?.(false)}
        closable={null}
        title={t('图片预览')}
        width='90vw'
        style={{ maxWidth: 960 }}
        bodyStyle={{
          padding: 20,
          background: '#0f172a',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <Button icon={<IconCopy />} onClick={handleDownloadImage}>
              {t('下载')}
            </Button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '60vh',
              maxHeight: '70vh',
              overflow: 'auto',
              background: 'rgba(15, 23, 42, 0.92)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt='task preview'
                style={{
                  maxWidth: '100%',
                  maxHeight: '66vh',
                  objectFit: 'contain',
                  borderRadius: 10,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                }}
              />
            ) : (
              <Text type='tertiary'>{t('暂无可预览的图片')}</Text>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ContentModal;
