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
  Avatar,
  Modal,
  Tag,
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
  Settings
} from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const SettingsAPIInfo = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [apiInfoList, setApiInfoList] = useState([]);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingApi, setDeletingApi] = useState(null);
  const [editingApi, setEditingApi] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [apiForm, setApiForm] = useState({
    url: '',
    description: '',
    route: '',
    color: 'blue'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 面板启用状态 state
  const [panelEnabled, setPanelEnabled] = useState(true);

  const colorOptions = [
    { value: 'blue', label: 'blue' },
    { value: 'green', label: 'green' },
    { value: 'cyan', label: 'cyan' },
    { value: 'purple', label: 'purple' },
    { value: 'pink', label: 'pink' },
    { value: 'red', label: 'red' },
    { value: 'orange', label: 'orange' },
    { value: 'amber', label: 'amber' },
    { value: 'yellow', label: 'yellow' },
    { value: 'lime', label: 'lime' },
    { value: 'light-green', label: 'light-green' },
    { value: 'teal', label: 'teal' },
    { value: 'light-blue', label: 'light-blue' },
    { value: 'indigo', label: 'indigo' },
    { value: 'violet', label: 'violet' },
    { value: 'grey', label: 'grey' }
  ];

  const updateOption = async (key, value) => {
    const res = await API.put('/api/option/', {
      key,
      value,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess('API信息已更新');
      if (refresh) refresh();
    } else {
      showError(message);
    }
  };

  const submitApiInfo = async () => {
    try {
      setLoading(true);
      const apiInfoJson = JSON.stringify(apiInfoList);
      await updateOption('console_setting.api_info', apiInfoJson);
      setHasChanges(false);
    } catch (error) {
      console.error('API信息更新失败', error);
      showError('API信息更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddApi = () => {
    setEditingApi(null);
    setApiForm({
      url: '',
      description: '',
      route: '',
      color: 'blue'
    });
    setShowApiModal(true);
  };

  const handleEditApi = (api) => {
    setEditingApi(api);
    setApiForm({
      url: api.url,
      description: api.description,
      route: api.route,
      color: api.color
    });
    setShowApiModal(true);
  };

  const handleDeleteApi = (api) => {
    setDeletingApi(api);
    setShowDeleteModal(true);
  };

  const confirmDeleteApi = () => {
    if (deletingApi) {
      const newList = apiInfoList.filter(api => api.id !== deletingApi.id);
      setApiInfoList(newList);
      setHasChanges(true);
      showSuccess('API信息已删除，请及时点击“保存设置”进行保存');
    }
    setShowDeleteModal(false);
    setDeletingApi(null);
  };

  const handleSaveApi = async () => {
    if (!apiForm.url || !apiForm.route || !apiForm.description) {
      showError('请填写完整的API信息');
      return;
    }

    try {
      setModalLoading(true);

      let newList;
      if (editingApi) {
        newList = apiInfoList.map(api =>
          api.id === editingApi.id
            ? { ...api, ...apiForm }
            : api
        );
      } else {
        const newId = Math.max(...apiInfoList.map(api => api.id), 0) + 1;
        const newApi = {
          id: newId,
          ...apiForm
        };
        newList = [...apiInfoList, newApi];
      }

      setApiInfoList(newList);
      setHasChanges(true);
      setShowApiModal(false);
      showSuccess(editingApi ? 'API信息已更新，请及时点击“保存设置”进行保存' : 'API信息已添加，请及时点击“保存设置”进行保存');
    } catch (error) {
      showError('操作失败: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const parseApiInfo = (apiInfoStr) => {
    if (!apiInfoStr) {
      setApiInfoList([]);
      return;
    }

    try {
      const parsed = JSON.parse(apiInfoStr);
      setApiInfoList(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('解析API信息失败:', error);
      setApiInfoList([]);
    }
  };

  useEffect(() => {
    const apiInfoStr = options['console_setting.api_info'] ?? options.ApiInfo;
    if (apiInfoStr !== undefined) {
      parseApiInfo(apiInfoStr);
    }
  }, [options['console_setting.api_info'], options.ApiInfo]);

  useEffect(() => {
    const enabledStr = options['console_setting.api_info_enabled'];
    setPanelEnabled(enabledStr === undefined ? true : enabledStr === 'true' || enabledStr === true);
  }, [options['console_setting.api_info_enabled']]);

  const handleToggleEnabled = async (checked) => {
    const newValue = checked ? 'true' : 'false';
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.api_info_enabled',
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

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('API地址'),
      dataIndex: 'url',
      render: (text, record) => (
        <Tag
          color={record.color}
          shape='circle'
          style={{ maxWidth: '280px' }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: t('线路描述'),
      dataIndex: 'route',
      render: (text, record) => (
        <Tag shape='circle'>
          {text}
        </Tag>
      ),
    },
    {
      title: t('说明'),
      dataIndex: 'description',
      ellipsis: true,
      render: (text, record) => (
        <Tag shape='circle'>
          {text || '-'}
        </Tag>
      ),
    },
    {
      title: t('颜色'),
      dataIndex: 'color',
      render: (color) => (
        <Avatar
          size="extra-extra-small"
          color={color}
        />
      ),
    },
    {
      title: t('操作'),
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            icon={<Edit size={14} />}
            theme='light'
            type='tertiary'
            size='small'
            onClick={() => handleEditApi(record)}
          >
            {t('编辑')}
          </Button>
          <Button
            icon={<Trash2 size={14} />}
            type='danger'
            theme='light'
            size='small'
            onClick={() => handleDeleteApi(record)}
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      showError('请先选择要删除的API信息');
      return;
    }

    const newList = apiInfoList.filter(api => !selectedRowKeys.includes(api.id));
    setApiInfoList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(`已删除 ${selectedRowKeys.length} 个API信息，请及时点击“保存设置”进行保存`);
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      <div className="mb-2">
        <div className="flex items-center text-blue-500">
          <Settings size={16} className="mr-2" />
          <Text>{t('API信息管理，可以配置多个API地址用于状态展示和负载均衡（最多50个）')}</Text>
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
            onClick={handleAddApi}
          >
            {t('添加API')}
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
            onClick={submitApiInfo}
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
          <Switch
            checked={panelEnabled}
            onChange={handleToggleEnabled}
          />
          <Text>{panelEnabled ? t('已启用') : t('已禁用')}</Text>
        </div>
      </div>
    </div>
  );

  // 计算当前页显示的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return apiInfoList.slice(startIndex, endIndex);
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
            total: apiInfoList.length,
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
              description={t('暂无API信息')}
              style={{ padding: 30 }}
            />
          }
          className="overflow-hidden"
        />
      </Form.Section>

      <Modal
        title={editingApi ? t('编辑API') : t('添加API')}
        visible={showApiModal}
        onOk={handleSaveApi}
        onCancel={() => setShowApiModal(false)}
        okText={t('保存')}
        cancelText={t('取消')}
        confirmLoading={modalLoading}
      >
        <Form layout='vertical' initValues={apiForm} key={editingApi ? editingApi.id : 'new'}>
          <Form.Input
            field='url'
            label={t('API地址')}
            placeholder='https://api.example.com'
            rules={[{ required: true, message: t('请输入API地址') }]}
            onChange={(value) => setApiForm({ ...apiForm, url: value })}
          />
          <Form.Input
            field='route'
            label={t('线路描述')}
            placeholder={t('如：香港线路')}
            rules={[{ required: true, message: t('请输入线路描述') }]}
            onChange={(value) => setApiForm({ ...apiForm, route: value })}
          />
          <Form.Input
            field='description'
            label={t('说明')}
            placeholder={t('如：大带宽批量分析图片推荐')}
            rules={[{ required: true, message: t('请输入说明') }]}
            onChange={(value) => setApiForm({ ...apiForm, description: value })}
          />
          <Form.Select
            field='color'
            label={t('标识颜色')}
            optionList={colorOptions}
            onChange={(value) => setApiForm({ ...apiForm, color: value })}
            render={(option) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar
                  size="extra-extra-small"
                  color={option.value}
                />
                {option.label}
              </div>
            )}
          />
        </Form>
      </Modal>

      <Modal
        title={t('确认删除')}
        visible={showDeleteModal}
        onOk={confirmDeleteApi}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletingApi(null);
        }}
        okText={t('确认删除')}
        cancelText={t('取消')}
        type="warning"
        okButtonProps={{
          type: 'danger',
          theme: 'solid'
        }}
      >
        <Text>{t('确定要删除此API信息吗？')}</Text>
      </Modal>
    </>
  );
};

export default SettingsAPIInfo; 