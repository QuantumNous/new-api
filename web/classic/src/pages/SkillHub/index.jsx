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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';

const createDefaultForm = () => ({
  id: '',
  name: '',
  description: '',
  version: '1.0.0',
  icon: '',
  tags: [],
  verified: false,
  recommended: false,
  published: false,
  sort: 0,
  sourceUrl: '',
  sourceRef: '',
  sourceChecksum: '',
});

const normalizeTags = (value) => {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(/[,，\n]/);
  const seen = new Set();
  const tags = [];

  for (const item of values) {
    const tag = String(item || '').trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
};

const addTags = (current, value) => {
  const next = normalizeTags(current);
  const seen = new Set(next.map((tag) => tag.toLowerCase()));

  for (const tag of normalizeTags(value)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
  }

  return next;
};

const isPublishedSkill = (skill) =>
  Boolean(skill?.published || skill?.status === 1);

const isAllowedZipUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
};

const isAllowedIconFile = (file) => {
  if (!file) return false;
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return true;
  }
  return /\.(png|jpe?g|webp)$/i.test(file.name || '');
};

const isImageIcon = (value) => {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
};

const skillToForm = (skill) => ({
  ...createDefaultForm(),
  id: skill?.id || '',
  name: skill?.name || '',
  description: skill?.description || '',
  version: skill?.version || '1.0.0',
  icon: skill?.icon || '',
  tags: normalizeTags(skill?.tags),
  verified: Boolean(skill?.verified),
  recommended: Boolean(skill?.recommended),
  published: isPublishedSkill(skill),
  sort: skill?.sort || 0,
  sourceUrl: skill?.source?.url || '',
  sourceRef: skill?.source?.ref || '',
  sourceChecksum: skill?.source?.checksum || '',
});

const formToPayload = (form) => ({
  id: form.id.trim(),
  name: form.name.trim(),
  description: form.description.trim(),
  version: form.version.trim(),
  icon: form.icon.trim(),
  tags: normalizeTags(form.tags),
  verified: form.verified,
  recommended: form.recommended,
  published: form.published,
  sort: Number(form.sort) || 0,
  source: {
    type: 'zip',
    url: form.sourceUrl.trim(),
    ref: form.sourceRef.trim(),
    checksum: form.sourceChecksum.trim(),
  },
});

const Field = ({ label, children }) => (
  <label className='flex flex-col gap-1 text-sm text-semi-color-text-1'>
    <span className='font-medium'>{label}</span>
    {children}
  </label>
);

const Section = ({ title, description, children }) => (
  <section className='rounded border border-semi-color-border p-4'>
    <div className='mb-4'>
      <div className='text-base font-semibold text-semi-color-text-0'>
        {title}
      </div>
      {description ? (
        <div className='mt-1 text-sm text-semi-color-text-2'>{description}</div>
      ) : null}
    </div>
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{children}</div>
  </section>
);

const TagEditor = ({ value, suggestions, placeholder, onChange }) => {
  const [draft, setDraft] = useState('');
  const tags = normalizeTags(value);
  const selectedKeys = useMemo(
    () => new Set(tags.map((tag) => tag.toLowerCase())),
    [tags],
  );
  const availableSuggestions = (suggestions || [])
    .filter((tag) => !selectedKeys.has(tag.toLowerCase()))
    .slice(0, 8);

  const resolveKnownTags = (rawValue) => {
    const known = new Map(
      (suggestions || []).map((tag) => [tag.toLowerCase(), tag]),
    );
    return normalizeTags(rawValue)
      .map((tag) => known.get(tag.toLowerCase()))
      .filter(Boolean);
  };

  const commit = (rawValue = draft) => {
    const next = addTags(tags, resolveKnownTags(rawValue));
    if (next.length === tags.length) {
      setDraft('');
      return;
    }
    onChange(next);
    setDraft('');
  };

  const remove = (tag) => {
    onChange(tags.filter((item) => item !== tag));
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ',' && event.key !== '，')
      return;
    event.preventDefault();
    commit();
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text');
    if (!text || !/[,，\n]/.test(text)) return;
    event.preventDefault();
    commit(text);
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex min-h-[40px] flex-wrap items-center gap-2 rounded border border-semi-color-border bg-semi-color-bg-0 px-2 py-1'>
        {tags.map((tag) => (
          <button
            key={tag}
            type='button'
            className='inline-flex items-center gap-1 rounded bg-semi-color-fill-1 px-2 py-1 text-xs font-medium text-semi-color-text-0 hover:bg-semi-color-fill-2'
            onClick={() => remove(tag)}
          >
            <span>{tag}</span>
            <span className='text-semi-color-text-2'>×</span>
          </button>
        ))}
        <Input
          value={draft}
          placeholder={tags.length ? '' : placeholder}
          className='min-w-[160px] flex-1'
          size='small'
          borderless
          onChange={setDraft}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => commit()}
        />
      </div>
      {availableSuggestions.length ? (
        <div className='flex flex-wrap gap-2'>
          {availableSuggestions.map((tag) => (
            <button
              key={tag}
              type='button'
              className='rounded bg-semi-color-fill-0 px-2 py-1 text-xs text-semi-color-text-1 hover:bg-semi-color-fill-1'
              onClick={() => commit(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const SkillHub = () => {
  const [skills, setSkills] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(createDefaultForm);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const zipInputRef = useRef(null);
  const iconInputRef = useRef(null);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedId),
    [skills, selectedId],
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const tagNames = useMemo(
    () => tagOptions.map((tag) => tag.name),
    [tagOptions],
  );

  const loadSkills = async (tagIds = selectedTagIds) => {
    setLoading(true);
    try {
      const params = { keyword, page_size: 200 };
      const res = tagIds.length
        ? await API.get('/api/admin/skill-hub/tags/skills', {
            params: { ...params, tag_ids: tagIds.join(',') },
          })
        : await API.get('/api/admin/skill-hub/skills', {
            params,
          });
      const { success, data, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      const items = data?.items || [];
      setSkills(items);
      if (selectedId && !items.some((item) => item.id === selectedId)) {
        setSelectedId('');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const res = await API.get('/api/admin/skill-hub/tags', {
        params: { page_size: 500 },
      });
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || '标签加载失败');
        return;
      }
      const items = data?.items || [];
      setTagOptions(items);
      setSelectedTagIds((current) =>
        current.filter((id) => items.some((tag) => tag.id === id)),
      );
    } catch (error) {
      showError(error.message || '标签加载失败');
    }
  };

  useEffect(() => {
    loadSkills();
    loadTags();
  }, []);

  useEffect(() => {
    if (selectedSkill) {
      setForm(skillToForm(selectedSkill));
    }
  }, [selectedSkill]);

  const handleNew = () => {
    setSelectedId('');
    setForm(createDefaultForm());
  };

  const applyTagFilter = (tagId) => {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(next);
    loadSkills(next);
  };

  const clearTagFilter = () => {
    setSelectedTagIds([]);
    loadSkills([]);
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim() || !form.version.trim()) {
      showError('请填写 Skill ID、名称和版本');
      return;
    }
    if (!form.sourceUrl.trim()) {
      showError('请填写包地址');
      return;
    }
    if (!isAllowedZipUrl(form.sourceUrl)) {
      showError('Zip 包地址必须使用 HTTPS，本地调试可使用 localhost HTTP');
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const request = selectedSkill
        ? API.put(
            `/api/admin/skill-hub/skills/${encodeURIComponent(selectedSkill.id)}`,
            payload,
          )
        : API.post('/api/admin/skill-hub/skills', payload);
      const res = await request;
      const { success, data, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess('保存成功');
      setSelectedId(data?.id || payload.id);
      await loadSkills();
    } finally {
      setSaving(false);
    }
  };

  const uploadZip = async (file) => {
    if (!file) return;
    if (!form.id.trim()) {
      showError('请先填写 Skill ID');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showError('请上传 zip 文件');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('skill_id', form.id);
      body.append('version', form.version);
      const res = await API.post('/api/admin/skill-hub/upload', body);
      const { success, data, message } = res.data;
      if (!success || !data) {
        showError(message || '上传失败');
        return;
      }
      updateForm('sourceUrl', data.url);
      updateForm('sourceRef', data.object);
      updateForm('sourceChecksum', data.checksum);
      showSuccess('Zip 包已上传');
    } finally {
      setUploading(false);
      if (zipInputRef.current) {
        zipInputRef.current.value = '';
      }
    }
  };

  const uploadIcon = async (file) => {
    if (!file) return;
    if (!form.id.trim()) {
      showError('请先填写 Skill ID');
      return;
    }
    if (!isAllowedIconFile(file)) {
      showError('请上传 png、jpg、jpeg 或 webp 图片');
      return;
    }
    setIconUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('skill_id', form.id);
      const res = await API.post('/api/admin/skill-hub/upload-icon', body);
      const { success, data, message } = res.data;
      if (!success || !data) {
        showError(message || '图标上传失败');
        return;
      }
      updateForm('icon', data.url);
      showSuccess('图标已上传');
    } finally {
      setIconUploading(false);
      if (iconInputRef.current) {
        iconInputRef.current.value = '';
      }
    }
  };

  const setPublished = async (published) => {
    if (!selectedSkill) return;
    const action = published ? 'publish' : 'unpublish';
    const res = await API.post(
      `/api/admin/skill-hub/skills/${encodeURIComponent(selectedSkill.id)}/${action}`,
    );
    if (res.data.success) {
      showSuccess(published ? '已发布' : '已取消发布');
      await loadSkills();
    } else {
      showError(res.data.message);
    }
  };

  const deleteSkill = () => {
    if (!selectedSkill) return;
    Modal.confirm({
      title: '删除 Skill',
      content: `确认删除 ${selectedSkill.name || selectedSkill.id}？`,
      okType: 'danger',
      onOk: async () => {
        const res = await API.delete(
          `/api/admin/skill-hub/skills/${encodeURIComponent(selectedSkill.id)}`,
        );
        if (res.data.success) {
          showSuccess('已删除');
          handleNew();
          await loadSkills();
        } else {
          showError(res.data.message);
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
              技能管理
            </Typography.Title>
            <Typography.Text type='tertiary'>
              配置可被本地连接器安装的 Skill
              包；当前只保留目录展示、标签、图标和 Zip 安装数据。
            </Typography.Text>
          </div>
          <Space>
            <Button onClick={handleNew}>新建</Button>
            <Button onClick={() => loadSkills()} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]'>
          <Card>
            <div className='mb-3 flex gap-2'>
              <Input
                placeholder='搜索 ID / 名称 / 标签'
                value={keyword}
                onChange={setKeyword}
                onEnterPress={() => loadSkills()}
              />
              <Button onClick={() => loadSkills()}>搜索</Button>
            </div>
            {tagOptions.length ? (
              <div className='mb-3 flex flex-wrap gap-2'>
                <Button
                  size='small'
                  type={selectedTagIds.length ? 'tertiary' : 'primary'}
                  onClick={clearTagFilter}
                >
                  全部标签
                </Button>
                {tagOptions.map((tag) => (
                  <Button
                    key={tag.id || tag.name}
                    size='small'
                    type={
                      selectedTagIds.includes(tag.id) ? 'primary' : 'tertiary'
                    }
                    onClick={() => applyTagFilter(tag.id)}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <Spin spinning={loading}>
              <div className='flex max-h-[70vh] flex-col gap-2 overflow-auto pr-1'>
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    type='button'
                    onClick={() => setSelectedId(skill.id)}
                    className={`rounded border p-3 text-left transition ${
                      selectedId === skill.id
                        ? 'border-semi-color-primary bg-semi-color-primary-light-default'
                        : 'border-semi-color-border bg-semi-color-bg-1 hover:bg-semi-color-fill-0'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='truncate font-semibold'>
                        {skill.name}
                      </span>
                      <Space spacing={4}>
                        {skill.recommended ? (
                          <Tag color='violet'>推荐</Tag>
                        ) : null}
                        <Tag color={isPublishedSkill(skill) ? 'green' : 'grey'}>
                          {isPublishedSkill(skill) ? '已发布' : '草稿'}
                        </Tag>
                      </Space>
                    </div>
                    <div className='mt-1 truncate text-xs text-semi-color-text-2'>
                      {skill.id} · {skill.version}
                    </div>
                    <div className='mt-2 line-clamp-2 min-h-[40px] text-sm text-semi-color-text-1'>
                      {skill.description || '暂无描述'}
                    </div>
                    {normalizeTags(skill.tags).length ? (
                      <div className='mt-2 flex max-h-7 flex-wrap gap-1 overflow-hidden'>
                        {normalizeTags(skill.tags)
                          .slice(0, 4)
                          .map((tag) => (
                            <span
                              key={tag}
                              className='rounded bg-semi-color-fill-0 px-2 py-0.5 text-xs text-semi-color-text-2'
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                    ) : null}
                  </button>
                ))}
                {skills.length === 0 && (
                  <div className='py-8 text-center text-semi-color-text-2'>
                    暂无 Skill
                  </div>
                )}
              </div>
            </Spin>
          </Card>

          <Card>
            <div className='flex flex-col gap-4'>
              <Section
                title='基础信息'
                description='控制 Skill 在目录卡片中的展示内容。'
              >
                <Field label='Skill ID'>
                  <Input
                    value={form.id}
                    disabled={Boolean(selectedSkill)}
                    onChange={(value) => updateForm('id', value)}
                  />
                </Field>
                <Field label='名称'>
                  <Input
                    value={form.name}
                    onChange={(value) => updateForm('name', value)}
                  />
                </Field>
                <Field label='版本'>
                  <Input
                    value={form.version}
                    onChange={(value) => updateForm('version', value)}
                  />
                </Field>
                <Field label='排序'>
                  <Input
                    value={String(form.sort)}
                    onChange={(value) => updateForm('sort', value)}
                  />
                </Field>
                <div className='md:col-span-2'>
                  <Field label='图标'>
                    <div className='flex gap-2'>
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-semi-color-border bg-semi-color-fill-0 text-semi-color-text-2'>
                        {isImageIcon(form.icon) ? (
                          <img
                            src={form.icon}
                            alt=''
                            referrerPolicy='no-referrer'
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <ImageIcon size={16} />
                        )}
                      </div>
                      <div className='flex min-w-0 flex-1 items-center truncate rounded border border-semi-color-border bg-semi-color-fill-0 px-3 text-xs text-semi-color-text-2'>
                        {form.icon.trim() || '未上传图标'}
                      </div>
                      <input
                        ref={iconInputRef}
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        className='hidden'
                        onChange={(event) =>
                          uploadIcon(event.target.files?.[0])
                        }
                      />
                      <Button
                        loading={iconUploading}
                        onClick={() => iconInputRef.current?.click()}
                      >
                        上传
                      </Button>
                    </div>
                  </Field>
                </div>
                <div className='md:col-span-2'>
                  <Field label='标签'>
                    <TagEditor
                      value={form.tags}
                      suggestions={tagNames}
                      placeholder='搜索已有标签后按 Enter 添加'
                      onChange={(tags) => updateForm('tags', tags)}
                    />
                    <div className='mt-1 text-xs text-semi-color-text-2'>
                      新增或删除标签请到「标签管理」维护。
                    </div>
                  </Field>
                </div>
                <div className='md:col-span-2'>
                  <Field label='描述'>
                    <TextArea
                      autosize
                      rows={3}
                      value={form.description}
                      onChange={(value) => updateForm('description', value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section
                title='Zip 包配置'
                description='上传 Zip 包到私有 OSS，New API 会提供签名下载地址。'
              >
                <div className='md:col-span-2'>
                  <Space wrap>
                    <input
                      ref={zipInputRef}
                      type='file'
                      accept='.zip,application/zip'
                      className='hidden'
                      onChange={(event) => uploadZip(event.target.files?.[0])}
                    />
                    <Button
                      loading={uploading}
                      onClick={() => zipInputRef.current?.click()}
                    >
                      上传 Zip 到 OSS
                    </Button>
                    <Typography.Text type='tertiary'>
                      最大 50MB，上传成功后自动填入下载地址和校验值。
                    </Typography.Text>
                  </Space>
                </div>
                <div className='md:col-span-2'>
                  <Field label='Zip 包地址'>
                    <Input
                      value={form.sourceUrl}
                      placeholder='https://.../skill.zip'
                      onChange={(value) => updateForm('sourceUrl', value)}
                    />
                  </Field>
                </div>
                <div className='md:col-span-2'>
                  <Field label='SHA256 校验'>
                    <Input
                      value={form.sourceChecksum}
                      placeholder='sha256:...'
                      onChange={(value) => updateForm('sourceChecksum', value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section
                title='发布控制'
                description='控制目录可见性和信任标记。'
              >
                <div className='md:col-span-2'>
                  <Space wrap>
                    <Checkbox
                      checked={form.published}
                      onChange={(event) =>
                        updateForm('published', event.target.checked)
                      }
                    >
                      发布
                    </Checkbox>
                    <Checkbox
                      checked={form.verified}
                      onChange={(event) =>
                        updateForm('verified', event.target.checked)
                      }
                    >
                      已验证
                    </Checkbox>
                    <Checkbox
                      checked={form.recommended}
                      onChange={(event) =>
                        updateForm('recommended', event.target.checked)
                      }
                    >
                      推荐
                    </Checkbox>
                  </Space>
                </div>
              </Section>
            </div>

            <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
              <div />
              <Space wrap>
                {selectedSkill && (
                  <>
                    <Button
                      onClick={() =>
                        setPublished(!isPublishedSkill(selectedSkill))
                      }
                    >
                      {isPublishedSkill(selectedSkill) ? '取消发布' : '发布'}
                    </Button>
                    <Button type='danger' onClick={deleteSkill}>
                      删除
                    </Button>
                  </>
                )}
                <Button
                  type='primary'
                  loading={saving}
                  disabled={uploading || iconUploading}
                  onClick={handleSave}
                >
                  保存
                </Button>
              </Space>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SkillHub;
