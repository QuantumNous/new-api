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
import { IconExternalOpen, IconCopy, IconDownload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../../../helpers';

const { Text } = Typography;

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isVideo,
  taskId,
  isAdmin,
}) => {
  const { t } = useTranslation();
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // 下载：优先走后端 /download 端点拿「带友好文件名」的签名 URL；无 taskId 时回退直下。
  const handleDownload = async () => {
    if (!taskId) {
      window.open(modalContent, '_blank');
      return;
    }
    setDownloading(true);
    try {
      // admin 在「全部任务」里看的可能是别人的任务，走 admin 端点（按 task_id 不限 user）。
      const endpoint = isAdmin
        ? `/api/task/${taskId}/download`
        : `/api/task/self/${taskId}/download`;
      const res = await API.get(endpoint);
      if (res.data?.success && res.data?.data?.url) {
        window.location.href = res.data.data.url;
      } else {
        showError(res.data?.message || t('获取下载链接失败'));
      }
    } catch (e) {
      showError(t('下载失败'));
    } finally {
      setDownloading(false);
    }
  };

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
            {t('• 视频服务商的跨域限制')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}
          >
            {t('• 需要特定的请求头或认证')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}
          >
            {t('• 防盗链保护机制')}
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
            <Button
              icon={<IconDownload />}
              loading={downloading}
              onClick={handleDownload}
              style={{ marginLeft: '8px' }}
            >
              {t('下载')}
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
        <Button
          icon={<IconDownload />}
          loading={downloading}
          onClick={handleDownload}
          size='small'
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 11 }}
        >
          {t('下载')}
        </Button>
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
  );
};

export default ContentModal;
