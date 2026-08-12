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
import { InputNumber, Select, Typography } from '@douyinfe/semi-ui';
import { Image, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ImageRequestControls = ({ inputs, onInputChange, disabled = false }) => {
  const { t } = useTranslation();

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className='flex items-center gap-2'>
        <Image size={16} className='text-blue-500' />
        <Typography.Text strong className='text-sm'>
          {t('Image2 图片参数')}
        </Typography.Text>
      </div>
      <Typography.Text className='text-xs text-gray-500 block'>
        {t(
          'Image2 生成使用 /images/generations；粘贴参考图后使用 /images/edits。',
        )}
      </Typography.Text>

      <div>
        <div className='flex items-center gap-2 mb-2'>
          <SlidersHorizontal size={14} className='text-gray-500' />
          <Typography.Text strong className='text-sm'>
            {t('质量')}
          </Typography.Text>
        </div>
        <Select
          value={inputs.imageQuality}
          onChange={(value) => onInputChange('imageQuality', value)}
          optionList={[
            { label: 'auto', value: 'auto' },
            { label: 'low', value: 'low' },
            { label: 'medium', value: 'medium' },
            { label: 'high', value: 'high' },
          ]}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </div>

      <div>
        <Typography.Text strong className='text-sm block mb-2'>
          {t('尺寸')}
        </Typography.Text>
        <Select
          value={inputs.imageSize}
          onChange={(value) => onInputChange('imageSize', value)}
          optionList={[
            { label: 'auto', value: 'auto' },
            { label: '1024x1024', value: '1024x1024' },
            { label: '1536x1024', value: '1536x1024' },
            { label: '1024x1536', value: '1024x1536' },
            { label: '3840x2160 (4K)', value: '3840x2160' },
            { label: '2160x3840 (4K)', value: '2160x3840' },
            { label: '4096x4096', value: '4096x4096' },
          ]}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </div>

      <div>
        <Typography.Text strong className='text-sm block mb-2'>
          {t('生成数量')}
        </Typography.Text>
        <InputNumber
          value={inputs.imageN}
          onNumberChange={(value) => onInputChange('imageN', value || 1)}
          min={1}
          max={4}
          precision={0}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default ImageRequestControls;
