import React, { useEffect, useState } from 'react';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
  renderGroup,
  renderQuota,
  getQuotaPerUnit
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  Button,
  Card,
  Divider,
  Dropdown,
  Empty,
  Form,
  Modal,
  Space,
  SplitButtonGroup,
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
  IconTreeTriangleDown,
  IconMore,
} from '@douyinfe/semi-icons';
import { Key } from 'lucide-react';
import EditToken from '../../pages/Token/EditToken';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../../hooks/useTableCompactMode';

const { Text } = Typography;

function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

const TokensTable = () => {
  const { t } = useTranslation();

  const renderStatus = (status, model_limits_enabled = false) => {
    switch (status) {
      case 1:
        if (model_limits_enabled) {
          return (
            <Tag color='green' size='large' shape='circle' >
              {t('已启用：限制模型')}
            </Tag>
          );
        } else {
          return (
            <Tag color='green' size='large' shape='circle' >
              {t('已启用')}
            </Tag>
          );
        }
      case 2:
        return (
          <Tag color='red' size='large' shape='circle' >
            {t('已禁用')}
          </Tag>
        );
      case 3:
        return (
          <Tag color='yellow' size='large' shape='circle' >
            {t('已过期')}
          </Tag>
        );
      case 4:
        return (
          <Tag color='grey' size='large' shape='circle' >
            {t('已耗尽')}
          </Tag>
        );
      default:
        return (
          <Tag color='black' size='large' shape='circle' >
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record, index) => {
        return (
          <div>
            <Space>
              {renderStatus(text, record.model_limits_enabled)}
              {renderGroup(record.group)}
            </Space>
          </div>
        );
      },
    },
    {
      title: t('已用额度'),
      dataIndex: 'used_quota',
      render: (text, record, index) => {
        return (
          <div>
            <Tag size={'large'} color={'grey'} shape='circle' >
              {renderQuota(parseInt(text))}
            </Tag>
          </div>
        );
      },
    },
    {
      title: t('剩余额度'),
      dataIndex: 'remain_quota',
      render: (text, record, index) => {
        const getQuotaColor = (quotaValue) => {
          const quotaPerUnit = getQuotaPerUnit();
          const dollarAmount = quotaValue / quotaPerUnit;

          if (dollarAmount <= 0) {
            return 'red';
          } else if (dollarAmount <= 100) {
            return 'yellow';
          } else {
            return 'green';
          }
        };

        return (
          <div>
            {record.unlimited_quota ? (
              <Tag size={'large'} color={'white'} shape='circle' >
                {t('无限制')}
              </Tag>
            ) : (
              <Tag
                size={'large'}
                color={getQuotaColor(parseInt(text))}
                shape='circle'
              >
                {renderQuota(parseInt(text))}
              </Tag>
            )}
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
      render: (text, record, index) => {
        return (
          <div>
            {record.expired_time === -1 ? t('永不过期') : renderTimestamp(text)}
          </div>
        );
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) => {
        let chats = localStorage.getItem('chats');
        let chatsArray = [];
        let shouldUseCustom = true;

        if (shouldUseCustom) {
          try {
            chats = JSON.parse(chats);
            if (Array.isArray(chats)) {
              for (let i = 0; i < chats.length; i++) {
                let chat = {};
                chat.node = 'item';
                for (let key in chats[i]) {
                  if (chats[i].hasOwnProperty(key)) {
                    chat.key = i;
                    chat.name = key;
                    chat.onClick = () => {
                      onOpenLink(key, chats[i][key], record);
                    };
                  }
                }
                chatsArray.push(chat);
              }
            }
          } catch (e) {
            console.log(e);
            showError(t('聊天链接配置错误，请联系管理员'));
          }
        }

        // 创建更多操作的下拉菜单项
        const moreMenuItems = [
          {
            node: 'item',
            name: t('查看'),
            onClick: () => {
              Modal.info({
                title: t('令牌详情'),
                content: 'sk-' + record.key,
                size: 'large',
              });
            },
          },
          {
            node: 'item',
            name: t('删除'),
            type: 'danger',
            onClick: () => {
              Modal.confirm({
                title: t('确定是否要删除此令牌？'),
                content: t('此修改将不可逆'),
                onOk: () => {
                  manageToken(record.id, 'delete', record).then(() => {
                    removeRecord(record.key);
                  });
                },
              });
            },
          }
        ];

        // 动态添加启用/禁用按钮
        if (record.status === 1) {
          moreMenuItems.push({
            node: 'item',
            name: t('禁用'),
            type: 'warning',
            onClick: () => {
              manageToken(record.id, 'disable', record);
            },
          });
        } else {
          moreMenuItems.push({
            node: 'item',
            name: t('启用'),
            type: 'secondary',
            onClick: () => {
              manageToken(record.id, 'enable', record);
            },
          });
        }

        return (
          <Space wrap>
            <SplitButtonGroup
              className="overflow-hidden"
              aria-label={t('项目操作按钮组')}
            >
              <Button
                theme='light'
                size="small"
                style={{ color: 'rgba(var(--semi-teal-7), 1)' }}
                onClick={() => {
                  if (chatsArray.length === 0) {
                    showError(t('请联系管理员配置聊天链接'));
                  } else {
                    onOpenLink(
                      'default',
                      chats[0][Object.keys(chats[0])[0]],
                      record,
                    );
                  }
                }}
              >
                {t('聊天')}
              </Button>
              <Dropdown
                trigger='click'
                position='bottomRight'
                menu={chatsArray}
              >
                <Button
                  style={{
                    padding: '4px 4px',
                    color: 'rgba(var(--semi-teal-7), 1)',
                  }}
                  type='primary'
                  icon={<IconTreeTriangleDown />}
                  size="small"
                ></Button>
              </Dropdown>
            </SplitButtonGroup>

            <Button
              theme='light'
              type='secondary'
              size="small"
              onClick={async (text) => {
                await copyText('sk-' + record.key);
              }}
            >
              {t('复制')}
            </Button>

            <Button
              theme='light'
              type='tertiary'
              size="small"
              onClick={() => {
                setEditingToken(record);
                setShowEdit(true);
              }}
            >
              {t('编辑')}
            </Button>

            <Dropdown
              trigger='click'
              position='bottomRight'
              menu={moreMenuItems}
            >
              <Button
                icon={<IconMore />}
                theme='light'
                type='tertiary'
                size="small"
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [showEdit, setShowEdit] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [tokenCount, setTokenCount] = useState(pageSize);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [editingToken, setEditingToken] = useState({
    id: undefined,
  });
  const [compactMode, setCompactMode] = useTableCompactMode('tokens');

  // Form 初始值
  const formInitValues = {
    searchKeyword: '',
    searchToken: '',
  };

  // Form API 引用
  const [formApi, setFormApi] = useState(null);

  // 获取表单值的辅助函数
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchToken: formValues.searchToken || '',
    };
  };

  const closeEdit = () => {
    setShowEdit(false);
    setTimeout(() => {
      setEditingToken({
        id: undefined,
      });
    }, 500);
  };

  // 将后端返回的数据写入状态
  const syncPageData = (payload) => {
    setTokens(payload.items || []);
    setTokenCount(payload.total || 0);
    setActivePage(payload.page || 1);
    setPageSize(payload.page_size || pageSize);
  };

  const loadTokens = async (page = 1, size = pageSize) => {
    setLoading(true);
    const res = await API.get(`/api/token/?p=${page}&size=${size}`);
    const { success, message, data } = res.data;
    if (success) {
      syncPageData(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const refresh = async () => {
    await loadTokens(1);
    setSelectedKeys([]);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制到剪贴板！'));
    } else {
      Modal.error({
        title: t('无法复制到剪贴板，请手动复制'),
        content: text,
        size: 'large',
      });
    }
  };

  const onOpenLink = async (type, url, record) => {
    let status = localStorage.getItem('status');
    let serverAddress = '';
    if (status) {
      status = JSON.parse(status);
      serverAddress = status.server_address;
    }
    if (serverAddress === '') {
      serverAddress = window.location.origin;
    }
    let encodedServerAddress = encodeURIComponent(serverAddress);
    url = url.replaceAll('{address}', encodedServerAddress);
    url = url.replaceAll('{key}', 'sk-' + record.key);

    window.open(url, '_blank');
  };

  useEffect(() => {
    loadTokens(1)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, [pageSize]);

  const removeRecord = (key) => {
    let newDataSource = [...tokens];
    if (key != null) {
      let idx = newDataSource.findIndex((data) => data.key === key);

      if (idx > -1) {
        newDataSource.splice(idx, 1);
        setTokens(newDataSource);
      }
    }
  };

  const manageToken = async (id, action, record) => {
    setLoading(true);
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/token/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/token/?status_only=true', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/token/?status_only=true', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess('操作成功完成！');
      let token = res.data.data;
      let newTokens = [...tokens];
      if (action === 'delete') {
      } else {
        record.status = token.status;
      }
      setTokens(newTokens);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const searchTokens = async () => {
    const { searchKeyword, searchToken } = getFormValues();
    if (searchKeyword === '' && searchToken === '') {
      await loadTokens(1);
      return;
    }
    setSearching(true);
    const res = await API.get(
      `/api/token/search?keyword=${searchKeyword}&token=${searchToken}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      setTokens(data);
      setTokenCount(data.length);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const sortToken = (key) => {
    if (tokens.length === 0) return;
    setLoading(true);
    let sortedTokens = [...tokens];
    sortedTokens.sort((a, b) => {
      return ('' + a[key]).localeCompare(b[key]);
    });
    if (sortedTokens[0].id === tokens[0].id) {
      sortedTokens.reverse();
    }
    setTokens(sortedTokens);
    setLoading(false);
  };

  const handlePageChange = (page) => {
    loadTokens(page, pageSize).then();
  };

  const handlePageSizeChange = async (size) => {
    setPageSize(size);
    await loadTokens(1, size);
  };

  const rowSelection = {
    onSelect: (record, selected) => { },
    onSelectAll: (selected, selectedRows) => { },
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedKeys(selectedRows);
    },
  };

  const handleRow = (record, index) => {
    if (record.status !== 1) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  const batchDeleteTokens = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请先选择要删除的令牌！'));
      return;
    }
    setLoading(true);
    try {
      const ids = selectedKeys.map((token) => token.id);
      const res = await API.post('/api/token/batch', { ids });
      if (res?.data?.success) {
        const count = res.data.data || 0;
        showSuccess(t('已删除 {{count}} 个令牌！', { count }));
        await refresh();
      } else {
        showError(res?.data?.message || t('删除失败'));
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      <div className="mb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full">
          <div className="flex items-center text-blue-500">
            <Key size={16} className="mr-2" />
            <Text>{t('令牌用于API访问认证，可以设置额度限制和模型权限。')}</Text>
          </div>
          <Button
            theme="light"
            type="secondary"
            className="w-full md:w-auto"
            onClick={() => setCompactMode(!compactMode)}
          >
            {compactMode ? t('自适应列表') : t('紧凑列表')}
          </Button>
        </div>
      </div>

      <Divider margin="12px" />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
        <div className="flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            theme="light"
            type="primary"
            className="flex-1 md:flex-initial"
            onClick={() => {
              setEditingToken({
                id: undefined,
              });
              setShowEdit(true);
            }}
          >
            {t('添加令牌')}
          </Button>
          <Button
            theme="light"
            type="warning"
            className="flex-1 md:flex-initial"
            onClick={() => {
              if (selectedKeys.length === 0) {
                showError(t('请至少选择一个令牌！'));
                return;
              }
              Modal.info({
                title: t('复制令牌'),
                icon: null,
                content: t('请选择你的复制方式'),
                footer: (
                  <Space>
                    <Button
                      type="primary"
                      theme="solid"
                      onClick={async () => {
                        let content = '';
                        for (let i = 0; i < selectedKeys.length; i++) {
                          content +=
                            selectedKeys[i].name + '    sk-' + selectedKeys[i].key + '\n';
                        }
                        await copyText(content);
                        Modal.destroyAll();
                      }}
                    >
                      {t('名称+密钥')}
                    </Button>
                    <Button
                      theme="light"
                      onClick={async () => {
                        let content = '';
                        for (let i = 0; i < selectedKeys.length; i++) {
                          content += 'sk-' + selectedKeys[i].key + '\n';
                        }
                        await copyText(content);
                        Modal.destroyAll();
                      }}
                    >
                      {t('仅密钥')}
                    </Button>
                  </Space>
                ),
              });
            }}
          >
            {t('复制所选令牌')}
          </Button>
          <Button
            theme="light"
            type="danger"
            className="w-full md:w-auto"
            onClick={() => {
              if (selectedKeys.length === 0) {
                showError(t('请至少选择一个令牌！'));
                return;
              }
              Modal.confirm({
                title: t('批量删除令牌'),
                content: (
                  <div>
                    {t('确定要删除所选的 {{count}} 个令牌吗？', { count: selectedKeys.length })}
                  </div>
                ),
                onOk: () => batchDeleteTokens(),
              });
            }}
          >
            {t('删除所选令牌')}
          </Button>
        </div>

        <Form
          initValues={formInitValues}
          getFormApi={(api) => setFormApi(api)}
          onSubmit={searchTokens}
          allowEmpty={true}
          autoComplete="off"
          layout="horizontal"
          trigger="change"
          stopValidateWithError={false}
          className="w-full md:w-auto order-1 md:order-2"
        >
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-56">
              <Form.Input
                field="searchKeyword"
                prefix={<IconSearch />}
                placeholder={t('搜索关键字')}
                showClear
                pure
              />
            </div>
            <div className="relative w-full md:w-56">
              <Form.Input
                field="searchToken"
                prefix={<IconSearch />}
                placeholder={t('密钥')}
                showClear
                pure
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading || searching}
                className="flex-1 md:flex-initial md:w-auto"
              >
                {t('查询')}
              </Button>
              <Button
                theme="light"
                onClick={() => {
                  if (formApi) {
                    formApi.reset();
                    // 重置后立即查询，使用setTimeout确保表单重置完成
                    setTimeout(() => {
                      searchTokens();
                    }, 100);
                  }
                }}
                className="flex-1 md:flex-initial md:w-auto"
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
      <EditToken
        refresh={refresh}
        editingToken={editingToken}
        visiable={showEdit}
        handleClose={closeEdit}
      ></EditToken>

      <Card
        className="!rounded-2xl"
        title={renderHeader()}
        shadows='always'
        bordered={false}
      >
        <Table
          columns={compactMode ? columns.map(col => {
            if (col.dataIndex === 'operate') {
              const { fixed, ...rest } = col;
              return rest;
            }
            return col;
          }) : columns}
          dataSource={tokens}
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
            onPageSizeChange: handlePageSizeChange,
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

export default TokensTable;
