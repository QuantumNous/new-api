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

import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconHandle,
} from '@douyinfe/semi-icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { API, showError, showSuccess } from '../../../helpers';
import { migrateOldFormatToItems } from '../../../helpers/navMigration';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';

const { Text } = Typography;
const MAX_CUSTOM_ITEMS = 10;

const DEFAULT_ITEMS = [
  { key: 'home', enabled: true },
  { key: 'console', enabled: true },
  { key: 'pricing', enabled: true, requireAuth: false },
  { key: 'docs', enabled: true },
  { key: 'about', enabled: true },
];

function getBuiltInMeta(key, t) {
  const meta = {
    home: { title: t('首页'), description: t('用户主页，展示系统信息') },
    console: {
      title: t('控制台'),
      description: t('用户控制面板，管理账户'),
    },
    pricing: {
      title: t('模型广场'),
      description: t('模型定价，需要登录访问'),
    },
    docs: { title: t('文档'), description: t('系统文档和帮助信息') },
    about: { title: t('关于'), description: t('关于系统的详细信息') },
  };
  return meta[key] || { title: key, description: '' };
}

function getItemId(item) {
  return item.key || item.id;
}

function SortableItem({ item, t, onToggle, onTogglePricingAuth, onEdit, onDelete }) {
  const isBuiltIn = !!item.key;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: getItemId(item) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderRadius: '8px',
    border: '1px solid var(--semi-color-border)',
    background: 'var(--semi-color-bg-1)',
    marginBottom: '8px',
    padding: '12px 16px',
  };

  const meta = isBuiltIn ? getBuiltInMeta(item.key, t) : null;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            touchAction: 'none',
            color: 'var(--semi-color-text-2)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <IconHandle size='large' />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontWeight: '600',
                fontSize: '14px',
                color: 'var(--semi-color-text-0)',
              }}
            >
              {isBuiltIn ? meta.title : item.label}
            </span>
            {isBuiltIn ? (
              <Tag size='small' color='light-blue'>
                {t('内置')}
              </Tag>
            ) : (
              <Tag size='small' color={item.isExternal ? 'blue' : 'green'}>
                {item.isExternal ? t('外部链接') : t('内部路径')}
              </Tag>
            )}
          </div>
          <Text
            type='tertiary'
            size='small'
            style={{
              fontSize: '12px',
              lineHeight: '1.4',
              display: 'block',
              marginTop: '2px',
            }}
            ellipsis={{ showTooltip: true }}
          >
            {isBuiltIn ? meta.description : item.url}
          </Text>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {isBuiltIn ? (
            <Switch
              checked={item.enabled}
              onChange={(checked) => onToggle(getItemId(item), checked)}
              size='default'
            />
          ) : (
            <>
              <Button
                icon={<IconEdit />}
                size='small'
                type='tertiary'
                aria-label={t('编辑') + ' ' + (item.label || '')}
                onClick={() => onEdit(item)}
              />
              <Button
                icon={<IconDelete />}
                size='small'
                type='danger'
                aria-label={t('删除') + ' ' + (item.label || '')}
                onClick={() => onDelete(item.id)}
              />
            </>
          )}
        </div>
      </div>

      {item.key === 'pricing' && item.enabled && (
        <div
          style={{
            borderTop: '1px solid var(--semi-color-border)',
            marginTop: '10px',
            paddingTop: '10px',
            marginLeft: '36px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div
                style={{
                  fontWeight: '500',
                  fontSize: '12px',
                  color: 'var(--semi-color-text-1)',
                  marginBottom: '2px',
                }}
              >
                {t('需要登录访问')}
              </div>
              <Text
                type='secondary'
                size='small'
                style={{
                  fontSize: '11px',
                  color: 'var(--semi-color-text-2)',
                  lineHeight: '1.4',
                  display: 'block',
                }}
              >
                {t('开启后未登录用户无法访问模型广场')}
              </Text>
            </div>
            <Switch
              checked={item.requireAuth || false}
              onChange={(checked) => onTogglePricingAuth(checked)}
              size='default'
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsHeaderNavModules(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [items, setItems] = useState(DEFAULT_ITEMS);

  // Modal state for custom item editing
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const customItemCount = items.filter((it) => !it.key).length;

  const handleToggle = useCallback((id, checked) => {
    setItems((prev) =>
      prev.map((it) =>
        getItemId(it) === id ? { ...it, enabled: checked } : it,
      ),
    );
  }, []);

  const handleTogglePricingAuth = useCallback((checked) => {
    setItems((prev) =>
      prev.map((it) =>
        it.key === 'pricing' ? { ...it, requireAuth: checked } : it,
      ),
    );
  }, []);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((it) => getItemId(it) === active.id);
        const newIndex = prev.findIndex((it) => getItemId(it) === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function resetCustomItemForm() {
    setFormLabel('');
    setFormUrl('');
    setFormOpenInNewTab(true);
    setEditingItem(null);
  }

  function openAddModal() {
    if (customItemCount >= MAX_CUSTOM_ITEMS) {
      showError(
        t('最多添加 {{max}} 个自定义导航项', { max: MAX_CUSTOM_ITEMS }),
      );
      return;
    }
    resetCustomItemForm();
    setModalVisible(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormLabel(item.label);
    setFormUrl(item.url);
    setFormOpenInNewTab(item.openInNewTab);
    setModalVisible(true);
  }

  function handleModalOk() {
    if (!formLabel.trim() || !formUrl.trim()) {
      showError(t('请填写完整信息'));
      return;
    }
    let normalizedUrl = formUrl.trim();
    const isExternal =
      normalizedUrl.startsWith('http://') ||
      normalizedUrl.startsWith('https://');
    if (!isExternal && !normalizedUrl.startsWith('/')) {
      normalizedUrl = '/' + normalizedUrl;
    }

    if (editingItem) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItem.id
            ? {
                ...it,
                label: formLabel.trim(),
                url: normalizedUrl,
                isExternal,
                openInNewTab: isExternal ? formOpenInNewTab : false,
              }
            : it,
        ),
      );
    } else {
      const newItem = {
        id: 'custom-' + Date.now(),
        label: formLabel.trim(),
        url: normalizedUrl,
        isExternal,
        openInNewTab: isExternal ? formOpenInNewTab : false,
      };
      setItems((prev) => [...prev, newItem]);
    }
    setModalVisible(false);
    resetCustomItemForm();
  }

  function deleteCustomItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function resetToDefault() {
    setItems(DEFAULT_ITEMS);
    showSuccess(t('已重置为默认配置'));
  }

  async function onSubmit() {
    setLoading(true);
    try {
      const configToSave = { items };
      const res = await API.put('/api/option/', {
        key: 'HeaderNavModules',
        value: JSON.stringify(configToSave),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            HeaderNavModules: JSON.stringify(configToSave),
          },
        });
        if (props.refresh) {
          await props.refresh();
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (props.options && props.options.HeaderNavModules) {
      try {
        const parsed = JSON.parse(props.options.HeaderNavModules);
        if (Array.isArray(parsed.items)) {
          setItems(parsed.items);
        } else {
          setItems(migrateOldFormatToItems(parsed));
        }
      } catch (error) {
        setItems(DEFAULT_ITEMS);
      }
    }
  }, [props.options]);

  return (
    <Card>
      <Form.Section
        text={t('顶栏管理')}
        extraText={t('控制顶栏导航项的显示和排序，全局生效')}
      >
        <Text
          type='tertiary'
          size='small'
          style={{ display: 'block', marginBottom: '12px' }}
        >
          {t('拖拽可调整顺序')}
        </Text>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(getItemId)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <SortableItem
                key={getItemId(item)}
                item={item}
                t={t}
                onToggle={handleToggle}
                onTogglePricingAuth={handleTogglePricingAuth}
                onEdit={openEditModal}
                onDelete={deleteCustomItem}
              />
            ))}
          </SortableContext>
        </DndContext>

        <Button
          icon={<IconPlus />}
          onClick={openAddModal}
          style={{ marginTop: '4px' }}
          disabled={customItemCount >= MAX_CUSTOM_ITEMS}
        >
          {t('添加导航项')}
        </Button>
        {customItemCount >= MAX_CUSTOM_ITEMS && (
          <Text
            type='tertiary'
            size='small'
            style={{ marginLeft: '12px' }}
          >
            {t('最多添加 {{max}} 个自定义导航项', {
              max: MAX_CUSTOM_ITEMS,
            })}
          </Text>
        )}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: '16px',
            marginTop: '16px',
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Button
            size='default'
            type='tertiary'
            onClick={resetToDefault}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
            }}
          >
            {t('重置为默认')}
          </Button>
          <Button
            size='default'
            type='primary'
            onClick={onSubmit}
            loading={loading}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
              minWidth: '100px',
            }}
          >
            {t('保存设置')}
          </Button>
        </div>
      </Form.Section>

      <Modal
        title={editingItem ? t('编辑导航项') : t('添加导航项')}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          resetCustomItemForm();
        }}
        maskClosable={false}
      >
        <Form layout='vertical'>
          <Form.Slot label={t('名称')}>
            <Input
              value={formLabel}
              onChange={setFormLabel}
              placeholder={t('名称')}
            />
          </Form.Slot>
          <Form.Slot label={t('链接地址')}>
            <Input
              value={formUrl}
              onChange={setFormUrl}
              placeholder={t('链接示例: https://example.com 或 /path')}
            />
          </Form.Slot>
          {(formUrl.trim().startsWith('http://') ||
            formUrl.trim().startsWith('https://')) && (
            <Form.Slot label={t('在新标签页打开')}>
              <Switch
                checked={formOpenInNewTab}
                onChange={setFormOpenInNewTab}
              />
            </Form.Slot>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
