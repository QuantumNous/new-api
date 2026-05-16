/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) by the user, there is NO WARRANTY.
For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SideSheet,
  Form,
  Button,
  Table,
  Empty,
  Tabs,
  TabPane,
  Space,
} from '@douyinfe/semi-ui';
import { IconDownload, IconSearch } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { IllustrationNoResult, IllustrationNoResultDark } from '@douyinfe/semi-illustrations';
import { renderQuota, renderNumber } from '../../../helpers';
import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';

const CHART_CONFIG = { animate: false };

function toOptions(names) {
  return names.map((n) => ({ value: n, label: n }));
}

function filterOptions(options, keyword) {
  if (!keyword) return options;
  const lower = keyword.toLowerCase();
  return options.filter(
    (o) => o.value.toLowerCase().includes(lower) || o.label.toLowerCase().includes(lower)
  );
}

const StatisticsDrawer = ({
  visible,
  setVisible,
  loading,
  exportLoading,
  statistics,
  trend,
  formInitValues,
  setFormApi,
  fetchStatistics,
  exportExcel,
  buildBarSpec,
  buildTrendSpec,
  buildQuotaBarSpec,
  fetchUserOptions,
  fetchTokenOptions,
  fetchModelOptions,
  isAdminUser,
  t,
}) => {
  // Full option lists (unfiltered)
  const [allUsers, setAllUsers] = useState([]);
  const [allTokens, setAllTokens] = useState([]);
  const [allModels, setAllModels] = useState([]);
  // Filtered lists for display
  const [userFilter, setUserFilter] = useState('');
  const [tokenFilter, setTokenFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const searchTimerRef = useRef(null);

  const filteredUsers = filterOptions(allUsers, userFilter);
  const filteredTokens = filterOptions(allTokens, tokenFilter);
  const filteredModels = filterOptions(allModels, modelFilter);

  // Load user options on open (admin only)
  useEffect(() => {
    if (visible && isAdminUser) {
      fetchUserOptions('').then((names) => setAllUsers(toOptions(names)));
    }
  }, [visible, isAdminUser, fetchUserOptions]);

  const handleUsernameChange = useCallback((value) => {
    const formApi = window.__statsFormApi;
    if (formApi) {
      formApi.setValue('token_name', '');
      formApi.setValue('model_name', '');
    }
    setAllTokens([]);
    setAllModels([]);
    setTokenFilter('');
    setModelFilter('');
    if (!value) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchTokenOptions(value).then((names) => setAllTokens(toOptions(names)));
      fetchModelOptions(value, '').then((names) => setAllModels(toOptions(names)));
    }, 300);
  }, [fetchTokenOptions, fetchModelOptions]);

  const handleTokenChange = useCallback((value) => {
    const formApi = window.__statsFormApi;
    if (formApi) {
      formApi.setValue('model_name', '');
    }
    setAllModels([]);
    setModelFilter('');
    const username = formApi ? formApi.getValue('username') : '';
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchModelOptions(username, value).then((names) => setAllModels(toOptions(names)));
    }, 300);
  }, [fetchModelOptions]);

  const handleUserSearch = useCallback((value) => {
    setUserFilter(value || '');
    if (!isAdminUser) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchUserOptions(value).then((names) => setAllUsers(toOptions(names)));
    }, 300);
  }, [isAdminUser, fetchUserOptions]);

  const handleTokenSearch = useCallback((value) => {
    setTokenFilter(value || '');
  }, []);

  const handleModelSearch = useCallback((value) => {
    setModelFilter(value || '');
  }, []);

  const barSpec = buildBarSpec();
  const trendSpec = buildTrendSpec();
  const quotaBarSpec = buildQuotaBarSpec();
  const hasData = statistics && statistics.length > 0;

  const columns = [
    { title: t('模型名称'), dataIndex: 'model_name', key: 'model_name' },
    { title: t('调用次数'), dataIndex: 'request_count', key: 'request_count', render: (text) => renderNumber(text) },
    { title: t('消耗额度'), dataIndex: 'quota', key: 'quota', render: (text) => renderQuota(text) },
    { title: 'Prompt Tokens(M)', dataIndex: 'prompt_tokens', key: 'prompt_tokens', render: (text) => renderNumber((text || 0) / 1_000_000) },
    { title: 'Completion Tokens(M)', dataIndex: 'completion_tokens', key: 'completion_tokens', render: (text) => renderNumber((text || 0) / 1_000_000) },
    { title: t('总 Tokens(M)'), key: 'total_tokens', render: (_, record) => renderNumber(((record.prompt_tokens || 0) + (record.completion_tokens || 0)) / 1_000_000) },
  ];

  const summaryData = hasData ? [{
    model_name: t('合计'),
    request_count: statistics.reduce((s, m) => s + (m.request_count || 0), 0),
    quota: statistics.reduce((s, m) => s + (m.quota || 0), 0),
    prompt_tokens: statistics.reduce((s, m) => s + (m.prompt_tokens || 0), 0),
    completion_tokens: statistics.reduce((s, m) => s + (m.completion_tokens || 0), 0),
  }] : [];

  return (
    <SideSheet
      title={t('使用统计')}
      visible={visible}
      onCancel={() => setVisible(false)}
      width={720}
      placement='right'
      bodyStyle={{ padding: '16px' }}
    >
      <Form
        initValues={formInitValues}
        getFormApi={(api) => {
          setFormApi(api);
          window.__statsFormApi = api;
        }}
        onSubmit={fetchStatistics}
        allowEmpty
        autoComplete='off'
        layout='vertical'
        trigger='change'
        stopValidateWithError={false}
      >
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2 mb-2'>
          <Form.AutoComplete
            field='username'
            placeholder={t('用户名称（必填）')}
            rules={[{ required: true, message: t('请输入用户名') }]}
            data={filteredUsers}
            showClear={isAdminUser}
            pure
            size='small'
            disabled={!isAdminUser}
            onSearch={handleUserSearch}
            onChange={isAdminUser ? handleUsernameChange : undefined}
          />
          <Form.AutoComplete
            field='token_name'
            placeholder={t('令牌名称（可选）')}
            data={filteredTokens}
            showClear
            pure
            size='small'
            onSearch={handleTokenSearch}
            onChange={handleTokenChange}
          />
          <Form.AutoComplete
            field='model_name'
            placeholder={t('模型名称（可选）')}
            data={filteredModels}
            showClear
            pure
            size='small'
            onSearch={handleModelSearch}
          />
          <div style={{ overflow: 'visible' }}>
            <Form.DatePicker
              field='dateRange'
              type='dateTimeRange'
              placeholder={[t('开始时间（可选）'), t('结束时间（可选）')]}
              showClear
              pure
              size='small'
              disabledDate={(date) => date && date.getTime() > Date.now()}
              position='bottomRight'
              style={{ width: '100%' }}
              presets={DATE_RANGE_PRESETS.map((preset) => ({
                text: t(preset.text),
                start: preset.start(),
                end: preset.end(),
              }))}
            />
          </div>
        </div>
        <Space>
          <Button
            type='primary'
            htmlType='submit'
            loading={loading}
            size='small'
            icon={<IconSearch />}
          >
            {t('查询')}
          </Button>
          {hasData && (
            <Button
              type='tertiary'
              onClick={exportExcel}
              loading={exportLoading}
              size='small'
              icon={<IconDownload />}
            >
              {t('导出 Excel')}
            </Button>
          )}
        </Space>
      </Form>

      {hasData ? (
        <div className='mt-4'>
          <Tabs type='button'>
            <TabPane tab={t('调用次数分布')} itemKey='bar'>
              <div className='h-80'>
                {barSpec && <VChart spec={barSpec} option={CHART_CONFIG} />}
              </div>
            </TabPane>
            <TabPane tab={t('消耗分布')} itemKey='quota'>
              <div className='h-80'>
                {quotaBarSpec && <VChart spec={quotaBarSpec} option={CHART_CONFIG} />}
              </div>
            </TabPane>
            <TabPane tab={t('调用趋势')} itemKey='trend'>
              <div className='h-80'>
                {trendSpec ? (
                  <VChart spec={trendSpec} option={CHART_CONFIG} />
                ) : (
                  <Empty
                    image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                    darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
                    description={t('无数据')}
                    style={{ padding: 30 }}
                  />
                )}
              </div>
            </TabPane>
          </Tabs>

          <div className='mt-4'>
            <h4 className='mb-2 font-medium'>{t('统计汇总')}</h4>
            <Table
              columns={columns}
              dataSource={[...statistics, ...summaryData]}
              rowKey={(record, index) => record.model_name === t('合计') ? '__summary__' : record.model_name}
              size='small'
              pagination={false}
            />
          </div>
        </div>
      ) : statistics !== null ? (
        <div className='mt-4'>
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
            description={t('无数据')}
            style={{ padding: 30 }}
          />
        </div>
      ) : null}
    </SideSheet>
  );
};

export default StatisticsDrawer;
