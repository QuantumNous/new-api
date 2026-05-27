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
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  PieChart,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { API, getLobeHubIcon, showError } from '../../helpers';
import { useActualTheme } from '../../context/Theme';
import './index.css';

const { Text, Title } = Typography;

const PERIODS = ['today', 'week', 'month', 'year', 'all'];
const PERIOD_LABELS = {
  today: '今日',
  week: '本周',
  month: '本月',
  year: '今年',
  all: '全部时间',
};

const PERIOD_DESCRIPTIONS = {
  today: {
    models: '过去 24 小时按模型统计的每小时 Token 用量',
    vendors: '过去 24 小时按模型厂商统计的 Token 份额',
  },
  week: {
    models: '过去几周按模型统计的每周 Token 用量',
    vendors: '过去几周按模型厂商统计的 Token 份额',
  },
  month: {
    models: '过去一个月按模型统计的每日 Token 用量',
    vendors: '过去一个月按模型厂商统计的 Token 份额',
  },
  year: {
    models: '过去一年按模型统计的每周 Token 用量',
    vendors: '过去一年按模型厂商统计的 Token 份额',
  },
  all: {
    models: '自上线以来按模型统计的 Token 用量',
    vendors: '自上线以来按模型厂商统计的 Token 份额',
  },
};

const VENDOR_COLORS = {
  OpenAI: '#10a37f',
  Anthropic: '#d97757',
  Google: '#4285f4',
  DeepSeek: '#7c5cff',
  Alibaba: '#ff9900',
  xAI: '#1f2937',
  Meta: '#1877f2',
  Moonshot: '#ec4899',
  Zhipu: '#06b6d4',
  Mistral: '#ff7000',
  ByteDance: '#3b82f6',
  Tencent: '#22c55e',
  MiniMax: '#a855f7',
  Cohere: '#fb923c',
  Baidu: '#ef4444',
  Others: '#94a3b8',
};

const FALLBACK_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#10b981',
];

function formatTokens(value) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000_000_000)
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  return Number(value).toLocaleString();
}

function formatShare(share) {
  if (!Number.isFinite(share) || share <= 0) return '0%';
  if (share < 0.001) return '<0.1%';
  return `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;
}

function formatGrowth(value) {
  const safe = Number(value) || 0;
  const sign = safe > 0 ? '+' : '';
  return `${sign}${safe.toFixed(Math.abs(safe) >= 10 ? 0 : 1)}%`;
}

function buildVendorColorMap(vendors) {
  const colorMap = {};
  let fallbackIndex = 0;

  vendors.forEach((item) => {
    if (VENDOR_COLORS[item.name]) {
      colorMap[item.name] = VENDOR_COLORS[item.name];
      return;
    }

    colorMap[item.name] =
      FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
    fallbackIndex += 1;
  });

  return colorMap;
}

function VendorAvatar({ icon, name, size = 24 }) {
  if (icon) {
    return (
      <div className='ranking-icon-wrap'>{getLobeHubIcon(icon, size)}</div>
    );
  }

  return (
    <Avatar size='small' color='blue'>
      {String(name || '?')
        .slice(0, 1)
        .toUpperCase()}
    </Avatar>
  );
}

function GrowthText({ value }) {
  const positive = Number(value) >= 0;
  return (
    <span
      className={`rankings-growth ${positive ? 'is-positive' : 'is-negative'}`}
    >
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {formatGrowth(value)}
    </span>
  );
}

function ChartEmpty({ label }) {
  return <div className='rankings-chart-empty'>{label}</div>;
}

function LoadingState() {
  return (
    <div className='rankings-loading'>
      {/* <section className='rankings-hero-card rankings-skeleton-card'>
        <div className='rankings-hero-glow rankings-hero-glow-a' />
        <div className='rankings-hero-glow rankings-hero-glow-b' />
        <div className='rankings-hero-content'>
          <div className='rankings-skeleton-block rankings-skeleton-title' />
          <div className='rankings-skeleton-block rankings-skeleton-subtitle' />
          <div className='rankings-skeleton-block rankings-skeleton-subtitle short' />
          <div className='rankings-skeleton-pill-row'>
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className='rankings-skeleton-block rankings-skeleton-pill'
              />
            ))}
          </div>
        </div>
      </section> */}

      <div className='rankings-sections'>
        {[0, 1].map((item) => (
          <Card
            key={item}
            className='rankings-card rankings-skeleton-card'
            bodyStyle={{ padding: 0 }}
          >
            <div className='rankings-card-header'>
              <div className='rankings-skeleton-copy'>
                <div className='rankings-skeleton-block rankings-skeleton-card-title' />
                <div className='rankings-skeleton-block rankings-skeleton-card-desc' />
                <div className='rankings-skeleton-block rankings-skeleton-card-desc short' />
              </div>
              {item === 0 && (
                <div className='rankings-skeleton-metric'>
                  <div className='rankings-skeleton-block rankings-skeleton-metric-value' />
                  <div className='rankings-skeleton-block rankings-skeleton-metric-label' />
                </div>
              )}
            </div>

            <div className='rankings-chart-shell rankings-skeleton-chart-shell'>
              <div className='rankings-skeleton-chart'>
                <div className='rankings-skeleton-axis y' />
                <div className='rankings-skeleton-axis x' />
                <div className='rankings-skeleton-bars'>
                  {[52, 96, 74, 128, 88, 110, 66, 124, 92, 118, 76, 102].map(
                    (height, barIndex) => (
                      <div
                        key={barIndex}
                        className='rankings-skeleton-bar'
                        style={{ height }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className='rankings-card-divider' />
            <div className='rankings-subheader'>
              <div className='rankings-skeleton-copy'>
                <div className='rankings-skeleton-block rankings-skeleton-subheader-title' />
                <div className='rankings-skeleton-block rankings-skeleton-subheader-desc' />
              </div>
            </div>
            <div className='rankings-grid-list rankings-skeleton-list-grid'>
              {[0, 1].map((column) => (
                <ul key={column} className='rankings-list'>
                  {[0, 1, 2, 3, 4].map((row) => (
                    <li
                      key={`${column}-${row}`}
                      className='rankings-list-item rankings-skeleton-list-item'
                    >
                      <div className='rankings-skeleton-block rankings-skeleton-rank' />
                      <div className='rankings-skeleton-block rankings-skeleton-avatar' />
                      <div className='rankings-list-main'>
                        <div className='rankings-skeleton-block rankings-skeleton-line' />
                        <div className='rankings-skeleton-block rankings-skeleton-line short' />
                      </div>
                      <div className='rankings-list-metric'>
                        <div className='rankings-skeleton-block rankings-skeleton-value' />
                        <div className='rankings-skeleton-block rankings-skeleton-value-sub' />
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </Card>
        ))}

        <Row gutter={[16, 16]}>
          {[0, 1].map((item) => (
            <Col key={item} xs={24} lg={12}>
              <Card
                className='rankings-card rankings-skeleton-card'
                bodyStyle={{ padding: 0 }}
              >
                <div className='rankings-subheader pulse'>
                  <div className='rankings-skeleton-copy'>
                    <div className='rankings-skeleton-block rankings-skeleton-subheader-title' />
                    <div className='rankings-skeleton-block rankings-skeleton-subheader-desc' />
                  </div>
                </div>
                <div className='rankings-pulse-list'>
                  {[0, 1, 2, 3].map((row) => (
                    <div
                      key={row}
                      className='rankings-list-item rankings-skeleton-list-item'
                    >
                      <div className='rankings-skeleton-block rankings-skeleton-avatar' />
                      <div className='rankings-list-main'>
                        <div className='rankings-skeleton-block rankings-skeleton-line' />
                        <div className='rankings-skeleton-block rankings-skeleton-line short' />
                      </div>
                      <div className='rankings-list-metric'>
                        <div className='rankings-skeleton-block rankings-skeleton-value-sub' />
                        <div className='rankings-skeleton-block rankings-skeleton-value-sub short' />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}

function ErrorState() {
  const { t } = useTranslation();

  return (
    <Card className='rankings-card'>
      <div className='rankings-empty-wrap'>
        <Empty
          description={t('无法加载排行榜')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Text className='rankings-empty-text'>{t('无法加载排行榜数据')}</Text>
        </Empty>
      </div>
    </Card>
  );
}

function ModelLeaderboard({ rows, t }) {
  if (!rows.length) {
    return (
      <div className='rankings-list-empty'>
        {t('没有符合当前筛选条件的模型')}
      </div>
    );
  }

  const half = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, half), rows.slice(half)];

  return (
    <div className='rankings-grid-list'>
      {columns.map((column, index) =>
        column.length ? (
          <ul key={index} className='rankings-list'>
            {column.map((row) => (
              <li key={row.model_name} className='rankings-list-item'>
                <span className='rankings-rank-index'>{row.rank}.</span>
                <VendorAvatar icon={row.vendor_icon} name={row.vendor} />
                <div className='rankings-list-main'>
                  <div className='rankings-list-title'>{row.model_name}</div>
                  <div className='rankings-list-subline'>
                    <span>{row.vendor}</span>
                    <Tag size='small' color='grey'>
                      {row.category}
                    </Tag>
                  </div>
                </div>
                <div className='rankings-list-metric'>
                  <div className='rankings-list-metric-value'>
                    {formatTokens(Number(row.total_tokens) || 0)}
                  </div>
                  <GrowthText value={row.growth_pct} />
                </div>
              </li>
            ))}
          </ul>
        ) : null,
      )}
    </div>
  );
}

function VendorLeaderboard({ rows, colorMap, t }) {
  if (!rows.length) {
    return <div className='rankings-list-empty'>{t('暂无厂商数据')}</div>;
  }

  const visibleRows = rows.slice(0, 12);
  const half = Math.ceil(visibleRows.length / 2);
  const columns = [visibleRows.slice(0, half), visibleRows.slice(half)];

  return (
    <div className='rankings-grid-list'>
      {columns.map((column, index) =>
        column.length ? (
          <ul key={index} className='rankings-list'>
            {column.map((row) => (
              <li key={row.vendor} className='rankings-list-item'>
                <span className='rankings-rank-index'>{row.rank}.</span>
                <span
                  className='rankings-vendor-dot'
                  style={{ background: colorMap[row.vendor] || '#94a3b8' }}
                />
                <div className='rankings-list-main'>
                  <div className='rankings-list-title'>{row.vendor}</div>
                  <div className='rankings-list-subline'>
                    <span>{row.top_model}</span>
                    <span>{row.models_count} models</span>
                  </div>
                </div>
                <div className='rankings-list-metric'>
                  <div className='rankings-list-metric-value'>
                    {formatTokens(Number(row.total_tokens) || 0)}
                  </div>
                  <div className='rankings-list-metric-sub'>
                    {formatShare(Number(row.share) || 0)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null,
      )}
    </div>
  );
}

function PulseCard({ icon, title, description, tone, rows, emptyLabel }) {
  return (
    <Card
      className='rankings-card rankings-pulse-card'
      bodyStyle={{ padding: 0 }}
    >
      <div className='rankings-subheader pulse'>
        <div className={`rankings-card-title is-small pulse-${tone}`}>
          {icon}
          <span>{title}</span>
        </div>
        <Text className='rankings-subdesc'>{description}</Text>
      </div>

      {!rows.length ? (
        <div className='rankings-list-empty'>{emptyLabel}</div>
      ) : (
        <ul className='rankings-list rankings-pulse-list'>
          {rows.map((row) => (
            <li
              key={`${row.model_name}-${row.current_rank}`}
              className='rankings-list-item'
            >
              <VendorAvatar icon={row.vendor_icon} name={row.vendor} />
              <div className='rankings-list-main'>
                <div className='rankings-list-title'>{row.model_name}</div>
                <div className='rankings-list-subline'>
                  <span>#{row.current_rank}</span>
                  <span>{row.vendor}</span>
                </div>
              </div>
              <div className='rankings-list-metric'>
                <div className={`rankings-rank-shift ${tone}`}>
                  {tone === 'up' ? (
                    <ArrowUpRight size={12} />
                  ) : (
                    <ArrowDownRight size={12} />
                  )}
                  {Math.abs(Number(row.rank_delta) || 0)}
                </div>
                <GrowthText value={row.growth_pct} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Rankings() {
  const { t } = useTranslation();
  const actualTheme = useActualTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);

  const period = PERIODS.includes(searchParams.get('period'))
    ? searchParams.get('period')
    : 'week';

  useEffect(() => {
    let mounted = true;

    const fetchRankings = async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/rankings', {
          params: { period },
          disableDuplicate: true,
          skipErrorHandler: true,
        });
        const { success, data, message } = res.data;
        if (!mounted) return;
        if (success) {
          setSnapshot(data || null);
        } else {
          setSnapshot(null);
          showError(message || t('无法加载排行榜数据'));
        }
      } catch (error) {
        if (!mounted) return;
        setSnapshot(null);
        showError(error?.message || t('无法加载排行榜数据'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRankings();
    return () => {
      mounted = false;
    };
  }, [period, t]);

  const vendorColorMap = useMemo(() => {
    return buildVendorColorMap(snapshot?.vendor_share_history?.vendors || []);
  }, [snapshot]);

  const totalTokens = useMemo(() => {
    return (snapshot?.models || []).reduce(
      (sum, item) => sum + (Number(item?.total_tokens) || 0),
      0,
    );
  }, [snapshot]);

  const modelHistorySpec = useMemo(() => {
    const points = snapshot?.models_history?.points || [];
    if (!points.length) return null;

    return {
      type: 'bar',
      data: [{ id: 'models-history', values: points }],
      xField: 'label',
      yField: 'tokens',
      seriesField: 'model',
      stack: true,
      legends: { visible: false },
      background: 'transparent',
      axes: [
        {
          orient: 'bottom',
          label: {
            style: {
              fill: actualTheme === 'dark' ? '#9fb0c8' : '#66788f',
              fontSize: 10,
            },
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (value) => formatTokens(Number(value)),
            style: {
              fill: actualTheme === 'dark' ? '#9fb0c8' : '#66788f',
              fontSize: 10,
            },
          },
          grid: {
            visible: true,
            style: {
              stroke:
                actualTheme === 'dark'
                  ? 'rgba(148, 163, 184, 0.14)'
                  : 'rgba(148, 163, 184, 0.20)',
              lineDash: [4, 4],
            },
          },
        },
      ],
      tooltip: {
        dimension: {
          title: {
            value: (datum) => String(datum?.label || ''),
          },
          content: [
            {
              key: (datum) => String(datum?.model || ''),
              value: (datum) => formatTokens(Number(datum?.tokens) || 0),
            },
          ],
        },
      },
    };
  }, [actualTheme, snapshot]);

  const vendorShareSpec = useMemo(() => {
    const points = snapshot?.vendor_share_history?.points || [];
    if (!points.length) return null;

    return {
      type: 'bar',
      data: [{ id: 'vendor-share', values: points }],
      xField: 'label',
      yField: 'share',
      seriesField: 'vendor',
      stack: true,
      legends: { visible: false },
      background: 'transparent',
      color: { specified: vendorColorMap },
      axes: [
        {
          orient: 'bottom',
          label: {
            style: {
              fill: actualTheme === 'dark' ? '#9fb0c8' : '#66788f',
              fontSize: 10,
            },
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          min: 0,
          max: 1,
          label: {
            formatMethod: (value) => `${Math.round(Number(value) * 100)}%`,
            style: {
              fill: actualTheme === 'dark' ? '#9fb0c8' : '#66788f',
              fontSize: 10,
            },
          },
          grid: {
            visible: true,
            style: {
              stroke:
                actualTheme === 'dark'
                  ? 'rgba(148, 163, 184, 0.14)'
                  : 'rgba(148, 163, 184, 0.20)',
              lineDash: [4, 4],
            },
          },
        },
      ],
      tooltip: {
        dimension: {
          title: {
            value: (datum) => String(datum?.label || ''),
          },
          content: [
            {
              key: (datum) => String(datum?.vendor || ''),
              value: (datum) =>
                `${formatShare(Number(datum?.share) || 0)} · ${formatTokens(Number(datum?.tokens) || 0)}`,
            },
          ],
        },
      },
    };
  }, [actualTheme, snapshot, vendorColorMap]);

  const handlePeriodChange = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('period', next);
      return params;
    });
  };

  return (
    <div className='rankings-page'>
      <section className='rankings-hero-card'>
        <div className='rankings-hero-glow rankings-hero-glow-a' />
        <div className='rankings-hero-glow rankings-hero-glow-b' />
        <div className='rankings-hero-content'>
          <Title heading={2} className='!mb-2 rankings-title'>
            {t('排行榜')}
          </Title>
          <Text className='rankings-subtitle'>
            {t(
              '查看平台上使用量最高的模型与快速上升的厂商，数据基于实时用量更新。',
            )}
          </Text>

          <div className='rankings-period-tabs'>
            {PERIODS.map((item) => (
              <Button
                key={item}
                theme={period === item ? 'solid' : 'borderless'}
                type={period === item ? 'primary' : 'tertiary'}
                className={`rankings-period-btn ${period === item ? 'is-active' : ''}`}
                onClick={() => handlePeriodChange(item)}
              >
                {t(PERIOD_LABELS[item])}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingState />
      ) : !snapshot ? (
        <ErrorState />
      ) : (
        <div className='rankings-sections'>
          <Card
            className='rankings-card rankings-chart-card'
            bodyStyle={{ padding: 0 }}
          >
            <div className='rankings-card-header'>
              <div>
                <div className='rankings-card-title'>
                  <BarChart3 size={16} />
                  <span>{t('热门模型')}</span>
                </div>
                <Text className='rankings-card-desc'>
                  {t(PERIOD_DESCRIPTIONS[period].models)}
                </Text>
              </div>
              <div className='rankings-metric-block'>
                <div className='rankings-metric-value'>
                  {formatTokens(totalTokens)}
                </div>
                <div className='rankings-metric-label'>{t('令牌')}</div>
              </div>
            </div>
            <div className='rankings-chart-shell'>
              {modelHistorySpec ? (
                <VChart spec={modelHistorySpec} />
              ) : (
                <ChartEmpty label={t('暂无历史数据')} />
              )}
            </div>
            <div className='rankings-card-divider' />
            <div className='rankings-subheader'>
              <div className='rankings-card-title is-small'>
                <Trophy size={15} />
                <span>{t('LLM 排行榜')}</span>
              </div>
              <Text className='rankings-subdesc'>
                {t('对比平台上最受欢迎的模型')}
              </Text>
            </div>
            <ModelLeaderboard rows={snapshot.models || []} t={t} />
          </Card>

          <Card
            className='rankings-card rankings-chart-card'
            bodyStyle={{ padding: 0 }}
          >
            <div className='rankings-card-header'>
              <div>
                <div className='rankings-card-title'>
                  <PieChart size={16} />
                  <span>{t('市场份额')}</span>
                </div>
                <Text className='rankings-card-desc'>
                  {t(PERIOD_DESCRIPTIONS[period].vendors)}
                </Text>
              </div>
            </div>
            <div className='rankings-chart-shell'>
              {vendorShareSpec ? (
                <VChart spec={vendorShareSpec} />
              ) : (
                <ChartEmpty label={t('暂无历史数据')} />
              )}
            </div>
            <div className='rankings-card-divider' />
            <div className='rankings-subheader'>
              <div className='rankings-card-title is-small'>
                <span>{t('按模型厂商')}</span>
              </div>
              <Text className='rankings-subdesc'>
                {t('按聚合 Token 用量排序的厂商')}
              </Text>
            </div>
            <VendorLeaderboard
              rows={snapshot.vendors || []}
              colorMap={vendorColorMap}
              t={t}
            />
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <PulseCard
                icon={<TrendingUp size={16} />}
                title={t('上升中')}
                description={t('排名持续上升的模型')}
                tone='up'
                rows={snapshot.top_movers || []}
                emptyLabel={t('当前暂无明显上升的模型')}
              />
            </Col>
            <Col xs={24} lg={12}>
              <PulseCard
                icon={<TrendingDown size={16} />}
                title={t('下降中')}
                description={t('排名下滑的模型')}
                tone='down'
                rows={snapshot.top_droppers || []}
                emptyLabel={t('当前暂无明显下滑的模型')}
              />
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
}
