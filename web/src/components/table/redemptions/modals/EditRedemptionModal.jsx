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

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  downloadTextAsFile,
  showError,
  showSuccess,
  renderQuota,
  renderQuotaWithPrompt,
} from '../../../../helpers';
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
} from '@douyinfe/semi-ui';
import {
  IconCreditCard,
  IconSave,
  IconClose,
  IconGift,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const MAX_COUNT = 100;

const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const num = Number.parseInt(String(v), 10);
  return Number.isFinite(num) ? num : null;
};

const EditRedemptionModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingRedemption.id !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);

  const getInitValues = () => ({
    name: '',
    quota: 100000,
    count: 1,
    expired_time: null,
    key_prefix: '',
    random_quota_enabled: false,
    quota_min: '',
    quota_max: '',
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
      formApiRef.current?.setValues({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (formApiRef.current) {
      if (isEdit) {
        loadRedemption();
      } else {
        formApiRef.current.setValues(getInitValues());
      }
    }
  }, [props.editingRedemption.id]);

  const validateRandomQuotaMode = (values) => {
    const min = toIntOrNull(values.quota_min);
    const max = toIntOrNull(values.quota_max);

    if (min === null || max === null) {
      return t('随机额度模式下 quota_min 和 quota_max 必填');
    }
    if (min <= 0 || max <= 0) {
      return t('quota_min 和 quota_max 必须大于 0');
    }
    if (min > max) {
      return t('quota_min 必须小于等于 quota_max');
    }
    return null;
  };

  const submit = async (values) => {
    const randomQuotaEnabled = !isEdit && !!values.random_quota_enabled;

    let name = values.name;
    if (!isEdit && (!name || name === '')) {
      if (randomQuotaEnabled) {
        const min = toIntOrNull(values.quota_min);
        const max = toIntOrNull(values.quota_max);
        name = `${renderQuota(min)} ~ ${renderQuota(max)}`;
      } else {
        name = renderQuota(values.quota);
      }
    }

    const count = toIntOrNull(values.count) ?? 1;

    if (!isEdit && randomQuotaEnabled) {
      const msg = validateRandomQuotaMode(values);
      if (msg) {
        showError(msg);
        return;
      }
    }

    if (!isEdit && count > MAX_COUNT) {
      showError(t('生成数量上限为 100'));
      return;
    }

    setLoading(true);

    let localInputs = {
      name: name,
      count: count,
      expired_time: 0,
      key_prefix: (values.key_prefix || '').trim(),
    };

    if (values.expired_time) {
      localInputs.expired_time = Math.floor(
        values.expired_time.getTime() / 1000,
      );
    }

    if (isEdit) {
      localInputs.quota = toIntOrNull(values.quota) || 0;
    } else if (randomQuotaEnabled) {
      localInputs.random_quota_enabled = true;
      localInputs.quota_min = toIntOrNull(values.quota_min);
      localInputs.quota_max = toIntOrNull(values.quota_max);
    } else {
      localInputs.quota = toIntOrNull(values.quota) || 0;
    }

    let res;
    if (isEdit) {
      res = await API.put(`/api/redemption/`, {
        ...localInputs,
        id: parseInt(props.editingRedemption.id),
      });
    } else {
      res = await API.post(`/api/redemption/`, localInputs);
    }

    const { success, message, data, keys } = res.data;

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

    const downloadList = Array.isArray(keys)
      ? keys
      : Array.isArray(data)
        ? data
        : null;

    if (!isEdit && downloadList && downloadList.length > 0) {
      const text = downloadList.map((k) => `${k}\n`).join('');
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
            {({ values }) => (
              <div className='p-2'>
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
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
                        placeholder={t('请输入名称（留空自动生成）')}
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
                    {!isEdit && (
                      <Col span={24}>
                        <Form.Input
                          field='key_prefix'
                          label={t('Key 前缀')}
                          placeholder={t('可选，如 VIP-、GIFT-')}
                          style={{ width: '100%' }}
                          showClear
                          extraText={t('生成的兑换码将以此前缀开头')}
                        />
                      </Col>
                    )}
                  </Row>
                </Card>

                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='green'
                      className='mr-2 shadow-md'
                    >
                      <IconCreditCard size={16} />
                    </Avatar>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <Text className='text-lg font-medium'>
                          {t('额度设置')}
                        </Text>
                        {!isEdit && values.random_quota_enabled ? (
                          <Tag color='orange' shape='circle'>
                            {t('随机额度')}
                          </Tag>
                        ) : (
                          <Tag color='blue' shape='circle'>
                            {t('固定额度')}
                          </Tag>
                        )}
                      </div>
                      <div className='text-xs text-gray-600'>
                        {!isEdit && values.random_quota_enabled
                          ? t('每个兑换码的额度将在指定区间内随机生成')
                          : t('所有兑换码使用相同的固定额度')}
                      </div>
                    </div>
                    {!isEdit && (
                      <Form.Switch
                        field='random_quota_enabled'
                        checked={!!values.random_quota_enabled}
                        onChange={(v) => {
                          formApiRef.current?.setValue('random_quota_enabled', !!v);
                        }}
                      />
                    )}
                  </div>

                  <Row gutter={12}>
                    {!isEdit && values.random_quota_enabled ? (
                      <>
                        <Col span={12}>
                          <Form.AutoComplete
                            field='quota_min'
                            label={t('最小额度')}
                            placeholder={t('请输入最小额度')}
                            style={{ width: '100%' }}
                            type='number'
                            rules={[
                              { required: true, message: t('请输入最小额度') },
                              {
                                validator: (rule, v) => {
                                  const num = parseInt(v, 10);
                                  return num > 0
                                    ? Promise.resolve()
                                    : Promise.reject(t('额度必须大于0'));
                                },
                              },
                            ]}
                            extraText={renderQuotaWithPrompt(
                              Number(values.quota_min) || 0,
                            )}
                            data={[
                              { value: 500000, label: '1元' },
                              { value: 5000000, label: '10元' },
                              { value: 25000000, label: '50元' },
                            ]}
                            showClear
                          />
                        </Col>
                        <Col span={12}>
                          <Form.AutoComplete
                            field='quota_max'
                            label={t('最大额度')}
                            placeholder={t('请输入最大额度')}
                            style={{ width: '100%' }}
                            type='number'
                            rules={[
                              { required: true, message: t('请输入最大额度') },
                              {
                                validator: (rule, v) => {
                                  const num = parseInt(v, 10);
                                  return num > 0
                                    ? Promise.resolve()
                                    : Promise.reject(t('额度必须大于0'));
                                },
                              },
                            ]}
                            extraText={renderQuotaWithPrompt(
                              Number(values.quota_max) || 0,
                            )}
                            data={[
                              { value: 5000000, label: '10元' },
                              { value: 50000000, label: '100元' },
                              { value: 500000000, label: '1000元' },
                            ]}
                            showClear
                          />
                        </Col>
                      </>
                    ) : (
                      <Col span={12}>
                        <Form.AutoComplete
                          field='quota'
                          label={t('额度')}
                          placeholder={t('请输入额度')}
                          style={{ width: '100%' }}
                          type='number'
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
                          extraText={renderQuotaWithPrompt(
                            Number(values.quota) || 0,
                          )}
                          data={[
                            { value: 500000, label: '1元' },
                            { value: 5000000, label: '10元' },
                            { value: 25000000, label: '50元' },
                            { value: 50000000, label: '100元' },
                            { value: 250000000, label: '500元' },
                            { value: 500000000, label: '1000元' },
                          ]}
                          showClear
                        />
                      </Col>
                    )}

                    {!isEdit && (
                      <Col span={12}>
                        <Form.InputNumber
                          field='count'
                          label={t('生成数量')}
                          min={1}
                          max={MAX_COUNT}
                          rules={[
                            { required: true, message: t('请输入生成数量') },
                            {
                              validator: (rule, v) => {
                                const num = parseInt(v, 10);
                                if (!Number.isFinite(num) || num <= 0) {
                                  return Promise.reject(t('生成数量必须大于0'));
                                }
                                if (num > MAX_COUNT) {
                                  return Promise.reject(
                                    t('生成数量上限为 100'),
                                  );
                                }
                                return Promise.resolve();
                              },
                            },
                          ]}
                          style={{ width: '100%' }}
                          extraText={t('单次最多生成 100 个')}
                          showClear
                        />
                      </Col>
                    )}
                  </Row>
                </Card>
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default EditRedemptionModal;
