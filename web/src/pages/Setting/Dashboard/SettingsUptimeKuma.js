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
import {
  Button,
  Space,
  Table,
  Form,
  Typography,
  Empty,
  Divider,
  Modal,
  Switch
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Activity
} from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const SettingsUptimeKuma = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [uptimeGroupsList, setUptimeGroupsList] = useState([]);
  const [showUptimeModal, setShowUptimeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uptimeForm, setUptimeForm] = useState({
    categoryName: '',
    url: '',
    slug: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [panelEnabled, setPanelEnabled] = useState(true);

  const columns = [
    {
      title: t('分类名称'),
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (text) => (
        <div style={{
          fontWeight: 'bold',
          color: 'var(--semi-color-text-0)'
        }}>
          {text}
        </div>
      )
    },
    {
      title: t('Uptime Kuma地址'),
      dataIndex: 'url',
      key: 'url',
      render: (text) => (
        <div style={{
          maxWidth: '300px',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          color: 'var(--semi-color-primary)'
        }}>
          {text}
        </div>
      )
    },
    {
      title: t('状态页面Slug'),
      dataIndex: 'slug',
      key: 'slug',
      render: (text) => (
        <div style={{
          fontFamily: 'monospace',
          color: 'var(--semi-color-text-1)'
        }}>
          {text}
        </div>
      )
    },
    {
      title: t('操作'),
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (text, record) => (
        <Space>
          <Button
            icon={<Edit size={14} />}
            theme='light'
            type='tertiary'
            size='small'
            onClick={() => handleEditGroup(record)}
          >
            {t('编辑')}
          </Button>
          <Button
            icon={<Trash2 size={14} />}
            type='danger'
            theme='light'
            size='small'
            onClick={() => handleDeleteGroup(record)}
          >
            {t('删除')}
          </Button>
        </Space>
      )
    }
  ];

  const updateOption = async (key, value) => {
    const res = await API.put('/api/option/', {
      key,
      value,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess('Uptime Kuma配置已更新');
      if (refresh) refresh();
    } else {
      showError(message);
    }
  };

  const submitUptimeGroups = async () => {
    try {
      setLoading(true);
      const groupsJson = JSON.stringify(uptimeGroupsList);
      await updateOption('console_setting.uptime_kuma_groups', groupsJson);
      setHasChanges(false);
    } catch (error) {
      console.error('Uptime Kuma配置更新失败', error);
      showError('Uptime Kuma配置更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setUptimeForm({
      categoryName: '',
      url: '',
      slug: '',
    });
    setShowUptimeModal(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setUptimeForm({
      categoryName: group.categoryName,
      url: group.url,
      slug: group.slug,
    });
    setShowUptimeModal(true);
  };

  const handleDeleteGroup = (group) => {
    setDeletingGroup(group);
    setShowDeleteModal(true);
  };

  const confirmDeleteGroup = () => {
    if (deletingGroup) {
      const newList = uptimeGroupsList.filter(item => item.id !== deletingGroup.id);
      setUptimeGroupsList(newList);
      setHasChanges(true);
      showSuccess('分类已删除，请及时点击“保存设置”进行保存');
    }
    setShowDeleteModal(false);
    setDeletingGroup(null);
  };

  const handleSaveGroup = async () => {
    if (!uptimeForm.categoryName || !uptimeForm.url || !uptimeForm.slug) {
      showError('请填写完整的分类信息');
      return;
    }

    try {
      new URL(uptimeForm.url);
    } catch (error) {
      showError('请输入有效的URL地址');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(uptimeForm.slug)) {
      showError('Slug只能包含字母、数字、下划线和连字符');
      return;
    }

    try {
      setModalLoading(true);

      let newList;
      if (editingGroup) {
        newList = uptimeGroupsList.map(item =>
          item.id === editingGroup.id
            ? { ...item, ...uptimeForm }
            : item
        );
      } else {
        const newId = Math.max(...uptimeGroupsList.map(item => item.id), 0) + 1;
        const newGroup = {
          id: newId,
          ...uptimeForm
        };
        newList = [...uptimeGroupsList, newGroup];
      }

      setUptimeGroupsList(newList);
      setHasChanges(true);
      setShowUptimeModal(false);
      showSuccess(editingGroup ? '分类已更新，请及时点击“保存设置”进行保存' : '分类已添加，请及时点击“保存设置”进行保存');
    } catch (error) {
      showError('操作失败: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const parseUptimeGroups = (groupsStr) => {
    if (!groupsStr) {
      setUptimeGroupsList([]);
      return;
    }

    try {
      const parsed = JSON.parse(groupsStr);
      const list = Array.isArray(parsed) ? parsed : [];
      const listWithIds = list.map((item, index) => ({
        ...item,
        id: item.id || index + 1
      }));
      setUptimeGroupsList(listWithIds);
    } catch (error) {
      console.error('解析Uptime Kuma配置失败:', error);
      setUptimeGroupsList([]);
    }
  };

  useEffect(() => {
    const groupsStr = options['console_setting.uptime_kuma_groups'];
    if (groupsStr !== undefined) {
      parseUptimeGroups(groupsStr);
    }
  }, [options['console_setting.uptime_kuma_groups']]);

  useEffect(() => {
    const enabledStr = options['console_setting.uptime_kuma_enabled'];
    setPanelEnabled(enabledStr === undefined ? true : enabledStr === 'true' || enabledStr === true);
  }, [options['console_setting.uptime_kuma_enabled']]);

  const handleToggleEnabled = async (checked) => {
    const newValue = checked ? 'true' : 'false';
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.uptime_kuma_enabled',
        value: newValue,
      });
      if (res.data.success) {
        setPanelEnabled(checked);
        showSuccess(t('设置已保存'));
        refresh?.();
      } else {
        showError(res.data.message);
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      showError('请先选择要删除的分类');
      return;
    }

    const newList = uptimeGroupsList.filter(item => !selectedRowKeys.includes(item.id));
    setUptimeGroupsList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(`已删除 ${selectedRowKeys.length} 个分类，请及时点击“保存设置”进行保存`);
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      <div className="mb-2">
        <div className="flex items-center text-blue-500">
          <Activity size={16} className="mr-2" />
          <Text>{t('Uptime Kuma监控分类管理，可以配置多个监控分类用于服务状态展示（最多20个）')}</Text>
        </div>
      </div>

      <Divider margin="12px" />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
        <div className="flex gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            theme='light'
            type='primary'
            icon={<Plus size={14} />}
            className="w-full md:w-auto"
            onClick={handleAddGroup}
          >
            {t('添加分类')}
          </Button>
          <Button
            icon={<Trash2 size={14} />}
            type='danger'
            theme='light'
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
            className="w-full md:w-auto"
          >
            {t('批量删除')} {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
          </Button>
          <Button
            icon={<Save size={14} />}
            onClick={submitUptimeGroups}
            loading={loading}
            disabled={!hasChanges}
            type='secondary'
            className="w-full md:w-auto"
          >
            {t('保存设置')}
          </Button>
        </div>

        {/* 启用开关 */}
        <div className="order-1 md:order-2 flex items-center gap-2">
          <Switch checked={panelEnabled} onChange={handleToggleEnabled} />
          <Text>{panelEnabled ? t('已启用') : t('已禁用')}</Text>
        </div>
      </div>
    </div>
  );

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return uptimeGroupsList.slice(startIndex, endIndex);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedRowKeys(selectedRowKeys);
    },
    onSelect: (record, selected, selectedRows) => {
      console.log(`选择行: ${selected}`, record);
    },
    onSelectAll: (selected, selectedRows) => {
      console.log(`全选: ${selected}`, selectedRows);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
      name: record.id,
    }),
  };

  return (
    <>
      <Form.Section text={renderHeader()}>
        <Table
          columns={columns}
          dataSource={getCurrentPageData()}
          rowSelection={rowSelection}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{
            currentPage: currentPage,
            pageSize: pageSize,
            total: uptimeGroupsList.length,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            onShowSizeChange: (current, size) => {
              setCurrentPage(1);
              setPageSize(size);
            }
          }}
          size='middle'
          loading={loading}
          empty={
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('暂无监控数据')}
              style={{ padding: 30 }}
            />
          }
          className="overflow-hidden"
        />
      </Form.Section>

      <Modal
        title={editingGroup ? t('编辑分类') : t('添加分类')}
        visible={showUptimeModal}
        onOk={handleSaveGroup}
        onCancel={() => setShowUptimeModal(false)}
        okText={t('保存')}
        cancelText={t('取消')}
        confirmLoading={modalLoading}
        width={600}
      >
        <Form layout='vertical' initValues={uptimeForm} key={editingGroup ? editingGroup.id : 'new'}>
          <Form.Input
            field='categoryName'
            label={t('分类名称')}
            placeholder={t('请输入分类名称，如：OpenAI、Claude等')}
            maxLength={50}
            rules={[{ required: true, message: t('请输入分类名称') }]}
            onChange={(value) => setUptimeForm({ ...uptimeForm, categoryName: value })}
          />
          <Form.Input
            field='url'
            label={t('Uptime Kuma地址')}
            placeholder={t('请输入Uptime Kuma服务地址，如：https://status.example.com')}
            maxLength={500}
            rules={[{ required: true, message: t('请输入Uptime Kuma地址') }]}
            onChange={(value) => setUptimeForm({ ...uptimeForm, url: value })}
          />
          <Form.Input
            field='slug'
            label={t('状态页面Slug')}
            placeholder={t('请输入状态页面的Slug，如：my-status')}
            maxLength={100}
            rules={[{ required: true, message: t('请输入状态页面Slug') }]}
            onChange={(value) => setUptimeForm({ ...uptimeForm, slug: value })}
          />
        </Form>
      </Modal>

      <Modal
        title={t('确认删除')}
        visible={showDeleteModal}
        onOk={confirmDeleteGroup}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletingGroup(null);
        }}
        okText={t('确认删除')}
        cancelText={t('取消')}
        type="warning"
        okButtonProps={{
          type: 'danger',
          theme: 'solid'
        }}
      >
        <Text>{t('确定要删除此分类吗？')}</Text>
      </Modal>
    </>
  );
};

export default SettingsUptimeKuma; 