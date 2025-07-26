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
import { Tag, Typography, Toast, Avatar } from '@douyinfe/semi-ui';
import { getModelCategories } from '../../../../../helpers';

const { Paragraph } = Typography;

const CARD_STYLES = {
  container: "w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md",
  icon: "w-8 h-8 flex items-center justify-center",
};

const ModelHeader = ({ modelData, t }) => {
  // 获取模型图标
  const getModelIcon = (modelName) => {
    // 如果没有模型名称，直接返回默认头像
    if (!modelName) {
      return (
        <div className={CARD_STYLES.container}>
          <Avatar
            size="large"
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            AI
          </Avatar>
        </div>
      );
    }

    const categories = getModelCategories(t);
    let icon = null;

    // 遍历分类，找到匹配的模型图标
    for (const [key, category] of Object.entries(categories)) {
      if (key !== 'all' && category.filter({ model_name: modelName })) {
        icon = category.icon;
        break;
      }
    }

    // 如果找到了匹配的图标，返回包装后的图标
    if (icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {React.cloneElement(icon, { size: 32 })}
          </div>
        </div>
      );
    }

    const avatarText = modelName?.slice(0, 2).toUpperCase() || 'AI';
    return (
      <div className={CARD_STYLES.container}>
        <Avatar
          size="large"
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {avatarText}
        </Avatar>
      </div>
    );
  };

  // 获取模型标签
  const getModelTags = () => {
    const tags = [
      { text: t('文本对话'), color: 'green' },
      { text: t('图片生成'), color: 'blue' },
      { text: t('图像分析'), color: 'cyan' }
    ];

    return tags;
  };

  return (
    <div className="flex items-center">
      {getModelIcon(modelData?.model_name)}
      <div className="ml-3 font-normal">
        <Paragraph
          className="!mb-1 !text-lg !font-medium"
          copyable={{
            content: modelData?.model_name || '',
            onCopy: () => Toast.success({ content: t('已复制模型名称') })
          }}
        >
          <span className="truncate max-w-60 font-bold">{modelData?.model_name || t('未知模型')}</span>
        </Paragraph>
        <div className="inline-flex gap-2 mt-1">
          {getModelTags().map((tag, index) => (
            <Tag
              key={index}
              color={tag.color}
              shape="circle"
              size="small"
            >
              {tag.text}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelHeader; 