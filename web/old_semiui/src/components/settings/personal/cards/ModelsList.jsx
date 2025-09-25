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
  Empty,
  Skeleton,
  Space,
  Tag,
  Collapsible,
  Tabs,
  TabPane,
  Typography,
  Avatar,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoContent,
  IllustrationNoContentDark,
} from '@douyinfe/semi-illustrations';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';
import { Settings } from 'lucide-react';
import { renderModelTag, getModelCategories } from '../../../../helpers';

const ModelsList = ({ t, models, modelsLoading, copyText }) => {
  const [isModelsExpanded, setIsModelsExpanded] = useState(() => {
    // Initialize from localStorage if available
    const savedState = localStorage.getItem('modelsExpanded');
    return savedState ? JSON.parse(savedState) : false;
  });
  const [activeModelCategory, setActiveModelCategory] = useState('all');
  const MODELS_DISPLAY_COUNT = 25; // 默认显示的模型数量

  // Save models expanded state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('modelsExpanded', JSON.stringify(isModelsExpanded));
  }, [isModelsExpanded]);

  return (
    <div className='py-4'>
      {/* 卡片头部 */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='green' className='mr-3 shadow-md'>
          <Settings size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('可用模型')}
          </Typography.Text>
          <div className='text-xs text-gray-600'>
            {t('查看当前可用的所有模型')}
          </div>
        </div>
      </div>

      {/* 可用模型部分 */}
      <div className='bg-gray-50 dark:bg-gray-800 rounded-xl'>
        {modelsLoading ? (
          // 骨架屏加载状态 - 模拟实际加载后的布局
          <div className='space-y-4'>
            {/* 模拟分类标签 */}
            <div
              className='mb-4'
              style={{ borderBottom: '1px solid var(--semi-color-border)' }}
            >
              <div className='flex overflow-x-auto py-2 gap-2'>
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton.Button
                    key={`cat-${index}`}
                    style={{
                      width: index === 0 ? 130 : 100 + Math.random() * 50,
                      height: 36,
                      borderRadius: 8,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 模拟模型标签列表 */}
            <div className='flex flex-wrap gap-2'>
              {Array.from({ length: 20 }).map((_, index) => (
                <Skeleton.Button
                  key={`model-${index}`}
                  style={{
                    width: 100 + Math.random() * 100,
                    height: 32,
                    borderRadius: 16,
                    margin: '4px',
                  }}
                />
              ))}
            </div>
          </div>
        ) : models.length === 0 ? (
          <div className='py-8'>
            <Empty
              image={
                <IllustrationNoContent style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoContentDark
                  style={{ width: 150, height: 150 }}
                />
              }
              description={t('没有可用模型')}
              style={{ padding: '24px 0' }}
            />
          </div>
        ) : (
          <>
            {/* 模型分类标签页 */}
            <div className='mb-4'>
              <Tabs
                type='card'
                activeKey={activeModelCategory}
                onChange={(key) => setActiveModelCategory(key)}
                className='mt-2'
                collapsible
              >
                {Object.entries(getModelCategories(t)).map(
                  ([key, category]) => {
                    // 计算该分类下的模型数量
                    const modelCount =
                      key === 'all'
                        ? models.length
                        : models.filter((model) =>
                            category.filter({ model_name: model }),
                          ).length;

                    if (modelCount === 0 && key !== 'all') return null;

                    return (
                      <TabPane
                        tab={
                          <span className='flex items-center gap-2'>
                            {category.icon && (
                              <span className='w-4 h-4'>{category.icon}</span>
                            )}
                            {category.label}
                            <Tag
                              color={
                                activeModelCategory === key ? 'red' : 'grey'
                              }
                              size='small'
                              shape='circle'
                            >
                              {modelCount}
                            </Tag>
                          </span>
                        }
                        itemKey={key}
                        key={key}
                      />
                    );
                  },
                )}
              </Tabs>
            </div>

            <div className='bg-white dark:bg-gray-700 rounded-lg p-3'>
              {(() => {
                // 根据当前选中的分类过滤模型
                const categories = getModelCategories(t);
                const filteredModels =
                  activeModelCategory === 'all'
                    ? models
                    : models.filter((model) =>
                        categories[activeModelCategory].filter({
                          model_name: model,
                        }),
                      );

                // 如果过滤后没有模型，显示空状态
                if (filteredModels.length === 0) {
                  return (
                    <Empty
                      image={
                        <IllustrationNoContent
                          style={{ width: 120, height: 120 }}
                        />
                      }
                      darkModeImage={
                        <IllustrationNoContentDark
                          style={{ width: 120, height: 120 }}
                        />
                      }
                      description={t('该分类下没有可用模型')}
                      style={{ padding: '16px 0' }}
                    />
                  );
                }

                if (filteredModels.length <= MODELS_DISPLAY_COUNT) {
                  return (
                    <Space wrap>
                      {filteredModels.map((model) =>
                        renderModelTag(model, {
                          size: 'small',
                          shape: 'circle',
                          onClick: () => copyText(model),
                        }),
                      )}
                    </Space>
                  );
                } else {
                  return (
                    <>
                      <Collapsible isOpen={isModelsExpanded}>
                        <Space wrap>
                          {filteredModels.map((model) =>
                            renderModelTag(model, {
                              size: 'small',
                              shape: 'circle',
                              onClick: () => copyText(model),
                            }),
                          )}
                          <Tag
                            color='grey'
                            type='light'
                            className='cursor-pointer !rounded-lg'
                            onClick={() => setIsModelsExpanded(false)}
                            icon={<IconChevronUp />}
                          >
                            {t('收起')}
                          </Tag>
                        </Space>
                      </Collapsible>
                      {!isModelsExpanded && (
                        <Space wrap>
                          {filteredModels
                            .slice(0, MODELS_DISPLAY_COUNT)
                            .map((model) =>
                              renderModelTag(model, {
                                size: 'small',
                                shape: 'circle',
                                onClick: () => copyText(model),
                              }),
                            )}
                          <Tag
                            color='grey'
                            type='light'
                            className='cursor-pointer !rounded-lg'
                            onClick={() => setIsModelsExpanded(true)}
                            icon={<IconChevronDown />}
                          >
                            {t('更多')}{' '}
                            {filteredModels.length - MODELS_DISPLAY_COUNT}{' '}
                            {t('个模型')}
                          </Tag>
                        </Space>
                      )}
                    </>
                  );
                }
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelsList;
