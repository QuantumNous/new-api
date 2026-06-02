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
import { Button, Card, Empty, Spin, Typography } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationNoResult,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import UsageLogsTable from '../../components/table/usage-logs';
import { API } from '../../helpers';
import { buildAffiliateDashboardCards } from './affiliateDashboardCards';
import {
  buildAffiliateSectionErrorState,
  buildAffiliateStatusLoadingState,
} from './affiliateViewState';

const { Text } = Typography;

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

  return (
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
  const [logsResetKey, setLogsResetKey] = useState(0);

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const res = await API.get('/api/affiliate/summary');
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
        }
      } else {
        setStatus(null);
        setMessage(responseMessage || t('分销状态加载失败'));
        setSummary(null);
        setSummaryError(false);
      }
    } catch (error) {
      setStatus(null);
      setMessage(t('分销状态加载失败'));
      setSummary(null);
      setSummaryError(false);
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
