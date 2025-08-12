import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../../../../hooks/common/useIsMobile.js';
import { Modal, Checkbox, Spin, Input, Typography, Empty, Tabs, Collapse } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import { IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { getModelCategories } from '../../../../helpers/render';

const ModelSelectModal = ({ visible, models = [], selected = [], onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [checkedList, setCheckedList] = useState(selected);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('new');

  const isMobile = useIsMobile();

  const filteredModels = models.filter((m) => m.toLowerCase().includes(keyword.toLowerCase()));

  // 分类模型：新获取的模型和已有模型
  const newModels = filteredModels.filter(model => !selected.includes(model));
  const existingModels = filteredModels.filter(model => selected.includes(model));

  // 同步外部选中值
  useEffect(() => {
    if (visible) {
      setCheckedList(selected);
    }
  }, [visible, selected]);

  // 当模型列表变化时，设置默认tab
  useEffect(() => {
    if (visible) {
      // 默认显示新获取模型tab，如果没有新模型则显示已有模型
      const hasNewModels = newModels.length > 0;
      setActiveTab(hasNewModels ? 'new' : 'existing');
    }
  }, [visible, newModels.length, selected]);

  const handleOk = () => {
    onConfirm && onConfirm(checkedList);
  };

  // 按厂商分类模型
  const categorizeModels = (models) => {
    const categories = getModelCategories(t);
    const categorizedModels = {};
    const uncategorizedModels = [];

    models.forEach(model => {
      let foundCategory = false;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: model })) {
          if (!categorizedModels[key]) {
            categorizedModels[key] = {
              label: category.label,
              icon: category.icon,
              models: []
            };
          }
          categorizedModels[key].models.push(model);
          foundCategory = true;
          break;
        }
      }
      if (!foundCategory) {
        uncategorizedModels.push(model);
      }
    });

    // 如果有未分类模型，添加到"其他"分类
    if (uncategorizedModels.length > 0) {
      categorizedModels['other'] = {
        label: t('其他'),
        icon: null,
        models: uncategorizedModels
      };
    }

    return categorizedModels;
  };

  const newModelsByCategory = categorizeModels(newModels);
  const existingModelsByCategory = categorizeModels(existingModels);

  // Tab列表配置
  const tabList = [
    ...(newModels.length > 0 ? [{
      tab: `${t('新获取的模型')} (${newModels.length})`,
      itemKey: 'new'
    }] : []),
    ...(existingModels.length > 0 ? [{
      tab: `${t('已有的模型')} (${existingModels.length})`,
      itemKey: 'existing'
    }] : [])
  ];

  // 处理分类全选/取消全选
  const handleCategorySelectAll = (categoryModels, isChecked) => {
    let newCheckedList = [...checkedList];

    if (isChecked) {
      // 全选：添加该分类下所有未选中的模型
      categoryModels.forEach(model => {
        if (!newCheckedList.includes(model)) {
          newCheckedList.push(model);
        }
      });
    } else {
      // 取消全选：移除该分类下所有已选中的模型
      newCheckedList = newCheckedList.filter(model => !categoryModels.includes(model));
    }

    setCheckedList(newCheckedList);
  };

  // 检查分类是否全选
  const isCategoryAllSelected = (categoryModels) => {
    return categoryModels.length > 0 && categoryModels.every(model => checkedList.includes(model));
  };

  // 检查分类是否部分选中
  const isCategoryIndeterminate = (categoryModels) => {
    const selectedCount = categoryModels.filter(model => checkedList.includes(model)).length;
    return selectedCount > 0 && selectedCount < categoryModels.length;
  };

  const renderModelsByCategory = (modelsByCategory, categoryKeyPrefix) => {
    const categoryEntries = Object.entries(modelsByCategory);
    if (categoryEntries.length === 0) return null;

    // 生成所有面板的key，确保都展开
    const allActiveKeys = categoryEntries.map((_, index) => `${categoryKeyPrefix}_${index}`);

    return (
      <Collapse key={`${categoryKeyPrefix}_${categoryEntries.length}`} defaultActiveKey={[]}>
        {categoryEntries.map(([key, categoryData], index) => (
          <Collapse.Panel
            key={`${categoryKeyPrefix}_${index}`}
            itemKey={`${categoryKeyPrefix}_${index}`}
            header={`${categoryData.label} (${categoryData.models.length})`}
            extra={
              <Checkbox
                checked={isCategoryAllSelected(categoryData.models)}
                indeterminate={isCategoryIndeterminate(categoryData.models)}
                onChange={(e) => {
                  e.stopPropagation(); // 防止触发面板折叠
                  handleCategorySelectAll(categoryData.models, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()} // 防止点击checkbox时折叠面板
              />
            }
          >
            <div className="flex items-center gap-2 mb-3">
              {categoryData.icon}
              <Typography.Text type="secondary" size="small">
                {t('已选择 {{selected}} / {{total}}', {
                  selected: categoryData.models.filter(model => checkedList.includes(model)).length,
                  total: categoryData.models.length
                })}
              </Typography.Text>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              {categoryData.models.map((model) => (
                <Checkbox key={model} value={model} className="my-1">
                  {model}
                </Checkbox>
              ))}
            </div>
          </Collapse.Panel>
        ))}
      </Collapse>
    );
  };

  return (
    <Modal
      header={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 py-4">
          <Typography.Title heading={5} className="m-0">
            {t('选择模型')}
          </Typography.Title>
          <div className="flex-shrink-0">
            <Tabs
              type="slash"
              size="small"
              tabList={tabList}
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key)}
            />
          </div>
        </div>
      }
      visible={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t('确定')}
      cancelText={t('取消')}
      size={isMobile ? 'full-width' : 'large'}
      closeOnEsc
      maskClosable
      centered
    >
      <Input
        prefix={<IconSearch size={14} />}
        placeholder={t('搜索模型')}
        value={keyword}
        onChange={(v) => setKeyword(v)}
        showClear
      />

      <Spin spinning={!models || models.length === 0}>
        <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
          {filteredModels.length === 0 ? (
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('暂无匹配模型')}
              style={{ padding: 30 }}
            />
          ) : (
            <Checkbox.Group value={checkedList} onChange={(vals) => setCheckedList(vals)}>
              {activeTab === 'new' && newModels.length > 0 && (
                <div>
                  {renderModelsByCategory(newModelsByCategory, 'new')}
                </div>
              )}
              {activeTab === 'existing' && existingModels.length > 0 && (
                <div>
                  {renderModelsByCategory(existingModelsByCategory, 'existing')}
                </div>
              )}
            </Checkbox.Group>
          )}
        </div>
      </Spin>

      <Typography.Text type="secondary" size="small" className="block text-right mt-4">
        <div className="flex items-center justify-end gap-2">
          {(() => {
            const currentModels = activeTab === 'new' ? newModels : existingModels;
            const currentSelected = currentModels.filter(model => checkedList.includes(model)).length;
            const isAllSelected = currentModels.length > 0 && currentSelected === currentModels.length;
            const isIndeterminate = currentSelected > 0 && currentSelected < currentModels.length;

            return (
              <>
                <span>
                  {t('已选择 {{selected}} / {{total}}', {
                    selected: currentSelected,
                    total: currentModels.length
                  })}
                </span>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(e) => {
                    handleCategorySelectAll(currentModels, e.target.checked);
                  }}
                />
              </>
            );
          })()}
        </div>
      </Typography.Text>
    </Modal>
  );
};

export default ModelSelectModal; 