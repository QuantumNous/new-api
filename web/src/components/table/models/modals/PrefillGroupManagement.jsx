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

import React, { useEffect, useState } from 'react';
import { Button, Card, Spinner } from '@heroui/react';
import { Inbox, Layers, Plus, X } from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  stringToColor,
} from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import CardTable from '../../../common/ui/CardTable';
import EditPrefillGroupModal from './EditPrefillGroupModal';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
import {
  renderLimitedItems,
  renderDescription,
} from '../../../common/ui/RenderUtils';

const PrefillGroupManagement = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editingGroup, setEditingGroup] = useState({ id: undefined });
  const [pendingDelete, setPendingDelete] = useState(null);

  const typeOptions = [
    { label: t('模型组'), value: 'model' },
    { label: t('标签组'), value: 'tag' },
    { label: t('端点组'), value: 'endpoint' },
  ];

  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/prefill_group');
      if (res.data?.success) {
        setGroups(res.data.data || []);
      } else {
        showError(res.data?.message || t('获取组列表失败'));
      }
    } catch (error) {
      showError(t('获取组列表失败'));
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (id) => {
    try {
      const res = await API.delete(`/api/prefill_group/${id}`);
      if (res.data?.success) {
        showSuccess(t('删除成功'));
        loadGroups();
      } else {
        showError(res.data?.message || t('删除失败'));
      }
    } catch (error) {
      showError(t('删除失败'));
    }
  };

  const handleEdit = (group = {}) => {
    setEditingGroup(group);
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => setEditingGroup({ id: undefined }), 300);
  };

  const handleEditSuccess = () => {
    closeEdit();
    loadGroups();
  };

  const renderItemTag = (text, key) => (
    <span
      key={key}
      className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
      style={{
        backgroundColor: `${stringToColor(text)}1A`,
        color: stringToColor(text),
      }}
    >
      {text}
    </span>
  );

  const columns = [
    {
      title: t('组名'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm font-semibold text-foreground'>{text}</span>
          <span className='inline-flex items-center rounded-full border border-[color:var(--app-border)] px-2 py-0.5 text-[11px] font-medium text-muted'>
            {typeOptions.find((opt) => opt.value === record.type)?.label ||
              record.type}
          </span>
        </div>
      ),
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      key: 'description',
      render: (text) => renderDescription(text, 150),
    },
    {
      title: t('项目内容'),
      dataIndex: 'items',
      key: 'items',
      render: (items, record) => {
        try {
          if (record.type === 'endpoint') {
            const obj =
              typeof items === 'string'
                ? JSON.parse(items || '{}')
                : items || {};
            const keys = Object.keys(obj);
            if (keys.length === 0) {
              return <span className='text-sm text-muted'>{t('暂无项目')}</span>;
            }
            return renderLimitedItems({
              items: keys,
              renderItem: (key, idx) => renderItemTag(key, idx),
              maxDisplay: 3,
            });
          }
          const itemsArray =
            typeof items === 'string' ? JSON.parse(items) : items;
          if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
            return <span className='text-sm text-muted'>{t('暂无项目')}</span>;
          }
          return renderLimitedItems({
            items: itemsArray,
            renderItem: (item, idx) => renderItemTag(item, idx),
            maxDisplay: 3,
          });
        } catch {
          return <span className='text-sm text-muted'>{t('数据格式错误')}</span>;
        }
      },
    },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <div className='flex items-center gap-2'>
          <Button size='sm' variant='flat' onPress={() => handleEdit(record)}>
            {t('编辑')}
          </Button>
          <Button
            size='sm'
            color='danger'
            variant='flat'
            onPress={() => setPendingDelete(record)}
          >
            {t('删除')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div
        aria-hidden={!visible}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!visible}
        style={{ width: isMobile ? '100%' : 800 }}
        className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-5 py-3'>
          <div className='flex items-center gap-2'>
            <span className='inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'>
              {t('管理')}
            </span>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {t('预填组管理')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('关闭')}
            onPress={onClose}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='flex-1 overflow-y-auto p-3'>
          <Card className='!rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div className='flex items-center gap-2'>
                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'>
                  <Layers size={16} />
                </div>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('组列表')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('管理模型、标签、端点等预填组')}
                  </div>
                </div>
              </div>

              <div className='flex justify-end'>
                <Button
                  color='primary'
                  size='sm'
                  startContent={<Plus size={14} />}
                  onPress={() => handleEdit()}
                >
                  {t('新建组')}
                </Button>
              </div>

              {loading ? (
                <div className='flex items-center justify-center py-10'>
                  <Spinner />
                </div>
              ) : groups.length > 0 ? (
                <CardTable
                  columns={columns}
                  dataSource={groups}
                  rowKey='id'
                  hidePagination={true}
                  size='small'
                  scroll={{ x: 'max-content' }}
                />
              ) : (
                <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
                    <Inbox size={28} />
                  </div>
                  <div>{t('暂无预填组')}</div>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      </aside>

      <EditPrefillGroupModal
        visible={showEdit}
        onClose={closeEdit}
        editingGroup={editingGroup}
        onSuccess={handleEditSuccess}
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title={t('确认删除')}
        cancelText={t('取消')}
        confirmText={t('删除')}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target?.id) deleteGroup(target.id);
        }}
      >
        {t('确定删除此组？')}
      </ConfirmDialog>
    </>
  );
};

export default PrefillGroupManagement;
