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
import { Button, Form, Modal, Space, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import CardPro from '../../components/common/ui/CardPro';
import { API, copy, showError, showSuccess, timestamp2string } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { DATE_RANGE_PRESETS } from '../../constants/console.constants';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const statusColorMap = {
  pending: 'orange',
  success: 'green',
  failed: 'red',
};

const PromotionEvent = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [formApi, setFormApi] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(
    parseInt(localStorage.getItem('promotion-event-page-size')) || ITEMS_PER_PAGE,
  );
  const [total, setTotal] = useState(0);

  const now = new Date();
  const zeroNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const formInitValues = {
    dateRange: [
      timestamp2string(zeroNow.getTime() / 1000),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
    event_type: '',
    status: '',
    newapi_user_id: '',
    dedupe_key: '',
  };

  const getQueryValues = () => {
    const values = formApi ? formApi.getValues() : formInitValues;
    const dateRange = values.dateRange || formInitValues.dateRange;
    return {
      start_timestamp: parseInt(Date.parse(dateRange[0]) / 1000),
      end_timestamp: parseInt(Date.parse(dateRange[1]) / 1000),
      event_type: values.event_type || '',
      status: values.status || '',
      newapi_user_id: values.newapi_user_id || '',
      dedupe_key: values.dedupe_key || '',
    };
  };

  const loadLogs = async (page = 1, size = pageSize) => {
    setLoading(true);
    const query = getQueryValues();
    const params = new URLSearchParams({
      p: String(page),
      page_size: String(size),
      start_timestamp: String(query.start_timestamp || ''),
      end_timestamp: String(query.end_timestamp || ''),
      event_type: query.event_type,
      status: query.status,
      newapi_user_id: query.newapi_user_id,
      dedupe_key: query.dedupe_key,
    });
    const res = await API.get(`/api/promotion-webhook/?${params.toString()}`);
    const { success, message, data } = res.data;
    if (success) {
      setLogs((data.items || []).map((item) => ({ ...item, key: String(item.id) })));
      setTotal(data.total || 0);
      setActivePage(data.page || page);
      setPageSize(data.page_size || size);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs(1, pageSize).then();
  }, []);

  const copyText = async (text) => {
    if (await copy(text || '')) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  const resendEvent = async (id) => {
    const res = await API.post(`/api/promotion-webhook/${id}/resend`);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('已重新发送'));
      await loadLogs(activePage, pageSize);
    } else {
      showError(message);
    }
  };

  const showJson = (title, content) => {
    let formatted = content || '';
    try {
      formatted = JSON.stringify(JSON.parse(content), null, 2);
    } catch (e) {
      // keep raw text
    }
    Modal.info({
      title,
      width: 760,
      content: (
        <pre className='whitespace-pre-wrap break-all max-h-[60vh] overflow-auto text-xs'>
          {formatted}
        </pre>
      ),
    });
  };

  const columns = [
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      render: (text) => timestamp2string(text),
    },
    {
      title: t('事件类型'),
      dataIndex: 'event_type',
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: t('用户ID'),
      dataIndex: 'newapi_user_id',
      render: (text) => (
        <Typography.Text copyable={{ content: text }}>{text}</Typography.Text>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (text) => <Tag color={statusColorMap[text] || 'grey'}>{text}</Tag>,
    },
    {
      title: t('次数'),
      dataIndex: 'attempts',
    },
    {
      title: t('下次重试'),
      dataIndex: 'next_retry_at',
      render: (text) => (text ? timestamp2string(text) : '-'),
    },
    {
      title: t('最后发送'),
      dataIndex: 'last_sent_at',
      render: (text) => (text ? timestamp2string(text) : '-'),
    },
    {
      title: t('HTTP状态'),
      dataIndex: 'http_status',
      render: (text) => text || '-',
    },
    {
      title: t('去重键'),
      dataIndex: 'dedupe_key',
      render: (text) => (
        <Typography.Text ellipsis={{ showTooltip: true }} onClick={() => copyText(text)}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: t('错误'),
      dataIndex: 'error',
      render: (text) => (
        <Typography.Text ellipsis={{ showTooltip: true }}>{text || '-'}</Typography.Text>
      ),
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      render: (_, record) => (
        <Space>
          <Button size='small' type='tertiary' onClick={() => showJson(t('请求内容'), record.payload)}>
            {t('请求')}
          </Button>
          <Button
            size='small'
            type='tertiary'
            onClick={() => showJson(t('响应内容'), record.response_body)}
          >
            {t('响应')}
          </Button>
          <Button size='small' type='tertiary' onClick={() => resendEvent(record.id)}>
            {t('重发')}
          </Button>
        </Space>
      ),
    },
  ];

  const searchArea = (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => setFormApi(api)}
      onSubmit={() => loadLogs(1, pageSize)}
      allowEmpty={true}
      autoComplete='off'
      layout='vertical'
    >
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2'>
          <div className='col-span-1 lg:col-span-2'>
            <Form.DatePicker
              field='dateRange'
              className='w-full'
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
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
          <Form.Select field='event_type' placeholder={t('事件类型')} showClear pure size='small'>
            <Form.Select.Option value='user.registered'>user.registered</Form.Select.Option>
            <Form.Select.Option value='topup.succeeded'>topup.succeeded</Form.Select.Option>
            <Form.Select.Option value='topup.manual_completed'>topup.manual_completed</Form.Select.Option>
            <Form.Select.Option value='subscription.paid'>subscription.paid</Form.Select.Option>
            <Form.Select.Option value='user.status_changed'>user.status_changed</Form.Select.Option>
          </Form.Select>
          <Form.Select field='status' placeholder={t('状态')} showClear pure size='small'>
            <Form.Select.Option value='pending'>pending</Form.Select.Option>
            <Form.Select.Option value='success'>success</Form.Select.Option>
            <Form.Select.Option value='failed'>failed</Form.Select.Option>
          </Form.Select>
          <Form.Input field='newapi_user_id' prefix={<IconSearch />} placeholder={t('用户ID')} showClear pure size='small' />
          <Form.Input field='dedupe_key' prefix={<IconSearch />} placeholder={t('去重键')} showClear pure size='small' />
        </div>
        <div className='flex justify-end gap-2'>
          <Button type='tertiary' htmlType='submit' loading={loading} size='small'>
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            onClick={() => {
              formApi?.reset();
              setTimeout(() => loadLogs(1, pageSize), 100);
            }}
            size='small'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );

  return (
    <div className='header-offset-top px-2'>
      <CardPro
        type='type2'
        searchArea={searchArea}
        paginationArea={createCardProPagination({
          currentPage: activePage,
          pageSize,
          total,
          onPageChange: (page) => loadLogs(page, pageSize),
          onPageSizeChange: async (size) => {
            localStorage.setItem('promotion-event-page-size', String(size));
            await loadLogs(1, size);
          },
          isMobile,
          t,
        })}
        t={t}
      >
        <Table columns={columns} dataSource={logs} loading={loading} pagination={false} />
      </CardPro>
    </div>
  );
};

export default PromotionEvent;
