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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Checkbox,
  Empty,
  Input,
  Tabs,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { IconSearch } from '@douyinfe/semi-icons';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const normalizeModels = (models = []) =>
  Array.from(
    new Set(
      (models || []).map((model) => String(model || '').trim()).filter(Boolean),
    ),
  );

const filterByKeyword = (models = [], keyword = '') => {
  const normalizedKeyword = String(keyword || '')
    .trim()
    .toLowerCase();
  if (!normalizedKeyword) {
    return models;
  }
  return models.filter((model) =>
    String(model).toLowerCase().includes(normalizedKeyword),
  );
};

const ChannelUpstreamUpdateModal = ({
  visible,
  addModels = [],
  removeModels = [],
  preferredTab = 'add',
  confirmLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const normalizedAddModels = useMemo(
    () => normalizeModels(addModels),
    [addModels],
  );
  const normalizedRemoveModels = useMemo(
    () => normalizeModels(removeModels),
    [removeModels],
  );

  const [selectedAddModels, setSelectedAddModels] = useState([]);
  const [selectedRemoveModels, setSelectedRemoveModels] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('add');
  const [partialSubmitConfirmed, setPartialSubmitConfirmed] = useState(false);

  const addTabEnabled = normalizedAddModels.length > 0;
  const removeTabEnabled = normalizedRemoveModels.length > 0;
  const filteredAddModels = useMemo(
    () => filterByKeyword(normalizedAddModels, keyword),
    [normalizedAddModels, keyword],
  );
  const filteredRemoveModels = useMemo(
    () => filterByKeyword(normalizedRemoveModels, keyword),
    [normalizedRemoveModels, keyword],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedAddModels([]);
    setSelectedRemoveModels([]);
    setKeyword('');
    setPartialSubmitConfirmed(false);
    const normalizedPreferredTab = preferredTab === 'remove' ? 'remove' : 'add';
    if (normalizedPreferredTab === 'remove' && removeTabEnabled) {
      setActiveTab('remove');
      return;
    }
    if (normalizedPreferredTab === 'add' && addTabEnabled) {
      setActiveTab('add');
      return;
    }
    setActiveTab(addTabEnabled ? 'add' : 'remove');
  }, [visible, addTabEnabled, removeTabEnabled, preferredTab]);

  const currentModels =
    activeTab === 'add' ? filteredAddModels : filteredRemoveModels;
  const currentSelectedModels =
    activeTab === 'add' ? selectedAddModels : selectedRemoveModels;
  const currentSetSelectedModels =
    activeTab === 'add' ? setSelectedAddModels : setSelectedRemoveModels;
  const selectedAddCount = selectedAddModels.length;
  const selectedRemoveCount = selectedRemoveModels.length;
  const checkedCount = currentModels.filter((model) =>
    currentSelectedModels.includes(model),
  ).length;
  const isAllChecked =
    currentModels.length > 0 && checkedCount === currentModels.length;
  const isIndeterminate =
    checkedCount > 0 && checkedCount < currentModels.length;

  const handleToggleAllCurrent = (checked) => {
    if (checked) {
      const merged = normalizeModels([
        ...currentSelectedModels,
        ...currentModels,
      ]);
      currentSetSelectedModels(merged);
      return;
    }
    const currentSet = new Set(currentModels);
    currentSetSelectedModels(
      currentSelectedModels.filter((model) => !currentSet.has(model)),
    );
  };

  const tabList = [
    {
      itemKey: 'add',
      tab: `${t('新增模型')} (${selectedAddCount}/${normalizedAddModels.length})`,
      disabled: !addTabEnabled,
    },
    {
      itemKey: 'remove',
      tab: `${t('删除模型')} (${selectedRemoveCount}/${normalizedRemoveModels.length})`,
      disabled: !removeTabEnabled,
    },
  ];

  const submitSelectedChanges = () => {
    onConfirm?.({
      addModels: selectedAddModels,
      removeModels: selectedRemoveModels,
    });
  };

  const handleSubmit = () => {
    const hasAnySelected = selectedAddCount > 0 || selectedRemoveCount > 0;
    if (!hasAnySelected) {
      submitSelectedChanges();
      return;
    }

    const hasBothPending = addTabEnabled && removeTabEnabled;
    const hasUnselectedAdd = addTabEnabled && selectedAddCount === 0;
    const hasUnselectedRemove = removeTabEnabled && selectedRemoveCount === 0;
    if (hasBothPending && (hasUnselectedAdd || hasUnselectedRemove)) {
      if (partialSubmitConfirmed) {
        submitSelectedChanges();
        return;
      }
      const missingTab = hasUnselectedAdd ? 'add' : 'remove';
      const missingType = hasUnselectedAdd ? t('新增') : t('删除');
      const missingCount = hasUnselectedAdd
        ? normalizedAddModels.length
        : normalizedRemoveModels.length;
      setActiveTab(missingTab);
      Modal.confirm({
        title: t('仍有未处理项'),
        content: t(
          '你还没有处理{{type}}模型（{{count}}个）。是否仅提交当前已勾选内容？',
          {
            type: missingType,
            count: missingCount,
          },
        ),
        okText: t('仅提交已勾选'),
        cancelText: t('去处理{{type}}', { type: missingType }),
        centered: true,
        onOk: () => {
          setPartialSubmitConfirmed(true);
          submitSelectedChanges();
        },
      });
      return;
    }

    submitSelectedChanges();
  };

  return (
    <Modal
      visible={visible}
      title={t('处理上游模型更新')}
      okText={t('确定')}
      cancelText={t('取消')}
      size={isMobile ? 'full-width' : 'medium'}
      centered
      closeOnEsc
      maskClosable
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={handleSubmit}
    >
      <div className='flex flex-col gap-3'>
        <Typography.Text type='secondary' size='small'>
          {t(
            '可勾选需要执行的变更：新增会加入渠道模型列表，删除会从渠道模型列表移除。',
          )}
        </Typography.Text>

        <Tabs
          type='slash'
          size='small'
          tabList={tabList}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
        />
        <div className='flex items-center gap-3 text-xs text-gray-500'>
          <span>
            {t('新增已选 {{selected}} / {{total}}', {
              selected: selectedAddCount,
              total: normalizedAddModels.length,
            })}
          </span>
          <span>
            {t('删除已选 {{selected}} / {{total}}', {
              selected: selectedRemoveCount,
              total: normalizedRemoveModels.length,
            })}
          </span>
        </div>

        <Input
          prefix={<IconSearch size={14} />}
          placeholder={t('搜索模型')}
          value={keyword}
          onChange={(value) => setKeyword(value)}
          showClear
        />

        <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 8 }}>
          {currentModels.length === 0 ? (
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('暂无匹配模型')}
              style={{ padding: 24 }}
            />
          ) : (
            <Checkbox.Group
              value={currentSelectedModels}
              onChange={(values) =>
                currentSetSelectedModels(normalizeModels(values))
              }
            >
              <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4'>
                {currentModels.map((model) => (
                  <Checkbox
                    key={`${activeTab}:${model}`}
                    value={model}
                    className='my-1'
                  >
                    {model}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          )}
        </div>

        <div className='flex items-center justify-end gap-2'>
          <Typography.Text type='secondary' size='small'>
            {t('已选择 {{selected}} / {{total}}', {
              selected: checkedCount,
              total: currentModels.length,
            })}
          </Typography.Text>
          <Checkbox
            checked={isAllChecked}
            indeterminate={isIndeterminate}
            aria-label={t('全选当前列表模型')}
            onChange={(e) => handleToggleAllCurrent(e.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ChannelUpstreamUpdateModal;
