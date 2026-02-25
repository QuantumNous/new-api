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

import React, { useCallback, useMemo, useState } from 'react';
import {
  Card,
  Tabs,
  TabPane,
  Table,
  Button,
  Modal,
  Empty,
  Tag,
} from '@douyinfe/semi-ui';
import { Users, ListOrdered } from 'lucide-react';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, renderNumber, renderQuota, showError } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const EMPTY_RANKINGS = {
  token_rank: [],
  quota_rank: [],
};

const getRankTagColor = (index) => {
  if (index === 0) {
    return 'red';
  }
  if (index === 1) {
    return 'orange';
  }
  if (index === 2) {
    return 'yellow';
  }
  return 'grey';
};

const UserConsumeRankingPanel = ({
  userConsumeRankings,
  userRankLoading,
  inputs,
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  t,
}) => {
  const [activeTab, setActiveTab] = useState('token');
  const [modelActiveTab, setModelActiveTab] = useState('token');
  const [userModelModalVisible, setUserModelModalVisible] = useState(false);
  const [userModelRankLoading, setUserModelRankLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModelRankings, setUserModelRankings] = useState(EMPTY_RANKINGS);
  const isMobile = useIsMobile();

  const emptyNode = useMemo(
    () => (
      <Empty
        image={<IllustrationNoResult style={{ width: 120, height: 120 }} />}
        darkModeImage={
          <IllustrationNoResultDark style={{ width: 120, height: 120 }} />
        }
        title={t('暂无数据')}
      />
    ),
    [t],
  );

  const getTimeRange = useCallback(() => {
    const startTimestamp = Math.floor(
      Date.parse(inputs.start_timestamp) / 1000,
    );
    const endTimestamp = Math.floor(Date.parse(inputs.end_timestamp) / 1000);
    return {
      startTimestamp: Number.isFinite(startTimestamp) ? startTimestamp : 0,
      endTimestamp: Number.isFinite(endTimestamp) ? endTimestamp : 0,
    };
  }, [inputs.end_timestamp, inputs.start_timestamp]);

  const loadUserModelRankings = useCallback(
    async (userId) => {
      setUserModelRankLoading(true);
      try {
        const { startTimestamp, endTimestamp } = getTimeRange();
        const url = `/api/data/rank/users/${userId}/models?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&limit=50`;
        const res = await API.get(url);
        const { success, message, data } = res.data;
        if (success) {
          setUserModelRankings(data || EMPTY_RANKINGS);
        } else {
          showError(message);
          setUserModelRankings(EMPTY_RANKINGS);
        }
      } catch (err) {
        console.error(err);
        showError(t('加载失败'));
        setUserModelRankings(EMPTY_RANKINGS);
      } finally {
        setUserModelRankLoading(false);
      }
    },
    [getTimeRange, t],
  );

  const showModelRankingModal = useCallback(
    async (userRecord) => {
      setSelectedUser(userRecord);
      setModelActiveTab('token');
      setUserModelModalVisible(true);
      await loadUserModelRankings(userRecord.user_id);
    },
    [loadUserModelRankings],
  );

  const handleCloseUserModelModal = useCallback(() => {
    setUserModelModalVisible(false);
    setSelectedUser(null);
    setUserModelRankings(EMPTY_RANKINGS);
  }, []);

  const currentUserRankData = useMemo(() => {
    if (activeTab === 'token') {
      return userConsumeRankings?.token_rank || [];
    }
    return userConsumeRankings?.quota_rank || [];
  }, [activeTab, userConsumeRankings]);

  const currentUserModelRankData = useMemo(() => {
    if (modelActiveTab === 'token') {
      return userModelRankings?.token_rank || [];
    }
    return userModelRankings?.quota_rank || [];
  }, [modelActiveTab, userModelRankings]);

  const userColumns = useMemo(
    () => [
      {
        title: t('排名'),
        key: 'rank',
        width: 90,
        render: (_, __, index) => (
          <Tag color={getRankTagColor(index)} shape='circle' size='small'>
            #{index + 1}
          </Tag>
        ),
      },
      {
        title: t('用户名称'),
        dataIndex: 'username',
        key: 'username',
      },
      {
        title: t('消耗Token'),
        dataIndex: 'token_used',
        key: 'token_used',
        render: (value) => renderNumber(value || 0),
      },
      {
        title: t('消耗金额'),
        dataIndex: 'quota',
        key: 'quota',
        render: (value) => renderQuota(value || 0, 4),
      },
      {
        title: t('请求次数'),
        dataIndex: 'count',
        key: 'count',
        render: (value) => renderNumber(value || 0),
      },
      {
        title: t('操作'),
        key: 'operation',
        width: 130,
        render: (_, record) => (
          <Button
            type='tertiary'
            size='small'
            onClick={(e) => {
              e.stopPropagation();
              showModelRankingModal(record);
            }}
          >
            {t('模型排行')}
          </Button>
        ),
      },
    ],
    [showModelRankingModal, t],
  );

  const modelColumns = useMemo(
    () => [
      {
        title: t('排名'),
        key: 'rank',
        width: 90,
        render: (_, __, index) => (
          <Tag color={getRankTagColor(index)} shape='circle' size='small'>
            #{index + 1}
          </Tag>
        ),
      },
      {
        title: t('模型'),
        dataIndex: 'model_name',
        key: 'model_name',
      },
      {
        title: t('消耗Token'),
        dataIndex: 'token_used',
        key: 'token_used',
        render: (value) => renderNumber(value || 0),
      },
      {
        title: t('消耗金额'),
        dataIndex: 'quota',
        key: 'quota',
        render: (value) => renderQuota(value || 0, 4),
      },
      {
        title: t('请求次数'),
        dataIndex: 'count',
        key: 'count',
        render: (value) => renderNumber(value || 0),
      },
    ],
    [t],
  );

  return (
    <>
      <Card
        {...CARD_PROPS}
        className='!rounded-2xl'
        title={
          <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3'>
            <div className={FLEX_CENTER_GAP2}>
              <Users size={16} />
              {t('用户消耗排行')}
            </div>
            <Tabs type='slash' activeKey={activeTab} onChange={setActiveTab}>
              <TabPane
                tab={<span>{t('用户Token消耗排行')}</span>}
                itemKey='token'
              />
              <TabPane
                tab={<span>{t('用户消耗金额排行')}</span>}
                itemKey='quota'
              />
            </Tabs>
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        <div className='p-2'>
          <Table
            columns={userColumns}
            dataSource={currentUserRankData}
            loading={userRankLoading}
            pagination={false}
            rowKey='user_id'
            size='small'
            empty={emptyNode}
            onRow={(record) => ({
              onClick: () => showModelRankingModal(record),
            })}
          />
        </div>
      </Card>

      <Modal
        title={`${selectedUser?.username || '-'} ${t('模型消耗排行')}`}
        visible={userModelModalVisible}
        onCancel={handleCloseUserModelModal}
        footer={null}
        size={isMobile ? 'full-width' : 'large'}
      >
        <Tabs
          type='line'
          activeKey={modelActiveTab}
          onChange={setModelActiveTab}
        >
          <TabPane
            tab={<span>{t('模型Token消耗排行')}</span>}
            itemKey='token'
          />
          <TabPane tab={<span>{t('模型金额消耗排行')}</span>} itemKey='quota' />
        </Tabs>
        <Table
          columns={modelColumns}
          dataSource={currentUserModelRankData}
          loading={userModelRankLoading}
          pagination={false}
          rowKey='model_name'
          size='small'
          empty={emptyNode}
        />
      </Modal>
    </>
  );
};

export default UserConsumeRankingPanel;
