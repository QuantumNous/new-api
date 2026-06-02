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
  const [logsResetKey, setLogsResetKey] = useState(0);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/affiliate/status');
      const { success, data, message: responseMessage } = res.data;
      if (success) {
        setStatus(data);
        setMessage(data?.message || '');
      } else {
        setStatus(null);
        setMessage(responseMessage || t('分销状态加载失败'));
      }
    } catch (error) {
      setStatus(null);
      setMessage(t('分销状态加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

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
