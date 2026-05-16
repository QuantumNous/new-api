/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) by the user, there is NO WARRANTY.
For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
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
  t,
}) => {
  const barSpec = buildBarSpec();
  const trendSpec = buildTrendSpec();
  const quotaBarSpec = buildQuotaBarSpec();
  const hasData = statistics && statistics.length > 0;

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'model_name',
      key: 'model_name',
    },
    {
      title: t('调用次数'),
      dataIndex: 'request_count',
      key: 'request_count',
      render: (text) => renderNumber(text),
    },
    {
      title: t('消耗额度'),
      dataIndex: 'quota',
      key: 'quota',
      render: (text) => renderQuota(text),
    },
    {
      title: 'Prompt Tokens(M)',
      dataIndex: 'prompt_tokens',
      key: 'prompt_tokens',
      render: (text) => renderNumber((text || 0) / 1_000_000),
    },
    {
      title: 'Completion Tokens(M)',
      dataIndex: 'completion_tokens',
      key: 'completion_tokens',
      render: (text) => renderNumber((text || 0) / 1_000_000),
    },
    {
      title: t('总 Tokens(M)'),
      key: 'total_tokens',
      render: (_, record) => renderNumber(((record.prompt_tokens || 0) + (record.completion_tokens || 0)) / 1_000_000),
    },
  ];

  // Build summary row
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
        getFormApi={(api) => setFormApi(api)}
        onSubmit={fetchStatistics}
        allowEmpty
        autoComplete='off'
        layout='vertical'
        trigger='change'
        stopValidateWithError={false}
      >
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2 mb-2'>
          <Form.Input
            field='username'
            placeholder={t('用户名称（必填）')}
            rules={[{ required: true, message: t('请输入用户名') }]}
            showClear
            pure
            size='small'
          />
          <Form.Input
            field='token_name'
            placeholder={t('令牌名称（可选）')}
            showClear
            pure
            size='small'
          />
          <Form.Input
            field='model_name'
            placeholder={t('模型名称（可选）')}
            showClear
            pure
            size='small'
          />
          <Form.DatePicker
            field='dateRange'
            type='dateTimeRange'
            placeholder={[t('开始时间（可选）'), t('结束时间（可选）')]}
            showClear
            pure
            size='small'
            presets={DATE_RANGE_PRESETS.map((preset) => ({
              text: t(preset.text),
              start: preset.start(),
              end: preset.end(),
            }))}
          />
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
