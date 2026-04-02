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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Layout,
  Modal,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDownload,
  IconPlay,
  IconRefresh,
  IconSearch,
} from '@douyinfe/semi-icons';
import {
  Download,
  Eye,
  Image as ImageIcon,
  PackageOpen,
  Video,
} from 'lucide-react';

import CardPro from '../../components/common/ui/CardPro';
import { ITEMS_PER_PAGE } from '../../constants';
import { DATE_RANGE_PRESETS } from '../../constants/console.constants';
import { API_ENDPOINTS } from '../../constants/playground.constants';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import {
  API,
  createCardProPagination,
  isAdmin,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';

const { Text, Paragraph } = Typography;

const ASSET_TYPE_OPTIONS = [
  { label: '全部类型', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
];

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '已完成', value: 'completed' },
  { label: '处理中', value: 'processing' },
  { label: '排队中', value: 'queued' },
  { label: '失败', value: 'failed' },
];

const statusMap = {
  completed: { color: 'green', label: '已完成' },
  processing: { color: 'blue', label: '处理中' },
  queued: { color: 'yellow', label: '排队中' },
  failed: { color: 'red', label: '失败' },
  pending: { color: 'grey', label: '待处理' },
};

const buildCreativeCenterImageDisplayUrl = (url) => {
  if (typeof url !== 'string') {
    return '';
  }
  const trimmedURL = url.trim();
  if (!trimmedURL) {
    return '';
  }
  if (!/^https?:\/\//i.test(trimmedURL)) {
    return trimmedURL;
  }
  return `${API_ENDPOINTS.CREATIVE_CENTER_IMAGE_PROXY}?url=${encodeURIComponent(trimmedURL)}`;
};

const formatAssetTime = (timestamp) => {
  if (!timestamp) {
    return '-';
  }
  return timestamp2string(timestamp);
};

const getAssetPreviewUrl = (asset) => {
  if (!asset) {
    return '';
  }
  if (asset.asset_type === 'image') {
    return buildCreativeCenterImageDisplayUrl(asset.thumbnail_url || asset.media_url);
  }
  return asset.thumbnail_url || asset.media_url || '';
};

const getAssetStatusMeta = (status) =>
  statusMap[status] || { color: 'grey', label: status || '未知' };

const sanitizeFileNameSegment = (value, fallback) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
};

const getAssetFileExtension = (asset) => {
  const mediaURL = asset?.media_url || '';
  if (mediaURL.startsWith('data:image/')) {
    return mediaURL.slice(11, mediaURL.indexOf(';')) || 'png';
  }
  if (mediaURL.startsWith('data:video/')) {
    return mediaURL.slice(11, mediaURL.indexOf(';')) || 'mp4';
  }
  try {
    const parsedURL = new URL(mediaURL, window.location.origin);
    const match = parsedURL.pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  } catch (error) {
    return asset?.asset_type === 'video' ? 'mp4' : 'png';
  }
  return asset?.asset_type === 'video' ? 'mp4' : 'png';
};

const getAssetDownloadName = (asset, index = 0) => {
  const type = sanitizeFileNameSegment(asset?.asset_type, 'asset');
  const model = sanitizeFileNameSegment(asset?.model_name, 'model');
  const session = sanitizeFileNameSegment(asset?.session_name, 'session');
  const ext = getAssetFileExtension(asset);
  return `${type}-${model}-${session}-${index + 1}.${ext}`;
};

const downloadAssetByUrl = (asset, index = 0) => {
  const link = document.createElement('a');
  link.rel = 'noreferrer';
  link.target = '_blank';
  link.href =
    asset?.asset_type === 'image'
      ? buildCreativeCenterImageDisplayUrl(asset?.media_url || '')
      : asset?.media_url || '';
  link.download = getAssetDownloadName(asset, index);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadBlobResponse = (blob, fallbackName, responseHeaders) => {
  const headerName = responseHeaders?.['content-disposition'];
  let fileName = fallbackName;
  if (typeof headerName === 'string') {
    const match = headerName.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) {
      fileName = decodeURIComponent(match[1]);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

const AssetLibrary = () => {
  const isMobile = useIsMobile();
  const isAdminUser = isAdmin();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [assetCount, setAssetCount] = useState(0);
  const [formApi, setFormApi] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [formInitValues] = useState(() => {
    const now = new Date();
    const zeroNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      type: 'all',
      keyword: '',
      model_name: '',
      status: 'all',
      username: '',
      dateRange: [
        timestamp2string(zeroNow.getTime() / 1000),
        timestamp2string(now.getTime() / 1000 + 3600),
      ],
    };
  });

  const summaryStats = useMemo(() => {
    const imageCount = assets.filter((asset) => asset.asset_type === 'image').length;
    const videoCount = assets.filter((asset) => asset.asset_type === 'video').length;
    return { imageCount, videoCount };
  }, [assets]);

  const getFormValues = () => {
    const values = formApi?.getValues?.() || {};
    const dateRange = Array.isArray(values.dateRange) ? values.dateRange : [];
    const startTimestamp = dateRange[0]
      ? parseInt(Date.parse(dateRange[0]) / 1000)
      : undefined;
    const endTimestamp = dateRange[1]
      ? parseInt(Date.parse(dateRange[1]) / 1000)
      : undefined;

    return {
      type: values.type || 'all',
      keyword: values.keyword || '',
      model_name: values.model_name || '',
      status: values.status || 'all',
      username: isAdminUser ? values.username || '' : '',
      start_timestamp:
        Number.isFinite(startTimestamp) && startTimestamp > 0
          ? startTimestamp
          : undefined,
      end_timestamp:
        Number.isFinite(endTimestamp) && endTimestamp > 0 ? endTimestamp : undefined,
    };
  };

  const syncAssetData = (payload) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    setAssets(items);
    setAssetCount(payload?.total || 0);
    setActivePage(payload?.page || 1);
    setPageSize(payload?.page_size || pageSize);
  };

  const loadAssets = async (page = 1, size = pageSize) => {
    setLoading(true);
    try {
      const endpoint = isAdminUser ? '/api/asset/' : '/api/asset/self';
      const params = {
        p: page,
        page_size: size,
        ...getFormValues(),
      };
      const res = await API.get(endpoint, { params });
      const { success, message, data } = res.data;
      if (success) {
        syncAssetData(data);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const localPageSize =
      parseInt(localStorage.getItem('asset-library-page-size'), 10) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadAssets(1, localPageSize).then();
  }, []);

  const refresh = async () => {
    setSelectedIds([]);
    await loadAssets(1, pageSize);
  };

  const handlePageChange = (page) => {
    loadAssets(page, pageSize).then();
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('asset-library-page-size', `${size}`);
    setSelectedIds([]);
    await loadAssets(1, size);
  };

  const handleToggleSelect = (assetID) => {
    setSelectedIds((prev) =>
      prev.includes(assetID)
        ? prev.filter((id) => id !== assetID)
        : [...prev, assetID],
    );
  };

  const toggleSelectCurrentPage = () => {
    const currentPageIds = assets.map((asset) => asset.asset_id);
    const alreadySelected = currentPageIds.every((id) => selectedIds.includes(id));

    if (alreadySelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
  };

  const handleBatchDownload = async () => {
    if (selectedIds.length === 0) {
      showError('请先选择要下载的资产');
      return;
    }

    setDownloading(true);
    try {
      const endpoint = isAdminUser
        ? '/api/asset/download'
        : '/api/asset/self/download';
      const response = await API.post(
        endpoint,
        { asset_ids: selectedIds },
        {
          responseType: 'blob',
          skipErrorHandler: true,
        },
      );

      const contentType = response.headers?.['content-type'] || '';
      if (contentType.includes('application/json')) {
        const errorText = await response.data.text();
        try {
          const parsed = JSON.parse(errorText);
          showError(parsed.message || '批量下载失败');
        } catch (error) {
          showError('批量下载失败');
        }
        return;
      }

      downloadBlobResponse(
        response.data,
        `creative-center-assets-${Date.now()}.zip`,
        response.headers,
      );
      showSuccess('批量下载任务已开始');
    } catch (error) {
      if (error?.response?.data instanceof Blob) {
        try {
          const errorText = await error.response.data.text();
          const parsed = JSON.parse(errorText);
          showError(parsed.message || '批量下载失败');
          return;
        } catch (parseError) {
          showError('批量下载失败');
          return;
        }
      }
      showError(error);
    } finally {
      setDownloading(false);
    }
  };

  const statsArea = (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Tag color='light-blue' shape='circle'>
          当前页 {assets.length} 条
        </Tag>
        <Tag color='cyan' shape='circle'>
          图片 {summaryStats.imageCount}
        </Tag>
        <Tag color='purple' shape='circle'>
          视频 {summaryStats.videoCount}
        </Tag>
        <Tag color={selectedIds.length > 0 ? 'green' : 'grey'} shape='circle'>
          已选 {selectedIds.length}
        </Tag>
      </div>
      <div className='flex flex-wrap items-center gap-2 justify-between'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            size='small'
            type='primary'
            icon={<IconDownload />}
            disabled={selectedIds.length === 0}
            loading={downloading}
            onClick={handleBatchDownload}
          >
            批量下载 ZIP
          </Button>
          <Button size='small' type='tertiary' onClick={toggleSelectCurrentPage}>
            {assets.length > 0 &&
            assets.every((asset) => selectedIds.includes(asset.asset_id))
              ? '取消全选本页'
              : '全选本页'}
          </Button>
        </div>
        <Button
          size='small'
          type='tertiary'
          icon={<IconRefresh />}
          loading={loading}
          onClick={refresh}
        >
          刷新
        </Button>
      </div>
    </div>
  );

  const searchArea = (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => setFormApi(api)}
      onSubmit={refresh}
      allowEmpty={true}
      autoComplete='off'
      layout='vertical'
      trigger='change'
      stopValidateWithError={false}
    >
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2'>
          <Form.Select
            field='type'
            optionList={ASSET_TYPE_OPTIONS}
            placeholder='资产类型'
            pure
            size='small'
          />
          <Form.Select
            field='status'
            optionList={STATUS_OPTIONS}
            placeholder='状态'
            pure
            size='small'
          />
          <Form.Input
            field='model_name'
            prefix={<IconSearch />}
            placeholder='模型名称'
            showClear
            pure
            size='small'
          />
          {isAdminUser && (
            <Form.Input
              field='username'
              prefix={<IconSearch />}
              placeholder='用户名'
              showClear
              pure
              size='small'
            />
          )}
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
          <Form.Input
            field='keyword'
            prefix={<IconSearch />}
            placeholder='关键词 / 提示词 / 会话名'
            showClear
            pure
            size='small'
          />
          <Form.DatePicker
            field='dateRange'
            className='w-full'
            type='dateTimeRange'
            placeholder={['开始时间', '结束时间']}
            showClear
            pure
            size='small'
            presets={DATE_RANGE_PRESETS.map((preset) => ({
              text: preset.text,
              start: preset.start(),
              end: preset.end(),
            }))}
          />
        </div>

        <div className='flex justify-end gap-2'>
          <Button size='small' type='tertiary' htmlType='submit' loading={loading}>
            查询
          </Button>
          <Button
            size='small'
            type='tertiary'
            onClick={() => {
              formApi?.reset?.();
              setTimeout(() => {
                refresh().then();
              }, 100);
            }}
          >
            重置
          </Button>
        </div>
      </div>
    </Form>
  );

  return (
    <div className='mt-[60px] px-2'>
      <Layout>
        <CardPro
          type='type2'
          statsArea={statsArea}
          searchArea={searchArea}
          paginationArea={createCardProPagination({
            currentPage: activePage,
            pageSize: pageSize,
            total: assetCount,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
            isMobile: isMobile,
          })}
        >
          {assets.length === 0 ? (
            <div className='py-14'>
              <Empty
                image={<PackageOpen size={48} />}
                title='暂无可展示的创作中心资产'
                description='生成成功的图片和视频会在这里统一展示。'
              />
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'>
              {assets.map((asset, index) => {
                const statusMeta = getAssetStatusMeta(asset.status);
                const previewUrl = getAssetPreviewUrl(asset);
                const checked = selectedIds.includes(asset.asset_id);

                return (
                  <Card
                    key={asset.asset_id}
                    shadows='hover'
                    bordered={true}
                    bodyStyle={{ padding: 16 }}
                    className={`!rounded-2xl transition-all ${checked ? 'ring-2 ring-[var(--semi-color-primary)]' : ''}`}
                    headerLine={false}
                    title={
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2 min-w-0'>
                          <input
                            type='checkbox'
                            checked={checked}
                            onChange={() => handleToggleSelect(asset.asset_id)}
                          />
                          <Tag color={asset.asset_type === 'video' ? 'purple' : 'blue'}>
                            {asset.asset_type === 'video' ? '视频' : '图片'}
                          </Tag>
                        </div>
                        <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                      </div>
                    }
                  >
                    <div className='flex flex-col gap-3'>
                      <button
                        type='button'
                        className='relative overflow-hidden rounded-2xl border bg-[var(--semi-color-fill-0)] aspect-[4/3] cursor-pointer'
                        style={{ borderColor: 'var(--semi-color-border)' }}
                        onClick={() => setPreviewAsset(asset)}
                      >
                        {asset.asset_type === 'image' ? (
                          previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={asset.prompt || 'creative asset'}
                              className='w-full h-full object-cover'
                            />
                          ) : (
                            <div className='w-full h-full flex items-center justify-center'>
                              <ImageIcon size={36} />
                            </div>
                          )
                        ) : previewUrl ? (
                          <>
                            <video
                              src={previewUrl}
                              className='w-full h-full object-cover'
                              muted
                              preload='metadata'
                            />
                            <div className='absolute inset-0 flex items-center justify-center bg-black/20'>
                              <span className='inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900'>
                                <IconPlay />
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className='w-full h-full flex items-center justify-center'>
                            <Video size={36} />
                          </div>
                        )}
                      </button>

                      <div className='flex flex-wrap gap-2'>
                        <Tag color='white'>{asset.model_name || '未命名模型'}</Tag>
                        {asset.group ? <Tag color='grey'>{asset.group}</Tag> : null}
                        {isAdminUser && asset.username ? (
                          <Tag color='light-blue'>{asset.username}</Tag>
                        ) : null}
                      </div>

                      <div className='min-h-[72px]'>
                        <Paragraph
                          ellipsis={{ rows: 3, showTooltip: true }}
                          style={{ marginBottom: 0, wordBreak: 'break-word' }}
                        >
                          {asset.prompt || '未记录提示词'}
                        </Paragraph>
                      </div>

                      <div className='grid grid-cols-2 gap-2 text-xs'>
                        <div className='rounded-xl p-3 bg-[var(--semi-color-fill-0)]'>
                          <Text type='tertiary'>会话</Text>
                          <div className='mt-1 font-medium break-all'>
                            {asset.session_name || asset.session_id || '-'}
                          </div>
                        </div>
                        <div className='rounded-xl p-3 bg-[var(--semi-color-fill-0)]'>
                          <Text type='tertiary'>记录 ID</Text>
                          <div className='mt-1 font-medium break-all'>
                            {asset.record_id || '-'}
                          </div>
                        </div>
                        <div className='rounded-xl p-3 bg-[var(--semi-color-fill-0)] col-span-2'>
                          <Text type='tertiary'>创建时间</Text>
                          <div className='mt-1 font-medium'>
                            {formatAssetTime(asset.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className='flex gap-2'>
                        <Button
                          block
                          type='tertiary'
                          icon={<Eye size={14} />}
                          onClick={() => setPreviewAsset(asset)}
                        >
                          预览
                        </Button>
                        <Button
                          block
                          type='primary'
                          icon={<Download size={14} />}
                          onClick={() => downloadAssetByUrl(asset, index)}
                        >
                          下载
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardPro>
      </Layout>

      <Modal
        title={previewAsset?.asset_type === 'video' ? '视频预览' : '图片预览'}
        visible={Boolean(previewAsset)}
        onCancel={() => setPreviewAsset(null)}
        footer={null}
        width={previewAsset?.asset_type === 'video' ? 920 : 760}
      >
        {previewAsset ? (
          <div className='flex flex-col gap-3'>
            {previewAsset.asset_type === 'video' ? (
              <video
                src={previewAsset.media_url}
                controls
                autoPlay
                className='w-full rounded-2xl bg-black'
                style={{ maxHeight: '70vh' }}
              />
            ) : (
              <img
                src={buildCreativeCenterImageDisplayUrl(previewAsset.media_url)}
                alt={previewAsset.prompt || 'creative asset'}
                className='w-full rounded-2xl object-contain bg-[var(--semi-color-fill-0)]'
                style={{ maxHeight: '70vh' }}
              />
            )}
            <div className='flex flex-wrap gap-2'>
              <Tag color='white'>{previewAsset.model_name || '未命名模型'}</Tag>
              <Tag color='grey'>{previewAsset.session_name || previewAsset.session_id}</Tag>
              {isAdminUser && previewAsset.username ? (
                <Tag color='light-blue'>{previewAsset.username}</Tag>
              ) : null}
            </div>
            <Paragraph style={{ marginBottom: 0, wordBreak: 'break-word' }}>
              {previewAsset.prompt || '未记录提示词'}
            </Paragraph>
            <div className='flex justify-end'>
              <Button
                type='primary'
                icon={<IconDownload />}
                onClick={() => downloadAssetByUrl(previewAsset)}
              >
                下载当前资源
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AssetLibrary;
