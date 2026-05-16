import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Checkbox,
  Typography,
  Popconfirm,
  Tag,
  Select,
  Spin,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconHandle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

const PRESET_CATEGORIES = ['OpenAI', 'Claude', 'Google', '国产', '图片', '其他'];

function SortableRow({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners })}
    </tr>
  );
}

export default function GroupTable({ userOverrideCounts, onGroupNamesChange }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  // Always holds the latest groups so onBlur callbacks don't capture stale closures
  const groupsRef = useRef([]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  const saveTimers = useRef({});
  useEffect(() => {
    return () => { Object.values(saveTimers.current).forEach(clearTimeout); };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/group/all');
      if (res.data.success) {
        setGroups(res.data.data || []);
      }
    } catch (e) {
      showError(t('获取分组失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (onGroupNamesChange) {
      onGroupNamesChange(groups.map((g) => g.name));
    }
  }, [groups, onGroupNamesChange]);

  const categoryOptions = useMemo(() => {
    const existing = groups.map((g) => g.category).filter(Boolean);
    const all = new Set([...PRESET_CATEGORIES, ...existing]);
    return Array.from(all).map((c) => ({ value: c, label: c }));
  }, [groups]);

  const updateLocal = useCallback((group, field, value) => {
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, [field]: value } : g)));
  }, []);

  const saveGroup = useCallback((groupId) => {
    clearTimeout(saveTimers.current[groupId]);
    saveTimers.current[groupId] = setTimeout(async () => {
      const latest = groupsRef.current.find((g) => g.id === groupId);
      if (!latest) return;
      try {
        const res = await API.put(`/api/group/${latest.id}`, latest);
        if (!res.data.success) {
          showError(res.data.message);
          fetchGroups();
        }
      } catch {
        fetchGroups();
      }
    }, 300);
  }, [fetchGroups]);

  const updateFieldImmediate = useCallback(async (group, field, value) => {
    const updated = { ...group, [field]: value };
    setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
    try {
      const res = await API.put(`/api/group/${group.id}`, updated);
      if (!res.data.success) {
        showError(res.data.message);
        fetchGroups();
      }
    } catch {
      fetchGroups();
    }
  }, [fetchGroups]);

  const addGroup = useCallback(async () => {
    const existingNames = new Set(groups.map((g) => g.name));
    let counter = 1;
    let newName = `group_${counter}`;
    while (existingNames.has(newName)) {
      counter++;
      newName = `group_${counter}`;
    }
    const newGroup = {
      name: newName,
      ratio: 1,
      sort_order: groups.length,
      category: '',
      user_selectable: true,
      description: '',
    };
    try {
      const res = await API.post('/api/group/', newGroup);
      if (res.data.success) {
        setGroups((prev) => [...prev, res.data.data]);
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('添加分组失败'));
    }
  }, [groups, t]);

  const removeGroup = useCallback(async (id) => {
    try {
      const res = await API.delete(`/api/group/${id}`);
      if (res.data.success) {
        setGroups((prev) => prev.filter((g) => g.id !== id));
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('删除分组失败'));
    }
  }, [t]);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = groupsRef.current;
    const oldIndex = current.findIndex((g) => g.id === active.id);
    const newIndex = current.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(current, oldIndex, newIndex).map((g, idx) => ({ ...g, sort_order: idx }));
    setGroups(reordered);
    const orders = reordered.map((g, idx) => ({ id: g.id, sort_order: idx }));
    try {
      await API.put('/api/group/sort', orders);
    } catch {
      fetchGroups();
    }
  }, [fetchGroups]);

  return (
    <Spin spinning={loading}>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm' style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className='border-b' style={{ borderColor: 'var(--semi-color-border)' }}>
              <th style={{ width: 30, padding: '8px 4px' }}></th>
              <th style={{ width: 150, padding: '8px', textAlign: 'left' }}>{t('分组名称')}</th>
              <th style={{ width: 100, padding: '8px', textAlign: 'left' }}>{t('倍率')}</th>
              <th style={{ width: 120, padding: '8px', textAlign: 'left' }}>{t('分类')}</th>
              <th style={{ width: 70, padding: '8px', textAlign: 'center' }}>{t('用户可选')}</th>
              <th style={{ padding: '8px', textAlign: 'left' }}>{t('描述')}</th>
              <th style={{ width: 80, padding: '8px', textAlign: 'center' }}>{t('独立倍率')}</th>
              <th style={{ width: 50, padding: '8px' }}></th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {groups.map((group) => (
                  <SortableRow key={group.id} id={group.id}>
                    {({ listeners }) => (
                      <>
                        <td style={{ padding: '6px 4px', cursor: 'grab' }} {...listeners}>
                          <IconHandle size='small' style={{ color: 'var(--semi-color-text-2)' }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <Input
                            size='small'
                            value={group.name}
                            onChange={(v) => updateLocal(group, 'name', v)}
                            onBlur={() => saveGroup(group.id)}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <InputNumber
                            size='small'
                            min={0}
                            step={0.1}
                            value={group.ratio}
                            style={{ width: '100%' }}
                            onChange={(v) => updateLocal(group, 'ratio', v ?? 0)}
                            onBlur={() => saveGroup(group.id)}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <Select
                            size='small'
                            value={group.category || undefined}
                            placeholder={t('选择分类')}
                            optionList={categoryOptions}
                            onChange={(v) => updateFieldImmediate(group, 'category', v || '')}
                            allowCreate
                            filter
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <Checkbox
                            checked={group.user_selectable}
                            onChange={(e) => updateFieldImmediate(group, 'user_selectable', e.target.checked)}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          {group.user_selectable ? (
                            <Input
                              size='small'
                              value={group.description}
                              placeholder={t('分组描述')}
                              onChange={(v) => updateLocal(group, 'description', v)}
                              onBlur={() => saveGroup(group.id)}
                            />
                          ) : (
                            <Text type='tertiary' size='small'>-</Text>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          {(userOverrideCounts?.[group.name] || 0) > 0 ? (
                            <Tag color='blue' size='small'>
                              {userOverrideCounts[group.name]} {t('人')}
                            </Tag>
                          ) : (
                            <Text type='tertiary' size='small'>-</Text>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <Popconfirm
                            title={t('确认删除该分组？')}
                            onConfirm={() => removeGroup(group.id)}
                            position='left'
                          >
                            <Button
                              icon={<IconDelete />}
                              type='danger'
                              theme='borderless'
                              size='small'
                            />
                          </Popconfirm>
                        </td>
                      </>
                    )}
                  </SortableRow>
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
        {groups.length === 0 && !loading && (
          <div className='py-4 text-center'>
            <Text type='tertiary'>{t('暂无分组，点击下方按钮添加')}</Text>
          </div>
        )}
      </div>
      <div className='mt-3 flex justify-center'>
        <Button icon={<IconPlus />} theme='outline' onClick={addGroup}>
          {t('添加分组')}
        </Button>
      </div>
    </Spin>
  );
}
