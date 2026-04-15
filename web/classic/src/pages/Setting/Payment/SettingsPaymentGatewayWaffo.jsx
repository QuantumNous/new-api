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
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsPaymentGatewayWaffo(props) {
  const { t } = useTranslation();
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
  const [originInputs, setOriginInputs] = useState({});
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
        WaffoEnabled: props.options.WaffoEnabled === 'true' || props.options.WaffoEnabled === true,
        WaffoApiKey: props.options.WaffoApiKey || '',
        WaffoPrivateKey: props.options.WaffoPrivateKey || '',
        WaffoPublicCert: props.options.WaffoPublicCert || '',
        WaffoSandboxPublicCert: props.options.WaffoSandboxPublicCert || '',
        WaffoSandboxApiKey: props.options.WaffoSandboxApiKey || '',
        WaffoSandboxPrivateKey: props.options.WaffoSandboxPrivateKey || '',
        WaffoSandbox: props.options.WaffoSandbox === 'true',
        WaffoMerchantId: props.options.WaffoMerchantId || '',
        WaffoCurrency: props.options.WaffoCurrency || 'USD',
        WaffoUnitPrice: parseFloat(props.options.WaffoUnitPrice) || 1.0,
        WaffoMinTopUp: parseInt(props.options.WaffoMinTopUp) || 1,
        WaffoNotifyUrl: props.options.WaffoNotifyUrl || '',
        WaffoReturnUrl: props.options.WaffoReturnUrl || '',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
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

      options.push({ key: 'WaffoPublicCert', value: inputs.WaffoPublicCert || '' });
      options.push({ key: 'WaffoSandboxPublicCert', value: inputs.WaffoSandboxPublicCert || '' });

      if (inputs.WaffoSandboxApiKey && inputs.WaffoSandboxApiKey !== '') {
        options.push({ key: 'WaffoSandboxApiKey', value: inputs.WaffoSandboxApiKey });
      }

      if (inputs.WaffoSandboxPrivateKey && inputs.WaffoSandboxPrivateKey !== '') {
        options.push({ key: 'WaffoSandboxPrivateKey', value: inputs.WaffoSandboxPrivateKey });
      }

      options.push({
        key: 'WaffoSandbox',
        value: inputs.WaffoSandbox ? 'true' : 'false',
      });

      options.push({ key: 'WaffoMerchantId', value: inputs.WaffoMerchantId || '' });
      options.push({ key: 'WaffoCurrency', value: inputs.WaffoCurrency || '' });

      options.push({
        key: 'WaffoUnitPrice',
        value: String(inputs.WaffoUnitPrice || 1.0),
      });

      options.push({
        key: 'WaffoMinTopUp',
        value: String(inputs.WaffoMinTopUp || 1),
      });

      options.push({ key: 'WaffoNotifyUrl', value: inputs.WaffoNotifyUrl || '' });
      options.push({ key: 'WaffoReturnUrl', value: inputs.WaffoReturnUrl || '' });

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
        // 更新本地存储的原始值
        setOriginInputs({ ...inputs });
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
    setPayMethodForm({ name: '', icon: '', payMethodType: '', payMethodName: '' });
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
        <Form.Section text={t('Waffo 设置')}>
          <Text>
            {t('Waffo 是一个支付聚合平台，支持多种支付方式。')}
            <a href='https://waffo.com' target='_blank' rel='noreferrer'>
              Waffo Official Site
            </a>
            <br />
          </Text>
          <Banner
            type='info'
            description={t(
              '请在 Waffo 后台获取 API 密钥、商户 ID 以及 RSA 密钥对，并配置回调地址。',
            )}
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
                extraText={t('启用后将使用 Waffo 沙盒环境')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoApiKey'
                label={t('API 密钥 (生产)')}
                placeholder={t('生产环境 Waffo API 密钥')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoSandboxApiKey'
                label={t('API 密钥 (沙盒)')}
                placeholder={t('沙盒环境 Waffo API 密钥')}
                type='password'
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoMerchantId'
                label={t('商户 ID')}
                placeholder={t('Waffo 商户 ID')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='WaffoPrivateKey'
                label={t('RSA 私钥 (生产)')}
                placeholder={t('生产环境 RSA 私钥 Base64 (PKCS#8 DER)')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='WaffoSandboxPrivateKey'
                label={t('RSA 私钥 (沙盒)')}
                placeholder={t('沙盒环境 RSA 私钥 Base64 (PKCS#8 DER)')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='WaffoPublicCert'
                label={t('Waffo 公钥 (生产)')}
                placeholder={t('生产环境 Waffo 公钥 Base64 (X.509 DER)')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='WaffoSandboxPublicCert'
                label={t('Waffo 公钥 (沙盒)')}
                placeholder={t('沙盒环境 Waffo 公钥 Base64 (X.509 DER)')}
                type='password'
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='WaffoCurrency'
                label={t('货币')}
                disabled
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='WaffoUnitPrice'
                label={t('单价 (USD)')}
                placeholder='1.0'
                min={0}
                step={0.1}
                extraText={t('每个充值单位对应的 USD 金额，默认 1.0')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='WaffoMinTopUp'
                label={t('最低充值数量')}
                placeholder='1'
                min={1}
                step={1}
                extraText={t('Waffo 充值的最低数量，默认 1')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoNotifyUrl'
                label={t('回调通知地址')}
                placeholder={t('例如 https://example.com/api/waffo/webhook')}
                extraText={t('留空则自动使用 服务器地址 + /api/waffo/webhook')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WaffoReturnUrl'
                label={t('支付返回地址')}
                placeholder={t('例如 https://example.com/console/topup')}
                extraText={t('支付完成后用户跳转的页面，留空则自动使用 服务器地址 + /console/topup')}
              />
            </Col>
          </Row>

          <Button onClick={submitWaffoSetting} style={{ marginTop: 16 }}>
            {t('更新 Waffo 设置')}
          </Button>
        </Form.Section>
      </Form>

      {/* 支付方式配置区块（独立于 Form，使用独立状态管理） */}
      <div style={{ marginTop: 24 }}>
        <Typography.Title heading={6} style={{ marginBottom: 8 }}>{t('支付方式')}</Typography.Title>
        <Text type='secondary'>
          {t('配置 Waffo 充值时可用的支付方式，保存后在充值页面展示给用户。')}
        </Text>
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <Button onClick={openAddPayMethodModal}>
            {t('新增支付方式')}
          </Button>
        </div>
        <Table
          columns={payMethodColumns}
          dataSource={waffoPayMethods}
          rowKey={(record, index) => index}
          pagination={false}
          size='small'
          empty={<Text type='tertiary'>{t('暂无支付方式，点击上方按钮新增')}</Text>}
        />
        <Button onClick={submitWaffoSetting} style={{ marginTop: 16 }}>
          {t('更新 Waffo 设置')}
        </Button>
      </div>

      {/* 新增/编辑支付方式弹窗 */}
      <Modal
        title={editingPayMethodIndex === -1 ? t('新增支付方式') : t('编辑支付方式')}
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
              <span style={{ color: 'var(--semi-color-danger)', marginLeft: 4 }}>*</span>
            </div>
            <Input
              value={payMethodForm.name}
              onChange={(val) => setPayMethodForm({ ...payMethodForm, name: val })}
              placeholder={t('例如：Credit Card')}
            />
            <Text type='tertiary' size='small'>{t('用户在充值页面看到的支付方式名称，例如：Credit Card')}</Text>
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
              <Text type='tertiary' size='small'>{t('上传 PNG/JPG/SVG 图片，建议尺寸 ≤ 128×128px')}</Text>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('Pay Method Type')}</Text>
            </div>
            <Input
              value={payMethodForm.payMethodType}
              onChange={(val) => setPayMethodForm({ ...payMethodForm, payMethodType: val })}
              placeholder='CREDITCARD,DEBITCARD'
              maxLength={64}
            />
            <Text type='tertiary' size='small'>{t('Waffo API 参数，可空，例如：CREDITCARD,DEBITCARD（最多64位）')}</Text>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('Pay Method Name')}</Text>
            </div>
            <Input
              value={payMethodForm.payMethodName}
              onChange={(val) => setPayMethodForm({ ...payMethodForm, payMethodName: val })}
              placeholder={t('可空')}
              maxLength={64}
            />
            <Text type='tertiary' size='small'>{t('Waffo API 参数，可空（最多64位）')}</Text>
          </div>
        </div>
      </Modal>
    </Spin>
  );
}
