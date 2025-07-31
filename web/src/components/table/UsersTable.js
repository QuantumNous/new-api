import React, { useEffect, useState } from 'react';
import { API, showError, showSuccess, renderGroup, renderNumber, renderQuota } from '../../helpers';

import {
  User,
  Shield,
  Crown,
  HelpCircle,
  CheckCircle,
  XCircle,
  Minus,
  Coins,
  Activity,
  Users,
  DollarSign,
  UserPlus,
} from 'lucide-react';
import {
  Button,
  Card,
  Divider,
  Dropdown,
  Empty,
  Form,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import {
  IconSearch,
  IconUserAdd,
  IconMore,
} from '@douyinfe/semi-icons';
import { ITEMS_PER_PAGE } from '../../constants';
import AddUser from '../../pages/User/AddUser';
import EditUser from '../../pages/User/EditUser';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../../hooks/useTableCompactMode';

const { Text } = Typography;

const UsersTable = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('users');

  function renderRole(role) {
    switch (role) {
      case 1:
        return (
          <Tag color='blue' shape='circle' prefixIcon={<User size={14} />}>
            {t('普通用户')}
          </Tag>
        );
      case 10:
        return (
          <Tag color='yellow' shape='circle' prefixIcon={<Shield size={14} />}>
            {t('管理员')}
          </Tag>
        );
      case 100:
        return (
          <Tag color='orange' shape='circle' prefixIcon={<Crown size={14} />}>
            {t('超级管理员')}
          </Tag>
        );
      default:
        return (
          <Tag color='red' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知身份')}
          </Tag>
        );
    }
  }

  const renderStatus = (status) => {
    switch (status) {
      case 1:
        return <Tag color='green' shape='circle' prefixIcon={<CheckCircle size={14} />}>{t('已激活')}</Tag>;
      case 2:
        return (
          <Tag color='red' shape='circle' prefixIcon={<XCircle size={14} />}>
            {t('已封禁')}
          </Tag>
        );
      default:
        return (
          <Tag color='grey' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (text, record) => {
        const remark = record.remark;
        if (!remark) {
          return <span>{text}</span>;
        }
        const maxLen = 10;
        const displayRemark = remark.length > maxLen ? remark.slice(0, maxLen) + '…' : remark;
        return (
          <Space spacing={2}>
            <span>{text}</span>
            <Tooltip content={remark} position="top" showArrow>
              <Tag color='white' shape='circle' className="!text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 flex-shrink-0 rounded-full" style={{ backgroundColor: '#10b981' }} />
                  {displayRemark}
                </div>
              </Tag>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        return <div>{renderGroup(text)}</div>;
      },
    },
    {
      title: t('统计信息'),
      dataIndex: 'info',
      render: (text, record, index) => {
        return (
          <div>
            <Space spacing={1}>
              <Tag color='white' shape='circle' className="!text-xs" prefixIcon={<Coins size={14} />}>
                {t('剩余')}: {renderQuota(record.quota)}
              </Tag>
              <Tag color='white' shape='circle' className="!text-xs" prefixIcon={<Coins size={14} />}>
                {t('已用')}: {renderQuota(record.used_quota)}
              </Tag>
              <Tag color='white' shape='circle' className="!text-xs" prefixIcon={<Activity size={14} />}>
                {t('调用')}: {renderNumber(record.request_count)}
              </Tag>
            </Space>
          </div>
        );
      },
    },
    {
      title: t('邀请信息'),
      dataIndex: 'invite',
      render: (text, record, index) => {
        return (
          <div>
            <Space spacing={1}>
              <Tag color='white' shape='circle' className="!text-xs" prefixIcon={<Users size={14} />}>
                {t('邀请')}: {renderNumber(record.aff_count)}
              </Tag>
              <Tag color='white' shape='circle' className="!text-xs" prefixIcon={<DollarSign size={14} />}>
                {t('收益')}: {renderQuota(record.aff_history_quota)}
              </Tag>
              <Tag color='white' shape='circle' className="!text-xs" prefixIcon={<UserPlus size={14} />}>
                {record.inviter_id === 0 ? t('无邀请人') : `邀请人: ${record.inviter_id}`}
              </Tag>
            </Space>
          </div>
        );
      },
    },
    {
      title: t('角色'),
      dataIndex: 'role',
      render: (text, record, index) => {
        return <div>{renderRole(text)}</div>;
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (text, record, index) => {
        return (
          <div>
            {record.DeletedAt !== null ? (
              <Tag color='red' shape='circle' prefixIcon={<Minus size={14} />}>{t('已注销')}</Tag>
            ) : (
              renderStatus(text)
            )}
          </div>
        );
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) => {
        if (record.DeletedAt !== null) {
          return <></>;
        }

        // 创建更多操作的下拉菜单项
        const moreMenuItems = [
          {
            node: 'item',
            name: t('提升'),
            type: 'warning',
            onClick: () => {
              Modal.confirm({
                title: t('确定要提升此用户吗？'),
                content: t('此操作将提升用户的权限级别'),
                onOk: () => {
                  manageUser(record.id, 'promote', record);
                },
              });
            },
          },
          {
            node: 'item',
            name: t('降级'),
            type: 'secondary',
            onClick: () => {
              Modal.confirm({
                title: t('确定要降级此用户吗？'),
                content: t('此操作将降低用户的权限级别'),
                onOk: () => {
                  manageUser(record.id, 'demote', record);
                },
              });
            },
          },
          {
            node: 'item',
            name: t('注销'),
            type: 'danger',
            onClick: () => {
              Modal.confirm({
                title: t('确定是否要注销此用户？'),
                content: t('相当于删除用户，此修改将不可逆'),
                onOk: () => {
                  (async () => {
                    await manageUser(record.id, 'delete', record);
                    await refresh();
                    setTimeout(() => {
                      if (users.length === 0 && activePage > 1) {
                        refresh(activePage - 1);
                      }
                    }, 100);
                  })();
                },
              });
            },
          }
        ];

        // 动态添加启用/禁用按钮
        if (record.status === 1) {
          moreMenuItems.splice(-1, 0, {
            node: 'item',
            name: t('禁用'),
            type: 'warning',
            onClick: () => {
              manageUser(record.id, 'disable', record);
            },
          });
        } else {
          moreMenuItems.splice(-1, 0, {
            node: 'item',
            name: t('启用'),
            type: 'secondary',
            onClick: () => {
              manageUser(record.id, 'enable', record);
            },
            disabled: record.status === 3,
          });
        }

        return (
          <Space>
            <Button
              type='tertiary'
              size="small"
              onClick={() => {
                setEditingUser(record);
                setShowEditUser(true);
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

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searching, setSearching] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [userCount, setUserCount] = useState(ITEMS_PER_PAGE);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState({
    id: undefined,
  });

  // Form 初始值
  const formInitValues = {
    searchKeyword: '',
    searchGroup: '',
  };

  // Form API 引用
  const [formApi, setFormApi] = useState(null);

  // 获取表单值的辅助函数
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchGroup: formValues.searchGroup || '',
    };
  };

  const removeRecord = (key) => {
    let newDataSource = [...users];
    if (key != null) {
      let idx = newDataSource.findIndex((data) => data.id === key);

      if (idx > -1) {
        // update deletedAt
        newDataSource[idx].DeletedAt = new Date();
        setUsers(newDataSource);
      }
    }
  };

  const setUserFormat = (users) => {
    for (let i = 0; i < users.length; i++) {
      users[i].key = users[i].id;
    }
    setUsers(users);
  };

  const loadUsers = async (startIdx, pageSize) => {
    const res = await API.get(`/api/user/?p=${startIdx}&page_size=${pageSize}`);
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers(0, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    fetchGroups().then();
  }, []);

  const manageUser = async (userId, action, record) => {
    const res = await API.post('/api/user/manage', {
      id: userId,
      action,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess('操作成功完成！');
      let user = res.data.data;
      let newUsers = [...users];
      if (action === 'delete') {
      } else {
        record.status = user.status;
        record.role = user.role;
      }
      setUsers(newUsers);
    } else {
      showError(message);
    }
  };

  const searchUsers = async (
    startIdx,
    pageSize,
    searchKeyword = null,
    searchGroup = null,
  ) => {
    // 如果没有传递参数，从表单获取值
    if (searchKeyword === null || searchGroup === null) {
      const formValues = getFormValues();
      searchKeyword = formValues.searchKeyword;
      searchGroup = formValues.searchGroup;
    }

    if (searchKeyword === '' && searchGroup === '') {
      // if keyword is blank, load files instead.
      await loadUsers(startIdx, pageSize);
      return;
    }
    setSearching(true);
    const res = await API.get(
      `/api/user/search?keyword=${searchKeyword}&group=${searchGroup}&p=${startIdx}&page_size=${pageSize}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    const { searchKeyword, searchGroup } = getFormValues();
    if (searchKeyword === '' && searchGroup === '') {
      loadUsers(page, pageSize).then();
    } else {
      searchUsers(page, pageSize, searchKeyword, searchGroup).then();
    }
  };

  const closeAddUser = () => {
    setShowAddUser(false);
  };

  const closeEditUser = () => {
    setShowEditUser(false);
    setEditingUser({
      id: undefined,
    });
  };

  const refresh = async (page = activePage) => {
    const { searchKeyword, searchGroup } = getFormValues();
    if (searchKeyword === '' && searchGroup === '') {
      await loadUsers(page, pageSize);
    } else {
      await searchUsers(page, pageSize, searchKeyword, searchGroup);
    }
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      // add 'all' option
      // res.data.data.unshift('all');
      if (res === undefined) {
        return;
      }
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadUsers(activePage, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  const handleRow = (record, index) => {
    if (record.DeletedAt !== null || record.status !== 1) {
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
          <div className="flex items-center text-blue-500">
            <IconUserAdd className="mr-2" />
            <Text>{t('用户管理页面，可以查看和管理所有注册用户的信息、权限和状态。')}</Text>
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
        <div className="flex gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            className="w-full md:w-auto"
            onClick={() => {
              setShowAddUser(true);
            }}
            size="small"
          >
            {t('添加用户')}
          </Button>
        </div>

        <Form
          initValues={formInitValues}
          getFormApi={(api) => setFormApi(api)}
          onSubmit={() => {
            setActivePage(1);
            searchUsers(1, pageSize);
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
                placeholder={t('支持搜索用户的 ID、用户名、显示名称和邮箱地址')}
                showClear
                pure
                size="small"
              />
            </div>
            <div className="w-full md:w-48">
              <Form.Select
                field="searchGroup"
                placeholder={t('选择分组')}
                optionList={groupOptions}
                onChange={(value) => {
                  // 分组变化时自动搜索
                  setTimeout(() => {
                    setActivePage(1);
                    searchUsers(1, pageSize);
                  }, 100);
                }}
                className="w-full"
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
                    setTimeout(() => {
                      setActivePage(1);
                      loadUsers(1, pageSize);
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
      <AddUser
        refresh={refresh}
        visible={showAddUser}
        handleClose={closeAddUser}
      ></AddUser>
      <EditUser
        refresh={refresh}
        visible={showEditUser}
        handleClose={closeEditUser}
        editingUser={editingUser}
      ></EditUser>

      <Card
        className="!rounded-2xl"
        title={renderHeader()}
        shadows='always'
        bordered={false}
      >
        <Table
          columns={compactMode ? columns.map(({ fixed, ...rest }) => rest) : columns}
          dataSource={users}
          scroll={compactMode ? undefined : { x: 'max-content' }}
          pagination={{
            formatPageText: (page) =>
              t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
                start: page.currentStart,
                end: page.currentEnd,
                total: userCount,
              }),
            currentPage: activePage,
            pageSize: pageSize,
            total: userCount,
            pageSizeOpts: [10, 20, 50, 100],
            showSizeChanger: true,
            onPageSizeChange: (size) => {
              handlePageSizeChange(size);
            },
            onPageChange: handlePageChange,
          }}
          loading={loading}
          onRow={handleRow}
          empty={
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('搜索无结果')}
              style={{ padding: 30 }}
            />
          }
          className="overflow-hidden"
          size="middle"
        />
      </Card>
    </>
  );
};

export default UsersTable;
