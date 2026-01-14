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
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Collapse,
  Empty,
  Input,
  Modal,
  Radio,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { IconSearch } from '@douyinfe/semi-icons';
import { getModelCategories } from '../../../../helpers/render';

const SingleModelSelectModal = ({
  visible,
  models = [],
  selected = '',
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const normalizeModelName = (model) => String(model ?? '').trim();
  const normalizedModels = useMemo(() => {
    const list = Array.isArray(models) ? models : [];
    return Array.from(new Set(list.map(normalizeModelName).filter(Boolean)));
  }, [models]);

  const [keyword, setKeyword] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    if (visible) {
      setKeyword('');
      setSelectedModel(normalizeModelName(selected));
    }
  }, [visible, selected]);

  const filteredModels = useMemo(() => {
    const lower = keyword.trim().toLowerCase();
    if (!lower) return normalizedModels;
    return normalizedModels.filter((m) => m.toLowerCase().includes(lower));
  }, [normalizedModels, keyword]);

  const modelsByCategory = useMemo(() => {
    const categories = getModelCategories(t);
    const categorized = {};
    const uncategorized = [];

    filteredModels.forEach((model) => {
      let foundCategory = false;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: model })) {
          if (!categorized[key]) {
            categorized[key] = {
              label: category.label,
              icon: category.icon,
              models: [],
            };
          }
          categorized[key].models.push(model);
          foundCategory = true;
          break;
        }
      }
      if (!foundCategory) {
        uncategorized.push(model);
      }
    });

    if (uncategorized.length > 0) {
      categorized.other = {
        label: t('其他'),
        icon: null,
        models: uncategorized,
      };
    }

    return categorized;
  }, [filteredModels, t]);

  const categoryEntries = useMemo(
    () => Object.entries(modelsByCategory),
    [modelsByCategory],
  );

  return (
    <Modal
      header={
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 py-4'>
          <Typography.Title heading={5} className='m-0'>
            {t('选择模型')}
          </Typography.Title>
        </div>
      }
      visible={visible}
      onOk={() => onConfirm?.(selectedModel)}
      onCancel={onCancel}
      okText={t('确定')}
      cancelText={t('取消')}
      okButtonProps={{ disabled: !selectedModel }}
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

      <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
        {filteredModels.length === 0 ? (
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无匹配模型')}
            style={{ padding: 30 }}
          />
        ) : (
          <Radio.Group
            className='w-full'
            style={{ width: '100%' }}
            value={selectedModel}
            onChange={(val) => {
              const next = val && val.target ? val.target.value : val;
              setSelectedModel(next);
            }}
          >
            <Collapse
              className='w-full'
              style={{ width: '100%' }}
              defaultActiveKey={[]}
            >
              {categoryEntries.map(([key, categoryData], index) => (
                <Collapse.Panel
                  key={`${key}_${index}`}
                  itemKey={`${key}_${index}`}
                  header={
                    <span className='flex items-center gap-2'>
                      {categoryData.icon}
                      <span>
                        {categoryData.label} ({categoryData.models.length})
                      </span>
                    </span>
                  }
                >
                  <div className='grid grid-cols-2 gap-x-4'>
                    {categoryData.models.map((model) => (
                      <Radio key={model} value={model} className='my-1'>
                        {model}
                      </Radio>
                    ))}
                  </div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </Radio.Group>
        )}
      </div>
    </Modal>
  );
};

export default SingleModelSelectModal;
