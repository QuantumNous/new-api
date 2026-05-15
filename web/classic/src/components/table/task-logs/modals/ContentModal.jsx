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
import { Modal, Button, Typography, Spin } from '@douyinfe/semi-ui';
import { IconExternalOpen, IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isVideo,
}) => {
  const { t } = useTranslation();
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const getCompactUrl = (url) => {
    if (!url) {
      return '';
    }
    try {
      const parsed = new URL(url);
      const path = `${parsed.pathname}${parsed.search}`;
      const shortPath =
        path.length > 28 ? `${path.slice(0, 16)}...${path.slice(-8)}` : path;
      return `${parsed.hostname}${shortPath}`;
    } catch {
      return url.length > 42 ? `${url.slice(0, 24)}...${url.slice(-12)}` : url;
    }
  };

  const renderCompactUrl = () => (
    <Text
      className='task-video-url'
      title={modalContent}
      ellipsis={{ showTooltip: { content: modalContent } }}
    >
      {getCompactUrl(modalContent) || t('暂无链接')}
    </Text>
  );

  const renderUrlSummary = () => (
    <div className='task-video-url-summary'>
      <span className='task-video-url-label'>{t('视频链接')}</span>
      {renderCompactUrl()}
    </div>
  );

  const renderVideoContent = () => {
    if (videoError) {
      return (
        <div className='task-video-error-state'>
          <div className='task-video-error-copy'>
            <Text strong>{t('视频无法在当前浏览器中播放')}</Text>
            <Text type='tertiary'>
              {t(
                '这可能是由于视频服务商的跨域限制、认证要求或防盗链保护机制。',
              )}
            </Text>
          </div>

          <div className='task-video-modal-actions'>
            <Button
              icon={<IconExternalOpen />}
              onClick={handleOpenInNewTab}
              className='task-video-action-button'
              aria-label={t('在新标签页中打开')}
            >
              {t('在新标签页中打开')}
            </Button>
            <Button
              icon={<IconCopy />}
              onClick={handleCopyUrl}
              className='task-video-action-button'
              aria-label={t('复制链接')}
            >
              {t('复制链接')}
            </Button>
          </div>

          <div className='task-video-url-panel'>{renderUrlSummary()}</div>
        </div>
      );
    }

    return (
      <div className='task-video-modal-content'>
        <div className='task-video-stage'>
          {isLoading && (
            <div className='task-video-loading'>
              <Spin size='large' />
            </div>
          )}
          <video
            src={modalContent}
            controls
            className='task-video-player'
            onError={handleVideoError}
            onLoadedData={handleVideoLoaded}
            onLoadStart={() => setIsLoading(true)}
          />
        </div>

        <div className='task-video-toolbar'>
          {renderUrlSummary()}
          <div className='task-video-modal-actions'>
            <Button
              icon={<IconExternalOpen />}
              onClick={handleOpenInNewTab}
              className='task-video-action-button'
              aria-label={t('在新标签页中打开')}
            >
              {t('新标签页')}
            </Button>
            <Button
              icon={<IconCopy />}
              onClick={handleCopyUrl}
              className='task-video-action-button'
              aria-label={t('复制链接')}
            >
              {t('复制链接')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={isVideo ? t('视频预览') : undefined}
      className={isVideo ? 'task-video-modal' : undefined}
      visible={isModalOpen}
      onOk={() => setIsModalOpen(false)}
      onCancel={() => setIsModalOpen(false)}
      closable
      footer={isVideo ? null : undefined}
      bodyStyle={{
        height: isVideo ? '70vh' : '400px',
        maxHeight: '80vh',
        overflow: 'auto',
        padding: isVideo ? 0 : '24px',
      }}
      width={isVideo ? 'min(92vw, 980px)' : 800}
    >
      {isVideo ? (
        renderVideoContent()
      ) : (
        <p style={{ whiteSpace: 'pre-line' }}>{modalContent}</p>
      )}
    </Modal>
  );
};

export default ContentModal;
