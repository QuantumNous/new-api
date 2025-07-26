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
import { Card, Tag, Avatar, AvatarGroup } from '@douyinfe/semi-ui';

const PricingCategoryIntro = ({
  activeKey,
  modelCategories,
  categoryCounts,
  availableCategories,
  t
}) => {
  // 轮播动效状态（只对全部模型生效）
  const [currentOffset, setCurrentOffset] = useState(0);

  // 获取除了 'all' 之外的可用分类
  const validCategories = (availableCategories || []).filter(key => key !== 'all');

  // 设置轮播定时器（只对全部模型且有足够头像时生效）
  useEffect(() => {
    if (activeKey !== 'all' || validCategories.length <= 3) {
      setCurrentOffset(0); // 重置偏移
      return;
    }

    const interval = setInterval(() => {
      setCurrentOffset(prev => (prev + 1) % validCategories.length);
    }, 2000); // 每2秒切换一次

    return () => clearInterval(interval);
  }, [activeKey, validCategories.length]);

  // 如果没有有效的分类键或分类数据，不显示
  if (!activeKey || !modelCategories) {
    return null;
  }

  const modelCount = categoryCounts[activeKey] || 0;

  // 获取分类描述信息
  const getCategoryDescription = (categoryKey) => {
    const descriptions = {
      all: t('查看所有可用的AI模型，包括文本生成、图像处理、音频转换等多种类型的模型。'),
      openai: t('令牌分发介绍：SSVIP 为纯OpenAI官方。SVIP 为纯Azure。Default 为Azure 消费。VIP为近似的复数。VVIP为近似的书发。'),
      anthropic: t('Anthropic Claude系列模型，以安全性和可靠性著称，擅长对话、分析和创作任务。'),
      gemini: t('Google Gemini系列模型，具备强大的多模态能力，支持文本、图像和代码理解。'),
      moonshot: t('月之暗面Moonshot系列模型，专注于长文本处理和深度理解能力。'),
      zhipu: t('智谱AI ChatGLM系列模型，在中文理解和生成方面表现优秀。'),
      qwen: t('阿里云通义千问系列模型，覆盖多个领域的智能问答和内容生成。'),
      deepseek: t('DeepSeek系列模型，在代码生成和数学推理方面具有出色表现。'),
      minimax: t('MiniMax ABAB系列模型，专注于对话和内容创作的AI助手。'),
      baidu: t('百度文心一言系列模型，在中文自然语言处理方面具有强大能力。'),
      xunfei: t('科大讯飞星火系列模型，在语音识别和自然语言理解方面领先。'),
      midjourney: t('Midjourney图像生成模型，专业的AI艺术创作和图像生成服务。'),
      tencent: t('腾讯混元系列模型，提供全面的AI能力和企业级服务。'),
      cohere: t('Cohere Command系列模型，专注于企业级自然语言处理应用。'),
      cloudflare: t('Cloudflare Workers AI模型，提供边缘计算和高性能AI服务。'),
      ai360: t('360智脑系列模型，在安全和智能助手方面具有独特优势。'),
      yi: t('零一万物Yi系列模型，提供高质量的多语言理解和生成能力。'),
      jina: t('Jina AI模型，专注于嵌入和向量搜索的AI解决方案。'),
      mistral: t('Mistral AI系列模型，欧洲领先的开源大语言模型。'),
      xai: t('xAI Grok系列模型，具有独特的幽默感和实时信息处理能力。'),
      llama: t('Meta Llama系列模型，开源的大语言模型，在各种任务中表现优秀。'),
      doubao: t('字节跳动豆包系列模型，在内容创作和智能对话方面表现出色。'),
    };
    return descriptions[categoryKey] || t('该分类包含多种AI模型，适用于不同的应用场景。');
  };

  // 为全部模型创建特殊的头像组合
  const renderAllModelsAvatar = () => {
    // 重新排列数组，让当前偏移量的头像在第一位
    const rotatedCategories = validCategories.length > 3 ? [
      ...validCategories.slice(currentOffset),
      ...validCategories.slice(0, currentOffset)
    ] : validCategories;

    // 如果没有有效分类，使用模型分类名称的前两个字符
    if (validCategories.length === 0) {
      // 获取所有分类（除了 'all'）的名称前两个字符
      const fallbackCategories = Object.entries(modelCategories)
        .filter(([key]) => key !== 'all')
        .slice(0, 3)
        .map(([key, category]) => ({
          key,
          label: category.label,
          text: category.label.slice(0, 2) || key.slice(0, 2).toUpperCase()
        }));

      return (
        <div className="min-w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center px-2">
          <AvatarGroup size="default" overlapFrom='end'>
            {fallbackCategories.map((item) => (
              <Avatar
                key={item.key}
                size="default"
                color="transparent"
                alt={item.label}
              >
                {item.text}
              </Avatar>
            ))}
          </AvatarGroup>
        </div>
      );
    }

    return (
      <div className="min-w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center px-2">
        <AvatarGroup
          maxCount={4}
          size="default"
          overlapFrom='end'
          key={currentOffset}
          renderMore={(restNumber) => (
            <Avatar
              size="default"
              style={{ backgroundColor: 'transparent', color: 'var(--semi-color-text-0)' }}
              alt={`${restNumber} more categories`}
            >
              {`+${restNumber}`}
            </Avatar>
          )}
        >
          {rotatedCategories.map((categoryKey) => {
            const category = modelCategories[categoryKey];

            return (
              <Avatar
                key={categoryKey}
                size="default"
                color="transparent"
                alt={category?.label || categoryKey}
              >
                {category?.icon ?
                  React.cloneElement(category.icon, { size: 20 }) :
                  (category?.label?.charAt(0) || categoryKey.charAt(0).toUpperCase())
                }
              </Avatar>
            );
          })}
        </AvatarGroup>
      </div>
    );
  };

  // 为具体分类渲染单个图标
  const renderCategoryAvatar = (category) => (
    <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
      {category.icon && React.cloneElement(category.icon, { size: 40 })}
    </div>
  );

  // 如果是全部模型分类
  if (activeKey === 'all') {
    return (
      <div className='mb-4'>
        <Card className="!rounded-2xl" bodyStyle={{ padding: '16px' }}>
          <div className="flex items-start space-x-3 md:space-x-4">
            {/* 全部模型的头像组合 */}
            <div className="flex-shrink-0">
              {renderAllModelsAvatar()}
            </div>

            {/* 分类信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{modelCategories.all.label}</h2>
                <Tag color="white" shape="circle" size="small" className="self-start sm:self-center">
                  {t('共 {{count}} 个模型', { count: modelCount })}
                </Tag>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {getCategoryDescription(activeKey)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 具体分类
  const currentCategory = modelCategories[activeKey];
  if (!currentCategory) {
    return null;
  }

  return (
    <div className='mb-4'>
      <Card className="!rounded-2xl" bodyStyle={{ padding: '16px' }}>
        <div className="flex items-start space-x-3 md:space-x-4">
          {/* 分类图标 */}
          <div className="flex-shrink-0">
            {renderCategoryAvatar(currentCategory)}
          </div>

          {/* 分类信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{currentCategory.label}</h2>
              <Tag color="white" shape="circle" size="small" className="self-start sm:self-center">
                {t('共 {{count}} 个模型', { count: modelCount })}
              </Tag>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {getCategoryDescription(activeKey)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PricingCategoryIntro; 