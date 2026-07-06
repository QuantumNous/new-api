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

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  KeyRound,
  Search,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react';
import {
  Notification,
  Button,
  Space,
  Toast,
  Typography,
  Select,
} from '@douyinfe/semi-ui';
import {
  API,
  showError,
  getModelCategories,
  selectFilter,
} from '../../../helpers';
import TokensTable from './TokensTable';
import TokensActions from './TokensActions';
import TokensFilters from './TokensFilters';
import EditTokenModal from './modals/EditTokenModal';
import CCSwitchModal from './modals/CCSwitchModal';
import { useTokensData } from '../../../hooks/tokens/useTokensData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const { Text } = Typography;

function TokensPage() {
  // Define the function first, then pass it into the hook to avoid TDZ errors
  const openFluentNotificationRef = useRef(null);
  const openCCSwitchModalRef = useRef(null);
  const tokensData = useTokensData(
    (key) => openFluentNotificationRef.current?.(key),
    (key) => openCCSwitchModalRef.current?.(key),
  );
  const isMobile = useIsMobile();
  const latestRef = useRef({
    tokens: [],
    selectedKeys: [],
    t: (k) => k,
    selectedModel: '',
    prefillKey: '',
    fetchTokenKey: async () => '',
  });
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [fluentNoticeOpen, setFluentNoticeOpen] = useState(false);
  const [prefillKey, setPrefillKey] = useState('');
  const [ccSwitchVisible, setCCSwitchVisible] = useState(false);
  const [ccSwitchKey, setCCSwitchKey] = useState('');

  // Keep latest data for handlers inside notifications
  useEffect(() => {
    latestRef.current = {
      tokens: tokensData.tokens,
      selectedKeys: tokensData.selectedKeys,
      t: tokensData.t,
      selectedModel,
      prefillKey,
      fetchTokenKey: tokensData.fetchTokenKey,
    };
  }, [
    tokensData.tokens,
    tokensData.selectedKeys,
    tokensData.t,
    selectedModel,
    prefillKey,
    tokensData.fetchTokenKey,
  ]);

  const loadModels = async () => {
    try {
      const res = await API.get('/api/user/models');
      const { success, message, data } = res.data || {};
      if (success) {
        const categories = getModelCategories(tokensData.t);
        const options = (data || []).map((model) => {
          let icon = null;
          for (const [key, category] of Object.entries(categories)) {
            if (key !== 'all' && category.filter({ model_name: model })) {
              icon = category.icon;
              break;
            }
          }
          return {
            label: (
              <span className='flex items-center gap-1'>
                {icon}
                {model}
              </span>
            ),
            value: model,
          };
        });
        setModelOptions(options);
      } else {
        showError(tokensData.t(message));
      }
    } catch (e) {
      showError(e.message || 'Failed to load models');
    }
  };

  function openFluentNotification(key) {
    const { t } = latestRef.current;
    const SUPPRESS_KEY = 'fluent_notify_suppressed';
    if (modelOptions.length === 0) {
      // fire-and-forget; a later effect will refresh the notice content
      loadModels();
    }
    if (!key && localStorage.getItem(SUPPRESS_KEY) === '1') return;
    const container = document.getElementById('fluent-new-api-container');
    if (!container) {
      Toast.warning(t('未检测到 FluentRead（流畅阅读），请确认扩展已启用'));
      return;
    }
    setPrefillKey(key || '');
    setFluentNoticeOpen(true);
    Notification.info({
      id: 'fluent-detected',
      title: t('检测到 FluentRead（流畅阅读）'),
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            {key
              ? t('请选择模型。')
              : t('选择模型后可一键填充当前选中令牌（或本页第一个令牌）。')}
          </div>
          <div style={{ marginBottom: 8 }}>
            <Select
              placeholder={t('请选择模型')}
              optionList={modelOptions}
              onChange={setSelectedModel}
              filter={selectFilter}
              style={{ width: 320 }}
              showClear
              searchable
              emptyContent={t('暂无数据')}
            />
          </div>
          <Space>
            <Button
              theme='solid'
              type='primary'
              onClick={handlePrefillToFluent}
            >
              {t('一键填充到 FluentRead')}
            </Button>
            {!key && (
              <Button
                type='warning'
                onClick={() => {
                  localStorage.setItem(SUPPRESS_KEY, '1');
                  Notification.close('fluent-detected');
                  Toast.info(t('已关闭后续提醒'));
                }}
              >
                {t('不再提醒')}
              </Button>
            )}
            <Button
              type='tertiary'
              onClick={() => Notification.close('fluent-detected')}
            >
              {t('关闭')}
            </Button>
          </Space>
        </div>
      ),
      duration: 0,
    });
  }
  // assign after definition so hook callback can call it safely
  openFluentNotificationRef.current = openFluentNotification;

  function openCCSwitchModal(key) {
    if (modelOptions.length === 0) {
      loadModels();
    }
    setCCSwitchKey(key || '');
    setCCSwitchVisible(true);
  }
  openCCSwitchModalRef.current = openCCSwitchModal;

  // Prefill to Fluent handler
  const handlePrefillToFluent = async () => {
    const {
      tokens,
      selectedKeys,
      t,
      selectedModel: chosenModel,
      prefillKey: overrideKey,
      fetchTokenKey,
    } = latestRef.current;
    const container = document.getElementById('fluent-new-api-container');
    if (!container) {
      Toast.error(t('未检测到 Fluent 容器'));
      return;
    }

    if (!chosenModel) {
      Toast.warning(t('请选择模型'));
      return;
    }

    let status = localStorage.getItem('status');
    let serverAddress = '';
    if (status) {
      try {
        status = JSON.parse(status);
        serverAddress = status.server_address || '';
      } catch (_) {}
    }
    if (!serverAddress) serverAddress = window.location.origin;

    let apiKeyToUse = '';
    if (overrideKey) {
      apiKeyToUse = 'sk-' + overrideKey;
    } else {
      const token =
        selectedKeys && selectedKeys.length === 1
          ? selectedKeys[0]
          : tokens && tokens.length > 0
            ? tokens[0]
            : null;
      if (!token) {
        Toast.warning(t('没有可用令牌用于填充'));
        return;
      }
      try {
        apiKeyToUse = 'sk-' + (await fetchTokenKey(token));
      } catch (_) {
        return;
      }
    }

    const payload = {
      id: 'new-api',
      baseUrl: serverAddress,
      apiKey: apiKeyToUse,
      model: chosenModel,
    };

    container.dispatchEvent(
      new CustomEvent('fluent:prefill', { detail: payload }),
    );
    Toast.success(t('已发送到 Fluent'));
    Notification.close('fluent-detected');
  };

  // Show notification when Fluent container is available
  useEffect(() => {
    const onAppeared = () => {
      openFluentNotification();
    };
    const onRemoved = () => {
      setFluentNoticeOpen(false);
      Notification.close('fluent-detected');
    };

    window.addEventListener('fluent-container:appeared', onAppeared);
    window.addEventListener('fluent-container:removed', onRemoved);
    return () => {
      window.removeEventListener('fluent-container:appeared', onAppeared);
      window.removeEventListener('fluent-container:removed', onRemoved);
    };
  }, []);

  // When modelOptions or language changes while the notice is open, refresh the content
  useEffect(() => {
    if (fluentNoticeOpen) {
      openFluentNotification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOptions, selectedModel, tokensData.t, fluentNoticeOpen]);

  useEffect(() => {
    const selector = '#fluent-new-api-container';
    const root = document.body || document.documentElement;

    const existing = document.querySelector(selector);
    if (existing) {
      console.log('Fluent container detected (initial):', existing);
      window.dispatchEvent(
        new CustomEvent('fluent-container:appeared', { detail: existing }),
      );
    }

    const isOrContainsTarget = (node) => {
      if (!(node && node.nodeType === 1)) return false;
      if (node.id === 'fluent-new-api-container') return true;
      return (
        typeof node.querySelector === 'function' &&
        !!node.querySelector(selector)
      );
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // appeared
        for (const added of m.addedNodes) {
          if (isOrContainsTarget(added)) {
            const el = document.querySelector(selector);
            if (el) {
              console.log('Fluent container appeared:', el);
              window.dispatchEvent(
                new CustomEvent('fluent-container:appeared', { detail: el }),
              );
            }
            break;
          }
        }
        // removed
        for (const removed of m.removedNodes) {
          if (isOrContainsTarget(removed)) {
            const elNow = document.querySelector(selector);
            if (!elNow) {
              console.log('Fluent container removed');
              window.dispatchEvent(new CustomEvent('fluent-container:removed'));
            }
            break;
          }
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const {
    // Edit state
    showEdit,
    editingToken,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setEditingToken,
    setShowEdit,
    batchCopyTokens,
    batchDeleteTokens,

    // Filters state
    formInitValues,
    setFormApi,
    searchTokens,
    loading,
    searching,

    // Description state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = tokensData;

  const selectedCount = selectedKeys?.length || 0;
  const currentPageCount = tokensData.tokens?.length || 0;
  const tokenCount = tokensData.tokenCount || 0;
  const paginationArea = createCardProPagination({
    currentPage: tokensData.activePage,
    pageSize: tokensData.pageSize,
    total: tokenCount,
    onPageChange: tokensData.handlePageChange,
    onPageSizeChange: tokensData.handlePageSizeChange,
    isMobile: isMobile,
    t: tokensData.t,
  });

  return (
    <>
      <EditTokenModal
        refresh={refresh}
        editingToken={editingToken}
        visiable={showEdit}
        handleClose={closeEdit}
      />

      <CCSwitchModal
        visible={ccSwitchVisible}
        onClose={() => setCCSwitchVisible(false)}
        tokenKey={ccSwitchKey}
        modelOptions={modelOptions}
      />

      <div className='tokens-wallet-layout console-dashboard-content h-full'>
        <div className='tokens-wallet-hero mb-8 overflow-hidden rounded-[28px] border'>
          <div className='grid gap-0'>
            <div className='tokens-hero-main bg-white p-6 sm:p-8'>
              <div className='tokens-hero-head flex items-start justify-between gap-4'>
                <div>
                  <div className='tokens-hero-eyebrow mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600'>
                    <Activity size={14} />
                    {t('接口凭证总览')}
                  </div>
                  <Typography.Title
                    className='tokens-hero-title'
                    heading={2}
                    style={{
                      margin: 0,
                      color: 'var(--console-text-strong)',
                      fontSize: 32,
                      lineHeight: 1.08,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {t('令牌管理')}
                  </Typography.Title>
                  <div className='tokens-hero-desc mt-2 max-w-md text-sm leading-6 text-slate-500'>
                    {t('设置令牌的基本信息')}
                  </div>
                </div>
                <div className='tokens-hero-icon hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white sm:flex'>
                  <KeyRound size={22} />
                </div>
              </div>

              <div className='mt-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                <div>
                  <div className='tokens-hero-stat-label text-xs font-semibold uppercase tracking-[0.22em] text-slate-400'>
                    {t('当前令牌')}
                  </div>
                  <div className='tokens-hero-stat-value mt-3 text-5xl font-black tracking-[-0.07em] text-slate-950 sm:text-6xl'>
                    {tokenCount}
                  </div>
                </div>
                <div className='tokens-compact-toggle'>
                  <Button
                    type='tertiary'
                    icon={<SlidersHorizontal size={15} />}
                    onClick={() => setCompactMode(!compactMode)}
                  >
                    {compactMode ? t('紧凑模式') : t('标准模式')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='tokens-workspace-grid grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
          <div className='tokens-table-card overflow-hidden rounded-[28px] border'>
            <div className='tokens-table-card-header flex flex-col gap-4 border-b border-slate-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-center gap-3'>
                <div className='tokens-table-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white'>
                  <WalletCards size={18} />
                </div>
                <div>
                  <Text
                    strong
                    style={{
                      display: 'block',
                      color: 'var(--console-text-strong)',
                      fontSize: 16,
                    }}
                  >
                    {t('令牌列表')}
                  </Text>
                  <Text
                    size='small'
                    style={{ color: 'var(--semi-color-text-2)' }}
                  >
                    {loading || searching
                      ? t('正在加载数据')
                      : `${t('显示第')} ${currentPageCount} ${t('条，共')} ${tokenCount} ${t('条')}`}
                  </Text>
                </div>
              </div>
              <TokensActions
                selectedKeys={selectedKeys}
                setEditingToken={setEditingToken}
                setShowEdit={setShowEdit}
                batchCopyTokens={batchCopyTokens}
                batchDeleteTokens={batchDeleteTokens}
                t={t}
              />
            </div>

            <div className='tokens-table-wrap bg-white p-3 sm:p-4'>
              <TokensTable {...tokensData} />
            </div>

            {paginationArea && (
              <div className='tokens-pagination-bar flex flex-col gap-3 border-t border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between'>
                {paginationArea}
              </div>
            )}
          </div>

          <div className='tokens-tools-card rounded-[28px] border p-5'>
            <div className='mb-5 flex items-center justify-between gap-4'>
              <div>
                <div className='flex items-center gap-2 text-sm font-semibold text-slate-500'>
                  <Search size={16} />
                  {t('筛选令牌')}
                </div>
                <div className='mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950'>
                  {searching ? t('搜索中') : t('快速查询')}
                </div>
              </div>
              <ArrowUpRight size={18} className='text-slate-300' />
            </div>

            <TokensFilters
              formInitValues={formInitValues}
              setFormApi={setFormApi}
              searchTokens={searchTokens}
              loading={loading}
              searching={searching}
              t={t}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default TokensPage;
