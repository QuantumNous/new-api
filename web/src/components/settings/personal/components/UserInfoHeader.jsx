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

import React, { useState } from 'react';
import {
  Avatar,
  Card,
  Tag,
  Divider,
  Typography,
  Badge,
  Upload,
  Toast,
  Modal,
} from '@douyinfe/semi-ui';
import { IconCamera } from '@douyinfe/semi-icons';
import {
  isRoot,
  isAdmin,
  renderQuota,
  stringToColor,
} from '../../../../helpers';
import { Coins, BarChart2, Users } from 'lucide-react';
import { updateUserAvatar } from '../../../../helpers/userDataManager';

// 添加样式确保头像上传的点击热区是圆形
const avatarUploadStyle = `
.avatar-upload .semi-upload-add {
  border-radius: 50% !important;
}
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = avatarUploadStyle;
  if (!document.head.querySelector('style[data-avatar-upload]')) {
    styleElement.setAttribute('data-avatar-upload', 'true');
    document.head.appendChild(styleElement);
  }
}

const UserInfoHeader = ({ t, userState, onUserDataUpdate }) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [uploading, setUploading] = useState(false);

  const getUsername = () => {
    if (userState.user) {
      return userState.user.username;
    } else {
      return 'null';
    }
  };

  const getAvatarText = () => {
    const username = getUsername();
    if (username && username.length > 0) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'NA';
  };

  // 将文件转换为base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // 上传前验证
  const beforeUpload = ({ file }) => {
    console.log('beforeUpload file:', file); // 调试日志

    // 获取文件类型，可能在 file.type 或 file.fileInstance.type 中
    const fileType = file.type || (file.fileInstance && file.fileInstance.type) || '';
    const fileSize = file.size || (file.fileInstance && file.fileInstance.size) || 0;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      console.log('File type validation failed:', fileType); // 调试日志
      Toast.error(t('不支持的图片格式，仅支持 JPEG、PNG、GIF、WebP'));
      return {
        autoRemove: true,
        shouldUpload: false,
        status: 'validateFail',
        validateMessage: t('不支持的图片格式，仅支持 JPEG、PNG、GIF、WebP')
      };
    }

    // 考虑base64编码会增加约33%的大小，所以原始文件限制为1.5MB
    const maxSize = 1.5 * 1024 * 1024; // 1.5MB
    if (fileSize > maxSize) {
      Toast.error(t('图片文件大小不能超过1.5MB'));
      return {
        autoRemove: true,
        shouldUpload: false,
        status: 'validateFail',
        validateMessage: t('图片文件大小不能超过1.5MB')
      };
    }

    return {
      shouldUpload: false, // 不直接上传，而是先预览
      status: 'success'
    };
  };

  // 处理文件选择
  const handleFileChange = async ({ currentFile }) => {
    console.log('handleFileChange currentFile:', currentFile); // 调试日志

    if (currentFile && currentFile.fileInstance) {
      // 再次验证文件类型（客户端验证）
      const fileType = currentFile.fileInstance.type;
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

      if (!allowedTypes.includes(fileType.toLowerCase())) {
        Toast.error(t('不支持的图片格式，仅支持 JPEG、PNG、GIF、WebP'));
        return;
      }

      try {
        setUploading(true);
        const base64Data = await fileToBase64(currentFile.fileInstance);

        // 验证base64数据大小（约2MB限制）
        const base64Size = base64Data.length;
        const maxBase64Size = 2 * 1024 * 1024; // 2MB

        if (base64Size > maxBase64Size) {
          Toast.error(t('图片编码后数据过大，请选择更小的图片'));
          return;
        }

        setPreviewImage(base64Data);
        setPreviewVisible(true);
      } catch (error) {
        Toast.error(t('图片处理失败，请重试'));
        console.error('File processing error:', error);
      } finally {
        setUploading(false);
      }
    }
  };

  // 确认上传头像
  const handleConfirmUpload = async () => {
    if (!previewImage) return;

    try {
      setUploading(true);

      // 使用新的用户数据管理器上传头像
      const result = await updateUserAvatar(previewImage, {
        id: userState.user?.id,
        username: userState.user?.username || '',
        display_name: userState.user?.display_name || '',
      });

      if (result.success) {
        setPreviewVisible(false);
        setPreviewImage('');
        Toast.success(t('头像更新成功'));
        // 刷新用户数据
        if (onUserDataUpdate) {
          await onUserDataUpdate();
        }
      } else {
        Toast.error(result.message || t('头像更新失败，请重试'));
      }
    } catch (error) {
      Toast.error(t('头像更新失败，请重试'));
      console.error('Avatar update error:', error);
    } finally {
      setUploading(false);
    }
  };



  return (
    <Card
      className='!rounded-2xl overflow-hidden'
      cover={
        <div
          className='relative h-32'
          style={{
            '--palette-primary-darkerChannel': '0 75 80',
            backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* 用户信息内容 */}
          <div className='relative z-10 h-full flex flex-col justify-end p-6'>
            <div className='flex items-center'>
              <div className='flex items-stretch gap-3 sm:gap-4 flex-1 min-w-0'>
                <Upload
                  className="avatar-upload"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  beforeUpload={beforeUpload}
                  onChange={handleFileChange}
                  showUploadList={false}
                  maxSize={1536}
                  onSizeError={() => {
                    Toast.error(t('图片文件大小不能超过1.5MB'));
                  }}
                  onAcceptInvalid={() => {
                    Toast.error(t('不支持的图片格式，仅支持 JPEG、PNG、GIF、WebP'));
                  }}
                  disabled={uploading}
                >
                  <Avatar
                    size='large'
                    src={userState.user?.avatar || undefined}
                    color={userState.user?.avatar ? undefined : stringToColor(getUsername())}
                    hoverMask={
                      <div style={{
                        backgroundColor: 'var(--semi-color-overlay-bg)',
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--semi-color-white)',
                      }}>
                        <IconCamera />
                      </div>
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    {!userState.user?.avatar && getAvatarText()}
                  </Avatar>
                </Upload>
                <div className='flex-1 min-w-0 flex flex-col justify-between'>
                  <div
                    className='text-3xl font-bold truncate'
                    style={{ color: 'white' }}
                  >
                    {getUsername()}
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    {isRoot() ? (
                      <Tag
                        size='large'
                        shape='circle'
                        style={{ color: 'white' }}
                      >
                        {t('超级管理员')}
                      </Tag>
                    ) : isAdmin() ? (
                      <Tag
                        size='large'
                        shape='circle'
                        style={{ color: 'white' }}
                      >
                        {t('管理员')}
                      </Tag>
                    ) : (
                      <Tag
                        size='large'
                        shape='circle'
                        style={{ color: 'white' }}
                      >
                        {t('普通用户')}
                      </Tag>
                    )}
                    <Tag size='large' shape='circle' style={{ color: 'white' }}>
                      ID: {userState?.user?.id}
                    </Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* 当前余额和桌面版统计信息 */}
      <div className='flex items-start justify-between gap-6'>
        {/* 当前余额显示 */}
        <Badge count={t('当前余额')} position='rightTop' type='danger'>
          <div className='text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide'>
            {renderQuota(userState?.user?.quota)}
          </div>
        </Badge>

        {/* 桌面版统计信息（Semi UI 卡片） */}
        <div className='hidden lg:block flex-shrink-0'>
          <Card
            size='small'
            className='!rounded-xl'
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Coins size={16} />
                <Typography.Text size='small' type='tertiary'>
                  {t('历史消耗')}
                </Typography.Text>
                <Typography.Text size='small' type='tertiary' strong>
                  {renderQuota(userState?.user?.used_quota)}
                </Typography.Text>
              </div>
              <Divider layout='vertical' />
              <div className='flex items-center gap-2'>
                <BarChart2 size={16} />
                <Typography.Text size='small' type='tertiary'>
                  {t('请求次数')}
                </Typography.Text>
                <Typography.Text size='small' type='tertiary' strong>
                  {userState.user?.request_count || 0}
                </Typography.Text>
              </div>
              <Divider layout='vertical' />
              <div className='flex items-center gap-2'>
                <Users size={16} />
                <Typography.Text size='small' type='tertiary'>
                  {t('用户分组')}
                </Typography.Text>
                <Typography.Text size='small' type='tertiary' strong>
                  {userState?.user?.group || t('默认')}
                </Typography.Text>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 移动端和中等屏幕统计信息卡片 */}
      <div className='lg:hidden mt-2'>
        <Card
          size='small'
          className='!rounded-xl'
          bodyStyle={{ padding: '12px 16px' }}
        >
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Coins size={16} />
                <Typography.Text size='small' type='tertiary'>
                  {t('历史消耗')}
                </Typography.Text>
              </div>
              <Typography.Text size='small' type='tertiary' strong>
                {renderQuota(userState?.user?.used_quota)}
              </Typography.Text>
            </div>
            <Divider margin='8px' />
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <BarChart2 size={16} />
                <Typography.Text size='small' type='tertiary'>
                  {t('请求次数')}
                </Typography.Text>
              </div>
              <Typography.Text size='small' type='tertiary' strong>
                {userState.user?.request_count || 0}
              </Typography.Text>
            </div>
            <Divider margin='8px' />
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Users size={16} />
                <Typography.Text size='small' type='tertiary'>
                  {t('用户分组')}
                </Typography.Text>
              </div>
              <Typography.Text size='small' type='tertiary' strong>
                {userState?.user?.group || t('默认')}
              </Typography.Text>
            </div>
          </div>
        </Card>
      </div>

      {/* 头像预览模态框 */}
      <Modal
        title={t('预览头像')}
        visible={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewImage('');
        }}
        onOk={handleConfirmUpload}
        okText={t('确认上传')}
        cancelText={t('取消')}
        confirmLoading={uploading}
        width={400}
      >
        <div className="flex flex-col items-center space-y-4">
          <Avatar
            size="extra-large"
            src={previewImage}
            className="border-2 border-gray-200"
          />
          <p className="text-sm text-gray-600">
            {t('确认要使用这张图片作为头像吗？')}
          </p>
        </div>
      </Modal>
    </Card>
  );
};

export default UserInfoHeader;
