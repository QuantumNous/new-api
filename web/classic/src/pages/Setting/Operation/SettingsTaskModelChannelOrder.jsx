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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconChevronDown,
  IconChevronUp,
  IconMenu,
  IconDelete,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess, showWarning } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

function parseOrderMap(raw) {
  if (!raw || raw === '{}') return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out = {};
    for (const [model, ids] of Object.entries(parsed)) {
      if (!Array.isArray(ids)) continue;
      out[model] = ids
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0);
    }
    return out;
  } catch {
    return {};
  }
}

function channelSupportsModel(channel, modelName) {
  if (!channel || !modelName) return false;
  const models = String(channel.models || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const target = modelName.trim().toLowerCase();
  return models.some((m) => m.toLowerCase() === target);
}

async function fetchAllEnabledChannels() {
  const pageSize = 100;
  let page = 1;
  const all = [];
  for (;;) {
    const res = await API.get(
      `/api/channel/?p=${page}&page_size=${pageSize}&id_sort=true&tag_mode=false&status=1`,
    );
    const { success, message, data } = res.data || {};
    if (!success) {
      throw new Error(message || 'load channels failed');
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    all.push(...items.filter((ch) => ch && ch.id));
    if (items.length < pageSize) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

export default function SettingsTaskModelChannelOrder(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState([]);
  const [orderMap, setOrderMap] = useState({});
  const [selectedModel, setSelectedModel] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllEnabledChannels();
      setChannels(list);
    } catch (e) {
      showError(t('加载渠道失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    const map = parseOrderMap(props.options?.TaskModelChannelOrder);
    setOrderMap(map);
    const models = Object.keys(map);
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0]);
      setModelInput(models[0]);
    }
  }, [props.options?.TaskModelChannelOrder]);

  const configuredModels = useMemo(
    () => Object.keys(orderMap).sort(),
    [orderMap],
  );

  const orderedIds = orderMap[selectedModel] || [];

  const channelById = useMemo(() => {
    const m = new Map();
    for (const ch of channels) {
      m.set(ch.id, ch);
    }
    return m;
  }, [channels]);

  const orderedChannels = useMemo(() => {
    return orderedIds
      .map((id) => {
        const ch = channelById.get(id);
        return ch
          ? { id, channel: ch, missing: false }
          : { id, channel: null, missing: true };
      })
      .filter(Boolean);
  }, [orderedIds, channelById]);

  const availableToAdd = useMemo(() => {
    if (!selectedModel) return [];
    const used = new Set(orderedIds);
    return channels.filter(
      (ch) =>
        !used.has(ch.id) && channelSupportsModel(ch, selectedModel),
    );
  }, [channels, orderedIds, selectedModel]);

  const setModelOrder = (model, ids) => {
    setOrderMap((prev) => {
      const next = { ...prev };
      if (!ids || ids.length === 0) {
        delete next[model];
      } else {
        next[model] = ids;
      }
      return next;
    });
  };

  const ensureModel = () => {
    const name = (modelInput || selectedModel || '').trim();
    if (!name) {
      showWarning(t('请先输入模型名称'));
      return '';
    }
    setSelectedModel(name);
    setModelInput(name);
    if (!orderMap[name]) {
      setOrderMap((prev) => ({ ...prev, [name]: prev[name] || [] }));
    }
    return name;
  };

  const moveItem = (fromIndex, toIndex) => {
    if (!selectedModel) return;
    if (toIndex < 0 || toIndex >= orderedIds.length) return;
    const next = [...orderedIds];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setModelOrder(selectedModel, next);
  };

  const removeItem = (id) => {
    if (!selectedModel) return;
    setModelOrder(
      selectedModel,
      orderedIds.filter((x) => x !== id),
    );
  };

  const addChannel = (id) => {
    const model = ensureModel();
    if (!model) return;
    const numId = parseInt(id, 10);
    if (!Number.isInteger(numId)) return;
    const current = orderMap[model] || [];
    if (current.includes(numId)) return;
    setModelOrder(model, [...current, numId]);
  };

  const onDragStart = (id) => (e) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const onDragOver = (id) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };

  const onDrop = (targetId) => (e) => {
    e.preventDefault();
    const fromId = parseInt(
      e.dataTransfer.getData('text/plain') || draggedId,
      10,
    );
    setDraggedId(null);
    setDragOverId(null);
    if (!Number.isInteger(fromId) || fromId === targetId || !selectedModel) {
      return;
    }
    const fromIndex = orderedIds.indexOf(fromId);
    const toIndex = orderedIds.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    moveItem(fromIndex, toIndex);
  };

  const onDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const onSave = async () => {
    const payload = {};
    for (const [model, ids] of Object.entries(orderMap)) {
      if (Array.isArray(ids) && ids.length > 0) {
        payload[model] = ids;
      }
    }
    const value = JSON.stringify(payload);
    const prev = props.options?.TaskModelChannelOrder || '{}';
    if (value === prev || (value === '{}' && (!prev || prev === '{}'))) {
      return showWarning(t('你似乎并没有修改什么'));
    }
    setSaving(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'TaskModelChannelOrder',
        value,
      });
      if (res?.data?.success === false) {
        showError(res.data.message || t('保存失败'));
        return;
      }
      showSuccess(t('保存成功'));
      props.refresh?.();
    } catch {
      showError(t('保存失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  const clearModelOrder = () => {
    if (!selectedModel) return;
    setModelOrder(selectedModel, []);
  };

  return (
    <Spin spinning={loading || saving}>
      <Title heading={6} style={{ marginBottom: 8 }}>
        {t('异步任务模型渠道顺序')}
      </Title>
      <Text type='tertiary' style={{ display: 'block', marginBottom: 16 }}>
        {t(
          '为指定模型配置渠道尝试顺序（可拖拽排序）。留空则按渠道 Priority。上方「异步任务跨渠容灾」需开启。',
        )}
      </Text>

      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          value={modelInput}
          placeholder={t('模型名称，例如 seedance2')}
          style={{ width: 260 }}
          onChange={(v) => setModelInput(v)}
          onEnterPress={() => ensureModel()}
        />
        <Button onClick={() => ensureModel()}>{t('编辑该模型')}</Button>
        {configuredModels.length > 0 && (
          <Select
            placeholder={t('已配置的模型')}
            style={{ width: 220 }}
            value={selectedModel || undefined}
            onChange={(v) => {
              setSelectedModel(v);
              setModelInput(v);
            }}
            optionList={configuredModels.map((m) => ({
              label: m,
              value: m,
            }))}
          />
        )}
      </Space>

      {!selectedModel ? (
        <Empty description={t('输入模型名后开始配置渠道顺序')} />
      ) : (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Text strong>
              {t('当前模型')}：{selectedModel}
            </Text>
            <Button type='danger' theme='borderless' onClick={clearModelOrder}>
              {t('清空该模型顺序')}
            </Button>
          </Space>

          <div
            style={{
              border: '1px solid var(--semi-color-border)',
              borderRadius: 8,
              padding: 8,
              marginBottom: 12,
              minHeight: 80,
            }}
          >
            {orderedChannels.length === 0 ? (
              <Empty description={t('尚未添加渠道，请从下方列表添加')} />
            ) : (
              orderedChannels.map((row, index) => {
                const isDragging = draggedId === row.id;
                const isOver = dragOverId === row.id && draggedId !== row.id;
                return (
                  <div
                    key={row.id}
                    draggable
                    onDragStart={onDragStart(row.id)}
                    onDragOver={onDragOver(row.id)}
                    onDrop={onDrop(row.id)}
                    onDragEnd={onDragEnd}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      marginBottom: 6,
                      borderRadius: 6,
                      background: isOver
                        ? 'var(--semi-color-primary-light-default)'
                        : 'var(--semi-color-fill-0)',
                      opacity: isDragging ? 0.5 : 1,
                      cursor: 'grab',
                      border: isOver
                        ? '1px dashed var(--semi-color-primary)'
                        : '1px solid transparent',
                    }}
                  >
                    <IconMenu style={{ color: 'var(--semi-color-text-2)' }} />
                    <Tag color='blue' style={{ minWidth: 36 }}>
                      #{index + 1}
                    </Tag>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {row.missing ? (
                        <Text type='danger'>
                          {t('渠道')} #{row.id}（{t('不存在或已禁用')}）
                        </Text>
                      ) : (
                        <>
                          <Text strong>
                            {row.channel.name}{' '}
                            <Text type='tertiary'>#{row.id}</Text>
                          </Text>
                          <div>
                            <Text type='tertiary' size='small'>
                              Priority: {row.channel.priority ?? 0}
                            </Text>
                          </div>
                        </>
                      )}
                    </div>
                    <Button
                      icon={<IconChevronUp />}
                      size='small'
                      theme='borderless'
                      disabled={index === 0}
                      onClick={() => moveItem(index, index - 1)}
                    />
                    <Button
                      icon={<IconChevronDown />}
                      size='small'
                      theme='borderless'
                      disabled={index === orderedChannels.length - 1}
                      onClick={() => moveItem(index, index + 1)}
                    />
                    <Button
                      icon={<IconDelete />}
                      size='small'
                      theme='borderless'
                      type='danger'
                      onClick={() => removeItem(row.id)}
                    />
                  </div>
                );
              })
            )}
          </div>

          <Space align='start' style={{ marginBottom: 16 }}>
            <Select
              filter
              placeholder={t('添加支持该模型的渠道')}
              style={{ width: 360 }}
              disabled={availableToAdd.length === 0}
              onChange={addChannel}
              value={undefined}
              optionList={availableToAdd.map((ch) => ({
                value: ch.id,
                label: `${ch.name} (#${ch.id})`,
              }))}
              emptyContent={
                <Text type='tertiary'>
                  {t('没有更多支持该模型的已启用渠道')}
                </Text>
              }
            />
          </Space>
        </>
      )}

      <Button type='primary' onClick={onSave} loading={saving}>
        {t('保存渠道顺序')}
      </Button>
    </Spin>
  );
}
