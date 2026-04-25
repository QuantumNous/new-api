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
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { Search, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { getModelCategories } from '../../../../helpers/render';

function CategoryPanel({ categoryData, defaultOpen = false, selectedModel, onSelect }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className='overflow-hidden rounded-lg border border-[color:var(--app-border)]'>
      <button
        type='button'
        className='flex w-full items-center gap-2 bg-[color:var(--app-background)] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-slate-100 dark:hover:bg-slate-800'
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {categoryData.icon}
        <span>
          {categoryData.label} ({categoryData.models.length})
        </span>
      </button>
      {open ? (
        <div className='grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-2'>
          {categoryData.models.map((model) => {
            const checked = selectedModel === model;
            return (
              <label
                key={model}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                  checked
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-[color:var(--app-background)]'
                }`}
              >
                <input
                  type='radio'
                  name='single-model-select'
                  value={model}
                  checked={checked}
                  onChange={() => onSelect(model)}
                  className='h-3.5 w-3.5 accent-primary'
                />
                <span className='min-w-0 truncate'>{model}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const SingleModelSelectModal = ({
  visible,
  models = [],
  selected = '',
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

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

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='lg' placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              {t('选择模型')}
            </ModalHeader>
            <ModalBody className='space-y-3 px-6 py-5'>
              <div className='relative'>
                <Search
                  size={14}
                  className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                />
                <Input
                  type='text'
                  placeholder={t('搜索模型')}
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  aria-label={t('搜索模型')}
                  className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary'
                />
              </div>

              <div className='max-h-[400px] space-y-2 overflow-y-auto pr-1'>
                {filteredModels.length === 0 ? (
                  <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
                    <div className='flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'>
                      <Inbox size={28} />
                    </div>
                    <div>{t('暂无匹配模型')}</div>
                  </div>
                ) : (
                  categoryEntries.map(([key, categoryData], index) => (
                    <CategoryPanel
                      key={`${key}_${index}`}
                      categoryData={categoryData}
                      selectedModel={selectedModel}
                      onSelect={setSelectedModel}
                    />
                  ))
                )}
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button variant='light' onPress={onCancel}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                isDisabled={!selectedModel}
                onPress={() => onConfirm?.(selectedModel)}
              >
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default SingleModelSelectModal;
