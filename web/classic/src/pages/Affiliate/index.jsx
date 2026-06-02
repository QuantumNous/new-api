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
import { IllustrationNoResult } from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import UsageLogsTable from '../../components/table/usage-logs';
import { API } from '../../helpers';

const { Text } = Typography;

const Affiliate = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

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
    return (
      <div className='mt-[60px] px-2'>
        <Card className='!rounded-2xl'>
          <div className='flex items-center justify-center min-h-[240px]'>
            <Spin size='large' />
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
      <UsageLogsTable mode='affiliate' />
    </div>
  );
};

export default Affiliate;
