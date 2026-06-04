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

import React, { useEffect, useState } from 'react';
import { Button, Card, Empty, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationNoResult,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import UsageLogsTable from '../../components/table/usage-logs';
import { API } from '../../helpers';
import { buildAffiliateDashboardCards } from './affiliateDashboardCards';
import {
  buildAffiliateSummaryTrendParams,
  buildAffiliateTrendRows,
} from './affiliateDashboardTrends';
import {
  buildAffiliateSectionErrorState,
  buildAffiliateStatusLoadingState,
} from './affiliateViewState';

const { Text } = Typography;

function formatTrendMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '¥0.00';
  }
  return `¥${amount.toFixed(2)}`;
}

const AffiliateSectionFallback = ({ t, section, onRetry }) => {
  const state = buildAffiliateSectionErrorState(t, {
    section,
    retryable: Boolean(onRetry),
  });

  return (
    <Card className='!rounded-2xl'>
      <Empty
        image={<IllustrationFailure style={{ width: 150, height: 150 }} />}
        title={state.title}
        description={<Text type='secondary'>{state.description}</Text>}
      />
      {state.actionLabel && (
        <div className='flex justify-center mt-4'>
          <Button type='tertiary' onClick={onRetry}>
            {state.actionLabel}
          </Button>
        </div>
      )}
    </Card>
  );
};

const AffiliateDashboard = ({ t, loading, summary, error, onRetry }) => {
  if (loading) {
    return (
      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col items-center justify-center min-h-[160px] gap-3 text-center'>
          <Spin size='large' />
          <Text strong>{t('正在加载分销看板')}</Text>
          <Text type='secondary'>
            {t('正在汇总团队人数、消耗和结算指标。')}
          </Text>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <AffiliateSectionFallback t={t} section='dashboard' onRetry={onRetry} />
    );
  }

  const cards = buildAffiliateDashboardCards(t, summary);
  const trendRows = buildAffiliateTrendRows(summary);

  return (
    <>
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4'>
        {cards.map((card) => (
          <Card key={card.key} className='!rounded-2xl'>
            <div className='flex flex-col gap-2'>
              <Text type='secondary'>{card.title}</Text>
              <div className='text-2xl font-semibold text-semi-color-text-0'>
                {card.value}
              </div>
              <Text type='tertiary' size='small'>
                {card.description}
              </Text>
            </div>
          </Card>
        ))}
      </div>
      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col gap-3'>
          <div>
            <Text strong>{t('14 天分销趋势')}</Text>
            <div>
              <Text type='tertiary' size='small'>
                {t('净付费消耗、有效新用户、预估佣金和待结算金额')}
              </Text>
            </div>
          </div>
          {trendRows.length === 0 ? (
            <div className='rounded-xl border border-dashed p-4'>
              <Text type='secondary'>{t('暂无趋势数据')}</Text>
            </div>
          ) : (
            <div className='flex flex-col gap-3'>
              {trendRows.map((row) => (
                <div key={row.label} className='grid gap-2 md:grid-cols-[72px_1fr]'>
                  <Text type='tertiary' size='small'>
                    {row.label}
                  </Text>
                  <div className='flex flex-col gap-1'>
                    <div className='flex items-center gap-2'>
                      <div className='h-2 flex-1 overflow-hidden rounded-full bg-semi-color-fill-1'>
                        <div
                          className='h-full rounded-full bg-semi-color-primary'
                          style={{ width: `${row.paidWidth}%` }}
                        />
                      </div>
                      <Text size='small'>{formatTrendMoney(row.netConsumptionRmb)}</Text>
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='h-2 flex-1 overflow-hidden rounded-full bg-semi-color-fill-1'>
                        <div
                          className='h-full rounded-full bg-semi-color-warning'
                          style={{ width: `${row.pendingWidth}%` }}
                        />
                      </div>
                      <Text size='small'>
                        {formatTrendMoney(row.pendingSettlementRmb)}
                      </Text>
                    </div>
                    <Text type='tertiary' size='small'>
                      {t('有效用户')}：{row.effectiveNewUsers} · {t('佣金')}：
                      {formatTrendMoney(row.estimatedCommissionRmb)} · {t('人头费')}：
                      {formatTrendMoney(row.headFeeRmb)}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
};

const AffiliateTeamTreeNode = ({ t, node }) => {
  const children = Array.isArray(node?.children) ? node.children : [];
  const displayName = node?.username || `#${node?.user_id}`;

  return (
    <div
      className='border-l pl-3 ml-2'
      style={{ borderColor: 'var(--semi-color-border)' }}
    >
      <div className='rounded-xl border px-3 py-2 bg-semi-color-fill-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <Text strong>{displayName}</Text>
          <Text type='tertiary' size='small'>
            ID {node?.user_id}
          </Text>
          {node?.affiliate_level ? (
            <Tag color='blue' shape='circle'>
              {t('等级')} {node.affiliate_level}
            </Tag>
          ) : null}
          <Tag color='grey' shape='circle'>
            {t('深度')} {node?.depth ?? '-'}
          </Tag>
        </div>
        <Text type='tertiary' size='small'>
          {t('直接邀请人')}：{node?.direct_inviter_id || '-'}
          {node?.source ? ` · ${t('来源')}：${node.source}` : ''}
        </Text>
      </div>
      {children.length > 0 ? (
        <div className='mt-2 flex flex-col gap-2'>
          {children.map((child) => (
            <AffiliateTeamTreeNode key={child.user_id} t={t} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const AffiliateTeamTree = ({
  t,
  loading,
  tree,
  error,
  unavailable,
  onRetry,
}) => {
  const items = Array.isArray(tree?.items) ? tree.items : [];

  if (loading) {
    return (
      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col items-center justify-center min-h-[140px] gap-3 text-center'>
          <Spin size='large' />
          <Text strong>{t('正在加载推广关系树')}</Text>
        </div>
      </Card>
    );
  }

  if (error) {
    return <AffiliateSectionFallback t={t} section='team' onRetry={onRetry} />;
  }

  return (
    <Card className='!rounded-2xl mb-4'>
      <div className='flex flex-col gap-2 mb-3'>
        <Text strong>{t('推广关系树')}</Text>
        <Text type='secondary'>
          {t('一级分销商可查看自己的二级分销商，以及二级分销商的下级。')}
        </Text>
        <Text type='tertiary' size='small'>
          {t('总计')}：{Number(tree?.total || 0)}
        </Text>
        {unavailable ? (
          <Text type='warning' size='small'>
            {t(
              '推广关系树接口返回 404，请重启或部署包含 /api/affiliate/team 的后端后查看。',
            )}
          </Text>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className='py-8 text-center'>
          <Text type='secondary'>{t('暂无下级用户')}</Text>
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          {items.map((node) => (
            <AffiliateTeamTreeNode key={node.user_id} t={t} node={node} />
          ))}
        </div>
      )}
    </Card>
  );
};

class AffiliateSectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AffiliateSectionErrorBoundary]', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <AffiliateSectionFallback
          t={this.props.t}
          section={this.props.section}
          onRetry={this.props.onRetry}
        />
      );
    }
    return this.props.children;
  }
}

const Affiliate = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [teamTree, setTeamTree] = useState(null);
  const [teamTreeLoading, setTeamTreeLoading] = useState(false);
  const [teamTreeError, setTeamTreeError] = useState(false);
  const [teamTreeUnavailable, setTeamTreeUnavailable] = useState(false);
  const [logsResetKey, setLogsResetKey] = useState(0);

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const res = await API.get('/api/affiliate/summary', {
        params: buildAffiliateSummaryTrendParams(),
      });
      const { success, data } = res.data;
      if (success) {
        setSummary(data);
      } else {
        setSummary(null);
        setSummaryError(true);
      }
    } catch (error) {
      setSummary(null);
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadTeamTree = async () => {
    setTeamTreeLoading(true);
    setTeamTreeError(false);
    setTeamTreeUnavailable(false);
    try {
      const res = await API.get('/api/affiliate/team', {
        params: { _t: Date.now() },
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
        skipErrorHandler: true,
      });
      const { success, data } = res.data;
      if (success) {
        setTeamTree(data);
      } else {
        setTeamTree(null);
        setTeamTreeError(true);
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        setTeamTree({ items: [], total: 0 });
        setTeamTreeUnavailable(true);
      } else {
        setTeamTree(null);
        setTeamTreeError(true);
      }
    } finally {
      setTeamTreeLoading(false);
    }
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/affiliate/status');
      const { success, data, message: responseMessage } = res.data;
      if (success) {
        setStatus(data);
        setMessage(data?.message || '');
        if (!data?.available) {
          setSummary(null);
          setSummaryError(false);
          setTeamTree(null);
          setTeamTreeError(false);
          setTeamTreeUnavailable(false);
        }
      } else {
        setStatus(null);
        setMessage(responseMessage || t('分销状态加载失败'));
        setSummary(null);
        setSummaryError(false);
        setTeamTree(null);
        setTeamTreeError(false);
        setTeamTreeUnavailable(false);
      }
    } catch (error) {
      setStatus(null);
      setMessage(t('分销状态加载失败'));
      setSummary(null);
      setSummaryError(false);
      setTeamTree(null);
      setTeamTreeError(false);
      setTeamTreeUnavailable(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (status?.available) {
      loadSummary();
      loadTeamTree();
    }
  }, [status?.available]);

  if (loading) {
    const loadingState = buildAffiliateStatusLoadingState(t);

    return (
      <div className='mt-[60px] px-2'>
        <Card className='!rounded-2xl'>
          <div className='flex flex-col items-center justify-center min-h-[240px] gap-3 text-center'>
            <Spin size='large' />
            <Text strong>{loadingState.title}</Text>
            <Text type='secondary'>{loadingState.description}</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (!status?.available) {
    return (
      <div className='mt-[60px] px-2'>
        <Card className='!rounded-2xl'>
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            title={t('分销功能未开通')}
            description={
              <Text type='secondary'>
                {message || t('分销功能未开通，请联系管理员开通。')}
              </Text>
            }
          />
          <div className='flex justify-center mt-4'>
            <Button type='tertiary' onClick={loadStatus}>
              {t('刷新')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className='mt-[60px] px-2'>
      <AffiliateDashboard
        t={t}
        loading={summaryLoading}
        summary={summary}
        error={summaryError}
        onRetry={loadSummary}
      />
      <AffiliateTeamTree
        t={t}
        loading={teamTreeLoading}
        tree={teamTree}
        error={teamTreeError}
        unavailable={teamTreeUnavailable}
        onRetry={loadTeamTree}
      />
      <AffiliateSectionErrorBoundary
        t={t}
        section='logs'
        resetKey={logsResetKey}
        onRetry={() => setLogsResetKey((key) => key + 1)}
      >
        <UsageLogsTable key={logsResetKey} mode='affiliate' />
      </AffiliateSectionErrorBoundary>
    </div>
  );
};

export default Affiliate;
