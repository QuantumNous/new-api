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
import { Button, Empty, Form, Tag } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showError, timestamp2string } from '../../helpers';
import { useTranslation } from 'react-i18next';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import { createCardProPagination } from '../../helpers/utils';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const FeedbackPage = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [formApi, setFormApi] = useState(null);

  const loadFeedbacks = async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true);
    try {
      const values = formApi?.getValues() || {};
      const keyword = values.keyword || '';
      const category = values.category || '';
      const res = await API.get(
        `/api/user/feedback?p=${nextPage}&page_size=${nextPageSize}&keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`,
      );
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setItems((data.items || []).map((item) => ({ ...item, key: item.id })));
      setTotal(data.total || 0);
      setPage(data.page || nextPage);
    } catch (error) {
      showError(t('加载反馈失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks(1, pageSize);
  }, []);

  const columns = [
    { title: t('用户名'), dataIndex: 'username' },
    { title: t('邮箱'), dataIndex: 'email' },
    {
      title: t('反馈类型'),
      dataIndex: 'category',
      render: (value) => <Tag color='blue'>{value}</Tag>,
    },
    {
      title: t('内容'),
      dataIndex: 'content',
      render: (value) => (
        <div className='max-w-[520px] whitespace-pre-wrap'>{value}</div>
      ),
    },
    {
      title: t('提交时间'),
      dataIndex: 'created_time',
      render: (value) => timestamp2string(value),
    },
  ];

  return (
    <CardPro
      type='type1'
      descriptionArea={
        <div className='text-sm text-semi-color-text-2'>
          {t('查看来自联系页的用户反馈。')}
        </div>
      }
      actionsArea={
        <Form initValues={{ keyword: '', category: '' }} getFormApi={setFormApi}>
          <div className='flex flex-col md:flex-row gap-2 w-full'>
            <Form.Input
              field='keyword'
              placeholder={t('搜索用户名、邮箱或内容')}
            />
            <Form.Select
              field='category'
              placeholder={t('反馈类型')}
              optionList={[
                { label: t('全部'), value: '' },
                { label: 'Bug', value: 'bug' },
                { label: t('咨询'), value: 'consulting' },
                { label: t('建议'), value: 'feature' },
                { label: t('其他'), value: 'other' },
              ]}
            />
            <Button type='primary' theme='light' onClick={() => loadFeedbacks(1, pageSize)}>
              {t('搜索')}
            </Button>
          </div>
        </Form>
      }
      paginationArea={createCardProPagination({
        currentPage: page,
        pageSize,
        total,
        onPageChange: (nextPage) => loadFeedbacks(nextPage, pageSize),
        onPageSizeChange: (nextSize) => {
          setPageSize(nextSize);
          loadFeedbacks(1, nextSize);
        },
        isMobile,
        t,
      })}
      t={t}
    >
      <CardTable
        columns={columns}
        dataSource={items}
        loading={loading}
        hidePagination={true}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无反馈')}
            style={{ padding: 30 }}
          />
        }
      />
    </CardPro>
  );
};

export default FeedbackPage;
