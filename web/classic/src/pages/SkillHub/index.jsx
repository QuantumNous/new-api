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

const defaultForm = {
  id: '',
  name: '',
  description: '',
  version: '1.0.0',
  author: '',
  icon: '',
  tags: '',
  verified: false,
  recommended: false,
  published: false,
  sort: 0,
  connectorMinVersion: '',
  platforms: 'windows, macos, linux',
  permissions: '',
  manifestEntry: 'SKILL.md',
  manifestPermissions: '',
  manifestTools: '',
  sourceType: 'zip',
  sourceUrl: '',
  sourceRef: '',
  sourceChecksum: '',
  changelog: '',
};

const toList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const listToText = (value) => (Array.isArray(value) ? value.join(', ') : '');

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

const skillToForm = (skill) => ({
  ...defaultForm,
  id: skill?.id || '',
  name: skill?.name || '',
  description: skill?.description || '',
  version: skill?.version || '1.0.0',
  author: skill?.author || '',
  icon: skill?.icon || '',
  tags: listToText(skill?.tags),
  verified: Boolean(skill?.verified),
  recommended: Boolean(skill?.recommended),
  published: Boolean(skill?.published || skill?.status === 1),
  sort: skill?.sort || 0,
  connectorMinVersion: skill?.compatibility?.connectorMinVersion || '',
  platforms: listToText(skill?.compatibility?.platforms),
  permissions: listToText(skill?.permissions),
  manifestEntry: skill?.manifest?.entry || 'SKILL.md',
  manifestPermissions: listToText(skill?.manifest?.permissions),
  manifestTools: listToText(skill?.manifest?.tools),
  sourceType: skill?.source?.type || 'zip',
  sourceUrl: skill?.source?.url || '',
  sourceRef: skill?.source?.ref || '',
  sourceChecksum: skill?.source?.checksum || '',
  changelog: skill?.changelog || '',
});

const formToPayload = (form) => ({
  id: form.id.trim(),
  name: form.name.trim(),
  description: form.description.trim(),
  version: form.version.trim(),
  author: form.author.trim(),
  icon: form.icon.trim(),
  tags: toList(form.tags),
  verified: form.verified,
  recommended: form.recommended,
  published: form.published,
  sort: Number(form.sort) || 0,
  compatibility: {
    connectorMinVersion: form.connectorMinVersion.trim(),
    platforms: toList(form.platforms),
  },
  permissions: toList(form.permissions),
  manifest: {
    entry: form.manifestEntry.trim() || 'SKILL.md',
    permissions: toList(form.manifestPermissions),
    tools: toList(form.manifestTools),
  },
  source: {
    type: 'zip',
    url: form.sourceUrl.trim(),
    ref: form.sourceRef.trim(),
    checksum: form.sourceChecksum.trim(),
  },
  changelog: form.changelog.trim(),
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
      <div className='mt-1 text-sm text-semi-color-text-2'>{description}</div>
    </div>
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{children}</div>
  </section>
);

const InstallMethodCard = ({ title, description, selected, disabled }) => (
  <button
    type='button'
    disabled={disabled}
    className={`rounded border p-3 text-left transition ${
      selected
        ? 'border-semi-color-primary bg-semi-color-primary-light-default'
        : 'border-semi-color-border bg-semi-color-fill-0'
    } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-semi-color-fill-1'}`}
  >
    <div className='flex items-center justify-between gap-2'>
      <span className='font-semibold text-semi-color-text-0'>{title}</span>
      {disabled ? <Tag color='grey'>暂不支持</Tag> : <Tag color='blue'>当前</Tag>}
    </div>
    <div className='mt-2 text-sm text-semi-color-text-2'>{description}</div>
  </button>
);

const SkillHub = () => {
  const [skills, setSkills] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const zipInputRef = useRef(null);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedId),
    [skills, selectedId],
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadSkills = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/admin/skill-hub/skills', {
        params: { keyword, page_size: 200 },
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

  useEffect(() => {
    loadSkills();
  }, []);

  useEffect(() => {
    if (selectedSkill) {
      setForm(skillToForm(selectedSkill));
    }
  }, [selectedSkill]);

  const handleNew = () => {
    setSelectedId('');
    setForm(defaultForm);
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
              Skill Hub
            </Typography.Title>
            <Typography.Text type='tertiary'>
              配置可被本地连接器安装的 Skill 包；当前只支持 HTTPS Zip 包安装。
            </Typography.Text>
          </div>
          <Space>
            <Button onClick={handleNew}>新建</Button>
            <Button onClick={loadSkills} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]'>
          <Card>
            <div className='mb-3 flex gap-2'>
              <Input
                placeholder='搜索 ID / 名称'
                value={keyword}
                onChange={setKeyword}
                onEnterPress={loadSkills}
              />
              <Button onClick={loadSkills}>搜索</Button>
            </div>
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
                      <span className='font-semibold'>{skill.name}</span>
                      <Tag color={skill.published ? 'green' : 'grey'}>
                        {skill.published ? '已发布' : '草稿'}
                      </Tag>
                    </div>
                    <div className='mt-1 text-xs text-semi-color-text-2'>
                      {skill.id} · {skill.version}
                    </div>
                    <div className='mt-2 line-clamp-2 text-sm text-semi-color-text-1'>
                      {skill.description || '暂无描述'}
                    </div>
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
                <Field label='作者'>
                  <Input
                    value={form.author}
                    onChange={(value) => updateForm('author', value)}
                  />
                </Field>
                <Field label='图标'>
                  <Input
                    value={form.icon}
                    placeholder='可填 URL 或 emoji'
                    onChange={(value) => updateForm('icon', value)}
                  />
                </Field>
                <Field label='排序'>
                  <Input
                    value={String(form.sort)}
                    onChange={(value) => updateForm('sort', value)}
                  />
                </Field>
                <Field label='标签（逗号分隔）'>
                  <Input
                    value={form.tags}
                    onChange={(value) => updateForm('tags', value)}
                  />
                </Field>
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
                title='安装方式'
                description='预留三种方式位置；当前保存时只支持 Zip 包安装。'
              >
                <InstallMethodCard
                  title='通过对话安装'
                  description='后续用于复制提示词或对话式安装，目前暂不开放。'
                  disabled
                />
                <InstallMethodCard
                  title='命令行安装'
                  description='后续可展示 CLI 安装指引；不会下发任意命令给连接器。'
                  disabled
                />
                <InstallMethodCard
                  title='Zip 包安装'
                  description='连接器下载 HTTPS Zip 包，校验后安装到本地 Skills。'
                  selected
                />
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
                      最大 50MB，上传成功后自动填入下载地址、OSS Object 和校验值。
                    </Typography.Text>
                  </Space>
                </div>
                <Field label='Zip 包地址'>
                  <Input
                    value={form.sourceUrl}
                    placeholder='https://.../skill.zip'
                    onChange={(value) => updateForm('sourceUrl', value)}
                  />
                </Field>
                <Field label='SHA256 校验'>
                  <Input
                    value={form.sourceChecksum}
                    placeholder='sha256:...'
                    onChange={(value) => updateForm('sourceChecksum', value)}
                  />
                </Field>
                <Field label='OSS Object'>
                  <Input
                    value={form.sourceRef}
                    placeholder='skill-hub/skills/...'
                    onChange={(value) => updateForm('sourceRef', value)}
                  />
                </Field>
                <Field label='Manifest Entry'>
                  <Input
                    value={form.manifestEntry}
                    onChange={(value) => updateForm('manifestEntry', value)}
                  />
                </Field>
                <Field label='Manifest 权限（逗号分隔）'>
                  <TextArea
                    autosize
                    rows={2}
                    value={form.manifestPermissions}
                    onChange={(value) =>
                      updateForm('manifestPermissions', value)
                    }
                  />
                </Field>
                <Field label='Manifest 工具（逗号分隔）'>
                  <TextArea
                    autosize
                    rows={2}
                    value={form.manifestTools}
                    onChange={(value) => updateForm('manifestTools', value)}
                  />
                </Field>
              </Section>

              <Section
                title='运行与兼容'
                description='这些信息会在安装前展示给本地连接器。'
              >
                <Field label='平台（逗号分隔）'>
                  <Input
                    value={form.platforms}
                    onChange={(value) => updateForm('platforms', value)}
                  />
                </Field>
                <Field label='最低 Connector 版本'>
                  <Input
                    value={form.connectorMinVersion}
                    onChange={(value) =>
                      updateForm('connectorMinVersion', value)
                    }
                  />
                </Field>
                <div className='md:col-span-2'>
                  <Field label='安装权限（逗号分隔）'>
                    <TextArea
                      autosize
                      rows={2}
                      value={form.permissions}
                      onChange={(value) => updateForm('permissions', value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title='发布控制' description='控制目录可见性和信任标记。'>
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
                <div className='md:col-span-2'>
                  <Field label='更新日志'>
                    <TextArea
                      autosize
                      rows={2}
                      value={form.changelog}
                      onChange={(value) => updateForm('changelog', value)}
                    />
                  </Field>
                </div>
              </Section>
            </div>

            <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
              <div />
              <Space wrap>
                {selectedSkill && (
                  <>
                    <Button
                      onClick={() => setPublished(!selectedSkill.published)}
                    >
                      {selectedSkill.published ? '取消发布' : '发布'}
                    </Button>
                    <Button type='danger' onClick={deleteSkill}>
                      删除
                    </Button>
                  </>
                )}
                <Button
                  type='primary'
                  loading={saving}
                  disabled={uploading}
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
