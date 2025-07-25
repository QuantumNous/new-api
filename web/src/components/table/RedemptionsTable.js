import React, { useEffect, useState } from 'react';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
  renderQuota
} from '../../helpers';

import { Ticket } from 'lucide-react';

import { ITEMS_PER_PAGE } from '../../constants';
import {
  Button,
  Card,
  Divider,
  Dropdown,
  Empty,
  Form,
  Modal,
  Popover,
  Space,
  Table,
  Tag,
  Typography
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import {
  IconSearch,
  IconMore,
} from '@douyinfe/semi-icons';
import EditRedemption from '../../pages/Redemption/EditRedemption';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../../hooks/useTableCompactMode';

const { Text } = Typography;

function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

const RedemptionsTable = () => {
  const { t } = useTranslation();

  const isExpired = (rec) => {
    return rec.status === 1 && rec.expired_time !== 0 && rec.expired_time < Math.floor(Date.now() / 1000);
  };

  const renderStatus = (status, record) => {
    if (isExpired(record)) {
      return (
        <Tag color='orange' shape='circle'>{t('已过期')}</Tag>
      );
    }
    switch (status) {
      case 1:
        return (
          <Tag color='green' shape='circle'>
            {t('未使用')}
          </Tag>
        );
      case 2:
        return (
          <Tag color='red' shape='circle'>
            {t('已禁用')}
          </Tag>
        );
      case 3:
        return (
          <Tag color='grey' shape='circle'>
            {t('已使用')}
          </Tag>
        );
      default:
        return (
          <Tag color='black' shape='circle'>
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: t('ID'),
      dataIndex: 'id',
    },
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record, index) => {
        return <div>{renderStatus(text, record)}</div>;
      },
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      render: (text, record, index) => {
        return (
          <div>
            <Tag color='grey' shape='circle'>
              {renderQuota(parseInt(text))}
            </Tag>
          </div>
        );
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (text, record, index) => {
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      render: (text) => {
        return <div>{text === 0 ? t('永不过期') : renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('兑换人ID'),
      dataIndex: 'used_user_id',
      render: (text, record, index) => {
        return <div>{text === 0 ? t('无') : text}</div>;
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 205,
      render: (text, record, index) => {
        // 创建更多操作的下拉菜单项
        const moreMenuItems = [
          {
            node: 'item',
            name: t('删除'),
            type: 'danger',
            onClick: () => {
              Modal.confirm({
                title: t('确定是否要删除此兑换码？'),
                content: t('此修改将不可逆'),
                onOk: () => {
                  (async () => {
                    await manageRedemption(record.id, 'delete', record);
                    await refresh();
                    setTimeout(() => {
                      if (redemptions.length === 0 && activePage > 1) {
                        refresh(activePage - 1);
                      }
                    }, 100);
                  })();
                },
              });
            },
          }
        ];

        if (record.status === 1 && !isExpired(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('禁用'),
            type: 'warning',
            onClick: () => {
              manageRedemption(record.id, 'disable', record);
            },
          });
        } else if (!isExpired(record)) {
          moreMenuItems.push({
            node: 'item',
            name: t('启用'),
            type: 'secondary',
            onClick: () => {
              manageRedemption(record.id, 'enable', record);
            },
            disabled: record.status === 3,
          });
        }

        return (
          <Space>
            <Popover content={record.key} style={{ padding: 20 }} position='top'>
              <Button
                type='tertiary'
                size="small"
              >
                {t('查看')}
              </Button>
            </Popover>
            <Button
              size="small"
              onClick={async () => {
                await copyText(record.key);
              }}
            >
              {t('复制')}
            </Button>
            <Button
              type='tertiary'
              size="small"
              onClick={() => {
                setEditingRedemption(record);
                setShowEdit(true);
              }}
              disabled={record.status !== 1}
            >
              {t('编辑')}
            </Button>
            <Dropdown
              trigger='click'
              position='bottomRight'
              menu={moreMenuItems}
            >
              <Button
                type='tertiary'
                size="small"
                icon={<IconMore />}
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [tokenCount, setTokenCount] = useState(ITEMS_PER_PAGE);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [editingRedemption, setEditingRedemption] = useState({
    id: undefined,
  });
  const [showEdit, setShowEdit] = useState(false);
  const [compactMode, setCompactMode] = useTableCompactMode('redemptions');

  const formInitValues = {
    searchKeyword: '',
  };

  const [formApi, setFormApi] = useState(null);

  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
    };
  };

  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingRedemption({
        id: undefined,
      });
    }, 500);
  };

  const setRedemptionFormat = (redeptions) => {
    setRedemptions(redeptions);
  };

  const loadRedemptions = async (page = 1, pageSize) => {
    setLoading(true);
    const res = await API.get(
      `/api/redemption/?p=${page}&page_size=${pageSize}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page <= 0 ? 1 : data.page);
      setTokenCount(data.total);
      setRedemptionFormat(newPageData);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const removeRecord = (key) => {
    let newDataSource = [...redemptions];
    if (key != null) {
      let idx = newDataSource.findIndex((data) => data.key === key);

      if (idx > -1) {
        newDataSource.splice(idx, 1);
        setRedemptions(newDataSource);
      }
    }
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制到剪贴板！'));
    } else {
      Modal.error({
        title: t('无法复制到剪贴板，请手动复制'),
        content: text,
        size: 'large'
      });
    }
  };

  useEffect(() => {
    loadRedemptions(1, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, [pageSize]);

  const refresh = async (page = activePage) => {
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      await loadRedemptions(page, pageSize);
    } else {
      await searchRedemptions(searchKeyword, page, pageSize);
    }
  };

  const manageRedemption = async (id, action, record) => {
    setLoading(true);
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/redemption/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/redemption/?status_only=true', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/redemption/?status_only=true', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      let redemption = res.data.data;
      let newRedemptions = [...redemptions];
      if (action === 'delete') {
      } else {
        record.status = redemption.status;
      }
      setRedemptions(newRedemptions);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const searchRedemptions = async (keyword = null, page, pageSize) => {
    // 如果没有传递keyword参数，从表单获取值
    if (keyword === null) {
      const formValues = getFormValues();
      keyword = formValues.searchKeyword;
    }

    if (keyword === '') {
      await loadRedemptions(page, pageSize);
      return;
    }
    setSearching(true);
    const res = await API.get(
      `/api/redemption/search?keyword=${keyword}&p=${page}&page_size=${pageSize}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setTokenCount(data.total);
      setRedemptionFormat(newPageData);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword } = getFormValues();
    if (searchKeyword === '') {
      loadRedemptions(page, pageSize).then();
    } else {
      searchRedemptions(searchKeyword, page, pageSize).then();
    }
  };

  let pageData = redemptions;
  const rowSelection = {
    onSelect: (record, selected) => { },
    onSelectAll: (selected, selectedRows) => { },
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  const handleRow = (record, index) => {
    if (record.status !== 1 || isExpired(record)) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      <div className="mb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full">
          <div className="flex items-center text-orange-500">
            <Ticket size={16} className="mr-2" />
            <Text>{t('兑换码可以批量生成和分发，适合用于推广活动或批量充值。')}</Text>
          </div>
          <Button
            type='tertiary'
            className="w-full md:w-auto"
            onClick={() => setCompactMode(!compactMode)}
            size="small"
          >
            {compactMode ? t('自适应列表') : t('紧凑列表')}
          </Button>
        </div>
      </div>

      <Divider margin="12px" />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto order-2 md:order-1">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type='primary'
              className="w-full sm:w-auto"
              onClick={() => {
                setEditingRedemption({
                  id: undefined,
                });
                setShowEdit(true);
              }}
              size="small"
            >
              {t('添加兑换码')}
            </Button>
            <Button
              type='tertiary'
              className="w-full sm:w-auto"
              onClick={async () => {
                if (selectedKeys.length === 0) {
                  showError(t('请至少选择一个兑换码！'));
                  return;
                }
                let keys = '';
                for (let i = 0; i < selectedKeys.length; i++) {
                  keys +=
                    selectedKeys[i].name + '    ' + selectedKeys[i].key + '\n';
                }
                await copyText(keys);
              }}
              size="small"
            >
              {t('复制所选兑换码到剪贴板')}
            </Button>
          </div>
          <Button
            type='danger'
            className="w-full sm:w-auto"
            onClick={() => {
              Modal.confirm({
                title: t('确定清除所有失效兑换码？'),
                content: t('将删除已使用、已禁用及过期的兑换码，此操作不可撤销。'),
                onOk: async () => {
                  setLoading(true);
                  const res = await API.delete('/api/redemption/invalid');
                  const { success, message, data } = res.data;
                  if (success) {
                    showSuccess(t('已删除 {{count}} 条失效兑换码', { count: data }));
                    await refresh();
                  } else {
                    showError(message);
                  }
                  setLoading(false);
                },
              });
            }}
            size="small"
          >
            {t('清除失效兑换码')}
          </Button>
        </div>

        <Form
          initValues={formInitValues}
          getFormApi={(api) => setFormApi(api)}
          onSubmit={() => {
            setActivePage(1);
            searchRedemptions(null, 1, pageSize);
          }}
          allowEmpty={true}
          autoComplete="off"
          layout="horizontal"
          trigger="change"
          stopValidateWithError={false}
          className="w-full md:w-auto order-1 md:order-2"
        >
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Form.Input
                field="searchKeyword"
                prefix={<IconSearch />}
                placeholder={t('关键字(id或者名称)')}
                showClear
                pure
                size="small"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                type="tertiary"
                htmlType="submit"
                loading={loading || searching}
                className="flex-1 md:flex-initial md:w-auto"
                size="small"
              >
                {t('查询')}
              </Button>
              <Button
                type="tertiary"
                onClick={() => {
                  if (formApi) {
                    formApi.reset();
                    setTimeout(() => {
                      setActivePage(1);
                      loadRedemptions(1, pageSize);
                    }, 100);
                  }
                }}
                className="flex-1 md:flex-initial md:w-auto"
                size="small"
              >
                {t('重置')}
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );

  return (
    <>
      <EditRedemption
        refresh={refresh}
        editingRedemption={editingRedemption}
        visiable={showEdit}
        handleClose={closeEdit}
      ></EditRedemption>

      <Card
        className="!rounded-2xl"
        title={renderHeader()}
        shadows='always'
        bordered={false}
      >
        <Table
          columns={compactMode ? columns.map(({ fixed, ...rest }) => rest) : columns}
          dataSource={pageData}
          scroll={compactMode ? undefined : { x: 'max-content' }}
          pagination={{
            currentPage: activePage,
            pageSize: pageSize,
            total: tokenCount,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            formatPageText: (page) =>
              t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
                start: page.currentStart,
                end: page.currentEnd,
                total: tokenCount,
              }),
            onPageSizeChange: (size) => {
              setPageSize(size);
              setActivePage(1);
              const { searchKeyword } = getFormValues();
              if (searchKeyword === '') {
                loadRedemptions(1, size).then();
              } else {
                searchRedemptions(searchKeyword, 1, size).then();
              }
            },
            onPageChange: handlePageChange,
          }}
          loading={loading}
          rowSelection={rowSelection}
          onRow={handleRow}
          empty={
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('搜索无结果')}
              style={{ padding: 30 }}
            />
          }
          className="rounded-xl overflow-hidden"
          size="middle"
        ></Table>
      </Card>
    </>
  );
};

export default RedemptionsTable;
