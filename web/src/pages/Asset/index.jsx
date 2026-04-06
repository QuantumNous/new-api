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
  IconEyeClosed,
  IconEyeOpened,
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

const buildCreativeCenterMediaDownloadUrl = (url, filename) => {
  if (typeof url !== 'string') {
    return '';
  }
  const trimmedURL = url.trim();
  if (!trimmedURL) {
    return '';
  }
  if (trimmedURL.startsWith('data:')) {
    return trimmedURL;
  }
  return `${API_ENDPOINTS.CREATIVE_CENTER_MEDIA_DOWNLOAD}?url=${encodeURIComponent(trimmedURL)}&filename=${encodeURIComponent(filename || '')}`;
};

const formatAssetTime = (timestamp) => {
  if (!timestamp) {
    return '-';
  }
  const normalizedTimestamp = timestamp > 9999999999 ? Math.floor(timestamp / 1000) : timestamp;
  return timestamp2string(normalizedTimestamp);
};

const parseDateValueToTimestamp = (value) => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Math.floor(value.getTime() / 1000);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 9999999999 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  if (typeof value?.valueOf === 'function') {
    const parsedValue = value.valueOf();
    if (typeof parsedValue === 'number' && Number.isFinite(parsedValue)) {
      return parsedValue > 9999999999
        ? Math.floor(parsedValue / 1000)
        : parsedValue;
    }
  }
  return undefined;
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
  const fileName = getAssetDownloadName(asset, index);
  const downloadUrl = buildCreativeCenterMediaDownloadUrl(asset?.media_url || '', fileName);
  if (!downloadUrl) {
    showError('暂无可下载的资源');
    return;
  }
  const link = document.createElement('a');
  link.rel = 'noreferrer';
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  const [selectedAssetMap, setSelectedAssetMap] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const [formInitValues] = useState(() => {
    const now = new Date();
    const zeroNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      type: 'all',
      keyword: '',
      model_name: '',
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

  const buildQueryParams = (values = {}) => {
    const dateRange = Array.isArray(values.dateRange) ? values.dateRange : [];
    const startTimestamp = parseDateValueToTimestamp(dateRange[0]);
    const endTimestamp = parseDateValueToTimestamp(dateRange[1]);

    return {
      type: values.type || 'all',
      keyword: values.keyword || '',
      model_name: values.model_name || '',
      username: isAdminUser ? values.username || '' : '',
      start_timestamp:
        Number.isFinite(startTimestamp) && startTimestamp > 0
          ? startTimestamp
          : undefined,
      end_timestamp:
        Number.isFinite(endTimestamp) && endTimestamp > 0 ? endTimestamp : undefined,
    };
  };

  const [queryParams, setQueryParams] = useState(() => buildQueryParams(formInitValues));

  const getFormValues = () => {
    const values = formApi?.getValues?.() || formInitValues;
    return buildQueryParams(values);
  };

  const syncAssetData = (payload) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    setAssets(items);
    setAssetCount(payload?.total || 0);
    setActivePage(payload?.page || 1);
    setPageSize(payload?.page_size || pageSize);
    setSelectedAssetMap((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.asset_id]) {
          next[asset.asset_id] = asset;
        }
      });
      return next;
    });
  };

  const loadAssets = async (page = 1, size = pageSize, filters = queryParams) => {
    setLoading(true);
    try {
      const endpoint = isAdminUser ? '/api/asset/' : '/api/asset/self';
      const params = {
        p: page,
        page_size: size,
        ...filters,
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
    const storedPreviewMode = localStorage.getItem('asset-library-show-preview');
    if (storedPreviewMode === 'true') {
      setShowPreview(true);
    }
    const initialQueryParams = buildQueryParams(formInitValues);
    setQueryParams(initialQueryParams);
    loadAssets(1, localPageSize, initialQueryParams).then();
  }, []);

  useEffect(() => {
    localStorage.setItem('asset-library-show-preview', showPreview ? 'true' : 'false');
  }, [showPreview]);

  const refresh = async () => {
    const nextQueryParams = getFormValues();
    setQueryParams(nextQueryParams);
    setSelectedIds([]);
    setSelectedAssetMap({});
    await loadAssets(1, pageSize, nextQueryParams);
  };

  const handlePageChange = (page) => {
    loadAssets(page, pageSize, queryParams).then();
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('asset-library-page-size', `${size}`);
    setSelectedIds([]);
    setSelectedAssetMap({});
    await loadAssets(1, size, queryParams);
  };

  const handleToggleSelect = (asset) => {
    const assetID = asset?.asset_id;
    if (!assetID) {
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(assetID)
        ? prev.filter((id) => id !== assetID)
        : [...prev, assetID],
    );
    setSelectedAssetMap((prev) => {
      if (prev[assetID]) {
        const next = { ...prev };
        delete next[assetID];
        return next;
      }
      return {
        ...prev,
        [assetID]: asset,
      };
    });
  };

  const toggleSelectCurrentPage = () => {
    const currentPageIds = assets.map((asset) => asset.asset_id);
    const alreadySelected = currentPageIds.every((id) => selectedIds.includes(id));

    if (alreadySelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
      setSelectedAssetMap((prev) => {
        const next = { ...prev };
        currentPageIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    setSelectedAssetMap((prev) => {
      const next = { ...prev };
      assets.forEach((asset) => {
        next[asset.asset_id] = asset;
      });
      return next;
    });
  };

  const handleBatchDownload = async () => {
    if (selectedIds.length === 0) {
      showError('请先选择要下载的资产');
      return;
    }

    setDownloading(true);
    try {
      const selectedAssets = selectedIds
        .map((assetID) => selectedAssetMap[assetID])
        .filter(Boolean);
      if (selectedAssets.length === 0) {
        showError('未找到可下载的素材，请重新选择后再试');
        return;
      }

      selectedAssets.forEach((asset, index) => {
        window.setTimeout(() => {
          downloadAssetByUrl(asset, index);
        }, index * 120);
      });
      showSuccess('批量下载已开始');
      return;

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
            批量下载
          </Button>
          <Button size='small' type='tertiary' onClick={toggleSelectCurrentPage}>
            {assets.length > 0 &&
            assets.every((asset) => selectedIds.includes(asset.asset_id))
              ? '取消全选本页'
              : '全选本页'}
          </Button>
          <Button
            size='small'
            type={showPreview ? 'secondary' : 'tertiary'}
            icon={showPreview ? <IconEyeOpened /> : <IconEyeClosed />}
            onClick={() => setShowPreview((prev) => !prev)}
          >
            预览 {showPreview ? '开' : '关'}
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
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2'>
          <Form.Select
            field='type'
            optionList={ASSET_TYPE_OPTIONS}
            placeholder='资产类型'
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
            placeholder='提示词 / 会话名'
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
              />
            </div>
          ) : (
            <div
              className={`grid gap-3 ${showPreview ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}`}
            >
              {assets.map((asset, index) => {
                const previewUrl = getAssetPreviewUrl(asset);
                const checked = selectedIds.includes(asset.asset_id);

                return (
                  <Card
                    key={asset.asset_id}
                    shadows='hover'
                    bordered={true}
                    bodyStyle={{ padding: 12 }}
                    className={`!rounded-2xl transition-all ${checked ? 'ring-2 ring-[var(--semi-color-primary)]' : ''}`}
                    headerLine={false}
                    title={
                      <div className='flex items-center gap-2 min-w-0'>
                        <label className='flex items-center gap-2 min-w-0 cursor-pointer'>
                          <input
                            type='checkbox'
                            checked={checked}
                            onChange={() => handleToggleSelect(asset)}
                          />
                          <Tag
                            color={asset.asset_type === 'video' ? 'purple' : 'blue'}
                            size='small'
                          >
                            {asset.asset_type === 'video' ? '视频' : '图片'}
                          </Tag>
                        </label>
                      </div>
                    }
                  >
                    <div className={`flex flex-col ${showPreview ? 'gap-2.5' : 'gap-2'}`}>
                      {showPreview ? (
                        <button
                          type='button'
                          className='relative overflow-hidden rounded-xl border bg-[var(--semi-color-fill-0)] aspect-square cursor-pointer'
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
                                <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900'>
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
                      ) : null}

                      <div className='flex flex-wrap gap-2'>
                        <Tag color='white' size='small'>
                          {asset.model_name || '未命名模型'}
                        </Tag>
                        {asset.group ? (
                          <Tag color='grey' size='small'>
                            {asset.group}
                          </Tag>
                        ) : null}
                        {isAdminUser && asset.username ? (
                          <Tag color='light-blue' size='small'>
                            {asset.username}
                          </Tag>
                        ) : null}
                      </div>

                      <div className={showPreview ? 'min-h-[52px]' : 'min-h-[38px]'}>
                        <Paragraph
                          ellipsis={{ rows: showPreview ? 2 : 1, showTooltip: true }}
                          style={{
                            marginBottom: 0,
                            wordBreak: 'break-word',
                            fontSize: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          {asset.prompt || '未记录提示词'}
                        </Paragraph>
                      </div>

                      <div className={`grid grid-cols-1 text-xs ${showPreview ? 'gap-2' : 'gap-1.5'}`}>
                        <div className='rounded-xl px-3 py-2 bg-[var(--semi-color-fill-0)]'>
                          <Text type='tertiary' size='small'>
                            会话
                          </Text>
                          <div className='mt-1 font-medium break-all'>
                            {asset.session_name || asset.session_id || '-'}
                          </div>
                        </div>
                        <div className='rounded-xl px-3 py-2 bg-[var(--semi-color-fill-0)]'>
                          <Text type='tertiary' size='small'>
                            创建时间
                          </Text>
                          <div className='mt-1 font-medium text-[12px]'>
                            {formatAssetTime(asset.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className='flex gap-2'>
                        <Button
                          block
                          type='tertiary'
                          icon={<Eye size={14} />}
                          size='small'
                          onClick={() => setPreviewAsset(asset)}
                        >
                          预览
                        </Button>
                        <Button
                          block
                          type='primary'
                          icon={<Download size={14} />}
                          size='small'
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
