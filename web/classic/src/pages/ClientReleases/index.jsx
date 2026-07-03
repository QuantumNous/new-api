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
  Check,
  Download,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';

const platformOptions = ['windows', 'darwin', 'linux'];
const archOptions = ['x64', 'arm64', 'ia32', 'universal'];
const channelOptions = ['stable', 'beta'];

const createDefaultForm = () => ({
  version: '',
  platform: 'windows',
  arch: 'x64',
  channel: 'stable',
  fileName: '',
  objectKey: '',
  size: 0,
  sha256: '',
  sha512: '',
  releaseNotes: '',
  minVersion: '',
  forced: false,
  published: false,
});

const releaseToForm = (release) => ({
  ...createDefaultForm(),
  version: release?.version || '',
  platform: release?.platform || 'windows',
  arch: release?.arch || 'x64',
  channel: release?.channel === 'beta' ? 'beta' : 'stable',
  fileName: release?.fileName || '',
  objectKey: release?.objectKey || '',
  size: Number(release?.size || 0),
  sha256: release?.sha256 || '',
  sha512: release?.sha512 || '',
  releaseNotes: release?.releaseNotes || '',
  minVersion: release?.minVersion || '',
  forced: Boolean(release?.forced),
  published: Boolean(release?.published || release?.status === 1),
});

const formToPayload = (form) => ({
  version: normalizeVersion(form.version),
  platform: form.platform,
  arch: form.arch,
  channel: form.channel.trim() || 'stable',
  fileName: form.fileName.trim(),
  objectKey: form.objectKey.trim(),
  size: Number(form.size) || 0,
  sha256: form.sha256.trim(),
  sha512: form.sha512.trim(),
  releaseNotes: form.releaseNotes.trim(),
  minVersion: normalizeVersion(form.minVersion),
  forced: form.forced,
  published: form.published,
});

const isPublishedRelease = (release) =>
  Boolean(release?.published || release?.status === 1);

const versionPattern = /^\d+\.\d+\.\d+$/;

const normalizeVersion = (value) => String(value || '').trim();

const isValidVersion = (value) => versionPattern.test(normalizeVersion(value));

const extractVersionFromFileName = (fileName) => {
  const match = String(fileName || '').match(
    /(?:^|[^0-9])v?(\d+\.\d+\.\d+)(?=[^0-9]|$)/i,
  );
  return match?.[1] || '';
};

const resolveVersionForFile = (value, file) => {
  const normalized = normalizeVersion(value);
  if (isValidVersion(normalized)) return normalized;
  return extractVersionFromFileName(file?.name);
};

const isAllowedPackageFile = (file) =>
  /\.(exe|msi|dmg|pkg|zip|appimage|deb|rpm|ya?ml)$/i.test(file?.name || '');

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const buildLatestYmlUrl = (form) =>
  `/api/client-releases/updates/${encodeURIComponent(form.platform)}/${encodeURIComponent(form.arch)}/${encodeURIComponent(form.channel || 'stable')}/latest.yml`;

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
    <div className='grid grid-cols-1 gap-3'>{children}</div>
  </section>
);

const ReadonlyValue = ({ value }) => (
  <div className='min-h-[34px] break-all rounded border border-semi-color-border bg-semi-color-fill-0 px-3 py-2 text-xs text-semi-color-text-2'>
    {value || '-'}
  </div>
);

const VersionInput = ({ value, onChange }) => {
  const parts = splitVersionParts(value);
  const updatePart = (index, nextValue) => {
    const next = [...parts];
    next[index] = digitsOnly(nextValue);
    onChange(formatVersionParts(next));
  };
  const handlePaste = (event) => {
    const version = extractVersionFromFileName(
      event.clipboardData.getData('text'),
    );
    if (!version) return;
    event.preventDefault();
    onChange(version);
  };
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'>
      <VersionSegmentInput
        value={parts[0]}
        placeholder='0'
        onChange={(nextValue) => updatePart(0, nextValue)}
        onPaste={handlePaste}
      />
      <span className='text-center text-semi-color-text-2'>.</span>
      <VersionSegmentInput
        value={parts[1]}
        placeholder='1'
        onChange={(nextValue) => updatePart(1, nextValue)}
        onPaste={handlePaste}
      />
      <span className='text-center text-semi-color-text-2'>.</span>
      <VersionSegmentInput
        value={parts[2]}
        placeholder='0'
        onChange={(nextValue) => updatePart(2, nextValue)}
        onPaste={handlePaste}
      />
    </div>
  );
};

const VersionSegmentInput = ({ value, placeholder, onChange, onPaste }) => (
  <Input
    value={value}
    placeholder={placeholder}
    inputMode='numeric'
    pattern='[0-9]*'
    className='text-center'
    onChange={(nextValue) => onChange(nextValue)}
    onPaste={onPaste}
  />
);

const splitVersionParts = (value) => {
  const parts = normalizeVersion(value).split('.');
  return [
    digitsOnly(parts[0] || ''),
    digitsOnly(parts[1] || ''),
    digitsOnly(parts[2] || ''),
  ];
};

const formatVersionParts = (parts) => {
  if (parts.every((part) => part === '')) return '';
  return parts.join('.');
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const ClientReleases = () => {
  const [releases, setReleases] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(createDefaultForm);
  const [keyword, setKeyword] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [archFilter, setArchFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const selectedRelease = useMemo(
    () => releases.find((release) => release.id === selectedId),
    [releases, selectedId],
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const findConflictingRelease = async (nextForm) => {
    const res = await API.get('/api/admin/client-releases/', {
      params: {
        keyword: nextForm.version,
        platform: nextForm.platform,
        arch: nextForm.arch,
        channel: nextForm.channel,
        page_size: 100,
      },
    });
    const { success, data, message } = res.data;
    if (!success) {
      throw new Error(message || '检查版本冲突失败');
    }
    return (data?.items || []).find(
      (release) =>
        release.id !== selectedRelease?.id &&
        normalizeVersion(release.version) === nextForm.version &&
        release.platform === nextForm.platform &&
        release.arch === nextForm.arch &&
        (release.channel || 'stable') === nextForm.channel,
    );
  };

  const loadReleases = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/admin/client-releases/', {
        params: {
          keyword: keyword.trim(),
          platform: platformFilter || undefined,
          arch: archFilter || undefined,
          channel: channelFilter.trim() || undefined,
          page_size: 100,
        },
      });
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || '客户端管理数据加载失败');
        return;
      }
      const items = data?.items || [];
      setReleases(items);
      if (selectedId && !items.some((item) => item.id === selectedId)) {
        setSelectedId('');
      }
    } catch (error) {
      showError(error.message || '客户端管理数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReleases();
  }, []);

  useEffect(() => {
    if (selectedRelease) {
      setForm(releaseToForm(selectedRelease));
    }
  }, [selectedRelease]);

  const handleNew = () => {
    setSelectedId('');
    setForm(createDefaultForm());
  };

  const selectRelease = (release) => {
    setSelectedId(release.id);
    setForm(releaseToForm(release));
  };

  const uploadPackage = async (file) => {
    if (!file) return;
    if (!isAllowedPackageFile(file)) {
      showError('不支持的安装包文件类型');
      return;
    }
    const version = resolveVersionForFile(form.version, file);
    if (!version) {
      showError('版本号请使用 1.2.3 这样的三段数字格式');
      return;
    }
    if (version !== form.version) {
      updateForm('version', version);
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('version', version);
      body.append('platform', form.platform);
      body.append('arch', form.arch);
      body.append('channel', form.channel);
      const res = await API.post('/api/admin/client-releases/upload', body);
      const { success, data, message } = res.data;
      if (!success || !data) {
        showError(message || '安装包上传失败');
        return;
      }
      updateForm('fileName', data.fileName);
      updateForm('objectKey', data.object);
      updateForm('size', data.size);
      updateForm('sha256', data.sha256);
      updateForm('sha512', data.sha512);
      showSuccess('安装包已上传');
    } catch (error) {
      showError(error.message || '安装包上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const saveRelease = async () => {
    const version = normalizeVersion(form.version);
    const minVersion = normalizeVersion(form.minVersion);
    if (!isValidVersion(version)) {
      showError('版本号请使用 1.2.3 这样的三段数字格式');
      return;
    }
    if (minVersion && !isValidVersion(minVersion)) {
      showError('最低版本请使用 1.2.3 这样的三段数字格式');
      return;
    }
    if (form.forced && !minVersion) {
      showError('开启强制更新时请填写最低版本');
      return;
    }
    if (
      !form.fileName.trim() ||
      !form.objectKey.trim() ||
      Number(form.size) <= 0
    ) {
      showError('请先上传安装包');
      return;
    }
    const nextForm = { ...form, version, minVersion };
    setForm(nextForm);
    setSaving(true);
    try {
      const conflict = await findConflictingRelease(nextForm);
      if (
        conflict &&
        !window.confirm(
          `同版本 ${nextForm.version} / ${nextForm.platform}/${nextForm.arch}/${nextForm.channel} 已存在，是否覆盖？`,
        )
      ) {
        return;
      }
      const payload = formToPayload(nextForm);
      const request = conflict
        ? API.put(
            `/api/admin/client-releases/${encodeURIComponent(conflict.id)}`,
            payload,
          )
        : selectedRelease
          ? API.put(
              `/api/admin/client-releases/${encodeURIComponent(selectedRelease.id)}`,
              payload,
            )
          : API.post('/api/admin/client-releases/', payload);
      const res = await request;
      const { success, data, message } = res.data;
      if (!success || !data) {
        showError(message || '保存失败');
        return;
      }
      showSuccess('保存成功');
      setSelectedId(data.id);
      setForm(releaseToForm(data));
      await loadReleases();
    } catch (error) {
      showError(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const setPublished = async (published) => {
    if (!selectedRelease) return;
    setSaving(true);
    try {
      const action = published ? 'publish' : 'unpublish';
      const res = await API.post(
        `/api/admin/client-releases/${encodeURIComponent(selectedRelease.id)}/${action}`,
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || '发布状态更新失败');
        return;
      }
      showSuccess(published ? '已发布' : '已取消发布');
      if (data) {
        setForm(releaseToForm(data));
      }
      await loadReleases();
    } catch (error) {
      showError(error.message || '发布状态更新失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteRelease = () => {
    if (!selectedRelease) return;
    Modal.confirm({
      title: '删除客户端版本',
      content: `确认删除 ${selectedRelease.version} / ${selectedRelease.fileName}？`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setSaving(true);
        try {
          const res = await API.delete(
            `/api/admin/client-releases/${encodeURIComponent(selectedRelease.id)}`,
          );
          const { success, message } = res.data;
          if (!success) {
            showError(message || '删除失败');
            return Promise.reject(new Error(message || '删除失败'));
          }
          showSuccess('已删除');
          handleNew();
          await loadReleases();
        } catch (error) {
          showError(error.message || '删除失败');
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
              客户端管理
            </Typography.Title>
            <Typography.Text type='tertiary'>
              管理桌面客户端版本、安装包、更新通道和 Electron latest.yml。
            </Typography.Text>
          </div>
          <Space>
            <Button icon={<Plus size={16} />} onClick={handleNew}>
              新建
            </Button>
            <Button
              icon={<RefreshCw size={16} />}
              loading={loading}
              onClick={loadReleases}
            >
              刷新
            </Button>
          </Space>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]'>
          <Card>
            <div className='mb-3 grid grid-cols-[1fr_auto] gap-2'>
              <Input
                placeholder='搜索版本 / 文件名 / 通道'
                value={keyword}
                onChange={setKeyword}
                onEnterPress={loadReleases}
              />
              <Button onClick={loadReleases}>搜索</Button>
            </div>
            <div className='mb-3 grid grid-cols-1 gap-2 md:grid-cols-3'>
              <Select
                value={platformFilter}
                placeholder='平台'
                onChange={setPlatformFilter}
              >
                <Select.Option value=''>全部平台</Select.Option>
                {platformOptions.map((platform) => (
                  <Select.Option key={platform} value={platform}>
                    {platform}
                  </Select.Option>
                ))}
              </Select>
              <Select
                value={archFilter}
                placeholder='架构'
                onChange={setArchFilter}
              >
                <Select.Option value=''>全部架构</Select.Option>
                {archOptions.map((arch) => (
                  <Select.Option key={arch} value={arch}>
                    {arch}
                  </Select.Option>
                ))}
              </Select>
              <Select
                value={channelFilter}
                placeholder='通道'
                onChange={setChannelFilter}
              >
                <Select.Option value=''>全部通道</Select.Option>
                {channelOptions.map((channel) => (
                  <Select.Option key={channel} value={channel}>
                    {channel}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <Spin spinning={loading}>
              <div className='flex max-h-[70vh] flex-col gap-2 overflow-auto pr-1'>
                {releases.map((release) => {
                  const published = isPublishedRelease(release);
                  const forcedLabel = release.minVersion
                    ? `≥${release.minVersion}`
                    : '强更';
                  return (
                    <button
                      key={release.id}
                      type='button'
                      onClick={() => selectRelease(release)}
                      className={`rounded border p-3 text-left transition ${
                        selectedId === release.id
                          ? 'border-semi-color-primary bg-semi-color-primary-light-default'
                          : 'border-semi-color-border bg-semi-color-bg-1 hover:bg-semi-color-fill-0'
                      }`}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <div className='truncate font-semibold'>
                            {release.version}
                          </div>
                          <div className='mt-1 truncate text-xs text-semi-color-text-2'>
                            {release.platform}/{release.arch}/{release.channel}
                          </div>
                        </div>
                        <Space spacing={4}>
                          {release.forced ? (
                            <Tag color='red'>{forcedLabel}</Tag>
                          ) : null}
                          <Tag color={published ? 'green' : 'grey'}>
                            {published ? '已发布' : '草稿'}
                          </Tag>
                        </Space>
                      </div>
                      <div className='mt-2 truncate text-sm text-semi-color-text-1'>
                        {release.fileName}
                      </div>
                      <div className='mt-1 text-xs text-semi-color-text-2'>
                        {formatBytes(release.size)}
                        {release.updatedAt ? ` · ${release.updatedAt}` : ''}
                      </div>
                    </button>
                  );
                })}
                {releases.length === 0 && (
                  <div className='py-8 text-center text-semi-color-text-2'>
                    {loading ? '加载中...' : '暂无客户端版本'}
                  </div>
                )}
              </div>
            </Spin>
          </Card>

          <Card>
            <div className='flex flex-col gap-4'>
              <Section
                title='版本目标'
                description='同一版本可按平台、架构和通道分别维护。'
              >
                <div className='grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1.4fr)_1fr_1fr_1fr]'>
                  <Field label='版本号'>
                    <VersionInput
                      value={form.version}
                      onChange={(value) => updateForm('version', value)}
                    />
                  </Field>
                  <Field label='平台'>
                    <Select
                      value={form.platform}
                      onChange={(value) => updateForm('platform', value)}
                    >
                      {platformOptions.map((platform) => (
                        <Select.Option key={platform} value={platform}>
                          {platform}
                        </Select.Option>
                      ))}
                    </Select>
                  </Field>
                  <Field label='架构'>
                    <Select
                      value={form.arch}
                      onChange={(value) => updateForm('arch', value)}
                    >
                      {archOptions.map((arch) => (
                        <Select.Option key={arch} value={arch}>
                          {arch}
                        </Select.Option>
                      ))}
                    </Select>
                  </Field>
                  <Field label='通道'>
                    <Select
                      value={form.channel}
                      onChange={(value) => updateForm('channel', value)}
                    >
                      {channelOptions.map((channel) => (
                        <Select.Option key={channel} value={channel}>
                          {channel}
                        </Select.Option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Section>

              <Section
                title='安装包'
                description='上传到私有 OSS 后，客户端通过 New API 签名跳转下载。'
              >
                <div className='flex flex-wrap items-center gap-2'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='.exe,.msi,.dmg,.pkg,.zip,.AppImage,.deb,.rpm,.yml,.yaml'
                    className='hidden'
                    onChange={(event) => uploadPackage(event.target.files?.[0])}
                  />
                  <Button
                    icon={<UploadCloud size={16} />}
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    上传到 OSS
                  </Button>
                  {form.fileName ? <Tag>{formatBytes(form.size)}</Tag> : null}
                </div>
                <Field label='文件名'>
                  <ReadonlyValue value={form.fileName} />
                </Field>
                <Field label='OSS Object'>
                  <ReadonlyValue value={form.objectKey} />
                </Field>
                <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                  <Field label='SHA256'>
                    <ReadonlyValue value={form.sha256} />
                  </Field>
                  <Field label='SHA512'>
                    <ReadonlyValue value={form.sha512} />
                  </Field>
                </div>
                {selectedRelease ? (
                  <Space wrap>
                    {selectedRelease.downloadUrl ? (
                      <Button
                        icon={<Download size={16} />}
                        onClick={() =>
                          window.open(selectedRelease.downloadUrl, '_blank')
                        }
                      >
                        下载
                      </Button>
                    ) : null}
                    <Button
                      icon={<FileText size={16} />}
                      onClick={() =>
                        window.open(buildLatestYmlUrl(form), '_blank')
                      }
                    >
                      latest.yml
                    </Button>
                  </Space>
                ) : null}
              </Section>

              <Section
                title='发布策略'
                description='控制可见状态和最低版本强制更新。'
              >
                <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                  <Field label='最低版本'>
                    <VersionInput
                      value={form.minVersion}
                      onChange={(value) => updateForm('minVersion', value)}
                    />
                  </Field>
                  <Field label='发布状态'>
                    <div className='flex h-[34px] items-center gap-3'>
                      <Switch
                        checked={form.published}
                        onChange={(checked) => updateForm('published', checked)}
                      />
                      <span className='text-sm text-semi-color-text-2'>
                        {form.published ? '已发布' : '草稿'}
                      </span>
                    </div>
                  </Field>
                </div>
                <div className='flex items-center gap-3'>
                  <Switch
                    checked={form.forced}
                    onChange={(checked) => updateForm('forced', checked)}
                  />
                  <span className='text-sm text-semi-color-text-1'>
                    低于最低版本时强制更新
                  </span>
                </div>
                <Field label='更新说明'>
                  <TextArea
                    autosize
                    rows={4}
                    value={form.releaseNotes}
                    onChange={(value) => updateForm('releaseNotes', value)}
                  />
                </Field>
              </Section>
            </div>

            <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
              <Space wrap>
                {selectedRelease ? (
                  <>
                    <Button
                      icon={<Check size={16} />}
                      disabled={saving}
                      onClick={() =>
                        setPublished(!isPublishedRelease(selectedRelease))
                      }
                    >
                      {isPublishedRelease(selectedRelease)
                        ? '取消发布'
                        : '发布'}
                    </Button>
                    <Button
                      type='danger'
                      icon={<Trash2 size={16} />}
                      disabled={saving}
                      onClick={deleteRelease}
                    >
                      删除
                    </Button>
                  </>
                ) : null}
              </Space>
              <Button
                type='primary'
                icon={<Save size={16} />}
                loading={saving}
                disabled={uploading}
                onClick={saveRelease}
              >
                保存
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClientReleases;
