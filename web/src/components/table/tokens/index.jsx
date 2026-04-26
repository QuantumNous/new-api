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
import { Button } from '@heroui/react';
import { X } from 'lucide-react';
import {
  API,
  getModelCategories,
  showError,
  showInfo,
  showSuccess,
  showWarning,
} from '../../../helpers';
import CardPro from '../../common/ui/CardPro';
import TokensTable from './TokensTable';
import TokensActions from './TokensActions';
import TokensFilters from './TokensFilters';
import TokensDescription from './TokensDescription';
import EditTokenModal from './modals/EditTokenModal';
import CCSwitchModal from './modals/CCSwitchModal';
import { useTokensData } from '../../../hooks/tokens/useTokensData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

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

  const SUPPRESS_KEY = 'fluent_notify_suppressed';

  function openFluentNotification(key) {
    const { t } = latestRef.current;
    if (modelOptions.length === 0) {
      // fire-and-forget; the panel will re-render once options resolve
      loadModels();
    }
    if (!key && localStorage.getItem(SUPPRESS_KEY) === '1') return;
    const container = document.getElementById('fluent-new-api-container');
    if (!container) {
      showWarning(t('未检测到 FluentRead（流畅阅读），请确认扩展已启用'));
      return;
    }
    setPrefillKey(key || '');
    setFluentNoticeOpen(true);
  }
  // assign after definition so hook callback can call it safely
  openFluentNotificationRef.current = openFluentNotification;

  const closeFluentNotification = () => setFluentNoticeOpen(false);

  const suppressFluentNotification = () => {
    const { t } = latestRef.current;
    localStorage.setItem(SUPPRESS_KEY, '1');
    closeFluentNotification();
    showInfo(t('已关闭后续提醒'));
  };

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
      showError(t('未检测到 Fluent 容器'));
      return;
    }

    if (!chosenModel) {
      showWarning(t('请选择模型'));
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
        showWarning(t('没有可用令牌用于填充'));
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
    showSuccess(t('已发送到 Fluent'));
    setFluentNoticeOpen(false);
  };

  // Show notice panel when Fluent container is available
  useEffect(() => {
    const onAppeared = () => {
      openFluentNotification();
    };
    const onRemoved = () => {
      setFluentNoticeOpen(false);
    };

    window.addEventListener('fluent-container:appeared', onAppeared);
    window.addEventListener('fluent-container:removed', onRemoved);
    return () => {
      window.removeEventListener('fluent-container:appeared', onAppeared);
      window.removeEventListener('fluent-container:removed', onRemoved);
    };
  }, []);

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

  return (
    <>
      <FluentNoticePanel
        open={fluentNoticeOpen}
        prefillKey={prefillKey}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onConfirm={handlePrefillToFluent}
        onSuppress={suppressFluentNotification}
        onClose={closeFluentNotification}
        t={t}
      />

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

      <CardPro
        type='type1'
        descriptionArea={
          <TokensDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <TokensActions
              selectedKeys={selectedKeys}
              setEditingToken={setEditingToken}
              setShowEdit={setShowEdit}
              batchCopyTokens={batchCopyTokens}
              batchDeleteTokens={batchDeleteTokens}
              t={t}
            />

            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
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
        }
        paginationArea={createCardProPagination({
          currentPage: tokensData.activePage,
          pageSize: tokensData.pageSize,
          total: tokensData.tokenCount,
          onPageChange: tokensData.handlePageChange,
          onPageSizeChange: tokensData.handlePageSizeChange,
          isMobile: isMobile,
          t: tokensData.t,
        })}
        t={tokensData.t}
      >
        <TokensTable {...tokensData} />
      </CardPro>
    </>
  );
}

// Top-right anchored notice that replaces the legacy Semi `Notification.info`
// surface. Mirrors the layout the previous Notification rendered: title bar,
// short intro, model picker (native select for parity with CCSwitchModal),
// then the action row.
function FluentNoticePanel({
  open,
  prefillKey,
  modelOptions,
  selectedModel,
  onSelectModel,
  onConfirm,
  onSuppress,
  onClose,
  t,
}) {
  if (!open) return null;

  const intro = prefillKey
    ? t('请选择模型。')
    : t('选择模型后可一键填充当前选中令牌（或本页第一个令牌）。');

  return (
    <div
      role='region'
      aria-label={t('检测到 FluentRead（流畅阅读）')}
      className='pointer-events-none fixed right-4 top-20 z-40 flex w-full max-w-sm justify-end px-2'
    >
      <div className='pointer-events-auto w-full overflow-hidden rounded-2xl border border-border bg-background/95 shadow-xl backdrop-blur'>
        <div className='flex items-start justify-between gap-3 border-b border-[color:var(--app-border)] px-4 py-3'>
          <div className='text-sm font-semibold text-foreground'>
            {t('检测到 FluentRead（流畅阅读）')}
          </div>
          <button
            type='button'
            aria-label={t('关闭')}
            onClick={onClose}
            className='-mr-1 -mt-1 rounded-md p-1 text-muted transition hover:bg-surface-secondary hover:text-foreground'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='flex flex-col gap-3 px-4 py-3'>
          <p className='text-xs text-muted'>{intro}</p>

          <select
            value={selectedModel || ''}
            onChange={(event) => onSelectModel(event.target.value)}
            className='h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary'
          >
            <option value=''>{t('请选择模型')}</option>
            {(modelOptions || []).map((option) => (
              <option key={option.value} value={option.value}>
                {typeof option.label === 'string' ? option.label : option.value}
              </option>
            ))}
          </select>
          {(modelOptions || []).length === 0 ? (
            <div className='-mt-2 text-xs text-muted'>{t('暂无数据')}</div>
          ) : null}
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--app-border)] bg-surface-secondary/40 px-4 py-3'>
          {!prefillKey && (
            <Button size='sm' variant='flat' color='warning' onPress={onSuppress}>
              {t('不再提醒')}
            </Button>
          )}
          <Button size='sm' variant='light' onPress={onClose}>
            {t('关闭')}
          </Button>
          <Button size='sm' color='primary' onPress={onConfirm}>
            {t('一键填充到 FluentRead')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TokensPage;
