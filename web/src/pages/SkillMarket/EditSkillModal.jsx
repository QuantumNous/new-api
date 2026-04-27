import React from 'react';
import {
  Button,
  Input,
  InputNumber,
  SideSheet,
  Space,
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';

const EditSkillModal = ({
  visible,
  editingSkill,
  setEditingSkill,
  editLoading,
  editError,
  saving,
  onCancel,
  onSubmit,
  statusLoadingMap,
  updateSkillStatus,
  getPreviewUrl,
  matchedEditSkill,
  skillsCount,
  categoryPresets,
  getMylclawNavLabel,
}) => (
  <SideSheet
    placement='right'
    visible={visible}
    width={720}
    closeIcon={null}
    onCancel={onCancel}
    title={
      <Space>
        <Tag color={editingSkill?.id ? 'blue' : 'green'} shape='circle'>
          {editingSkill?.id ? '编辑' : '新增'}
        </Tag>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {editingSkill?.id ? `设置技能 #${editingSkill.id}` : '新增技能'}
        </Typography.Title>
      </Space>
    }
    footer={
      <div className='flex justify-end bg-white'>
        <Space>
          <Button theme='solid' loading={saving} onClick={onSubmit}>
            保存
          </Button>
          <Button theme='light' type='primary' onClick={onCancel}>
            取消
          </Button>
        </Space>
      </div>
    }
    bodyStyle={{ padding: 0 }}
  >
    <div className='space-y-4 p-4'>
      <div className='rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
        <div>调试面板（模型管理同款 SideSheet 版）</div>
        <div>
          {`visible=${visible ? 'yes' : 'no'} | listCount=${skillsCount} | matched=${
            matchedEditSkill ? 'yes' : 'no'
          } | formId=${editingSkill?.id ?? ''} | formName=${editingSkill?.name || ''}`}
        </div>
      </div>

      <div className='rounded-lg border border-dashed border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] px-3 py-2 text-xs text-gray-500'>
        build=skill-market-sidesheet-v1
      </div>

      {editError ? (
        <div className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600'>
          当前展示的是列表缓存数据：{editError}
        </div>
      ) : null}

      {editLoading ? (
        <div className='py-8 text-center text-sm text-gray-500'>正在加载技能详情...</div>
      ) : null}

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div>
          <div className='mb-2 text-sm font-medium'>原始名称</div>
          <Input
            value={editingSkill.name}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, name: value }))}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>分类</div>
          <Input
            value={editingSkill.category}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, category: value }))}
          />
          <div className='mt-2'>
            <div className='mb-1 text-xs text-gray-500'>导航分类快捷选择</div>
            <select
              className='w-full rounded-md border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] px-3 py-2 text-sm'
              value={editingSkill.category || ''}
              disabled={editLoading}
              onChange={(event) =>
                setEditingSkill((prev) => ({ ...prev, category: event.target.value }))
              }
            >
              <option value=''>请选择分类</option>
              {categoryPresets.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className='mt-2 text-xs text-gray-500'>
            当前会显示到 myclaw 导航：{getMylclawNavLabel(editingSkill.category)}
          </div>
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>展示名</div>
          <Input
            value={editingSkill.display_name}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, display_name: value }))}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>中文别名</div>
          <Input
            value={editingSkill.display_name_zh}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, display_name_zh: value }))}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>作者</div>
          <Input
            value={editingSkill.author}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, author: value }))}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>版本</div>
          <Input
            value={editingSkill.version}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, version: value }))}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>来源平台</div>
          <Input
            value={editingSkill.source_platform}
            disabled={editLoading}
            onChange={(value) =>
              setEditingSkill((prev) => ({ ...prev, source_platform: value }))
            }
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>来源 slug</div>
          <Input
            value={editingSkill.source_slug}
            disabled={editLoading}
            onChange={(value) => setEditingSkill((prev) => ({ ...prev, source_slug: value }))}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>排序</div>
          <InputNumber
            value={editingSkill.sort_order}
            disabled={editLoading}
            onChange={(value) =>
              setEditingSkill((prev) => ({ ...prev, sort_order: Number(value) || 0 }))
            }
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div className='mb-2 text-sm font-medium'>下载量</div>
          <InputNumber
            value={editingSkill.downloads}
            disabled={editLoading}
            onChange={(value) =>
              setEditingSkill((prev) => ({ ...prev, downloads: Number(value) || 0 }))
            }
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div>
        <div className='mb-2 text-sm font-medium'>标签</div>
        <Input
          placeholder='多个标签用英文逗号分隔'
          value={editingSkill.tags_text}
          disabled={editLoading}
          onChange={(value) => setEditingSkill((prev) => ({ ...prev, tags_text: value }))}
        />
      </div>
      <div>
        <div className='mb-2 text-sm font-medium'>详情地址</div>
        <Input
          value={editingSkill.url}
          disabled={editLoading}
          onChange={(value) => setEditingSkill((prev) => ({ ...prev, url: value }))}
        />
      </div>
      <div>
        <div className='mb-2 text-sm font-medium'>下载地址</div>
        <Input
          value={editingSkill.download_url}
          disabled={editLoading}
          onChange={(value) => setEditingSkill((prev) => ({ ...prev, download_url: value }))}
        />
      </div>
      <div>
        <div className='mb-2 text-sm font-medium'>描述</div>
        <Input.TextArea
          rows={4}
          value={editingSkill.description}
          disabled={editLoading}
          onChange={(value) => setEditingSkill((prev) => ({ ...prev, description: value }))}
        />
      </div>
      <div>
        <div className='mb-2 text-sm font-medium'>中文描述</div>
        <Input.TextArea
          rows={4}
          value={editingSkill.description_zh}
          disabled={editLoading}
          onChange={(value) => setEditingSkill((prev) => ({ ...prev, description_zh: value }))}
        />
      </div>

      <div className='mt-4 flex flex-wrap gap-6'>
        <div className='flex items-center gap-2 rounded-lg border px-3 py-2'>
          <span>启用</span>
          <Switch
            checked={editingSkill.enabled}
            disabled={editLoading}
            onChange={(checked) => setEditingSkill((prev) => ({ ...prev, enabled: checked }))}
          />
        </div>
        <div className='flex items-center gap-2 rounded-lg border px-3 py-2'>
          <span>公开上架</span>
          <Switch
            checked={editingSkill.is_public}
            disabled={editLoading}
            onChange={(checked) => setEditingSkill((prev) => ({ ...prev, is_public: checked }))}
          />
        </div>
        {editingSkill.id ? (
          <Button
            theme='light'
            onClick={() => window.open(getPreviewUrl(editingSkill), '_blank', 'noopener,noreferrer')}
          >
            预览技能页
          </Button>
        ) : null}
        {editingSkill.id ? (
          <Button
            type='primary'
            theme='light'
            loading={Boolean(statusLoadingMap[String(editingSkill.id)])}
            disabled={editingSkill.is_public}
            onClick={() => void updateSkillStatus(editingSkill, { is_public: true })}
          >
            立即上架
          </Button>
        ) : null}
        {editingSkill.id ? (
          <Button
            type='danger'
            theme='light'
            loading={Boolean(statusLoadingMap[String(editingSkill.id)])}
            disabled={!editingSkill.is_public}
            onClick={() => void updateSkillStatus(editingSkill, { is_public: false })}
          >
            立即下架
          </Button>
        ) : null}
      </div>
    </div>
  </SideSheet>
);

export default EditSkillModal;
