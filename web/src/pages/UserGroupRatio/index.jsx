import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  InputNumber,
  Select,
  Input,
  Popconfirm,
  Typography,
  Tag,
  Banner,
  Spin,
} from '@douyinfe/semi-ui';
import { IconPlus, IconSearch, IconDelete, IconEdit } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const { Text } = Typography;

const UserGroupRatio = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalUserId, setModalUserId] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ratioValues, setRatioValues] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get('/api/group/');
      const { success, data } = res.data;
      if (success) {
        setGroups(data || []);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/user_group_ratio/?p=${page}&page_size=${pageSize}`;
      if (keyword) {
        url += `&keyword=${encodeURIComponent(keyword)}`;
      }
      const res = await API.get(url);
      const { success, data } = res.data;
      if (success) {
        const items = data.items || [];
        // Group by user (backend already returns per-user paginated data)
        const userMap = {};
        items.forEach((item) => {
          if (!userMap[item.user_id]) {
            userMap[item.user_id] = {
              user_id: item.user_id,
              username: item.username,
              ratios: {},
              ids: [],
            };
          }
          userMap[item.user_id].ratios[item.using_group] = item.ratio;
          userMap[item.user_id].ids.push(item.id);
        });
        setData(Object.values(userMap));
        setTotal(data.total || 0);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleAdd = () => {
    setModalUserId('');
    setRatioValues({});
    setDataLoaded(false);
    setShowModal(true);
  };

  const handleEditUser = async (userId) => {
    setModalUserId(String(userId));
    setDataLoaded(false);
    setShowModal(true);
    await loadUserRatios(userId);
  };

  const loadUserRatios = async (userId) => {
    setModalLoading(true);
    try {
      const res = await API.get(`/api/user_group_ratio/?user_id=${userId}&page_size=100`);
      const { success, data } = res.data;
      if (success) {
        const values = {};
        (data.items || []).forEach((item) => {
          values[item.using_group] = item.ratio;
        });
        setRatioValues(values);
        setDataLoaded(true);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUserIdConfirm = async () => {
    const userId = parseInt(modalUserId);
    if (!userId || userId < 1) {
      showError(t('请输入有效的用户ID'));
      return;
    }
    await loadUserRatios(userId);
  };

  const handleRatioChange = (group, value) => {
    setRatioValues((prev) => {
      const next = { ...prev };
      if (value === null || value === undefined || value === '') {
        delete next[group];
      } else {
        next[group] = value;
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const userId = parseInt(modalUserId);
    if (!userId || userId < 1) {
      showError(t('请输入有效的用户ID'));
      return;
    }
    if (!dataLoaded) {
      showError(t('请先点击加载按钮'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.get(`/api/user_group_ratio/?user_id=${userId}&page_size=100`);
      const existing = {};
      if (res.data.success) {
        (res.data.data.items || []).forEach((item) => {
          existing[item.using_group] = item;
        });
      }

      const promises = [];

      for (const [group, ratio] of Object.entries(ratioValues)) {
        promises.push(
          API.post('/api/user_group_ratio/', {
            user_id: userId,
            using_group: group,
            ratio: ratio,
          })
        );
      }

      for (const [group, item] of Object.entries(existing)) {
        if (!(group in ratioValues)) {
          promises.push(API.delete(`/api/user_group_ratio/${item.id}`));
        }
      }

      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.data.success);
      if (failed.length > 0) {
        showError(failed[0].data.message || t('部分保存失败'));
      } else {
        showSuccess(t('保存成功'));
        setShowModal(false);
        loadData();
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userRow) => {
    try {
      const res = await API.post('/api/user_group_ratio/batch_delete', {
        ids: userRow.ids,
      });
      if (res.data.success) {
        showSuccess(t('删除成功'));
        loadData();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    const allIds = [];
    data.forEach((row) => {
      if (selectedRowKeys.includes(row.user_id)) {
        allIds.push(...row.ids);
      }
    });
    try {
      const res = await API.post('/api/user_group_ratio/batch_delete', {
        ids: allIds,
      });
      if (res.data.success) {
        showSuccess(t('删除成功'));
        setSelectedRowKeys([]);
        loadData();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const columns = [
    {
      title: t('用户ID'),
      dataIndex: 'user_id',
      width: 90,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      width: 150,
    },
    {
      title: t('分组倍率配置'),
      dataIndex: 'ratios',
      render: (ratios) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(ratios).map(([group, ratio]) => (
            <Tag key={group} size="large" color="blue">
              {group}: {ratio}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: t('操作'),
      width: 150,
      render: (_, record) => (
        <div className="flex gap-1">
          <Button size="small" icon={<IconEdit />} onClick={() => handleEditUser(record.user_id)}>
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确认删除该用户的所有分组倍率？')}
            onConfirm={() => handleDeleteUser(record)}
          >
            <Button size="small" type="danger" icon={<IconDelete />}>
              {t('删除')}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({ name: String(record.user_id) }),
  };

  return (
    <div className="mt-[60px] px-2">
      <Banner
        type="info"
        description={t('为单个用户设置独立的分组倍率，优先级高于分组特殊倍率和全局分组倍率。选择用户后可一次性配置所有分组的倍率。')}
        style={{ marginBottom: 16 }}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          prefix={<IconSearch />}
          placeholder={t('搜索用户名')}
          value={keyword}
          onChange={setKeyword}
          onEnterPress={handleSearch}
          style={{ width: 200 }}
        />
        <Button icon={<IconSearch />} onClick={handleSearch}>
          {t('搜索')}
        </Button>
        <Button icon={<IconPlus />} theme="solid" onClick={handleAdd}>
          {t('添加')}
        </Button>
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title={t('确认批量删除选中用户的所有分组倍率？')}
            onConfirm={handleBatchDelete}
          >
            <Button icon={<IconDelete />} type="danger">
              {t('批量删除')} ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="user_id"
        rowSelection={rowSelection}
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize: pageSize,
          total: total,
          onPageChange: setPage,
          onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50, 100],
        }}
      />

      <Modal
        title={t('配置用户分组倍率')}
        visible={showModal}
        onOk={handleSubmit}
        onCancel={() => setShowModal(false)}
        confirmLoading={submitting}
        maskClosable={false}
        width={500}
        okText={t('保存')}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('用户ID')}</Text>
          <InputNumber
            value={modalUserId}
            onChange={(v) => setModalUserId(v)}
            onBlur={handleUserIdConfirm}
            onEnterPress={handleUserIdConfirm}
            placeholder={t('输入用户ID后按回车')}
            min={1}
            style={{ width: '100%' }}
          />
        </div>

        <Spin spinning={modalLoading}>
          {groups.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('分组倍率（留空表示不设置，使用默认规则）')}
              </Text>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {groups.map((group) => (
                  <div key={group} className="flex items-center gap-3 mb-2">
                    <Tag size="large" style={{ minWidth: 100 }}>{group}</Tag>
                    <InputNumber
                      value={ratioValues[group] ?? null}
                      onChange={(v) => handleRatioChange(group, v)}
                      placeholder={t('留空不设置')}
                      min={0}
                      step={0.1}
                      style={{ width: 160 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default UserGroupRatio;
