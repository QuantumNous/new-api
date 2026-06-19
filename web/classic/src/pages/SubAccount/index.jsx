import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { renderQuota } from '../../helpers/render';
import { createCardProPagination } from '../../helpers/utils';
import { UserContext } from '../../context/User';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import CompactModeToggle from '../../components/common/ui/CompactModeToggle';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const { Text } = Typography;

const STATUS_TAG = {
  1: { text: '已启用', color: 'green' },
  2: { text: '已禁用', color: 'grey' },
};

// 令牌状态标签（对齐令牌管理：1启用 2禁用 3过期 4耗尽）
const TOKEN_STATUS_TAG = {
  1: { text: '已启用', color: 'green' },
  2: { text: '已禁用', color: 'red' },
  3: { text: '已过期', color: 'yellow' },
  4: { text: '已耗尽', color: 'grey' },
};

function tsToText(sec) {
  if (!sec) return '-';
  return new Date(sec * 1000).toLocaleString();
}

const SubAccountPage = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [userState] = useContext(UserContext);

  const isSubAccount = (userState?.user?.parent_user_id || 0) > 0;
  const isEnterpriseOwner =
    userState?.user?.enterprise_status === 2 && !isSubAccount;

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [maxCount, setMaxCount] = useState(10);
  const [compactMode, setCompactMode] = useState(false);

  // 客户端分页（子账户上限较小，后端一次返回全部，分页仅为统一 UI 观感）
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 创建子账户弹窗
  const [createVisible, setCreateVisible] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // 重置密码弹窗
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // 绑定管理弹窗
  const [bindVisible, setBindVisible] = useState(false);
  const [bindTarget, setBindTarget] = useState(null);
  const [bindings, setBindings] = useState([]);
  // 候选令牌：默认第一页 + 远程关键词搜索（接口 page_size 上限 100，
  // 企业令牌超 100 时靠搜索补全可选范围）；已绑定过滤在渲染期做。
  const [tokenOptions, setTokenOptions] = useState([]);
  const [tokenSearchLoading, setTokenSearchLoading] = useState(false);
  const tokenSearchTimerRef = useRef(null);
  const [tokenToBind, setTokenToBind] = useState(null);
  const [bindLoading, setBindLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/sub_account');
      if (res.data?.success) {
        setList(res.data.data?.items || []);
        if (res.data.data?.max_count) setMaxCount(res.data.data.max_count);
      } else {
        showError(res.data?.message || t('加载子账户失败'));
      }
    } catch (_) {
      // 拦截器已弹错
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEnterpriseOwner) fetchList();
  }, [isEnterpriseOwner]);

  // 列表变化后，纠正越界页码（如删到当前页为空）
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
    if (activePage > maxPage) setActivePage(maxPage);
  }, [list.length, pageSize, activePage]);

  const pagedList = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, activePage, pageSize]);

  if (!isEnterpriseOwner) {
    return (
      <div className='mt-[60px] px-2'>
        <Banner
          type='warning'
          closeIcon={null}
          description={t('子账户管理仅对已通过企业认证的主账户开放。')}
        />
      </div>
    );
  }

  // ── 创建 ─────────────────────────────────────────────
  const submitCreate = async () => {
    const { username, password } = createForm;
    if (!username.trim() || !password) {
      showError(t('请填写用户名和密码'));
      return;
    }
    setCreateLoading(true);
    try {
      const res = await API.post('/api/user/sub_account', {
        username: username.trim(),
        password,
      });
      if (res.data?.success) {
        showSuccess(t('子账户创建成功'));
        setCreateVisible(false);
        setCreateForm({ username: '', password: '' });
        await fetchList();
      } else {
        showError(res.data?.message || t('创建失败'));
      }
    } catch (_) {
    } finally {
      setCreateLoading(false);
    }
  };

  // ── 重置密码 ─────────────────────────────────────────
  const openPwd = (row) => {
    setPwdTarget(row);
    setNewPassword('');
    setPwdVisible(true);
  };
  const submitPwd = async () => {
    if (!newPassword || newPassword.length < 8) {
      showError(t('密码至少 8 位'));
      return;
    }
    setPwdLoading(true);
    try {
      const res = await API.put(
        `/api/user/sub_account/${pwdTarget.id}/password`,
        { password: newPassword },
      );
      if (res.data?.success) {
        showSuccess(t('密码已重置'));
        setPwdVisible(false);
      } else {
        showError(res.data?.message || t('重置失败'));
      }
    } catch (_) {
    } finally {
      setPwdLoading(false);
    }
  };

  // ── 启用/禁用 ────────────────────────────────────────
  const toggleStatus = (row) => {
    const next = row.status === 1 ? 2 : 1;
    Modal.confirm({
      title: next === 2 ? t('禁用子账户') : t('启用子账户'),
      content:
        next === 2
          ? t('禁用后该子账户将无法登录，但已绑定关系与数据保留。')
          : t('确定启用该子账户吗？'),
      onOk: async () => {
        try {
          const res = await API.put(
            `/api/user/sub_account/${row.id}/status`,
            { status: next },
          );
          if (res.data?.success) {
            showSuccess(t('操作成功'));
            await fetchList();
          } else {
            showError(res.data?.message || t('操作失败'));
          }
        } catch (_) {}
      },
    });
  };

  // ── 删除 ─────────────────────────────────────────────
  const removeSub = (row) => {
    Modal.confirm({
      title: t('删除子账户'),
      content: t(
        '删除前需先解除该子账户的全部令牌绑定。确定删除该子账户吗？',
      ),
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await API.delete(`/api/user/sub_account/${row.id}`);
          if (res.data?.success) {
            showSuccess(t('已删除'));
            await fetchList();
          } else {
            showError(res.data?.message || t('删除失败'));
          }
        } catch (_) {}
      },
    });
  };

  // ── 绑定管理 ─────────────────────────────────────────

  // 取候选令牌：无关键词 → 列表第一页；有关键词 → 走搜索接口（突破 100 条分页上限）。
  const fetchTokenOptions = async (keyword) => {
    setTokenSearchLoading(true);
    try {
      const url = keyword
        ? `/api/token/search?keyword=${encodeURIComponent(keyword)}&p=1&page_size=100`
        : '/api/token?p=1&page_size=100';
      const res = await API.get(url);
      if (res.data?.success) {
        setTokenOptions(res.data.data?.items || []);
      }
    } catch (_) {
    } finally {
      setTokenSearchLoading(false);
    }
  };

  const handleTokenSearch = (input) => {
    if (tokenSearchTimerRef.current) clearTimeout(tokenSearchTimerRef.current);
    tokenSearchTimerRef.current = setTimeout(() => {
      fetchTokenOptions(String(input || '').trim());
    }, 300);
  };

  const openBind = async (row) => {
    setBindTarget(row);
    setTokenToBind(null);
    setBindVisible(true);
    setBindLoading(true);
    try {
      const [bRes] = await Promise.all([
        API.get(`/api/user/sub_account/${row.id}/bindings`),
        fetchTokenOptions(''),
      ]);
      setBindings(bRes.data?.success ? bRes.data.data || [] : []);
    } catch (_) {
    } finally {
      setBindLoading(false);
    }
  };

  const refreshBindings = async () => {
    if (!bindTarget) return;
    await openBind(bindTarget);
    await fetchList();
  };

  const doBind = async () => {
    if (!tokenToBind) {
      showError(t('请选择要绑定的令牌'));
      return;
    }
    try {
      const res = await API.post(
        `/api/user/sub_account/${bindTarget.id}/bind`,
        { token_id: tokenToBind },
      );
      if (res.data?.success) {
        showSuccess(t('绑定成功'));
        setTokenToBind(null);
        await refreshBindings();
      } else {
        showError(res.data?.message || t('绑定失败'));
      }
    } catch (_) {}
  };

  const doUnbind = async (tokenId) => {
    try {
      const res = await API.post(
        `/api/user/sub_account/${bindTarget.id}/unbind`,
        { token_id: tokenId },
      );
      if (res.data?.success) {
        showSuccess(t('已解绑'));
        await refreshBindings();
      } else {
        showError(res.data?.message || t('解绑失败'));
      }
    } catch (_) {}
  };

  const baseColumns = [
    { title: t('用户名'), dataIndex: 'username' },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v) => {
        const s = STATUS_TAG[v] || { text: '未知', color: 'grey' };
        return <Tag color={s.color}>{t(s.text)}</Tag>;
      },
    },
    {
      title: t('绑定令牌数'),
      dataIndex: 'binding_count',
      render: (v) => v || 0,
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      render: tsToText,
    },
    {
      title: t('最后使用时间'),
      dataIndex: 'last_used_time',
      render: tsToText,
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      fixed: 'right',
      width: 340,
      render: (_, row) => (
        <div className='flex flex-wrap gap-2'>
          <Button size='small' onClick={() => openBind(row)}>
            {t('管理绑定')}
          </Button>
          <Button size='small' theme='light' onClick={() => openPwd(row)}>
            {t('重置密码')}
          </Button>
          <Button
            size='small'
            type={row.status === 1 ? 'warning' : 'primary'}
            theme='light'
            onClick={() => toggleStatus(row)}
          >
            {row.status === 1 ? t('禁用') : t('启用')}
          </Button>
          <Button
            size='small'
            type='danger'
            theme='light'
            onClick={() => removeSub(row)}
          >
            {t('删除')}
          </Button>
        </div>
      ),
    },
  ];

  // 紧凑模式去掉操作列的 fixed，让表格铺满宽度（同用户管理）。
  // 用普通 const 而非 useMemo：baseColumns 本就每次 render 重算，且必须在任何条件 return
  // 之前（本组件在 isEnterpriseOwner 早返回之后），避免登录态刷新导致 hook 数量变化而崩页。
  const columns = !compactMode
    ? baseColumns
    : baseColumns.map((col) => {
        if (col.dataIndex === 'operate') {
          const { fixed, ...rest } = col;
          return rest;
        }
        return col;
      });

  const reachedLimit = list.length >= maxCount;

  return (
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type1'
        descriptionArea={
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
            <div className='flex items-center text-blue-500'>
              <Users size={16} className='mr-2' />
              <Text>{t('子账户管理')}</Text>
              <Tag color='blue' size='small' className='ml-2'>
                {t('企业专属')}
              </Tag>
            </div>
            <CompactModeToggle
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              t={t}
            />
          </div>
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
            <div className='flex gap-2 w-full md:w-auto order-2 md:order-1'>
              <Button
                className='w-full md:w-auto'
                size='small'
                disabled={reachedLimit}
                onClick={() => setCreateVisible(true)}
              >
                {t('创建子账户')}
              </Button>
            </div>
            <div className='flex items-center gap-2 order-1 md:order-2'>
              <Tag color={reachedLimit ? 'orange' : 'white'} size='large'>
                {t('子账户数量')}：{list.length} / {maxCount}
              </Tag>
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: activePage,
          pageSize,
          total: list.length,
          onPageChange: (p) => setActivePage(p),
          onPageSizeChange: (s) => {
            setPageSize(s);
            setActivePage(1);
          },
          isMobile,
          t,
        })}
        t={t}
      >
        <Text type='tertiary' size='small' className='block mb-3'>
          {t(
            '子账户为只读账户：可登录查看绑定令牌的用量数据，不能充值、不能管理令牌。令牌的消耗仍从本企业账户扣除。',
          )}
        </Text>
        <CardTable
          columns={columns}
          dataSource={pagedList}
          rowKey='id'
          loading={loading}
          hidePagination={true}
          scroll={compactMode ? undefined : { x: 'max-content' }}
          className='overflow-hidden'
          size='middle'
          empty={<Empty description={t('暂无子账户')} />}
        />
      </CardPro>

      {/* 创建子账户 */}
      <Modal
        title={t('创建子账户')}
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={submitCreate}
        okButtonProps={{ loading: createLoading }}
        okText={t('创建')}
        cancelText={t('取消')}
      >
        <div className='flex flex-col gap-3'>
          <div>
            <Text type='secondary' className='block mb-1'>
              {t('用户名')}
            </Text>
            <Input
              value={createForm.username}
              onChange={(v) => setCreateForm((f) => ({ ...f, username: v }))}
              maxLength={20}
              placeholder={t('登录用户名，全局唯一')}
            />
          </div>
          <div>
            <Text type='secondary' className='block mb-1'>
              {t('密码')}
            </Text>
            <Input
              mode='password'
              value={createForm.password}
              onChange={(v) => setCreateForm((f) => ({ ...f, password: v }))}
              maxLength={20}
              placeholder={t('8-20 位')}
            />
          </div>
        </div>
      </Modal>

      {/* 重置密码 */}
      <Modal
        title={t('重置密码')}
        visible={pwdVisible}
        onCancel={() => setPwdVisible(false)}
        onOk={submitPwd}
        okButtonProps={{ loading: pwdLoading }}
        okText={t('确认重置')}
        cancelText={t('取消')}
      >
        {pwdTarget && (
          <div className='flex flex-col gap-2'>
            <Text type='secondary'>
              {t('为子账户')} <Text strong>{pwdTarget.username}</Text>{' '}
              {t('设置新密码')}
            </Text>
            <Input
              mode='password'
              value={newPassword}
              onChange={setNewPassword}
              maxLength={20}
              placeholder={t('8-20 位')}
            />
          </div>
        )}
      </Modal>

      {/* 绑定管理 */}
      <Modal
        title={
          bindTarget
            ? `${t('管理绑定')} - ${bindTarget.username}`
            : t('管理绑定')
        }
        visible={bindVisible}
        onCancel={() => setBindVisible(false)}
        footer={null}
        width={960}
        bodyStyle={{ paddingBottom: 24 }}
      >
        <Spin spinning={bindLoading}>
          <div className='flex items-end gap-2 mb-4'>
            <div className='flex-1'>
              <Text type='secondary' className='block mb-1'>
                {t('选择要绑定的令牌')}
              </Text>
              <Select
                style={{ width: '100%' }}
                value={tokenToBind}
                onChange={setTokenToBind}
                placeholder={t('输入名称搜索本企业的令牌')}
                filter
                remote
                onSearch={handleTokenSearch}
                loading={tokenSearchLoading}
                emptyContent={t('无可绑定的令牌')}
              >
                {(() => {
                  // 已绑定给本子账户的在渲染期剔除（绑定给其他子账户的由后端唯一约束兜底拒绝）
                  const boundIds = new Set(bindings.map((b) => b.token_id));
                  return tokenOptions
                    .filter((tk) => !boundIds.has(tk.id))
                    .map((tk) => (
                      <Select.Option key={tk.id} value={tk.id}>
                        {tk.name || `#${tk.id}`}
                      </Select.Option>
                    ));
                })()}
              </Select>
            </div>
            <Button theme='solid' type='primary' onClick={doBind}>
              {t('绑定')}
            </Button>
          </div>

          <div className='flex items-center justify-between mb-2'>
            <Text strong>{t('已绑定令牌')}</Text>
            <Text type='tertiary' size='small'>
              {t('共')} {bindings.length} {t('个')}
            </Text>
          </div>
          {bindings.length === 0 ? (
            <Empty description={t('暂无绑定')} style={{ padding: '24px 0' }} />
          ) : (
            <div
              className='rounded-xl overflow-hidden'
              style={{ border: '1px solid var(--semi-color-border)' }}
            >
              <Table
                size='small'
                rowKey='id'
                pagination={false}
                dataSource={bindings}
                // 绑定数 ≤10 全展示；>10 限高约 10 行、其余滚动条查看，避免弹窗被拉很长
                scroll={{
                  x: 'max-content',
                  ...(bindings.length > 10 ? { y: 420 } : {}),
                }}
                onRow={(record) =>
                  record.status !== 1
                    ? {
                        style: {
                          background: 'var(--semi-color-disabled-border)',
                        },
                      }
                    : {}
                }
                columns={[
                  {
                    title: t('令牌名'),
                    dataIndex: 'token_name',
                    render: (v, r) => v || `#${r.token_id}`,
                  },
                  {
                    title: t('状态'),
                    dataIndex: 'status',
                    render: (v) => {
                      const s = TOKEN_STATUS_TAG[v] || {
                        text: '未知状态',
                        color: 'black',
                      };
                      return (
                        <Tag color={s.color} shape='circle' size='small'>
                          {t(s.text)}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: t('分组'),
                    dataIndex: 'group',
                    render: (v) =>
                      v === 'auto' ? (
                        <Tag color='white' shape='circle'>
                          {t('智能熔断')}
                        </Tag>
                      ) : (
                        v || t('默认')
                      ),
                  },
                  {
                    title: t('可用模型'),
                    dataIndex: 'model_limits',
                    render: (v, r) => {
                      if (!r.model_limits_enabled || !v) {
                        return (
                          <Tag color='white' shape='circle'>
                            {t('无限制')}
                          </Tag>
                        );
                      }
                      const models = String(v).split(',').filter(Boolean);
                      return (
                        <Tooltip content={models.join(', ')} position='top'>
                          <Tag color='blue' shape='circle'>
                            {models.length} {t('个模型')}
                          </Tag>
                        </Tooltip>
                      );
                    },
                  },
                  {
                    title: t('已用额度'),
                    key: 'used_quota',
                    dataIndex: 'used_quota',
                    render: (v) => renderQuota(v || 0),
                  },
                  {
                    title: t('剩余额度'),
                    key: 'remain_quota',
                    dataIndex: 'remain_quota',
                    render: (_, r) => {
                      if (r.unlimited_quota)
                        return (
                          <Tag color='white' shape='circle'>
                            {t('无限额度')}
                          </Tag>
                        );
                      const remain = parseInt(r.remain_quota) || 0;
                      const used = parseInt(r.used_quota) || 0;
                      const total = remain + used;
                      const percent = total > 0 ? (remain / total) * 100 : 0;
                      return `${renderQuota(remain)} (${percent.toFixed(0)}%)`;
                    },
                  },
                  {
                    title: t('总额度'),
                    key: 'total_quota',
                    render: (_, r) => {
                      if (r.unlimited_quota)
                        return (
                          <Tag color='white' shape='circle'>
                            {t('无限额度')}
                          </Tag>
                        );
                      const remain = parseInt(r.remain_quota) || 0;
                      const used = parseInt(r.used_quota) || 0;
                      return renderQuota(remain + used);
                    },
                  },
                  {
                    title: t('过期时间'),
                    dataIndex: 'expired_time',
                    render: (v) =>
                      v === -1 ? t('永不过期') : tsToText(v),
                  },
                  {
                    title: t('操作'),
                    dataIndex: 'op',
                    fixed: 'right',
                    align: 'right',
                    render: (_, r) => (
                      <Button
                        size='small'
                        type='danger'
                        theme='light'
                        onClick={() => doUnbind(r.token_id)}
                      >
                        {t('解绑')}
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default SubAccountPage;
