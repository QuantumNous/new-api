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

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';
import {
  buildAffiliateProfilePayload,
  buildAffiliateProfilesQuery,
  getAffiliateProfileLevelText,
  getAffiliateProfileStatusMeta,
  validateAffiliateProfilePayload,
} from './affiliateAdminProfiles';

const { Text, Title } = Typography;

const DEFAULT_PAGE_SIZE = 10;

const AffiliateAdmin = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const loadProfiles = async (
    nextPage = page,
    nextPageSize = pageSize,
    nextFilters = filters,
  ) => {
    setLoading(true);
    try {
      const res = await API.get(
        buildAffiliateProfilesQuery({
          page: nextPage,
          pageSize: nextPageSize,
          filters: nextFilters,
        }),
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('分销商列表加载失败'));
        return;
      }
      setProfiles(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setPage(Number(data?.page || nextPage));
      setPageSize(Number(data?.page_size || nextPageSize));
    } catch (error) {
      showError(t('分销商列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles(1, DEFAULT_PAGE_SIZE, {});
  }, []);

  const handleCreateOrUpdate = async (values) => {
    const payload = buildAffiliateProfilePayload(values);
    const validationError = validateAffiliateProfilePayload(t, payload);
    if (validationError) {
      showError(validationError);
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await API.post('/api/affiliate/admin/profiles', payload);
      const { success, message } = res.data;
      if (!success) {
        showError(message || t('保存分销商失败'));
        return;
      }
      showSuccess(t('分销商已保存'));
      await loadProfiles(1, pageSize, filters);
    } catch (error) {
      showError(t('保存分销商失败'));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStatusChange = async (record, status) => {
    try {
      const res = await API.patch(
        `/api/affiliate/admin/profiles/${record.user_id}/status`,
        {
          status,
          reason:
            status === 'active'
              ? t('管理员在分销管理页启用')
              : t('管理员在分销管理页禁用'),
        },
      );
      const { success, message } = res.data;
      if (!success) {
        showError(message || t('分销商状态更新失败'));
        return;
      }
      showSuccess(t('分销商状态已更新'));
      await loadProfiles(page, pageSize, filters);
    } catch (error) {
      showError(t('分销商状态更新失败'));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('用户 ID'),
        dataIndex: 'user_id',
        width: 110,
      },
      {
        title: t('分销等级'),
        dataIndex: 'level',
        width: 140,
        render: (level) => getAffiliateProfileLevelText(t, level),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (status) => {
          const meta = getAffiliateProfileStatusMeta(t, status);
          return <Tag color={meta.type}>{meta.label}</Tag>;
        },
      },
      {
        title: t('一级上级用户 ID'),
        dataIndex: 'parent_user_id',
        width: 150,
        render: (value) => value || '-',
      },
      {
        title: t('邀请码'),
        dataIndex: 'invite_code',
        width: 140,
        render: (value) => value || '-',
      },
      {
        title: t('更新时间'),
        dataIndex: 'updated_at',
        width: 170,
        render: (value) => (value ? timestamp2string(value) : '-'),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        width: 140,
        render: (_, record) => (
          <Space>
            {record.status === 'active' ? (
              <Button
                size='small'
                type='danger'
                theme='outline'
                onClick={() => handleStatusChange(record, 'disabled')}
              >
                {t('禁用')}
              </Button>
            ) : (
              <Button
                size='small'
                type='primary'
                theme='outline'
                onClick={() => handleStatusChange(record, 'active')}
              >
                {t('启用')}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [t, page, pageSize, filters],
  );

  const handleFilterSubmit = (values) => {
    const nextFilters = {
      user_id: values.user_id,
      level: values.level,
      status: values.status,
    };
    setFilters(nextFilters);
    loadProfiles(1, pageSize, nextFilters);
  };

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col gap-2 mb-4'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <Title heading={4}>{t('分销管理')}</Title>
            <Link to='/console/user' className='no-underline'>
              <Button type='tertiary'>{t('跳转用户管理')}</Button>
            </Link>
          </div>
          <Text type='secondary'>
            {t(
              '管理员可在这里指定一级/二级分销商；二级分销商必须绑定一个已启用的一级分销商。',
            )}
          </Text>
        </div>
        <Form
          layout='horizontal'
          onSubmit={handleCreateOrUpdate}
          initValues={{ level: 1 }}
        >
          <Form.InputNumber field='user_id' label={t('用户 ID')} min={1} />
          <Form.Select
            field='level'
            label={t('分销等级')}
            optionList={[
              { label: t('一级分销商'), value: 1 },
              { label: t('二级分销商'), value: 2 },
            ]}
          />
          <Form.InputNumber
            field='parent_user_id'
            label={t('一级上级用户 ID')}
            min={0}
            placeholder={t('二级分销商必填')}
          />
          <Form.Input field='invite_code' label={t('邀请码')} />
          <Form.Input field='reason' label={t('操作原因')} />
          <Button htmlType='submit' type='primary' loading={submitLoading}>
            {t('保存分销商')}
          </Button>
        </Form>
      </Card>

      <Card className='!rounded-2xl'>
        <Form layout='horizontal' onSubmit={handleFilterSubmit}>
          <Form.InputNumber field='user_id' label={t('用户 ID')} min={1} />
          <Form.Select
            field='level'
            label={t('分销等级')}
            optionList={[
              { label: t('全部'), value: '' },
              { label: t('一级分销商'), value: 1 },
              { label: t('二级分销商'), value: 2 },
            ]}
          />
          <Form.Select
            field='status'
            label={t('状态')}
            optionList={[
              { label: t('全部'), value: '' },
              { label: t('启用'), value: 'active' },
              { label: t('禁用'), value: 'disabled' },
            ]}
          />
          <Space>
            <Button htmlType='submit' type='primary' loading={loading}>
              {t('查询')}
            </Button>
            <Button
              type='tertiary'
              onClick={() => {
                setFilters({});
                loadProfiles(1, pageSize, {});
              }}
            >
              {t('重置')}
            </Button>
          </Space>
        </Form>
        <Table
          className='mt-3'
          rowKey='id'
          columns={columns}
          dataSource={profiles}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onPageChange: (nextPage) =>
              loadProfiles(nextPage, pageSize, filters),
            onPageSizeChange: (nextPageSize) =>
              loadProfiles(1, nextPageSize, filters),
          }}
        />
      </Card>
    </div>
  );
};

export default AffiliateAdmin;
