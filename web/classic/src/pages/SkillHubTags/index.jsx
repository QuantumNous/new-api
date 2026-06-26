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
import { Plus, RefreshCw, Search, Tag as TagIcon, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';

const SkillHubTags = () => {
  const [tags, setTags] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/admin/skill-hub/tags', {
        params: { keyword, page_size: 200 },
      });
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || '标签加载失败');
        return;
      }
      setTags(data?.items || []);
    } catch (error) {
      showError(error.message || '标签加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const createTag = async () => {
    const name = newName.trim();
    if (!name) {
      showError('请输入标签名称');
      return;
    }
    setSaving(true);
    try {
      const res = await API.post('/api/admin/skill-hub/tags', {
        name,
      });
      const { success, message } = res.data;
      if (!success) {
        showError(message || '标签创建失败');
        return;
      }
      showSuccess('标签已创建');
      setNewName('');
      await loadTags();
    } catch (error) {
      showError(error.message || '标签创建失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = (tag) => {
    if (tag.usageCount > 0) {
      showError('该标签仍被技能使用，不能删除');
      return;
    }
    Modal.confirm({
      title: '删除标签',
      content: (
        <div>
          <div>
            确认删除标签
            <span className='font-semibold'>「{tag.name}」</span>？
          </div>
          <div className='mt-2 text-sm text-semi-color-text-2'>
            删除后它会从标签库中移除，技能管理页也不能再选择这个标签。
          </div>
        </div>
      ),
      okText: '删除标签',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setSaving(true);
        try {
          const res = await API.delete(
            `/api/admin/skill-hub/tags/${encodeURIComponent(tag.name)}`,
          );
          const { success, message } = res.data;
          if (!success) {
            showError(message || '标签删除失败');
            return Promise.reject(new Error(message || '标签删除失败'));
          }
          showSuccess('标签已删除');
          await loadTags();
        } catch (error) {
          showError(error.message || '标签删除失败');
          return Promise.reject(error);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  return (
    <div className='px-4 py-6 pb-8'>
      <div className='mx-auto flex max-w-7xl flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <Typography.Title heading={3} className='!mb-1'>
              标签管理
            </Typography.Title>
            <Typography.Text type='tertiary'>
              维护技能广场的全局标签库，技能管理页只负责选择已有标签。
            </Typography.Text>
          </div>
          <Button
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={loadTags}
          >
            刷新
          </Button>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]'>
          <Card>
            <div className='mb-4'>
              <div className='text-base font-semibold text-semi-color-text-0'>
                新建标签
              </div>
              <div className='mt-1 text-sm text-semi-color-text-2'>
                新标签会出现在技能管理页的标签候选项中。
              </div>
            </div>
            <div className='flex flex-col gap-3'>
              <label className='flex flex-col gap-1 text-sm text-semi-color-text-1'>
                <span className='font-medium'>标签名称</span>
                <Input
                  value={newName}
                  maxLength={32}
                  placeholder='例如：办公协同'
                  onChange={setNewName}
                  onEnterPress={createTag}
                />
              </label>
              <Button
                type='primary'
                icon={<Plus size={16} />}
                loading={saving}
                onClick={createTag}
              >
                添加标签
              </Button>
            </div>
          </Card>

          <Card>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <div>
                <div className='text-base font-semibold text-semi-color-text-0'>
                  标签库
                </div>
                <div className='mt-1 text-sm text-semi-color-text-2'>
                  可搜索、查看使用数量，并删除未被使用的标签。
                </div>
              </div>
              <Space>
                <Input
                  prefix={<Search size={16} />}
                  value={keyword}
                  placeholder='搜索标签'
                  onChange={setKeyword}
                  onEnterPress={loadTags}
                />
                <Button onClick={loadTags}>搜索</Button>
              </Space>
            </div>

            <Spin spinning={loading}>
              <div className='overflow-hidden rounded border border-semi-color-border'>
                <div className='grid grid-cols-[minmax(140px,1fr)_120px_110px] gap-3 bg-semi-color-fill-0 px-3 py-2 text-xs font-medium text-semi-color-text-2'>
                  <span>标签</span>
                  <span>使用数量</span>
                  <span className='text-right'>操作</span>
                </div>
                <div className='divide-y divide-semi-color-border'>
                  {tags.map((tag) => (
                    <div
                      key={tag.id || tag.name}
                      className='grid grid-cols-[minmax(140px,1fr)_120px_110px] items-center gap-3 px-3 py-3 text-sm'
                    >
                      <div className='flex min-w-0 items-center gap-2'>
                        <TagIcon
                          size={15}
                          className='shrink-0 text-semi-color-text-2'
                        />
                        <span className='truncate font-medium'>{tag.name}</span>
                      </div>
                      <Tag color={tag.usageCount > 0 ? 'blue' : 'grey'}>
                        {tag.usageCount} 个技能
                      </Tag>
                      <div className='flex justify-end'>
                        <Button
                          theme='borderless'
                          type='danger'
                          icon={<Trash2 size={16} />}
                          disabled={saving || tag.usageCount > 0}
                          onClick={() => deleteTag(tag)}
                        />
                      </div>
                    </div>
                  ))}
                  {tags.length === 0 && (
                    <div className='px-3 py-8 text-center text-sm text-semi-color-text-2'>
                      {loading ? '加载中...' : '暂无标签'}
                    </div>
                  )}
                </div>
              </div>
            </Spin>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SkillHubTags;
