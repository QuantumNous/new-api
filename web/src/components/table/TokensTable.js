import React, { useEffect, useState } from 'react';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
  renderGroup,
  renderQuota,
  getModelCategories
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
  AvatarGroup,
  Avatar,
  Tooltip,
  Progress,
  Switch,
  Input,
  Typography
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import {
  IconSearch,
  IconTreeTriangleDown,
  IconCopy,
  IconEyeOpened,
  IconEyeClosed,
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

  const columns = [
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record) => {
        const enabled = text === 1;
        const handleToggle = (checked) => {
          if (checked) {
            manageToken(record.id, 'enable', record);
          } else {
            manageToken(record.id, 'disable', record);
          }
        };

        let tagColor = 'black';
        let tagText = t('未知状态');
        if (enabled) {
          tagColor = 'green';
          tagText = t('已启用');
        } else if (text === 2) {
          tagColor = 'red';
          tagText = t('已禁用');
        } else if (text === 3) {
          tagColor = 'yellow';
          tagText = t('已过期');
        } else if (text === 4) {
          tagColor = 'grey';
          tagText = t('已耗尽');
        }

        const used = parseInt(record.used_quota) || 0;
        const remain = parseInt(record.remain_quota) || 0;
        const total = used + remain;
        const percent = total > 0 ? (remain / total) * 100 : 0;

        const getProgressColor = (pct) => {
          if (pct === 100) return 'var(--semi-color-success)';
          if (pct <= 10) return 'var(--semi-color-danger)';
          if (pct <= 30) return 'var(--semi-color-warning)';
          return undefined;
        };

        const quotaSuffix = record.unlimited_quota ? (
          <div className='text-xs'>{t('无限额度')}</div>
        ) : (
          <div className='flex flex-col items-end'>
            <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
            <Progress
              percent={percent}
              stroke={getProgressColor(percent)}
              aria-label='quota usage'
              format={() => `${percent.toFixed(0)}%`}
              style={{ width: '100%', marginTop: '1px', marginBottom: 0 }}
            />
          </div>
        );

        const content = (
          <Tag
            color={tagColor}
            shape='circle'
            size='large'
            prefixIcon={
              <Switch
                size='small'
                checked={enabled}
                onChange={handleToggle}
                aria-label='token status switch'
              />
            }
            suffixIcon={quotaSuffix}
          >
            {tagText}
          </Tag>
        );

        if (record.unlimited_quota) {
          return content;
        }

        return (
          <Tooltip
            content={
              <div className='text-xs'>
                <div>{t('已用额度')}: {renderQuota(used)}</div>
                <div>{t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)</div>
                <div>{t('总额度')}: {renderQuota(total)}</div>
              </div>
            }
          >
            {content}
          </Tooltip>
        );
      },
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      key: 'group',
      render: (text) => {
        if (text === 'auto') {
          return (
            <Tooltip
              content={t('当前分组为 auto，会自动选择最优分组，当一个组不可用时自动降级到下一个组（熔断机制）')}
              position='top'
            >
              <Tag color='white' shape='circle'> {t('智能熔断')} </Tag>
            </Tooltip>
          );
        }
        return renderGroup(text);
      },
    },
    {
      title: t('密钥'),
      key: 'token_key',
      render: (text, record) => {
        const fullKey = 'sk-' + record.key;
        const maskedKey = 'sk-' + record.key.slice(0, 4) + '**********' + record.key.slice(-4);
        const revealed = !!showKeys[record.id];

        return (
          <div className='w-[200px]'>
            <Input
              readOnly
              value={revealed ? fullKey : maskedKey}
              size='small'
              suffix={
                <div className='flex items-center'>
                  <Button
                    theme='borderless'
                    size='small'
                    type='tertiary'
                    icon={revealed ? <IconEyeClosed /> : <IconEyeOpened />}
                    aria-label='toggle token visibility'
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowKeys(prev => ({ ...prev, [record.id]: !revealed }));
                    }}
                  />
                  <Button
                    theme='borderless'
                    size='small'
                    type='tertiary'
                    icon={<IconCopy />}
                    aria-label='copy token key'
                    onClick={async (e) => {
                      e.stopPropagation();
                      await copyText(fullKey);
                    }}
                  />
                </div>
              }
            />
          </div>
        );
      },
    },
    {
      title: t('可用模型'),
      dataIndex: 'model_limits',
      render: (text, record) => {
        if (record.model_limits_enabled && text) {
          const models = text.split(',').filter(Boolean);
          const categories = getModelCategories(t);

          const vendorAvatars = [];
          const matchedModels = new Set();
          Object.entries(categories).forEach(([key, category]) => {
            if (key === 'all') return;
            if (!category.icon || !category.filter) return;
            const vendorModels = models.filter((m) => category.filter({ model_name: m }));
            if (vendorModels.length > 0) {
              vendorAvatars.push(
                <Tooltip key={key} content={vendorModels.join(', ')} position='top' showArrow>
                  <Avatar size='extra-extra-small' alt={category.label} color='transparent'>
                    {category.icon}
                  </Avatar>
                </Tooltip>
              );
              vendorModels.forEach((m) => matchedModels.add(m));
            }
          });

          const unmatchedModels = models.filter((m) => !matchedModels.has(m));
          if (unmatchedModels.length > 0) {
            vendorAvatars.push(
              <Tooltip key='unknown' content={unmatchedModels.join(', ')} position='top' showArrow>
                <Avatar size='extra-extra-small' alt='unknown'>
                  {t('其他')}
                </Avatar>
              </Tooltip>
            );
          }

          return (
            <AvatarGroup size='extra-extra-small'>
              {vendorAvatars}
            </AvatarGroup>
          );
        } else {
          return (
            <Tag color='white' shape='circle'>
              {t('无限制')}
            </Tag>
          );
        }
      },
    },
    {
      title: t('IP限制'),
      dataIndex: 'allow_ips',
      render: (text) => {
        if (!text || text.trim() === '') {
          return (
            <Tag color='white' shape='circle'>
              {t('无限制')}
            </Tag>
          );
        }

        const ips = text
          .split('\n')
          .map((ip) => ip.trim())
          .filter(Boolean);

        const displayIps = ips.slice(0, 1);
        const extraCount = ips.length - displayIps.length;

        const ipTags = displayIps.map((ip, idx) => (
          <Tag key={idx} shape='circle'>
            {ip}
          </Tag>
        ));

        if (extraCount > 0) {
          ipTags.push(
            <Tooltip
              key='extra'
              content={ips.slice(1).join(', ')}
              position='top'
              showArrow
            >
              <Tag shape='circle'>
                {'+' + extraCount}
              </Tag>
            </Tooltip>
          );
        }

        return <Space wrap>{ipTags}</Space>;
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

        return (
          <Space wrap>
            <SplitButtonGroup
              className="overflow-hidden"
              aria-label={t('项目操作按钮组')}
            >
              <Button
                size="small"
                type='tertiary'
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
                  type='tertiary'
                  icon={<IconTreeTriangleDown />}
                  size="small"
                ></Button>
              </Dropdown>
            </SplitButtonGroup>

            <Button
              type='tertiary'
              size="small"
              onClick={() => {
                setEditingToken(record);
                setShowEdit(true);
              }}
            >
              {t('编辑')}
            </Button>

            <Button
              type='danger'
              size="small"
              onClick={() => {
                Modal.confirm({
                  title: t('确定是否要删除此令牌？'),
                  content: t('此修改将不可逆'),
                  onOk: () => {
                    (async () => {
                      await manageToken(record.id, 'delete', record);
                      await refresh();
                    })();
                  },
                });
              }}
            >
              {t('删除')}
            </Button>
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
  const [showKeys, setShowKeys] = useState({});

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

  const refresh = async (page = activePage) => {
    await loadTokens(page);
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
    if (url.includes('{cherryConfig}') === true) {
      let cherryConfig = {
        id: 'new-api',
        baseUrl: serverAddress,
        apiKey: 'sk-' + record.key,
      }
      // 替换 {cherryConfig} 为base64编码的JSON字符串
      let encodedConfig = encodeURIComponent(
        btoa(JSON.stringify(cherryConfig))
      );
      url = url.replaceAll('{cherryConfig}', encodedConfig);
    } else {
      let encodedServerAddress = encodeURIComponent(serverAddress);
      url = url.replaceAll('{address}', encodedServerAddress);
      url = url.replaceAll('{key}', 'sk-' + record.key);
    }

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
        setTimeout(() => {
          if (tokens.length === 0 && activePage > 1) {
            refresh(activePage - 1);
          }
        }, 100);
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
            type="tertiary"
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
        <div className="flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            type="primary"
            className="flex-1 md:flex-initial"
            onClick={() => {
              setEditingToken({
                id: undefined,
              });
              setShowEdit(true);
            }}
            size="small"
          >
            {t('添加令牌')}
          </Button>
          <Button
            type='tertiary'
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
                      type='tertiary'
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
            size="small"
          >
            {t('复制所选令牌')}
          </Button>
          <Button
            type='danger'
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
            size="small"
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
                size="small"
              />
            </div>
            <div className="relative w-full md:w-56">
              <Form.Input
                field="searchToken"
                prefix={<IconSearch />}
                placeholder={t('密钥')}
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
                type='tertiary'
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
