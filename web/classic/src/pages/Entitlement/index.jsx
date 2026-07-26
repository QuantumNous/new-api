import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Modal,
  SideSheet,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';
import {
  displayAmountToQuota,
  quotaToDisplayAmount,
} from '../../helpers/quota';

const { Text, Title } = Typography;

const emptyPackage = {
  name: '',
  description: '',
  status: false,
  group: '',
  models: '',
  priority: 0,
  exclusive_models: true,
  start_time: 0,
  end_time: 0,
  daily_amount: 0,
  daily_request_limit: 0,
  total_amount: 0,
  total_request_limit: 0,
};

const parseDate = (value) => {
  if (!value || value === 0) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : Math.ceil(timestamp / 1000);
};

const displayDate = (value) => {
  if (!value || value <= 0) return undefined;
  return timestamp2string(value);
};

const EntitlementPage = () => {
  const { t } = useTranslation();
  const packageForm = useRef(null);
  const grantForm = useRef(null);
  const tokenForm = useRef(null);
  const assignmentForm = useRef(null);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState([]);
  const [editingPackage, setEditingPackage] = useState(null);
  const [showPackage, setShowPackage] = useState(false);
  const [grantPackage, setGrantPackage] = useState(null);
  const [showGrant, setShowGrant] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/entitlement/packages');
      if (res.data.success) {
        setPackages(res.data.data || []);
      } else {
        showError(t(res.data.message));
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const packageOptions = useMemo(
    () =>
      packages.map((item) => ({
        label: `${item.name}（${item.group}）`,
        value: item.id,
      })),
    [packages],
  );

  const openPackage = (item = null) => {
    setEditingPackage(item);
    setShowPackage(true);
    setTimeout(() => {
      const values = item
        ? {
            ...item,
            status: item.status === 1,
            exclusive_models: !item.allow_public_fallback,
            start_time: displayDate(item.start_time),
            end_time: displayDate(item.end_time),
            daily_amount: quotaToDisplayAmount(item.daily_quota || 0),
            total_amount: quotaToDisplayAmount(item.total_quota || 0),
          }
        : emptyPackage;
      packageForm.current?.setValues(values);
    }, 0);
  };

  const savePackage = async (values) => {
    const payload = {
      ...values,
      id: editingPackage?.id || 0,
      status: values.status ? 1 : 2,
      start_time: parseDate(values.start_time),
      end_time: parseDate(values.end_time),
      daily_quota: displayAmountToQuota(values.daily_amount || 0),
      total_quota: displayAmountToQuota(values.total_amount || 0),
      allow_public_fallback: !values.exclusive_models,
    };
    if (
      !payload.name?.trim() ||
      !payload.group?.trim() ||
      !payload.models?.trim()
    ) {
      showError(t('名称、绑定分组和模型列表不能为空'));
      return;
    }
    setLoading(true);
    try {
      const res = editingPackage
        ? await API.put('/api/entitlement/package', payload)
        : await API.post('/api/entitlement/package', payload);
      if (res.data.success) {
        showSuccess(t('权益包已保存'));
        setShowPackage(false);
        await loadPackages();
      } else {
        showError(t(res.data.message));
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveGrant = async (values) => {
    const userIds = String(values.user_ids || '')
      .split(/[\s,，]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
    if (userIds.length === 0) {
      showError(t('请输入至少一个用户 ID'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post(
        `/api/entitlement/package/${grantPackage.id}/users`,
        {
          user_ids: userIds,
          status: values.status ? 1 : 2,
          start_time: parseDate(values.start_time),
          end_time: parseDate(values.end_time),
        },
      );
      if (res.data.success) {
        showSuccess(t('用户授权已更新'));
        setShowGrant(false);
      } else {
        showError(t(res.data.message));
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createToken = async (values) => {
    setLoading(true);
    try {
      const res = await API.post('/api/entitlement/admin-token', {
        user_id: Number(values.user_id),
        name: values.name,
        package_ids: values.package_ids || [],
        expired_time: -1,
        unlimited_quota: values.unlimited_quota !== false,
        remain_quota:
          values.unlimited_quota === false
            ? displayAmountToQuota(values.remain_amount || 0)
            : 0,
        group: values.group || '',
      });
      if (res.data.success) {
        setCreatedToken(res.data.data);
        showSuccess(t('定向令牌已创建'));
      } else {
        showError(t(res.data.message));
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveAssignment = async (values) => {
    setLoading(true);
    try {
      const res = await API.post('/api/entitlement/token', {
        package_id: Number(values.package_id),
        token_id: Number(values.token_id),
        user_id: Number(values.user_id),
        status: values.status ? 1 : 2,
        start_time: parseDate(values.start_time),
        end_time: parseDate(values.end_time),
        daily_quota_override:
          values.inherit_daily_quota === false
            ? displayAmountToQuota(values.daily_amount || 0)
            : -1,
        daily_request_limit_override:
          values.inherit_daily_requests === false
            ? Number(values.daily_request_limit || 0)
            : -1,
        total_quota_override:
          values.inherit_total_quota === false
            ? displayAmountToQuota(values.total_amount || 0)
            : -1,
        total_request_limit_override:
          values.inherit_total_requests === false
            ? Number(values.total_request_limit || 0)
            : -1,
      });
      if (res.data.success) {
        showSuccess(t('令牌授权已更新'));
        setShowAssignment(false);
      } else {
        showError(t(res.data.message));
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: t('权益包'),
      render: (_, item) => (
        <div>
          <Text strong>{item.name}</Text>
          <div className='text-xs text-gray-500'>{item.description || '-'}</div>
        </div>
      ),
    },
    {
      title: t('状态'),
      render: (_, item) => (
        <Tag color={item.status === 1 ? 'green' : 'red'}>
          {item.status === 1 ? t('启用') : t('关闭')}
        </Tag>
      ),
    },
    { title: t('绑定分组'), dataIndex: 'group' },
    {
      title: t('模型'),
      render: (_, item) => (
        <div className='max-w-80 break-all text-xs'>{item.models}</div>
      ),
    },
    {
      title: t('安全阀'),
      render: (_, item) => (
        <div className='text-xs'>
          <div>
            {t('每日')}：
            {item.daily_quota > 0
              ? quotaToDisplayAmount(item.daily_quota)
              : t('不限')}
            {' / '}
            {item.daily_request_limit > 0
              ? `${item.daily_request_limit} ${t('次')}`
              : t('不限次数')}
          </div>
          <div>
            {t('总计')}：
            {item.total_quota > 0
              ? quotaToDisplayAmount(item.total_quota)
              : t('不限')}
            {' / '}
            {item.total_request_limit > 0
              ? `${item.total_request_limit} ${t('次')}`
              : t('不限次数')}
          </div>
        </div>
      ),
    },
    {
      title: t('操作'),
      fixed: 'right',
      render: (_, item) => (
        <Space>
          <Button size='small' onClick={() => openPackage(item)}>
            {t('编辑')}
          </Button>
          <Button
            size='small'
            onClick={() => {
              setGrantPackage(item);
              setShowGrant(true);
              setTimeout(
                () =>
                  grantForm.current?.setValues({
                    user_ids: '',
                    status: true,
                    start_time: undefined,
                    end_time: undefined,
                  }),
                0,
              );
            }}
          >
            {t('用户授权')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className='p-2'>
      <Card>
        <div className='flex flex-col md:flex-row justify-between gap-3 mb-4'>
          <div>
            <Title heading={4}>{t('定向权益包')}</Title>
            <Text type='tertiary'>
              {t('按用户和令牌精确开放模型、倍率分组、活动时间与安全限额')}
            </Text>
          </div>
          <Space wrap>
            <Button theme='solid' onClick={() => openPackage()}>
              {t('新建权益包')}
            </Button>
            <Button
              onClick={() => {
                setCreatedToken(null);
                setShowToken(true);
              }}
            >
              {t('为用户创建定向令牌')}
            </Button>
            <Button onClick={() => setShowAssignment(true)}>
              {t('调整已有令牌授权')}
            </Button>
          </Space>
        </div>
        <Table
          rowKey='id'
          columns={columns}
          dataSource={packages}
          loading={loading}
          pagination={false}
          scroll={{ x: 1100 }}
        />
      </Card>

      <SideSheet
        title={editingPackage ? t('编辑权益包') : t('新建权益包')}
        visible={showPackage}
        width={620}
        onCancel={() => setShowPackage(false)}
        footer={
          <Button
            theme='solid'
            loading={loading}
            onClick={() => packageForm.current?.submitForm()}
          >
            {t('保存')}
          </Button>
        }
      >
        <Form
          getFormApi={(api) => (packageForm.current = api)}
          onSubmit={savePackage}
        >
          <Form.Input field='name' label={t('名称')} />
          <Form.TextArea
            field='description'
            label={t('说明')}
            placeholder={t('面向管理员的活动说明')}
          />
          <Form.Switch field='status' label={t('启用')} initValue={false} />
          <Form.Input
            field='group'
            label={t('绑定分组')}
            placeholder={t('决定渠道和价格倍率的现有分组')}
          />
          <Form.TextArea
            field='models'
            label={t('模型列表')}
            placeholder='model-a,model-b'
            extraText={t('英文逗号分隔；这些模型会按此权益包进行授权校验')}
          />
          <Form.Switch
            field='exclusive_models'
            label={t('独占授权')}
            initValue
            extraText={t('开启后，未获此权益包授权的令牌不能调用上述模型')}
          />
          <Form.InputNumber field='priority' label={t('优先级')} min={0} />
          <Form.DatePicker
            field='start_time'
            type='dateTime'
            label={t('开始时间（可选）')}
          />
          <Form.DatePicker
            field='end_time'
            type='dateTime'
            label={t('结束时间（可选）')}
          />
          <Form.InputNumber
            field='daily_amount'
            label={t('每日金额上限（0 为不限）')}
            min={0}
            precision={6}
          />
          <Form.InputNumber
            field='daily_request_limit'
            label={t('每日请求次数（0 为不限）')}
            min={0}
          />
          <Form.InputNumber
            field='total_amount'
            label={t('活动总金额上限（0 为不限）')}
            min={0}
            precision={6}
          />
          <Form.InputNumber
            field='total_request_limit'
            label={t('活动总请求次数（0 为不限）')}
            min={0}
          />
        </Form>
      </SideSheet>

      <Modal
        title={`${t('用户授权')}：${grantPackage?.name || ''}`}
        visible={showGrant}
        onCancel={() => setShowGrant(false)}
        onOk={() => grantForm.current?.submitForm()}
        confirmLoading={loading}
      >
        <Form
          getFormApi={(api) => (grantForm.current = api)}
          onSubmit={saveGrant}
        >
          <Form.TextArea
            field='user_ids'
            label={t('用户 ID')}
            placeholder={t('支持逗号、空格或换行分隔')}
          />
          <Form.Switch field='status' label={t('启用授权')} initValue />
          <Form.DatePicker
            field='start_time'
            type='dateTime'
            label={t('单独开始时间（可选）')}
          />
          <Form.DatePicker
            field='end_time'
            type='dateTime'
            label={t('单独结束时间（可选）')}
          />
        </Form>
      </Modal>

      <Modal
        title={t('为用户创建定向令牌')}
        visible={showToken}
        onCancel={() => setShowToken(false)}
        onOk={() =>
          createdToken ? setShowToken(false) : tokenForm.current?.submitForm()
        }
        okText={createdToken ? t('完成') : t('创建')}
        confirmLoading={loading}
        width={560}
      >
        {createdToken ? (
          <div>
            <Text strong>
              {t('令牌只在这里完整显示一次，请立即复制保存：')}
            </Text>
            <Typography.Paragraph copyable code>
              sk-{createdToken.key}
            </Typography.Paragraph>
          </div>
        ) : (
          <Form
            getFormApi={(api) => (tokenForm.current = api)}
            onSubmit={createToken}
          >
            <Form.InputNumber
              field='user_id'
              label={t('目标用户 ID')}
              min={1}
            />
            <Form.Input field='name' label={t('令牌名称')} />
            <Form.Select
              field='package_ids'
              label={t('权益包')}
              multiple
              optionList={packageOptions}
              style={{ width: '100%' }}
            />
            <Form.Switch
              field='unlimited_quota'
              label={t('令牌本身无限额度')}
              initValue
            />
            <Form.InputNumber
              field='remain_amount'
              label={t('令牌总金额（关闭无限额度时填写）')}
              min={0}
              precision={6}
            />
            <Form.Input
              field='group'
              label={t('公开模型分组（可选）')}
              extraText={t(
                '留空则使用用户默认分组；权益模型自动使用权益包绑定分组',
              )}
            />
          </Form>
        )}
      </Modal>

      <Modal
        title={t('调整已有令牌授权')}
        visible={showAssignment}
        onCancel={() => setShowAssignment(false)}
        onOk={() => assignmentForm.current?.submitForm()}
        confirmLoading={loading}
        width={600}
      >
        <Form
          getFormApi={(api) => (assignmentForm.current = api)}
          onSubmit={saveAssignment}
        >
          <Form.InputNumber field='user_id' label={t('用户 ID')} min={1} />
          <Form.InputNumber field='token_id' label={t('令牌 ID')} min={1} />
          <Form.Select
            field='package_id'
            label={t('权益包')}
            optionList={packageOptions}
            style={{ width: '100%' }}
          />
          <Form.Switch field='status' label={t('启用令牌授权')} initValue />
          <Form.DatePicker
            field='start_time'
            type='dateTime'
            label={t('单独开始时间（可选）')}
          />
          <Form.DatePicker
            field='end_time'
            type='dateTime'
            label={t('单独结束时间（可选）')}
          />
          <Form.Switch
            field='inherit_daily_quota'
            label={t('每日金额继承权益包')}
            initValue
          />
          <Form.InputNumber
            field='daily_amount'
            label={t('每日金额覆盖（0 为不限）')}
            min={0}
            precision={6}
          />
          <Form.Switch
            field='inherit_daily_requests'
            label={t('每日次数继承权益包')}
            initValue
          />
          <Form.InputNumber
            field='daily_request_limit'
            label={t('每日次数覆盖（0 为不限）')}
            min={0}
          />
          <Form.Switch
            field='inherit_total_quota'
            label={t('总金额继承权益包')}
            initValue
          />
          <Form.InputNumber
            field='total_amount'
            label={t('总金额覆盖（0 为不限）')}
            min={0}
            precision={6}
          />
          <Form.Switch
            field='inherit_total_requests'
            label={t('总次数继承权益包')}
            initValue
          />
          <Form.InputNumber
            field='total_request_limit'
            label={t('总次数覆盖（0 为不限）')}
            min={0}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default EntitlementPage;
