import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API, setUserData, showError, showSuccess, updateAPI } from '../../helpers';

const defaultSkillForm = {
  id: undefined,
  name: '',
  display_name: '',
  display_name_zh: '',
  description: '',
  description_zh: '',
  category: '',
  tags_text: '',
  source: 'community',
  source_platform: 'manual',
  source_skill_id: '',
  source_slug: '',
  url: '',
  download_url: '',
  author: '',
  version: '',
  downloads: 0,
  sort_order: 0,
  enabled: true,
  is_public: true,
};

const CATEGORY_PRESETS = [
  { value: 'productivity', label: '通用基础 / productivity' },
  { value: 'content-creation', label: '创作 / content-creation' },
  { value: 'education', label: '学术教育 / education' },
  { value: 'developer-tools', label: '开发技术 / developer-tools' },
  { value: 'ai-intelligence', label: '开发技术 / ai-intelligence' },
  { value: 'security-compliance', label: '安全合规 / security-compliance' },
  { value: 'legal', label: '安全合规 / legal' },
  { value: 'life', label: '生活 / life' },
  { value: 'communication-collaboration', label: '生活 / communication-collaboration' },
  { value: 'marketing', label: '自媒体营销 / marketing' },
  { value: '自媒体-小红书创作', label: '自媒体营销 / 小红书创作' },
  { value: '自媒体-小红书配图', label: '自媒体营销 / 小红书配图' },
  { value: '自媒体-小红书选题', label: '自媒体营销 / 小红书选题' },
  { value: '自媒体-小红书分析', label: '自媒体营销 / 小红书分析' },
  { value: '自媒体-小红书发布', label: '自媒体营销 / 小红书发布' },
  { value: '自媒体-抖音运营', label: '自媒体营销 / 抖音运营' },
  { value: '自媒体-多平台运营', label: '自媒体营销 / 多平台运营' },
  { value: 'finance', label: '财务金融 / finance' },
  { value: 'data-analysis', label: '财务金融 / data-analysis' },
];

const MYCLAW_NAV_LABELS = {
  productivity: '通用基础',
  'content-creation': '创作',
  education: '学术教育',
  'developer-tools': '开发技术',
  'ai-intelligence': '开发技术',
  'security-compliance': '安全合规',
  legal: '安全合规',
  life: '生活',
  'communication-collaboration': '生活',
  marketing: '自媒体营销',
  '自媒体-小红书创作': '自媒体营销',
  '自媒体-小红书配图': '自媒体营销',
  '自媒体-小红书选题': '自媒体营销',
  '自媒体-小红书分析': '自媒体营销',
  '自媒体-小红书发布': '自媒体营销',
  '自媒体-抖音运营': '自媒体营销',
  '自媒体-多平台运营': '自媒体营销',
  '自媒体-精选': '自媒体营销',
  finance: '财务金融',
  'data-analysis': '财务金融',
};

const normalizeSkillForm = (skill) => ({
  ...defaultSkillForm,
  ...skill,
  tags_text: Array.isArray(skill?.tags) ? skill.tags.join(', ') : '',
});

const parseTags = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getMylclawNavLabel = (category) => MYCLAW_NAV_LABELS[category] || '未匹配到现有导航';

const fieldClassName =
  'mt-1 w-full rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm outline-none';

const labelClassName = 'block text-sm font-medium text-[#1f2329]';

const SkillMarketEditor = () => {
  const navigate = useNavigate();
  const { skillId } = useParams();
  const [editingSkill, setEditingSkill] = useState(defaultSkillForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [pageError, setPageError] = useState('');

  const isCreate = skillId === 'new';

  const ensureSessionSynced = useCallback(async () => {
    const res = await API.get('/api/user/self');
    if (!res?.data?.success || !res?.data?.data) {
      throw new Error(res?.data?.message || '获取当前登录用户失败');
    }

    const serverUser = res.data.data;
    let localUser = null;
    try {
      const raw = localStorage.getItem('user');
      localUser = raw ? JSON.parse(raw) : null;
    } catch {
      localUser = null;
    }

    const needSync =
      !localUser ||
      String(localUser.id) !== String(serverUser.id) ||
      Number(localUser.role) !== Number(serverUser.role);

    if (needSync) {
      setUserData(serverUser);
      updateAPI();
    }
  }, []);

  const loadSkill = useCallback(async () => {
    setLoading(true);
    setEditError('');
    setPageError('');
    try {
      await ensureSessionSynced();
      if (isCreate) {
        setEditingSkill(defaultSkillForm);
        return;
      }

      const res = await API.get(`/api/client/admin/skills/${skillId}`, { skipErrorHandler: true });
      if (!res?.data?.success || !res?.data?.data) {
        throw new Error(res?.data?.message || '获取技能详情失败');
      }

      setEditingSkill(normalizeSkillForm(res.data.data));
    } catch (error) {
      const message = error.message || '获取技能详情失败';
      setEditError(message);
      setPageError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [ensureSessionSynced, isCreate, skillId]);

  useEffect(() => {
    void loadSkill();
  }, [loadSkill]);

  const previewUrl = useMemo(() => {
    if (editingSkill?.url?.trim()) {
      const url = editingSkill.url.trim();
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith('/')) return `${window.location.origin}${url}`;
      return `https://${url}`;
    }
    return editingSkill?.id
      ? `${window.location.origin}/api/client/skills/${editingSkill.id}`
      : `${window.location.origin}/api/client/skills`;
  }, [editingSkill]);

  const updateField = (key, value) => {
    setEditingSkill((prev) => ({ ...prev, [key]: value }));
  };

  const submitSkill = async () => {
    if (!editingSkill.name.trim()) {
      showError('原始名称不能为空');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        skill: {
          ...editingSkill,
          name: editingSkill.name.trim(),
          display_name: editingSkill.display_name.trim(),
          display_name_zh: editingSkill.display_name_zh.trim(),
          description: editingSkill.description.trim(),
          description_zh: editingSkill.description_zh.trim(),
          category: editingSkill.category.trim(),
          tags: parseTags(editingSkill.tags_text),
          source: editingSkill.source.trim(),
          source_platform: editingSkill.source_platform.trim(),
          source_skill_id: editingSkill.source_skill_id.trim(),
          source_slug: editingSkill.source_slug.trim(),
          url: editingSkill.url.trim(),
          download_url: editingSkill.download_url.trim(),
          author: editingSkill.author.trim(),
          version: editingSkill.version.trim(),
          downloads: Number(editingSkill.downloads) || 0,
          sort_order: Number(editingSkill.sort_order) || 0,
        },
      };

      const res = isCreate
        ? await API.post('/api/client/admin/skills', payload)
        : await API.put(`/api/client/admin/skills/${editingSkill.id}`, payload);

      if (!res?.data?.success) {
        throw new Error(res?.data?.message || '保存失败');
      }

      const nextId = res.data.data?.id || editingSkill.id;
      showSuccess(isCreate ? '技能已创建' : '技能已更新');
      navigate(
        nextId ? `/console/skill-market/edit/${nextId}?ts=editor-plain-v2` : '/console/skill-market',
        { replace: isCreate }
      );
      if (isCreate && nextId) {
        setEditingSkill((prev) => ({ ...prev, id: nextId }));
      }
    } catch (error) {
      showError(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateSkillStatus = async (patch) => {
    if (!editingSkill?.id) return;
    setStatusLoading(true);
    try {
      const res = await API.patch(`/api/client/admin/skills/${editingSkill.id}/status`, patch);
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || '状态更新失败');
      }
      showSuccess('状态已更新');
      setEditingSkill((prev) => ({ ...prev, ...patch }));
    } catch (error) {
      showError(error.message || '状态更新失败');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className='mt-[60px] px-2'>
      <div className='rounded-2xl border border-[#e5e6eb] bg-white p-6 shadow-sm'>
        <div className='mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700'>
          build=skill-market-editor-plain-v2
        </div>

        <div className='mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-[#1f2329]'>
              {isCreate ? '新增技能' : `设置技能 #${editingSkill.id || skillId}`}
            </h1>
            <p className='mt-1 text-sm text-[#86909c]'>纯页面表单版，专门用于绕开弹层白屏问题</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {!isCreate && editingSkill?.id ? (
              <button
                className='rounded-lg border border-[#d9d9d9] bg-white px-4 py-2 text-sm'
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
              >
                预览
              </button>
            ) : null}
            <button
              className='rounded-lg border border-[#d9d9d9] bg-white px-4 py-2 text-sm'
              onClick={() => navigate('/console/skill-market')}
            >
              返回技能管理
            </button>
            <button
              className='rounded-lg bg-[#155eef] px-4 py-2 text-sm text-white disabled:opacity-60'
              disabled={saving}
              onClick={() => void submitSkill()}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {pageError ? (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600'>
            页面错误：{pageError}
          </div>
        ) : null}

        {editError ? (
          <div className='mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700'>
            接口提示：{editError}
          </div>
        ) : null}

        {loading ? (
          <div className='py-12 text-center text-sm text-[#86909c]'>正在加载技能信息...</div>
        ) : (
          <div className='space-y-5'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <label className={labelClassName}>
                原始名称
                <input
                  className={fieldClassName}
                  value={editingSkill.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                分类
                <input
                  className={fieldClassName}
                  value={editingSkill.category}
                  onChange={(event) => updateField('category', event.target.value)}
                />
                <select
                  className={fieldClassName}
                  value={editingSkill.category || ''}
                  onChange={(event) => updateField('category', event.target.value)}
                >
                  <option value=''>请选择分类</option>
                  {CATEGORY_PRESETS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className='mt-1 block text-xs text-[#86909c]'>
                  当前会显示到 myclaw 导航：{getMylclawNavLabel(editingSkill.category)}
                </span>
              </label>
              <label className={labelClassName}>
                展示名
                <input
                  className={fieldClassName}
                  value={editingSkill.display_name}
                  onChange={(event) => updateField('display_name', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                中文别名
                <input
                  className={fieldClassName}
                  value={editingSkill.display_name_zh}
                  onChange={(event) => updateField('display_name_zh', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                作者
                <input
                  className={fieldClassName}
                  value={editingSkill.author}
                  onChange={(event) => updateField('author', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                版本
                <input
                  className={fieldClassName}
                  value={editingSkill.version}
                  onChange={(event) => updateField('version', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                来源平台
                <input
                  className={fieldClassName}
                  value={editingSkill.source_platform}
                  onChange={(event) => updateField('source_platform', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                来源 slug
                <input
                  className={fieldClassName}
                  value={editingSkill.source_slug}
                  onChange={(event) => updateField('source_slug', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                排序
                <input
                  className={fieldClassName}
                  type='number'
                  value={editingSkill.sort_order}
                  onChange={(event) => updateField('sort_order', Number(event.target.value) || 0)}
                />
              </label>
              <label className={labelClassName}>
                下载量
                <input
                  className={fieldClassName}
                  type='number'
                  value={editingSkill.downloads}
                  onChange={(event) => updateField('downloads', Number(event.target.value) || 0)}
                />
              </label>
            </div>

            <label className={labelClassName}>
              标签
              <input
                className={fieldClassName}
                placeholder='多个标签用英文逗号分隔'
                value={editingSkill.tags_text}
                onChange={(event) => updateField('tags_text', event.target.value)}
              />
            </label>

            <label className={labelClassName}>
              详情地址
              <input
                className={fieldClassName}
                value={editingSkill.url}
                onChange={(event) => updateField('url', event.target.value)}
              />
            </label>

            <label className={labelClassName}>
              下载地址
              <input
                className={fieldClassName}
                value={editingSkill.download_url}
                onChange={(event) => updateField('download_url', event.target.value)}
              />
            </label>

            <label className={labelClassName}>
              描述
              <textarea
                className={`${fieldClassName} min-h-[120px]`}
                value={editingSkill.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </label>

            <label className={labelClassName}>
              中文描述
              <textarea
                className={`${fieldClassName} min-h-[120px]`}
                value={editingSkill.description_zh}
                onChange={(event) => updateField('description_zh', event.target.value)}
              />
            </label>

            <div className='flex flex-wrap gap-6'>
              <label className='flex items-center gap-2 text-sm text-[#1f2329]'>
                <input
                  type='checkbox'
                  checked={Boolean(editingSkill.enabled)}
                  onChange={(event) => updateField('enabled', event.target.checked)}
                />
                启用
              </label>
              <label className='flex items-center gap-2 text-sm text-[#1f2329]'>
                <input
                  type='checkbox'
                  checked={Boolean(editingSkill.is_public)}
                  onChange={(event) => updateField('is_public', event.target.checked)}
                />
                公开上架
              </label>
              {editingSkill.id ? (
                <>
                  <button
                    className='rounded-lg border border-[#155eef] px-4 py-2 text-sm text-[#155eef] disabled:opacity-60'
                    disabled={editingSkill.is_public || statusLoading}
                    onClick={() => void updateSkillStatus({ is_public: true })}
                  >
                    {statusLoading ? '处理中...' : '上架'}
                  </button>
                  <button
                    className='rounded-lg border border-[#f04438] px-4 py-2 text-sm text-[#f04438] disabled:opacity-60'
                    disabled={!editingSkill.is_public || statusLoading}
                    onClick={() => void updateSkillStatus({ is_public: false })}
                  >
                    {statusLoading ? '处理中...' : '下架'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillMarketEditor;
