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

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Input,
  Tag,
  Empty,
  Pagination,
  Button,
  Table,
  Card,
  SideSheet,
  Spin,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconCopy,
  IconGridView,
  IconList,
  IconChevronRight,
  IconDownload,
  IconEyeOpened,
  IconInfoCircle,
} from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import {
  API,
  copy,
  showError,
  showSuccess,
  getLobeHubIcon,
  calculateModelPrice,
} from '../../helpers';
import { StatusContext } from '../../context/Status';

// ─── Vendor color mapping (vibrant gradients like uniapi) ───────────
const VENDOR_COLORS = {
  OpenAI: { from: '#15803d', to: '#4ade80' },
  Anthropic: { from: '#c2410c', to: '#f97316' },
  Google: { from: '#1d4ed8', to: '#60a5fa' },
  'Google Gemini': { from: '#1d4ed8', to: '#60a5fa' },
  Meta: { from: '#1e40af', to: '#3b82f6' },
  Deepseek: { from: '#4338ca', to: '#818cf8' },
  Baidu: { from: '#dc2626', to: '#f87171' },
  Midjourney: { from: '#1e293b', to: '#475569' },
  xAI: { from: '#1e293b', to: '#475569' },
  Stability: { from: '#7e22ce', to: '#c084fc' },
  Moonshot: { from: '#0369a1', to: '#38bdf8' },
  Qwen: { from: '#7c3aed', to: '#a78bfa' },
  MiniMax: { from: '#0891b2', to: '#22d3ee' },
  Spark: { from: '#0284c7', to: '#38bdf8' },
  default: { from: '#15803d', to: '#4ade80' },
};

function getVendorGradient(vendorName) {
  if (!vendorName) return VENDOR_COLORS.default;
  // Try exact match first
  if (VENDOR_COLORS[vendorName]) return VENDOR_COLORS[vendorName];
  // Try case-insensitive partial match
  const lowerName = vendorName.toLowerCase();
  for (const [key, colors] of Object.entries(VENDOR_COLORS)) {
    if (key.toLowerCase() === lowerName || lowerName.includes(key.toLowerCase())) {
      return colors;
    }
  }
  return VENDOR_COLORS.default;
}

// ─── Infer vendor from model name if no vendor_id ───────────────────
function inferVendorFromModelName(modelName) {
  if (!modelName) return null;
  const n = modelName.toLowerCase();
  if (n.includes('gpt') || n.startsWith('openai/') || n.includes('o1') || n.includes('o3') || n.includes('o4') || n.includes('dall-e') || n.includes('codex')) return 'OpenAI';
  if (n.includes('claude') || n.startsWith('anthropic/')) return 'Anthropic';
  if (n.includes('gemini') || n.startsWith('google/')) return 'Google';
  if (n.includes('deepseek')) return 'Deepseek';
  if (n.includes('qwen') || n.includes('tongyi')) return 'Qwen';
  if (n.includes('llama') || n.includes('meta/')) return 'Meta';
  if (n.includes('midjourney') || n.includes('mj-')) return 'Midjourney';
  if (n.includes('moonshot') || n.includes('kimi')) return 'Moonshot';
  if (n.includes('minimax')) return 'MiniMax';
  if (n.includes('spark') || n.includes('xunfei')) return 'Spark';
  if (n.includes('stable-diffusion') || n.includes('sd-')) return 'Stability';
  if (n.includes('grok') || n.includes('xai/')) return 'xAI';
  if (n.includes('ernie') || n.includes('wenxin')) return 'Baidu';
  return null;
}

// ─── Vendor icon mapping (LobeHub icon names) ───────────────────────
const VENDOR_ICONS = {
  OpenAI: 'OpenAI',
  Anthropic: 'Claude.Color',
  Google: 'Gemini.Color',
  Deepseek: 'DeepSeek.Color',
  Meta: 'Meta.Color',
  Midjourney: 'Midjourney.Color',
  Moonshot: 'Moonshot',
  MiniMax: 'Minimax.Color',
  Spark: 'Spark.Color',
  Qwen: 'Tongyi.Color',
  xAI: 'Grok',
  Baidu: 'Baidu.Color',
  Stability: 'Stability.Color',
};

// ─── Debounce hook ──────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Main Pricing Page ──────────────────────────────────────────────
const Pricing = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);

  // ── Data state ──
  const [models, setModels] = useState([]);
  const [, setVendorsMap] = useState({});
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroup, setUsableGroup] = useState({});
  const [, setEndpointMap] = useState({});
  const [loading, setLoading] = useState(true);

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedQuotaType, setSelectedQuotaType] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');

  // ── Display state ──
  const [viewMode, setViewMode] = useState('grid');
  const [unitMillion, setUnitMillion] = useState(true);
  const [sortMode, setSortMode] = useState('default');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // ── Detail sheet ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailModel, setDetailModel] = useState(null);

  const scrollRef = useRef(null);

  // ── Derived: currency display ──
  const siteDisplayType = useMemo(
    () => statusState?.status?.quota_display_type || 'USD',
    [statusState],
  );

  const displayPrice = useCallback(
    (usdPrice) => {
      const p = Number(usdPrice);
      return `$${p.toFixed(3)}`;
    },
    [],
  );

  // ── Load data ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/pricing');
        const {
          success,
          message,
          data,
          vendors,
          group_ratio,
          usable_group,
          supported_endpoint,
        } = res.data;
        if (success) {
          setGroupRatio(group_ratio || {});
          setUsableGroup(usable_group || {});
          setEndpointMap(supported_endpoint || {});

          const vMap = {};
          if (Array.isArray(vendors)) {
            vendors.forEach((v) => {
              vMap[v.id] = v;
            });
          }
          setVendorsMap(vMap);

          // Enrich models with vendor info + inference
          const enriched = (data || []).map((m) => {
            const model = { ...m, key: m.model_name };
            model.group_ratio = group_ratio?.[m.model_name];

            // Set vendor info from API vendor map
            if (m.vendor_id && vMap[m.vendor_id]) {
              const vendor = vMap[m.vendor_id];
              model.vendor_name = vendor.name;
              model.vendor_icon = vendor.icon;
              model.vendor_description = vendor.description;
            }

            // If no vendor_name, infer from model name
            if (!model.vendor_name) {
              const inferred = inferVendorFromModelName(m.model_name);
              if (inferred) {
                model.vendor_name = inferred;
                model.vendor_icon = model.vendor_icon || VENDOR_ICONS[inferred] || '';
                model.inferred_vendor = true;
              }
            }

            // If still no icon but have vendor_name, try to get icon from mapping
            if (!model.vendor_icon && model.vendor_name && VENDOR_ICONS[model.vendor_name]) {
              model.vendor_icon = VENDOR_ICONS[model.vendor_name];
            }

            return model;
          });

          // Sort: by quota_type then gpt first then alphabetical
          enriched.sort((a, b) => a.quota_type - b.quota_type);
          enriched.sort((a, b) => {
            if (a.model_name.startsWith('gpt') && !b.model_name.startsWith('gpt')) return -1;
            if (!a.model_name.startsWith('gpt') && b.model_name.startsWith('gpt')) return 1;
            return a.model_name.localeCompare(b.model_name);
          });

          setModels(enriched);
        } else {
          showError(message);
        }
      } catch (e) {
        console.error('Failed to load pricing:', e);
      }
      setLoading(false);
    })();
  }, []);

  // ── Derived: vendor list ──
  const vendorList = useMemo(() => {
    const map = new Map();
    models.forEach((m) => {
      const name = m.vendor_name || '';
      if (name && !map.has(name)) {
        map.set(name, { name, icon: m.vendor_icon, count: 0 });
      }
      if (name) map.get(name).count++;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  // ── Derived: tags ──
  const allTags = useMemo(() => {
    const tagSet = new Set();
    models.forEach((m) => {
      if (m.tags) {
        m.tags.split(/[,;|]+/).map((t) => t.trim()).filter(Boolean).forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [models]);

  // ── Derived: endpoint types ──
  const allEndpointTypes = useMemo(() => {
    const types = new Set();
    models.forEach((m) => {
      if (Array.isArray(m.supported_endpoint_types)) {
        m.supported_endpoint_types.forEach((ep) => types.add(ep));
      }
    });
    return Array.from(types).sort();
  }, [models]);

  // ── Derived: quota types ──
  const quotaTypes = useMemo(() => {
    const types = new Set();
    models.forEach((m) => {
      if (m.quota_type === 0) types.add('tokens');
      else if (m.quota_type === 1) types.add('times');
    });
    return Array.from(types);
  }, [models]);

  // ── Derived: user groups ──
  const userGroupOptions = useMemo(() => {
    if (!usableGroup || typeof usableGroup !== 'object') return [];
    return Object.entries(usableGroup).map(([key, label]) => ({
      value: key,
      label: label || key,
    }));
  }, [usableGroup]);

  // ── Filter logic ──
  const filteredModels = useMemo(() => {
    let result = models;
    if (selectedVendor) {
      result = result.filter((m) => m.vendor_name === selectedVendor);
    }
    if (selectedQuotaType === 'tokens') {
      result = result.filter((m) => m.quota_type === 0);
    } else if (selectedQuotaType === 'times') {
      result = result.filter((m) => m.quota_type === 1);
    }
    if (selectedEndpoint) {
      result = result.filter((m) =>
        Array.isArray(m.supported_endpoint_types) && m.supported_endpoint_types.includes(selectedEndpoint),
      );
    }
    if (selectedTags.length > 0) {
      result = result.filter((m) => {
        if (!m.tags) return false;
        const modelTags = m.tags.toLowerCase().split(/[,;|]+/).map((t) => t.trim());
        return selectedTags.some((st) => modelTags.includes(st.toLowerCase()));
      });
    }
    if (selectedGroup !== 'all') {
      result = result.filter((m) =>
        Array.isArray(m.enable_groups) && m.enable_groups.includes(selectedGroup),
      );
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((m) =>
        (m.model_name && m.model_name.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.vendor_name && m.vendor_name.toLowerCase().includes(q)) ||
        (m.tags && m.tags.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [models, selectedVendor, selectedQuotaType, selectedEndpoint, selectedTags, selectedGroup, debouncedSearch]);

  // ── Sort ──
  const sortedModels = useMemo(() => {
    if (sortMode === 'default') return filteredModels;
    const c = [...filteredModels];
    if (sortMode === 'newest') c.reverse();
    return c;
  }, [filteredModels, sortMode]);

  // ── Pagination ──
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedModels.slice(start, start + pageSize);
  }, [sortedModels, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [selectedVendor, selectedQuotaType, selectedEndpoint, selectedTags, selectedGroup, debouncedSearch, sortMode]);

  // ── Handlers ──
  const handleCopyModel = useCallback(async (name, e) => {
    if (e) e.stopPropagation();
    if (await copy(name)) {
      showSuccess(t('已复制：') + name);
    }
  }, [t]);

  const handleTagToggle = useCallback((tag) => {
    setSelectedTags((prev) => {
      const lower = tag.toLowerCase();
      if (prev.some((t) => t.toLowerCase() === lower)) {
        return prev.filter((t) => t.toLowerCase() !== lower);
      }
      return [...prev, tag];
    });
  }, []);

  const handleOpenDetail = useCallback((model) => {
    setDetailModel(model);
    setDetailVisible(true);
  }, []);

  const handleExportCSV = useCallback(() => {
    const rows = [
      [t('模型名称'), t('类型'), t('供应商'), t('输入价格'), t('输出价格')].join(','),
    ];
    sortedModels.forEach((m) => {
      const priceData = calculateModelPrice({
        record: m, selectedGroup, groupRatio,
        tokenUnit: unitMillion ? 'M' : 'K', displayPrice,
        currency: 'USD', quotaDisplayType: siteDisplayType,
      });
      const type = m.quota_type === 0 ? t('按量计费') : t('按次计费');
      const vendor = m.vendor_name || '-';
      rows.push(`"${m.model_name}","${type}","${vendor}","${priceData?.inputPrice || '-'}","${priceData?.completionPrice || priceData?.price || '-'}"`);
    });
    const csv = `\uFEFF${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `model-prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [sortedModels, selectedGroup, groupRatio, unitMillion, displayPrice, siteDisplayType, t]);

  // ── Price display per model ──
  const getModelPrices = useCallback((model) => {
    const priceData = calculateModelPrice({
      record: model, selectedGroup, groupRatio,
      tokenUnit: unitMillion ? 'M' : 'K', displayPrice,
      currency: 'USD', quotaDisplayType: siteDisplayType,
      precision: 2,
    });
    if (!priceData) return { input: '-', output: '-', unit: '' };
    if (model.quota_type === 1) {
      return { input: priceData.price || '-', output: '-', unit: `/ ${t('次')}`, isFixed: true };
    }
    return {
      input: priceData.inputPrice || '-',
      output: priceData.completionPrice || '-',
      unit: `/${unitMillion ? 'M' : 'K'}`,
      isFixed: false,
    };
  }, [selectedGroup, groupRatio, unitMillion, displayPrice, siteDisplayType, t]);

  // ── Generate display name from model_name ──
  const getModelDisplayName = (modelName) => {
    if (!modelName) return '';
    // Remove vendor prefix like "openai/"
    const withoutPrefix = modelName.replace(/^[a-z]+\//, '');
    // Capitalize and format nicely
    return withoutPrefix
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER: Filter Section ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  const renderFilters = () => (
    <div style={{
      padding: '20px 24px',
      marginBottom: 20,
      borderRadius: 16,
      border: '1px solid var(--semi-color-border)',
      backgroundColor: 'var(--semi-color-bg-1)',
    }}>
      {/* Title row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--semi-color-border)',
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {t('模型定价')}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size='small' theme='outline' icon={<IconDownload />} onClick={handleExportCSV}>
            {t('导出')}
          </Button>
          <div style={{
            display: 'inline-flex', border: '1px solid var(--semi-color-border)',
            borderRadius: 8, overflow: 'hidden',
          }}>
            {[
              { mode: 'grid', icon: <IconGridView size='small' /> },
              { mode: 'list', icon: <IconList size='small' /> },
            ].map(({ mode, icon }) => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                backgroundColor: viewMode === mode ? 'var(--semi-color-primary)' : 'transparent',
                color: viewMode === mode ? '#fff' : 'var(--semi-color-text-2)',
                display: 'flex', alignItems: 'center',
                borderLeft: mode === 'list' ? '1px solid var(--semi-color-border)' : 'none',
              }}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Provider chips */}
      {vendorList.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, marginBottom: 10,
            color: 'var(--semi-color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {t('供应商')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Tag size='large' color={selectedVendor === '' ? 'white' : undefined}
              type={selectedVendor === '' ? 'solid' : 'ghost'}
              style={{
                cursor: 'pointer', fontWeight: selectedVendor === '' ? 700 : 500,
                backgroundColor: selectedVendor === '' ? 'var(--semi-color-primary)' : undefined,
                color: selectedVendor === '' ? '#fff' : undefined,
                borderRadius: 8, padding: '4px 14px', transition: 'all 0.2s',
              }}
              onClick={() => setSelectedVendor('')}
            >
              {t('全部')}
            </Tag>
            {vendorList.map((v) => {
              const active = selectedVendor === v.name;
              return (
                <Tag key={v.name} size='large'
                  style={{
                    cursor: 'pointer', fontWeight: active ? 700 : 500,
                    backgroundColor: active ? 'var(--semi-color-primary)' : undefined,
                    color: active ? '#fff' : undefined,
                    borderRadius: 8, padding: '4px 14px', transition: 'all 0.2s',
                  }}
                  type={active ? 'solid' : 'ghost'}
                  onClick={() => setSelectedVendor(active ? '' : v.name)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {v.icon && (
                      <span style={{ display: 'inline-flex', width: 20, height: 20, flexShrink: 0 }}>
                        {getLobeHubIcon(v.icon, 20)}
                      </span>
                    )}
                    {v.name}
                  </span>
                </Tag>
              );
            })}
          </div>
        </div>
      )}

      {/* Endpoint type chips (模态) */}
      {allEndpointTypes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, marginBottom: 10,
            color: 'var(--semi-color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {t('模态')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Tag size='large'
              style={{
                cursor: 'pointer', fontWeight: selectedEndpoint === '' ? 700 : 500,
                backgroundColor: selectedEndpoint === '' ? 'var(--semi-color-primary)' : undefined,
                color: selectedEndpoint === '' ? '#fff' : undefined,
                borderRadius: 8, padding: '4px 14px', transition: 'all 0.2s',
              }}
              type={selectedEndpoint === '' ? 'solid' : 'ghost'}
              onClick={() => setSelectedEndpoint('')}
            >
              {t('全部')}
            </Tag>
            {allEndpointTypes.map((ep) => {
              const active = selectedEndpoint === ep;
              return (
                <Tag key={ep} size='large'
                  style={{
                    cursor: 'pointer', fontWeight: active ? 700 : 500,
                    backgroundColor: active ? 'var(--semi-color-primary)' : undefined,
                    color: active ? '#fff' : undefined,
                    borderRadius: 8, padding: '4px 14px', transition: 'all 0.2s',
                  }}
                  type={active ? 'solid' : 'ghost'}
                  onClick={() => setSelectedEndpoint(active ? '' : ep)}
                >
                  {ep}
                </Tag>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, marginBottom: 10,
            color: 'var(--semi-color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {t('标签')}
            {selectedTags.length > 0 && (
              <Tag size='small' color='red' type='solid' closable
                onClose={() => setSelectedTags([])} style={{ borderRadius: 6 }}>
                {selectedTags.length} {t('已选')}
              </Tag>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allTags.map((tag) => {
              const active = selectedTags.some((st) => st.toLowerCase() === tag.toLowerCase());
              return (
                <Tag key={tag} size='default'
                  style={{
                    cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500,
                    backgroundColor: active ? 'var(--semi-color-primary)' : undefined,
                    color: active ? '#fff' : undefined,
                    borderRadius: 6, transition: 'all 0.2s',
                  }}
                  type={active ? 'solid' : 'ghost'}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </Tag>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + controls row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        paddingTop: 12, borderTop: '1px solid var(--semi-color-border)',
      }}>
        <div style={{ flex: '1 1 260px', maxWidth: 360 }}>
          <Input prefix={<IconSearch />} placeholder={t('搜索模型名称…')}
            value={searchQuery} onChange={setSearchQuery} showClear
            style={{ borderRadius: 10 }}
          />
        </div>

        {/* User group */}
        {userGroupOptions.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 10,
            border: '1px solid var(--semi-color-border)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--semi-color-text-2)' }}>
              {t('等级')}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <Button size='small' theme={selectedGroup === 'all' ? 'solid' : 'borderless'}
                style={{ borderRadius: 6, fontSize: 12 }}
                onClick={() => setSelectedGroup('all')}>
                {t('全部')}
              </Button>
              {userGroupOptions.map((g) => (
                <Button key={g.value} size='small'
                  theme={selectedGroup === g.value ? 'solid' : 'borderless'}
                  style={{ borderRadius: 6, fontSize: 12 }}
                  onClick={() => setSelectedGroup(g.value)}>
                  {g.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Unit toggle K/M */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          border: '1px solid var(--semi-color-border)', borderRadius: 10, overflow: 'hidden',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '0 10px', color: 'var(--semi-color-text-2)' }}>
            {t('单位')}
          </span>
          {['K', 'M'].map((u) => {
            const active = (u === 'M') === unitMillion;
            return (
              <button key={u} onClick={() => setUnitMillion(u === 'M')} style={{
                padding: '5px 16px', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                backgroundColor: active ? 'var(--semi-color-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--semi-color-text-2)',
                borderLeft: '1px solid var(--semi-color-border)',
              }}>
                {u}
              </button>
            );
          })}
        </div>

        {/* Sort toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          border: '1px solid var(--semi-color-border)', borderRadius: 10, overflow: 'hidden',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '0 10px', color: 'var(--semi-color-text-2)' }}>
            {t('排序')}
          </span>
          {[
            { value: 'default', label: t('默认') },
            { value: 'newest', label: t('最新') },
            { value: 'oldest', label: t('最早') },
          ].map((opt) => (
            <button key={opt.value} onClick={() => setSortMode(opt.value)} style={{
              padding: '5px 12px', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              backgroundColor: sortMode === opt.value ? 'var(--semi-color-primary)' : 'transparent',
              color: sortMode === opt.value ? '#fff' : 'var(--semi-color-text-2)',
              borderLeft: '1px solid var(--semi-color-border)',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER: Model Card (matching uniapi design) ───────────────────
  // ═══════════════════════════════════════════════════════════════════
  const renderModelCard = (model) => {
    const prices = getModelPrices(model);
    const typeLabel = model.quota_type === 0 ? t('按Token收费') : t('按次收费');
    const tags = model.tags
      ? model.tags.split(/[,;|]+/).map((t) => t.trim()).filter(Boolean)
      : [];
    const vendorColors = getVendorGradient(model.vendor_name);
    const displayName = getModelDisplayName(model.model_name);
    const groupCount = Array.isArray(model.enable_groups) ? model.enable_groups.length : 0;

    return (
      <div key={model.model_name}
        onClick={() => handleOpenDetail(model)}
        className='pricing-model-card'
        style={{
          borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
          border: '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── Card Banner (vibrant gradient) ── */}
        <div style={{
          height: 72,
          background: `linear-gradient(135deg, ${vendorColors.from}, ${vendorColors.to})`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
          position: 'relative',
        }}>
          {/* Vendor icon in white circle */}
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            {model.vendor_icon ? (
              getLobeHubIcon(model.vendor_icon, 24)
            ) : (
              <span style={{ fontWeight: 800, fontSize: 16, color: vendorColors.from }}>
                {(model.vendor_name || model.model_name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Vendor name & display name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: '#fff',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              textShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}>
              {model.vendor_name || t('未知')}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName}
            </div>
          </div>
        </div>

        {/* ── Card Body ── */}
        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Model name + copy button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 14, fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}>
              {model.model_name}
            </span>
            <button onClick={(e) => handleCopyModel(model.model_name, e)}
              className='pricing-copy-btn'
              style={{
                border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-2)',
                cursor: 'pointer', opacity: 0.6, padding: 5, display: 'flex', borderRadius: 8,
                flexShrink: 0,
              }}>
              <IconCopy size='small' />
            </button>
          </div>

          {/* Description */}
          <div style={{
            fontSize: 13, color: 'var(--semi-color-text-2)', lineHeight: 1.6,
            minHeight: 40, display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            marginBottom: 10,
          }}>
            {model.description || model.vendor_description || displayName}
          </div>

          {/* Tags */}
          <div style={{ minHeight: 26, marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.slice(0, 3).map((tag, idx) => (
              <Tag key={idx} size='small' style={{
                fontSize: 11, height: 22, borderRadius: 6,
                backgroundColor: 'var(--semi-color-fill-0)',
                border: '1px solid var(--semi-color-border)',
              }}>
                {tag}
              </Tag>
            ))}
            {tags.length > 3 && (
              <Tag size='small' style={{ fontSize: 11, height: 22, borderRadius: 6 }}>
                +{tags.length - 3}
              </Tag>
            )}
          </div>

          {/* Spacer to push bottom content down */}
          <div style={{ flex: 1 }} />

          {/* Group count badge - colored outline like reference */}
          {groupCount > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, lineHeight: 1,
                padding: '4px 10px', borderRadius: 6,
                border: '1.5px solid var(--semi-color-primary)',
                color: 'var(--semi-color-primary)',
                backgroundColor: 'var(--semi-color-primary-light-default)',
              }}>
                {groupCount} {t('组')}
              </span>
            </div>
          )}

          {/* ── Price section ── */}
          <div style={{
            borderTop: '1px solid var(--semi-color-border)',
            paddingTop: 12,
          }}>
            {/* Input / Output prices - pixel-perfect match to reference */}
            <div style={{
              display: 'flex', gap: 20, marginBottom: 12,
            }}>
              {/* Input price */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 7,
                  backgroundColor: 'rgba(22, 163, 74, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: '#16a34a', fontSize: 13, fontWeight: 700, lineHeight: 1,
                }}>
                  ↓
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--semi-color-text-3)', lineHeight: 1, marginBottom: 3, fontWeight: 500 }}>
                    {t('输入')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{
                      fontSize: 16, fontWeight: 800,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      color: 'var(--semi-color-text-0)', lineHeight: 1,
                    }}>
                      {prices.input}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--semi-color-text-3)', fontWeight: 500 }}>
                      {prices.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Output price */}
              {!prices.isFixed && (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7,
                    backgroundColor: 'rgba(234, 136, 27, 0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: '#d97706', fontSize: 13, fontWeight: 700, lineHeight: 1,
                  }}>
                    ↑
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--semi-color-text-3)', lineHeight: 1, marginBottom: 3, fontWeight: 500 }}>
                      {t('输出')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{
                        fontSize: 16, fontWeight: 800,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: 'var(--semi-color-text-0)', lineHeight: 1,
                      }}>
                        {prices.output}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--semi-color-text-3)', fontWeight: 500 }}>
                        {prices.unit}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom info row: type tag + view details */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Tag size='small' color={model.quota_type === 0 ? 'green' : 'orange'}
                  style={{ fontSize: 11, height: 20, borderRadius: 6, fontWeight: 600 }}>
                  {typeLabel}
                </Tag>
              </div>
              <span style={{
                fontSize: 12, color: 'var(--semi-color-text-3)',
                display: 'flex', alignItems: 'center', gap: 2,
                fontWeight: 500,
              }}>
                {t('查看详情')} <IconChevronRight size='extra-small' />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER: Grid View ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  const renderGridView = () => (
    <div className='pricing-grid'>
      {paginatedModels.map((m) => renderModelCard(m))}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER: List View ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  const renderListView = () => {
    const columns = [
      {
        title: t('模型'),
        dataIndex: 'model_name',
        key: 'model_name',
        width: 340,
        render: (text, record) => {
          const vendorColors = getVendorGradient(record.vendor_name);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${vendorColors.from}, ${vendorColors.to})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {record.vendor_icon ? (
                  <span style={{ display: 'flex', filter: 'brightness(0) invert(1)' }}>
                    {getLobeHubIcon(record.vendor_icon, 20)}
                  </span>
                ) : (
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>
                    {(record.vendor_name || text || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontWeight: 700, fontSize: 14,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {text}
                  </span>
                  <button onClick={(e) => handleCopyModel(text, e)}
                    className='pricing-copy-btn'
                    style={{ border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-2)', cursor: 'pointer', opacity: 0.6, padding: 4, display: 'flex', borderRadius: 6, flexShrink: 0 }}>
                    <IconCopy size='small' />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)' }}>
                  {record.vendor_name || '-'}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        title: t('类型'),
        dataIndex: 'quota_type',
        key: 'type',
        width: 110,
        render: (val) => (
          <Tag size='small' color={val === 0 ? 'green' : 'orange'}
            style={{ fontSize: 11, fontWeight: 700, borderRadius: 6 }}>
            {val === 0 ? t('按Token收费') : t('按次收费')}
          </Tag>
        ),
      },
      {
        title: t('输入价格'),
        key: 'input',
        width: 160,
        render: (_, record) => {
          const prices = getModelPrices(record);
          return (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontWeight: 800, fontSize: 15,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                color: 'var(--semi-color-text-0)',
              }}>
                {prices.input}
              </span>
              <span style={{ fontSize: 11, color: 'var(--semi-color-text-3)' }}>
                {prices.unit}
              </span>
            </div>
          );
        },
      },
      {
        title: t('输出价格'),
        key: 'output',
        width: 160,
        render: (_, record) => {
          const prices = getModelPrices(record);
          if (prices.isFixed) return <span style={{ color: 'var(--semi-color-text-3)' }}>-</span>;
          return (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontWeight: 800, fontSize: 15,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                color: 'var(--semi-color-text-0)',
              }}>
                {prices.output}
              </span>
              <span style={{ fontSize: 11, color: 'var(--semi-color-text-3)' }}>
                {prices.unit}
              </span>
            </div>
          );
        },
      },
      {
        title: t('分组'),
        key: 'groups',
        width: 100,
        render: (_, record) => {
          const count = Array.isArray(record.enable_groups) ? record.enable_groups.length : 0;
          return <span style={{ fontSize: 13, color: 'var(--semi-color-text-2)' }}>{count} {t('组')}</span>;
        },
      },
      {
        title: '',
        key: 'actions',
        width: 60,
        render: (_, record) => (
          <Button size='small' theme='borderless' type='primary'
            icon={<IconEyeOpened size='small' />}
            onClick={(e) => { e.stopPropagation(); handleOpenDetail(record); }}
          />
        ),
      },
    ];

    return (
      <Card style={{ borderRadius: 16 }} bordered={false}>
        <Table columns={columns} dataSource={paginatedModels} loading={loading}
          pagination={false} scroll={{ x: 'max-content' }}
          onRow={(record) => ({ onClick: () => handleOpenDetail(record), style: { cursor: 'pointer' } })}
          empty={
            <Empty image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('搜索无结果')} />
          }
        />
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER: Pagination Bar ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  const renderPaginationBar = () => {
    if (sortedModels.length === 0) return null;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, sortedModels.length);
    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 16, padding: '10px 20px', borderRadius: 12,
        border: '1px solid var(--semi-color-border)',
        backgroundColor: 'var(--semi-color-bg-1)',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span>
            {t('共')}{' '}
            <strong style={{ color: 'var(--semi-color-primary)', fontSize: 15 }}>
              {sortedModels.length}
            </strong>{' '}
            {t('个模型')}
          </span>
          <span style={{ color: 'var(--semi-color-border)' }}>|</span>
          <span style={{ color: 'var(--semi-color-text-2)' }}>
            {t('显示')} {start}-{end}
          </span>
          <span style={{ color: 'var(--semi-color-border)' }}>|</span>
          <span style={{ color: 'var(--semi-color-text-2)' }}>
            {t('每页')}{' '}
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                border: 'none', background: 'none', fontWeight: 700,
                color: 'var(--semi-color-primary)', cursor: 'pointer', fontSize: 13,
              }}>
              {[30, 60, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>{' '}
            {t('条')}
          </span>
        </div>
        <Pagination currentPage={currentPage} pageSize={pageSize}
          total={sortedModels.length} size='small' onPageChange={setCurrentPage} />
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER: Detail SideSheet ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  const renderDetailSheet = () => {
    if (!detailModel) return null;
    const prices = getModelPrices(detailModel);
    const typeLabel = detailModel.quota_type === 0 ? t('按Token收费') : t('按次收费');
    const typeColor = detailModel.quota_type === 0 ? 'green' : 'orange';
    const tags = detailModel.tags
      ? detailModel.tags.split(/[,;|]+/).map((t) => t.trim()).filter(Boolean)
      : [];
    const vendorColors = getVendorGradient(detailModel.vendor_name);

    return (
      <SideSheet visible={detailVisible} onCancel={() => setDetailVisible(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${vendorColors.from}, ${vendorColors.to})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              {detailModel.vendor_icon ? (
                <span style={{ display: 'flex', filter: 'brightness(0) invert(1)' }}>
                  {getLobeHubIcon(detailModel.vendor_icon, 24)}
                </span>
              ) : (
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
                  {(detailModel.vendor_name || detailModel.model_name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{detailModel.model_name}</div>
              <div style={{
                fontSize: 12, color: 'var(--semi-color-text-3)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {detailModel.vendor_name || '-'}
                <button onClick={(e) => handleCopyModel(detailModel.model_name, e)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.5, padding: 2, display: 'flex' }}>
                  <IconCopy size='extra-small' />
                </button>
              </div>
            </div>
          </div>
        }
        width={600} placement='right'
      >
        <div style={{ padding: '0 4px' }}>
          {/* Tags */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <Tag color={typeColor} size='small' style={{ borderRadius: 6 }}>{typeLabel}</Tag>
            {tags.map((tag, idx) => <Tag key={idx} size='small' style={{ borderRadius: 6 }}>{tag}</Tag>)}
          </div>

          {/* Description */}
          {detailModel.description && detailModel.description !== '-' && (
            <div style={{
              padding: 16, marginBottom: 16, borderRadius: 12,
              border: '1px solid var(--semi-color-border)',
              fontSize: 14, lineHeight: 1.6, color: 'var(--semi-color-text-1)',
            }}>
              {detailModel.description}
            </div>
          )}

          {/* Model info */}
          <div style={{ marginBottom: 16, borderRadius: 12, border: '1px solid var(--semi-color-border)', overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--semi-color-border)',
            }}>
              <IconInfoCircle size='small' style={{ color: 'var(--semi-color-text-2)' }} />
              {t('模型信息')}
            </div>
            <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '0 0 45%' }}>
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)', marginBottom: 4 }}>{t('供应商')}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{detailModel.vendor_name || '-'}</div>
              </div>
              <div style={{ flex: '0 0 45%' }}>
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)', marginBottom: 4 }}>{t('类型')}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{typeLabel}</div>
              </div>
              {detailModel.supported_endpoint_types && detailModel.supported_endpoint_types.length > 0 && (
                <div style={{ flex: '0 0 100%' }}>
                  <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)', marginBottom: 6 }}>{t('支持端点')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {detailModel.supported_endpoint_types.map((ep) => (
                      <Tag key={ep} size='small' style={{ borderRadius: 6 }}>{ep}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {detailModel.enable_groups && detailModel.enable_groups.length > 0 && (
                <div style={{ flex: '0 0 100%' }}>
                  <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)', marginBottom: 6 }}>{t('可用分组')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {detailModel.enable_groups.map((g) => (
                      <Tag key={g} size='small' style={{ borderRadius: 6 }}>{g}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing detail */}
          <div style={{ borderRadius: 12, border: '1px solid var(--semi-color-border)', overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--semi-color-border)',
            }}>
              💰 {t('价格详情')}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Input */}
                <div style={{
                  flex: 1, padding: 16, borderRadius: 12,
                  backgroundColor: 'rgba(22, 163, 74, 0.06)',
                  border: '1px solid rgba(22, 163, 74, 0.12)',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)', marginBottom: 6 }}>{t('输入价格')}</div>
                  <div style={{
                    fontSize: 24, fontWeight: 800,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: '#16a34a',
                  }}>
                    {prices.input}
                    <span style={{ fontSize: 13, color: 'var(--semi-color-text-3)', fontWeight: 400, marginLeft: 4 }}>
                      {prices.unit}
                    </span>
                  </div>
                </div>
                {/* Output */}
                {!prices.isFixed && (
                  <div style={{
                    flex: 1, padding: 16, borderRadius: 12,
                    backgroundColor: 'rgba(234, 179, 8, 0.06)',
                    border: '1px solid rgba(234, 179, 8, 0.12)',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)', marginBottom: 6 }}>{t('输出价格')}</div>
                    <div style={{
                      fontSize: 24, fontWeight: 800,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      color: '#d97706',
                    }}>
                      {prices.output}
                      <span style={{ fontSize: 13, color: 'var(--semi-color-text-3)', fontWeight: 400, marginLeft: 4 }}>
                        {prices.unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ratio info */}
              {detailModel.quota_type === 0 && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: 'var(--semi-color-fill-0)', fontSize: 13, color: 'var(--semi-color-text-2)' }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <span>{t('模型倍率')}: <strong>{detailModel.model_ratio}</strong></span>
                    <span>{t('补全倍率')}: <strong>{parseFloat(detailModel.completion_ratio?.toFixed(3))}</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SideSheet>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // ── MAIN RENDER ───────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 64 }}>
      <style>{`
        .pricing-model-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -12px rgba(0,0,0,0.12), 0 8px 16px -8px rgba(0,0,0,0.08);
          border-color: var(--semi-color-primary-light-default) !important;
        }
        .pricing-copy-btn:hover {
          opacity: 1 !important;
          background-color: var(--semi-color-fill-1) !important;
          border-color: var(--semi-color-primary) !important;
        }
        .semi-table-row:hover {
          background-color: var(--semi-color-fill-0);
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          min-height: 400px;
        }
        @media (max-width: 1100px) {
          .pricing-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 800px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 520px) {
          .pricing-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '20px 24px', maxWidth: 1248, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {renderFilters()}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <Spin size='large' />
          </div>
        ) : sortedModels.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <Empty image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('搜索无结果')} />
          </div>
        ) : viewMode === 'grid' ? (
          renderGridView()
        ) : (
          renderListView()
        )}

        {renderPaginationBar()}
      </div>

      {renderDetailSheet()}
    </div>
  );
};

export default Pricing;
