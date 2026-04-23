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

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
  renderQuota,
  getCurrencyConfig,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Modal,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Form,
  Avatar,
  Row,
  Col,
  RadioGroup,
  Radio,
  Select,
  InputNumber,
} from '@douyinfe/semi-ui';
import {
  IconCreditCard,
  IconSave,
  IconClose,
  IconGift,
  IconCrown,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const EditRedemptionModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingRedemption.id !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [showQuotaInput, setShowQuotaInput] = useState(false);

  const getInitValues = () => ({
    name: '',
    quota: 100000,
    amount: Number(quotaToDisplayAmount(100000).toFixed(6)),
    count: 1,
    expired_time: null,
    type: 1, // 1=余额充值, 2=订阅套餐, 3=联合兑换
    subscription_plan_id: 0,
    upgrade_group: '',
    upgrade_group_rollback: true,
  });

  const handleCancel = () => {
    props.handleClose();
  };

  const loadRedemption = async () => {
    setLoading(true);
    let res = await API.get(`/api/redemption/${props.editingRedemption.id}`);
    const { success, message, data } = res.data;
    if (success) {
      if (data.expired_time === 0) {
        data.expired_time = null;
      } else {
        data.expired_time = new Date(data.expired_time * 1000);
      }
      if (!data.type) {
        data.type = 1; // 默认为余额类型
      }
      data.amount = Number(quotaToDisplayAmount(data.quota || 0).toFixed(6));
      formApiRef.current?.setValues({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const loadSubscriptionPlans = async () => {
    try {
      const res = await API.get('/api/subscription/admin/plans');
      const { success, data } = res.data;
      if (success && data) {
        setSubscriptionPlans(data.map(item => ({
          value: item.plan.id,
          label: `${item.plan.title} - $${item.plan.price_amount}`,
        })));
      }
    } catch (error) {
      console.error('Failed to load subscription plans:', error);
    }
  };

  const loadGroupOptions = async () => {
    setGroupLoading(true);
    try {
      const res = await API.get('/api/group');
      if (res.data?.success) {
        setGroupOptions(res.data?.data || []);
      } else {
        setGroupOptions([]);
      }
    } catch {
      setGroupOptions([]);
    } finally {
      setGroupLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionPlans();
    loadGroupOptions();
  }, []);

  useEffect(() => {
    if (formApiRef.current) {
      if (isEdit) {
        loadRedemption();
      } else {
        formApiRef.current.setValues(getInitValues());
      }
    }
  }, [props.editingRedemption.id]);

  // 是否显示额度输入（type=1 或 type=3）
  const showQuota = (type) => type === 1 || type === 3;
  // 是否显示订阅套餐选择（type=2 或 type=3）
  const showSubscription = (type) => type === 2 || type === 3;
  // 是否显示升级分组（所有类型都支持）
  const showUpgradeGroup = (type) => type === 1 || type === 2 || type === 3;

  const submit = async (values) => {
    let name = values.name;
    if (!isEdit && (!name || name === '')) {
      if (values.type === 2) {
        const plan = subscriptionPlans.find(p => p.value === values.subscription_plan_id);
        name = plan ? `订阅-${plan.label}` : '订阅兑换码';
      } else if (values.type === 3) {
        const plan = subscriptionPlans.find(p => p.value === values.subscription_plan_id);
        name = plan ? `联合-${renderQuota(values.quota)}+${plan.label}` : renderQuota(values.quota);
      } else {
        name = renderQuota(values.quota);
      }
    }
    setLoading(true);
    let localInputs = { ...values };
    localInputs.count = parseInt(localInputs.count) || 0;
    localInputs.quota = displayAmountToQuota(localInputs.amount);
    // Skip quota validation for subscription type (type=2)
    if (localInputs.type !== 2 && localInputs.quota <= 0) {
      showError(t('请输入金额'));
      setLoading(false);
      return;
    }
    localInputs.name = name;
    localInputs.type = parseInt(localInputs.type) || 1;
    localInputs.subscription_plan_id = parseInt(localInputs.subscription_plan_id) || 0;
    localInputs.upgrade_group = localInputs.upgrade_group || '';
    // type=1 无订阅，不支持到期回退，强制 false
    if (localInputs.type === 1) {
      localInputs.upgrade_group_rollback = false;
    } else {
      localInputs.upgrade_group_rollback = !!localInputs.upgrade_group_rollback;
    }
    if (!localInputs.expired_time) {
      localInputs.expired_time = 0;
    } else {
      localInputs.expired_time = Math.floor(
        localInputs.expired_time.getTime() / 1000,
      );
    }
    let res;
    if (isEdit) {
      res = await API.put(`/api/redemption/`, {
        ...localInputs,
        id: parseInt(props.editingRedemption.id),
      });
    } else {
      res = await API.post(`/api/redemption/`, {
        ...localInputs,
      });
    }
    const { success, message, data } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('兑换码更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showSuccess(t('兑换码创建成功！'));
        props.refresh();
        formApiRef.current?.setValues(getInitValues());
        props.handleClose();
      }
    } else {
      showError(message);
    }
    if (!isEdit && data) {
      let text = '';
      for (let i = 0; i < data.length; i++) {
        text += data[i] + '\n';
      }
      Modal.confirm({
        title: t('兑换码创建成功'),
        content: (
          <div>
            <p>{t('兑换码创建成功，是否下载兑换码？')}</p>
            <p>{t('兑换码将以文本文件的形式下载，文件名为兑换码的名称。')}</p>
          </div>
        ),
        onOk: () => {
          downloadTextAsFile(text, `${localInputs.name}.txt`);
        },
      });
    }
    setLoading(false);
  };

  // 获取第二张卡片的标题和描述
  const getSettingsCardInfo = (type) => {
    if (type === 3) return { title: t('联合兑换设置'), desc: t('设置额度、订阅套餐和分组升级') };
    if (type === 2) return { title: t('订阅设置'), desc: t('选择要兑换的订阅套餐和分组升级') };
    return { title: t('额度设置'), desc: t('设置兑换码的额度和数量') };
  };

  return (
    <>
      <SideSheet
        placement={isEdit ? 'right' : 'left'}
        title={
          <Space>
            {isEdit ? (
              <Tag color='blue' shape='circle'>
                {t('更新')}
              </Tag>
            ) : (
              <Tag color='green' shape='circle'>
                {t('新建')}
              </Tag>
            )}
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新兑换码信息') : t('创建新的兑换码')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visiable}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={() => handleCancel()}
      >
        <Spin spinning={loading}>
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => {
              const cardInfo = getSettingsCardInfo(values.type);
              return (
                <div className='p-2'>
                  <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                    {/* Header: Basic Info */}
                    <div className='flex items-center mb-2'>
                      <Avatar
                        size='small'
                        color='blue'
                        className='mr-2 shadow-md'
                      >
                        <IconGift size={16} />
                      </Avatar>
                      <div>
                        <Text className='text-lg font-medium'>
                          {t('基本信息')}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {t('设置兑换码的基本信息')}
                        </div>
                      </div>
                    </div>

                    <Row gutter={12}>
                      <Col span={24}>
                        <Form.Input
                          field='name'
                          label={t('名称')}
                          placeholder={t('请输入名称')}
                          style={{ width: '100%' }}
                          rules={
                            !isEdit
                              ? []
                              : [{ required: true, message: t('请输入名称') }]
                          }
                          showClear
                        />
                      </Col>
                      <Col span={24}>
                        <Form.DatePicker
                          field='expired_time'
                          label={t('过期时间')}
                          type='dateTime'
                          placeholder={t('选择过期时间（可选，留空为永久）')}
                          style={{ width: '100%' }}
                          showClear
                        />
                      </Col>
                      <Col span={24}>
                        <Form.RadioGroup
                          field='type'
                          label={t('兑换码类型')}
                          type='button'
                          buttonSize='middle'
                          rules={[{ required: true, message: t('请选择兑换码类型') }]}
                        >
                          <Radio value={1}>{t('余额充值')}</Radio>
                          <Radio value={2}>{t('订阅套餐')}</Radio>
                          <Radio value={3}>{t('联合兑换')}</Radio>
                        </Form.RadioGroup>
                      </Col>
                    </Row>
                  </Card>

                  <Card className='!rounded-2xl shadow-sm border-0'>
                    {/* Header: Settings */}
                    <div className='flex items-center mb-2'>
                      <Avatar
                        size='small'
                        color='green'
                        className='mr-2 shadow-md'
                      >
                        {showSubscription(values.type) ? (
                          <IconCrown size={16} />
                        ) : (
                          <IconCreditCard size={16} />
                        )}
                      </Avatar>
                      <div>
                        <Text className='text-lg font-medium'>
                          {cardInfo.title}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {cardInfo.desc}
                        </div>
                      </div>
                    </div>

                    <Row gutter={12}>
                      {/* 额度输入：type=1 或 type=3 */}
                      {showQuota(values.type) && (
                        <Col span={24}>
                          <Form.InputNumber
                            field='amount'
                            label={t('金额')}
                            prefix={getCurrencyConfig().symbol}
                            placeholder={t('输入金额')}
                            precision={6}
                            min={0}
                            step={0.000001}
                            style={{ width: '100%' }}
                            onChange={(val) => {
                              const amount = val === '' || val == null ? 0 : val;
                              formApiRef.current?.setValue('amount', amount);
                              formApiRef.current?.setValue(
                                'quota',
                                displayAmountToQuota(amount),
                              );
                            }}
                            showClear
                          />
                          <div
                            className='text-xs cursor-pointer mt-1'
                            style={{ color: 'var(--semi-color-text-2)' }}
                            onClick={() => setShowQuotaInput((v) => !v)}
                          >
                            {showQuotaInput
                              ? `▾ ${t('收起原生额度输入')}`
                              : `▸ ${t('使用原生额度输入')}`}
                          </div>
                          <div style={{ display: showQuotaInput ? 'block' : 'none' }} className='mt-2'>
                            <Form.InputNumber
                              field='quota'
                              label={t('额度')}
                              placeholder={t('输入额度')}
                              rules={[
                                { required: true, message: t('请输入额度') },
                                {
                                  validator: (rule, v) => {
                                    const num = parseInt(v, 10);
                                    return num > 0
                                      ? Promise.resolve()
                                      : Promise.reject(t('额度必须大于0'));
                                  },
                                },
                              ]}
                              onChange={(val) => {
                                const quota = val === '' || val == null ? 0 : val;
                                formApiRef.current?.setValue('quota', quota);
                                formApiRef.current?.setValue(
                                  'amount',
                                  Number(quotaToDisplayAmount(quota).toFixed(6)),
                                );
                              }}
                              style={{ width: '100%' }}
                              showClear
                            />
                          </div>
                        </Col>
                      )}

                      {/* 订阅套餐选择：type=2 或 type=3 */}
                      {showSubscription(values.type) && (
                        <Col span={values.type === 3 ? 12 : 24}>
                          <Form.Select
                            field='subscription_plan_id'
                            label={t('订阅套餐')}
                            placeholder={t('请选择订阅套餐')}
                            style={{ width: '100%' }}
                            optionList={subscriptionPlans}
                            rules={[
                              {
                                required: true,
                                message: t('请选择订阅套餐'),
                              },
                            ]}
                            showClear
                          />
                        </Col>
                      )}

                      {/* 生成数量：仅新建时 */}
                      {!isEdit && (
                        <Col span={12}>
                          <Form.InputNumber
                            field='count'
                            label={t('生成数量')}
                            min={1}
                            rules={[
                              { required: true, message: t('请输入生成数量') },
                              {
                                validator: (rule, v) => {
                                  const num = parseInt(v, 10);
                                  return num > 0
                                    ? Promise.resolve()
                                    : Promise.reject(t('生成数量必须大于0'));
                                },
                              },
                            ]}
                            style={{ width: '100%' }}
                            showClear
                          />
                        </Col>
                      )}

                      {/* 升级分组：所有类型 */}
                      {showUpgradeGroup(values.type) && (
                        <Col span={12}>
                          <Form.Select
                            field='upgrade_group'
                            label={t('升级分组')}
                            showClear
                            loading={groupLoading}
                            placeholder={t('不升级')}
                            style={{ width: '100%' }}
                            extraText={t('兑换后将用户升级到该分组')}
                          >
                            <Select.Option value=''>{t('不升级')}</Select.Option>
                            {(groupOptions || []).map((g) => (
                              <Select.Option key={g} value={g}>
                                {g}
                              </Select.Option>
                            ))}
                          </Form.Select>
                        </Col>
                      )}

                      {/* 到期回退开关：upgrade_group 非空且 type=2 或 type=3 */}
                      {showUpgradeGroup(values.type) && values.upgrade_group && (values.type === 2 || values.type === 3) && (
                        <Col span={12}>
                          <Form.Switch
                            field='upgrade_group_rollback'
                            label={t('到期回退分组')}
                            extraText={t('开启后订阅到期时自动回退到原分组，关闭则永久升级')}
                          />
                        </Col>
                      )}
                    </Row>
                  </Card>
                </div>
              );
            }}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default EditRedemptionModal;
