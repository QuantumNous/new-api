import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InfiniteScroll,
  NavBar,
  Popup,
  SearchBar,
  Tag,
} from 'antd-mobile';

import { API } from '@classic/helpers/api';

import { showError } from '../shims/classic-utils';

const PAGE = 30;

// 模型广场：搜索 + 分组/供应商筛选 + 紧凑列表 + 点击查看详情
const Models = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [groupRatioMap, setGroupRatioMap] = useState({});
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [vendorId, setVendorId] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/api/pricing');
        if (res.data.success) {
          setModels(res.data.data || []);
          setVendors(res.data.vendors || []);
          setGroupRatioMap(res.data.group_ratio || {});
        } else {
          showError(res.data.message);
        }
      } catch (e) {
        showError(e);
      }
    };
    load();
  }, []);

  const vendorName = (id) =>
    vendors.find((v) => v.id === id)?.name || '';

  const groups = useMemo(() => {
    const set = new Set();
    models.forEach((m) => (m.enable_groups || []).forEach((g) => set.add(g)));
    return Array.from(set);
  }, [models]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return models.filter((m) => {
      if (kw && !(m.model_name || '').toLowerCase().includes(kw)) return false;
      if (group && !(m.enable_groups || []).includes(group)) return false;
      if (vendorId && m.vendor_id !== vendorId) return false;
      return true;
    });
  }, [models, keyword, group, vendorId]);

  useEffect(() => {
    setLimit(PAGE);
  }, [keyword, group, vendorId]);

  // 价格口径与 PC 端一致（helpers/utils.jsx getPriceData）：
  // 按量:输入价 = model_ratio × 2 × 分组倍率 → $/1M tokens；按次:价格 × 分组倍率。
  // 分组倍率跟随筛选胶囊选中的分组；未筛选时用当前用户自己的分组。
  const userGroup = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').group || '';
    } catch (e) {
      return '';
    }
  })();
  const effectiveGroup = group || userGroup;
  const groupRatio = groupRatioMap[effectiveGroup] ?? 1;

  // 动态计费（tiered_expr）：表达式才是定价事实，静态倍率会误导（同 PC 判定）
  const isDynamic = (m) =>
    m.billing_mode === 'tiered_expr' && !!m.billing_expr;

  const trimNum = (n, digits = 6) =>
    String(parseFloat(n.toFixed(digits)));

  const inputPricePerM = (m) => m.model_ratio * 2 * groupRatio;

  const priceText = (m) => {
    if (isDynamic(m)) return '动态计费';
    return m.quota_type === 1
      ? `$${trimNum(m.model_price * groupRatio)}/次`
      : `$${trimNum(inputPricePerM(m), 3)}/1M`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar onBack={() => navigate(-1)}>模型广场</NavBar>
      <div style={{ background: '#fff', paddingBottom: 2 }}>
        <div style={{ padding: '10px 12px 4px' }}>
          <SearchBar
            placeholder='搜索模型名称'
            value={keyword}
            onChange={setKeyword}
          />
        </div>
        {groups.length > 1 && (
          <div className='m-config-bar' style={{ borderBottom: 'none', paddingBottom: 2 }}>
            <div
              className={`m-config-chip${group === '' ? ' active' : ''}`}
              onClick={() => setGroup('')}
            >
              全部分组
            </div>
            {groups.map((g) => (
              <div
                key={g}
                className={`m-config-chip${group === g ? ' active' : ''}`}
                onClick={() => setGroup(g)}
              >
                {g}
              </div>
            ))}
          </div>
        )}
        {vendors.length > 0 && (
          <div className='m-config-bar' style={{ paddingTop: 4 }}>
            <div
              className={`m-config-chip${vendorId === 0 ? ' active' : ''}`}
              onClick={() => setVendorId(0)}
            >
              全部供应商
            </div>
            {vendors.map((v) => (
              <div
                key={v.id}
                className={`m-config-chip${vendorId === v.id ? ' active' : ''}`}
                onClick={() => setVendorId(v.id)}
              >
                {v.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            margin: 12,
            borderRadius: 'var(--card-radius)',
            overflow: 'hidden',
            border: 'var(--card-border)',
            boxShadow: 'var(--card-shadow)',
            background: '#fff',
          }}
        >
          {filtered.slice(0, limit).map((m, idx) => (
            <div
              key={m.model_name}
              onClick={() => setDetail(m)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 14px',
                borderTop: idx === 0 ? 'none' : '0.5px solid #f0f1f5',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 14.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.model_name}
                </div>
                {vendorName(m.vendor_id) && (
                  <div style={{ fontSize: 11.5, color: '#9aa1ad', marginTop: 2 }}>
                    {vendorName(m.vendor_id)}
                  </div>
                )}
              </div>
              <div
                style={{
                  flexShrink: 0,
                  fontSize: 13,
                  color: 'var(--brand-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {priceText(m)}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9aa1ad', padding: 32 }}>
              没有匹配的模型
            </p>
          )}
        </div>
        <InfiniteScroll
          loadMore={async () => setLimit((l) => l + PAGE)}
          hasMore={limit < filtered.length}
        />
      </div>

      <Popup
        visible={!!detail}
        onMaskClick={() => setDetail(null)}
        bodyStyle={{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          paddingBottom: 'calc(16px + var(--safe-area-inset-bottom))',
        }}
      >
        {detail && (
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, wordBreak: 'break-all' }}>
              {detail.model_name}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`m-badge ${detail.quota_type === 1 ? 'pending' : 'info'}`}>
                {isDynamic(detail)
                  ? '动态计费'
                  : detail.quota_type === 1
                    ? '按次计费'
                    : '按量计费'}
              </span>
              {vendorName(detail.vendor_id) && (
                <span className='m-badge info'>{vendorName(detail.vendor_id)}</span>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#374151', marginTop: 12 }}>
              {isDynamic(detail)
                ? '动态计费：按用量阶梯表达式实时计算，详细规则请在电脑端模型广场查看'
                : detail.quota_type === 1
                  ? `单次价格：$${trimNum(detail.model_price * groupRatio)}`
                  : `输入 $${trimNum(inputPricePerM(detail), 3)} / 1M Tokens · 输出 $${trimNum(inputPricePerM(detail) * (detail.completion_ratio || 1), 3)} / 1M Tokens`}
            </div>
            <div style={{ fontSize: 12, color: '#9aa1ad', marginTop: 6 }}>
              按「{effectiveGroup || '默认'}」分组倍率 ×{groupRatio} 计算
            </div>
            {detail.description && (
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                {detail.description}
              </div>
            )}
            {(detail.enable_groups || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#9aa1ad', marginBottom: 6 }}>
                  可用分组
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {detail.enable_groups.map((g) => (
                    <Tag key={g} color='default' fill='outline'>
                      {g}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Popup>
    </div>
  );
};

export default Models;
