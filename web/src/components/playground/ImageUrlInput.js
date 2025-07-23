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

import React from 'react';
import {
  Input,
  Typography,
  Button,
  Switch,
} from '@douyinfe/semi-ui';
import { IconFile } from '@douyinfe/semi-icons';
import {
  FileText,
  Plus,
  X,
  Image,
} from 'lucide-react';

const ImageUrlInput = ({ imageUrls, imageEnabled, onImageUrlsChange, onImageEnabledChange, disabled = false }) => {
  const handleAddImageUrl = () => {
    const newUrls = [...imageUrls, ''];
    onImageUrlsChange(newUrls);
  };

  const handleUpdateImageUrl = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    onImageUrlsChange(newUrls);
  };

  const handleRemoveImageUrl = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    onImageUrlsChange(newUrls);
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Image size={16} className={imageEnabled && !disabled ? "text-blue-500" : "text-gray-400"} />
          <Typography.Text strong className="text-sm">
            图片地址
          </Typography.Text>
          {disabled && (
            <Typography.Text className="text-xs text-orange-600">
              (已在自定义模式中忽略)
            </Typography.Text>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={imageEnabled}
            onChange={onImageEnabledChange}
            checkedText="启用"
            uncheckedText="停用"
            size="small"
            className="flex-shrink-0"
            disabled={disabled}
          />
          <Button
            icon={<Plus size={14} />}
            size="small"
            theme="solid"
            type="primary"
            onClick={handleAddImageUrl}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={!imageEnabled || disabled}
          />
        </div>
      </div>

      {!imageEnabled ? (
        <Typography.Text className="text-xs text-gray-500 mb-2 block">
          {disabled ? '图片功能在自定义请求体模式下不可用' : '启用后可添加图片URL进行多模态对话'}
        </Typography.Text>
      ) : imageUrls.length === 0 ? (
        <Typography.Text className="text-xs text-gray-500 mb-2 block">
          {disabled ? '图片功能在自定义请求体模式下不可用' : '点击 + 按钮添加图片URL进行多模态对话'}
        </Typography.Text>
      ) : (
        <Typography.Text className="text-xs text-gray-500 mb-2 block">
          已添加 {imageUrls.length} 张图片{disabled ? ' (自定义模式下不可用)' : ''}
        </Typography.Text>
      )}

      <div className={`space-y-2 max-h-32 overflow-y-auto image-list-scroll ${!imageEnabled || disabled ? 'opacity-50' : ''}`}>
        {imageUrls.map((url, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder={`https://example.com/image${index + 1}.jpg`}
                value={url}
                onChange={(value) => handleUpdateImageUrl(index, value)}
                className="!rounded-lg"
                size="small"
                prefix={<IconFile size='small' />}
                disabled={!imageEnabled || disabled}
              />
            </div>
            <Button
              icon={<X size={12} />}
              size="small"
              theme="borderless"
              type="danger"
              onClick={() => handleRemoveImageUrl(index)}
              className="!rounded-full !w-6 !h-6 !p-0 !min-w-0 !text-red-500 hover:!bg-red-50 flex-shrink-0"
              disabled={!imageEnabled || disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUrlInput; 