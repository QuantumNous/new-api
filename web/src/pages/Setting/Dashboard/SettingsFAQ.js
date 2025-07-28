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
  Switch,
  Tooltip
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
  HelpCircle
} from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const SettingsFAQ = ({ options, refresh }) => {
  const { t } = useTranslation();

  const [faqList, setFaqList] = useState([]);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingFaq, setDeletingFaq] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 面板启用状态
  const [panelEnabled, setPanelEnabled] = useState(true);

  const columns = [
    {
      title: t('问题标题'),
      dataIndex: 'question',
      key: 'question',
      render: (text) => (
        <Tooltip content={text} showArrow>
          <div style={{
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 'bold'
          }}>
            {text}
          </div>
        </Tooltip>
      )
    },
    {
      title: t('回答内容'),
      dataIndex: 'answer',
      key: 'answer',
      render: (text) => (
        <Tooltip content={text} showArrow>
          <div style={{
            maxWidth: '400px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--semi-color-text-1)'
          }}>
            {text}
          </div>
        </Tooltip>
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
            onClick={() => handleEditFaq(record)}
          >
            {t('编辑')}
          </Button>
          <Button
            icon={<Trash2 size={14} />}
            type='danger'
            theme='light'
            size='small'
            onClick={() => handleDeleteFaq(record)}
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
      showSuccess('常见问答已更新');
      if (refresh) refresh();
    } else {
      showError(message);
    }
  };

  const submitFAQ = async () => {
    try {
      setLoading(true);
      const faqJson = JSON.stringify(faqList);
      await updateOption('console_setting.faq', faqJson);
      setHasChanges(false);
    } catch (error) {
      console.error('常见问答更新失败', error);
      showError('常见问答更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaq = () => {
    setEditingFaq(null);
    setFaqForm({
      question: '',
      answer: ''
    });
    setShowFaqModal(true);
  };

  const handleEditFaq = (faq) => {
    setEditingFaq(faq);
    setFaqForm({
      question: faq.question,
      answer: faq.answer
    });
    setShowFaqModal(true);
  };

  const handleDeleteFaq = (faq) => {
    setDeletingFaq(faq);
    setShowDeleteModal(true);
  };

  const confirmDeleteFaq = () => {
    if (deletingFaq) {
      const newList = faqList.filter(item => item.id !== deletingFaq.id);
      setFaqList(newList);
      setHasChanges(true);
      showSuccess('问答已删除，请及时点击“保存设置”进行保存');
    }
    setShowDeleteModal(false);
    setDeletingFaq(null);
  };

  const handleSaveFaq = async () => {
    if (!faqForm.question || !faqForm.answer) {
      showError('请填写完整的问答信息');
      return;
    }

    try {
      setModalLoading(true);

      let newList;
      if (editingFaq) {
        newList = faqList.map(item =>
          item.id === editingFaq.id
            ? { ...item, ...faqForm }
            : item
        );
      } else {
        const newId = Math.max(...faqList.map(item => item.id), 0) + 1;
        const newFaq = {
          id: newId,
          ...faqForm
        };
        newList = [...faqList, newFaq];
      }

      setFaqList(newList);
      setHasChanges(true);
      setShowFaqModal(false);
      showSuccess(editingFaq ? '问答已更新，请及时点击“保存设置”进行保存' : '问答已添加，请及时点击“保存设置”进行保存');
    } catch (error) {
      showError('操作失败: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const parseFAQ = (faqStr) => {
    if (!faqStr) {
      setFaqList([]);
      return;
    }

    try {
      const parsed = JSON.parse(faqStr);
      const list = Array.isArray(parsed) ? parsed : [];
      // 确保每个项目都有id
      const listWithIds = list.map((item, index) => ({
        ...item,
        id: item.id || index + 1
      }));
      setFaqList(listWithIds);
    } catch (error) {
      console.error('解析常见问答失败:', error);
      setFaqList([]);
    }
  };

  useEffect(() => {
    if (options['console_setting.faq'] !== undefined) {
      parseFAQ(options['console_setting.faq']);
    }
  }, [options['console_setting.faq']]);

  useEffect(() => {
    const enabledStr = options['console_setting.faq_enabled'];
    setPanelEnabled(enabledStr === undefined ? true : enabledStr === 'true' || enabledStr === true);
  }, [options['console_setting.faq_enabled']]);

  const handleToggleEnabled = async (checked) => {
    const newValue = checked ? 'true' : 'false';
    try {
      const res = await API.put('/api/option/', {
        key: 'console_setting.faq_enabled',
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
      showError('请先选择要删除的常见问答');
      return;
    }

    const newList = faqList.filter(item => !selectedRowKeys.includes(item.id));
    setFaqList(newList);
    setSelectedRowKeys([]);
    setHasChanges(true);
    showSuccess(`已删除 ${selectedRowKeys.length} 个常见问答，请及时点击“保存设置”进行保存`);
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      <div className="mb-2">
        <div className="flex items-center text-blue-500">
          <HelpCircle size={16} className="mr-2" />
          <Text>{t('常见问答管理，为用户提供常见问题的答案（最多50个，前端显示最新20条）')}</Text>
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
            onClick={handleAddFaq}
          >
            {t('添加问答')}
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
            onClick={submitFAQ}
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

  // 计算当前页显示的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return faqList.slice(startIndex, endIndex);
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
            total: faqList.length,
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
              description={t('暂无常见问答')}
              style={{ padding: 30 }}
            />
          }
          className="overflow-hidden"
        />
      </Form.Section>

      <Modal
        title={editingFaq ? t('编辑问答') : t('添加问答')}
        visible={showFaqModal}
        onOk={handleSaveFaq}
        onCancel={() => setShowFaqModal(false)}
        okText={t('保存')}
        cancelText={t('取消')}
        confirmLoading={modalLoading}
        width={800}
      >
        <Form layout='vertical' initValues={faqForm} key={editingFaq ? editingFaq.id : 'new'}>
          <Form.Input
            field='question'
            label={t('问题标题')}
            placeholder={t('请输入问题标题')}
            maxLength={200}
            rules={[{ required: true, message: t('请输入问题标题') }]}
            onChange={(value) => setFaqForm({ ...faqForm, question: value })}
          />
          <Form.TextArea
            field='answer'
            label={t('回答内容')}
            placeholder={t('请输入回答内容（支持 Markdown/HTML）')}
            maxCount={1000}
            rows={6}
            rules={[{ required: true, message: t('请输入回答内容') }]}
            onChange={(value) => setFaqForm({ ...faqForm, answer: value })}
          />
        </Form>
      </Modal>

      <Modal
        title={t('确认删除')}
        visible={showDeleteModal}
        onOk={confirmDeleteFaq}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletingFaq(null);
        }}
        okText={t('确认删除')}
        cancelText={t('取消')}
        type="warning"
        okButtonProps={{
          type: 'danger',
          theme: 'solid'
        }}
      >
        <Text>{t('确定要删除此问答吗？')}</Text>
      </Modal>
    </>
  );
};

export default SettingsFAQ; 