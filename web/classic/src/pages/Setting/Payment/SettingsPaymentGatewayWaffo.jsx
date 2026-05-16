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
import {
  Banner,
  Button,
  Form,
  Row,
  Col,
  Typography,
  Spin,
  Table,
  Modal,
  Input,
  Space,
} from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { BookOpen, TriangleAlert } from 'lucide-react';

const { Text } = Typography;
const toBoolean = (value) => value === true || value === 'true';

export default function SettingsPaymentGatewayWaffo(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Waffo 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    WaffoEnabled: false,
    WaffoApiKey: '',
    WaffoPrivateKey: '',
    WaffoPublicCert: '',
    WaffoSandboxPublicCert: '',
    WaffoSandboxApiKey: '',
    WaffoSandboxPrivateKey: '',
    WaffoSandbox: false,
    WaffoMerchantId: '',
    WaffoCurrency: 'USD',
    WaffoUnitPrice: 1.0,
    WaffoMinTopUp: 1,
    WaffoNotifyUrl: '',
    WaffoReturnUrl: '',
  });
  const formApiRef = useRef(null);
  const iconFileInputRef = useRef(null);

  const handleIconFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const MAX_ICON_SIZE = 100 * 1024; // 100 KB
    if (file.size > MAX_ICON_SIZE) {
      showError(t('图标文件不能超过 100KB，请压缩后重新上传'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPayMethodForm((prev) => ({ ...prev, icon: event.target.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 支付方式列表
  const [waffoPayMethods, setWaffoPayMethods] = useState([]);
  // 支付方式弹窗
  const [payMethodModalVisible, setPayMethodModalVisible] = useState(false);
  // 当前编辑的索引，-1 表示新增
  const [editingPayMethodIndex, setEditingPayMethodIndex] = useState(-1);
  // 弹窗内表单字段的临时状态
  const [payMethodForm, setPayMethodForm] = useState({
    name: '',
    icon: '',
    payMethodType: '',
    payMethodName: '',
  });

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        WaffoEnabled: toBoolean(props.options.WaffoEnabled),
        WaffoApiKey: props.options.WaffoApiKey || '',
        WaffoPrivateKey: props.options.WaffoPrivateKey || '',
        WaffoPublicCert: props.options.WaffoPublicCert || '',
        WaffoSandboxPublicCert: props.options.WaffoSandboxPublicCert || '',
        WaffoSandboxApiKey: props.options.WaffoSandboxApiKey || '',
        WaffoSandboxPrivateKey: props.options.WaffoSandboxPrivateKey || '',
        WaffoSandbox: toBoolean(props.options.WaffoSandbox),
        WaffoMerchantId: props.options.WaffoMerchantId || '',
        WaffoCurrency: props.options.WaffoCurrency || 'USD',
        WaffoUnitPrice: parseFloat(props.options.WaffoUnitPrice) || 1.0,
        WaffoMinTopUp: parseInt(props.options.WaffoMinTopUp) || 1,
        WaffoNotifyUrl: props.options.WaffoNotifyUrl || '',
        WaffoReturnUrl: props.options.WaffoReturnUrl || '',
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);

      // 解析支付方式列表
      try {
        const rawPayMethods = props.options.WaffoPayMethods;
        if (rawPayMethods) {
          const parsed = JSON.parse(rawPayMethods);
          if (Array.isArray(parsed)) {
            setWaffoPayMethods(parsed);
          }
        }
      } catch {
        setWaffoPayMethods([]);
      }
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitWaffoSetting = async () => {
    setLoading(true);
    try {
      const options = [];

      options.push({
        key: 'WaffoEnabled',
        value: inputs.WaffoEnabled ? 'true' : 'false',
      });

      if (inputs.WaffoApiKey && inputs.WaffoApiKey !== '') {
        options.push({ key: 'WaffoApiKey', value: inputs.WaffoApiKey });
      }

      if (inputs.WaffoPrivateKey && inputs.WaffoPrivateKey !== '') {
        options.push({ key: 'WaffoPrivateKey', value: inputs.WaffoPrivateKey });
      }

      options.push({
        key: 'WaffoPublicCert',
        value: inputs.WaffoPublicCert || '',
      });
      options.push({
        key: 'WaffoSandboxPublicCert',
        value: inputs.WaffoSandboxPublicCert || '',
      });

      if (inputs.WaffoSandboxApiKey && inputs.WaffoSandboxApiKey !== '') {
        options.push({
          key: 'WaffoSandboxApiKey',
          value: inputs.WaffoSandboxApiKey,
        });
      }

      if (
        inputs.WaffoSandboxPrivateKey &&
        inputs.WaffoSandboxPrivateKey !== ''
      ) {
        options.push({
          key: 'WaffoSandboxPrivateKey',
          value: inputs.WaffoSandboxPrivateKey,
        });
      }

      options.push({
        key: 'WaffoSandbox',
        value: inputs.WaffoSandbox ? 'true' : 'false',
      });

      options.push({
        key: 'WaffoMerchantId',
        value: inputs.WaffoMerchantId || '',
      });
      options.push({ key: 'WaffoCurrency', value: inputs.WaffoCurrency || '' });

      options.push({
        key: 'WaffoUnitPrice',
        value: String(inputs.WaffoUnitPrice || 1.0),
      });

      options.push({
        key: 'WaffoMinTopUp',
        value: String(inputs.WaffoMinTopUp || 1),
      });

      options.push({
        key: 'WaffoNotifyUrl',
        value: inputs.WaffoNotifyUrl || '',
      });
      options.push({
        key: 'WaffoReturnUrl',
        value: inputs.WaffoReturnUrl || '',
      });

      // 保存支付方式列表
      options.push({
        key: 'WaffoPayMethods',
        value: JSON.stringify(waffoPayMethods),
      });

      // 发送请求
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  // 打开新增弹窗
  const openAddPayMethodModal = () => {
    setEditingPayMethodIndex(-1);
    setPayMethodForm({
      name: '',
      icon: '',
      payMethodType: '',
      payMethodName: '',
    });
    setPayMethodModalVisible(true);
  };

  // 打开编辑弹窗
  const openEditPayMethodModal = (record, index) => {
    setEditingPayMethodIndex(index);
    setPayMethodForm({
      name: record.name || '',
      icon: record.icon || '',
      payMethodType: record.payMethodType || '',
      payMethodName: record.payMethodName || '',
    });
    setPayMethodModalVisible(true);
  };

  // 确认保存弹窗（新增或编辑）
  const handlePayMethodModalOk = () => {
    if (!payMethodForm.name || payMethodForm.name.trim() === '') {
      showError(t('支付方式名称不能为空'));
      return;
    }
    const newMethod = {
      name: payMethodForm.name.trim(),
      icon: payMethodForm.icon.trim(),
      payMethodType: payMethodForm.payMethodType.trim(),
      payMethodName: payMethodForm.payMethodName.trim(),
    };
    if (editingPayMethodIndex === -1) {
      // 新增
      setWaffoPayMethods([...waffoPayMethods, newMethod]);
    } else {
      // 编辑
      const updated = [...waffoPayMethods];
      updated[editingPayMethodIndex] = newMethod;
      setWaffoPayMethods(updated);
    }
    setPayMethodModalVisible(false);
  };

  // 删除支付方式
  const handleDeletePayMethod = (index) => {
    const updated = waffoPayMethods.filter((_, i) => i !== index);
    setWaffoPayMethods(updated);
  };

  // 支付方式表格列定义
  const payMethodColumns = [
    {
      title: t('显示名称'),
      dataIndex: 'name',
    },
    {
      title: t('图标'),
      dataIndex: 'icon',
      render: (text) =>
        text ? (
          <img
            src={text}
            alt='icon'
            style={{ width: 24, height: 24, objectFit: 'contain' }}
          />
        ) : (
          <Text type='tertiary'>—</Text>
        ),
    },
    {
      title: t('支付方式类型'),
      dataIndex: 'payMethodType',
      render: (text) => text || <Text type='tertiary'>—</Text>,
    },
    {
      title: t('支付方式名称'),
      dataIndex: 'payMethodName',
      render: (text) => text || <Text type='tertiary'>—</Text>,
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record, index) => (
        <Space>
          <Button
            size='small'
            onClick={() => openEditPayMethodModal(record, index)}
          >
            {t('编辑')}
          </Button>
          <Button
            size='small'
            type='danger'
            onClick={() => handleDeletePayMethod(index)}
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                Waffo 密钥、商户和支付方式等设置请
                <a href='https://waffo.com' target='_blank' rel='noreferrer'>
                  点击此处
                </a>
                进行配置，切换沙盒模式时请同步填写对应环境的密钥。
                <br />
                {t('回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/waffo/webhook
              </>
            }
            style={{ marginBottom: 12 }}
          />
          <Banner
            type='warning'
            icon={<TriangleAlert size={16} />}
            description={t('请确认商户和所选环境密钥一致。')}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='WaffoEnabled'
                label={t('启用 Waffo')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='WaffoSandbox'
                label={t('沙盒模式')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                extraText={t('用于切换当前下单和回调校验所使用的环境')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WaffoMerchantId'
                label={t('商户 ID')}
                placeholder={t('例如：MER_xxx')}
                extraText={t('当前环境共用同一商户 ID')}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WaffoApiKey'
                label={t('API 密钥（生产环境）')}
                placeholder={t(
                  '填写后覆盖当前生产环境 API 密钥，留空表示保持当前不变',
                )}
                extraText={t('保存后不会回显，请填写生产环境对应的 API 密钥')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='WaffoPrivateKey'
                label={t('API 私钥（生产环境）')}
                placeholder={t(
                  '填写后覆盖当前生产环境私钥，留空表示保持当前不变',
                )}
                extraText={t('保存后不会回显，请填写生产环境对应的 API 私钥')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='WaffoPublicCert'
                label={t('Waffo 公钥（生产环境）')}
                placeholder={t(
                  '填写生产环境 Waffo 公钥，Base64 或 PEM 内容均可',
                )}
                extraText={t('用于校验生产环境的 Waffo 回调签名')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WaffoSandboxApiKey'
                label={t('API 密钥（测试环境）')}
                placeholder={t(
                  '填写后覆盖当前测试环境 API 密钥，留空表示保持当前不变',
                )}
                extraText={t('保存后不会回显，请填写测试环境对应的 API 密钥')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='WaffoSandboxPrivateKey'
                label={t('API 私钥（测试环境）')}
                placeholder={t(
                  '填写后覆盖当前测试环境私钥，留空表示保持当前不变',
                )}
                extraText={t('保存后不会回显，请填写测试环境对应的 API 私钥')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.TextArea
                field='WaffoSandboxPublicCert'
                label={t('Waffo 公钥（测试环境）')}
                placeholder={t(
                  '填写测试环境 Waffo 公钥，Base64 或 PEM 内容均可',
                )}
                extraText={t('用于校验测试环境的 Waffo 回调签名')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WaffoCurrency'
                label={t('货币')}
                placeholder='USD'
                extraText={t('Waffo 当前使用 USD 结算')}
                disabled
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='WaffoUnitPrice'
                precision={2}
                label={t('充值价格（x元/美金）')}
                placeholder={t('例如：7，就是7元/美金')}
                extraText={t('按 1 美元对应的站内价格填写')}
                min={0}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='WaffoMinTopUp'
                label={t('最低充值美元数量')}
                placeholder={t('例如：2，就是最低充值2$')}
                extraText={t('用户单次最少可充值的美元数量')}
                min={1}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoNotifyUrl'
                label={t('回调地址')}
                placeholder={t('例如：https://example.com/api/waffo/webhook')}
                extraText={t('留空则自动使用当前站点的默认回调地址')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoReturnUrl'
                label={t('支付返回地址')}
                placeholder={t('例如：https://example.com/console/topup')}
                extraText={t('留空则自动使用当前站点的默认充值页地址')}
              />
            </Col>
          </Row>
        </Form.Section>

        <Form.Section text={t('支付方式设置')}>
          <Text type='secondary'>
            {t(
              '这里配置 Waffo 下展示给用户的 Card、Apple Pay、Google Pay 等子支付方式。',
            )}
          </Text>
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <Button onClick={openAddPayMethodModal}>{t('新增支付方式')}</Button>
          </div>
          <Table
            columns={payMethodColumns}
            dataSource={waffoPayMethods}
            rowKey={(record, index) => index}
            pagination={false}
            size='small'
            empty={
              <Text type='tertiary'>{t('暂无支付方式，点击上方按钮新增')}</Text>
            }
          />
          <Button onClick={submitWaffoSetting} style={{ marginTop: 16 }}>
            {t('更新 Waffo 设置')}
          </Button>
        </Form.Section>
      </Form>

      {/* 新增/编辑支付方式弹窗 */}
      <Modal
        title={
          editingPayMethodIndex === -1 ? t('新增支付方式') : t('编辑支付方式')
        }
        visible={payMethodModalVisible}
        onOk={handlePayMethodModalOk}
        onCancel={() => setPayMethodModalVisible(false)}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('显示名称')}</Text>
              <span
                style={{ color: 'var(--semi-color-danger)', marginLeft: 4 }}
              >
                *
              </span>
            </div>
            <Input
              value={payMethodForm.name}
              onChange={(val) =>
                setPayMethodForm({ ...payMethodForm, name: val })
              }
              placeholder={t('例如：Credit Card')}
            />
            <Text type='tertiary' size='small'>
              {t('用户在充值页面看到的支付方式名称，例如：Credit Card')}
            </Text>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('图标')}</Text>
            </div>
            <Space align='center'>
              {payMethodForm.icon && (
                <img
                  src={payMethodForm.icon}
                  alt='preview'
                  style={{
                    width: 32,
                    height: 32,
                    objectFit: 'contain',
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 4,
                  }}
                />
              )}
              <input
                type='file'
                accept='image/*'
                ref={iconFileInputRef}
                style={{ display: 'none' }}
                onChange={handleIconFileChange}
              />
              <Button
                size='small'
                onClick={() => iconFileInputRef.current?.click()}
              >
                {payMethodForm.icon ? t('重新上传') : t('上传图片')}
              </Button>
              {payMethodForm.icon && (
                <Button
                  size='small'
                  type='danger'
                  onClick={() =>
                    setPayMethodForm((prev) => ({ ...prev, icon: '' }))
                  }
                >
                  {t('清除')}
                </Button>
              )}
            </Space>
            <div>
              <Text type='tertiary' size='small'>
                {t('上传 PNG/JPG/SVG 图片，建议尺寸 ≤ 128×128px')}
              </Text>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('支付方式类型')}</Text>
            </div>
            <Input
              value={payMethodForm.payMethodType}
              onChange={(val) =>
                setPayMethodForm({ ...payMethodForm, payMethodType: val })
              }
              placeholder='CREDITCARD,DEBITCARD'
              maxLength={64}
            />
            <Text type='tertiary' size='small'>
              {t(
                'Waffo API 参数，可空，例如：CREDITCARD,DEBITCARD（最多64位）',
              )}
            </Text>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('支付方式名称')}</Text>
            </div>
            <Input
              value={payMethodForm.payMethodName}
              onChange={(val) =>
                setPayMethodForm({ ...payMethodForm, payMethodName: val })
              }
              placeholder={t('可空')}
              maxLength={64}
            />
            <Text type='tertiary' size='small'>
              {t('Waffo API 参数，可空（最多64位）')}
            </Text>
          </div>
        </div>
      </Modal>
    </Spin>
  );
}
