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

const RANDOM_COUNT_LIMIT = 100000;
const UUID_COUNT_LIMIT = 100;

const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const num = Number.parseInt(String(v), 10);
  return Number.isFinite(num) ? num : null;
};

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const buildRandomPreview = (values) => {
  const prefix = isNonEmptyString(values?.random_prefix)
    ? values.random_prefix.trim()
    : '';

  const min = toIntOrNull(values?.random_min);
  const max = toIntOrNull(values?.random_max);

  const uuidCount = toIntOrNull(values?.count) ?? 0;
  const randomCount = toIntOrNull(values?.random_count);
  const quantity = randomCount ?? uuidCount;

  const capacity = min !== null && max !== null && max >= min ? max - min + 1 : null;

  return { prefix, min, max, quantity, capacity };
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

    random_enabled: false,
    random_prefix: '',
    random_min: '',
    random_max: '',
    random_count: '',
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

  const validateRandomMode = (values) => {
    const min = toIntOrNull(values.random_min);
    const max = toIntOrNull(values.random_max);
    const uuidCount = toIntOrNull(values.count);
    const randomCount = toIntOrNull(values.random_count);

    if (min === null || max === null) {
      return t('随机模式下 random_min 和 random_max 必填，且必须为整数');
    }
    if (min > max) {
      return t('随机模式下 random_min 必须小于等于 random_max');
    }

    const capacity = max - min + 1;
    const quantity = (randomCount ?? uuidCount) ?? 0;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return t('生成数量必须大于 0');
    }
    if (quantity > RANDOM_COUNT_LIMIT) {
      return t('随机生成数量上限为 100000');
    }
    if (capacity < quantity) {
      return t('区间容量不足：请扩大 random_min ~ random_max 或减少生成数量');
    }
    return null;
  };

  const submit = async (values) => {
    const randomEnabled = !isEdit && !!values.random_enabled;

    let name = values.name;
    if (!isEdit && (!name || name === '')) {
      name = renderQuota(values.quota);
    }

    const uuidCount = toIntOrNull(values.count) ?? 0;

    if (!isEdit && randomEnabled) {
      const msg = validateRandomMode(values);
      if (msg) {
        showError(msg);
        return;
      }
    }

    if (!isEdit && !randomEnabled) {
      if (uuidCount > UUID_COUNT_LIMIT) {
        showError(t('非随机模式下生成数量上限为 100'));
        return;
      }
    }

    setLoading(true);

    let localInputs = { ...values };
    localInputs.count = uuidCount;
    localInputs.quota = toIntOrNull(localInputs.quota) || 0;
    localInputs.name = name;

    if (!localInputs.expired_time) {
      localInputs.expired_time = 0;
    } else {
      localInputs.expired_time = Math.floor(
        localInputs.expired_time.getTime() / 1000,
      );
    }

    if (isEdit) {
      delete localInputs.random_enabled;
    } else {
      // Keep backward compatibility with servers that require random_enabled
      localInputs.random_enabled = randomEnabled;
    }

    if (!isEdit && randomEnabled) {
      const randomMin = toIntOrNull(values.random_min);
      const randomMax = toIntOrNull(values.random_max);
      const randomCount = toIntOrNull(values.random_count);
      const randomPrefix = isNonEmptyString(values.random_prefix)
        ? values.random_prefix.trim()
        : '';

      localInputs.random_min = randomMin;
      localInputs.random_max = randomMax;

      if (randomCount !== null) {
        localInputs.random_count = randomCount;
      } else {
        delete localInputs.random_count;
      }

      if (randomPrefix) {
        localInputs.random_prefix = randomPrefix;
      } else {
        delete localInputs.random_prefix;
      }
    } else {
      delete localInputs.random_min;
      delete localInputs.random_max;
      delete localInputs.random_count;
      delete localInputs.random_prefix;
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
                  </Row>
                </Card>

                <Card className='!rounded-2xl shadow-sm border-0'>
                  {/* Header: Quota Settings */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='green'
                      className='mr-2 shadow-md'
                    >
                      <IconCreditCard size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('额度设置')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('设置兑换码的额度和数量')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
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
                          { value: 500000, label: '1$' },
                          { value: 5000000, label: '10$' },
                          { value: 25000000, label: '50$' },
                          { value: 50000000, label: '100$' },
                          { value: 250000000, label: '500$' },
                          { value: 500000000, label: '1000$' },
                        ]}
                        showClear
                      />
                    </Col>

                    {!isEdit && (
                      <Col span={12}>
                        <Form.InputNumber
                          field='count'
                          label={t('UUID 模式生成数量')}
                          min={1}
                          rules={[
                            { required: true, message: t('请输入生成数量') },
                            {
                              validator: (rule, v) => {
                                const num = parseInt(v, 10);
                                if (!Number.isFinite(num) || num <= 0) {
                                  return Promise.reject(t('生成数量必须大于0'));
                                }
                                if (num > UUID_COUNT_LIMIT) {
                                  return Promise.reject(
                                    t('非随机模式下生成数量上限为 100'),
                                  );
                                }
                                return Promise.resolve();
                              },
                            },
                          ]}
                          style={{ width: '100%' }}
                          showClear
                        />
                      </Col>
                    )}
                  </Row>
                </Card>

                {!isEdit && (
                  <Card className='!rounded-2xl shadow-sm border-0 mt-6'>
                    <div className='flex items-center mb-2'>
                      <Avatar
                        size='small'
                        color={values.random_enabled ? 'orange' : 'blue'}
                        className='mr-2 shadow-md'
                      >
                        <IconGift size={16} />
                      </Avatar>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <Text className='text-lg font-medium'>
                            {t('生成方式')}
                          </Text>
                          {values.random_enabled ? (
                            <Tag color='orange' shape='circle'>
                              {t('随机模式')}
                            </Tag>
                          ) : (
                            <Tag color='blue' shape='circle'>
                              {t('UUID 模式')}
                            </Tag>
                          )}
                        </div>
                        <div className='text-xs text-gray-600'>
                          {values.random_enabled
                            ? t(
                                '随机模式：在区间内生成不重复数字并拼接前缀',
                              )
                            : t('UUID 模式：生成随机 UUID 兑换码')}
                        </div>
                      </div>
                      <Form.Switch
                        field='random_enabled'
                        checked={!!values.random_enabled}
                        onChange={(v) => {
                          formApiRef.current?.setValue('random_enabled', !!v);
                        }}
                        extraText={t('随机生成')}
                      />
                    </div>

                    {values.random_enabled && (
                      <Row gutter={12}>
                        <Col span={24}>
                          <Form.Input
                            field='random_prefix'
                            label={t('random_prefix（可选）')}
                            placeholder={t('例如：VIP- 或 RAD-')}
                            style={{ width: '100%' }}
                            showClear
                          />
                        </Col>

                        <Col span={12}>
                          <Form.InputNumber
                            field='random_min'
                            label={t('random_min')}
                            min={0}
                            rules={[
                              {
                                required: true,
                                message: t('请输入 random_min'),
                              },
                              {
                                validator: (rule, v) => {
                                  const num = toIntOrNull(v);
                                  return num === null
                                    ? Promise.reject(t('必须为整数'))
                                    : Promise.resolve();
                                },
                              },
                            ]}
                            style={{ width: '100%' }}
                            showClear
                          />
                        </Col>

                        <Col span={12}>
                          <Form.InputNumber
                            field='random_max'
                            label={t('random_max')}
                            min={0}
                            rules={[
                              {
                                required: true,
                                message: t('请输入 random_max'),
                              },
                              {
                                validator: (rule, v) => {
                                  const num = toIntOrNull(v);
                                  return num === null
                                    ? Promise.reject(t('必须为整数'))
                                    : Promise.resolve();
                                },
                              },
                            ]}
                            style={{ width: '100%' }}
                            showClear
                          />
                        </Col>

                        <Col span={24}>
                          <Form.InputNumber
                            field='random_count'
                            label={t('random_count（可选）')}
                            min={1}
                            rules={[
                              {
                                validator: (rule, v) => {
                                  if (v === '' || v === null || v === undefined) {
                                    return Promise.resolve();
                                  }
                                  const num = toIntOrNull(v);
                                  if (num === null || num <= 0) {
                                    return Promise.reject(t('必须为正整数'));
                                  }
                                  if (num > RANDOM_COUNT_LIMIT) {
                                    return Promise.reject(
                                      t('随机生成数量上限为 100000'),
                                    );
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                            style={{ width: '100%' }}
                            extraText={
                              <div className='text-xs text-gray-600'>
                                <div>
                                  {t('优先使用 random_count，否则回退 UUID 模式生成数量')}
                                </div>
                                <div>
                                  {t('上限：')} {RANDOM_COUNT_LIMIT}
                                </div>
                                {(() => {
                                  const preview = buildRandomPreview(values);
                                  return (
                                    <div>
                                      {t('生成数量：')}
                                      {preview.quantity || '-'}，{t('区间容量：')}
                                      {preview.capacity ?? '-'}，{t('前缀预览：')}
                                      {preview.prefix
                                        ? `${preview.prefix}${preview.min ?? ''}`
                                        : `${preview.min ?? ''}`}
                                    </div>
                                  );
                                })()}
                              </div>
                            }
                            showClear
                          />
                        </Col>
                      </Row>
                    )}
                  </Card>
                )}
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default EditRedemptionModal;
