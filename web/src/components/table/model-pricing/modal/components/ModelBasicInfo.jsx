import React from 'react';
import { Card, Avatar, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';
import { stringToColor } from '../../../../../helpers';

const { Text } = Typography;

const ModelBasicInfo = ({ modelData, vendorsMap = {}, t }) => {
  // 获取模型描述（使用后端真实数据）
  const getModelDescription = () => {
    if (!modelData) return t('暂无模型描述');

    // 优先使用后端提供的描述
    if (modelData.description) {
      return modelData.description;
    }

    // 如果没有描述但有供应商描述，显示供应商信息
    if (modelData.vendor_description) {
      return t('供应商信息：') + modelData.vendor_description;
    }

    return t('暂无模型描述');
  };

  // 获取模型标签
  const getModelTags = () => {
    const tags = [];

    if (modelData?.tags) {
      const customTags = modelData.tags.split(',').filter((tag) => tag.trim());
      customTags.forEach((tag) => {
        const tagText = tag.trim();
        tags.push({ text: tagText, color: stringToColor(tagText) });
      });
    }

    return tags;
  };

  return (
    <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='blue' className='mr-2 shadow-md'>
          <IconInfoCircle size={16} />
        </Avatar>
        <div>
          <Text className='text-lg font-medium'>{t('基本信息')}</Text>
          <div className='text-xs text-gray-600'>
            {t('模型的详细描述和基本特性')}
          </div>
        </div>
      </div>
      <div className='text-gray-600'>
        <p className='mb-4'>{getModelDescription()}</p>
        {getModelTags().length > 0 && (
          <Space wrap>
            {getModelTags().map((tag, index) => (
              <Tag key={index} color={tag.color} shape='circle' size='small'>
                {tag.text}
              </Tag>
            ))}
          </Space>
        )}
      </div>
    </Card>
  );
};

export default ModelBasicInfo;
