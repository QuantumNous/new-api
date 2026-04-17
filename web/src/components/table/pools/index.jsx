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

import React from 'react';
import {
  Button,
  Card,
  Divider,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  TabPane,
  Typography,
} from '@douyinfe/semi-ui';
import { usePoolsData } from '../../../hooks/pools/usePoolsData';
import PoolFormSideSheet from './modals/PoolFormSideSheet';
import PoolChannelFormSideSheet from './modals/PoolChannelFormSideSheet';
import PoolPolicyFormSideSheet from './modals/PoolPolicyFormSideSheet';
import PoolBindingFormSideSheet from './modals/PoolBindingFormSideSheet';

const { Text } = Typography;

const PoolsTable = () => {
  const {
    PAGE_SIZE,
    t,
    activeTab,
    handleTabChange,
    loadPools,
    loadPoolChannels,
    loadPolicies,
    loadBindings,

    poolItems,
    poolTotal,
    poolPage,
    poolLoading,
    poolForm,
    setPoolForm,
    showPoolForm,
    openCreatePool,
    closePoolForm,
    poolColumns,
    savePool,

    channelItems,
    channelTotal,
    channelPage,
    channelLoading,
    channelForm,
    setChannelForm,
    showChannelForm,
    openCreateChannel,
    closeChannelForm,
    channelColumns,
    channelPoolFilter,
    setChannelPoolFilter,
    clearChannelFilters,
    savePoolChannel,

    policyItems,
    policyTotal,
    policyPage,
    policyLoading,
    policyForm,
    setPolicyForm,
    showPolicyForm,
    openCreatePolicy,
    closePolicyForm,
    policyColumns,
    policyPoolFilter,
    setPolicyPoolFilter,
    clearPolicyFilters,
    savePolicy,

    bindingItems,
    bindingTotal,
    bindingPage,
    bindingLoading,
    bindingForm,
    setBindingForm,
    showBindingForm,
    openCreateBinding,
    closeBindingForm,
    bindingColumns,
    bindingTypeFilter,
    setBindingTypeFilter,
    bindingValueFilter,
    setBindingValueFilter,
    bindingNameFilter,
    setBindingNameFilter,
    clearBindingFilters,
    saveBinding,

    usageLoading,
    usageQuery,
    setUsageQuery,
    usageResult,
    selfUsageResult,
    queryUsage,
    querySelfUsage,
  } = usePoolsData();

  return (
    <Card>
      <PoolFormSideSheet
        visible={showPoolForm}
        formData={poolForm}
        setFormData={setPoolForm}
        onSubmit={savePool}
        onCancel={closePoolForm}
        t={t}
      />
      <PoolChannelFormSideSheet
        visible={showChannelForm}
        formData={channelForm}
        setFormData={setChannelForm}
        onSubmit={savePoolChannel}
        onCancel={closeChannelForm}
        t={t}
      />
      <PoolPolicyFormSideSheet
        visible={showPolicyForm}
        formData={policyForm}
        setFormData={setPolicyForm}
        onSubmit={savePolicy}
        onCancel={closePolicyForm}
        t={t}
      />
      <PoolBindingFormSideSheet
        visible={showBindingForm}
        formData={bindingForm}
        setFormData={setBindingForm}
        onSubmit={saveBinding}
        onCancel={closeBindingForm}
        t={t}
      />
      <div className='flex items-center justify-between mb-4'>
        <div>
          <Text strong>{t('Coding Plan')}</Text>
          <div>
            <Text type='secondary'>
              {t('Manage pools, pool channels, rolling policies, and bindings')}
            </Text>
          </div>
        </div>
        <Button
          type='primary'
          onClick={() => {
            if (activeTab === 'pool') loadPools(1);
            if (activeTab === 'channel') loadPoolChannels(1);
            if (activeTab === 'policy') loadPolicies(1);
            if (activeTab === 'binding') loadBindings(1);
          }}
        >
          {t('Refresh')}
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={handleTabChange} type='card'>
        <TabPane className='pt-4' tab={t('Pool Bindings')} itemKey='binding'>
          {/* <div className='flex justify-end mb-3'>
          </div> */}
          <div className='flex gap-2 mb-3'>
            <Button type='primary' onClick={openCreateBinding}>
              {t('Create')}
            </Button>
            <Input
              placeholder='filter binding_value'
              value={bindingValueFilter}
              onChange={(value) => setBindingValueFilter(value)}
              style={{ maxWidth: 220 }}
            />
            <Input
              placeholder='filter binding_name'
              value={bindingNameFilter}
              onChange={(value) => setBindingNameFilter(value)}
              style={{ maxWidth: 220 }}
            />
            <Select
              value={bindingTypeFilter}
              onChange={(value) => setBindingTypeFilter(value)}
              style={{ maxWidth: 220 }}
              allowClear
            >
              <Select.Option value=''>all</Select.Option>
              <Select.Option value='token'>token</Select.Option>
              <Select.Option value='user'>user</Select.Option>
            </Select>
            <Button onClick={() => loadBindings(1)}>{t('Apply Filter')}</Button>
            <Button onClick={clearBindingFilters}>{t('Clear Filters')}</Button>
          </div>
          <Table
            rowKey='id'
            loading={bindingLoading}
            columns={bindingColumns}
            dataSource={bindingItems}
            pagination={{
              currentPage: bindingPage,
              pageSize: PAGE_SIZE,
              total: bindingTotal,
              onPageChange: (p) => loadBindings(p),
            }}
          />
        </TabPane>

        <TabPane className='pt-4' tab={t('Pools')} itemKey='pool'>
          {/* <div className='flex justify-end mb-3'>
          </div> */}
          <div className='flex gap-2 mb-3'>
            <Button type='primary' onClick={openCreatePool}>
              {t('Create')}
            </Button>
          </div>
          <Table
            rowKey='id'
            loading={poolLoading}
            columns={poolColumns}
            dataSource={poolItems}
            pagination={{
              currentPage: poolPage,
              pageSize: PAGE_SIZE,
              total: poolTotal,
              onPageChange: (p) => loadPools(p),
            }}
            empty={
              <Empty description={t('No data')}>
                <span />
              </Empty>
            }
          />
        </TabPane>

        <TabPane className='pt-4' tab={t('Pool Channels')} itemKey='channel'>
          {/* <div className='flex justify-end mb-3'>
          </div> */}
          <div className='flex gap-2 mb-3'>
            <Button type='primary' onClick={openCreateChannel}>
              {t('Create')}
            </Button>
            <Input
              placeholder='filter pool_id'
              value={channelPoolFilter}
              onChange={(value) => setChannelPoolFilter(value)}
              style={{ maxWidth: 220 }}
            />
            <Button onClick={() => loadPoolChannels(1)}>{t('Apply Filter')}</Button>
            <Button onClick={clearChannelFilters}>{t('Clear Filters')}</Button>
          </div>
          <Table
            rowKey='id'
            loading={channelLoading}
            columns={channelColumns}
            dataSource={channelItems}
            pagination={{
              currentPage: channelPage,
              pageSize: PAGE_SIZE,
              total: channelTotal,
              onPageChange: (p) => loadPoolChannels(p),
            }}
          />
        </TabPane>

        <TabPane className='pt-4' tab={t('Pool Policies')} itemKey='policy'>
          {/* <div className='flex justify-end mb-3'>
          </div> */}
          {/* <Text type='secondary' size='small'>
            {t(
              'Scope precedence: token policies take priority over user policies for the same pool. If token identity is missing, token-scope falls back to user scope.',
            )}
          </Text> */}
          <div className='flex gap-2 mb-3'>
            <Button type='primary' onClick={openCreatePolicy}>
              {t('Create')}
            </Button>
            <Input
              placeholder='filter pool_id'
              value={policyPoolFilter}
              onChange={(value) => setPolicyPoolFilter(value)}
              style={{ maxWidth: 220 }}
            />
            <Button onClick={() => loadPolicies(1)}>{t('Apply Filter')}</Button>
            <Button onClick={clearPolicyFilters}>{t('Clear Filters')}</Button>
          </div>
          <Table
            rowKey='id'
            loading={policyLoading}
            columns={policyColumns}
            dataSource={policyItems}
            pagination={{
              currentPage: policyPage,
              pageSize: PAGE_SIZE,
              total: policyTotal,
              onPageChange: (p) => loadPolicies(p),
            }}
          />
        </TabPane>
      </Tabs>

      {/* <div className='mt-2 mb-2'>
        <Text type='secondary' size='small'>
          {t('Configuration tabs: Pools, Pool Channels, Pool Policies')}
        </Text>
      </div> */}
      <Divider style={{ margin: '24px 0' }} />

      <Card
        title={t('Rolling Usage Query')}
        headerStyle={{ paddingTop: 16 }}
        bodyStyle={{ paddingTop: 16 }}
      >
        <div className='grid grid-cols-1 md:grid-cols-5 gap-3 mb-3'>
          <Input
            placeholder='pool_id (required)'
            value={usageQuery.pool_id}
            onChange={(value) => setUsageQuery((prev) => ({ ...prev, pool_id: value }))}
          />
          <Select
            value={usageQuery.scope_type || 'token'}
            onChange={(value) => setUsageQuery((prev) => ({ ...prev, scope_type: value }))}
          >
            <Select.Option value='token'>token</Select.Option>
            <Select.Option value='user'>user</Select.Option>
          </Select>
          <Input
            placeholder={
              usageQuery.scope_type === 'token'
                ? 'token_id (required for Query Usage)'
                : 'user_id (required for Query Usage)'
            }
            value={usageQuery.scope_id}
            onChange={(value) => setUsageQuery((prev) => ({ ...prev, scope_id: value }))}
          />
          <Select
            value={usageQuery.window || '5h'}
            onChange={(value) => setUsageQuery((prev) => ({ ...prev, window: value }))}
          >
            <Select.Option value='5m'>5m</Select.Option>
            <Select.Option value='5h'>5h</Select.Option>
            <Select.Option value='7d'>7d</Select.Option>
            <Select.Option value='30d'>30d</Select.Option>
          </Select>
          <Space>
            <Button loading={usageLoading} type='primary' onClick={queryUsage}>
              {t('Query Usage')}
            </Button>
            <Button loading={usageLoading} onClick={querySelfUsage}>
              {t('Query Self')}
            </Button>
          </Space>
        </div>
        <Text type='secondary' size='small'>
          {t(
            'Query Usage requires pool_id + scope_type + scope_id. Query Self uses current login user and only needs window.',
          )}
        </Text>
        {usageResult && (
          <div className='mb-2'>
            <Text strong>{t('Admin usage result')}:</Text>
            <pre className='mt-1 p-2 bg-slate-50 rounded text-xs overflow-auto'>
              {JSON.stringify(usageResult, null, 2)}
            </pre>
          </div>
        )}
        {selfUsageResult && (
          <div>
            <Text strong>{t('Self usage result')}:</Text>
            <pre className='mt-1 p-2 bg-slate-50 rounded text-xs overflow-auto'>
              {JSON.stringify(selfUsageResult, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </Card>
  );
};

export default PoolsTable;

